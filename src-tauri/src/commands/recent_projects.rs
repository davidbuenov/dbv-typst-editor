// =============================================================================
// DBV Typst Editor — Proyectos recientes (RF-02c)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Portado del mecanismo de recent-files de dbv-md-reader
// (lib.rs:505-573, ARCHITECTURE.md §3 fila 5). Cambio conceptual: la entrada ya
// no es un fichero, es un PROYECTO — de ahí `root` + `is_single_file`, para que
// el lanzador pueda reabrirlo exactamente como estaba sin volver a inspeccionar
// el disco.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::error::AppError;

/// Máximo de proyectos recordados. El lanzador muestra una lista, no un
/// historial: más allá de una decena la lista deja de ser útil.
const MAX_RECENT: usize = 10;

const STORAGE_FILE: &str = "recent_projects.json";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    /// Ruta que hay que reabrir: la carpeta del proyecto, o el `.typ` suelto.
    pub path: String,
    pub name: String,
    /// Documento a abrir dentro del proyecto, si se conocía.
    #[serde(default)]
    pub entrypoint: Option<String>,
    #[serde(default)]
    pub is_single_file: bool,
    pub last_opened: u64,
}

/// Inserta o mueve `entry` al principio, deduplicando por ruta y recortando a
/// `MAX_RECENT`. Función pura, sin E/S, para poder testear la política de la
/// lista sin un `AppHandle`.
pub fn upsert_recent(mut list: Vec<RecentProject>, entry: RecentProject) -> Vec<RecentProject> {
    list.retain(|item| item.path != entry.path);
    list.insert(0, entry);
    list.truncate(MAX_RECENT);
    list
}

/// Descarta las entradas cuyo destino ya no existe (autocuración): un proyecto
/// movido o borrado no debe quedarse como fila muerta en el lanzador.
pub fn filter_existing(list: Vec<RecentProject>) -> Vec<RecentProject> {
    list.into_iter()
        .filter(|item| Path::new(&item.path).exists())
        .collect()
}

fn storage_path(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Io(error.to_string()))?;
    fs::create_dir_all(&dir).map_err(|error| AppError::Io(error.to_string()))?;
    Ok(dir.join(STORAGE_FILE))
}

fn load(app: &tauri::AppHandle) -> Result<Vec<RecentProject>, AppError> {
    let path = storage_path(app)?;
    if !path.is_file() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&path).map_err(|error| AppError::Io(error.to_string()))?;
    // Un fichero de estado corrupto no puede impedir arrancar la aplicación:
    // se degrada a lista vacía, que la primera apertura volverá a poblar.
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

fn save(app: &tauri::AppHandle, list: &[RecentProject]) -> Result<(), AppError> {
    let path = storage_path(app)?;
    let raw =
        serde_json::to_string_pretty(list).map_err(|error| AppError::Parse(error.to_string()))?;
    fs::write(&path, raw).map_err(|error| AppError::Io(error.to_string()))?;
    Ok(())
}

/// Lista de proyectos recientes, autocurada. Solo reescribe el fichero cuando
/// el filtro ha descartado algo de verdad.
#[tauri::command]
pub fn get_recent_projects(app: tauri::AppHandle) -> Result<Vec<RecentProject>, AppError> {
    let list = load(&app)?;
    let original_len = list.len();
    let filtered = filter_existing(list);
    if filtered.len() != original_len {
        save(&app, &filtered)?;
    }
    Ok(filtered)
}

/// Registra una apertura y devuelve la lista ya actualizada, para que el
/// frontend no necesite un segundo viaje de ida y vuelta solo para repintar.
#[tauri::command]
pub fn add_recent_project(
    app: tauri::AppHandle,
    path: String,
    name: String,
    entrypoint: Option<String>,
    is_single_file: bool,
) -> Result<Vec<RecentProject>, AppError> {
    let last_opened = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0);
    let updated = upsert_recent(
        load(&app)?,
        RecentProject {
            path,
            name,
            entrypoint,
            is_single_file,
            last_opened,
        },
    );
    save(&app, &updated)?;
    Ok(updated)
}

/// Vacía la lista de proyectos recientes.
#[tauri::command]
pub fn clear_recent_projects(app: tauri::AppHandle) -> Result<(), AppError> {
    save(&app, &[])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(path: &str, last_opened: u64) -> RecentProject {
        RecentProject {
            path: path.to_string(),
            name: path.to_string(),
            entrypoint: Some("main.typ".to_string()),
            is_single_file: false,
            last_opened,
        }
    }

    #[test]
    fn upsert_recent_pone_la_entrada_nueva_la_primera() {
        let list = upsert_recent(vec![entry("/a", 1)], entry("/b", 2));
        assert_eq!(list[0].path, "/b");
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn upsert_recent_deduplica_y_promociona() {
        let list = vec![entry("/a", 1), entry("/b", 2), entry("/c", 3)];
        let updated = upsert_recent(list, entry("/b", 9));

        assert_eq!(updated.len(), 3);
        assert_eq!(updated[0].path, "/b");
        assert_eq!(updated[0].last_opened, 9);
    }

    #[test]
    fn upsert_recent_recorta_a_diez_descartando_la_mas_antigua() {
        let mut list = Vec::new();
        for index in 0..10 {
            list = upsert_recent(list, entry(&format!("/p{index}"), index as u64));
        }
        let updated = upsert_recent(list, entry("/nuevo", 99));

        assert_eq!(updated.len(), MAX_RECENT);
        assert_eq!(updated[0].path, "/nuevo");
        assert!(!updated.iter().any(|item| item.path == "/p0"));
    }

    #[test]
    fn filter_existing_descarta_las_rutas_que_ya_no_estan() {
        let dir = tempfile::tempdir().unwrap();
        let real = dir.path().join("proyecto");
        fs::create_dir_all(&real).unwrap();

        let list = vec![
            entry(&real.to_string_lossy(), 1),
            entry("/ruta/que/no/existe/dbv", 2),
        ];
        let filtered = filter_existing(list);

        assert_eq!(filtered.len(), 1);
        assert!(filtered[0].path.contains("proyecto"));
    }
}
