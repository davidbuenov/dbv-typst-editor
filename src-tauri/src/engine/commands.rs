// =============================================================================
// DBV Typst Editor — Comandos Tauri del motor en proceso (RF-56, RF-57, RF-59)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La frontera con el frontend. El frontend NUNCA ve el `Span` ni el documento:
// pide qué se escribió en un punto de una página (`engine_locate`), dónde se
// dibuja un rango del fuente (`engine_reveal`), los diagnósticos de la última
// compilación (`engine_diagnostics`) y cambia o consulta el motor.
//
// Toda consulta lleva la GENERACIÓN de la vista previa que se está viendo, y se
// rechaza con `PreviewExpired` si ya no es la vigente: así un salto nunca se
// resuelve contra un mapa que no corresponde a lo que hay en pantalla.

use serde::Serialize;
use tauri::State;

use super::diagnostics::Diagnostic;
use super::map::{Located, Rect};
use super::session::{InProcEngine, Mode};
use crate::typst_engine::TypstError;

/// Qué se escribió bajo un punto de la página. `None` si ahí no hay nada con
/// origen en el fuente.
#[tauri::command]
pub fn engine_locate(
    engine: State<'_, InProcEngine>,
    generation: u64,
    page: usize,
    x_pt: f64,
    y_pt: f64,
) -> Result<Option<Located>, TypstError> {
    engine.locate(generation, page, x_pt, y_pt)
}

/// Dónde se dibuja lo escrito entre `from` y `to` (UTF-16 desde el inicio del
/// fichero). Con `from == to` se toma la palabra bajo el cursor.
#[tauri::command]
pub fn engine_reveal(
    engine: State<'_, InProcEngine>,
    generation: u64,
    file: String,
    from: usize,
    to: usize,
) -> Result<Vec<Rect>, TypstError> {
    engine.reveal(generation, &file, from, to)
}

/// Diagnósticos de la última compilación, buena o mala.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReport {
    pub generation: u64,
    pub diagnostics: Vec<Diagnostic>,
}

#[tauri::command]
pub fn engine_diagnostics(engine: State<'_, InProcEngine>) -> DiagnosticsReport {
    let (generation, diagnostics) = engine.last_diagnostics();
    DiagnosticsReport { generation, diagnostics }
}

/// Estado del motor para la interfaz.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    /// `"classic"` o `"inproc"`: el que el usuario ha elegido.
    pub mode: &'static str,
    /// Por qué el motor en proceso se desactivó solo, si pasó.
    pub disabled_reason: Option<String>,
}

fn status(engine: &InProcEngine) -> EngineStatus {
    EngineStatus { mode: engine.mode().as_str(), disabled_reason: engine.disabled_reason() }
}

/// Elige el motor de la vista previa (`"inproc"` o `"classic"`). Elegir el motor
/// en proceso lo rehabilita si se había desactivado solo.
#[tauri::command]
pub fn engine_set_mode(engine: State<'_, InProcEngine>, mode: String) -> EngineStatus {
    engine.set_mode(Mode::parse(&mode));
    status(&engine)
}

#[tauri::command]
pub fn engine_status(engine: State<'_, InProcEngine>) -> EngineStatus {
    status(&engine)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn el_estado_refleja_el_modo_y_el_motivo_de_desactivacion() {
        let engine = InProcEngine::default();
        assert_eq!(status(&engine).mode, "inproc", "el rápido es el de serie");

        engine.set_mode(Mode::Classic);

        assert_eq!(status(&engine).mode, "classic");
        assert_eq!(status(&engine).disabled_reason, None);
    }

    #[test]
    fn el_informe_de_diagnosticos_serializa_en_camel_case() {
        let report = DiagnosticsReport { generation: 3, diagnostics: Vec::new() };

        let json = serde_json::to_string(&report).unwrap();

        assert_eq!(json, r#"{"generation":3,"diagnostics":[]}"#);
    }

    #[test]
    fn el_estado_serializa_con_los_nombres_que_espera_el_frontend() {
        let json = serde_json::to_string(&EngineStatus { mode: "inproc", disabled_reason: Some("x".into()) }).unwrap();

        assert_eq!(json, r#"{"mode":"inproc","disabledReason":"x"}"#);
    }

    #[test]
    fn locate_y_reveal_de_una_sesion_vacia_dan_error_explicito_no_un_valor_falso() {
        let engine = InProcEngine::default();

        assert!(matches!(engine.locate(1, 1, 0.0, 0.0), Err(TypstError::PreviewExpired(_))));
        assert!(matches!(engine.reveal(1, "main.typ", 0, 1), Err(TypstError::PreviewExpired(_))));
    }
}
