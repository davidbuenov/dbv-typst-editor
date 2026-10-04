// =============================================================================
// DBV Typst Editor — Ficheros de snippets de usuario (RF-81)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Dos niveles, como en VS Code (RF-81.2):
//   · globales: `snippets/typst.json` en la carpeta de configuración de la app;
//   · del proyecto: `.vscode/*.code-snippets`, el mismo sitio y formato que usa
//     VS Code, para compartirlos con coautores que usen VS Code con Tinymist.
// Aquí solo se localizan y, a petición explícita del usuario («Editar
// snippets…»), se crean con una plantilla comentada. Leerlos y validarlos es
// cosa del frontend (`snippets/model.js`, con `jsonc-parser`).

use std::fs;
use std::path::{Path, PathBuf};

use tauri::Manager;

use crate::commands::file_io::{path_to_string, write_atomic};
use crate::error::AppError;

/// Fichero global, relativo a la carpeta de configuración de la app.
pub const GLOBAL_RELATIVE: &str = "snippets/typst.json";
/// Carpeta y fichero por defecto de los snippets del proyecto.
pub const PROJECT_DIR: &str = ".vscode";
pub const PROJECT_DEFAULT: &str = "typst.code-snippets";

/// Plantilla de un fichero nuevo: dos ejemplos comentados que sirven de guía
/// (RF-81.4). Solo lleva comentarios de línea completa y es JSON válido una
/// vez quitados (lo comprueba un test).
pub const TEMPLATE: &str = r##"{
  // Snippets de Typst con el formato de VS Code (también sirven los copiados de allí).
  // Escribe el prefijo en el editor y elige el snippet en la lista; Tab salta de un campo a otro.
  // $1, $2… son los campos; ${1:texto} lleva texto por defecto; $0 es dónde acaba el cursor.
  // Variables: $TM_SELECTED_TEXT, $TM_FILENAME, $TM_FILENAME_BASE, $CURRENT_YEAR, $CURRENT_MONTH, $CURRENT_DATE.
  "Figura con imagen": {
    "prefix": "figura",
    "body": [
      "#figure(",
      "  image(\"${1:images/imagen.png}\", width: ${2:80%}),",
      "  caption: [${3:Pie de figura}],",
      ") <fig-${4:etiqueta}>"
    ],
    "description": "Figura con imagen, pie y etiqueta"
  },
  "Nota al margen": {
    "prefix": "nota",
    "body": "#footnote[${1:$TM_SELECTED_TEXT}]$0",
    "description": "Nota al pie con el texto seleccionado"
  }
}
"##;

/// Crea `path` con la plantilla si no existe. Devuelve si lo creó.
fn ensure_file(path: &Path) -> Result<bool, AppError> {
    if path.is_file() {
        return Ok(false);
    }
    if path.exists() {
        return Err(AppError::InvalidPath(path_to_string(path)));
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| AppError::Io(error.to_string()))?;
    }
    write_atomic(path, TEMPLATE).map_err(|error| AppError::Io(error.to_string()))?;
    Ok(true)
}

/// Ficheros `.vscode/*.code-snippets` del proyecto, ordenados.
pub fn project_files(root: &Path) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = fs::read_dir(root.join(PROJECT_DIR))
        .map(|entries| {
            entries
                .flatten()
                .filter(|entry| entry.file_type().map(|kind| kind.is_file()).unwrap_or(false))
                .map(|entry| entry.path())
                .filter(|path| path.file_name().is_some_and(|name| name.to_string_lossy().to_lowercase().ends_with(".code-snippets")))
                .collect()
        })
        .unwrap_or_default();
    files.sort();
    files
}

/// El fichero de snippets del proyecto que se abre para editar: el primero
/// que exista o, si no hay ninguno, `.vscode/typst.code-snippets` recién creado.
pub fn ensure_project(root: &Path) -> Result<PathBuf, AppError> {
    if !root.is_dir() {
        return Err(AppError::NotFound(path_to_string(root)));
    }
    let existing = project_files(root).into_iter().next();
    let path = match existing {
        Some(path) => path,
        None => {
            let path = root.join(PROJECT_DIR).join(PROJECT_DEFAULT);
            ensure_file(&path)?;
            path
        }
    };
    Ok(path)
}

fn global_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, AppError> {
    let config = app.path().app_config_dir().map_err(|error| AppError::Io(error.to_string()))?;
    Ok(config.join(GLOBAL_RELATIVE))
}

/// Ruta del fichero global (exista o no).
#[tauri::command]
pub fn snippets_global_path(app: tauri::AppHandle) -> Result<String, AppError> {
    Ok(path_to_string(&global_path(&app)?))
}

/// «Editar snippets globales»: lo crea con la plantilla si no existe.
#[tauri::command]
pub fn snippets_ensure_global(app: tauri::AppHandle) -> Result<String, AppError> {
    let path = global_path(&app)?;
    ensure_file(&path)?;
    Ok(path_to_string(&path))
}

/// Ficheros de snippets del proyecto abierto.
#[tauri::command]
pub fn snippets_project_files(root: String) -> Vec<String> {
    project_files(Path::new(&root)).iter().map(|path| path_to_string(path)).collect()
}

/// «Editar snippets del proyecto»: acción explícita del usuario, que crea
/// `.vscode/typst.code-snippets` si el proyecto aún no tiene ninguno.
#[tauri::command]
pub fn snippets_ensure_project(root: String) -> Result<String, AppError> {
    Ok(path_to_string(&ensure_project(Path::new(&root))?))
}


// ---------------------------------------------------------------------------
// Importar snippets de Sublime Text (RF-112)
// ---------------------------------------------------------------------------
//
// El conversor (XML → `.code-snippets`) vive en el frontend (`snippets/sublimeImport.js`);
// aquí solo se ELIGEN y se LEEN los ficheros —con los límites que fija el spec— y se
// escribe el destino. Nada se ejecuta ni se interpreta del contenido.

/// Extensión de los snippets de Sublime Text.
pub const SUBLIME_EXTENSION: &str = "sublime-snippet";
/// Ficheros como mucho por importación.
pub const MAX_IMPORT_FILES: usize = 500;
/// Un fichero más grande que esto no es un snippet.
pub const MAX_IMPORT_BYTES: u64 = 1_048_576;
/// Fichero de destino por defecto, en `.vscode/` del proyecto.
pub const IMPORTED_FILE: &str = "sublime-importados.code-snippets";

/// Un fichero leído para importar: su contenido o por qué no se pudo leer.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SublimeSource {
    pub name: String,
    pub content: Option<String>,
    /// `tooBig` o `notText`.
    pub error: Option<String>,
}

/// Lo que devuelve `snippets_read_sublime`.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SublimeBatch {
    pub sources: Vec<SublimeSource>,
    /// Había más de `MAX_IMPORT_FILES`: se leen los primeros.
    pub truncated: bool,
}

fn is_sublime_snippet(path: &Path) -> bool {
    path.extension().and_then(|ext| ext.to_str()).is_some_and(|ext| ext.eq_ignore_ascii_case(SUBLIME_EXTENSION))
}

/// Ficheros `.sublime-snippet` de lo que se eligió: los ficheros tal cual y, de una carpeta, los suyos y los de sus
/// subcarpetas directas (Sublime los guarda en `Packages/User`, a veces en una subcarpeta). Sin enlaces simbólicos.
pub fn gather_sublime_files(inputs: &[PathBuf]) -> (Vec<PathBuf>, bool) {
    let mut found: Vec<PathBuf> = Vec::new();
    let mut truncated = false;
    let mut push = |path: PathBuf, found: &mut Vec<PathBuf>| {
        if found.len() >= MAX_IMPORT_FILES {
            truncated = true;
        } else if !found.contains(&path) {
            found.push(path);
        }
    };
    for input in inputs {
        let Ok(meta) = fs::symlink_metadata(input) else { continue };
        if meta.file_type().is_symlink() {
            continue;
        }
        if meta.is_file() {
            if is_sublime_snippet(input) {
                push(input.clone(), &mut found);
            }
        } else if meta.is_dir() {
            let mut folders = vec![(input.clone(), 0usize)];
            while let Some((dir, depth)) = folders.pop() {
                let mut children: Vec<PathBuf> = fs::read_dir(&dir).into_iter().flatten().flatten().map(|entry| entry.path()).collect();
                children.sort();
                for child in children {
                    let Ok(kind) = fs::symlink_metadata(&child) else { continue };
                    if kind.file_type().is_symlink() {
                        continue;
                    }
                    if kind.is_file() && is_sublime_snippet(&child) {
                        push(child, &mut found);
                    } else if kind.is_dir() && depth < 1 {
                        folders.push((child, depth + 1));
                    }
                }
            }
        }
    }
    (found, truncated)
}

/// Lee los ficheros elegidos con sus límites de tamaño y de número.
pub fn read_sublime_sources(inputs: &[PathBuf]) -> SublimeBatch {
    let (files, truncated) = gather_sublime_files(inputs);
    let sources = files
        .into_iter()
        .map(|path| {
            let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            if fs::metadata(&path).map(|meta| meta.len() > MAX_IMPORT_BYTES).unwrap_or(true) {
                return SublimeSource { name, content: None, error: Some("tooBig".into()) };
            }
            match fs::read_to_string(&path) {
                Ok(content) => SublimeSource { name, content: Some(content), error: None },
                Err(_) => SublimeSource { name, content: None, error: Some("notText".into()) },
            }
        })
        .collect();
    SublimeBatch { sources, truncated }
}

/// Elegir los `.sublime-snippet` (varios) o una carpeta. `None` si se cancela.
#[tauri::command]
pub async fn snippets_pick_sublime(app: tauri::AppHandle, folder: bool) -> Option<Vec<String>> {
    use tauri_plugin_dialog::DialogExt;
    if folder {
        return app.dialog().file().blocking_pick_folder().map(|picked| vec![picked.to_string()]);
    }
    app.dialog().file().add_filter("Sublime Text snippet", &[SUBLIME_EXTENSION]).blocking_pick_files().map(|files| files.into_iter().map(|file| file.to_string()).collect())
}

/// Lee lo elegido para importar (ficheros sueltos y carpetas).
#[tauri::command]
pub fn snippets_read_sublime(paths: Vec<String>) -> SublimeBatch {
    let inputs: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();
    read_sublime_sources(&inputs)
}

/// Destino de una importación y lo que ya hay en él.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportTarget {
    pub path: String,
    pub exists: bool,
    pub content: Option<String>,
}

/// Ruta del destino: `.vscode/sublime-importados.code-snippets` del proyecto, o el fichero global.
fn import_target_path(app: &tauri::AppHandle, destination: &str, root: Option<&str>) -> Result<PathBuf, AppError> {
    match (destination, root) {
        ("project", Some(root)) if Path::new(root).is_dir() => Ok(Path::new(root).join(PROJECT_DIR).join(IMPORTED_FILE)),
        ("project", _) => Err(AppError::InvalidPath("no hay un proyecto abierto".into())),
        ("global", _) => global_path(app),
        (other, _) => Err(AppError::InvalidPath(format!("destino desconocido: {other}"))),
    }
}

/// Qué hay ya en el destino (para preguntar «añadir» o «reemplazar» sin pisar nada).
#[tauri::command]
pub fn snippets_import_target(app: tauri::AppHandle, destination: String, root: Option<String>) -> Result<ImportTarget, AppError> {
    let path = import_target_path(&app, &destination, root.as_deref())?;
    let content = fs::read_to_string(&path).ok();
    Ok(ImportTarget { path: path_to_string(&path), exists: path.is_file(), content })
}

/// Escribe el resultado. Si el fichero ya existe, solo se sobrescribe con `overwrite` (el usuario eligió añadir o reemplazar).
#[tauri::command]
pub fn snippets_write_imported(app: tauri::AppHandle, destination: String, root: Option<String>, text: String, overwrite: bool) -> Result<String, AppError> {
    let path = import_target_path(&app, &destination, root.as_deref())?;
    write_imported(&path, &text, overwrite)?;
    Ok(path_to_string(&path))
}

/// Escritura atómica del destino, que crea la carpeta si falta y no pisa un fichero sin permiso.
pub fn write_imported(path: &Path, text: &str, overwrite: bool) -> Result<(), AppError> {
    if path.exists() && !overwrite {
        return Err(AppError::InvalidPath(format!("{} ya existe: elige añadir o reemplazar", path.display())));
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| AppError::Io(error.to_string()))?;
    }
    write_atomic(path, text).map_err(|error| AppError::Io(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn la_plantilla_es_json_valido_sin_sus_comentarios() {
        let without_comments: String =
            TEMPLATE.lines().filter(|line| !line.trim_start().starts_with("//")).collect::<Vec<_>>().join("\n");
        let value: serde_json::Value = serde_json::from_str(&without_comments).expect("plantilla válida");
        assert_eq!(value["Figura con imagen"]["prefix"], "figura");
    }

    #[test]
    fn crea_el_fichero_del_proyecto_una_sola_vez_y_respeta_el_que_ya_hay() {
        let dir = tempfile::tempdir().unwrap();
        let created = ensure_project(dir.path()).unwrap();
        assert_eq!(created, dir.path().join(".vscode").join("typst.code-snippets"));
        assert_eq!(fs::read_to_string(&created).unwrap(), TEMPLATE);

        fs::write(&created, "{ \"mío\": {} }").unwrap();
        assert_eq!(ensure_project(dir.path()).unwrap(), created);
        assert_eq!(fs::read_to_string(&created).unwrap(), "{ \"mío\": {} }", "no se pisa lo que ya había");
    }

    #[test]
    fn usa_el_code_snippets_que_ya_exista_y_lista_solo_esos() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join(".vscode")).unwrap();
        fs::write(dir.path().join(".vscode").join("libro.code-snippets"), "{}").unwrap();
        fs::write(dir.path().join(".vscode").join("settings.json"), "{}").unwrap();
        assert_eq!(project_files(dir.path()), vec![dir.path().join(".vscode").join("libro.code-snippets")]);
        assert_eq!(ensure_project(dir.path()).unwrap(), dir.path().join(".vscode").join("libro.code-snippets"));
    }

    #[test]
    fn un_directorio_con_el_nombre_del_fichero_es_un_error() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("snippets").join("typst.json")).unwrap();
        assert!(ensure_file(&dir.path().join("snippets").join("typst.json")).is_err());
    }

    fn sublime_tree() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.sublime-snippet"), "<snippet/>").unwrap();
        fs::write(dir.path().join("b.SUBLIME-SNIPPET"), "<snippet/>").unwrap();
        fs::write(dir.path().join("nota.txt"), "no").unwrap();
        fs::create_dir_all(dir.path().join("sub/hondo/mas")).unwrap();
        fs::write(dir.path().join("sub/c.sublime-snippet"), "<snippet/>").unwrap();
        fs::write(dir.path().join("sub/hondo/d.sublime-snippet"), "<snippet/>").unwrap();
        fs::write(dir.path().join("sub/hondo/mas/e.sublime-snippet"), "<snippet/>").unwrap();
        dir
    }

    #[test]
    fn de_una_carpeta_se_leen_sus_snippets_y_los_de_una_subcarpeta_directa_pero_no_mas_hondo() {
        let dir = sublime_tree();
        let names: Vec<String> = read_sublime_sources(&[dir.path().to_path_buf()]).sources.into_iter().map(|s| s.name).collect();
        let mut sorted = names.clone();
        sorted.sort();
        // `sub/c` (subcarpeta directa) sí; `sub/hondo/d` y `sub/hondo/mas/e` (más hondo) no.
        assert_eq!(sorted, vec!["a.sublime-snippet", "b.SUBLIME-SNIPPET", "c.sublime-snippet"], "{names:?}");
    }

    #[test]
    fn los_ficheros_sueltos_se_filtran_por_extension_y_no_se_repiten() {
        let dir = sublime_tree();
        let inputs = vec![dir.path().join("a.sublime-snippet"), dir.path().join("nota.txt"), dir.path().join("a.sublime-snippet"), dir.path().join("no-existe.sublime-snippet")];
        let batch = read_sublime_sources(&inputs);
        assert_eq!(batch.sources.iter().map(|s| s.name.as_str()).collect::<Vec<_>>(), vec!["a.sublime-snippet"]);
        assert_eq!(batch.sources[0].content.as_deref(), Some("<snippet/>"));
    }

    #[test]
    fn un_fichero_enorme_o_que_no_es_texto_se_lee_como_error_y_no_tumba_el_lote() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("grande.sublime-snippet"), vec![b'x'; (MAX_IMPORT_BYTES + 1) as usize]).unwrap();
        fs::write(dir.path().join("binario.sublime-snippet"), [0xff, 0xfe, 0x00, 0x80]).unwrap();
        fs::write(dir.path().join("bien.sublime-snippet"), "<snippet/>").unwrap();
        let batch = read_sublime_sources(&[dir.path().to_path_buf()]);
        let by_name = |name: &str| batch.sources.iter().find(|s| s.name == name).unwrap();
        assert_eq!(by_name("grande.sublime-snippet").error.as_deref(), Some("tooBig"));
        assert_eq!(by_name("binario.sublime-snippet").error.as_deref(), Some("notText"));
        assert!(by_name("bien.sublime-snippet").content.is_some());
    }

    #[test]
    fn mas_de_quinientos_ficheros_se_recortan_y_se_dice() {
        let dir = tempfile::tempdir().unwrap();
        for i in 0..(MAX_IMPORT_FILES + 20) {
            fs::write(dir.path().join(format!("s{i:04}.sublime-snippet")), "<snippet/>").unwrap();
        }
        let batch = read_sublime_sources(&[dir.path().to_path_buf()]);
        assert_eq!(batch.sources.len(), MAX_IMPORT_FILES);
        assert!(batch.truncated);
    }

    #[cfg(unix)]
    #[test]
    fn los_enlaces_simbolicos_no_se_siguen() {
        let dir = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("fuera.sublime-snippet"), "<snippet/>").unwrap();
        std::os::unix::fs::symlink(outside.path(), dir.path().join("enlace")).unwrap();
        std::os::unix::fs::symlink(outside.path().join("fuera.sublime-snippet"), dir.path().join("e.sublime-snippet")).unwrap();
        assert!(read_sublime_sources(&[dir.path().to_path_buf()]).sources.is_empty());
    }

    #[test]
    fn escribir_el_destino_crea_vscode_y_no_pisa_un_fichero_que_ya_existe_sin_permiso() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join(PROJECT_DIR).join(IMPORTED_FILE);
        write_imported(&target, "{ }", false).unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "{ }");
        assert!(write_imported(&target, "{ \"x\": 1 }", false).is_err(), "ya existe: hace falta elegir añadir o reemplazar");
        assert_eq!(fs::read_to_string(&target).unwrap(), "{ }", "no se tocó");
        write_imported(&target, "{ \"x\": 1 }", true).unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "{ \"x\": 1 }");
    }
}
