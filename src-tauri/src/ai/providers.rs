// =============================================================================
// DBV Typst Editor — Proveedores de IA: petición y streaming (RF-90, RF-92)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Una petición de chat NORMALIZADA (mensajes, imágenes, herramientas) se
// traduce al protocolo del proveedor y su respuesta en streaming (SSE) vuelve
// como eventos normalizados: texto, llamada a herramienta, uso, fin, error.
//
// Dos protocolos cubren a todos los proveedores de RF-90:
//   · compatible con OpenAI (`/chat/completions`): Ollama, LM Studio,
//     cualquier servidor local (llama.cpp, vLLM, Jan…), OpenAI, OpenRouter y
//     Gemini (su punto `v1beta/openai`);
//   · Anthropic Messages (`/messages`), nativo.
//
// La clave de API la pone Rust en la cabecera justo al hacer la petición: el
// frontend nunca la ve (RNF-IA.5).

use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Read};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::connections::{Connection, Protocol};
use super::AiError;

/// Imagen adjunta (p. ej. una página de la vista previa, RF-92.3).
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ImageData {
    pub mime: String,
    pub base64: String,
}

/// Llamada a herramienta que hizo el modelo (o que se le devuelve en el historial).
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    /// JSON de los argumentos, tal cual lo generó el modelo.
    pub arguments: String,
}

/// Un mensaje de la conversación, normalizado.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    /// `system`, `user`, `assistant` o `tool`.
    pub role: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub images: Vec<ImageData>,
    #[serde(default)]
    pub tool_calls: Vec<ToolCall>,
    /// En un mensaje `tool`: a qué llamada responde.
    #[serde(default)]
    pub tool_call_id: Option<String>,
}

/// Herramienta que el asistente ofrece al modelo (RF-94).
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ToolSpec {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

/// Petición normalizada que llega del frontend.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub tools: Vec<ToolSpec>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub temperature: Option<f32>,
}

/// Lo que se va emitiendo mientras llega la respuesta.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum StreamEvent {
    Text { text: String },
    ToolCall { id: String, name: String, arguments: String },
    Usage { input: u64, output: u64 },
    Done {
        #[serde(rename = "stopReason")]
        stop_reason: String,
    },
}

// ---------------------------------------------------------------------------
// Cuerpo de la petición
// ---------------------------------------------------------------------------

/// Cuerpo para `/chat/completions` (protocolo compatible con OpenAI).
pub fn openai_body(request: &ChatRequest, model: &str) -> Value {
    let messages: Vec<Value> = request
        .messages
        .iter()
        .map(|message| match message.role.as_str() {
            "tool" => json!({
                "role": "tool",
                "tool_call_id": message.tool_call_id.clone().unwrap_or_default(),
                "content": message.content,
            }),
            "assistant" if !message.tool_calls.is_empty() => json!({
                "role": "assistant",
                "content": if message.content.is_empty() { Value::Null } else { Value::String(message.content.clone()) },
                "tool_calls": message.tool_calls.iter().map(|call| json!({
                    "id": call.id,
                    "type": "function",
                    "function": { "name": call.name, "arguments": call.arguments },
                })).collect::<Vec<_>>(),
            }),
            role if !message.images.is_empty() => {
                let mut parts = vec![json!({ "type": "text", "text": message.content })];
                parts.extend(message.images.iter().map(|image| {
                    json!({ "type": "image_url", "image_url": { "url": format!("data:{};base64,{}", image.mime, image.base64) } })
                }));
                json!({ "role": role, "content": parts })
            }
            role => json!({ "role": role, "content": message.content }),
        })
        .collect();
    let mut body = json!({
        "model": model,
        "messages": messages,
        "stream": true,
        "stream_options": { "include_usage": true },
    });
    if !request.tools.is_empty() {
        body["tools"] = request
            .tools
            .iter()
            .map(|tool| json!({ "type": "function", "function": { "name": tool.name, "description": tool.description, "parameters": tool.parameters } }))
            .collect();
    }
    if let Some(max) = request.max_tokens {
        body["max_tokens"] = json!(max);
    }
    if let Some(temperature) = request.temperature {
        body["temperature"] = json!(temperature);
    }
    body
}

/// Cuerpo para `/messages` (Anthropic). El sistema va aparte; los resultados de
/// herramienta van como bloques `tool_result` de un mensaje `user`, y los
/// mensajes consecutivos del mismo rol se funden (lo exige la API).
pub fn anthropic_body(request: &ChatRequest, model: &str) -> Value {
    let system: Vec<&str> = request.messages.iter().filter(|m| m.role == "system").map(|m| m.content.as_str()).collect();
    let mut messages: Vec<Value> = Vec::new();
    for message in request.messages.iter().filter(|m| m.role != "system") {
        let (role, blocks): (&str, Vec<Value>) = match message.role.as_str() {
            "tool" => (
                "user",
                vec![json!({ "type": "tool_result", "tool_use_id": message.tool_call_id.clone().unwrap_or_default(), "content": message.content })],
            ),
            "assistant" => {
                let mut blocks = Vec::new();
                if !message.content.is_empty() {
                    blocks.push(json!({ "type": "text", "text": message.content }));
                }
                for call in &message.tool_calls {
                    let input: Value = serde_json::from_str(&call.arguments).unwrap_or_else(|_| json!({}));
                    blocks.push(json!({ "type": "tool_use", "id": call.id, "name": call.name, "input": input }));
                }
                ("assistant", blocks)
            }
            _ => {
                let mut blocks: Vec<Value> = message
                    .images
                    .iter()
                    .map(|image| json!({ "type": "image", "source": { "type": "base64", "media_type": image.mime, "data": image.base64 } }))
                    .collect();
                blocks.push(json!({ "type": "text", "text": message.content }));
                ("user", blocks)
            }
        };
        match messages.last_mut() {
            Some(last) if last["role"] == role => {
                if let Some(content) = last["content"].as_array_mut() {
                    content.extend(blocks);
                }
            }
            _ => messages.push(json!({ "role": role, "content": blocks })),
        }
    }
    let mut body = json!({
        "model": model,
        "messages": messages,
        "max_tokens": request.max_tokens.unwrap_or(4096),
        "stream": true,
    });
    if !system.is_empty() {
        body["system"] = json!(system.join("\n\n"));
    }
    if !request.tools.is_empty() {
        body["tools"] = request
            .tools
            .iter()
            .map(|tool| json!({ "name": tool.name, "description": tool.description, "input_schema": tool.parameters }))
            .collect();
    }
    if let Some(temperature) = request.temperature {
        body["temperature"] = json!(temperature);
    }
    body
}

/// Cuerpo para `/api/chat` (Ollama nativo): argumentos de herramienta como
/// objeto, imágenes en base64 y `num_ctx` explícito.
pub fn ollama_body(request: &ChatRequest, model: &str, context: u32) -> Value {
    let messages: Vec<Value> = request
        .messages
        .iter()
        .map(|message| {
            let mut entry = json!({ "role": message.role, "content": message.content });
            if !message.images.is_empty() {
                entry["images"] = message.images.iter().map(|image| json!(image.base64)).collect();
            }
            if !message.tool_calls.is_empty() {
                entry["tool_calls"] = message
                    .tool_calls
                    .iter()
                    .map(|call| json!({ "function": { "name": call.name, "arguments": serde_json::from_str::<Value>(&call.arguments).unwrap_or_else(|_| json!({})) } }))
                    .collect();
            }
            entry
        })
        .collect();
    let mut options = json!({ "num_ctx": context });
    if let Some(temperature) = request.temperature {
        options["temperature"] = json!(temperature);
    }
    if let Some(max) = request.max_tokens {
        options["num_predict"] = json!(max);
    }
    let mut body = json!({ "model": model, "messages": messages, "stream": true, "options": options });
    if !request.tools.is_empty() {
        body["tools"] = request
            .tools
            .iter()
            .map(|tool| json!({ "type": "function", "function": { "name": tool.name, "description": tool.description, "parameters": tool.parameters } }))
            .collect();
    }
    body
}

// ---------------------------------------------------------------------------
// Respuesta en streaming
// ---------------------------------------------------------------------------

/// Acumula los fragmentos de un stream compatible con OpenAI. Las llamadas a
/// herramienta llegan troceadas por `index` y se emiten enteras al final.
#[derive(Default)]
pub struct OpenAiStream {
    calls: BTreeMap<u64, (String, String, String)>,
    stop: Option<String>,
}

impl OpenAiStream {
    /// Procesa el `data:` de un evento SSE.
    pub fn feed(&mut self, data: &str, emit: &mut dyn FnMut(StreamEvent)) {
        if data.trim() == "[DONE]" {
            return;
        }
        let Ok(chunk) = serde_json::from_str::<Value>(data) else { return };
        if let Some(usage) = chunk.get("usage").filter(|u| u.is_object()) {
            emit(StreamEvent::Usage {
                input: usage["prompt_tokens"].as_u64().unwrap_or(0),
                output: usage["completion_tokens"].as_u64().unwrap_or(0),
            });
        }
        let Some(choice) = chunk["choices"].get(0) else { return };
        let delta = &choice["delta"];
        if let Some(text) = delta["content"].as_str().filter(|t| !t.is_empty()) {
            emit(StreamEvent::Text { text: text.to_string() });
        }
        for call in delta["tool_calls"].as_array().into_iter().flatten() {
            let index = call["index"].as_u64().unwrap_or(0);
            let entry = self.calls.entry(index).or_default();
            if let Some(id) = call["id"].as_str() {
                entry.0 = id.to_string();
            }
            if let Some(name) = call["function"]["name"].as_str() {
                entry.1.push_str(name);
            }
            if let Some(arguments) = call["function"]["arguments"].as_str() {
                entry.2.push_str(arguments);
            }
        }
        if let Some(reason) = choice["finish_reason"].as_str() {
            self.stop = Some(reason.to_string());
        }
    }

    /// Fin del stream: emite las llamadas acumuladas y el motivo de parada.
    pub fn finish(self, emit: &mut dyn FnMut(StreamEvent)) {
        let has_calls = !self.calls.is_empty();
        for (index, (id, name, arguments)) in self.calls {
            let id = if id.is_empty() { format!("call_{index}") } else { id };
            emit(StreamEvent::ToolCall { id, name, arguments: if arguments.is_empty() { "{}".into() } else { arguments } });
        }
        let stop = self.stop.unwrap_or_else(|| if has_calls { "tool_calls".into() } else { "stop".into() });
        emit(StreamEvent::Done { stop_reason: normalize_stop(&stop) });
    }
}

/// Acumula un stream de Anthropic (`content_block_*`, `message_delta`).
#[derive(Default)]
pub struct AnthropicStream {
    blocks: BTreeMap<u64, (String, String, String)>,
    input: u64,
    output: u64,
    stop: Option<String>,
}

impl AnthropicStream {
    pub fn feed(&mut self, data: &str, emit: &mut dyn FnMut(StreamEvent)) {
        let Ok(event) = serde_json::from_str::<Value>(data) else { return };
        match event["type"].as_str().unwrap_or_default() {
            "message_start" => self.input = event["message"]["usage"]["input_tokens"].as_u64().unwrap_or(0),
            "content_block_start" => {
                let block = &event["content_block"];
                if block["type"] == "tool_use" {
                    let index = event["index"].as_u64().unwrap_or(0);
                    self.blocks.insert(
                        index,
                        (block["id"].as_str().unwrap_or_default().into(), block["name"].as_str().unwrap_or_default().into(), String::new()),
                    );
                }
            }
            "content_block_delta" => {
                let delta = &event["delta"];
                if let Some(text) = delta["text"].as_str() {
                    emit(StreamEvent::Text { text: text.to_string() });
                } else if let Some(partial) = delta["partial_json"].as_str() {
                    if let Some(block) = self.blocks.get_mut(&event["index"].as_u64().unwrap_or(0)) {
                        block.2.push_str(partial);
                    }
                }
            }
            "message_delta" => {
                if let Some(reason) = event["delta"]["stop_reason"].as_str() {
                    self.stop = Some(reason.to_string());
                }
                self.output = event["usage"]["output_tokens"].as_u64().unwrap_or(self.output);
            }
            _ => {}
        }
    }

    pub fn finish(self, emit: &mut dyn FnMut(StreamEvent)) {
        for (_, (id, name, arguments)) in self.blocks {
            emit(StreamEvent::ToolCall { id, name, arguments: if arguments.is_empty() { "{}".into() } else { arguments } });
        }
        emit(StreamEvent::Usage { input: self.input, output: self.output });
        emit(StreamEvent::Done { stop_reason: normalize_stop(&self.stop.unwrap_or_else(|| "end_turn".into())) });
    }
}

/// Stream de Ollama: una línea JSON por trozo (NDJSON), la última con `done`.
#[derive(Default)]
pub struct OllamaStream {
    calls: Vec<(String, String)>,
    input: u64,
    output: u64,
    stop: Option<String>,
}

impl OllamaStream {
    pub fn feed(&mut self, line: &str, emit: &mut dyn FnMut(StreamEvent)) {
        let Ok(chunk) = serde_json::from_str::<Value>(line) else { return };
        let message = &chunk["message"];
        if let Some(text) = message["content"].as_str().filter(|t| !t.is_empty()) {
            emit(StreamEvent::Text { text: text.to_string() });
        }
        for call in message["tool_calls"].as_array().into_iter().flatten() {
            let name = call["function"]["name"].as_str().unwrap_or_default().to_string();
            let arguments = match &call["function"]["arguments"] {
                Value::String(text) => text.clone(),
                other => other.to_string(),
            };
            self.calls.push((name, arguments));
        }
        if chunk["done"].as_bool() == Some(true) {
            self.input = chunk["prompt_eval_count"].as_u64().unwrap_or(0);
            self.output = chunk["eval_count"].as_u64().unwrap_or(0);
            self.stop = Some(chunk["done_reason"].as_str().unwrap_or("stop").to_string());
        }
    }

    pub fn finish(self, emit: &mut dyn FnMut(StreamEvent)) {
        let has_calls = !self.calls.is_empty();
        for (index, (name, arguments)) in self.calls.into_iter().enumerate() {
            emit(StreamEvent::ToolCall { id: format!("call_{index}"), name, arguments: if arguments.is_empty() { "{}".into() } else { arguments } });
        }
        emit(StreamEvent::Usage { input: self.input, output: self.output });
        let stop = if has_calls { "tool_calls".to_string() } else { self.stop.unwrap_or_else(|| "stop".into()) };
        emit(StreamEvent::Done { stop_reason: normalize_stop(&stop) });
    }
}

/// Lee un stream NDJSON (una línea JSON por evento), con cancelación.
pub fn read_lines(reader: impl Read, cancelled: &AtomicBool, mut on_line: impl FnMut(&str)) -> Result<(), AiError> {
    for line in BufReader::new(reader).lines() {
        if cancelled.load(Ordering::SeqCst) {
            return Err(AiError::Cancelled("cancelado por el usuario".into()));
        }
        let line = line.map_err(|error| AiError::Network(format!("la conexión se cortó: {error}")))?;
        if !line.trim().is_empty() {
            on_line(&line);
        }
    }
    Ok(())
}

/// Raíz del servidor de Ollama a partir de la URL de la conexión (`…/v1`).
pub fn ollama_host(base_url: &str) -> String {
    base_url.trim_end_matches('/').trim_end_matches("/v1").trim_end_matches('/').to_string()
}

/// Motivos de parada de los dos protocolos → `stop`, `toolCalls`, `length`.
fn normalize_stop(reason: &str) -> String {
    match reason {
        "tool_calls" | "tool_use" | "function_call" => "toolCalls",
        "length" | "max_tokens" => "length",
        _ => "stop",
    }
    .to_string()
}

/// Lee un stream SSE línea a línea y entrega el `data:` de cada evento. Se
/// para en cuanto `cancelled` se activa (como mucho, una línea después).
pub fn read_sse(reader: impl Read, cancelled: &AtomicBool, mut on_data: impl FnMut(&str)) -> Result<(), AiError> {
    let mut data = String::new();
    for line in BufReader::new(reader).lines() {
        if cancelled.load(Ordering::SeqCst) {
            return Err(AiError::Cancelled("cancelado por el usuario".into()));
        }
        let line = line.map_err(|error| AiError::Network(format!("la conexión se cortó: {error}")))?;
        if line.is_empty() {
            if !data.is_empty() {
                on_data(&data);
                data.clear();
            }
        } else if let Some(rest) = line.strip_prefix("data:") {
            if !data.is_empty() {
                data.push('\n');
            }
            data.push_str(rest.trim_start());
        }
    }
    if !data.is_empty() {
        on_data(&data);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .http_status_as_error(false)
        .timeout_connect(Some(Duration::from_secs(15)))
        // Un modelo local grande puede tardar en dar el primer token.
        .timeout_recv_response(Some(Duration::from_secs(300)))
        .build()
        .new_agent()
}

/// Mensaje de error de un proveedor (`{"error": {"message": …}}` en los dos protocolos).
pub fn error_message(body: &str) -> String {
    serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|value| value["error"]["message"].as_str().or_else(|| value["error"].as_str()).map(str::to_string))
        .unwrap_or_else(|| body.chars().take(400).collect())
}

/// Código HTTP → error tipado que la interfaz sabe explicar (RF-90.3, RF-92.7).
pub fn classify_status(status: u16, body: &str) -> AiError {
    let message = error_message(body);
    let lower = message.to_lowercase();
    match status {
        401 | 403 => AiError::Auth(message),
        404 => AiError::NotFound(message),
        429 => AiError::RateLimit(message),
        400 | 413 | 422 if lower.contains("context") || lower.contains("too long") || lower.contains("maximum") || lower.contains("tokens") => {
            AiError::ContextTooLong(message)
        }
        400..=499 => AiError::BadRequest(message),
        _ => AiError::Server(format!("HTTP {status}: {message}")),
    }
}

fn with_headers<B>(request: ureq::RequestBuilder<B>, connection: &Connection, key: Option<&str>) -> ureq::RequestBuilder<B> {
    let mut request = request.header("Content-Type", "application/json");
    match connection.protocol() {
        Protocol::Anthropic => {
            request = request.header("anthropic-version", "2023-06-01");
            if let Some(key) = key {
                request = request.header("x-api-key", key);
            }
        }
        Protocol::OpenAi | Protocol::Ollama => {
            if let Some(key) = key {
                request = request.header("Authorization", &format!("Bearer {key}"));
            }
            // OpenRouter pide identificar la aplicación (opcional pero recomendado).
            request = request.header("HTTP-Referer", "https://github.com/davidbuenov/dbv-typst-editor").header("X-Title", "DBV Typst Editor");
        }
    }
    request
}

/// Hace la petición de chat y va emitiendo eventos hasta el final.
pub fn stream_chat(
    connection: &Connection,
    key: Option<&str>,
    request: &ChatRequest,
    cancelled: &AtomicBool,
    emit: &mut dyn FnMut(StreamEvent),
) -> Result<(), AiError> {
    let base = connection.base_url.trim_end_matches('/');
    let (url, body) = match connection.protocol() {
        Protocol::Anthropic => (format!("{base}/messages"), anthropic_body(request, &connection.model)),
        Protocol::OpenAi => (format!("{base}/chat/completions"), openai_body(request, &connection.model)),
        Protocol::Ollama => (format!("{}/api/chat", ollama_host(base)), ollama_body(request, &connection.model, connection.context())),
    };
    let response = with_headers(agent().post(&url), connection, key)
        .send_json(&body)
        .map_err(|error| AiError::Network(format!("no se pudo conectar con {base}: {error}")))?;
    let status = response.status().as_u16();
    let mut body = response.into_body();
    if status >= 400 {
        let text = body.read_to_string().unwrap_or_default();
        return Err(classify_status(status, &text));
    }
    match connection.protocol() {
        Protocol::Anthropic => {
            let mut stream = AnthropicStream::default();
            read_sse(body.into_reader(), cancelled, |data| stream.feed(data, emit))?;
            stream.finish(emit);
        }
        Protocol::OpenAi => {
            let mut stream = OpenAiStream::default();
            read_sse(body.into_reader(), cancelled, |data| stream.feed(data, emit))?;
            stream.finish(emit);
        }
        Protocol::Ollama => {
            let mut stream = OllamaStream::default();
            read_lines(body.into_reader(), cancelled, |line| stream.feed(line, emit))?;
            stream.finish(emit);
        }
    }
    Ok(())
}

/// Modelos que ofrece el proveedor (también sirve de «Probar conexión»).
pub fn list_models(connection: &Connection, key: Option<&str>) -> Result<Vec<String>, AiError> {
    let base = connection.base_url.trim_end_matches('/');
    let response = with_headers(agent().get(&format!("{base}/models")), connection, key)
        .call()
        .map_err(|error| AiError::Network(format!("no se pudo conectar con {base}: {error}")))?;
    let status = response.status().as_u16();
    let text = response.into_body().read_to_string().unwrap_or_default();
    if status >= 400 {
        return Err(classify_status(status, &text));
    }
    let value: Value = serde_json::from_str(&text).map_err(|error| AiError::BadRequest(format!("respuesta inesperada de {base}: {error}")))?;
    let mut models: Vec<String> = value["data"]
        .as_array()
        .or_else(|| value["models"].as_array())
        .into_iter()
        .flatten()
        .filter_map(|model| model["id"].as_str().or_else(|| model["name"].as_str()).map(|id| id.trim_start_matches("models/").to_string()))
        .collect();
    models.sort();
    models.dedup();
    Ok(models)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::connections::ProviderKind;
    use std::io::Write;
    use std::net::TcpListener;

    fn request() -> ChatRequest {
        ChatRequest {
            messages: vec![
                ChatMessage { role: "system".into(), content: "Eres útil.".into(), images: vec![], tool_calls: vec![], tool_call_id: None },
                ChatMessage {
                    role: "user".into(),
                    content: "Mira esto".into(),
                    images: vec![ImageData { mime: "image/png".into(), base64: "AAA".into() }],
                    tool_calls: vec![],
                    tool_call_id: None,
                },
                ChatMessage {
                    role: "assistant".into(),
                    content: String::new(),
                    images: vec![],
                    tool_calls: vec![ToolCall { id: "c1".into(), name: "read_file".into(), arguments: r#"{"path":"main.typ"}"#.into() }],
                    tool_call_id: None,
                },
                ChatMessage { role: "tool".into(), content: "= Hola".into(), images: vec![], tool_calls: vec![], tool_call_id: Some("c1".into()) },
            ],
            tools: vec![ToolSpec { name: "read_file".into(), description: "Lee".into(), parameters: json!({"type": "object"}) }],
            max_tokens: Some(100),
            temperature: None,
        }
    }

    #[test]
    fn el_cuerpo_openai_lleva_imagenes_herramientas_y_resultados() {
        let body = openai_body(&request(), "llama3");
        assert_eq!(body["model"], "llama3");
        assert_eq!(body["messages"][1]["content"][1]["image_url"]["url"], "data:image/png;base64,AAA");
        assert_eq!(body["messages"][2]["tool_calls"][0]["function"]["name"], "read_file");
        assert_eq!(body["messages"][3]["tool_call_id"], "c1");
        assert_eq!(body["tools"][0]["function"]["name"], "read_file");
        assert_eq!(body["stream"], true);
    }

    #[test]
    fn el_cuerpo_anthropic_separa_el_sistema_y_usa_bloques() {
        let body = anthropic_body(&request(), "claude");
        assert_eq!(body["system"], "Eres útil.");
        assert_eq!(body["messages"][0]["content"][0]["type"], "image");
        assert_eq!(body["messages"][1]["content"][0]["type"], "tool_use");
        assert_eq!(body["messages"][1]["content"][0]["input"]["path"], "main.typ");
        assert_eq!(body["messages"][2]["content"][0]["type"], "tool_result");
        assert_eq!(body["tools"][0]["input_schema"]["type"], "object");
    }

    #[test]
    fn anthropic_funde_mensajes_consecutivos_del_mismo_rol() {
        let mut req = request();
        req.messages.push(ChatMessage { role: "user".into(), content: "¿Y ahora?".into(), images: vec![], tool_calls: vec![], tool_call_id: None });
        let body = anthropic_body(&req, "claude");
        let last = body["messages"].as_array().unwrap().last().unwrap();
        assert_eq!(last["role"], "user");
        assert_eq!(last["content"].as_array().unwrap().len(), 2, "tool_result + texto en un solo mensaje");
    }

    fn collect(protocol: Protocol, sse: &str) -> Vec<StreamEvent> {
        let mut events = Vec::new();
        let cancelled = AtomicBool::new(false);
        let mut emit = |event| events.push(event);
        match protocol {
            Protocol::OpenAi => {
                let mut stream = OpenAiStream::default();
                read_sse(sse.as_bytes(), &cancelled, |data| stream.feed(data, &mut emit)).unwrap();
                stream.finish(&mut emit);
            }
            Protocol::Anthropic => {
                let mut stream = AnthropicStream::default();
                read_sse(sse.as_bytes(), &cancelled, |data| stream.feed(data, &mut emit)).unwrap();
                stream.finish(&mut emit);
            }
            Protocol::Ollama => {
                let mut stream = OllamaStream::default();
                read_lines(sse.as_bytes(), &cancelled, |line| stream.feed(line, &mut emit)).unwrap();
                stream.finish(&mut emit);
            }
        }
        events
    }

    const OPENAI_SSE: &str = "data: {\"choices\":[{\"delta\":{\"content\":\"Ho\"}}]}\n\n\
data: {\"choices\":[{\"delta\":{\"content\":\"la\"}}]}\n\n\
data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"function\":{\"name\":\"read_file\",\"arguments\":\"{\\\"pa\"}}]}}]}\n\n\
data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"th\\\":\\\"a.typ\\\"}\"}}]},\"finish_reason\":\"tool_calls\"}]}\n\n\
data: {\"choices\":[],\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":5}}\n\n\
data: [DONE]\n\n";

    #[test]
    fn stream_openai_texto_herramienta_troceada_y_uso() {
        let events = collect(Protocol::OpenAi, OPENAI_SSE);
        assert_eq!(
            events,
            vec![
                StreamEvent::Text { text: "Ho".into() },
                StreamEvent::Text { text: "la".into() },
                StreamEvent::Usage { input: 12, output: 5 },
                StreamEvent::ToolCall { id: "call_1".into(), name: "read_file".into(), arguments: r#"{"path":"a.typ"}"#.into() },
                StreamEvent::Done { stop_reason: "toolCalls".into() },
            ]
        );
    }

    #[test]
    fn stream_anthropic_texto_y_herramienta() {
        let sse = "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"usage\":{\"input_tokens\":30}}}\n\n\
event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Vale\"}}\n\n\
event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":1,\"content_block\":{\"type\":\"tool_use\",\"id\":\"tu_1\",\"name\":\"search_docs\"}}\n\n\
event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":1,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":\"{\\\"query\\\":\\\"table\\\"}\"}}\n\n\
event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"tool_use\"},\"usage\":{\"output_tokens\":9}}\n\n";
        let events = collect(Protocol::Anthropic, sse);
        assert_eq!(
            events,
            vec![
                StreamEvent::Text { text: "Vale".into() },
                StreamEvent::ToolCall { id: "tu_1".into(), name: "search_docs".into(), arguments: r#"{"query":"table"}"#.into() },
                StreamEvent::Usage { input: 30, output: 9 },
                StreamEvent::Done { stop_reason: "toolCalls".into() },
            ]
        );
    }

    #[test]
    fn la_cancelacion_corta_el_stream() {
        let cancelled = AtomicBool::new(true);
        let result = read_sse(OPENAI_SSE.as_bytes(), &cancelled, |_| {});
        assert!(matches!(result, Err(AiError::Cancelled(_))));
    }

    #[test]
    fn ollama_nativo_fija_el_contexto_y_lee_ndjson() {
        let body = ollama_body(&request(), "llama3", 8192);
        assert_eq!(body["options"]["num_ctx"], 8192);
        assert_eq!(body["messages"][1]["images"][0], "AAA");
        assert_eq!(body["messages"][2]["tool_calls"][0]["function"]["arguments"]["path"], "main.typ");
        assert_eq!(ollama_host("http://localhost:11434/v1/"), "http://localhost:11434");

        let ndjson = concat!(
            r#"{"message":{"role":"assistant","content":"Ho"},"done":false}"#, "\n",
            r#"{"message":{"role":"assistant","content":"","tool_calls":[{"function":{"name":"read_file","arguments":{"path":"a.typ"}}}]},"done":false}"#, "\n",
            r#"{"message":{"role":"assistant","content":""},"done":true,"done_reason":"stop","prompt_eval_count":40,"eval_count":7}"#, "\n",
        );
        let mut events = Vec::new();
        let mut stream = OllamaStream::default();
        read_lines(ndjson.as_bytes(), &AtomicBool::new(false), |line| stream.feed(line, &mut |e| events.push(e))).unwrap();
        stream.finish(&mut |e| events.push(e));
        assert_eq!(
            events,
            vec![
                StreamEvent::Text { text: "Ho".into() },
                StreamEvent::ToolCall { id: "call_0".into(), name: "read_file".into(), arguments: r#"{"path":"a.typ"}"#.into() },
                StreamEvent::Usage { input: 40, output: 7 },
                StreamEvent::Done { stop_reason: "toolCalls".into() },
            ]
        );
    }

    /// Prueba con un Ollama real: `DBV_OLLAMA_MODEL=llama3 cargo test --lib ollama_real -- --ignored`.
    #[test]
    #[ignore]
    fn ollama_real_responde_en_streaming_y_avisa_si_no_admite_herramientas() {
        let model = std::env::var("DBV_OLLAMA_MODEL").unwrap_or_else(|_| "llama3".into());
        let mut conn = connection("http://localhost:11434/v1", ProviderKind::Ollama);
        conn.model = model;
        let mut ask = request();
        ask.messages = vec![ChatMessage { role: "user".into(), content: "Reply with the single word: hola".into(), images: vec![], tool_calls: vec![], tool_call_id: None }];
        let mut no_tools = ask.clone();
        no_tools.tools.clear();
        let mut events = Vec::new();
        stream_chat(&conn, None, &no_tools, &AtomicBool::new(false), &mut |e| events.push(e)).expect("Ollama debe responder");
        let text: String = events.iter().filter_map(|e| if let StreamEvent::Text { text } = e { Some(text.as_str()) } else { None }).collect();
        assert!(text.to_lowercase().contains("hola"), "{text}");
        assert!(matches!(events.last(), Some(StreamEvent::Done { .. })));
        // Con herramientas: o las admite, o el error lo dice (el frontend pasa a modo conversación).
        match stream_chat(&conn, None, &ask, &AtomicBool::new(false), &mut |_| {}) {
            Ok(()) => {}
            Err(AiError::BadRequest(message)) => assert!(message.contains("tools"), "{message}"),
            Err(other) => panic!("error inesperado: {other:?}"),
        }
    }

    #[test]
    fn los_eventos_viajan_en_camel_case() {
        let raw = serde_json::to_value(StreamEvent::Done { stop_reason: "stop".into() }).unwrap();
        assert_eq!(raw, json!({"type": "done", "stopReason": "stop"}));
        let call = serde_json::to_value(StreamEvent::ToolCall { id: "1".into(), name: "n".into(), arguments: "{}".into() }).unwrap();
        assert_eq!(call["type"], "toolCall");
    }

    #[test]
    fn los_codigos_http_se_clasifican() {
        assert!(matches!(classify_status(401, r#"{"error":{"message":"Invalid API key"}}"#), AiError::Auth(m) if m == "Invalid API key"));
        assert!(matches!(classify_status(429, "{}"), AiError::RateLimit(_)));
        assert!(matches!(classify_status(404, "model not found"), AiError::NotFound(_)));
        assert!(matches!(classify_status(400, r#"{"error":{"message":"maximum context length exceeded"}}"#), AiError::ContextTooLong(_)));
        assert!(matches!(classify_status(500, "boom"), AiError::Server(_)));
    }

    /// Servidor HTTP de una sola respuesta: devuelve `response` tal cual y
    /// guarda la petición recibida.
    fn serve(response: String) -> (String, std::thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        let handle = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            let mut received = Vec::new();
            let mut buffer = [0u8; 8192];
            loop {
                let read = socket.read(&mut buffer).unwrap();
                received.extend_from_slice(&buffer[..read]);
                let text = String::from_utf8_lossy(&received).to_string();
                if let Some(head_end) = text.find("\r\n\r\n") {
                    let length = text[..head_end]
                        .lines()
                        .find_map(|line| line.to_lowercase().strip_prefix("content-length:").map(|v| v.trim().parse::<usize>().unwrap_or(0)))
                        .unwrap_or(0);
                    if received.len() >= head_end + 4 + length {
                        break;
                    }
                }
                if read == 0 {
                    break;
                }
            }
            socket.write_all(response.as_bytes()).unwrap();
            String::from_utf8_lossy(&received).to_string()
        });
        (address, handle)
    }

    fn connection(base_url: &str, provider: ProviderKind) -> Connection {
        Connection {
            id: "c".into(),
            name: "prueba".into(),
            provider,
            base_url: base_url.into(),
            model: "modelo".into(),
            has_key: true,
            context_tokens: None,
            supports_tools: None,
            supports_images: None,
        }
    }

    #[test]
    fn extremo_a_extremo_con_un_servidor_compatible_con_openai() {
        let (address, server) = serve(format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n{OPENAI_SSE}"));
        let mut events = Vec::new();
        let conn = connection(&format!("{address}/v1"), ProviderKind::OpenAiCompatible);
        stream_chat(&conn, Some("sk-secreta"), &request(), &AtomicBool::new(false), &mut |e| events.push(e)).unwrap();
        let received = server.join().unwrap();
        assert!(received.starts_with("POST /v1/chat/completions"));
        assert!(received.contains("Bearer sk-secreta"), "la clave viaja en la cabecera");
        assert_eq!(events.len(), 5);
    }

    #[test]
    fn extremo_a_extremo_401_de_anthropic_es_un_error_de_clave() {
        let body = r#"{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}"#;
        let (address, server) = serve(format!("HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()));
        let conn = connection(&format!("{address}/v1"), ProviderKind::Anthropic);
        let result = stream_chat(&conn, Some("mala"), &request(), &AtomicBool::new(false), &mut |_| {});
        let received = server.join().unwrap();
        assert!(received.contains("x-api-key: mala"));
        assert!(received.contains("anthropic-version"));
        assert!(matches!(result, Err(AiError::Auth(m)) if m == "invalid x-api-key"));
    }

    #[test]
    fn listar_modelos_admite_los_dos_formatos() {
        let body = r#"{"data":[{"id":"qwen2.5:7b"},{"id":"llama3.2"}]}"#;
        let (address, server) = serve(format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()));
        let models = list_models(&connection(&address, ProviderKind::LmStudio), None).unwrap();
        server.join().unwrap();
        assert_eq!(models, vec!["llama3.2", "qwen2.5:7b"]);
    }
}
