// =============================================================================
// DBV Typst Editor — Compilación: vista previa SVG y exportación PDF
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Los cuatro requisitos obligatorios del Adversarial Architect Review del plan
// (§1) están implementados aquí, y son la razón de ser de este módulo:
//
//   (a) CANCELACIÓN — `EngineState` guarda el proceso hijo en curso; antes de
//       lanzar una compilación nueva se mata el anterior. Sin esto, teclear de
//       forma continuada en una tesis larga acumula procesos `typst` vivos.
//   (b) TOKEN DE GENERACIÓN MONÓTONO — cada compilación lleva un id creciente;
//       un resultado cuyo id ya no es el último se descarta sin pintar. Mata la
//       condición de carrera de resultados fuera de orden aunque la cancelación
//       llegue tarde (el proceso ya había terminado cuando se le fue a matar).
//   (c) DIRECTORIO TEMPORAL POR COMPILACIÓN — el `TempDir` se borra en `Drop`;
//       aquí se conserva mientras su generación siga siendo la vigente (ver
//       `PreviewSession` más abajo) y se destruye al ser sustituido, así que
//       nunca queda más de un directorio de páginas vivo.
//   (d) ÚLTIMA VISTA BUENA — un fallo devuelve `CompilationFailed` con el
//       stderr del compilador; el frontend mantiene el preview anterior y
//       enseña el error en una banda. Nunca un preview en blanco.
//
// CARGA PEREZOSA DE PÁGINAS (medido en el Slice 5, no previsto en el plan): una
// tesis sintética de 209 páginas produce **82 MB de SVG** (≈400 kB por página,
// porque cada página embebe los contornos de sus glifos). Devolver todas las
// páginas en cada ciclo de debounce habría hecho inusable justo el escenario
// insignia del producto. Por eso una compilación devuelve la GEOMETRÍA de todas
// las páginas —barata, sale de la cabecera del SVG— y el marcado solo de las
// que se piden; el resto se sirven una a una con `typst_preview_page` según el
// lector se va acercando a ellas.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tempfile::TempDir;

use super::{TypstError, SIDECAR};

/// Nombre del fichero espejo que se compila cuando el documento tiene cambios
/// sin guardar. Vive junto al documento real para que las rutas relativas
/// (`#include "chapters/01.typ"`, `image("images/x.png")`) resuelvan igual, y se
/// borra en cuanto termina la compilación. Ver el ADR del Slice 5 en memory.md.
pub const MIRROR_FILE_NAME: &str = ".dbv-preview.typ";

/// Bytes de cabecera que se leen de cada SVG para sacar su tamaño. La etiqueta
/// `<svg ... width="..pt" height="..pt">` cabe de sobra: leer el fichero entero
/// (400 kB) solo para medirlo sería justo lo que este diseño quiere evitar.
const SVG_HEADER_BYTES: usize = 512;

/// Páginas ya compiladas de la última compilación vigente. Se conserva viva
/// para poder servir páginas sueltas sin recompilar; sustituirla destruye el
/// `TempDir` anterior y con él sus ficheros.
struct PreviewSession {
    generation: u64,
    /// Se conserva por su `Drop`: al soltarlo se borra el directorio entero.
    _dir: TempDir,
    pages: Vec<PathBuf>,
}

/// Estado compartido del motor: token de generación, proceso hijo en curso y
/// páginas de la última compilación buena.
#[derive(Default)]
pub struct EngineState {
    generation: AtomicU64,
    running: Mutex<Option<(u64, CommandChild)>>,
    session: Mutex<Option<PreviewSession>>,
}

impl EngineState {
    /// Reserva el siguiente token de generación. Monótono y global.
    pub fn next_generation(&self) -> u64 {
        self.generation.fetch_add(1, Ordering::SeqCst) + 1
    }

    /// True si `generation` sigue siendo la compilación más reciente.
    pub fn is_current(&self, generation: u64) -> bool {
        self.generation.load(Ordering::SeqCst) == generation
    }

    /// Mata el proceso en curso, si lo hay. Idempotente.
    pub fn cancel_running(&self) {
        let Ok(mut guard) = self.running.lock() else {
            return;
        };
        if let Some((_, child)) = guard.take() {
            let _ = child.kill();
        }
    }

    fn set_running(&self, generation: u64, child: CommandChild) {
        if let Ok(mut guard) = self.running.lock() {
            *guard = Some((generation, child));
        }
    }

    /// Suelta el proceso hijo solo si el que hay registrado es el nuestro: si
    /// una compilación posterior ya lo sustituyó, borrarlo aquí dejaría al
    /// proceso vivo sin forma de cancelarlo.
    fn clear_running(&self, generation: u64) {
        let Ok(mut guard) = self.running.lock() else {
            return;
        };
        if guard.as_ref().is_some_and(|(id, _)| *id == generation) {
            *guard = None;
        }
    }

    fn store_session(&self, session: PreviewSession) {
        if let Ok(mut guard) = self.session.lock() {
            *guard = Some(session); // el TempDir anterior se borra aquí
        }
    }

    fn page_path(&self, generation: u64, index: usize) -> Option<PathBuf> {
        let guard = self.session.lock().ok()?;
        let session = guard.as_ref()?;
        if session.generation != generation {
            return None;
        }
        session.pages.get(index).cloned()
    }

    /// Descarta la sesión de vista previa (al cerrar proyecto o documento).
    pub fn clear_session(&self) {
        if let Ok(mut guard) = self.session.lock() {
            *guard = None;
        }
    }
}

/// Tamaño de una página en puntos, para poder reservar su hueco en la vista
/// previa antes de haber traído su marcado.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageGeometry {
    pub width_pt: f64,
    pub height_pt: f64,
}

/// Marcado SVG de una página concreta.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewPage {
    pub index: usize,
    pub svg: String,
}

/// Resultado de una compilación de vista previa.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewOutcome {
    pub generation: u64,
    /// Tamaño de TODAS las páginas, en orden.
    pub geometry: Vec<PageGeometry>,
    /// Marcado solo de las páginas pedidas en esta llamada.
    pub pages: Vec<PreviewPage>,
    /// Avisos del compilador en una compilación por lo demás correcta.
    pub warnings: String,
    /// True si el resultado llegó tarde y no debe pintarse (requisito (b)).
    pub stale: bool,
}

/// Extrae el tamaño de página de la cabecera `<svg …>`.
///
/// Función pura y testeable: es lo que permite reservar el hueco de cada página
/// sin cargar sus 400 kB de marcado.
pub fn parse_svg_size(header: &str) -> Option<PageGeometry> {
    let value_of = |attribute: &str| -> Option<f64> {
        let start = header.find(&format!("{attribute}=\""))? + attribute.len() + 2;
        let rest = &header[start..];
        let end = rest.find('"')?;
        rest[..end].trim_end_matches("pt").parse::<f64>().ok()
    };
    let geometry = PageGeometry {
        width_pt: value_of("width")?,
        height_pt: value_of("height")?,
    };
    Some(geometry)
}

/// Lee la geometría de una página sin cargar el fichero entero.
fn read_page_geometry(path: &Path) -> PageGeometry {
    // A4 por defecto: si la cabecera no se puede leer, reservar un hueco con
    // proporción razonable es mejor que colapsar la página a altura cero.
    const A4: PageGeometry = PageGeometry {
        width_pt: 595.28,
        height_pt: 841.89,
    };
    let Ok(raw) = fs::read(path) else { return A4 };
    let header = String::from_utf8_lossy(&raw[..raw.len().min(SVG_HEADER_BYTES)]);
    parse_svg_size(&header).unwrap_or(A4)
}

/// Ordena los SVG generados por número de página.
///
/// El patrón `{0p}` de Typst rellena con ceros hasta el ancho del número total
/// de páginas (verificado contra el binario real en el Slice 5: 209 páginas dan
/// `page-001.svg`), así que el orden lexicográfico ya es el correcto. Se fija
/// con un test para que un cambio futuro del patrón no reordene en silencio.
pub fn sort_page_files(mut files: Vec<PathBuf>) -> Vec<PathBuf> {
    files.sort_by_key(|path| {
        path.file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default()
    });
    files
}

/// Lista los SVG de página presentes en `dir`.
pub fn collect_page_files(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let files: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| ext.eq_ignore_ascii_case("svg"))
        })
        .collect();
    sort_page_files(files)
}

/// Índices de página que se devuelven con marcado en la propia compilación.
///
/// Función pura: acota la ventana al número real de páginas y evita pedir un
/// rango vacío cuando el documento encoge entre dos compilaciones.
pub fn window_indices(total: usize, first: usize, size: usize) -> Vec<usize> {
    if total == 0 {
        return Vec::new();
    }
    let start = first.min(total.saturating_sub(1));
    let end = (start + size.max(1)).min(total);
    (start..end).collect()
}

/// Ejecuta el sidecar de forma cancelable, registrando el hijo en el estado.
async fn run_cancelable(
    app: &AppHandle,
    state: &EngineState,
    generation: u64,
    args: Vec<String>,
) -> Result<(Option<i32>, Vec<u8>, String), TypstError> {
    // (a) Cancelación: el proceso anterior muere ANTES de arrancar el nuevo,
    // para que nunca haya dos compilaciones compitiendo por CPU.
    state.cancel_running();

    let command = app
        .shell()
        .sidecar(SIDECAR)
        .map_err(|error| TypstError::SidecarUnavailable(error.to_string()))?;

    let (mut events, child) = command
        .args(args)
        .spawn()
        .map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;
    state.set_running(generation, child);

    let mut stdout = Vec::new();
    let mut stderr = String::new();
    let mut code = None;

    while let Some(event) = events.recv().await {
        match event {
            CommandEvent::Stdout(chunk) => stdout.extend_from_slice(&chunk),
            CommandEvent::Stderr(chunk) => stderr.push_str(&String::from_utf8_lossy(&chunk)),
            CommandEvent::Error(message) => stderr.push_str(&message),
            CommandEvent::Terminated(payload) => {
                code = payload.code;
                break;
            }
            _ => {}
        }
    }

    state.clear_running(generation);
    Ok((code, stdout, stderr))
}

/// Prepara el fichero que se va a compilar.
///
/// Si `content` viene (documento con cambios sin guardar), se escribe un espejo
/// oculto junto al documento real; si no, se compila el fichero tal cual está
/// en disco. Devuelve `(ruta a compilar, ruta del espejo a borrar después)`.
///
/// `pub(crate)`: también la usa `typst_engine::outline` (Beta) para que el
/// panel de navegación estructural vea los cambios sin guardar igual que la
/// vista previa — mismo criterio, no duplicarlo.
pub(crate) fn prepare_input(
    document: &Path,
    content: Option<&str>,
) -> Result<(PathBuf, Option<PathBuf>), TypstError> {
    let Some(content) = content else {
        return Ok((document.to_path_buf(), None));
    };
    let parent = document.parent().ok_or_else(|| {
        TypstError::ExecutionFailed(format!("{} no tiene carpeta", document.display()))
    })?;
    let mirror = parent.join(MIRROR_FILE_NAME);
    fs::write(&mirror, content).map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;
    Ok((mirror.clone(), Some(mirror)))
}

/// Compila el documento a SVG multipágina para la vista previa en vivo.
#[tauri::command]
pub async fn typst_compile_preview(
    app: AppHandle,
    state: tauri::State<'_, EngineState>,
    document: String,
    root: String,
    content: Option<String>,
    first_page: Option<usize>,
    window_size: Option<usize>,
) -> Result<PreviewOutcome, TypstError> {
    // (b) Token de generación: se reserva antes de tocar nada.
    let generation = state.next_generation();

    // (c) Directorio temporal propio de esta compilación.
    let workdir =
        tempfile::tempdir().map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;
    let output_pattern = workdir.path().join("page-{0p}.svg");

    let document_path = PathBuf::from(&document);
    let (input, mirror) = prepare_input(&document_path, content.as_deref())?;

    let args = vec![
        "compile".to_string(),
        "--root".to_string(),
        root,
        "--format".to_string(),
        "svg".to_string(),
        input.to_string_lossy().to_string(),
        output_pattern.to_string_lossy().to_string(),
    ];

    let outcome = run_cancelable(&app, &state, generation, args).await;
    if let Some(mirror) = mirror {
        let _ = fs::remove_file(mirror);
    }
    let (code, _stdout, stderr) = outcome?;

    // Un resultado que ya no es el último no se pinta ni se convierte en error:
    // se devuelve marcado como obsoleto para que el frontend lo ignore.
    if !state.is_current(generation) {
        return Ok(PreviewOutcome {
            generation,
            geometry: Vec::new(),
            pages: Vec::new(),
            warnings: String::new(),
            stale: true,
        });
    }

    if code != Some(0) {
        // (d) El frontend conserva la última vista buena y enseña este stderr.
        return Err(TypstError::CompilationFailed { code, stderr });
    }

    let files = collect_page_files(workdir.path());
    let geometry: Vec<PageGeometry> = files.iter().map(|path| read_page_geometry(path)).collect();

    let mut pages = Vec::new();
    for index in window_indices(files.len(), first_page.unwrap_or(0), window_size.unwrap_or(2)) {
        match fs::read_to_string(&files[index]) {
            Ok(svg) => pages.push(PreviewPage { index, svg }),
            Err(error) => return Err(TypstError::ExecutionFailed(error.to_string())),
        }
    }

    state.store_session(PreviewSession {
        generation,
        _dir: workdir,
        pages: files,
    });

    Ok(PreviewOutcome {
        generation,
        geometry,
        pages,
        warnings: stderr,
        stale: false,
    })
}

/// Sirve el marcado de UNA página ya compilada, sin recompilar.
///
/// Devuelve `PreviewExpired` si la generación pedida ya fue sustituida: es una
/// respuesta normal (el lector se movió mientras se recompilaba), no un fallo,
/// y el frontend simplemente espera a la vista previa nueva.
#[tauri::command]
pub fn typst_preview_page(
    state: tauri::State<'_, EngineState>,
    generation: u64,
    index: usize,
) -> Result<PreviewPage, TypstError> {
    let path = state
        .page_path(generation, index)
        .ok_or_else(|| TypstError::PreviewExpired(format!("página {index} de la generación {generation}")))?;
    let svg = fs::read_to_string(&path).map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;
    Ok(PreviewPage { index, svg })
}

/// Cancela la compilación en curso y libera las páginas (al cerrar proyecto).
#[tauri::command]
pub fn typst_cancel_preview(state: tauri::State<'_, EngineState>) {
    state.cancel_running();
    state.clear_session();
}

/// Exporta el documento a PDF (RF-10).
///
/// A diferencia de la vista previa, el PDF sale por stdout del proceso (`-` como
/// destino, ARCHITECTURE.md §7.2) y se escribe directamente donde el usuario
/// elija: no pasa por ningún fichero temporal intermedio.
#[tauri::command]
pub async fn typst_export_pdf(
    app: AppHandle,
    state: tauri::State<'_, EngineState>,
    document: String,
    root: String,
    output: String,
    content: Option<String>,
) -> Result<String, TypstError> {
    let generation = state.next_generation();
    let document_path = PathBuf::from(&document);
    let (input, mirror) = prepare_input(&document_path, content.as_deref())?;

    let args = vec![
        "compile".to_string(),
        "--root".to_string(),
        root,
        "--format".to_string(),
        "pdf".to_string(),
        input.to_string_lossy().to_string(),
        "-".to_string(),
    ];

    let outcome = run_cancelable(&app, &state, generation, args).await;
    if let Some(mirror) = mirror {
        let _ = fs::remove_file(mirror);
    }
    let (code, stdout, stderr) = outcome?;

    if code != Some(0) {
        return Err(TypstError::CompilationFailed { code, stderr });
    }
    if stdout.is_empty() {
        return Err(TypstError::ExecutionFailed(
            "el compilador no ha producido ningún PDF".to_string(),
        ));
    }

    fs::write(&output, stdout).map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;
    Ok(output)
}

/// Exporta UNA página del documento a PNG (Beta, §7.12 — alcance de este
/// slice: solo "página actual", no rango ni documento completo).
///
/// `page` es 1-indexado, como lo espera `--pages` del CLI. Verificado contra
/// el binario real: con una sola página seleccionada, `--pages N` acepta un
/// nombre de fichero normal como salida — el patrón `{p}`/`{0p}` solo hace
/// falta cuando la exportación puede producir más de un PNG a la vez, que no
/// es este caso.
#[tauri::command]
pub async fn typst_export_png(
    app: AppHandle,
    state: tauri::State<'_, EngineState>,
    document: String,
    root: String,
    output: String,
    page: usize,
    content: Option<String>,
) -> Result<String, TypstError> {
    let generation = state.next_generation();
    let document_path = PathBuf::from(&document);
    let (input, mirror) = prepare_input(&document_path, content.as_deref())?;

    let args = vec![
        "compile".to_string(),
        "--root".to_string(),
        root,
        "--format".to_string(),
        "png".to_string(),
        "--pages".to_string(),
        page.to_string(),
        input.to_string_lossy().to_string(),
        output.clone(),
    ];

    let outcome = run_cancelable(&app, &state, generation, args).await;
    if let Some(mirror) = mirror {
        let _ = fs::remove_file(mirror);
    }
    let (code, _stdout, stderr) = outcome?;

    if code != Some(0) {
        return Err(TypstError::CompilationFailed { code, stderr });
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn el_token_de_generacion_es_estrictamente_creciente() {
        let state = EngineState::default();
        let first = state.next_generation();
        let second = state.next_generation();
        let third = state.next_generation();

        assert!(first < second && second < third);
    }

    #[test]
    fn solo_la_ultima_generacion_se_considera_vigente() {
        let state = EngineState::default();
        let old = state.next_generation();
        let new = state.next_generation();

        assert!(!state.is_current(old), "una compilación superada no debe pintarse");
        assert!(state.is_current(new));
    }

    #[test]
    fn cancel_running_sin_proceso_no_falla() {
        let state = EngineState::default();
        state.cancel_running();
        state.cancel_running();
    }

    #[test]
    fn parse_svg_size_lee_la_cabecera_real_del_compilador() {
        let header = r#"<svg viewBox="0 0 595.275590551 841.88976378" width="595.275590551pt" height="841.88976378pt" xmlns="http://www.w3.org/2000/svg">"#;
        let size = parse_svg_size(header).unwrap();

        assert!((size.width_pt - 595.275_590_551).abs() < 1e-6);
        assert!((size.height_pt - 841.889_763_78).abs() < 1e-6);
    }

    #[test]
    fn parse_svg_size_devuelve_none_si_no_hay_cabecera_util() {
        assert_eq!(parse_svg_size(""), None);
        assert_eq!(parse_svg_size("<svg viewBox=\"0 0 1 1\">"), None);
    }

    #[test]
    fn read_page_geometry_cae_a_a4_si_el_fichero_no_existe() {
        let size = read_page_geometry(Path::new("dbv-no-existe.svg"));
        assert!(size.height_pt > size.width_pt, "A4 vertical como respaldo");
    }

    #[test]
    fn sort_page_files_respeta_el_orden_de_pagina_con_relleno_de_ceros() {
        let files = vec![
            PathBuf::from("/tmp/page-010.svg"),
            PathBuf::from("/tmp/page-002.svg"),
            PathBuf::from("/tmp/page-001.svg"),
        ];
        let sorted: Vec<String> = sort_page_files(files)
            .into_iter()
            .map(|path| path.file_name().unwrap().to_string_lossy().to_string())
            .collect();

        assert_eq!(sorted, vec!["page-001.svg", "page-002.svg", "page-010.svg"]);
    }

    #[test]
    fn collect_page_files_ignora_lo_que_no_sea_svg() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("page-01.svg"), "<svg/>").unwrap();
        fs::write(dir.path().join("page-02.svg"), "<svg/>").unwrap();
        fs::write(dir.path().join("notas.txt"), "x").unwrap();

        assert_eq!(collect_page_files(dir.path()).len(), 2);
    }

    #[test]
    fn collect_page_files_en_carpeta_inexistente_devuelve_vacio() {
        assert!(collect_page_files(Path::new("dbv-no-existe")).is_empty());
    }

    #[test]
    fn window_indices_acota_la_ventana_al_documento() {
        assert_eq!(window_indices(5, 0, 2), vec![0, 1]);
        assert_eq!(window_indices(5, 3, 2), vec![3, 4]);
        // El lector estaba en la página 9 y el documento ha encogido a 3.
        assert_eq!(window_indices(3, 8, 2), vec![2]);
        assert!(window_indices(0, 0, 2).is_empty());
    }

    #[test]
    fn window_indices_nunca_devuelve_un_rango_vacio_con_paginas() {
        assert_eq!(window_indices(4, 1, 0), vec![1]);
    }

    #[test]
    fn prepare_input_sin_cambios_compila_el_fichero_real() {
        let dir = tempfile::tempdir().unwrap();
        let document = dir.path().join("main.typ");
        fs::write(&document, "= Hola").unwrap();

        let (input, mirror) = prepare_input(&document, None).unwrap();
        assert_eq!(input, document);
        assert!(mirror.is_none());
    }

    #[test]
    fn prepare_input_con_cambios_escribe_un_espejo_junto_al_documento() {
        let dir = tempfile::tempdir().unwrap();
        let document = dir.path().join("main.typ");
        fs::write(&document, "= Guardado").unwrap();

        let (input, mirror) = prepare_input(&document, Some("= Sin guardar")).unwrap();

        // El espejo vive en la misma carpeta: es lo que hace que las rutas
        // relativas del documento resuelvan igual que en el fichero real.
        assert_eq!(input.parent(), document.parent());
        assert_eq!(input.file_name().unwrap(), MIRROR_FILE_NAME);
        assert_eq!(fs::read_to_string(&input).unwrap(), "= Sin guardar");
        assert_eq!(mirror, Some(input));
        // Y el documento real no se ha tocado.
        assert_eq!(fs::read_to_string(&document).unwrap(), "= Guardado");
    }

    #[test]
    fn una_pagina_de_una_generacion_superada_no_se_sirve() {
        let state = EngineState::default();
        let dir = tempfile::tempdir().unwrap();
        let page = dir.path().join("page-1.svg");
        fs::write(&page, "<svg/>").unwrap();

        let generation = state.next_generation();
        state.store_session(PreviewSession {
            generation,
            _dir: dir,
            pages: vec![page],
        });

        assert!(state.page_path(generation, 0).is_some());
        assert!(state.page_path(generation, 9).is_none(), "índice fuera de rango");
        assert!(
            state.page_path(generation + 1, 0).is_none(),
            "una generación distinta nunca debe servirse"
        );
    }

    #[test]
    fn clear_session_libera_las_paginas() {
        let state = EngineState::default();
        let dir = tempfile::tempdir().unwrap();
        let page = dir.path().join("page-1.svg");
        fs::write(&page, "<svg/>").unwrap();
        let generation = state.next_generation();
        state.store_session(PreviewSession {
            generation,
            _dir: dir,
            pages: vec![page],
        });

        state.clear_session();
        assert!(state.page_path(generation, 0).is_none());
    }
}
