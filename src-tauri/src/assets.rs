// =============================================================================
// DBV Typst Editor — Gestión de imágenes por arrastre (Beta, ARCHITECTURE.md §7.10)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// A diferencia de `resolveImages()` de DBV Markdown Reader (que solo
// *resolvía* rutas ya existentes, de solo lectura), arrastrar una imagen desde
// el explorador del sistema requiere una operación de ESCRITURA nueva: copiar
// el fichero soltado a `images/` del proyecto activo. El frontend usa la ruta
// relativa que devuelve este comando para invocar el asistente "Insertar
// figura" (§7.7) con la ruta ya rellena.
//
// `pick_image_dialog` es la vía alternativa sin arrastrar: un selector nativo
// de fichero de imagen, para quien lo prefiera al drag-and-drop. Reutiliza el
// mismo `copy_asset_into_project` de abajo — la única diferencia es cómo se
// obtiene la ruta de origen.

use std::fs;
use std::path::{Path, PathBuf};

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::commands::file_io::path_to_string;
use crate::error::AppError;

/// Extensiones de imagen que Typst sabe incrustar con `image(...)`.
const IMAGE_EXTENSIONS: [&str; 6] = ["png", "jpg", "jpeg", "gif", "svg", "webp"];

/// Selector nativo de una imagen a copiar al proyecto (alternativa a
/// arrastrar y soltar).
#[tauri::command]
pub async fn pick_image_dialog(app: AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .add_filter("Imagen", &IMAGE_EXTENSIONS)
        .blocking_pick_file()
        .map(|file| file.to_string())
}

const ASSETS_DIR: &str = "images";

/// Extensiones de fuente que reconoce Typst al escanear `--font-path`
/// (ver `typst_engine::font_path_args`). No incluye `.woff`/`.woff2`: Typst
/// no las carga, y ofrecer arrastrarlas confundiría más que ayudaría.
const FONT_EXTENSIONS: [&str; 4] = ["ttf", "otf", "ttc", "otc"];

/// Nombre de destino libre dentro de `dir`: si `file_name` ya existe, prueba
/// `nombre-1.ext`, `nombre-2.ext`... Nunca sobrescribe una imagen que el
/// usuario ya tuviera con ese nombre.
fn unique_destination(dir: &Path, file_name: &str) -> PathBuf {
    let candidate = dir.join(file_name);
    if !candidate.exists() {
        return candidate;
    }

    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("imagen");
    let extension = Path::new(file_name).extension().and_then(|s| s.to_str());

    let mut attempt = 1;
    loop {
        let name = match extension {
            Some(ext) => format!("{stem}-{attempt}.{ext}"),
            None => format!("{stem}-{attempt}"),
        };
        let candidate = dir.join(&name);
        if !candidate.exists() {
            return candidate;
        }
        attempt += 1;
    }
}

/// Copia `source_path` a `images/` dentro de `project_root` y devuelve la ruta
/// relativa (con `/`, nunca `\`, para que sirva tal cual dentro de
/// `image("...")` en Windows y en Linux por igual).
#[tauri::command]
pub fn copy_asset_into_project(project_root: String, source_path: String) -> Result<String, AppError> {
    let root = PathBuf::from(&project_root);
    if !root.is_dir() {
        return Err(AppError::InvalidPath(project_root));
    }
    let source = PathBuf::from(&source_path);
    if !source.is_file() {
        return Err(AppError::NotFound(source_path));
    }

    let images_dir = root.join(ASSETS_DIR);
    fs::create_dir_all(&images_dir).map_err(|error| AppError::Io(error.to_string()))?;

    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::InvalidPath(source_path.clone()))?;
    let destination = unique_destination(&images_dir, file_name);

    fs::copy(&source, &destination).map_err(|error| AppError::Io(error.to_string()))?;

    let relative = destination.strip_prefix(&root).unwrap_or(&destination);
    Ok(path_to_string(relative).replace('\\', "/"))
}

/// Copia `source_path` a `fonts/` dentro de `project_root` (arrastrar y
/// soltar, Beta): esa es la carpeta que `typst_engine::font_path_args` ya
/// sabe pasarle al compilador como `--font-path`, así que una fuente soltada
/// aquí queda disponible en la próxima recompilación sin ningún paso más.
///
/// A diferencia de una imagen, una fuente no se inserta en el documento: no
/// hay forma fiable de derivar el nombre de familia tipográfica que espera
/// `set text(font: "...")` a partir del nombre del fichero.
#[tauri::command]
pub fn copy_font_into_project(project_root: String, source_path: String) -> Result<String, AppError> {
    let root = PathBuf::from(&project_root);
    if !root.is_dir() {
        return Err(AppError::InvalidPath(project_root));
    }
    let source = PathBuf::from(&source_path);
    if !source.is_file() {
        return Err(AppError::NotFound(source_path));
    }

    let extension_ok = source
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| FONT_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()));
    if !extension_ok {
        return Err(AppError::InvalidPath(source_path));
    }

    let fonts_dir = root.join(crate::typst_engine::PROJECT_FONTS_DIR);
    fs::create_dir_all(&fonts_dir).map_err(|error| AppError::Io(error.to_string()))?;

    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::InvalidPath(source_path.clone()))?;
    let destination = unique_destination(&fonts_dir, file_name);

    fs::copy(&source, &destination).map_err(|error| AppError::Io(error.to_string()))?;

    let relative = destination.strip_prefix(&root).unwrap_or(&destination);
    Ok(path_to_string(relative).replace('\\', "/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unique_destination_devuelve_el_nombre_tal_cual_si_esta_libre() {
        let dir = tempfile::tempdir().unwrap();
        let result = unique_destination(dir.path(), "foto.png");
        assert_eq!(result, dir.path().join("foto.png"));
    }

    #[test]
    fn unique_destination_evita_sobrescribir_uno_existente() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("foto.png"), "ya existe").unwrap();
        let result = unique_destination(dir.path(), "foto.png");
        assert_eq!(result, dir.path().join("foto-1.png"));
    }

    #[test]
    fn unique_destination_encadena_varios_intentos() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("foto.png"), "a").unwrap();
        fs::write(dir.path().join("foto-1.png"), "b").unwrap();
        let result = unique_destination(dir.path(), "foto.png");
        assert_eq!(result, dir.path().join("foto-2.png"));
    }

    #[test]
    fn unique_destination_conserva_un_nombre_sin_extension() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("imagen"), "a").unwrap();
        let result = unique_destination(dir.path(), "imagen");
        assert_eq!(result, dir.path().join("imagen-1"));
    }

    #[test]
    fn copy_asset_into_project_copia_y_devuelve_ruta_relativa_con_barra_normal() {
        let project = tempfile::tempdir().unwrap();
        let source_dir = tempfile::tempdir().unwrap();
        let source = source_dir.path().join("diagrama.png");
        fs::write(&source, "contenido de prueba").unwrap();

        let relative = copy_asset_into_project(
            path_to_string(project.path()),
            path_to_string(&source),
        )
        .unwrap();

        assert_eq!(relative, "images/diagrama.png");
        assert_eq!(
            fs::read_to_string(project.path().join("images/diagrama.png")).unwrap(),
            "contenido de prueba"
        );
    }

    #[test]
    fn copy_asset_into_project_no_sobrescribe_una_imagen_existente_con_el_mismo_nombre() {
        let project = tempfile::tempdir().unwrap();
        fs::create_dir_all(project.path().join("images")).unwrap();
        fs::write(project.path().join("images/diagrama.png"), "original").unwrap();

        let source_dir = tempfile::tempdir().unwrap();
        let source = source_dir.path().join("diagrama.png");
        fs::write(&source, "nuevo").unwrap();

        let relative =
            copy_asset_into_project(path_to_string(project.path()), path_to_string(&source)).unwrap();

        assert_eq!(relative, "images/diagrama-1.png");
        assert_eq!(
            fs::read_to_string(project.path().join("images/diagrama.png")).unwrap(),
            "original"
        );
    }

    #[test]
    fn copy_asset_into_project_rechaza_una_raiz_que_no_es_carpeta() {
        let dir = tempfile::tempdir().unwrap();
        let not_a_dir = dir.path().join("no-existe");
        let source = dir.path().join("origen.png");
        fs::write(&source, "x").unwrap();

        let result = copy_asset_into_project(path_to_string(&not_a_dir), path_to_string(&source));
        assert!(matches!(result, Err(AppError::InvalidPath(_))));
    }

    #[test]
    fn copy_asset_into_project_rechaza_un_origen_inexistente() {
        let project = tempfile::tempdir().unwrap();
        let result = copy_asset_into_project(
            path_to_string(project.path()),
            path_to_string(&project.path().join("no-existe.png")),
        );
        assert!(matches!(result, Err(AppError::NotFound(_))));
    }

    #[test]
    fn copy_font_into_project_copia_a_fonts_y_devuelve_ruta_relativa() {
        let project = tempfile::tempdir().unwrap();
        let source_dir = tempfile::tempdir().unwrap();
        let source = source_dir.path().join("MiFuente.ttf");
        fs::write(&source, "contenido de prueba").unwrap();

        let relative =
            copy_font_into_project(path_to_string(project.path()), path_to_string(&source)).unwrap();

        assert_eq!(relative, "fonts/MiFuente.ttf");
        assert_eq!(
            fs::read_to_string(project.path().join("fonts/MiFuente.ttf")).unwrap(),
            "contenido de prueba"
        );
    }

    #[test]
    fn copy_font_into_project_rechaza_una_extension_que_no_es_de_fuente() {
        let project = tempfile::tempdir().unwrap();
        let source_dir = tempfile::tempdir().unwrap();
        let source = source_dir.path().join("no-es-una-fuente.png");
        fs::write(&source, "x").unwrap();

        let result = copy_font_into_project(path_to_string(project.path()), path_to_string(&source));
        assert!(matches!(result, Err(AppError::InvalidPath(_))));
    }

    #[test]
    fn copy_font_into_project_no_sobrescribe_una_fuente_existente_con_el_mismo_nombre() {
        let project = tempfile::tempdir().unwrap();
        fs::create_dir_all(project.path().join("fonts")).unwrap();
        fs::write(project.path().join("fonts/MiFuente.otf"), "original").unwrap();

        let source_dir = tempfile::tempdir().unwrap();
        let source = source_dir.path().join("MiFuente.otf");
        fs::write(&source, "nuevo").unwrap();

        let relative =
            copy_font_into_project(path_to_string(project.path()), path_to_string(&source)).unwrap();

        assert_eq!(relative, "fonts/MiFuente-1.otf");
    }
}
