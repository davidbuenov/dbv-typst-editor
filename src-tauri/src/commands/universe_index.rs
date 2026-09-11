// =============================================================================
// DBV Typst Editor — Índice completo de Typst Universe (RF-34)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Descarga y cachea en memoria el índice público de Typst Universe
// (`packages.typst.org/preview/index.json`, ~4.700 paquetes), la fuente que
// ya usa `curatedCatalog.js` para su whitelist curada — aquí se sirve SIN
// filtrar, para el catálogo completo de RF-34. Nunca se guarda en un registro
// propio (`ADR-UNIVERSE-001`): siempre el mismo dataset oficial.
//
// Forma de cada entrada verificada contra una descarga real del índice
// (`spikes/universe-index/index-sample.json`, 2026-09-11, 4.711 paquetes):
// no todos los campos documentados existen siempre (p. ej. `categories` solo
// aparece en plantillas), así que los opcionales se deserializan como tales
// en vez de asumir que siempre están.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

const INDEX_URL: &str = "https://packages.typst.org/preview/index.json";

/// Entrada del índice tal como la sirve `packages.typst.org`, recortada a los
/// campos que el Package Explorer necesita mostrar — no se copian `exclude`,
/// `compiler` ni `repository`, que la interfaz no usa.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UniverseIndexEntry {
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub authors: Vec<String>,
    #[serde(default)]
    pub license: String,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub keywords: Vec<String>,
}

/// Caché en memoria del índice completo: se descarga una sola vez por sesión
/// de la aplicación (los ~4.700 paquetes pesan ~2,2 MB), no en cada apertura
/// del panel de Universe — coherente con la pregunta abierta de
/// `SPECIFICATIONS.md` §9 sobre comunicar un catálogo "cacheado en el último
/// sincronizado", no en vivo.
#[derive(Default)]
pub struct UniverseIndexState {
    cached: Mutex<Option<Vec<UniverseIndexEntry>>>,
}

/// Descarga (o sirve de caché) el índice completo de Typst Universe.
#[tauri::command]
pub fn fetch_universe_index(
    state: tauri::State<'_, UniverseIndexState>,
) -> Result<Vec<UniverseIndexEntry>, AppError> {
    if let Ok(guard) = state.cached.lock() {
        if let Some(entries) = guard.as_ref() {
            return Ok(entries.clone());
        }
    }

    let entries = download_index()?;

    if let Ok(mut guard) = state.cached.lock() {
        *guard = Some(entries.clone());
    }

    Ok(entries)
}

fn download_index() -> Result<Vec<UniverseIndexEntry>, AppError> {
    let response = ureq::get(INDEX_URL)
        .call()
        .map_err(|error| AppError::Io(format!("No se pudo descargar el catálogo: {error}")))?;

    response
        .into_body()
        .read_json::<Vec<UniverseIndexEntry>>()
        .map_err(|error| AppError::Parse(format!("El catálogo de Typst Universe llegó con un formato inesperado: {error}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Copiado de una descarga real (`spikes/universe-index/index-sample.json`,
    // 2026-09-11): un paquete normal y una plantilla, con y sin `categories`,
    // igual que la disciplina que ya aplicó `parse_git_status_output` en
    // `commands/git.rs` — comprobar el formato contra la herramienta real,
    // no escribirlo de memoria.
    const SAMPLE: &str = r#"[
        {
            "name": "a2c-nums",
            "version": "0.0.1",
            "entrypoint": "src/lib.typ",
            "authors": ["Zhuo Nengwen <soarowl@yeah.net>"],
            "license": "MIT",
            "description": "Convert a number to Chinese",
            "repository": "https://github.com/soarowl/a2c-nums.git",
            "keywords": ["Converter", "number", "Chinese", "Currency"],
            "compiler": "0.10.0",
            "exclude": ["demo.pdf"],
            "updatedAt": 1704708827
        },
        {
            "name": "abiding-ifacconf",
            "version": "0.1.0",
            "entrypoint": "lib.typ",
            "authors": ["Alexander Von Moll <https://avonmoll.github.io>"],
            "license": "MIT-0",
            "description": "An IFAC-style paper template",
            "repository": "https://github.com/avonmoll/ifacconf-typst",
            "keywords": ["IFAC", "conference"],
            "categories": ["paper"],
            "disciplines": ["computer-science", "engineering"],
            "compiler": "0.11.0",
            "template": {"path": "template", "entrypoint": "main.typ", "thumbnail": "thumbnail.png"},
            "updatedAt": 1711039864
        }
    ]"#;

    #[test]
    fn deserializa_una_entrada_sin_categories() {
        let entries: Vec<UniverseIndexEntry> = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(entries[0].name, "a2c-nums");
        assert_eq!(entries[0].version, "0.0.1");
        assert_eq!(entries[0].license, "MIT");
        assert!(entries[0].categories.is_empty());
        assert_eq!(entries[0].authors, vec!["Zhuo Nengwen <soarowl@yeah.net>".to_string()]);
    }

    #[test]
    fn deserializa_una_entrada_con_categories_y_campos_de_plantilla_ignorados() {
        let entries: Vec<UniverseIndexEntry> = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(entries[1].name, "abiding-ifacconf");
        assert_eq!(entries[1].categories, vec!["paper".to_string()]);
    }

    #[test]
    fn el_recorte_del_indice_real_deserializa_sin_error() {
        // `spikes/universe-index/index-sample.json` es un recorte de 25
        // entradas de una descarga real del 2026-09-11 (el índice completo
        // tenía 4.711 paquetes, comprobado a mano, no versionado entero por
        // peso). Aquí solo se comprueba que la FORMA se deserializa sin
        // error, no un recuento — para eso está el spike documentado.
        let ruta = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("spikes")
            .join("universe-index")
            .join("index-sample.json");
        let Ok(contenido) = std::fs::read_to_string(&ruta) else {
            return;
        };
        let entries: Vec<UniverseIndexEntry> = serde_json::from_str(&contenido)
            .expect("el índice real de Typst Universe debe deserializar sin error");
        assert!(!entries.is_empty());
    }
}
