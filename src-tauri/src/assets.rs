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

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::commands::file_io::{has_extension, is_noise_dir, path_to_string};
use crate::error::AppError;

/// Extensiones de imagen que Typst sabe incrustar con `image(...)`.
///
/// Única fuente de verdad: el frontend las pide con `supported_asset_extensions`
/// en vez de mantener su propia lista, que ya se había desincronizado de esta
/// (incluía `bmp`, que Typst no incrusta).
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

/// Si `dir` ya contiene un fichero con el mismo contenido byte a byte que
/// `source` —aunque tenga otro nombre—, su ruta. Sin esto, arrastrar (o
/// seleccionar por el diálogo) la MISMA imagen dos veces crea una copia
/// idéntica cada vez (`foto.png`, `foto-1.png`, `foto-2.png`...): el nombre
/// puede repetirse sin que el contenido lo haga, así que la comprobación por
/// nombre de `unique_destination` no basta para detectar el duplicado.
/// Compara primero por tamaño (barato) antes de leer el contenido entero.
fn find_existing_copy(dir: &Path, source: &Path) -> Option<PathBuf> {
    let source_bytes = fs::read(source).ok()?;
    find_existing_copy_of_bytes(dir, &source_bytes)
}

/// Igual que `find_existing_copy`, pero partiendo de los bytes ya en memoria:
/// una imagen pegada desde el portapapeles no tiene fichero de origen que leer.
fn find_existing_copy_of_bytes(dir: &Path, bytes: &[u8]) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(metadata) = entry.metadata() else { continue };
        if !metadata.is_file() || metadata.len() != bytes.len() as u64 {
            continue;
        }
        if fs::read(&path).ok().as_deref() == Some(bytes) {
            return Some(path);
        }
    }
    None
}

/// Nombre de destino libre dentro de `dir`: si `file_name` ya existe, prueba
/// `nombre-1.ext`, `nombre-2.ext`... Nunca sobrescribe una imagen que el
/// usuario ya tuviera con ese nombre.
pub(crate) fn unique_destination(dir: &Path, file_name: &str) -> PathBuf {
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
    // Misma guarda que `copy_font_into_project`: sin ella, el frontend era el
    // único que decidía qué es una imagen, y su lista se había desincronizado
    // de `IMAGE_EXTENSIONS` (aceptaba `.bmp`, que Typst no sabe incrustar).
    if !has_extension(&source_path, &IMAGE_EXTENSIONS) {
        return Err(AppError::InvalidPath(source_path));
    }

    let images_dir = root.join(ASSETS_DIR);
    fs::create_dir_all(&images_dir).map_err(|error| AppError::Io(error.to_string()))?;

    if let Some(existing) = find_existing_copy(&images_dir, &source) {
        let relative = existing.strip_prefix(&root).unwrap_or(&existing);
        return Ok(path_to_string(relative).replace('\\', "/"));
    }

    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::InvalidPath(source_path.clone()))?;
    let destination = unique_destination(&images_dir, file_name);

    fs::copy(&source, &destination).map_err(|error| AppError::Io(error.to_string()))?;

    let relative = destination.strip_prefix(&root).unwrap_or(&destination);
    Ok(path_to_string(relative).replace('\\', "/"))
}

/// Nombre base de una imagen llegada del portapapeles. Un recorte de pantalla
/// no trae nombre de fichero, así que hay que ponerle uno; `unique_destination`
/// se encarga de los sufijos `-1`, `-2`… cuando se pega más de una.
const PASTED_IMAGE_STEM: &str = "imagen-pegada";

/// Guarda en `images/` una imagen llegada del portapapeles y devuelve su ruta
/// relativa, igual que `copy_asset_into_project`.
///
/// Los bytes llegan en base64 y no como array de números: un recorte de
/// pantalla ronda el megabyte, y `Vec<u8>` viaja por el IPC de Tauri como JSON
/// (`[137,80,78,71,...]`), lo que multiplica por tres o cuatro el tamaño de lo
/// que cruza el puente para nada.
#[tauri::command]
pub fn save_pasted_image(
    project_root: String,
    base64_data: String,
    extension: String,
) -> Result<String, AppError> {
    let root = PathBuf::from(&project_root);
    if !root.is_dir() {
        return Err(AppError::InvalidPath(project_root));
    }

    let extension = extension.to_ascii_lowercase();
    if !IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Err(AppError::InvalidPath(extension));
    }

    let bytes = BASE64
        .decode(base64_data.as_bytes())
        .map_err(|error| AppError::Io(error.to_string()))?;
    if bytes.is_empty() {
        return Err(AppError::Io("el portapapeles no traía datos de imagen".into()));
    }

    let images_dir = root.join(ASSETS_DIR);
    fs::create_dir_all(&images_dir).map_err(|error| AppError::Io(error.to_string()))?;

    // Misma deduplicación por contenido que al arrastrar: pegar dos veces el
    // mismo recorte no debe dejar dos ficheros idénticos en el proyecto.
    if let Some(existing) = find_existing_copy_of_bytes(&images_dir, &bytes) {
        let relative = existing.strip_prefix(&root).unwrap_or(&existing);
        return Ok(path_to_string(relative).replace('\\', "/"));
    }

    let destination = unique_destination(&images_dir, &format!("{PASTED_IMAGE_STEM}.{extension}"));
    fs::write(&destination, &bytes).map_err(|error| AppError::Io(error.to_string()))?;

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

    if let Some(existing) = find_existing_copy(&fonts_dir, &source) {
        let relative = existing.strip_prefix(&root).unwrap_or(&existing);
        return Ok(path_to_string(relative).replace('\\', "/"));
    }

    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::InvalidPath(source_path.clone()))?;
    let destination = unique_destination(&fonts_dir, file_name);

    fs::copy(&source, &destination).map_err(|error| AppError::Io(error.to_string()))?;

    let relative = destination.strip_prefix(&root).unwrap_or(&destination);
    Ok(path_to_string(relative).replace('\\', "/"))
}

/// Extensiones que la aplicación acepta por arrastre, servidas al frontend
/// para que no mantenga su propia copia de las listas (RF-18).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetExtensions {
    pub images: Vec<String>,
    pub fonts: Vec<String>,
}

/// Extensiones de imagen y de fuente que la aplicación sabe copiar al proyecto.
#[tauri::command]
pub fn supported_asset_extensions() -> AssetExtensions {
    AssetExtensions {
        images: IMAGE_EXTENSIONS.iter().map(|ext| ext.to_string()).collect(),
        fonts: FONT_EXTENSIONS.iter().map(|ext| ext.to_string()).collect(),
    }
}

/// Una imagen que ya vive en el proyecto, lista para insertar en una figura.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectImage {
    /// Ruta anclada a la raíz (`/images/foto.png`), tal cual va dentro de
    /// `image("...")`. Anclada porque Typst resuelve las rutas sin `/` relativas
    /// al fichero que las contiene, no a la raíz — un capítulo en una subcarpeta
    /// rompería la ruta relativa (corregido en el Slice 27).
    pub path: String,
    /// Nombre del fichero: lo que el usuario reconoce y por lo que filtra.
    pub name: String,
}

/// Profundidad máxima del escaneo. Un proyecto Typst real no anida recursos más
/// allá de dos o tres niveles; el límite existe para que un proyecto ajeno con un
/// árbol enorme (RF-02b) no cueste un recorrido completo al abrir el desplegable.
const MAX_SCAN_DEPTH: usize = 6;

/// Acumula en `found` las imágenes de `dir`, descendiendo hasta `MAX_SCAN_DEPTH`.
///
/// Se saltan las carpetas de ruido compartidas con el watcher y cualquier carpeta
/// oculta: ni `.git` ni `.vscode` contienen recursos del documento, y recorrerlas
/// solo añade coste y resultados que el usuario nunca querría insertar.
fn collect_images(dir: &Path, root: &Path, depth: usize, found: &mut Vec<ProjectImage>) {
    if depth > MAX_SCAN_DEPTH {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if path.is_dir() {
            if !is_noise_dir(name) && !name.starts_with('.') {
                collect_images(&path, root, depth + 1, found);
            }
            continue;
        }
        if !has_extension(name, &IMAGE_EXTENSIONS) {
            continue;
        }
        let Ok(relative) = path.strip_prefix(root) else {
            continue;
        };
        found.push(ProjectImage {
            path: format!("/{}", path_to_string(relative).replace('\\', "/")),
            name: name.to_string(),
        });
    }
}

/// Imágenes disponibles en el proyecto (RF-17, desplegable del botón "Fig").
///
/// Espejo de `bibliography::bibliography_keys` en forma y contrato, con una
/// diferencia deliberada: aquí sí se recorre el árbol, porque una imagen puede
/// estar en cualquier carpeta de un proyecto ajeno (RF-02b), mientras que el
/// `.bib` está siempre en la raíz en las 8 plantillas curadas. Un proyecto sin
/// imágenes no es un error: devuelve una lista vacía.
#[tauri::command]
pub fn project_images(root: String) -> Result<Vec<ProjectImage>, AppError> {
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err(AppError::InvalidPath(root));
    }

    let mut images = Vec::new();
    collect_images(root_path, root_path, 0, &mut images);
    images.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(images)
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

    // Pegar desde el portapapeles (RF-39). Un recorte de pantalla llega como
    // bytes sin nombre ni ruta de origen, así que no puede pasar por
    // `copy_asset_into_project`.
    #[test]
    fn save_pasted_image_escribe_los_bytes_y_devuelve_la_ruta_relativa() {
        let project = tempfile::tempdir().unwrap();

        let relative = save_pasted_image(
            path_to_string(project.path()),
            BASE64.encode(b"bytes de un png"),
            "png".into(),
        )
        .unwrap();

        assert_eq!(relative, "images/imagen-pegada.png");
        assert_eq!(
            fs::read(project.path().join("images/imagen-pegada.png")).unwrap(),
            b"bytes de un png"
        );
    }

    #[test]
    fn save_pasted_image_no_duplica_el_mismo_recorte_pegado_dos_veces() {
        let project = tempfile::tempdir().unwrap();
        let datos = BASE64.encode(b"el mismo recorte");

        let primera =
            save_pasted_image(path_to_string(project.path()), datos.clone(), "png".into()).unwrap();
        let segunda =
            save_pasted_image(path_to_string(project.path()), datos, "png".into()).unwrap();

        assert_eq!(primera, segunda);
        assert_eq!(fs::read_dir(project.path().join("images")).unwrap().count(), 1);
    }

    #[test]
    fn save_pasted_image_numera_dos_recortes_distintos() {
        let project = tempfile::tempdir().unwrap();

        save_pasted_image(
            path_to_string(project.path()),
            BASE64.encode(b"primero"),
            "png".into(),
        )
        .unwrap();
        let segunda = save_pasted_image(
            path_to_string(project.path()),
            BASE64.encode(b"segundo"),
            "png".into(),
        )
        .unwrap();

        assert_eq!(segunda, "images/imagen-pegada-1.png");
    }

    #[test]
    fn save_pasted_image_rechaza_una_extension_que_typst_no_incrusta() {
        let project = tempfile::tempdir().unwrap();

        let result = save_pasted_image(
            path_to_string(project.path()),
            BASE64.encode(b"bmp"),
            "bmp".into(),
        );

        assert!(matches!(result, Err(AppError::InvalidPath(_))));
    }

    // Un portapapeles sin imagen real no debe dejar un fichero vacío en
    // `images/` que luego rompa la compilación.
    #[test]
    fn save_pasted_image_rechaza_datos_vacios() {
        let project = tempfile::tempdir().unwrap();

        let result = save_pasted_image(path_to_string(project.path()), String::new(), "png".into());

        assert!(result.is_err());
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
    fn copy_asset_into_project_reusa_una_copia_existente_con_el_mismo_contenido() {
        let project = tempfile::tempdir().unwrap();
        fs::create_dir_all(project.path().join("images")).unwrap();
        fs::write(project.path().join("images/diagrama.png"), "mismo contenido").unwrap();

        // Mismo contenido, nombre de origen DISTINTO — el usuario seleccionó
        // la imagen dos veces (o la arrastró dos veces) desde dos sitios.
        let source_dir = tempfile::tempdir().unwrap();
        let source = source_dir.path().join("otro-nombre.png");
        fs::write(&source, "mismo contenido").unwrap();

        let relative =
            copy_asset_into_project(path_to_string(project.path()), path_to_string(&source)).unwrap();

        // Reutiliza la copia ya existente en vez de crear diagrama-1.png.
        assert_eq!(relative, "images/diagrama.png");
        assert_eq!(
            fs::read_dir(project.path().join("images")).unwrap().count(),
            1
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
    fn copy_font_into_project_reusa_una_copia_existente_con_el_mismo_contenido() {
        let project = tempfile::tempdir().unwrap();
        fs::create_dir_all(project.path().join("fonts")).unwrap();
        fs::write(project.path().join("fonts/MiFuente.otf"), "mismo contenido").unwrap();

        let source_dir = tempfile::tempdir().unwrap();
        let source = source_dir.path().join("copia-de-mi-fuente.otf");
        fs::write(&source, "mismo contenido").unwrap();

        let relative =
            copy_font_into_project(path_to_string(project.path()), path_to_string(&source)).unwrap();

        assert_eq!(relative, "fonts/MiFuente.otf");
        assert_eq!(
            fs::read_dir(project.path().join("fonts")).unwrap().count(),
            1
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

    // ─── RF-17: imágenes del proyecto ────────────────────────────────────────

    fn png(dir: &Path, name: &str) -> PathBuf {
        let path = dir.join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&path, b"no-es-un-png-real-pero-basta").unwrap();
        path
    }

    #[test]
    fn project_images_encuentra_imagenes_en_subcarpetas_y_ancla_a_la_raiz() {
        let dir = tempfile::tempdir().unwrap();
        png(dir.path(), "images/grafico.png");
        png(dir.path(), "chapters/figuras/esquema.svg");

        let images = project_images(dir.path().to_string_lossy().to_string()).unwrap();

        let paths: Vec<&str> = images.iter().map(|image| image.path.as_str()).collect();
        assert_eq!(paths, vec!["/chapters/figuras/esquema.svg", "/images/grafico.png"]);
        assert_eq!(images[1].name, "grafico.png");
    }

    #[test]
    fn project_images_ignora_el_ruido_de_repositorio_y_las_carpetas_ocultas() {
        let dir = tempfile::tempdir().unwrap();
        png(dir.path(), "images/buena.png");
        png(dir.path(), ".git/objects/basura.png");
        png(dir.path(), "node_modules/paquete/logo.png");
        png(dir.path(), ".vscode/icono.png");

        let images = project_images(dir.path().to_string_lossy().to_string()).unwrap();

        assert_eq!(images.len(), 1, "solo la imagen del proyecto: {images:?}");
        assert_eq!(images[0].path, "/images/buena.png");
    }

    #[test]
    fn project_images_descarta_lo_que_no_es_una_imagen_de_typst() {
        let dir = tempfile::tempdir().unwrap();
        png(dir.path(), "images/valida.png");
        fs::write(dir.path().join("main.typ"), "= Hola").unwrap();
        fs::write(dir.path().join("images/mapa.bmp"), b"x").unwrap();

        let images = project_images(dir.path().to_string_lossy().to_string()).unwrap();

        assert_eq!(images.len(), 1);
        assert_eq!(images[0].name, "valida.png");
    }

    #[test]
    fn project_images_sin_imagenes_devuelve_lista_vacia_no_error() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), "= Hola").unwrap();

        let images = project_images(dir.path().to_string_lossy().to_string()).unwrap();

        assert!(images.is_empty());
    }

    #[test]
    fn project_images_rechaza_una_ruta_que_no_es_carpeta() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("main.typ");
        fs::write(&file, "= Hola").unwrap();

        let result = project_images(file.to_string_lossy().to_string());

        assert!(matches!(result, Err(AppError::InvalidPath(_))));
    }

    #[test]
    fn project_images_no_desciende_mas_alla_del_limite_de_profundidad() {
        let dir = tempfile::tempdir().unwrap();
        let profunda = (0..MAX_SCAN_DEPTH + 2).map(|_| "n").collect::<Vec<_>>().join("/");
        png(dir.path(), &format!("{profunda}/lejos.png"));
        png(dir.path(), "cerca.png");

        let images = project_images(dir.path().to_string_lossy().to_string()).unwrap();

        assert_eq!(images.len(), 1);
        assert_eq!(images[0].name, "cerca.png");
    }

    #[test]
    fn copy_asset_into_project_rechaza_un_fichero_que_no_es_imagen_de_typst() {
        // Antes de RF-18 el frontend era el único filtro y aceptaba `.bmp`.
        let dir = tempfile::tempdir().unwrap();
        let root = tempfile::tempdir().unwrap();
        let mapa = dir.path().join("mapa.bmp");
        fs::write(&mapa, b"x").unwrap();

        let result = copy_asset_into_project(
            root.path().to_string_lossy().to_string(),
            mapa.to_string_lossy().to_string(),
        );

        assert!(matches!(result, Err(AppError::InvalidPath(_))));
    }

    #[test]
    fn supported_asset_extensions_sirve_las_dos_listas_reales() {
        let extensions = supported_asset_extensions();

        assert!(extensions.images.contains(&"png".to_string()));
        assert!(!extensions.images.contains(&"bmp".to_string()));
        assert!(extensions.fonts.contains(&"ttf".to_string()));
    }
}
