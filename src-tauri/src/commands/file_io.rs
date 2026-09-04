// =============================================================================
// DBV Typst Editor — Entrada/salida de ficheros y diálogos nativos
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Portado de dbv-md-reader/src-tauri/src/lib.rs:365-604 (ARCHITECTURE.md §3
// filas 1-6), con dos diferencias deliberadas:
//   · sin rama de descarga remota (no existe RF-08A en este producto: la unidad
//     de trabajo es un proyecto en disco, no una URL);
//   · error tipado `AppError` en vez de `String` suelta.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::DialogExt;

use crate::error::AppError;

/// Extensiones que la aplicación trata como documento Typst editable. Único
/// criterio compartido por el filtro del diálogo nativo y por el explorador de
/// proyecto, para que no puedan divergir.
pub const TYPST_EXTENSIONS: [&str; 1] = ["typ"];

/// Ficheros del proyecto que se muestran como editables aunque no sean `.typ`
/// (bibliografía y configuración que el usuario sí toca a mano).
pub const COMPANION_EXTENSIONS: [&str; 3] = ["bib", "toml", "yml"];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePayload {
    pub path: String,
    pub content: String,
    pub dir_path: String,
    pub file_name: String,
    /// Marca de tiempo de modificación (ms desde epoch) en el instante de leer.
    /// Es la referencia contra la que el Slice 6 detecta ediciones externas.
    pub modified_ms: u64,
}

/// Una entrada de un nivel del árbol de proyecto, leída bajo demanda al
/// expandir el nodo — nunca un recorrido recursivo completo.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntryInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    /// `.typ`: el documento que la aplicación sabe compilar.
    pub is_typst: bool,
    /// Fichero de texto abrible en el editor aunque no sea `.typ` (`.bib`, `.toml`).
    pub is_editable: bool,
}

pub fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

/// True si `name` termina en una de `extensions` (comparación insensible a
/// mayúsculas). Función pura: la misma para el diálogo y para el árbol.
pub fn has_extension(name: &str, extensions: &[&str]) -> bool {
    Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|ext| extensions.iter().any(|candidate| candidate.eq_ignore_ascii_case(ext)))
        .unwrap_or(false)
}

/// Milisegundos desde epoch de la última modificación de `path`. Devuelve 0 si
/// el sistema de ficheros no expone la marca — degradar a 0 desactiva la
/// detección de conflicto para ese fichero, que es preferible a impedir abrirlo.
pub fn modified_ms(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0)
}

/// Directorios de infraestructura que nunca son contenido del documento.
fn is_noise(name: &str) -> bool {
    matches!(name, ".git" | ".svn" | "node_modules" | ".DS_Store" | "target")
}

/// Lee un nivel de `dir`: carpetas primero, después ficheros, ambos en orden
/// alfabético insensible a mayúsculas. Una entrada que falle al leerse (permiso
/// denegado, symlink roto) se descarta en silencio en vez de abortar el listado
/// entero — abrir un repositorio ajeno no puede fallar por un fichero raro.
pub fn list_directory_entries(dir: &Path) -> Vec<DirEntryInfo> {
    let Ok(read_dir) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut entries: Vec<DirEntryInfo> = read_dir
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            // `.git`, `node_modules` y demás ruido de repositorio no aportan
            // nada a un explorador de documentos y sí mucho parpadeo visual.
            if is_noise(&name) {
                return None;
            }
            let is_dir = file_type.is_dir();
            let is_typst = !is_dir && has_extension(&name, &TYPST_EXTENSIONS);
            Some(DirEntryInfo {
                is_typst,
                is_editable: is_typst || (!is_dir && has_extension(&name, &COMPANION_EXTENSIONS)),
                name,
                path: path_to_string(&entry.path()),
                is_dir,
            })
        })
        .collect();
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    entries
}

/// Construye el `(programa, argumentos)` para revelar `path` en el gestor de
/// ficheros del sistema, sin llegar a lanzar el proceso — separado del comando
/// para poder testearlo sin depender de un binario externo real.
#[cfg(windows)]
pub fn reveal_command(path: &str, is_dir: bool) -> (&'static str, Vec<String>) {
    if is_dir {
        ("explorer", vec![path.to_string()])
    } else {
        ("explorer", vec![format!("/select,{path}")])
    }
}

#[cfg(target_os = "macos")]
pub fn reveal_command(path: &str, is_dir: bool) -> (&'static str, Vec<String>) {
    if is_dir {
        ("open", vec![path.to_string()])
    } else {
        ("open", vec!["-R".to_string(), path.to_string()])
    }
}

/// Linux, alcance reducido: no existe un comando universal de "seleccionar el
/// fichero exacto" entre gestores (Nautilus/Dolphin/...), así que se abre la
/// carpeta contenedora sin selección — limitación de plataforma documentada.
#[cfg(target_os = "linux")]
pub fn reveal_command(path: &str, is_dir: bool) -> (&'static str, Vec<String>) {
    let target = if is_dir {
        path.to_string()
    } else {
        Path::new(path)
            .parent()
            .map(path_to_string)
            .unwrap_or_else(|| path.to_string())
    };
    ("xdg-open", vec![target])
}

/// Lee un fichero de texto del proyecto.
#[tauri::command]
pub fn read_file(path: String) -> Result<FilePayload, AppError> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.is_file() {
        return Err(AppError::NotFound(path));
    }

    let canonical = fs::canonicalize(&path_buf).map_err(|e| AppError::Io(e.to_string()))?;
    let content = fs::read_to_string(&canonical).map_err(|e| AppError::Io(e.to_string()))?;

    let payload = FilePayload {
        file_name: canonical
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| "documento.typ".to_string()),
        dir_path: canonical.parent().map(path_to_string).unwrap_or_default(),
        modified_ms: modified_ms(&canonical),
        path: path_to_string(&canonical),
        content,
    };
    Ok(payload)
}

/// Escribe `content` en `path` y devuelve la nueva marca de modificación, para
/// que el frontend pueda actualizar su referencia de conflicto sin releer.
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<u64, AppError> {
    let path_buf = PathBuf::from(&path);
    let parent_missing = path_buf
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .is_some_and(|parent| !parent.is_dir());
    if parent_missing {
        return Err(AppError::InvalidPath(path));
    }

    fs::write(&path_buf, content).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(modified_ms(&path_buf))
}

/// Marca de modificación actual de `path`, sin leer el contenido. La usa la
/// detección de conflicto externo (Slice 6) antes de sobrescribir.
#[tauri::command]
pub fn file_modified_ms(path: String) -> Result<u64, AppError> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.is_file() {
        return Err(AppError::NotFound(path));
    }
    Ok(modified_ms(&path_buf))
}

/// Lista un nivel del árbol de proyecto. Rechaza rutas que no sean una carpeta
/// existente en vez de devolver un listado vacío silencioso.
#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<DirEntryInfo>, AppError> {
    let dir = PathBuf::from(&path);
    if !dir.is_dir() {
        return Err(AppError::InvalidPath(path));
    }
    Ok(list_directory_entries(&dir))
}

/// Selector nativo de fichero `.typ` (RF-02b: un `.typ` suelto es un proyecto
/// de un solo fichero).
#[tauri::command]
pub async fn open_file_dialog(app: tauri::AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .add_filter("Typst", &TYPST_EXTENSIONS)
        .blocking_pick_file()
        .map(|file| file.to_string())
}

/// Selector nativo de carpeta de proyecto (RF-02c, "Abrir carpeta de proyecto").
#[tauri::command]
pub async fn open_folder_dialog(app: tauri::AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .map(|folder| folder.to_string())
}

/// Selector nativo de destino para guardar (Guardar como / Exportar PDF).
#[tauri::command]
pub async fn save_file_dialog(
    app: tauri::AppHandle,
    default_name: String,
    filter_name: String,
    extensions: Vec<String>,
) -> Option<String> {
    let extension_refs: Vec<&str> = extensions.iter().map(String::as_str).collect();
    app.dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter(&filter_name, &extension_refs)
        .blocking_save_file()
        .map(|file| file.to_string())
}

/// "Mostrar en el explorador del SO" (RF-02c). Sin plugin ni shell intermedio:
/// los argumentos van tal cual al proceso, sin riesgo de inyección.
#[tauri::command]
pub fn reveal_in_file_manager(path: String) -> Result<(), AppError> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err(AppError::NotFound(path));
    }
    let (program, args) = reveal_command(&path, target.is_dir());
    Command::new(program)
        .args(&args)
        .spawn()
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_temp(dir: &Path, name: &str, contents: &str) -> PathBuf {
        let path = dir.join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&path, contents).unwrap();
        path
    }

    #[test]
    fn has_extension_es_insensible_a_mayusculas() {
        assert!(has_extension("main.typ", &TYPST_EXTENSIONS));
        assert!(has_extension("MAIN.TYP", &TYPST_EXTENSIONS));
        assert!(!has_extension("main.typst", &TYPST_EXTENSIONS));
        assert!(!has_extension("main", &TYPST_EXTENSIONS));
    }

    #[test]
    fn list_directory_entries_ordena_carpetas_primero_y_alfabeticamente() {
        let dir = tempfile::tempdir().unwrap();
        write_temp(dir.path(), "zeta.typ", "");
        write_temp(dir.path(), "alfa.typ", "");
        fs::create_dir_all(dir.path().join("images")).unwrap();
        fs::create_dir_all(dir.path().join("Chapters")).unwrap();

        let names: Vec<String> = list_directory_entries(dir.path())
            .into_iter()
            .map(|entry| entry.name)
            .collect();
        assert_eq!(names, vec!["Chapters", "images", "alfa.typ", "zeta.typ"]);
    }

    #[test]
    fn list_directory_entries_marca_typst_y_editables_solo_en_ficheros() {
        let dir = tempfile::tempdir().unwrap();
        write_temp(dir.path(), "main.typ", "");
        write_temp(dir.path(), "refs.bib", "");
        write_temp(dir.path(), "logo.png", "");
        fs::create_dir_all(dir.path().join("typ")).unwrap();

        let entries = list_directory_entries(dir.path());
        let by_name = |name: &str| entries.iter().find(|e| e.name == name).unwrap().clone();

        assert!(by_name("main.typ").is_typst && by_name("main.typ").is_editable);
        assert!(!by_name("refs.bib").is_typst && by_name("refs.bib").is_editable);
        assert!(!by_name("logo.png").is_typst && !by_name("logo.png").is_editable);
        assert!(by_name("typ").is_dir && !by_name("typ").is_typst);
    }

    #[test]
    fn list_directory_entries_oculta_el_ruido_de_repositorio() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join(".git")).unwrap();
        fs::create_dir_all(dir.path().join("node_modules")).unwrap();
        write_temp(dir.path(), "main.typ", "");

        let names: Vec<String> = list_directory_entries(dir.path())
            .into_iter()
            .map(|entry| entry.name)
            .collect();
        assert_eq!(names, vec!["main.typ"]);
    }

    #[test]
    fn list_directory_entries_en_carpeta_inexistente_devuelve_vacio() {
        let missing = Path::new("no-existe-en-ningun-sitio-dbv");
        assert!(list_directory_entries(missing).is_empty());
    }

    #[test]
    fn list_directory_rechaza_una_ruta_de_fichero() {
        let dir = tempfile::tempdir().unwrap();
        let file = write_temp(dir.path(), "main.typ", "");
        let result = list_directory(path_to_string(&file));
        assert!(matches!(result, Err(AppError::InvalidPath(_))));
    }

    #[test]
    fn read_file_devuelve_contenido_nombre_y_carpeta() {
        let dir = tempfile::tempdir().unwrap();
        let file = write_temp(dir.path(), "main.typ", "= Titulo\n");

        let payload = read_file(path_to_string(&file)).unwrap();
        assert_eq!(payload.content, "= Titulo\n");
        assert_eq!(payload.file_name, "main.typ");
        assert!(!payload.dir_path.is_empty());
    }

    #[test]
    fn read_file_de_una_carpeta_es_notfound() {
        let dir = tempfile::tempdir().unwrap();
        assert!(matches!(
            read_file(path_to_string(dir.path())),
            Err(AppError::NotFound(_))
        ));
    }

    #[test]
    fn write_file_crea_el_fichero_y_devuelve_marca_de_tiempo() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("nuevo.typ");

        let stamp = write_file(path_to_string(&target), "contenido".into()).unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "contenido");
        assert!(stamp > 0);
    }

    #[test]
    fn write_file_rechaza_una_carpeta_padre_inexistente() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("sin").join("crear").join("x.typ");
        assert!(matches!(
            write_file(path_to_string(&target), "x".into()),
            Err(AppError::InvalidPath(_))
        ));
    }

    #[test]
    fn reveal_command_produce_programa_y_argumentos_para_un_fichero() {
        let (program, args) = reveal_command("/tmp/proyecto/main.typ", false);
        assert!(!program.is_empty());
        assert!(!args.is_empty());
    }

    #[test]
    fn reveal_command_abre_la_carpeta_directamente() {
        let (_, args) = reveal_command("/tmp/proyecto", true);
        assert_eq!(args, vec!["/tmp/proyecto".to_string()]);
    }
}
