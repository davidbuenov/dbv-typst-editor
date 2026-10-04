// =============================================================================
// DBV Typst Editor — Renderizado de páginas para la IA (RF-114)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// `render_page`: la IA VE lo que produce el compilador (¿dos columnas?, ¿la tabla
// se sale del margen?, ¿se parece a lo que le pidieron?) en vez de adivinarlo del
// código. Sirve de PNG con el sidecar `typst compile --format png`: medido el
// 2026-10-04, 0,7–0,9 s por llamada y 67 KB por página a 144 ppi (ADR-V0140-002 D5);
// sin `typst-render` ni dependencias nuevas.
//
// Se renderiza sobre una RÉPLICA temporal del proyecto (`shadow`), con lo que el
// editor tiene sin guardar y, si se pide, con una propuesta de la IA aplicada: el
// disco del usuario no se toca. Y es un proceso APARTE de la vista previa: no se
// registra en `EngineState`, así que no cancela la compilación en marcha.

use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use super::check::FileContent;
use super::AiError;
use crate::typst_engine::{font_path_args, shadow, SIDECAR};

/// Páginas como mucho por llamada (RF-114.4): cada imagen cuesta contexto.
pub const MAX_PAGES: usize = 3;
/// Resolución. A 100 ppi un A4 son ≈827×1169 px: lo bastante para juzgar la maquetación, sin gastar contexto.
pub const PPI: u32 = 100;
/// Una página que pese más que esto no se envía (una imagen enorme come el contexto y la red).
const MAX_PNG_BYTES: usize = 2 * 1024 * 1024;
const RENDER_TIMEOUT: Duration = Duration::from_secs(60);

/// Una página renderizada, lista para adjuntar a un mensaje.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedPage {
    /// Número de página (desde 1).
    pub page: u32,
    pub width: u32,
    pub height: u32,
    pub mime: &'static str,
    pub base64: String,
}

/// Lo que devuelve `ai_render_pages`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderResult {
    pub pages: Vec<RenderedPage>,
    /// Páginas del documento, si el compilador lo dijo.
    pub total_pages: Option<u32>,
}

/// Qué renderizar.
#[derive(Debug, Clone)]
pub struct RenderSpec {
    pub root: PathBuf,
    pub main: PathBuf,
    /// Lo que se sustituye en la réplica: lo del editor sin guardar y, si se pide, la propuesta.
    pub overrides: Vec<(PathBuf, String)>,
    /// El «proyecto» es un `.typ` suelto: su raíz es una carpeta cualquiera y la réplica no desciende.
    pub single_file: bool,
    pub pages: Vec<u32>,
}

/// Páginas pedidas, normalizadas: de 1 en adelante, sin repetir, en orden y como mucho `MAX_PAGES`.
pub fn normalize_pages(requested: &[u32]) -> Vec<u32> {
    let mut pages: Vec<u32> = requested.iter().copied().filter(|p| (1..=9999).contains(p)).collect();
    pages.sort_unstable();
    pages.dedup();
    pages.truncate(MAX_PAGES);
    if pages.is_empty() {
        pages.push(1);
    }
    pages
}

/// Argumentos de `typst compile` para producir los PNG. `output` lleva `{p}` y `{t}`: el compilador los
/// sustituye por el número de página y el total, que es como se sabe cuántas hay sin otra pasada.
pub fn render_args(shadow_root: &Path, input: &Path, pages: &[u32], output: &Path) -> Vec<String> {
    let list = pages.iter().map(u32::to_string).collect::<Vec<_>>().join(",");
    let mut args = vec![
        "compile".to_string(),
        "--root".to_string(),
        shadow_root.to_string_lossy().to_string(),
        "--format".to_string(),
        "png".to_string(),
        "--ppi".to_string(),
        PPI.to_string(),
        "--pages".to_string(),
        list,
    ];
    args.extend(font_path_args(shadow_root));
    args.push(input.to_string_lossy().to_string());
    args.push(output.to_string_lossy().to_string());
    args
}

/// Ancho y alto de un PNG (cabecera IHDR), o `None` si no lo parece.
pub fn png_size(bytes: &[u8]) -> Option<(u32, u32)> {
    const SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    if bytes.len() < 24 || bytes[..8] != SIGNATURE {
        return None;
    }
    let read = |at: usize| u32::from_be_bytes([bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]]);
    Some((read(16), read(20)))
}

/// `(página, total)` del nombre `pagina-<p>-de-<t>.png`.
fn parse_name(name: &str) -> Option<(u32, u32)> {
    let rest = name.strip_prefix("pagina-")?.strip_suffix(".png")?;
    let (page, total) = rest.split_once("-de-")?;
    Some((page.parse().ok()?, total.parse().ok()?))
}

/// El texto de un error de la réplica (`TypstError` no implementa `Display`).
fn shadow_error(error: crate::typst_engine::TypstError) -> String {
    use crate::typst_engine::TypstError::*;
    match error {
        SidecarUnavailable(m) | ExecutionFailed(m) | CompilationFailed(m) | PreviewExpired(m) | TimedOut(m) => m,
    }
}

/// Lo que el compilador escribe en stderr sin la ruta de la réplica: el error que ve la IA habla del proyecto real.
/// (En Windows el compilador la escribe con el prefijo `\\?\`: lo resuelve `remap_shadow_root`.)
fn remap(text: &str, shadow_root: &Path, real_root: &Path) -> String {
    crate::typst_engine::compile::remap_shadow_root(text, &shadow_root.to_string_lossy(), &real_root.to_string_lossy())
}

/// Renderiza las páginas pedidas. `run` ejecuta el compilador con esos argumentos y devuelve su código de salida y
/// su stderr: en producción es el sidecar; las pruebas usan el binario vendorizado directamente.
pub fn render_core(spec: &RenderSpec, run: &mut dyn FnMut(Vec<String>) -> Result<(Option<i32>, String), AiError>) -> Result<RenderResult, AiError> {
    let pages = normalize_pages(&spec.pages);
    let shadow = shadow::build_with(&spec.root, spec.single_file, false, &spec.overrides).map_err(|error| AiError::BadRequest(shadow_error(error)))?;
    let input = shadow.translate(&spec.root, &spec.main);
    let out_dir = tempfile::tempdir().map_err(|error| AiError::Server(error.to_string()))?;
    let output = out_dir.path().join("pagina-{p}-de-{t}.png");

    let (code, stderr) = run(render_args(shadow.root(), &input, &pages, &output))?;
    if code != Some(0) {
        let message = remap(stderr.trim(), shadow.root(), &spec.root);
        return Err(AiError::BadRequest(if message.is_empty() { "el compilador no pudo renderizar el documento".into() } else { message }));
    }

    let mut rendered = Vec::new();
    let mut total = None;
    let mut files: Vec<(u32, u32, PathBuf)> = std::fs::read_dir(out_dir.path())
        .map_err(|error| AiError::Server(error.to_string()))?
        .flatten()
        .filter_map(|entry| parse_name(&entry.file_name().to_string_lossy()).map(|(page, of)| (page, of, entry.path())))
        .collect();
    files.sort();
    for (page, of, path) in files {
        total = Some(of);
        let bytes = std::fs::read(&path).map_err(|error| AiError::Server(error.to_string()))?;
        if bytes.len() > MAX_PNG_BYTES {
            return Err(AiError::BadRequest(format!("la página {page} pesa demasiado para enviarla ({} KB)", bytes.len() / 1024)));
        }
        let (width, height) = png_size(&bytes).ok_or_else(|| AiError::Server(format!("la página {page} no es un PNG válido")))?;
        rendered.push(RenderedPage { page, width, height, mime: "image/png", base64: base64::engine::general_purpose::STANDARD.encode(&bytes) });
    }
    if rendered.is_empty() {
        return Err(AiError::BadRequest(format!("el documento no tiene la página {} (o ninguna de las pedidas)", pages[0])));
    }
    Ok(RenderResult { pages: rendered, total_pages: total })
}

/// Ejecuta el sidecar una vez, SIN registrarlo en `EngineState`: no debe cancelar la vista previa en marcha.
async fn run_sidecar(app: &AppHandle, args: Vec<String>) -> Result<(Option<i32>, String), AiError> {
    let command = app.shell().sidecar(SIDECAR).map_err(|error| AiError::Config(format!("compilador no disponible: {error}")))?;
    let (mut events, child) = command.args(args).spawn().map_err(|error| AiError::Server(error.to_string()))?;
    let mut stderr = String::new();
    let mut code = None;
    let waited = tokio::time::timeout(RENDER_TIMEOUT, async {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stderr(chunk) => stderr.push_str(&String::from_utf8_lossy(&chunk)),
                CommandEvent::Error(message) => stderr.push_str(&message),
                CommandEvent::Terminated(payload) => {
                    code = payload.code;
                    break;
                }
                _ => {}
            }
        }
    })
    .await;
    if waited.is_err() {
        let _ = child.kill();
        return Err(AiError::Server(format!("el compilador no terminó en {} s", RENDER_TIMEOUT.as_secs())));
    }
    Ok((code, crate::typst_engine::compile::strip_download_progress(&stderr)))
}

/// Parámetros del comando, tal como llegan del frontend.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderRequest {
    pub root: String,
    pub main: String,
    #[serde(default)]
    pub files: Vec<FileContent>,
    #[serde(default)]
    pub pages: Vec<u32>,
    #[serde(default)]
    pub single_file: bool,
}

/// Renderiza páginas del proyecto (con lo sin guardar y, si se manda, la propuesta) para que la IA las vea.
#[tauri::command]
pub async fn ai_render_pages(app: AppHandle, request: RenderRequest) -> Result<RenderResult, AiError> {
    let spec = RenderSpec {
        root: PathBuf::from(&request.root),
        main: PathBuf::from(&request.main),
        overrides: request.files.into_iter().map(|file| (PathBuf::from(file.path), file.content)).collect(),
        single_file: request.single_file,
        pages: request.pages,
    };
    // El mismo código de la comprobación y de la vista previa: la réplica y el compilador.
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || render_core(&spec, &mut |args| tauri::async_runtime::block_on(run_sidecar(&handle, args))))
        .await
        .map_err(|error| AiError::Server(error.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    /// El compilador vendorizado (el mismo que el sidecar), si está en este equipo.
    fn vendored_typst() -> Option<PathBuf> {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries");
        std::fs::read_dir(dir).ok()?.flatten().map(|e| e.path()).find(|p| p.file_name().is_some_and(|n| n.to_string_lossy().starts_with("typst-")))
    }

    fn run_with(binary: PathBuf) -> impl FnMut(Vec<String>) -> Result<(Option<i32>, String), AiError> {
        move |args| {
            let out = Command::new(&binary).args(&args).output().map_err(|error| AiError::Server(error.to_string()))?;
            Ok((out.status.code(), String::from_utf8_lossy(&out.stderr).to_string()))
        }
    }

    fn project(files: &[(&str, &str)]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for (name, text) in files {
            std::fs::write(dir.path().join(name), text).unwrap();
        }
        dir
    }

    fn spec(dir: &tempfile::TempDir, overrides: Vec<(&str, &str)>, pages: Vec<u32>) -> RenderSpec {
        RenderSpec {
            root: dir.path().to_path_buf(),
            main: dir.path().join("main.typ"),
            overrides: overrides.into_iter().map(|(name, text)| (dir.path().join(name), text.to_string())).collect(),
            single_file: false,
            pages,
        }
    }

    const TWO_PAGES: &str = "#set page(width: 12cm, height: 8cm)\n= Uno\n#pagebreak()\n= Dos\n";

    #[test]
    fn las_paginas_pedidas_se_normalizan_y_se_acotan() {
        assert_eq!(normalize_pages(&[]), vec![1]);
        assert_eq!(normalize_pages(&[0, 10_000]), vec![1], "fuera de rango se descarta y queda la primera");
        assert_eq!(normalize_pages(&[3, 1, 3, 2, 4, 5]), vec![1, 2, 3], "ordenadas, sin repetir y como mucho tres");
    }

    #[test]
    fn los_argumentos_piden_png_a_100_ppi_con_solo_esas_paginas() {
        let args = render_args(Path::new("/s"), Path::new("/s/main.typ"), &[1, 3], Path::new("/o/pagina-{p}-de-{t}.png"));
        let joined = args.join(" ");
        assert!(joined.starts_with("compile --root /s --format png --ppi 100 --pages 1,3"), "{joined}");
        assert!(joined.ends_with("/s/main.typ /o/pagina-{p}-de-{t}.png"), "{joined}");
    }

    #[test]
    fn lee_el_tamano_de_un_png_y_rechaza_lo_que_no_lo_es() {
        let mut png = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, b'I', b'H', b'D', b'R'];
        png.extend_from_slice(&340u32.to_be_bytes());
        png.extend_from_slice(&227u32.to_be_bytes());
        assert_eq!(png_size(&png), Some((340, 227)));
        assert_eq!(png_size(b"GIF89a....................."), None);
        assert_eq!(png_size(&png[..10]), None);
        assert_eq!(parse_name("pagina-2-de-7.png"), Some((2, 7)));
        assert_eq!(parse_name("otra-cosa.png"), None);
    }

    #[test]
    fn renderiza_de_verdad_con_el_compilador_vendorizado_y_devuelve_pngs_con_su_tamano() {
        let Some(binary) = vendored_typst() else { return };
        let dir = project(&[("main.typ", TWO_PAGES)]);
        let result = render_core(&spec(&dir, vec![], vec![1, 2]), &mut run_with(binary)).unwrap();
        assert_eq!(result.total_pages, Some(2));
        assert_eq!(result.pages.iter().map(|p| p.page).collect::<Vec<_>>(), vec![1, 2]);
        // 12×8 cm a 100 ppi ≈ 472×315 px.
        let first = &result.pages[0];
        assert!((470..=474).contains(&first.width) && (313..=317).contains(&first.height), "{}x{}", first.width, first.height);
        let bytes = base64::engine::general_purpose::STANDARD.decode(&first.base64).unwrap();
        assert_eq!(png_size(&bytes), Some((first.width, first.height)));
        assert_eq!(first.mime, "image/png");
    }

    #[test]
    fn solo_renderiza_las_paginas_pedidas() {
        let Some(binary) = vendored_typst() else { return };
        let dir = project(&[("main.typ", TWO_PAGES)]);
        let result = render_core(&spec(&dir, vec![], vec![2]), &mut run_with(binary)).unwrap();
        assert_eq!(result.pages.iter().map(|p| p.page).collect::<Vec<_>>(), vec![2]);
        assert_eq!(result.total_pages, Some(2));
    }

    #[test]
    fn la_propuesta_aplicada_en_memoria_se_ve_distinta_y_no_toca_el_disco() {
        let Some(binary) = vendored_typst() else { return };
        let dir = project(&[("main.typ", "#set page(width: 12cm, height: 8cm)\n= Uno\n")]);
        let before = render_core(&spec(&dir, vec![], vec![1]), &mut run_with(binary.clone())).unwrap();
        let proposed = "#set page(width: 20cm, height: 8cm)\n= Uno\n";
        let after = render_core(&spec(&dir, vec![("main.typ", proposed)], vec![1]), &mut run_with(binary)).unwrap();
        assert_ne!(before.pages[0].width, after.pages[0].width, "la propuesta cambia la página: más ancha");
        assert_eq!(std::fs::read_to_string(dir.path().join("main.typ")).unwrap(), "#set page(width: 12cm, height: 8cm)\n= Uno\n", "el disco no se toca");
    }

    #[test]
    fn varios_ficheros_sustituidos_y_uno_nuevo_entran_en_la_replica() {
        let Some(binary) = vendored_typst() else { return };
        let dir = project(&[("main.typ", "#include \"cap.typ\"\n"), ("cap.typ", "Viejo.")]);
        let overrides = vec![("main.typ", "#set page(width: 9cm, height: 6cm)\n#include \"cap.typ\"\n#include \"nuevo.typ\"\n"), ("cap.typ", "Capítulo."), ("nuevo.typ", "= Nuevo")];
        let result = render_core(&spec(&dir, overrides, vec![1]), &mut run_with(binary)).unwrap();
        assert!((352..=357).contains(&result.pages[0].width), "9 cm a 100 ppi ≈ 354 px: {}", result.pages[0].width);
        assert!(!dir.path().join("nuevo.typ").exists(), "el fichero nuevo solo existe en la réplica");
    }

    #[test]
    fn un_error_del_documento_vuelve_con_la_ruta_del_proyecto_y_no_la_de_la_replica() {
        let Some(binary) = vendored_typst() else { return };
        // Un prefijo propio distingue el proyecto real de la réplica (ambos viven en carpetas temporales).
        let dir = tempfile::Builder::new().prefix("proyecto-real-").tempdir().unwrap();
        std::fs::write(dir.path().join("main.typ"), "#no-existe()").unwrap();
        let error = render_core(&spec(&dir, vec![], vec![1]), &mut run_with(binary)).unwrap_err();
        let AiError::BadRequest(message) = error else { panic!("{error:?}") };
        assert!(message.contains("unknown variable"), "{message}");
        assert!(message.contains("proyecto-real-"), "el error habla del proyecto real: {message}");
        assert_eq!(message.matches("main.typ").count(), 1, "{message}");
    }

    #[test]
    fn pedir_una_pagina_que_no_existe_es_un_error_claro_no_una_lista_vacia() {
        let Some(binary) = vendored_typst() else { return };
        let dir = project(&[("main.typ", "= Solo una")]);
        let result = render_core(&spec(&dir, vec![], vec![5]), &mut run_with(binary));
        assert!(result.is_err(), "{result:?}");
    }

    #[test]
    fn una_sustitucion_fuera_del_proyecto_no_escribe_en_el_disco_del_usuario() {
        let dir = project(&[("main.typ", "Hola")]);
        let outside = tempfile::tempdir().unwrap();
        let target = outside.path().join("ajeno.typ");
        std::fs::write(&target, "intacto").unwrap();
        let mut request = spec(&dir, vec![], vec![1]);
        request.overrides.push((target.clone(), "sobrescrito".into()));
        let _ = render_core(&request, &mut |_| Ok((Some(1), String::new())));
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "intacto");
    }
}
