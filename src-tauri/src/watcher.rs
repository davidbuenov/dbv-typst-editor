// =============================================================================
// DBV Typst Editor — Observador de cambios en disco
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Portado de dbv-md-reader/src-tauri/src/lib.rs:457-503 (ARCHITECTURE.md §3
// fila 4) con una diferencia de alcance: allí se observaba la carpeta padre de
// UN documento; aquí se observa la raíz del proyecto de forma RECURSIVA, porque
// un documento Typst importa capítulos, bibliografía e imágenes, y un cambio en
// cualquiera de ellos invalida la vista previa igual que un cambio en `main.typ`.
//
// Se sigue observando el directorio (no los ficheros): un guardado atómico
// (fichero temporal + rename), que es lo que hacen VS Code y Git, destruye el
// inodo original y dejaría muerto un watch puesto sobre el fichero.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::AppError;

/// Nombre del evento que recibe el frontend en cada cambio relevante.
pub const CHANGE_EVENT: &str = "project-file-changed";

/// Guarda el único watcher activo. Sustituirlo detiene el anterior (`Drop`).
#[derive(Default)]
pub struct WatcherState(pub Mutex<Option<notify::RecommendedWatcher>>);

/// Carga útil del evento de cambio.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    /// True si el fichero cambiado es el que el editor tiene abierto — el
    /// frontend lo usa para distinguir "recompila" de "además avisa de conflicto".
    pub is_active_document: bool,
}

/// True si la ruta cambiada debe disparar una recompilación.
///
/// Función pura para poder testear el filtro sin montar un watcher real. Se
/// ignoran: (1) el ruido de repositorio y de herramientas, y (2) los ficheros
/// temporales de guardado atómico, que aparecen y desaparecen en el mismo
/// instante y solo generarían compilaciones desperdiciadas.
pub fn is_relevant_change(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
        return false;
    };
    let is_temp = name.ends_with('~')
        || name.ends_with(".tmp")
        || name.starts_with(".goutputstream")
        || (name.starts_with('.') && name.contains(".sw"));
    let in_noise_dir = path.components().any(|component| {
        matches!(
            component.as_os_str().to_str(),
            Some(".git") | Some("node_modules") | Some("target") | Some(".svn")
        )
    });
    !is_temp && !in_noise_dir
}

/// Observa `root` de forma recursiva y emite `CHANGE_EVENT` por cada cambio
/// relevante. Sustituye al watcher anterior, si lo había.
#[tauri::command]
pub fn watch_project(
    app: AppHandle,
    state: tauri::State<WatcherState>,
    root: String,
    active_document: Option<String>,
) -> Result<(), AppError> {
    let mut guard = state
        .0
        .lock()
        .map_err(|error| AppError::Io(error.to_string()))?;
    *guard = None; // Detiene el watcher anterior antes de crear el nuevo.

    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(AppError::InvalidPath(root));
    }

    let active = active_document.map(PathBuf::from);
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        let Ok(event) = event else { return };
        let is_relevant_kind = matches!(
            event.kind,
            notify::EventKind::Modify(_) | notify::EventKind::Create(_) | notify::EventKind::Remove(_)
        );
        if !is_relevant_kind {
            return;
        }
        for path in event.paths.iter().filter(|path| is_relevant_change(path)) {
            let is_active_document = active
                .as_ref()
                .is_some_and(|open| same_file_path(open, path));
            let payload = FileChange {
                path: path.to_string_lossy().to_string(),
                is_active_document,
            };
            let _ = app.emit(CHANGE_EVENT, payload);
        }
    })
    .map_err(|error| AppError::Io(error.to_string()))?;

    notify::Watcher::watch(&mut watcher, &root_path, notify::RecursiveMode::Recursive)
        .map_err(|error| AppError::Io(error.to_string()))?;

    *guard = Some(watcher);
    Ok(())
}

/// Detiene la observación (al cerrar un proyecto o volver al lanzador).
#[tauri::command]
pub fn unwatch_project(state: tauri::State<WatcherState>) -> Result<(), AppError> {
    let mut guard = state
        .0
        .lock()
        .map_err(|error| AppError::Io(error.to_string()))?;
    *guard = None;
    Ok(())
}

/// Compara dos rutas al mismo fichero tolerando diferencias de forma.
///
/// `notify` entrega rutas del sistema operativo, que no siempre coinciden
/// carácter a carácter con la ruta canónica que guarda el frontend (en Windows,
/// mayúsculas y prefijo `\\?\`). Comparar por nombre de fichero además de por
/// ruta completa evita falsos negativos justo en el caso que más importa: saber
/// si lo que ha cambiado es el documento abierto.
pub fn same_file_path(left: &Path, right: &Path) -> bool {
    if left == right {
        return true;
    }
    let same_name = left.file_name().is_some() && left.file_name() == right.file_name();
    let same_canonical = match (left.canonicalize(), right.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    };
    same_canonical || (same_name && left.parent().is_none())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_relevant_change_acepta_documentos_del_proyecto() {
        assert!(is_relevant_change(Path::new("/proyecto/main.typ")));
        assert!(is_relevant_change(Path::new("/proyecto/chapters/01.typ")));
        assert!(is_relevant_change(Path::new("/proyecto/images/figura.png")));
    }

    #[test]
    fn is_relevant_change_descarta_temporales_de_guardado_atomico() {
        assert!(!is_relevant_change(Path::new("/proyecto/main.typ~")));
        assert!(!is_relevant_change(Path::new("/proyecto/main.typ.tmp")));
        assert!(!is_relevant_change(Path::new("/proyecto/.goutputstream-XY12")));
        assert!(!is_relevant_change(Path::new("/proyecto/.main.typ.swp")));
    }

    #[test]
    fn is_relevant_change_descarta_el_ruido_de_repositorio() {
        assert!(!is_relevant_change(Path::new("/proyecto/.git/index")));
        assert!(!is_relevant_change(Path::new("/proyecto/node_modules/x/y.typ")));
        assert!(!is_relevant_change(Path::new("/proyecto/target/debug/app")));
    }

    #[test]
    fn same_file_path_reconoce_rutas_identicas() {
        assert!(same_file_path(
            Path::new("/proyecto/main.typ"),
            Path::new("/proyecto/main.typ")
        ));
    }

    #[test]
    fn same_file_path_distingue_ficheros_distintos() {
        assert!(!same_file_path(
            Path::new("/proyecto/main.typ"),
            Path::new("/proyecto/anexo.typ")
        ));
    }

    #[test]
    fn same_file_path_resuelve_rutas_equivalentes_del_sistema() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("main.typ");
        std::fs::write(&file, "= Hola").unwrap();
        let indirect = dir.path().join(".").join("main.typ");

        assert!(same_file_path(&file, &indirect));
    }
}
