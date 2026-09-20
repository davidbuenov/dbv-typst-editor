// =============================================================================
// DBV Typst Editor — Hilo de compilación del motor en proceso (RF-56.3)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Una compilación en proceso NO se puede cancelar a mitad (el CLI sí, matando el
// proceso): `typst::compile` no ofrece ningún punto de aborto. Este módulo lo
// asume en vez de fingir lo contrario:
//
//   · La compilación corre en un HILO PROPIO, nunca en el de la interfaz.
//   · La cola es de UNA PLAZA: si llegan tres peticiones mientras una compila,
//     solo la última llega a ejecutarse ("gana la última"). Las intermedias no
//     se compilan nunca; la que está en marcha termina y su resultado se entrega
//     con su generación para que quien la recibe lo descarte por obsoleto.
//   · Un PÁNICO dentro de Typst no tumba el proceso de la aplicación (y con él el
//     editor y el texto sin guardar): se contiene con `catch_unwind` y se
//     devuelve como un resultado tipado que activa el respaldo al motor clásico.
//   · Tras cada compilación se llama a `comemo::evict(2)`. Medido en /plan sobre
//     un libro de 224 páginas: con `evict(10)` el pico de memoria era de 3,5 GB,
//     con `evict(2)` de 2,75 GB con la misma velocidad (0,50 s por edición), y con
//     `evict(0)` cada edición volvía a costar 3,4 s porque se tira la caché
//     incremental. La velocidad depende de conservar esa caché.
//   · El plazo de 45 s lo vigila quien tiene el `Worker` (`busy_for`): una
//     compilación colgada no se puede matar, se ABANDONA y se crea otro mundo.

use std::any::Any;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};

use typst::diag::{SourceDiagnostic, SourceResult, Warned};
use typst_layout::PagedDocument;

use super::world::EngineWorld;

/// Generaciones de caché que `comemo` conserva tras cada compilación.
pub const EVICT_AGE: usize = 2;

/// Una petición de compilación: qué generación es y qué ficheros tiene el editor
/// sin guardar (el conjunto COMPLETO: lo que no aparezca deja de estar sustituido).
#[derive(Debug, Clone)]
pub struct Request {
    pub generation: u64,
    pub overrides: Vec<(PathBuf, String)>,
}

/// Cómo terminó una compilación.
pub enum Outcome {
    /// Compiló: el documento y los avisos.
    Compiled { document: Arc<PagedDocument>, warnings: Vec<SourceDiagnostic> },
    /// El documento tiene errores (los de Typst, con su fichero y rango).
    Failed { errors: Vec<SourceDiagnostic>, warnings: Vec<SourceDiagnostic> },
    /// Typst entró en pánico. La aplicación sigue viva; el motor debe darse por
    /// no fiable y pasar al clásico.
    Panicked(String),
}

/// Resultado de una compilación, con la generación de la que salió.
pub struct CompileResult {
    pub generation: u64,
    pub elapsed: Duration,
    pub outcome: Outcome,
}

/// Quién recibe los resultados. Se llama desde el hilo de compilación.
pub type ResultSink = Arc<dyn Fn(CompileResult) + Send + Sync>;

/// Cómo se compila. La real es `typst::compile`; existe como parámetro para poder
/// probar el hilo con compiladores lentos o que fallan sin depender del reloj.
pub type Compiler = Arc<dyn Fn(&Arc<EngineWorld>, &Request) -> Warned<SourceResult<PagedDocument>> + Send + Sync>;

struct State {
    pending: Option<Request>,
    shutdown: bool,
}

struct Shared {
    state: Mutex<State>,
    wake: Condvar,
    busy_since: Mutex<Option<Instant>>,
}

/// El hilo de compilación de un proyecto.
pub struct Worker {
    shared: Arc<Shared>,
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl Worker {
    /// Arranca el hilo con el compilador real de Typst.
    pub fn spawn(world: Arc<EngineWorld>, sink: ResultSink) -> Self {
        Self::with_compiler(world, sink, Arc::new(|world, _| typst::compile::<PagedDocument>(&**world)))
    }

    /// Arranca el hilo con un compilador dado (pruebas).
    pub fn with_compiler(world: Arc<EngineWorld>, sink: ResultSink, compiler: Compiler) -> Self {
        let shared = Arc::new(Shared {
            state: Mutex::new(State { pending: None, shutdown: false }),
            wake: Condvar::new(),
            busy_since: Mutex::new(None),
        });
        let thread_shared = shared.clone();
        std::thread::Builder::new()
            .name("dbv-typst-compile".into())
            .spawn(move || run(thread_shared, world, sink, compiler))
            .expect("no se pudo crear el hilo de compilación");
        Self { shared }
    }

    /// Encola una petición. Si había otra esperando, se descarta: gana la última.
    pub fn submit(&self, request: Request) {
        let mut state = lock(&self.shared.state);
        state.pending = Some(request);
        self.shared.wake.notify_one();
    }

    /// Cuánto lleva compilando la petición en curso, o `None` si está libre. Es lo
    /// que permite vigilar el plazo sin poder matar la compilación.
    pub fn busy_for(&self) -> Option<Duration> {
        lock(&self.shared.busy_since).map(|since| since.elapsed())
    }
}

impl Drop for Worker {
    fn drop(&mut self) {
        // El hilo acaba tras la compilación en curso, si la hay: no se puede
        // cortar, pero tampoco se queda esperando trabajo nuevo.
        let mut state = lock(&self.shared.state);
        state.shutdown = true;
        state.pending = None;
        self.shared.wake.notify_one();
    }
}

fn run(shared: Arc<Shared>, world: Arc<EngineWorld>, sink: ResultSink, compiler: Compiler) {
    loop {
        let request = {
            let mut state = lock(&shared.state);
            loop {
                if state.shutdown {
                    return;
                }
                if let Some(request) = state.pending.take() {
                    break request;
                }
                state = shared.wake.wait(state).unwrap_or_else(|poisoned| poisoned.into_inner());
            }
        };

        *lock(&shared.busy_since) = Some(Instant::now());
        let started = Instant::now();
        let outcome = compile_once(&world, &request, &compiler);
        typst::comemo::evict(EVICT_AGE);
        *lock(&shared.busy_since) = None;

        sink(CompileResult { generation: request.generation, elapsed: started.elapsed(), outcome });
    }
}

/// Una compilación completa: sustituciones, relectura del disco, y Typst dentro
/// de un `catch_unwind`.
fn compile_once(world: &Arc<EngineWorld>, request: &Request, compiler: &Compiler) -> Outcome {
    world.replace_overrides(&request.overrides);
    world.begin_compile();

    match catch_unwind(AssertUnwindSafe(|| compiler(world, request))) {
        Ok(Warned { output: Ok(document), warnings }) => {
            Outcome::Compiled { document: Arc::new(document), warnings: warnings.to_vec() }
        }
        Ok(Warned { output: Err(errors), warnings }) => {
            Outcome::Failed { errors: errors.to_vec(), warnings: warnings.to_vec() }
        }
        Err(payload) => Outcome::Panicked(panic_message(payload)),
    }
}

/// Texto legible de la carga de un pánico.
fn panic_message(payload: Box<dyn Any + Send>) -> String {
    if let Some(text) = payload.downcast_ref::<&str>() {
        return (*text).to_string();
    }
    if let Some(text) = payload.downcast_ref::<String>() {
        return text.clone();
    }
    "pánico sin mensaje".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::mpsc::{channel, Receiver};

    fn project(text: &str) -> (tempfile::TempDir, Arc<EngineWorld>) {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), text).unwrap();
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();
        (dir, world)
    }

    fn sink() -> (ResultSink, Receiver<CompileResult>) {
        let (tx, rx) = channel();
        let tx = Mutex::new(tx);
        let sink: ResultSink = Arc::new(move |result| {
            let _ = lock(&tx).send(result);
        });
        (sink, rx)
    }

    fn wait(rx: &Receiver<CompileResult>) -> CompileResult {
        rx.recv_timeout(Duration::from_secs(60)).expect("la compilación debía terminar")
    }

    fn request(generation: u64) -> Request {
        Request { generation, overrides: Vec::new() }
    }

    #[test]
    fn compila_en_su_hilo_y_entrega_el_documento_con_su_generacion() {
        let (_dir, world) = project("= Hola\nTexto.");
        let (sink, rx) = sink();
        let worker = Worker::spawn(world, sink);

        worker.submit(request(7));
        let result = wait(&rx);

        assert_eq!(result.generation, 7);
        match result.outcome {
            Outcome::Compiled { document, .. } => assert_eq!(document.pages().len(), 1),
            _ => panic!("debía compilar"),
        }
    }

    #[test]
    fn un_documento_con_errores_llega_como_fallo_con_sus_diagnosticos() {
        let (_dir, world) = project("#include \"no-existe.typ\"");
        let (sink, rx) = sink();
        let worker = Worker::spawn(world, sink);

        worker.submit(request(1));

        match wait(&rx).outcome {
            Outcome::Failed { errors, .. } => assert!(!errors.is_empty()),
            _ => panic!("debía fallar"),
        }
    }

    #[test]
    fn gana_la_ultima_las_intermedias_no_se_compilan() {
        let (_dir, world) = project("x");
        let (sink, rx) = sink();
        let compiled = Arc::new(Mutex::new(Vec::new()));
        let seen = compiled.clone();
        // La generación 1 tarda: mientras compila llegan la 2, la 3 y la 4.
        let compiler: Compiler = Arc::new(move |world, request| {
            lock(&seen).push(request.generation);
            if request.generation == 1 {
                std::thread::sleep(Duration::from_millis(300));
            }
            typst::compile::<PagedDocument>(&**world)
        });
        let worker = Worker::with_compiler(world, sink, compiler);

        worker.submit(request(1));
        std::thread::sleep(Duration::from_millis(80));
        worker.submit(request(2));
        worker.submit(request(3));
        worker.submit(request(4));
        let first = wait(&rx);
        let second = wait(&rx);

        assert_eq!((first.generation, second.generation), (1, 4));
        assert_eq!(*lock(&compiled), vec![1, 4], "la 2 y la 3 no debían compilarse");
    }

    #[test]
    fn un_panico_de_typst_no_tumba_el_proceso_y_se_entrega_como_resultado() {
        let (_dir, world) = project("x");
        let (sink, rx) = sink();
        let compiler: Compiler = Arc::new(|_, request| {
            if request.generation == 1 {
                panic!("fallo interno simulado de Typst");
            }
            unreachable!("solo se pide la generación 1");
        });
        let worker = Worker::with_compiler(world, sink, compiler);

        worker.submit(request(1));

        match wait(&rx).outcome {
            Outcome::Panicked(message) => assert!(message.contains("fallo interno simulado"), "{message}"),
            _ => panic!("debía reportar el pánico"),
        }
    }

    #[test]
    fn tras_un_panico_el_mismo_hilo_sigue_compilando() {
        let (_dir, world) = project("Texto.");
        let (sink, rx) = sink();
        let compiler: Compiler = Arc::new(|world, request| {
            if request.generation == 1 {
                panic!("solo la primera");
            }
            typst::compile::<PagedDocument>(&**world)
        });
        let worker = Worker::with_compiler(world, sink, compiler);

        worker.submit(request(1));
        assert!(matches!(wait(&rx).outcome, Outcome::Panicked(_)));
        worker.submit(request(2));

        assert!(matches!(wait(&rx).outcome, Outcome::Compiled { .. }));
    }

    #[test]
    fn busy_for_informa_mientras_compila_y_es_none_cuando_esta_libre() {
        let (_dir, world) = project("x");
        let (sink, rx) = sink();
        let compiler: Compiler = Arc::new(|world, _| {
            std::thread::sleep(Duration::from_millis(250));
            typst::compile::<PagedDocument>(&**world)
        });
        let worker = Worker::with_compiler(world, sink, compiler);
        assert!(worker.busy_for().is_none());

        worker.submit(request(1));
        std::thread::sleep(Duration::from_millis(100));
        let during = worker.busy_for();
        let _ = wait(&rx);
        // El hilo baja `busy_since` después de compilar y antes de entregar; se
        // le da un instante para que el cambio sea visible.
        std::thread::sleep(Duration::from_millis(50));

        assert!(during.is_some_and(|elapsed| elapsed >= Duration::from_millis(50)));
        assert!(worker.busy_for().is_none());
    }

    #[test]
    fn las_sustituciones_de_la_peticion_llegan_al_compilador() {
        let (dir, world) = project("Una.");
        let (sink, rx) = sink();
        let worker = Worker::spawn(world, sink);

        worker.submit(Request {
            generation: 1,
            overrides: vec![(dir.path().join("main.typ"), "Una.\n#pagebreak()\nDos.".into())],
        });

        match wait(&rx).outcome {
            Outcome::Compiled { document, .. } => assert_eq!(document.pages().len(), 2),
            _ => panic!("debía compilar"),
        }
    }

    #[test]
    fn una_peticion_sin_sustituciones_retira_las_de_la_anterior() {
        let (dir, world) = project("Una.");
        let (sink, rx) = sink();
        let worker = Worker::spawn(world, sink);
        worker.submit(Request {
            generation: 1,
            overrides: vec![(dir.path().join("main.typ"), "Una.\n#pagebreak()\nDos.".into())],
        });
        assert!(matches!(wait(&rx).outcome, Outcome::Compiled { document, .. } if document.pages().len() == 2));

        // El editor guardó o descartó: ya no hay nada sin guardar.
        worker.submit(request(2));

        match wait(&rx).outcome {
            Outcome::Compiled { document, .. } => assert_eq!(document.pages().len(), 1),
            _ => panic!("debía compilar"),
        }
    }

    #[test]
    fn panic_message_lee_las_dos_formas_de_carga() {
        assert_eq!(panic_message(Box::new("literal")), "literal");
        assert_eq!(panic_message(Box::new(String::from("cadena"))), "cadena");
        assert_eq!(panic_message(Box::new(42_u8)), "pánico sin mensaje");
    }
}
