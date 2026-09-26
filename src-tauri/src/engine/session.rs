// =============================================================================
// DBV Typst Editor — Sesión del motor en proceso y respaldo automático (RF-56)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Une el núcleo (`world`, `worker`, `pages`, `map`, `diagnostics`) con lo que la
// aplicación ya tiene: el token de generación de `EngineState` y el contrato de
// `typst_compile_preview`. Decide, en cada compilación, si la sirve el motor en
// proceso o el clásico, y qué hacer cuando el motor en proceso falla:
//
//   · PÁNICO de Typst, PLAZO agotado (45 s, como hoy) o mundo que no se puede
//     montar → respaldo AUTOMÁTICO al motor clásico, y el motor en proceso queda
//     desactivado el resto de la sesión (`sticky`): un motor que ha entrado en
//     pánico no es de fiar.
//   · PAQUETE sin descargar → respaldo solo para ESTA compilación (el sidecar sí
//     descarga y lo deja en la caché compartida, así que la siguiente ya lo
//     encuentra); el motor sigue sano.
//   · Errores DEL DOCUMENTO → no es un fallo del motor: se devuelven como error de
//     compilación, con sus diagnósticos, igual que el motor clásico.
//
// El motor en proceso es OPCIONAL y viene apagado (ADR-MOTOR-002, decisión 1): no
// se ha podido verificar en una ventana real durante su construcción, y un motor
// nuevo sin verificar como predeterminado arriesga dejar a alguien sin vista
// previa. Se activa con `engine_set_mode`.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use tokio::sync::oneshot;
use typst::diag::SourceDiagnostic;
use typst::syntax::{FileId, Source};
use typst::World;
use typst_layout::PagedDocument;

use super::diagnostics::{self, Diagnostic, Level};
use super::map::{Located, Rect, SourceMap};
use super::pages;
use super::worker::{CompileResult, Outcome, Request, Worker};
use super::world::EngineWorld;
use crate::typst_engine::compile::{window_indices, CompileTarget, PageGeometry, PreviewPage};
use crate::typst_engine::TypstError;

/// Plazo de una compilación: el mismo que tiene hoy el motor clásico.
pub const COMPILE_TIMEOUT: Duration = Duration::from_secs(45);

/// Qué motor sirve la vista previa.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// CLI + réplica + anclas (el de la v0.8.x).
    Classic,
    /// Typst como librería, en este proceso.
    InProc,
}

impl Mode {
    fn from_u8(value: u8) -> Self {
        if value == 1 {
            Self::InProc
        } else {
            Self::Classic
        }
    }

    /// Nombre estable para el frontend.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Classic => "classic",
            Self::InProc => "inproc",
        }
    }

    /// Lo contrario de `as_str`; cualquier otra cosa es el motor clásico.
    pub fn parse(text: &str) -> Self {
        if text == "inproc" {
            Self::InProc
        } else {
            Self::Classic
        }
    }
}

/// Lo que sirve el motor en proceso cuando la compilación sale bien.
pub struct Done {
    pub geometry: Vec<PageGeometry>,
    pub pages: Vec<PreviewPage>,
    pub warnings: String,
    pub diagnostics: Vec<Diagnostic>,
}

/// Cómo terminó un intento con el motor en proceso.
pub enum Attempt {
    Done(Done),
    /// El documento tiene errores: no es un fallo del motor.
    Failed { message: String },
    /// Otra petición posterior superó a esta.
    Superseded,
    /// Este intento no sirve: usar el motor clásico. `sticky` desactiva además el
    /// motor en proceso el resto de la sesión.
    Fallback { reason: String, sticky: bool },
}

/// El último documento compilado con éxito y todo lo que se consulta de él.
pub struct Latest {
    pub generation: u64,
    document: Arc<PagedDocument>,
    world: Arc<EngineWorld>,
    sources: Arc<HashMap<FileId, Source>>,
    /// El mapa se construye la primera vez que se pide (0,33 s en un libro de 224
    /// páginas): quien solo mira la vista previa no lo paga.
    map: OnceLock<SourceMap>,
}

impl Latest {
    fn source_of(&self, id: FileId) -> Option<Source> {
        self.sources.get(&id).cloned().or_else(|| self.world.source(id).ok())
    }

    fn map(&self) -> &SourceMap {
        self.map.get_or_init(|| {
            SourceMap::build(&self.document, &|id| self.source_of(id), &|id| self.world.relative_path(id))
        })
    }

    /// SVG de la página `index` (0-indexada).
    pub fn page_svg(&self, index: usize) -> Option<String> {
        pages::svg(&self.document, index)
    }
}

struct Active {
    root: PathBuf,
    main: PathBuf,
    world: Arc<EngineWorld>,
    worker: Worker,
    waiters: Arc<Mutex<HashMap<u64, oneshot::Sender<CompileResult>>>>,
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Estado del motor en proceso, gestionado por Tauri.
pub struct InProcEngine {
    mode: AtomicU8,
    /// Por qué el motor en proceso quedó desactivado en esta sesión, si lo está.
    disabled: Mutex<Option<String>>,
    active: Mutex<Option<Active>>,
    latest: Mutex<Option<Arc<Latest>>>,
    diagnostics: Mutex<(u64, Vec<Diagnostic>)>,
}

impl Default for InProcEngine {
    fn default() -> Self {
        Self {
            mode: AtomicU8::new(1),
            disabled: Mutex::new(None),
            active: Mutex::new(None),
            latest: Mutex::new(None),
            diagnostics: Mutex::new((0, Vec::new())),
        }
    }
}

impl InProcEngine {
    /// Cambia de motor. Volver a activar el motor en proceso lo rehabilita aunque
    /// se hubiera desactivado solo (el usuario lo pide expresamente).
    pub fn set_mode(&self, mode: Mode) {
        self.mode.store(u8::from(mode == Mode::InProc), Ordering::SeqCst);
        if mode == Mode::InProc {
            *lock(&self.disabled) = None;
        } else {
            self.release();
        }
    }

    pub fn mode(&self) -> Mode {
        Mode::from_u8(self.mode.load(Ordering::SeqCst))
    }

    /// Motivo por el que el motor en proceso está desactivado, si lo está.
    pub fn disabled_reason(&self) -> Option<String> {
        lock(&self.disabled).clone()
    }

    /// True si esta compilación debe intentarse con el motor en proceso.
    pub fn wants_inproc(&self) -> bool {
        self.mode() == Mode::InProc && lock(&self.disabled).is_none()
    }

    /// Libera el mundo, el hilo y los documentos (al cerrar el proyecto).
    pub fn release(&self) {
        *lock(&self.active) = None;
        *lock(&self.latest) = None;
        *lock(&self.diagnostics) = (0, Vec::new());
    }

    /// El último documento, si es el de la generación pedida.
    pub fn latest_for(&self, generation: u64) -> Option<Arc<Latest>> {
        lock(&self.latest).clone().filter(|latest| latest.generation == generation)
    }

    /// Diagnósticos de la última compilación (buena o mala) y su generación.
    pub fn last_diagnostics(&self) -> (u64, Vec<Diagnostic>) {
        lock(&self.diagnostics).clone()
    }

    /// Qué se escribió en el punto `(x, y)` de la página `page` de `generation`.
    pub fn locate(&self, generation: u64, page: usize, x: f64, y: f64) -> Result<Option<Located>, TypstError> {
        let latest = self.latest_for(generation).ok_or_else(|| expired(generation))?;
        Ok(latest.map().locate(page, x, y))
    }

    /// Enlaces de la página `page` (1-indexada) de la vista previa `generation`
    /// (RF-72). Se calculan al pedirlos: recorrer una página es barato.
    pub fn links(&self, generation: u64, page: usize) -> Result<Vec<super::links::Link>, TypstError> {
        let latest = self.latest_for(generation).ok_or_else(|| expired(generation))?;
        Ok(super::links::page_links(&latest.document, page.saturating_sub(1)))
    }

    /// Dónde se dibuja lo escrito entre `from` y `to` (UTF-16) de `file`.
    pub fn reveal(&self, generation: u64, file: &str, from: usize, to: usize) -> Result<Vec<Rect>, TypstError> {
        let latest = self.latest_for(generation).ok_or_else(|| expired(generation))?;
        Ok(latest.map().reveal(file, from, to))
    }

    /// Compila `target` con el motor en proceso.
    ///
    /// `is_current` dice si `generation` sigue siendo la petición más reciente.
    pub async fn compile(
        &self,
        target: &CompileTarget,
        generation: u64,
        is_current: impl Fn(u64) -> bool,
        first_page: usize,
        window: usize,
    ) -> Attempt {
        let receiver = match self.submit(target, generation) {
            Ok(receiver) => receiver,
            Err(reason) => return self.fallback(reason, false),
        };

        let result = match tokio::time::timeout(COMPILE_TIMEOUT, receiver).await {
            Ok(Ok(result)) => result,
            // El remitente se soltó sin enviar: una petición posterior la superó.
            Ok(Err(_)) => return Attempt::Superseded,
            Err(_) => {
                // No se puede matar una compilación en proceso: se abandona el hilo
                // y el mundo, y se desactiva el motor para lo que queda de sesión.
                *lock(&self.active) = None;
                return self.disable(format!("una compilación superó el plazo de {} s", COMPILE_TIMEOUT.as_secs()));
            }
        };
        if !is_current(generation) {
            return Attempt::Superseded;
        }
        self.handle(result, first_page, window)
    }

    /// Prepara el mundo (creándolo si hace falta) y encola la petición.
    fn submit(&self, target: &CompileTarget, generation: u64) -> Result<oneshot::Receiver<CompileResult>, String> {
        let root = PathBuf::from(&target.root);
        let main = PathBuf::from(&target.document);
        let mut active = lock(&self.active);
        let stale_world = active.as_ref().is_none_or(|a| a.root != root || a.main != main);
        if stale_world {
            let world = EngineWorld::new(&root, &main).map_err(|error| error.to_string())?;
            let waiters: Arc<Mutex<HashMap<u64, oneshot::Sender<CompileResult>>>> = Arc::default();
            let sink_waiters = waiters.clone();
            let worker = Worker::spawn(
                world.clone(),
                Arc::new(move |result| {
                    if let Some(sender) = lock(&sink_waiters).remove(&result.generation) {
                        let _ = sender.send(result);
                    }
                }),
            );
            *active = Some(Active { root, main, world, worker, waiters });
        }
        let active = active.as_ref().expect("recién creado");

        let (sender, receiver) = oneshot::channel();
        lock(&active.waiters).insert(generation, sender);
        let overrides = match (&target.dirty_path, &target.dirty_content) {
            (Some(path), Some(content)) => vec![(PathBuf::from(path), content.clone())],
            _ => Vec::new(),
        };
        if let Some(superseded) = active.worker.submit(Request { generation, overrides }) {
            // Esa petición no se va a compilar: soltar su remitente resuelve la
            // llamada que la esperaba como "superada".
            lock(&active.waiters).remove(&superseded);
        }
        Ok(receiver)
    }

    /// Desactiva el motor en proceso para lo que queda de sesión.
    fn disable(&self, reason: String) -> Attempt {
        *lock(&self.disabled) = Some(reason.clone());
        *lock(&self.active) = None;
        self.fallback(reason, true)
    }

    /// Pide el motor clásico. Los diagnósticos del motor rápido dejan de valer: si
    /// la compilación clásica falla, la interfaz no debe seguir enseñando errores
    /// de una compilación anterior que ya no corresponde a lo que hay en pantalla.
    fn fallback(&self, reason: String, sticky: bool) -> Attempt {
        *lock(&self.diagnostics) = (0, Vec::new());
        Attempt::Fallback { reason, sticky }
    }

    fn handle(&self, result: CompileResult, first_page: usize, window: usize) -> Attempt {
        let generation = result.generation;
        match result.outcome {
            Outcome::Panicked(message) => self.disable(format!("Typst entró en pánico: {message}")),
            Outcome::Compiled { document, warnings, sources } => {
                let Some(world) = lock(&self.active).as_ref().map(|active| active.world.clone()) else {
                    return Attempt::Superseded;
                };
                let diagnostics = self.diagnose(&world, &sources, &warnings, generation);
                let geometry = pages::geometry(&document)
                    .into_iter()
                    .map(|size| PageGeometry { width_pt: size.width_pt, height_pt: size.height_pt })
                    .collect::<Vec<_>>();
                let latest = Arc::new(Latest { generation, document, world, sources, map: OnceLock::new() });
                let pages = window_indices(geometry.len(), first_page, window)
                    .into_iter()
                    .filter_map(|index| latest.page_svg(index).map(|svg| PreviewPage { index, svg }))
                    .collect();
                let warnings_text = diagnostics.iter().map(describe).collect::<Vec<_>>().join("\n");
                *lock(&self.latest) = Some(latest);
                Attempt::Done(Done { geometry, pages, warnings: warnings_text, diagnostics })
            }
            Outcome::Failed { errors, warnings, sources } => {
                let Some(world) = lock(&self.active).as_ref().map(|active| active.world.clone()) else {
                    return Attempt::Superseded;
                };
                let all: Vec<SourceDiagnostic> = errors.iter().cloned().chain(warnings.iter().cloned()).collect();
                let diagnostics = self.diagnose(&world, &sources, &all, generation);
                // Un paquete sin descargar no es un fallo del documento ni del
                // motor: solo esta compilación pasa al clásico, que sí descarga.
                if errors.iter().any(|error| error.message.contains("el motor en proceso no descarga paquetes")) {
                    return self.fallback("paquete de Typst Universe sin descargar".into(), false);
                }
                let message = diagnostics
                    .iter()
                    .filter(|d| d.level == Level::Error)
                    .map(describe)
                    .collect::<Vec<_>>()
                    .join("\n");
                Attempt::Failed { message }
            }
        }
    }

    /// Convierte y guarda los diagnósticos de la última compilación.
    fn diagnose(
        &self,
        world: &Arc<EngineWorld>,
        sources: &Arc<HashMap<FileId, Source>>,
        all: &[SourceDiagnostic],
        generation: u64,
    ) -> Vec<Diagnostic> {
        let (lookup_sources, lookup_world, relative_world) = (sources.clone(), world.clone(), world.clone());
        let converted = diagnostics::collect(
            all,
            &move |id| lookup_sources.get(&id).cloned().or_else(|| lookup_world.source(id).ok()),
            &move |id| relative_world.relative_path(id),
        );
        *lock(&self.diagnostics) = (generation, converted.clone());
        converted
    }
}

fn expired(generation: u64) -> TypstError {
    TypstError::PreviewExpired(format!("la vista previa de la generación {generation} ya no es la vigente"))
}

/// Una línea legible de un diagnóstico, para la banda de mensajes de la vista
/// previa (la misma que enseña el motor clásico con el `stderr` del CLI).
fn describe(diagnostic: &Diagnostic) -> String {
    let level = match diagnostic.level {
        Level::Error => "error",
        Level::Warning => "warning",
    };
    let place = match &diagnostic.file {
        Some(file) => format!(" ({file}:{}:{})", diagnostic.start_line, diagnostic.start_column),
        None => String::new(),
    };
    let hints: String = diagnostic.hints.iter().map(|hint| format!("\n  hint: {hint}")).collect();
    format!("{level}: {}{place}{hints}", diagnostic.message)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::AtomicU64;

    fn project(files: &[(&str, &str)]) -> (tempfile::TempDir, CompileTarget) {
        let dir = tempfile::tempdir().unwrap();
        for (name, text) in files {
            let path = dir.path().join(name);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, text).unwrap();
        }
        let target = CompileTarget {
            document: dir.path().join(files[0].0).to_string_lossy().to_string(),
            root: dir.path().to_string_lossy().to_string(),
            single_file: false,
            dirty_path: None,
            dirty_content: None,
        };
        (dir, target)
    }

    fn run(engine: &InProcEngine, target: &CompileTarget, generation: u64) -> Attempt {
        tauri::async_runtime::block_on(engine.compile(target, generation, |_| true, 0, 2))
    }

    fn enabled() -> InProcEngine {
        let engine = InProcEngine::default();
        engine.set_mode(Mode::InProc);
        engine
    }

    #[test]
    fn viene_encendido_y_se_apaga_a_peticion() {
        let engine = InProcEngine::default();

        assert_eq!(engine.mode(), Mode::InProc, "el motor rápido es el de serie (validado por el usuario)");
        assert!(engine.wants_inproc());
        engine.set_mode(Mode::Classic);
        assert!(!engine.wants_inproc());
    }

    #[test]
    fn mode_parse_solo_reconoce_inproc_lo_demas_es_clasico() {
        assert_eq!(Mode::parse("inproc"), Mode::InProc);
        assert_eq!(Mode::parse("classic"), Mode::Classic);
        assert_eq!(Mode::parse("cualquier-cosa"), Mode::Classic);
        assert_eq!(Mode::InProc.as_str(), "inproc");
    }

    #[test]
    fn compila_y_sirve_geometria_las_paginas_pedidas_y_avisos() {
        let (_dir, target) = project(&[("main.typ", "Uno.\n#pagebreak()\nDos.\n#pagebreak()\nTres.")]);
        let engine = enabled();

        let Attempt::Done(done) = run(&engine, &target, 1) else { panic!("debía compilar") };

        assert_eq!(done.geometry.len(), 3);
        assert_eq!(done.pages.iter().map(|p| p.index).collect::<Vec<_>>(), vec![0, 1], "ventana de 2 páginas");
        assert!(done.pages[0].svg.starts_with("<svg"));
    }

    #[test]
    fn las_demas_paginas_se_piden_despues_por_generacion() {
        let (_dir, target) = project(&[("main.typ", "Uno.\n#pagebreak()\nDos.\n#pagebreak()\nTres.")]);
        let engine = enabled();
        let Attempt::Done(_) = run(&engine, &target, 4) else { panic!("debía compilar") };

        let latest = engine.latest_for(4).expect("la generación vigente");

        assert!(latest.page_svg(2).is_some());
        assert!(latest.page_svg(3).is_none());
        assert!(engine.latest_for(3).is_none(), "otra generación no es la vigente");
    }

    #[test]
    fn el_contenido_sin_guardar_se_compila_sin_tocar_el_disco() {
        let (dir, mut target) = project(&[("main.typ", "Una.")]);
        target.dirty_path = Some(dir.path().join("main.typ").to_string_lossy().to_string());
        target.dirty_content = Some("Una.\n#pagebreak()\nDos.".into());
        let engine = enabled();

        let Attempt::Done(done) = run(&engine, &target, 1) else { panic!("debía compilar") };

        assert_eq!(done.geometry.len(), 2);
        assert_eq!(fs::read_to_string(dir.path().join("main.typ")).unwrap(), "Una.");
    }

    #[test]
    fn un_fichero_de_codigo_sin_guardar_llega_al_documento_por_read() {
        // RF-60.4: el documento incrusta `sim.cpp` con `read()`; lo que hay en el
        // editor sin guardar debe verse en la vista previa sin tocar el disco.
        let main = "#let n = int(read(\"sim.cpp\"))
#for i in range(n) { [Pág.]; if i < n - 1 { pagebreak() } }";
        let (dir, mut target) = project(&[("main.typ", main), ("sim.cpp", "2")]);
        let engine = enabled();
        let Attempt::Done(before) = run(&engine, &target, 1) else { panic!("debía compilar") };
        assert_eq!(before.geometry.len(), 2);

        target.dirty_path = Some(dir.path().join("sim.cpp").to_string_lossy().to_string());
        target.dirty_content = Some("4".into());
        let Attempt::Done(after) = run(&engine, &target, 2) else { panic!("debía compilar") };

        assert_eq!(after.geometry.len(), 4, "la vista previa usa el .cpp sin guardar");
        assert_eq!(fs::read_to_string(dir.path().join("sim.cpp")).unwrap(), "2", "el disco no se toca");

        // Al guardar (deja de haber cambios sin guardar), vuelve a lo que hay en disco.
        target.dirty_path = None;
        target.dirty_content = None;
        let Attempt::Done(saved) = run(&engine, &target, 3) else { panic!("debía compilar") };
        assert_eq!(saved.geometry.len(), 2);
    }

    #[test]
    fn un_respaldo_al_clasico_borra_los_diagnosticos_del_motor_rapido() {
        let (dir, target) = project(&[("main.typ", "Texto #no-existe fin.")]);
        let engine = enabled();
        let Attempt::Failed { .. } = run(&engine, &target, 1) else { panic!("debía fallar el documento") };
        assert!(!engine.last_diagnostics().1.is_empty());

        // Un paquete que el motor no descarga pasa esta compilación al clásico.
        fs::write(dir.path().join("main.typ"), "#import \"@preview/cetz-inexistente:0.0.1\": *").unwrap();
        let Attempt::Fallback { .. } = run(&engine, &target, 2) else { panic!("debía pedir respaldo") };

        assert!(engine.last_diagnostics().1.is_empty(), "no deben quedar errores de la compilación anterior");
    }

    #[test]
    fn un_documento_con_errores_no_es_un_fallo_del_motor() {
        let (_dir, target) = project(&[("main.typ", "Texto #no-existe fin.")]);
        let engine = enabled();

        let Attempt::Failed { message } = run(&engine, &target, 1) else { panic!("debía fallar el documento") };

        assert!(message.starts_with("error:"), "{message}");
        assert!(message.contains("main.typ:1:"), "lleva fichero y línea reales: {message}");
        assert!(engine.wants_inproc(), "el motor sigue sano");
        let (generation, diagnostics) = engine.last_diagnostics();
        assert_eq!(generation, 1);
        assert!(diagnostics.iter().any(|d| d.level == Level::Error));
    }

    #[test]
    fn un_paquete_sin_descargar_pasa_solo_esa_compilacion_al_clasico() {
        let (_dir, target) = project(&[("main.typ", "#import \"@preview/paquete-que-no-existe-dbv:0.0.1\": *")]);
        let engine = enabled();

        let Attempt::Fallback { sticky, reason } = run(&engine, &target, 1) else { panic!("debía pedir respaldo") };

        assert!(!sticky, "no desactiva el motor: el sidecar descarga y la siguiente lo encuentra");
        assert!(reason.contains("paquete"), "{reason}");
        assert!(engine.wants_inproc());
    }

    #[test]
    fn el_mundo_que_no_se_puede_montar_pide_respaldo() {
        let (dir, mut target) = project(&[("main.typ", "x")]);
        // Un documento principal fuera de la raíz del proyecto.
        target.document = dir.path().join("..").join("otro.typ").to_string_lossy().to_string();
        let engine = enabled();

        assert!(matches!(run(&engine, &target, 1), Attempt::Fallback { .. }));
    }

    #[test]
    fn una_peticion_superada_se_resuelve_como_superada_sin_colgar_la_llamada() {
        let (_dir, target) = project(&[("main.typ", "Texto.")]);
        let engine = enabled();
        let current = AtomicU64::new(2);

        // La generación 1 llega cuando la vigente ya es la 2.
        let attempt = tauri::async_runtime::block_on(engine.compile(
            &target,
            1,
            |generation| generation == current.load(Ordering::SeqCst),
            0,
            2,
        ));

        assert!(matches!(attempt, Attempt::Superseded));
    }

    #[test]
    fn dos_peticiones_seguidas_resuelven_ambas_y_solo_la_ultima_se_publica() {
        let (_dir, target) = project(&[("main.typ", "Texto.")]);
        let engine = Arc::new(enabled());
        let latest_generation = Arc::new(AtomicU64::new(0));

        let first = {
            let (engine, target, latest) = (engine.clone(), target.clone(), latest_generation.clone());
            std::thread::spawn(move || {
                latest.store(1, Ordering::SeqCst);
                tauri::async_runtime::block_on(engine.compile(&target, 1, |g| g == latest.load(Ordering::SeqCst), 0, 2))
            })
        };
        std::thread::sleep(Duration::from_millis(30));
        latest_generation.store(2, Ordering::SeqCst);
        let second = tauri::async_runtime::block_on(engine.compile(
            &target,
            2,
            |g| g == latest_generation.load(Ordering::SeqCst),
            0,
            2,
        ));
        let first = first.join().unwrap();

        assert!(matches!(second, Attempt::Done(_)), "la última se publica");
        assert!(matches!(first, Attempt::Superseded | Attempt::Done(_)), "la primera no puede quedarse colgada");
        assert!(engine.latest_for(2).is_some());
    }

    #[test]
    fn locate_y_reveal_consultan_el_mapa_de_la_generacion_vigente() {
        let (_dir, target) = project(&[("main.typ", "Hola mundo cruel.")]);
        let engine = enabled();
        let Attempt::Done(_) = run(&engine, &target, 3) else { panic!("debía compilar") };

        let rects = engine.reveal(3, "main.typ", 5, 10).unwrap();
        let (x, y) = (rects[0].x_pt + rects[0].w_pt / 2.0, rects[0].y_pt + rects[0].h_pt * 0.6);
        let located = engine.locate(3, 1, x, y).unwrap().expect("debe resolver");

        assert_eq!((located.file.as_str(), located.start_column, located.end_column), ("main.typ", 6, 11));
    }

    #[test]
    fn consultar_una_generacion_que_ya_no_es_la_vigente_es_un_error_explicito() {
        let (_dir, target) = project(&[("main.typ", "Hola.")]);
        let engine = enabled();
        let Attempt::Done(_) = run(&engine, &target, 1) else { panic!("debía compilar") };

        assert!(matches!(engine.locate(9, 1, 10.0, 10.0), Err(TypstError::PreviewExpired(_))));
        assert!(matches!(engine.reveal(9, "main.typ", 0, 1), Err(TypstError::PreviewExpired(_))));
    }

    #[test]
    fn cambiar_de_proyecto_crea_otro_mundo() {
        let (_a, target_a) = project(&[("main.typ", "Uno.")]);
        let (_b, target_b) = project(&[("main.typ", "Dos.\n#pagebreak()\nDos.")]);
        let engine = enabled();

        let Attempt::Done(a) = run(&engine, &target_a, 1) else { panic!("debía compilar") };
        let Attempt::Done(b) = run(&engine, &target_b, 2) else { panic!("debía compilar") };

        assert_eq!((a.geometry.len(), b.geometry.len()), (1, 2));
    }

    #[test]
    fn release_suelta_el_documento_y_los_diagnosticos() {
        let (_dir, target) = project(&[("main.typ", "Hola.")]);
        let engine = enabled();
        let Attempt::Done(_) = run(&engine, &target, 1) else { panic!("debía compilar") };

        engine.release();

        assert!(engine.latest_for(1).is_none());
        assert!(engine.last_diagnostics().1.is_empty());
    }

    #[test]
    fn volver_a_activar_el_motor_lo_rehabilita_tras_desactivarse_solo() {
        let engine = enabled();
        let _ = engine.disable("prueba".into());
        assert!(!engine.wants_inproc());
        assert_eq!(engine.disabled_reason().as_deref(), Some("prueba"));

        engine.set_mode(Mode::InProc);

        assert!(engine.wants_inproc());
    }

    #[test]
    fn describe_da_una_linea_con_fichero_linea_y_pistas() {
        let diagnostic = Diagnostic {
            level: Level::Error,
            message: "algo falló".into(),
            hints: vec!["prueba esto".into()],
            file: Some("cap.typ".into()),
            start_line: 4,
            start_column: 2,
            end_line: 4,
            end_column: 9,
        };

        assert_eq!(describe(&diagnostic), "error: algo falló (cap.typ:4:2)\n  hint: prueba esto");
    }
}
