// =============================================================================
// DBV Typst Editor — Panel de navegación estructural (Outline, Beta)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// ARCHITECTURE.md §7.8. Spike cerrado en el Slice 2, adelantado respecto al
// plan (lo situaba en Beta): `typst query` está DEPRECADO en 0.15.1, así que
// se usa `typst eval` con un `query(heading)` dentro — verificado contra el
// binario real, no de memoria.
//
// Dos sorpresas del binario real que este módulo absorbe para que el resto de
// la app no tenga que saber de ellas:
//   · el cuerpo del encabezado (`h.body`) NO llega como cadena, sino como
//     contenido Typst serializado (`{"func": "text", "text": "..."}`, o
//     `{"func": "sequence", "children": [...]}` si mezcla estilos);
//   · la coordenada vertical (`h.location().position().y`) llega como CADENA
//     con unidad ("70.87pt"), no como número.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use super::compile::prepare_input;
use super::{run, TypstError};

/// Encabezado de un documento, listo para pintar en el panel y para
/// clic→navegación (misma unidad, puntos, que usa la vista previa).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineEntry {
    pub level: u32,
    pub text: String,
    pub page: u32,
    pub y_pt: f64,
}

/// Forma cruda tal como la devuelve `typst eval`, antes de aplanar `texto` y
/// convertir `y` a número.
#[derive(Debug, Deserialize)]
struct RawHeading {
    nivel: u32,
    texto: serde_json::Value,
    pagina: u32,
    y: String,
}

/// Ver comentario de cabecera: `h.body` es contenido Typst, no una cadena.
/// Recorre recursivamente `text`/`children`/`body`/`child` en vez de asumir la
/// forma simple, para no romperse con un encabezado que mezcle estilos.
fn flatten_text(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(text) => text.clone(),
        serde_json::Value::Array(items) => items.iter().map(flatten_text).collect(),
        serde_json::Value::Object(map) => {
            if let Some(serde_json::Value::String(text)) = map.get("text") {
                return text.clone();
            }
            ["children", "body", "child"]
                .iter()
                .filter_map(|key| map.get(*key))
                .map(flatten_text)
                .collect()
        }
        _ => String::new(),
    }
}

/// "70.87pt" → 70.87. Un valor que no se pueda parsear cae a 0.0 (encabezado
/// al principio de la página) en vez de reventar el panel entero por uno malo.
fn parse_pt(raw: &str) -> f64 {
    raw.trim_end_matches("pt").parse().unwrap_or(0.0)
}

const OUTLINE_QUERY: &str = "query(heading).map(h => (nivel: h.level, texto: h.body, \
pagina: h.location().page(), y: h.location().position().y))";

/// Extrae los encabezados del documento (Beta, §7.8), en el mismo orden que
/// `typst_compile_preview`: contenido en vivo si `content` viene, disco si no.
#[tauri::command]
pub async fn typst_outline(
    app: AppHandle,
    document: String,
    root: String,
    content: Option<String>,
) -> Result<Vec<OutlineEntry>, TypstError> {
    let document_path = PathBuf::from(&document);
    let (input, mirror) = prepare_input(&document_path, content.as_deref())?;

    let input_str = input.to_string_lossy().to_string();
    let args: Vec<&str> = vec![
        "eval",
        OUTLINE_QUERY,
        "--root",
        &root,
        "--in",
        &input_str,
        "--format",
        "json",
    ];
    let output = run(&app, &args).await;

    if let Some(mirror) = mirror {
        let _ = fs::remove_file(mirror);
    }
    let output = output?;

    let raw: Vec<RawHeading> = serde_json::from_str(output.stdout.trim()).map_err(|error| {
        TypstError::ExecutionFailed(format!("salida de outline inesperada: {error}"))
    })?;

    Ok(raw
        .into_iter()
        .map(|heading| OutlineEntry {
            level: heading.nivel,
            text: flatten_text(&heading.texto),
            page: heading.pagina,
            y_pt: parse_pt(&heading.y),
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flatten_text_extrae_una_cadena_simple() {
        let value: serde_json::Value =
            serde_json::from_str(r#"{"func":"text","text":"Introducción"}"#).unwrap();
        assert_eq!(flatten_text(&value), "Introducción");
    }

    #[test]
    fn flatten_text_recorre_una_secuencia_de_estilos_mezclados() {
        // Un encabezado como "Resultados *destacados*" llega como sequence.
        let value: serde_json::Value = serde_json::from_str(
            r#"{"func":"sequence","children":[
                {"func":"text","text":"Resultados "},
                {"func":"strong","body":{"func":"text","text":"destacados"}}
            ]}"#,
        )
        .unwrap();
        assert_eq!(flatten_text(&value), "Resultados destacados");
    }

    #[test]
    fn flatten_text_no_revienta_con_una_forma_desconocida() {
        let value = serde_json::json!({"func": "algo-nuevo-del-compilador"});
        assert_eq!(flatten_text(&value), "");
    }

    #[test]
    fn parse_pt_convierte_la_unidad_real_del_binario() {
        assert_eq!(parse_pt("70.87pt"), 70.87);
    }

    #[test]
    fn parse_pt_cae_a_cero_con_un_valor_irreconocible() {
        assert_eq!(parse_pt("no-es-un-numero"), 0.0);
    }

    #[test]
    fn deserializa_la_salida_real_del_binario_verificada_en_este_slice() {
        // Literal de la salida real de `typst eval` contra el binario vendorizado.
        let raw = r#"[{"nivel":1,"texto":{"func":"text","text":"Introducción"},"pagina":1,"y":"70.87pt"},
        {"nivel":2,"texto":{"func":"text","text":"Motivación"},"pagina":1,"y":"112.13pt"}]"#;
        let headings: Vec<RawHeading> = serde_json::from_str(raw).unwrap();
        assert_eq!(headings.len(), 2);
        assert_eq!(flatten_text(&headings[0].texto), "Introducción");
        assert_eq!(parse_pt(&headings[1].y), 112.13);
    }
}
