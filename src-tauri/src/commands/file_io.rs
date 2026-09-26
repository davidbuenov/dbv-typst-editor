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
pub const COMPANION_EXTENSIONS: &[&str] = &[
    // Bibliografía y configuración del proyecto.
    "bib", "toml", "yml", "yaml", "json", "csv", "tsv", "txt", "md", "xml", "ini", "cfg",
    // Código que un documento suele incrustar con `read()` o `raw()` (RF-60).
    "c", "h", "cpp", "hpp", "cc", "cs", "java", "kt", "py", "rs", "go", "js", "ts", "tsx", "jsx",
    "rb", "php", "swift", "sh", "bash", "ps1", "sql", "lua", "r", "html", "css", "scss", "tex",
    "log", "bat", "pl",
];

/// Tamaño máximo de un fichero de texto que se abre en el editor. Por encima, un
/// editor de texto en pantalla se vuelve inservible y casi seguro no es texto.
pub const MAX_TEXT_BYTES: u64 = 5 * 1024 * 1024;

/// Cuántos bytes iniciales se miran buscando un NUL para decidir si es binario.
const BINARY_SNIFF_BYTES: usize = 8 * 1024;

const UTF8_BOM: &[u8] = &[0xEF, 0xBB, 0xBF];

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
    /// Huella del contenido en disco al leerlo (RF-68). Es lo que decide si un
    /// aviso del observador es un cambio real o solo un toque de atributos.
    pub content_hash: String,
}

/// Lo que devuelve una escritura: la marca de tiempo y la huella de los bytes
/// que de verdad llegaron a disco (con el formato original conservado, RF-60.5).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteReceipt {
    pub modified_ms: u64,
    pub content_hash: String,
}

/// Estado actual de un fichero en disco, sin devolver su contenido (RF-68).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fingerprint {
    /// El fichero ya no existe (borrado o movido por otro programa).
    pub missing: bool,
    pub modified_ms: u64,
    pub content_hash: Option<String>,
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

/// Carpetas que no forman parte del contenido de un proyecto y que ningún
/// recorrido debe pisar: repositorio y artefactos de herramientas. Vive aquí,
/// junto al resto de criterios de ruta compartidos, para que el filtro del
/// watcher y el escaneo de recursos no puedan divergir.
pub const NOISE_DIRS: [&str; 4] = [".git", "node_modules", "target", ".svn"];

/// True si `name` es una de las carpetas de ruido de `NOISE_DIRS`.
pub fn is_noise_dir(name: &str) -> bool {
    NOISE_DIRS.contains(&name)
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

/// Huella del contenido (RF-68): un hash rápido de 64 bits en hexadecimal.
///
/// No es criptográfico ni estable entre versiones de Rust, y no hace falta: solo
/// se compara con otra huella calculada en la MISMA ejecución de la aplicación.
/// Se devuelve como cadena porque un `u64` no cabe sin pérdida en un número de JS.
pub fn content_hash(bytes: &[u8]) -> String {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    bytes.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
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
///
/// `pub(crate)`: también la usa `archive.rs` para no empaquetar ruido de
/// repositorio en el Project Archive (§7.12) — un solo criterio compartido,
/// igual que `has_extension` para el filtro del diálogo y el explorador.
pub(crate) fn is_noise(name: &str) -> bool {
    // `.dbv-preview.typ` es el espejo transitorio del documento con cambios sin
    // guardar que compila la vista previa (typst_engine::compile): existe unos
    // milisegundos y no es contenido del proyecto.
    matches!(name, ".git" | ".svn" | "node_modules" | ".DS_Store" | "target")
        || name.starts_with(".dbv-preview")
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

fn is_typst_path(path: &Path) -> bool {
    path.file_name().is_some_and(|name| has_extension(&name.to_string_lossy(), &TYPST_EXTENSIONS))
}

fn too_large(size: u64) -> AppError {
    AppError::Denied(format!(
        "El fichero pesa {:.1} MB y el editor solo abre ficheros de texto de hasta {} MB.",
        size as f64 / 1_048_576.0,
        MAX_TEXT_BYTES / 1_048_576
    ))
}

/// Decodifica los bytes de un fichero de texto que NO es Typst (RF-60): rechaza lo
/// demasiado grande, lo binario (un NUL al principio) y lo que no es UTF-8 — abrirlo
/// "con pérdida" y guardarlo destrozaría el original en silencio. Quita el BOM UTF-8
/// para que no aparezca como un carácter invisible en el editor.
pub fn decode_text(bytes: &[u8]) -> Result<String, AppError> {
    if bytes.len() as u64 > MAX_TEXT_BYTES {
        return Err(too_large(bytes.len() as u64));
    }
    if bytes.iter().take(BINARY_SNIFF_BYTES).any(|&b| b == 0) {
        return Err(AppError::Denied(
            "El fichero parece binario (contiene bytes nulos): no se abre como texto.".into(),
        ));
    }
    let body = bytes.strip_prefix(UTF8_BOM).unwrap_or(bytes);
    String::from_utf8(body.to_vec()).map_err(|_| {
        AppError::Denied("El fichero no está en UTF-8: abrirlo y guardarlo lo estropearía.".into())
    })
}

fn read_text_guarded(path: &Path) -> Result<String, AppError> {
    // Se mira el tamaño antes de leer: un fichero enorme no se carga en memoria.
    let size = fs::metadata(path).map_err(|e| AppError::Io(e.to_string()))?.len();
    if size > MAX_TEXT_BYTES {
        return Err(too_large(size));
    }
    decode_text(&fs::read(path).map_err(|e| AppError::Io(e.to_string()))?)
}

/// Devuelve `content` con el formato del fichero que ya hay en `path` (RF-60.2):
/// si tenía BOM UTF-8 o saltos CRLF, se conservan al guardar, para que abrir y
/// guardar un fichero ajeno no reescriba todas sus líneas. El editor trabaja
/// siempre con `\n`. Solo se aplica a lo que no es Typst.
pub fn with_original_format(path: &Path, content: &str) -> String {
    if is_typst_path(path) {
        return content.to_string();
    }
    let Ok(existing) = fs::read(path) else { return content.to_string() };
    if existing.len() as u64 > MAX_TEXT_BYTES {
        return content.to_string();
    }
    let crlf = existing.windows(2).filter(|w| *w == b"\r\n").count();
    let lf_only = existing.iter().filter(|&&b| b == b'\n').count().saturating_sub(crlf);
    let mut out = if crlf > lf_only && !content.contains('\r') {
        content.replace('\n', "\r\n")
    } else {
        content.to_string()
    };
    if existing.starts_with(UTF8_BOM) {
        out.insert(0, '\u{FEFF}');
    }
    out
}

/// Lee un fichero de texto del proyecto.
#[tauri::command]
pub fn read_file(path: String) -> Result<FilePayload, AppError> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.is_file() {
        return Err(AppError::NotFound(path));
    }

    let canonical = dunce::canonicalize(&path_buf).map_err(|e| AppError::Io(e.to_string()))?;
    let content = if is_typst_path(&canonical) {
        fs::read_to_string(&canonical).map_err(|e| AppError::Io(e.to_string()))?
    } else {
        read_text_guarded(&canonical)?
    };
    // Se relee en bytes para la huella: `content` ya no lleva el BOM ni, en su
    // caso, es byte a byte lo que hay en disco, y la huella debe ser la del disco.
    let disk_bytes = fs::read(&canonical).map_err(|e| AppError::Io(e.to_string()))?;

    let payload = FilePayload {
        file_name: canonical
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| "documento.typ".to_string()),
        dir_path: canonical.parent().map(path_to_string).unwrap_or_default(),
        modified_ms: modified_ms(&canonical),
        content_hash: content_hash(&disk_bytes),
        path: path_to_string(&canonical),
        content,
    };
    Ok(payload)
}

use std::sync::atomic::{AtomicU64, Ordering};

static TMP_SEQ: AtomicU64 = AtomicU64::new(0);

/// Escribe el contenido en un archivo de forma atómica:
/// 1. Escribe en un fichero temporal oculto en la misma carpeta (`.nombre.seq.dbv-tmp`).
/// 2. Lo renombra al destino (`fs::rename`).
/// 3. Si el renombrado falla (por antivirus o bloqueo transitorio en Windows), reintenta
///    hasta 3 veces espaciando 15ms.
/// 4. Como salvaguarda final para nunca perder el trabajo del usuario, escribe directamente al destino.
pub fn write_atomic(path: &Path, content: &str) -> Result<(), std::io::Error> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".to_string());
    let seq = TMP_SEQ.fetch_add(1, Ordering::Relaxed);
    let tmp_path = parent.join(format!(".{name}.{seq}.dbv-tmp"));

    if let Err(e) = fs::write(&tmp_path, content) {
        // Si no se pudo crear el archivo temporal, escribir directamente al destino.
        return fs::write(path, content).map_err(|_| e);
    }

    let mut last_err = None;
    for attempt in 0..3 {
        match fs::rename(&tmp_path, path) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = Some(e);
                if attempt < 2 {
                    std::thread::sleep(std::time::Duration::from_millis(15));
                }
            }
        }
    }

    let _ = fs::remove_file(&tmp_path);

    // Fallback de seguridad: escribir directamente al destino si rename no tuvo éxito.
    if let Err(direct_err) = fs::write(path, content) {
        Err(last_err.unwrap_or(direct_err))
    } else {
        Ok(())
    }
}

/// Escribe `content` en `path` de forma atómica y devuelve la nueva marca de
/// modificación y la huella de lo escrito, para que el frontend actualice su
/// referencia de conflicto (RF-68) sin releer.
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<WriteReceipt, AppError> {
    let path_buf = PathBuf::from(&path);
    let parent_missing = path_buf
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .is_some_and(|parent| !parent.is_dir());
    if parent_missing {
        return Err(AppError::InvalidPath(path));
    }

    let content = with_original_format(&path_buf, &content);
    write_atomic(&path_buf, &content).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(WriteReceipt { modified_ms: modified_ms(&path_buf), content_hash: content_hash(content.as_bytes()) })
}

/// Huella actual de `path` (RF-68). Un fichero que ya no existe NO es un error:
/// es un estado que el frontend tiene que poder distinguir (el documento abierto
/// fue borrado o movido por otro programa).
#[tauri::command]
pub fn file_fingerprint(path: String) -> Result<Fingerprint, AppError> {
    let path_buf = PathBuf::from(&path);
    if !path_buf.is_file() {
        return Ok(Fingerprint { missing: true, modified_ms: 0, content_hash: None });
    }
    let bytes = fs::read(&path_buf).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(Fingerprint {
        missing: false,
        modified_ms: modified_ms(&path_buf),
        content_hash: Some(content_hash(&bytes)),
    })
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

        let receipt = write_file(path_to_string(&target), "contenido".into()).unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "contenido");
        assert!(receipt.modified_ms > 0);
        assert_eq!(receipt.content_hash, content_hash(b"contenido"));
    }

    // RF-68: la huella de lo escrito debe coincidir con la que se lee después,
    // también cuando el guardado conserva CRLF y BOM de un fichero ajeno —
    // si no, el propio guardado se vería como un cambio externo.
    #[test]
    fn la_huella_escrita_coincide_con_la_leida_aunque_se_conserve_crlf_y_bom() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("refs.bib");
        fs::write(&target, b"\xEF\xBB\xBF@book{a,\r\n  title={X}\r\n}\r\n").unwrap();

        let receipt = write_file(path_to_string(&target), "@book{a,\n  title={Y}\n}\n".into()).unwrap();
        let read = read_file(path_to_string(&target)).unwrap();
        let fingerprint = file_fingerprint(path_to_string(&target)).unwrap();

        assert_eq!(read.content_hash, receipt.content_hash);
        assert_eq!(fingerprint.content_hash.as_deref(), Some(receipt.content_hash.as_str()));
        assert!(!fingerprint.missing);
    }

    #[test]
    fn la_huella_distingue_contenidos_y_no_cambia_si_solo_cambia_la_fecha() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("cap.typ");
        fs::write(&target, "= Uno").unwrap();
        let before = file_fingerprint(path_to_string(&target)).unwrap();

        // Reescribir el MISMO contenido (lo que hace un antivirus o un cliente de
        // sincronización al tocar el fichero) no cambia la huella.
        fs::write(&target, "= Uno").unwrap();
        assert_eq!(file_fingerprint(path_to_string(&target)).unwrap().content_hash, before.content_hash);

        fs::write(&target, "= Dos").unwrap();
        assert_ne!(file_fingerprint(path_to_string(&target)).unwrap().content_hash, before.content_hash);
    }

    #[test]
    fn la_huella_de_un_fichero_ausente_no_es_un_error_sino_missing() {
        let dir = tempfile::tempdir().unwrap();
        let fingerprint = file_fingerprint(path_to_string(&dir.path().join("borrado.typ"))).unwrap();
        assert!(fingerprint.missing);
        assert_eq!(fingerprint.content_hash, None);
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

    #[test]
    fn write_atomic_crea_y_sobrescribe_sin_dejar_temporales() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("documento.typ");

        write_atomic(&target, "primera versión").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "primera versión");

        write_atomic(&target, "segunda versión actualizada").unwrap();
        assert_eq!(fs::read_to_string(&target).unwrap(), "segunda versión actualizada");

        // Comprobar que no quedan ficheros temporales huérfanos
        let entries: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(entries, vec!["documento.typ".to_string()]);
    }

    #[test]
    fn los_ficheros_de_codigo_pedidos_son_editables_y_los_binarios_no() {
        for name in ["main.cpp", "Main.java", "script.py", "lib.h", "notas.txt", "datos.json", "A.CPP"] {
            assert!(has_extension(name, COMPANION_EXTENSIONS), "{name} debería ser editable");
        }
        for name in ["logo.png", "manual.pdf", "app.exe", "libro.zip", "fuente.ttf"] {
            assert!(!has_extension(name, COMPANION_EXTENSIONS), "{name} no debería ser editable");
        }
    }

    #[test]
    fn decode_text_acepta_utf8_y_quita_el_bom() {
        assert_eq!(decode_text("hola ñ".as_bytes()).unwrap(), "hola ñ");
        assert_eq!(decode_text(b"\xEF\xBB\xBFabc").unwrap(), "abc");
    }

    #[test]
    fn decode_text_rechaza_binario_no_utf8_y_demasiado_grande() {
        assert!(matches!(decode_text(b"ab\0cd"), Err(AppError::Denied(m)) if m.contains("binario")));
        assert!(matches!(decode_text(&[0xC3, 0x28]), Err(AppError::Denied(m)) if m.contains("UTF-8")));
        let big = vec![b'a'; (MAX_TEXT_BYTES + 1) as usize];
        assert!(matches!(decode_text(&big), Err(AppError::Denied(m)) if m.contains("MB")));
    }

    #[test]
    fn read_file_de_codigo_aplica_las_guardas_y_typst_no_cambia() {
        let dir = tempfile::tempdir().unwrap();
        let bin = dir.path().join("dato.cpp");
        fs::write(&bin, b"int\0main").unwrap();
        assert!(matches!(read_file(path_to_string(&bin)), Err(AppError::Denied(_))));

        let ok = dir.path().join("a.cpp");
        fs::write(&ok, b"\xEF\xBB\xBFint main() {}\r\n").unwrap();
        assert_eq!(read_file(path_to_string(&ok)).unwrap().content, "int main() {}\r\n");

        let typ = dir.path().join("a.typ");
        fs::write(&typ, "\u{FEFF}= T").unwrap();
        assert_eq!(read_file(path_to_string(&typ)).unwrap().content, "\u{FEFF}= T");
    }

    #[test]
    fn guardar_conserva_crlf_y_bom_del_original_en_ficheros_que_no_son_typst() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.cpp");
        fs::write(&path, b"\xEF\xBB\xBFuno\r\ndos\r\n").unwrap();

        write_file(path_to_string(&path), "uno\ndos\ntres\n".into()).unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"\xEF\xBB\xBFuno\r\ndos\r\ntres\r\n");
    }

    #[test]
    fn guardar_no_inventa_crlf_ni_bom_en_un_fichero_lf() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.py");
        fs::write(&path, "uno\ndos\n").unwrap();

        write_file(path_to_string(&path), "uno\ndos\ntres\n".into()).unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"uno\ndos\ntres\n");
    }

    #[test]
    fn un_fichero_nuevo_se_guarda_tal_cual() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nuevo.cpp");

        write_file(path_to_string(&path), "a\nb\n".into()).unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"a\nb\n");
    }

    #[test]
    fn un_fichero_typst_no_se_convierte_al_guardar() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.typ");
        fs::write(&path, "uno\r\ndos\r\n").unwrap();

        write_file(path_to_string(&path), "uno\ndos\n".into()).unwrap();

        assert_eq!(fs::read(&path).unwrap(), b"uno\ndos\n");
    }
}
