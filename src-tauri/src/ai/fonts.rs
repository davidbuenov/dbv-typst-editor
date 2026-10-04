// =============================================================================
// DBV Typst Editor — Fuentes que la IA añade al proyecto (RF-111, RNF-IA.9)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Un documento que pide una fuente que el equipo no tiene compila con un aviso
// (`unknown font family`) y se ve con otra. La IA —solo con una conexión en la
// nube— puede proponer añadir la fuente DENTRO DEL PROYECTO (`fonts/`, que los dos
// motores ya leen y que el `.dbvt` ya incluye): el documento queda portable y no
// se toca el sistema.
//
// Reglas (ADR-V0140-002, D6 y D9):
//   · Un único origen, `google/fonts` por `raw.githubusercontent.com`: su
//     `METADATA.pb` trae la licencia y los ficheros. La API de GitHub sin clave
//     limita a 60 peticiones/hora, así que no se usa.
//   · Solo licencias libres de redistribución: OFL, Apache 2.0 y UFL.
//   · Solo `.ttf`/`.otf`/`.ttc` (lo que Typst lee), como mucho 25 MB cada una.
//   · El modelo da un NOMBRE de familia, nunca una URL: DBV construye todas las URL.
//   · Se instala solo tras el clic del usuario (RNF-IA.9.4), y vuelve a derivar las
//     URL por su cuenta en vez de fiarse de lo que le pase el frontend.
//   · No se crea `fonts/` en silencio si hay `TYPST_FONT_PATHS`: con la carpeta,
//     Typst ignora esa variable en este proyecto (`project_font_paths`).

use std::io::Read;
use std::path::Path;
use std::time::Duration;

use serde::Serialize;

use super::AiError;

/// El único origen de fuentes.
pub const ORIGIN: &str = "https://raw.githubusercontent.com/google/fonts/main";
/// Carpetas de `google/fonts` y la licencia que `METADATA.pb` debe declarar en cada una.
const LICENSE_DIRS: [(&str, &str); 3] = [("ofl", "OFL"), ("apache", "APACHE2"), ("ufl", "UFL")];
/// Tamaño máximo de un fichero de fuente.
pub const MAX_FONT_BYTES: u64 = 25 * 1024 * 1024;
const MAX_FILES: usize = 12;
const FONT_EXTENSIONS: [&str; 3] = ["ttf", "otf", "ttc"];

/// Un fichero de fuente ofrecido.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontFile {
    pub name: String,
    pub size: Option<u64>,
}

/// Lo que se le enseña al usuario antes de instalar nada.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontOffer {
    pub family: String,
    pub slug: String,
    /// `OFL`, `APACHE2` o `UFL`.
    pub license: String,
    pub files: Vec<FontFile>,
    /// Suma de los tamaños conocidos.
    pub total_bytes: u64,
    /// Ficha del origen (carpeta en GitHub, con la licencia y los ficheros).
    pub page: String,
}

/// `Open Sans` → `opensans`: así se llaman las carpetas de `google/fonts`. `None` si no es un nombre de familia razonable.
pub fn slug(family: &str) -> Option<String> {
    let trimmed = family.trim();
    let ok_chars = trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == ' ' || c == '-' || c == '_');
    let slug: String = trimmed.chars().filter(char::is_ascii_alphanumeric).map(|c| c.to_ascii_lowercase()).collect();
    (ok_chars && !slug.is_empty() && slug.len() <= 50 && trimmed.len() <= 60).then_some(slug)
}

/// ¿Un nombre de fichero de fuente seguro para escribir en `fonts/`?
pub fn is_safe_font_name(name: &str) -> bool {
    let extension = name.rsplit_once('.').map(|(_, ext)| ext.to_ascii_lowercase()).unwrap_or_default();
    let clean = !name.is_empty()
        && name.len() <= 100
        && !name.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0'])
        && !name.contains("..")
        && !name.starts_with('.');
    clean && FONT_EXTENSIONS.contains(&extension.as_str())
}

/// Codifica un componente de URL (`Inter[opsz,wght].ttf` → `Inter%5Bopsz%2Cwght%5D.ttf`).
fn percent_encode(text: &str) -> String {
    text.bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (byte as char).to_string(),
            other => format!("%{other:02X}"),
        })
        .collect()
}

/// Lo que importa de un `METADATA.pb` de `google/fonts`: la licencia y los nombres de fichero.
#[derive(Debug, PartialEq)]
pub struct Metadata {
    pub name: String,
    pub license: String,
    pub files: Vec<String>,
}

/// Lee el `METADATA.pb` (formato de texto de protobuf): `license: "OFL"` y cada `filename: "…"`.
pub fn parse_metadata(text: &str) -> Metadata {
    let mut name = String::new();
    let mut license = String::new();
    let mut files: Vec<String> = Vec::new();
    for line in text.lines() {
        let indented = line.starts_with(' ') || line.starts_with('\t');
        let trimmed = line.trim();
        let value = |key: &str| trimmed.strip_prefix(key).map(|rest| rest.trim().trim_matches('"').to_string());
        if !indented {
            if name.is_empty() {
                if let Some(v) = value("name:") {
                    name = v;
                }
            }
            if license.is_empty() {
                if let Some(v) = value("license:") {
                    license = v;
                }
            }
        }
        if let Some(file) = value("filename:") {
            if !files.contains(&file) {
                files.push(file);
            }
        }
    }
    Metadata { name, license, files }
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder().timeout_global(Some(Duration::from_secs(90))).http_status_as_error(false).build().new_agent()
}

fn get_text(base: &str, path: &str) -> Result<Option<String>, AiError> {
    let url = format!("{}/{path}", base.trim_end_matches('/'));
    let mut response = agent().get(&url).call().map_err(|error| AiError::Network(format!("no se pudo consultar el origen de fuentes: {error}")))?;
    match response.status().as_u16() {
        200 => Ok(Some(response.body_mut().read_to_string().map_err(|error| AiError::Network(error.to_string()))?)),
        404 => Ok(None),
        status => Err(AiError::Network(format!("el origen de fuentes respondió {status}"))),
    }
}

fn remote_size(url: &str) -> Option<u64> {
    let response = agent().head(url).call().ok()?;
    // La cabecera, no `body().content_length()`: en una respuesta a HEAD no hay cuerpo del que medir.
    response.status().as_u16().eq(&200).then(|| response.headers().get("content-length")?.to_str().ok()?.parse().ok()).flatten()
}

/// Busca la familia en el origen y construye lo que se le enseña al usuario. NO descarga ninguna fuente.
pub fn fetch_offer(base: &str, family: &str) -> Result<FontOffer, AiError> {
    let family = family.trim();
    let slug = slug(family).ok_or_else(|| AiError::BadRequest(format!("«{family}» no es un nombre de familia de fuente válido")))?;
    for (dir, expected) in LICENSE_DIRS {
        let Some(text) = get_text(base, &format!("{dir}/{slug}/METADATA.pb"))? else { continue };
        let metadata = parse_metadata(&text);
        if metadata.license != expected {
            return Err(AiError::BadRequest(format!("la licencia de «{family}» ({}) no es una de las admitidas (OFL, Apache 2.0, UFL)", metadata.license)));
        }
        let names: Vec<String> = metadata.files.into_iter().filter(|name| is_safe_font_name(name)).take(MAX_FILES).collect();
        if names.is_empty() {
            return Err(AiError::NotFound(format!("«{family}» no tiene ficheros .ttf/.otf que Typst pueda usar")));
        }
        let mut files = Vec::new();
        for name in names {
            let size = remote_size(&file_url(base, dir, &slug, &name));
            if size.is_some_and(|bytes| bytes > MAX_FONT_BYTES) {
                return Err(AiError::BadRequest(format!("{name} pesa más de {} MB: no se ofrece", MAX_FONT_BYTES / 1024 / 1024)));
            }
            files.push(FontFile { name, size });
        }
        let total_bytes = files.iter().filter_map(|file| file.size).sum();
        return Ok(FontOffer {
            family: if metadata.name.is_empty() { family.to_string() } else { metadata.name },
            slug: slug.clone(),
            license: expected.to_string(),
            files,
            total_bytes,
            page: format!("https://github.com/google/fonts/tree/main/{dir}/{slug}"),
        });
    }
    Err(AiError::NotFound(format!("«{family}» no está en Google Fonts con una licencia libre (OFL, Apache 2.0 o UFL)")))
}

fn file_url(base: &str, dir: &str, slug: &str, name: &str) -> String {
    format!("{}/{dir}/{slug}/{}", base.trim_end_matches('/'), percent_encode(name))
}

/// Dónde quedaría la carpeta de fuentes y qué hay que saber antes de crearla.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontsFolderStatus {
    pub exists: bool,
    /// `TYPST_FONT_PATHS` definida y sin `fonts/` en el proyecto: crearla haría que Typst la ignore aquí.
    pub shadows_env_paths: bool,
}

/// Estado de `fonts/` del proyecto. `env_paths` es el valor de `TYPST_FONT_PATHS` (inyectable para probar).
pub fn folder_status(root: &Path, env_paths: Option<&std::ffi::OsStr>) -> FontsFolderStatus {
    let exists = root.join("fonts").is_dir();
    let has_env = env_paths.is_some_and(|value| std::env::split_paths(value).any(|path| !path.as_os_str().is_empty()));
    FontsFolderStatus { exists, shadows_env_paths: !exists && has_env }
}

/// Lo que se hizo al instalar.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallReport {
    pub installed: Vec<String>,
    /// Ya estaban en `fonts/`: no se pisan.
    pub skipped: Vec<String>,
    pub created_folder: bool,
}

fn download(url: &str) -> Result<Vec<u8>, AiError> {
    let response = agent().get(url).call().map_err(|error| AiError::Network(format!("no se pudo descargar la fuente: {error}")))?;
    if response.status().as_u16() != 200 {
        return Err(AiError::Network(format!("el origen respondió {} al descargar la fuente", response.status().as_u16())));
    }
    let mut bytes = Vec::new();
    response.into_body().into_reader().take(MAX_FONT_BYTES + 1).read_to_end(&mut bytes).map_err(|error| AiError::Network(error.to_string()))?;
    if bytes.len() as u64 > MAX_FONT_BYTES {
        return Err(AiError::BadRequest(format!("la fuente pesa más de {} MB", MAX_FONT_BYTES / 1024 / 1024)));
    }
    Ok(bytes)
}

/// Instala la familia en `<root>/fonts/`. Vuelve a derivar las URL desde el origen (no se fía de lo que
/// llegue del frontend) y nunca pisa un fichero que ya está.
pub fn install_family(base: &str, root: &Path, family: &str, create_anyway: bool, env_paths: Option<&std::ffi::OsStr>) -> Result<InstallReport, AiError> {
    if !root.is_dir() {
        return Err(AiError::BadRequest("la carpeta del proyecto no existe".into()));
    }
    let status = folder_status(root, env_paths);
    if status.shadows_env_paths && !create_anyway {
        return Err(AiError::Config("TYPST_FONT_PATHS está definida: con una carpeta fonts/ Typst la ignora en este proyecto. Confirma que quieres crearla.".into()));
    }
    let offer = fetch_offer(base, family)?;
    let dir = LICENSE_DIRS.iter().map(|(dir, _)| *dir).find(|dir| LICENSE_DIRS.iter().any(|(d, tag)| d == dir && *tag == offer.license)).unwrap_or("ofl");
    let fonts = root.join("fonts");
    let created_folder = !fonts.is_dir();
    std::fs::create_dir_all(&fonts).map_err(|error| AiError::Config(error.to_string()))?;
    let mut report = InstallReport { installed: Vec::new(), skipped: Vec::new(), created_folder };
    for file in &offer.files {
        let target = fonts.join(&file.name);
        if target.exists() {
            report.skipped.push(file.name.clone());
            continue;
        }
        let bytes = match download(&file_url(base, dir, &offer.slug, &file.name)) {
            Ok(bytes) => bytes,
            Err(error) => {
                // Que no quede a medias: lo ya instalado en esta llamada se quita.
                let _ = remove_files(root, &report.installed, created_folder);
                return Err(error);
            }
        };
        let temporary = fonts.join(format!("{}.part", file.name));
        std::fs::write(&temporary, &bytes).and_then(|_| std::fs::rename(&temporary, &target)).map_err(|error| AiError::Config(error.to_string()))?;
        report.installed.push(file.name.clone());
    }
    Ok(report)
}

/// Quita de `fonts/` SOLO los ficheros dados (Deshacer) y, si se creó la carpeta y queda vacía, la carpeta.
pub fn remove_files(root: &Path, names: &[String], remove_folder_if_empty: bool) -> Result<usize, AiError> {
    let fonts = root.join("fonts");
    let mut removed = 0;
    for name in names.iter().filter(|name| is_safe_font_name(name)) {
        let path = fonts.join(name);
        if path.is_file() && std::fs::remove_file(&path).is_ok() {
            removed += 1;
        }
    }
    if remove_folder_if_empty && fonts.is_dir() && std::fs::read_dir(&fonts).map(|mut entries| entries.next().is_none()).unwrap_or(false) {
        let _ = std::fs::remove_dir(&fonts);
    }
    Ok(removed)
}

/// Una familia que el compilador conoce.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontFamily {
    pub name: String,
    /// Viene de `fonts/` del proyecto (si no, del sistema o de las incluidas con Typst).
    pub project: bool,
}

/// Familias disponibles para este proyecto, filtradas por `query`, ordenadas y acotadas.
pub fn list_families(root: &Path, query: &str) -> Vec<FontFamily> {
    let store = crate::engine::world::font_store(root);
    let mut project = std::collections::HashSet::new();
    let local = root.join("fonts");
    if local.is_dir() {
        let mut only = typst_kit::fonts::FontStore::new();
        only.extend(typst_kit::fonts::scan(&local));
        project.extend(only.book().families().map(|(name, _)| name.to_lowercase()));
    }
    let needle = query.trim().to_lowercase();
    let mut families: Vec<FontFamily> = store
        .book()
        .families()
        .map(|(name, _)| FontFamily { name: name.to_string(), project: project.contains(&name.to_lowercase()) })
        .filter(|family| needle.is_empty() || family.name.to_lowercase().contains(&needle))
        .collect();
    families.sort_by_key(|family| family.name.to_lowercase());
    families.dedup_by(|a, b| a.name.eq_ignore_ascii_case(&b.name));
    families
}

// ----------------------------------------------------------------------------- comandos

/// Qué se ofrecería de una familia (consulta el origen; no descarga ninguna fuente).
#[tauri::command]
pub async fn ai_font_offer(family: String) -> Result<FontOffer, AiError> {
    tauri::async_runtime::spawn_blocking(move || fetch_offer(ORIGIN, &family)).await.map_err(|error| AiError::Server(error.to_string()))?
}

#[tauri::command]
pub fn ai_font_status(root: String) -> FontsFolderStatus {
    folder_status(Path::new(&root), std::env::var_os("TYPST_FONT_PATHS").as_deref())
}

/// Instala la familia en el proyecto. SOLO tras el clic del usuario (RNF-IA.9.4).
#[tauri::command]
pub async fn ai_font_install(root: String, family: String, create_anyway: bool) -> Result<InstallReport, AiError> {
    tauri::async_runtime::spawn_blocking(move || install_family(ORIGIN, Path::new(&root), &family, create_anyway, std::env::var_os("TYPST_FONT_PATHS").as_deref()))
        .await
        .map_err(|error| AiError::Server(error.to_string()))?
}

/// Deshacer: quita los ficheros que instaló la acción.
#[tauri::command]
pub fn ai_font_remove(root: String, files: Vec<String>, remove_folder: bool) -> Result<usize, AiError> {
    remove_files(Path::new(&root), &files, remove_folder)
}

/// Familias que el compilador conoce en este proyecto (herramienta `list_fonts`).
#[tauri::command]
pub fn ai_list_fonts(root: String, query: Option<String>) -> Vec<FontFamily> {
    list_families(Path::new(&root), query.as_deref().unwrap_or(""))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::io::Write;
    use std::net::TcpListener;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    const INTER: &str = "name: \"Inter\"\ndesigner: \"Rasmus Andersson\"\nlicense: \"OFL\"\ncategory: \"SANS_SERIF\"\nfonts {\n  name: \"Inter\"\n  style: \"normal\"\n  weight: 400\n  filename: \"Inter[opsz,wght].ttf\"\n  post_script_name: \"Inter-Regular\"\n}\nfonts {\n  name: \"Inter\"\n  style: \"italic\"\n  filename: \"Inter-Italic[opsz,wght].ttf\"\n}\n";

    /// Un servidor con rutas: `ruta → (estado, cuerpo)`. Cuenta las peticiones GET de cada ruta.
    fn serve(routes: Vec<(&'static str, u16, Vec<u8>)>) -> (String, Arc<AtomicUsize>, std::thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        let hits = Arc::new(AtomicUsize::new(0));
        let counter = hits.clone();
        let table: HashMap<&'static str, (u16, Vec<u8>)> = routes.into_iter().map(|(path, status, body)| (path, (status, body))).collect();
        let handle = std::thread::spawn(move || {
            let started = std::time::Instant::now();
            while started.elapsed() < Duration::from_secs(4) {
                let Ok((mut socket, _)) = listener.accept() else {
                    std::thread::sleep(Duration::from_millis(5));
                    continue;
                };
                socket.set_nonblocking(false).unwrap();
                let mut buffer = [0u8; 4096];
                let read = socket.read(&mut buffer).unwrap_or(0);
                let request = String::from_utf8_lossy(&buffer[..read]).to_string();
                let line = request.lines().next().unwrap_or_default().to_string();
                let (method, path) = (line.split(' ').next().unwrap_or_default(), line.split(' ').nth(1).unwrap_or_default().to_string());
                let (status, body) = table.get(path.as_str()).cloned().unwrap_or((404, Vec::new()));
                if method == "GET" {
                    counter.fetch_add(1, Ordering::SeqCst);
                }
                let head = format!("HTTP/1.1 {status} X\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
                let _ = socket.write_all(head.as_bytes());
                if method != "HEAD" {
                    let _ = socket.write_all(&body);
                }
            }
        });
        (address, hits, handle)
    }

    fn inter_routes() -> Vec<(&'static str, u16, Vec<u8>)> {
        vec![
            ("/ofl/inter/METADATA.pb", 200, INTER.as_bytes().to_vec()),
            ("/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf", 200, vec![1u8; 2048]),
            ("/ofl/inter/Inter-Italic%5Bopsz%2Cwght%5D.ttf", 200, vec![2u8; 1024]),
        ]
    }

    #[test]
    fn el_nombre_de_familia_se_convierte_en_la_carpeta_del_origen_y_lo_raro_se_rechaza() {
        assert_eq!(slug("Open Sans").as_deref(), Some("opensans"));
        assert_eq!(slug("  IBM Plex Sans ").as_deref(), Some("ibmplexsans"));
        assert_eq!(slug("Source Serif 4").as_deref(), Some("sourceserif4"));
        for bad in ["", "   ", "../etc", "Inter/../x", "a:b", "Inter?x=1", "https://evil.example", "x".repeat(70).as_str()] {
            assert_eq!(slug(bad), None, "{bad}");
        }
    }

    #[test]
    fn solo_se_escriben_ficheros_de_fuente_con_un_nombre_seguro() {
        for ok in ["Inter[opsz,wght].ttf", "Libertinus-Regular.otf", "Collection.ttc"] {
            assert!(is_safe_font_name(ok), "{ok}");
        }
        for bad in ["", "../x.ttf", "a/b.ttf", "a\\b.ttf", "C:evil.ttf", "x.woff2", "x.exe", "noext", ".oculto.ttf", "x..ttf", "a|b.ttf"] {
            assert!(!is_safe_font_name(bad), "{bad}");
        }
    }

    #[test]
    fn lee_la_licencia_y_los_ficheros_de_un_metadata_real() {
        let metadata = parse_metadata(INTER);
        assert_eq!(metadata, Metadata { name: "Inter".into(), license: "OFL".into(), files: vec!["Inter[opsz,wght].ttf".into(), "Inter-Italic[opsz,wght].ttf".into()] });
        assert_eq!(percent_encode("Inter[opsz,wght].ttf"), "Inter%5Bopsz%2Cwght%5D.ttf");
        // El `license:` de un bloque interior no cuenta como el de la familia.
        assert_eq!(parse_metadata("name: \"X\"\nfonts {\n  license: \"OTRA\"\n  filename: \"X.ttf\"\n}\nlicense: \"OFL\"\n").license, "OFL");
    }

    #[test]
    fn la_oferta_trae_licencia_ficheros_y_tamano_sin_descargar_ninguna_fuente() {
        let (base, hits, server) = serve(inter_routes());
        let offer = fetch_offer(&base, "Inter").unwrap();
        assert_eq!((offer.family.as_str(), offer.license.as_str(), offer.slug.as_str()), ("Inter", "OFL", "inter"));
        assert_eq!(offer.files.len(), 2);
        assert_eq!(offer.files[0], FontFile { name: "Inter[opsz,wght].ttf".into(), size: Some(2048) });
        assert_eq!(offer.total_bytes, 3072);
        assert_eq!(offer.page, "https://github.com/google/fonts/tree/main/ofl/inter");
        assert_eq!(hits.load(Ordering::SeqCst), 1, "solo se pidió el METADATA.pb (los tamaños salen de HEAD)");
        server.join().unwrap();
    }

    #[test]
    fn una_familia_inexistente_o_con_licencia_no_admitida_no_se_ofrece() {
        let (base, _hits, server) = serve(vec![("/ofl/cerrada/METADATA.pb", 200, b"name: \"Cerrada\"\nlicense: \"PROPRIETARY\"\nfonts {\n  filename: \"C.ttf\"\n}\n".to_vec())]);
        assert!(matches!(fetch_offer(&base, "No Existe Esta Familia"), Err(AiError::NotFound(_))));
        let error = fetch_offer(&base, "Cerrada").unwrap_err();
        assert!(matches!(&error, AiError::BadRequest(m) if m.contains("PROPRIETARY")), "{error:?}");
        server.join().unwrap();
    }

    #[test]
    fn un_nombre_de_familia_con_la_ruta_rota_no_llega_a_la_red() {
        let (base, hits, server) = serve(inter_routes());
        for bad in ["../../etc/passwd", "Inter/../../x", "https://evil.example/x", ""] {
            assert!(matches!(fetch_offer(&base, bad), Err(AiError::BadRequest(_))), "{bad}");
        }
        assert_eq!(hits.load(Ordering::SeqCst), 0);
        server.join().unwrap();
    }

    #[test]
    fn solo_se_ofrecen_ficheros_que_typst_lee_y_con_nombre_seguro() {
        let metadata = "name: \"Mixta\"\nlicense: \"OFL\"\nfonts {\n  filename: \"Mixta.ttf\"\n}\nfonts {\n  filename: \"Mixta.woff2\"\n}\nfonts {\n  filename: \"../escape.ttf\"\n}\n";
        let (base, _hits, server) = serve(vec![("/ofl/mixta/METADATA.pb", 200, metadata.as_bytes().to_vec()), ("/ofl/mixta/Mixta.ttf", 200, vec![0u8; 10])]);
        let offer = fetch_offer(&base, "Mixta").unwrap();
        assert_eq!(offer.files.iter().map(|f| f.name.as_str()).collect::<Vec<_>>(), vec!["Mixta.ttf"]);
        server.join().unwrap();
    }

    #[test]
    fn instalar_crea_fonts_descarga_los_ficheros_y_no_pisa_lo_que_ya_esta() {
        let (base, _hits, server) = serve(inter_routes());
        let project = tempfile::tempdir().unwrap();
        let report = install_family(&base, project.path(), "Inter", false, None).unwrap();
        assert_eq!(report.installed.len(), 2);
        assert!(report.created_folder && report.skipped.is_empty());
        assert_eq!(std::fs::read(project.path().join("fonts/Inter[opsz,wght].ttf")).unwrap(), vec![1u8; 2048]);
        assert!(!project.path().join("fonts/Inter[opsz,wght].ttf.part").exists(), "no queda el temporal");

        // Una segunda instalación no vuelve a escribir.
        std::fs::write(project.path().join("fonts/Inter[opsz,wght].ttf"), b"mio").unwrap();
        let again = install_family(&base, project.path(), "Inter", false, None).unwrap();
        assert!(again.installed.is_empty() && again.skipped.len() == 2 && !again.created_folder);
        assert_eq!(std::fs::read(project.path().join("fonts/Inter[opsz,wght].ttf")).unwrap(), b"mio");
        server.join().unwrap();
    }

    #[test]
    fn con_typst_font_paths_no_crea_fonts_sin_confirmacion_y_con_ella_si() {
        let (base, hits, server) = serve(inter_routes());
        let project = tempfile::tempdir().unwrap();
        let env = std::ffi::OsString::from("C:\\fuentes\\mias");
        let error = install_family(&base, project.path(), "Inter", false, Some(&env)).unwrap_err();
        assert!(matches!(&error, AiError::Config(m) if m.contains("TYPST_FONT_PATHS")), "{error:?}");
        assert!(!project.path().join("fonts").exists());
        assert_eq!(hits.load(Ordering::SeqCst), 0, "no se pidió nada al origen");

        assert_eq!(folder_status(project.path(), Some(&env)), FontsFolderStatus { exists: false, shadows_env_paths: true });
        assert_eq!(folder_status(project.path(), None), FontsFolderStatus { exists: false, shadows_env_paths: false });
        install_family(&base, project.path(), "Inter", true, Some(&env)).unwrap();
        // Con la carpeta ya creada la variable deja de ser un aviso.
        assert_eq!(folder_status(project.path(), Some(&env)), FontsFolderStatus { exists: true, shadows_env_paths: false });
        server.join().unwrap();
    }

    #[test]
    fn una_descarga_que_falla_no_deja_el_proyecto_a_medias() {
        let routes = vec![
            ("/ofl/inter/METADATA.pb", 200, INTER.as_bytes().to_vec()),
            ("/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf", 200, vec![1u8; 100]),
            ("/ofl/inter/Inter-Italic%5Bopsz%2Cwght%5D.ttf", 500, Vec::new()),
        ];
        let (base, _hits, server) = serve(routes);
        let project = tempfile::tempdir().unwrap();
        assert!(install_family(&base, project.path(), "Inter", false, None).is_err());
        assert!(!project.path().join("fonts").exists(), "la carpeta creada y el primer fichero se deshacen");
        server.join().unwrap();
    }

    #[test]
    fn deshacer_quita_solo_lo_que_se_instalo_y_la_carpeta_si_la_creo_y_queda_vacia() {
        let project = tempfile::tempdir().unwrap();
        std::fs::create_dir(project.path().join("fonts")).unwrap();
        std::fs::write(project.path().join("fonts/Nueva.ttf"), b"x").unwrap();
        std::fs::write(project.path().join("fonts/DelUsuario.ttf"), b"y").unwrap();
        assert_eq!(remove_files(project.path(), &["Nueva.ttf".into(), "../../fuera.ttf".into(), "DelUsuario.otf".into()], true).unwrap(), 1);
        assert!(project.path().join("fonts/DelUsuario.ttf").exists(), "lo del usuario no se toca");
        assert!(project.path().join("fonts").exists(), "la carpeta no está vacía: se queda");
        remove_files(project.path(), &["DelUsuario.ttf".into()], true).unwrap();
        assert!(!project.path().join("fonts").exists(), "vacía y creada por la acción: se quita");
    }

    #[test]
    fn la_lista_de_familias_incluye_las_que_vienen_con_typst_y_se_filtra() {
        let project = tempfile::tempdir().unwrap();
        let all = list_families(project.path(), "");
        assert!(all.iter().any(|f| f.name == "Libertinus Serif" && !f.project), "la que Typst lleva incluida");
        let filtered = list_families(project.path(), "libertinus");
        assert!(!filtered.is_empty() && filtered.iter().all(|f| f.name.to_lowercase().contains("libertinus")));
        assert!(list_families(project.path(), "zzz-no-existe").is_empty());
    }

    /// Contra el origen REAL (necesita red; fuera de la CI):
    /// `cargo test --lib fuentes_del_origen_real -- --ignored --nocapture`
    #[test]
    #[ignore = "necesita red: raw.githubusercontent.com/google/fonts"]
    fn fuentes_del_origen_real() {
        for family in ["Inter", "Open Sans", "Libre Baskerville", "IBM Plex Sans", "Source Serif 4", "Roboto Mono", "Lora"] {
            let offer = fetch_offer(ORIGIN, family).unwrap_or_else(|e| panic!("{family}: {e:?}"));
            println!("{family}: {} · {} ficheros · {} KB · {:?}", offer.license, offer.files.len(), offer.total_bytes / 1024, offer.files.iter().map(|f| f.name.as_str()).take(2).collect::<Vec<_>>());
            assert!(offer.total_bytes > 0, "{family}: sin tamaños");
        }
        assert!(matches!(fetch_offer(ORIGIN, "Una Familia Que No Existe Xyz"), Err(AiError::NotFound(_))));
        // Instalación real en una carpeta temporal y comprobación con el compilador vendorizado.
        let project = tempfile::tempdir().unwrap();
        let report = install_family(ORIGIN, project.path(), "Lora", false, None).unwrap();
        println!("instalado: {:?}", report.installed);
        assert!(report.created_folder && !report.installed.is_empty());
        let families = list_families(project.path(), "lora");
        assert!(families.iter().any(|f| f.name == "Lora" && f.project), "{families:?}");
    }
}
