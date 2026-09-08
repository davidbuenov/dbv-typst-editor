// =============================================================================
// DBV Typst Editor — Sincronización editor ↔ vista previa (RF-16)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Typst NO ofrece ningún puente entre lo que renderiza y el fuente del que
// salió: no hay `span` en el API de scripting (`heading.span` da error) ni una
// sola anotación en el SVG. Medido en el Spike S-2 contra el binario real; el
// razonamiento completo está en ADR-SYNC-001, que enmienda la cláusula de
// `SPECIFICATIONS.md` §6 que prometía sincronización "por posición real".
//
// La vía que sí existe con la arquitectura de sidecar es fabricarnos el puente:
// `shadow.rs` siembra el proyecto replicado con anclas
// `#metadata((f: …, l: …))<dbv-sync>` entre bloques, y aquí se recogen con un
// `query` que devuelve de una sola pasada lo que escribimos nosotros (fichero y
// línea) y dónde aterrizó (página, x, y). Esa tabla sirve para las dos
// direcciones: del editor al render buscando por línea, y del render al editor
// buscando por posición.
//
// Coste: la pasada es otra composición completa del documento (≈750 ms en una
// tesis de 202 páginas), así que se pide BAJO DEMANDA y el frontend la cachea.
// Las anclas en sí son gratis: 0,007 ms cada una.

use std::path::Path;

use serde::Serialize;
use tauri::AppHandle;

use super::compile::{prepare_input, CompileTarget};
use super::outline::parse_pt;
use super::shadow::SYNC_LABEL;
use super::{run, TypstError};

/// Una posición del documento renderizado y el punto del fuente que la produjo.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAnchor {
    /// Ruta del fichero fuente, relativa a la raíz del proyecto y con `/`.
    pub file: String,
    /// Línea dentro de ese fichero, 1-indexada. Es la del fichero ORIGINAL: la
    /// siembra numera antes de insertar nada (ver `shadow::seed_anchors`).
    pub line: u32,
    /// Página del render, 1-indexada como la devuelve Typst.
    pub page: u32,
    /// Coordenada horizontal en puntos. Necesaria para distinguir columnas: en un
    /// documento a dos columnas, la segunda tiene una `y` MENOR que la primera,
    /// así que ordenar solo por `y` desordena la tabla.
    pub x_pt: f64,
    /// Coordenada vertical en puntos dentro de la página.
    pub y_pt: f64,
}

/// Forma cruda de `typst eval`: `x`/`y` llegan como cadena con unidad, igual que
/// en el outline (`"70.87pt"`).
#[derive(Debug, serde::Deserialize)]
struct RawAnchor {
    f: String,
    l: u32,
    p: u32,
    x: String,
    y: String,
}

fn anchor_query() -> String {
    format!(
        "query(<{SYNC_LABEL}>).map(a => (f: a.value.f, l: a.value.l, \
p: a.location().page(), x: a.location().position().x, y: a.location().position().y))"
    )
}

/// Tabla de anclas del documento objetivo (RF-16).
///
/// Devuelta en orden de documento, que es como la entrega Typst y lo que permite
/// buscar por bisección en el frontend en vez de recorrerla entera.
#[tauri::command]
pub async fn typst_sync_anchors(
    app: AppHandle,
    target: CompileTarget,
) -> Result<Vec<SyncAnchor>, TypstError> {
    // La misma réplica sembrada que compila la vista previa: si se construyera
    // otra, las posiciones podrían no coincidir con las páginas que se ven.
    let prepared = prepare_input(&target)?;

    let query = anchor_query();
    let font_args = super::font_path_args(Path::new(prepared.root()));
    let mut args: Vec<&str> = vec![
        "eval",
        &query,
        "--root",
        prepared.root(),
        "--in",
        prepared.input(),
        "--format",
        "json",
    ];
    args.extend(font_args.iter().map(String::as_str));
    let output = run(&app, &args).await?;

    let raw: Vec<RawAnchor> = serde_json::from_str(output.stdout.trim()).map_err(|error| {
        TypstError::ExecutionFailed(format!("salida de anclas inesperada: {error}"))
    })?;

    Ok(raw
        .into_iter()
        .map(|anchor| SyncAnchor {
            file: anchor.f,
            line: anchor.l,
            page: anchor.p,
            x_pt: parse_pt(&anchor.x),
            y_pt: parse_pt(&anchor.y),
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn la_consulta_pide_las_dos_mitades_del_puente() {
        let query = anchor_query();
        // Lo que escribimos nosotros...
        assert!(query.contains("a.value.f"));
        assert!(query.contains("a.value.l"));
        // ...y dónde aterrizó.
        assert!(query.contains("a.location().page()"));
        assert!(query.contains("position().x"));
        assert!(query.contains("position().y"));
        assert!(query.contains(SYNC_LABEL));
    }

    #[test]
    fn deserializa_la_salida_real_del_binario() {
        // Literal de la salida de `typst eval` en el Spike S-2.
        let raw = r#"[{"f":"chapters/01.typ","l":3,"p":1,"x":"56.7pt","y":"96.64pt"},
        {"f":"chapters/01.typ","l":67,"p":5,"x":"215.9pt","y":"194.4pt"}]"#;

        let anchors: Vec<RawAnchor> = serde_json::from_str(raw).unwrap();

        assert_eq!(anchors.len(), 2);
        assert_eq!(anchors[0].f, "chapters/01.typ");
        assert_eq!(anchors[1].l, 67);
        assert_eq!(parse_pt(&anchors[1].x), 215.9);
        assert_eq!(parse_pt(&anchors[0].y), 96.64);
    }

    #[test]
    fn una_salida_vacia_es_una_tabla_vacia_no_un_error() {
        let anchors: Vec<RawAnchor> = serde_json::from_str("[]").unwrap();
        assert!(anchors.is_empty());
    }
}
