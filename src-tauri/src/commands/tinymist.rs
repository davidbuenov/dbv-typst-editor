// =============================================================================
// DBV Typst Editor — Integración con Language Server Tinymist (RF-21)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::oneshot;

pub const SIDECAR: &str = "tinymist";

pub struct TinymistProcess {
    child: Arc<Mutex<Option<CommandChild>>>,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>,
}

#[derive(Default)]
pub struct TinymistState {
    process: Arc<Mutex<Option<TinymistProcess>>>,
    next_id: AtomicU64,
}

/// Formatea un mensaje JSON-RPC con la cabecera Content-Length requerida por LSP.
pub fn format_lsp_message(body: &str) -> Vec<u8> {
    format!("Content-Length: {}\r\n\r\n{}", body.len(), body).into_bytes()
}

/// Extrae mensajes JSON-RPC completos de un buffer acumulativo según la norma LSP.
pub fn extract_lsp_messages(buf: &mut Vec<u8>) -> Vec<Value> {
    let mut messages = Vec::new();
    loop {
        let header_end = buf.windows(4).position(|w| w == b"\r\n\r\n");
        let Some(header_idx) = header_end else {
            break;
        };
        let header_str = match std::str::from_utf8(&buf[..header_idx]) {
            Ok(s) => s,
            Err(_) => break,
        };
        let mut content_length = None;
        for line in header_str.lines() {
            if let Some(val) = line.strip_prefix("Content-Length:") {
                if let Ok(n) = val.trim().parse::<usize>() {
                    content_length = Some(n);
                    break;
                }
            }
        }
        let Some(len) = content_length else {
            break;
        };
        let total_needed = header_idx + 4 + len;
        if buf.len() < total_needed {
            break;
        }
        let body_bytes = &buf[header_idx + 4..total_needed];
        if let Ok(val) = serde_json::from_slice::<Value>(body_bytes) {
            messages.push(val);
        }
        buf.drain(..total_needed);
    }
    messages
}

impl TinymistState {
    pub async fn send_request(&self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst) + 1;
        let (tx, rx) = oneshot::channel();

        let (child, pending) = {
            let proc_guard = self.process.lock().unwrap();
            let proc = proc_guard.as_ref().ok_or("Tinymist LSP no está en ejecución")?;
            (Arc::clone(&proc.child), Arc::clone(&proc.pending))
        };

        {
            let mut map = pending.lock().unwrap();
            map.insert(id, tx);
        }

        let body = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        })
        .to_string();

        let payload = format_lsp_message(&body);
        {
            let mut child_guard = child.lock().unwrap();
            let c = child_guard.as_mut().ok_or("Tinymist se ha cerrado")?;
            c.write(&payload)
                .map_err(|e| format!("Error al escribir en stdin de Tinymist: {e}"))?;
        }

        match tokio::time::timeout(Duration::from_secs(5), rx).await {
            Ok(Ok(res)) => res,
            Ok(Err(_)) => Err("Canal LSP cerrado prematuramente".to_string()),
            Err(_) => {
                let mut map = pending.lock().unwrap();
                map.remove(&id);
                Err(format!("Timeout esperando respuesta a {method}"))
            }
        }
    }

    pub fn send_notification(&self, method: &str, params: Value) -> Result<(), String> {
        let child = {
            let proc_guard = self.process.lock().unwrap();
            let proc = proc_guard.as_ref().ok_or("Tinymist LSP no está en ejecución")?;
            Arc::clone(&proc.child)
        };

        let body = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        })
        .to_string();

        let payload = format_lsp_message(&body);
        let mut child_guard = child.lock().unwrap();
        let c = child_guard.as_mut().ok_or("Tinymist se ha cerrado")?;
        c.write(&payload)
            .map_err(|e| format!("Error al escribir notificación en Tinymist: {e}"))?;
        Ok(())
    }

    pub fn stop(&self) {
        let mut proc_guard = self.process.lock().unwrap();
        if let Some(proc) = proc_guard.take() {
            if let Some(child) = proc.child.lock().unwrap().take() {
                let _ = child.kill();
            }
        }
    }
}

/// Inicia el Language Server Tinymist para el proyecto dado.
#[tauri::command]
pub async fn tinymist_start(
    app: AppHandle,
    state: State<'_, TinymistState>,
    root_path: Option<String>,
) -> Result<(), String> {
    state.stop();

    let command = app
        .shell()
        .sidecar(SIDECAR)
        .map_err(|e| format!("Sidecar tinymist no disponible: {e}"))?;

    let (mut events, child) = command
        .args(["lsp"])
        .set_raw_out(true)
        .spawn()
        .map_err(|e| format!("Fallo al arrancar tinymist lsp: {e}"))?;

    let child_arc = Arc::new(Mutex::new(Some(child)));
    let pending = Arc::new(Mutex::new(HashMap::new()));

    {
        let mut proc_guard = state.process.lock().unwrap();
        *proc_guard = Some(TinymistProcess {
            child: Arc::clone(&child_arc),
            pending: Arc::clone(&pending),
        });
    }

    // Tarea asíncrona de lectura de stdout de Tinymist
    let pending_clone = Arc::clone(&pending);
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut buffer = Vec::new();
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(chunk) => {
                    buffer.extend_from_slice(&chunk);
                    let messages = extract_lsp_messages(&mut buffer);
                    for msg in messages {
                        if let Some(id) = msg.get("id").and_then(|v| v.as_u64()) {
                            let mut map = pending_clone.lock().unwrap();
                            if let Some(tx) = map.remove(&id) {
                                if let Some(err) = msg.get("error") {
                                    let err_msg = err
                                        .get("message")
                                        .and_then(|m| m.as_str())
                                        .unwrap_or("LSP error");
                                    let _ = tx.send(Err(err_msg.to_string()));
                                } else {
                                    let res = msg.get("result").cloned().unwrap_or(Value::Null);
                                    let _ = tx.send(Ok(res));
                                }
                            }
                        } else {
                            // Notificación del servidor (e.g. textDocument/publishDiagnostics)
                            let _ = app_handle.emit("tinymist:notification", msg);
                        }
                    }
                }
                CommandEvent::Stderr(chunk) => {
                    let s = String::from_utf8_lossy(&chunk);
                    eprintln!("[tinymist] {s}");
                }
                CommandEvent::Terminated(_) => break,
                _ => {}
            }
        }
        // Fallar peticiones pendientes si el proceso muere
        let mut map = pending_clone.lock().unwrap();
        for (_, tx) in map.drain() {
            let _ = tx.send(Err("Tinymist se ha cerrado".to_string()));
        }
    });

    // Enviar initialize y esperar respuesta
    let root_uri = root_path.map(|p| {
        let clean = p.replace('\\', "/");
        if clean.starts_with('/') {
            format!("file://{clean}")
        } else {
            format!("file:///{clean}")
        }
    });

    let init_params = json!({
        "processId": null,
        "rootUri": root_uri,
        "capabilities": {
            "textDocument": {
                "synchronization": {
                    "dynamicRegistration": true,
                    "willSave": false,
                    "willSaveWaitUntil": false,
                    "didSave": true
                },
                "publishDiagnostics": {
                    "relatedInformation": true,
                    "versionSupport": true
                },
                "completion": {
                    "completionItem": {
                        "snippetSupport": true
                    }
                },
                "hover": {
                    "contentFormat": ["markdown", "plaintext"]
                },
                "formatting": {},
                "definition": {
                    "dynamicRegistration": true
                }
            }
        }
    });

    state
        .send_request("initialize", init_params)
        .await
        .map_err(|e| format!("Fallo en initialize de Tinymist: {e}"))?;

    state.send_notification("initialized", json!({}))?;

    Ok(())
}

/// Detiene el servidor Tinymist si está en marcha.
#[tauri::command]
pub fn tinymist_stop(state: State<'_, TinymistState>) -> Result<(), String> {
    state.stop();
    Ok(())
}

/// Envía una petición JSON-RPC con ID a Tinymist y espera la respuesta.
#[tauri::command]
pub async fn tinymist_send_request(
    state: State<'_, TinymistState>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    state.send_request(&method, params).await
}

/// Envía una notificación JSON-RPC sin esperar respuesta.
#[tauri::command]
pub fn tinymist_send_notification(
    state: State<'_, TinymistState>,
    method: String,
    params: Value,
) -> Result<(), String> {
    state.send_notification(&method, params)
}

/// Indica si el Language Server Tinymist está activo.
#[tauri::command]
pub fn tinymist_status(state: State<'_, TinymistState>) -> bool {
    state.process.lock().unwrap().is_some()
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn format_lsp_message_produce_longitud_correcta() {
        let body = r#"{"jsonrpc":"2.0","id":1}"#;
        let formatted = format_lsp_message(body);
        let expected = format!("Content-Length: {}\r\n\r\n{}", body.len(), body);
        expect_eq_bytes(&formatted, expected.as_bytes());
    }

    fn expect_eq_bytes(a: &[u8], b: &[u8]) {
        assert_eq!(std::str::from_utf8(a), std::str::from_utf8(b));
    }

    #[test]
    fn extract_lsp_messages_extrae_mensaje_completo() {
        let body = r#"{"jsonrpc":"2.0","id":1,"result":"ok"}"#;
        let mut buf = format_lsp_message(body);
        let msgs = extract_lsp_messages(&mut buf);
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0]["result"], "ok");
        assert!(buf.is_empty());
    }

    #[test]
    fn extract_lsp_messages_tolera_buffer_incompleto() {
        let body = r#"{"jsonrpc":"2.0","id":1,"result":"ok"}"#;
        let full = format_lsp_message(body);
        let mut partial = full[..full.len() - 5].to_vec();

        let msgs = extract_lsp_messages(&mut partial);
        assert!(msgs.is_empty());
        assert!(!partial.is_empty());

        // Completar buffer
        partial.extend_from_slice(&full[full.len() - 5..]);
        let msgs = extract_lsp_messages(&mut partial);
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0]["id"], 1);
        assert!(partial.is_empty());
    }

    #[test]
    fn extract_lsp_messages_extrae_multiples_mensajes() {
        let body1 = r#"{"id":1}"#;
        let body2 = r#"{"id":2}"#;
        let mut buf = format_lsp_message(body1);
        buf.extend_from_slice(&format_lsp_message(body2));

        let msgs = extract_lsp_messages(&mut buf);
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0]["id"], 1);
        assert_eq!(msgs[1]["id"], 2);
        assert!(buf.is_empty());
    }

    // `Content-Length` se mide en BYTES, no en caracteres. En un editor que se
    // usa en español, los cuerpos con acentos son el caso normal: una hover doc
    // o un diagnóstico de Tinymist los lleva casi siempre. Si alguien
    // "arreglara" `format_lsp_message` con `chars().count()`, la trama quedaría
    // corta y el canal se desincronizaría en silencio — el peor fallo posible en
    // un protocolo de longitud explícita, porque no lanza nada: simplemente deja
    // de haber respuestas.
    #[test]
    fn la_longitud_se_mide_en_bytes_no_en_caracteres() {
        let body = r#"{"result":"sección §7 — ñandú"}"#;
        assert!(body.len() > body.chars().count(), "el cuerpo debe ser multibyte");

        let mut buf = format_lsp_message(body);
        let msgs = extract_lsp_messages(&mut buf);

        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0]["result"], "sección §7 — ñandú");
        assert!(buf.is_empty(), "el marco debe consumirse entero");
    }

    // Un cuerpo que no es JSON válido se descarta, pero el marco SÍ se consume:
    // si no, el buffer se quedaría atascado en ese mensaje para siempre y el LSP
    // dejaría de responder sin dar un solo error.
    #[test]
    fn un_cuerpo_ilegible_no_atasca_el_buffer() {
        let mut buf = format_lsp_message("{esto no es json}");
        buf.extend_from_slice(&format_lsp_message(r#"{"id":7}"#));

        let msgs = extract_lsp_messages(&mut buf);

        assert_eq!(msgs.len(), 1, "el mensaje siguiente tiene que llegar igual");
        assert_eq!(msgs[0]["id"], 7);
        assert!(buf.is_empty());
    }

    // La cabecera puede llegar partida entre dos lecturas del proceso hijo: hasta
    // que no está el `\r\n\r\n` completo no se puede consumir nada.
    #[test]
    fn una_cabecera_partida_no_consume_nada_hasta_completarse() {
        let completo = format_lsp_message(r#"{"id":9}"#);
        let corte = 8;

        let mut buf = completo[..corte].to_vec();
        assert!(extract_lsp_messages(&mut buf).is_empty());
        assert_eq!(buf.len(), corte, "no debe consumir una cabecera a medias");

        buf.extend_from_slice(&completo[corte..]);
        let msgs = extract_lsp_messages(&mut buf);
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0]["id"], 9);
        assert!(buf.is_empty());
    }
}
