// =============================================================================
// DBV Typst Editor — El "mundo" de Typst del motor en proceso (RF-56)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// `World` es lo que Typst le pide a quien lo embebe: ficheros, fuentes, la fecha
// y la biblioteca estándar. Aquí se implementa sobre `typst-kit`, con tres
// diferencias respecto al CLI que son el motivo de este módulo:
//
//   1. PERSISTENTE. Un mundo vive mientras el proyecto está abierto y conserva la
//      caché incremental de Typst (`comemo`): tras escribir una palabra solo se
//      recompone lo que cambió (0,5 s frente a ≈5 s medido en el Spike S-3).
//   2. SUSTITUCIONES EN MEMORIA. El contenido sin guardar del editor entra como
//      una sustitución del fichero, no como una réplica del proyecto en un
//      temporal: desaparecen la réplica, las anclas y las escrituras a disco.
//   3. SIN RED. Un paquete de Typst Universe que no esté ya en la caché falla con
//      un error tipado; la descarga la hace el sidecar (ADR-MOTOR-002, decisión 5).
//
// Las fuentes se reúnen en el MISMO orden que el CLI (sistema, embebidas, y las
// de la carpeta `fonts/` del proyecto): si dos fuentes se llaman igual, gana la
// misma que en el CLI, y la imagen coincide con la exportación.

use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock, Mutex, RwLock};

use typst::diag::FileResult;
use typst::foundations::{Bytes, Datetime, Duration};
use typst::syntax::{FileId, RootedPath, Source, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_ide::IdeWorld;
use typst_kit::datetime::Time;
use typst_kit::downloader::Downloader;
use typst_kit::files::{FileStore, FsRoot, SystemFiles};
use typst_kit::fonts::{self, FontStore};
use typst_kit::packages::{FsPackages, SystemPackages, UniversePackages};

/// Fallos al montar o usar el mundo. Tipado para que el motor pueda decidir el
/// respaldo al clásico sin interpretar cadenas.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EngineError {
    /// El documento principal no cuelga de la raíz del proyecto.
    MainOutsideRoot(String),
    /// Una ruta pasada al mundo no cuelga de la raíz del proyecto.
    PathOutsideRoot(String),
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MainOutsideRoot(path) => write!(f, "el documento principal {path} está fuera del proyecto"),
            Self::PathOutsideRoot(path) => write!(f, "{path} está fuera del proyecto"),
        }
    }
}

impl std::error::Error for EngineError {}

/// Descargador que nunca sale a la red: un paquete ausente se reporta como error
/// y lo resuelve el sidecar (que sí descarga y deja el paquete en la caché
/// compartida), tras lo cual el motor reintenta.
struct Offline;

impl Downloader for Offline {
    fn stream(&self, _: &dyn std::any::Any, url: &str) -> io::Result<(Option<usize>, Box<dyn Read>)> {
        Err(io::Error::new(
            io::ErrorKind::NotConnected,
            format!("el motor en proceso no descarga paquetes ({url})"),
        ))
    }
}

/// Mundo persistente de un proyecto.
pub struct EngineWorld {
    root: PathBuf,
    library: LazyHash<Library>,
    fonts: Arc<FontStore>,
    main: FileId,
    /// `RwLock`: las lecturas de Typst (que puede componer en paralelo) comparten;
    /// `reset` entre compilaciones toma el acceso exclusivo.
    files: RwLock<FileStore<SystemFiles>>,
    now: RwLock<Time>,
    overrides: RwLock<HashMap<FileId, Source>>,
}

impl EngineWorld {
    /// Monta el mundo de `root` con `main` (ruta absoluta) como documento raíz.
    pub fn new(root: &Path, main: &Path) -> Result<Arc<Self>, EngineError> {
        let vpath = VirtualPath::virtualize(root, main)
            .map_err(|_| EngineError::MainOutsideRoot(main.display().to_string()))?;
        let packages = SystemPackages::from_parts(
            FsPackages::system_data(),
            FsPackages::system_cache(),
            UniversePackages::new(Offline),
        );
        Ok(Arc::new(Self {
            root: root.to_path_buf(),
            library: LazyHash::new(Library::builder().build()),
            fonts: font_store(root),
            main: RootedPath::new(VirtualRoot::Project, vpath).intern(),
            files: RwLock::new(FileStore::new(SystemFiles::new(FsRoot::new(root.to_path_buf()), packages))),
            now: RwLock::new(Time::system()),
            overrides: RwLock::new(HashMap::new()),
        }))
    }

    /// Raíz del proyecto.
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Prepara el mundo para una compilación nueva: vuelve a leer del disco lo
    /// que haya cambiado (los ficheros cuyo contenido no cambió conservan su
    /// identidad, y con ella la caché incremental) y refresca la fecha.
    pub fn begin_compile(&self) {
        if let Ok(mut files) = self.files.write() {
            files.reset();
        }
        if let Ok(mut now) = self.now.write() {
            now.reset();
        }
    }

    /// Identificador de Typst de una ruta del proyecto.
    pub fn id_of(&self, path: &Path) -> Result<FileId, EngineError> {
        let vpath = VirtualPath::virtualize(&self.root, path)
            .map_err(|_| EngineError::PathOutsideRoot(path.display().to_string()))?;
        Ok(RootedPath::new(VirtualRoot::Project, vpath).intern())
    }

    /// Ruta del fichero de proyecto `id`, relativa a la raíz y con `/`; `None`
    /// para los ficheros de un paquete (no son del usuario).
    pub fn relative_path(&self, id: FileId) -> Option<String> {
        matches!(id.root(), VirtualRoot::Project).then(|| id.vpath().get_without_slash().to_string())
    }

    /// Sustituye el contenido de un fichero por el que el editor tiene sin
    /// guardar. Reutiliza el `Source` anterior (`replace`) para que Typst solo
    /// vuelva a analizar el trozo que cambió.
    pub fn set_override(&self, path: &Path, text: &str) -> Result<(), EngineError> {
        let id = self.id_of(path)?;
        if let Ok(mut overrides) = self.overrides.write() {
            match overrides.get_mut(&id) {
                Some(source) => {
                    source.replace(text);
                }
                None => {
                    overrides.insert(id, Source::new(id, text.to_string()));
                }
            }
        }
        Ok(())
    }

    /// Retira la sustitución de un fichero (el editor lo guardó o lo descartó).
    pub fn clear_override(&self, path: &Path) -> Result<(), EngineError> {
        let id = self.id_of(path)?;
        if let Ok(mut overrides) = self.overrides.write() {
            overrides.remove(&id);
        }
        Ok(())
    }

    /// Retira todas las sustituciones.
    pub fn clear_overrides(&self) {
        if let Ok(mut overrides) = self.overrides.write() {
            overrides.clear();
        }
    }
}

impl World for EngineWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }

    fn book(&self) -> &LazyHash<FontBook> {
        self.fonts.book()
    }

    fn main(&self) -> FileId {
        self.main
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        if let Ok(overrides) = self.overrides.read() {
            if let Some(source) = overrides.get(&id) {
                return Ok(source.clone());
            }
        }
        match self.files.read() {
            Ok(files) => files.source(id),
            Err(_) => Err(typst::diag::FileError::Other(Some("el mundo de Typst quedó inutilizado".into()))),
        }
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        match self.files.read() {
            Ok(files) => files.file(id),
            Err(_) => Err(typst::diag::FileError::Other(Some("el mundo de Typst quedó inutilizado".into()))),
        }
    }

    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.font(index)
    }

    fn today(&self, offset: Option<Duration>) -> Option<Datetime> {
        self.now.read().ok()?.today(offset)
    }
}

impl IdeWorld for EngineWorld {
    fn upcast(&self) -> &dyn World {
        self
    }
}

// ---------------------------------------------------------------------------
// Fuentes, reunidas una vez y compartidas: escanear el sistema cuesta 1-2 s.
// ---------------------------------------------------------------------------

/// Qué carpetas de fuentes hay, y qué contienen. Si cambia (se añade una
/// fuente al proyecto), las fuentes se vuelven a reunir.
#[derive(Clone, PartialEq, Eq)]
struct FontKey {
    paths: Vec<PathBuf>,
    contents: u64,
}

type CachedFonts = Option<(FontKey, Arc<FontStore>)>;

static FONTS: LazyLock<Mutex<CachedFonts>> = LazyLock::new(|| Mutex::new(None));

/// Carpetas de fuentes del proyecto. Como en el CLI, una carpeta `fonts/` propia
/// se pasa como `--font-path` y sustituye a lo que diga `TYPST_FONT_PATHS`.
fn project_font_paths(root: &Path) -> Vec<PathBuf> {
    let local = root.join("fonts");
    if local.is_dir() {
        return vec![local];
    }
    std::env::var_os("TYPST_FONT_PATHS")
        .map(|value| {
            std::env::split_paths(&value)
                .filter(|path| !path.as_os_str().is_empty())
                .map(|path| if path.is_absolute() { path } else { root.join(path) })
                .collect()
        })
        .unwrap_or_default()
}

/// Firma barata del contenido de una carpeta: nombres, tamaños y fechas.
fn folder_signature(path: &Path) -> u64 {
    let mut entries: Vec<(String, u64, u128)> = std::fs::read_dir(path)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let meta = entry.metadata().ok()?;
            let modified = meta
                .modified()
                .ok()
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map_or(0, |elapsed| elapsed.as_millis());
            Some((entry.file_name().to_string_lossy().to_string(), meta.len(), modified))
        })
        .collect();
    entries.sort();
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    entries.hash(&mut hasher);
    hasher.finish()
}

fn font_store(root: &Path) -> Arc<FontStore> {
    let paths = project_font_paths(root);
    let key = FontKey {
        contents: paths.iter().fold(0u64, |acc, path| acc.rotate_left(7) ^ folder_signature(path)),
        paths,
    };
    let mut cached = FONTS.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some((known, store)) = cached.as_ref() {
        if *known == key {
            return store.clone();
        }
    }
    // Orden del CLI: decide cuál de dos fuentes con el mismo nombre gana.
    let mut store = FontStore::new();
    store.extend(fonts::system());
    store.extend(fonts::embedded());
    for path in &key.paths {
        store.extend(fonts::scan(path));
    }
    let store = Arc::new(store);
    *cached = Some((key, store.clone()));
    store
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use typst_layout::PagedDocument;

    fn project(files: &[(&str, &str)]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for (name, text) in files {
            let full = dir.path().join(name);
            fs::create_dir_all(full.parent().unwrap()).unwrap();
            fs::write(full, text).unwrap();
        }
        dir
    }

    fn compile(world: &Arc<EngineWorld>) -> Result<PagedDocument, String> {
        world.begin_compile();
        typst::compile::<PagedDocument>(&**world)
            .output
            .map_err(|errors| errors.iter().map(|e| e.message.to_string()).collect::<Vec<_>>().join(" | "))
    }

    #[test]
    fn compila_un_proyecto_temporal() {
        let dir = project(&[("main.typ", "= Hola\nUn párrafo.")]);
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();

        let document = compile(&world).expect("debe compilar");

        assert_eq!(document.pages().len(), 1);
    }

    #[test]
    fn una_sustitucion_sin_guardar_se_ve_en_el_resultado_sin_tocar_el_disco() {
        let dir = project(&[
            ("main.typ", "#include \"cap.typ\"\n"),
            ("cap.typ", "Una página."),
        ]);
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();
        assert_eq!(compile(&world).unwrap().pages().len(), 1);

        // El editor tiene el capítulo con un salto de página que no ha guardado.
        world.set_override(&dir.path().join("cap.typ"), "Una página.\n#pagebreak()\nOtra.").unwrap();

        assert_eq!(compile(&world).unwrap().pages().len(), 2);
        assert_eq!(fs::read_to_string(dir.path().join("cap.typ")).unwrap(), "Una página.");
    }

    #[test]
    fn retirar_la_sustitucion_devuelve_el_contenido_del_disco() {
        let dir = project(&[("main.typ", "Uno.")]);
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();
        world.set_override(&dir.path().join("main.typ"), "Uno.\n#pagebreak()\nDos.").unwrap();
        assert_eq!(compile(&world).unwrap().pages().len(), 2);

        world.clear_override(&dir.path().join("main.typ")).unwrap();

        assert_eq!(compile(&world).unwrap().pages().len(), 1);
    }

    #[test]
    fn una_sustitucion_sucesiva_actualiza_el_mismo_fichero() {
        let dir = project(&[("main.typ", "Uno.")]);
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();
        let main = dir.path().join("main.typ");

        world.set_override(&main, "A.\n#pagebreak()\nB.").unwrap();
        assert_eq!(compile(&world).unwrap().pages().len(), 2);
        world.set_override(&main, "A.\n#pagebreak()\nB.\n#pagebreak()\nC.").unwrap();

        assert_eq!(compile(&world).unwrap().pages().len(), 3);
    }

    #[test]
    fn un_cambio_en_disco_entre_compilaciones_se_detecta() {
        let dir = project(&[("main.typ", "Uno.")]);
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();
        assert_eq!(compile(&world).unwrap().pages().len(), 1);

        fs::write(dir.path().join("main.typ"), "Uno.\n#pagebreak()\nDos.").unwrap();

        assert_eq!(compile(&world).unwrap().pages().len(), 2);
    }

    #[test]
    fn un_fichero_incluido_que_no_existe_da_un_error_no_una_caida() {
        let dir = project(&[("main.typ", "#include \"no-existe.typ\"")]);
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();

        let error = compile(&world).expect_err("debe fallar");

        assert!(error.contains("file not found") || error.contains("no-existe"), "{error}");
    }

    #[test]
    fn un_paquete_que_no_esta_en_la_cache_falla_sin_salir_a_la_red() {
        let dir = project(&[("main.typ", "#import \"@preview/paquete-que-no-existe-dbv:0.0.1\": *")]);
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();
        let started = std::time::Instant::now();

        let error = compile(&world).expect_err("debe fallar");

        assert!(error.to_lowercase().contains("package"), "{error}");
        // Sin red no hay espera de conexión: el fallo es inmediato.
        assert!(started.elapsed() < std::time::Duration::from_secs(5));
    }

    #[test]
    fn el_documento_principal_fuera_del_proyecto_es_un_error_tipado() {
        let dir = project(&[("main.typ", "x")]);
        let otro = project(&[("otro.typ", "y")]);

        let result = EngineWorld::new(dir.path(), &otro.path().join("otro.typ"));

        assert!(matches!(result, Err(EngineError::MainOutsideRoot(_))));
    }

    #[test]
    fn relative_path_da_la_ruta_del_proyecto_con_barras_normales() {
        let dir = project(&[("main.typ", "x"), ("capitulos/01.typ", "y")]);
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();

        let id = world.id_of(&dir.path().join("capitulos").join("01.typ")).unwrap();

        assert_eq!(world.relative_path(id).as_deref(), Some("capitulos/01.typ"));
    }

    #[test]
    fn una_ruta_de_fuera_del_proyecto_no_se_puede_sustituir() {
        let dir = project(&[("main.typ", "x")]);
        let otro = project(&[("otro.typ", "y")]);
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();

        let result = world.set_override(&otro.path().join("otro.typ"), "z");

        assert!(matches!(result, Err(EngineError::PathOutsideRoot(_))));
    }

    #[test]
    fn los_mundos_de_dos_proyectos_comparten_las_fuentes_ya_reunidas() {
        let a = project(&[("main.typ", "x")]);
        let b = project(&[("main.typ", "y")]);

        let first = font_store(a.path());
        let second = font_store(b.path());

        // Sin `fonts/` propia la clave es la misma: no se vuelve a escanear el sistema.
        assert!(Arc::ptr_eq(&first, &second));
    }
}
