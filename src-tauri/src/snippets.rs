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
}
