// =============================================================================
// DBV Typst Editor — ¿Compila la propuesta de la IA? (RF-93.3, RF-94.3)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Compila el proyecto con los cambios propuestos EN MEMORIA, sin tocar el
// disco ni el mundo de la vista previa: un mundo de comprobación propio,
// persistente por proyecto, para que la caché incremental de Typst haga que la
// segunda comprobación cueste décimas y no segundos (R-A7).
//
// Las sustituciones son lo que el editor tiene sin guardar MÁS la propuesta (lo
// que la IA cambiaría encima). El frontend compara el resultado con la
// compilación actual para decir «compila», «introduce N errores» o «corrige M».

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use typst::World;
use typst_layout::PagedDocument;

use super::AiError;
use crate::engine::diagnostics::{self, Diagnostic};
use crate::engine::world::EngineWorld;

/// Un fichero con su contenido (sin guardar o propuesto).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
}

/// Lo que el motor en proceso dice de un paquete que no tiene en la caché (`Offline`, `engine/world.rs`).
const MISSING_PACKAGE_MARKER: &str = "el motor en proceso no descarga paquetes";

/// El resultado de comprobar una propuesta (RF-93.3, RF-109.1).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckOutcome {
    /// Errores y avisos del compilador, SIN los de «falta un paquete».
    pub diagnostics: Vec<Diagnostic>,
    /// Paquetes `@preview/nombre:versión` que la propuesta importa y que no están instalados. No es un error
    /// del modelo: el usuario decide si se descargan (RNF-IA.9.4) y entonces se repite la comprobación.
    pub missing_packages: Vec<String>,
}

/// `@preview/nombre:versión` de un mensaje de «paquete sin descargar»: la URL que intentó el descargador
/// (`…/preview/nombre-versión.tar.gz`). `None` si el mensaje es otro.
fn missing_package(message: &str) -> Option<String> {
    let after = message.split(MISSING_PACKAGE_MARKER).nth(1)?;
    let archive = after.split("/preview/").nth(1)?.split(".tar.gz").next()?;
    let (name, version) = archive.rsplit_once('-')?;
    let version_ok = version.split('.').count() == 3 && version.split('.').all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()));
    let name_ok = !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    (version_ok && name_ok).then(|| format!("@preview/{name}:{version}"))
}

/// Separa los diagnósticos «falta un paquete» del resto, sin repetir paquetes.
fn split_missing(all: Vec<Diagnostic>) -> CheckOutcome {
    let mut diagnostics = Vec::new();
    let mut missing_packages: Vec<String> = Vec::new();
    for diagnostic in all {
        match missing_package(&diagnostic.message) {
            Some(id) => {
                if !missing_packages.contains(&id) {
                    missing_packages.push(id);
                }
            }
            None => diagnostics.push(diagnostic),
        }
    }
    CheckOutcome { diagnostics, missing_packages }
}

/// Mundo de comprobación, reutilizado mientras no cambien raíz y principal.
#[derive(Default)]
pub struct CheckWorlds {
    current: Mutex<Option<(PathBuf, PathBuf, Arc<EngineWorld>)>>,
    /// Caché de paquetes propia (pruebas); `None` = la del sistema, que comparte con el compilador.
    cache: Option<PathBuf>,
    /// Una comprobación a la vez: dos en paralelo sobre el mismo mundo se
    /// pisarían las sustituciones a mitad de compilación (hallado en
    /// `/code-simplify`: el veredicto podía ser el de la otra comprobación).
    exclusive: Mutex<()>,
}

impl CheckWorlds {
    /// Mundos de comprobación con la caché de paquetes en `dir` (pruebas).
    #[cfg(test)]
    pub fn with_cache(dir: PathBuf) -> Self {
        Self { cache: Some(dir), ..Self::default() }
    }

    fn world(&self, root: &PathBuf, main: &PathBuf) -> Result<Arc<EngineWorld>, AiError> {
        let mut current = self.current.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some((known_root, known_main, world)) = current.as_ref() {
            if known_root == root && known_main == main {
                return Ok(world.clone());
            }
        }
        let world = EngineWorld::new_with_cache(root, main, self.cache.as_deref()).map_err(|error| AiError::Config(error.to_string()))?;
        *current = Some((root.clone(), main.clone(), world.clone()));
        Ok(world)
    }

    /// Libera el mundo (al cerrar el proyecto).
    pub fn release(&self) {
        *self.current.lock().unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
    }
}

/// Compila `main` dentro de `root` con `files` sustituidos y devuelve sus
/// errores y avisos. Un pánico de Typst se devuelve como error, no tumba nada.
pub fn check(worlds: &CheckWorlds, root: &str, main: &str, files: &[FileContent]) -> Result<CheckOutcome, AiError> {
    let root = PathBuf::from(root);
    let main = PathBuf::from(main);
    let _turn = worlds.exclusive.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let world = worlds.world(&root, &main)?;
    let overrides: Vec<(PathBuf, String)> = files.iter().map(|file| (PathBuf::from(&file.path), file.content.clone())).collect();
    world.replace_overrides(&overrides);
    world.begin_compile();
    let warned = catch_unwind(AssertUnwindSafe(|| typst::compile::<PagedDocument>(&*world)))
        .map_err(|_| AiError::Server("Typst entró en pánico al comprobar la propuesta".into()))?;
    let mut all = warned.warnings.to_vec();
    if let Err(errors) = warned.output {
        all.extend(errors.iter().cloned());
    }
    let (sources, lookup, relative) = (world.override_snapshot(), world.clone(), world.clone());
    let result = diagnostics::collect(
        &all,
        &move |id| sources.get(&id).cloned().or_else(|| lookup.source(id).ok()),
        &move |id| relative.relative_path(id),
    );
    // La comprobación no debe dejar la propuesta puesta para la siguiente.
    // Sin `comemo::evict` aquí: la caché es global y envejecería la de la
    // vista previa; el motor de la vista previa ya la poda tras cada edición.
    world.clear_overrides();
    Ok(split_missing(result))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::diagnostics::Level;

    fn project(files: &[(&str, &str)]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for (name, text) in files {
            let full = dir.path().join(name);
            std::fs::create_dir_all(full.parent().unwrap()).unwrap();
            std::fs::write(full, text).unwrap();
        }
        dir
    }

    fn file(dir: &tempfile::TempDir, name: &str, content: &str) -> FileContent {
        FileContent { path: dir.path().join(name).to_string_lossy().to_string(), content: content.into() }
    }

    #[test]
    fn una_propuesta_con_error_lo_informa_sin_tocar_el_disco() {
        let dir = project(&[("main.typ", "#include \"cap.typ\"\n"), ("cap.typ", "Hola.")]);
        let worlds = CheckWorlds::default();
        let main = dir.path().join("main.typ").to_string_lossy().to_string();
        let root = dir.path().to_string_lossy().to_string();

        let errors = check(&worlds, &root, &main, &[file(&dir, "cap.typ", "#no-existe")]).unwrap().diagnostics;
        assert!(errors.iter().any(|d| d.level == Level::Error && d.file.as_deref() == Some("cap.typ")), "{errors:?}");
        assert_eq!(std::fs::read_to_string(dir.path().join("cap.typ")).unwrap(), "Hola.");

        let fine = check(&worlds, &root, &main, &[file(&dir, "cap.typ", "= Capítulo\nTexto.")]).unwrap().diagnostics;
        assert!(fine.iter().all(|d| d.level != Level::Error), "{fine:?}");
    }

    #[test]
    fn un_fichero_nuevo_propuesto_se_puede_incluir() {
        let dir = project(&[("main.typ", "Inicio.")]);
        let worlds = CheckWorlds::default();
        let main = dir.path().join("main.typ").to_string_lossy().to_string();
        let root = dir.path().to_string_lossy().to_string();
        let proposal = [file(&dir, "main.typ", "#include \"caps/nuevo.typ\""), file(&dir, "caps/nuevo.typ", "= Nuevo")];
        let result = check(&worlds, &root, &main, &proposal).unwrap().diagnostics;
        assert!(result.iter().all(|d| d.level != Level::Error), "{result:?}");
        assert!(!dir.path().join("caps").exists(), "no se crea nada en disco");
    }

    #[test]
    fn dos_comprobaciones_a_la_vez_no_se_mezclan() {
        let dir = project(&[("main.typ", "Bien.")]);
        let worlds = Arc::new(CheckWorlds::default());
        let main = dir.path().join("main.typ").to_string_lossy().to_string();
        let root = dir.path().to_string_lossy().to_string();
        let handles: Vec<_> = (0..8)
            .map(|i| {
                let (worlds, root, main) = (worlds.clone(), root.clone(), main.clone());
                let content = if i % 2 == 0 { "#roto(".to_string() } else { "Bien.".to_string() };
                let file = FileContent { path: main.clone(), content };
                std::thread::spawn(move || (i, check(&worlds, &root, &main, &[file]).unwrap().diagnostics))
            })
            .collect();
        for handle in handles {
            let (i, result) = handle.join().unwrap();
            let has_error = result.iter().any(|d| d.level == Level::Error);
            assert_eq!(has_error, i % 2 == 0, "la comprobación {i} recibió el resultado de otra");
        }
    }

    #[test]
    fn la_comprobacion_no_deja_sustituciones_puestas() {
        let dir = project(&[("main.typ", "Bien.")]);
        let worlds = CheckWorlds::default();
        let main = dir.path().join("main.typ").to_string_lossy().to_string();
        let root = dir.path().to_string_lossy().to_string();
        check(&worlds, &root, &main, &[file(&dir, "main.typ", "#roto(")]).unwrap();
        let after = check(&worlds, &root, &main, &[]).unwrap().diagnostics;
        assert!(after.iter().all(|d| d.level != Level::Error), "{after:?}");
    }

    const IMPORT_FALTA: &str = "#import \"@preview/paquete-que-no-existe-dbv:0.0.1\": f\nHola #f()";

    /// Un paquete «instalado» a mano en una caché de prueba (lo que deja `install_with`).
    fn install_by_hand(cache: &std::path::Path, name: &str, version: &str, lib: &str) {
        let dir = cache.join(format!("preview/{name}/{version}"));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("typst.toml"), format!("[package]\nname = \"{name}\"\nversion = \"{version}\"\nentrypoint = \"lib.typ\"\n")).unwrap();
        std::fs::write(dir.join("lib.typ"), lib).unwrap();
    }

    #[test]
    fn el_mensaje_de_paquete_sin_descargar_se_reconoce_y_da_el_identificador() {
        // Texto real del motor en proceso, capturado el 2026-10-04.
        let real = "failed to download package (el motor en proceso no descarga paquetes (https://packages.typst.org/preview/paquete-que-no-existe-dbv-0.0.1.tar.gz))";
        assert_eq!(missing_package(real).as_deref(), Some("@preview/paquete-que-no-existe-dbv:0.0.1"));
        assert_eq!(missing_package("unknown variable: x"), None);
        assert_eq!(missing_package("el motor en proceso no descarga paquetes (https://evil.example/x.tar.gz)"), None);
        assert_eq!(missing_package("el motor en proceso no descarga paquetes (https://packages.typst.org/preview/x-1.0.tar.gz)"), None, "versión sin tres partes");
    }

    #[test]
    fn un_paquete_sin_instalar_no_es_un_error_del_modelo() {
        let dir = project(&[("main.typ", "Inicio.")]);
        let cache = tempfile::tempdir().unwrap();
        let worlds = CheckWorlds::with_cache(cache.path().to_path_buf());
        let main = dir.path().join("main.typ").to_string_lossy().to_string();
        let root = dir.path().to_string_lossy().to_string();

        let outcome = check(&worlds, &root, &main, &[file(&dir, "main.typ", IMPORT_FALTA)]).unwrap();

        assert_eq!(outcome.missing_packages, vec!["@preview/paquete-que-no-existe-dbv:0.0.1".to_string()]);
        assert!(outcome.diagnostics.iter().all(|d| !d.message.contains("no descarga paquetes")), "{:?}", outcome.diagnostics);
        assert!(!cache.path().join("preview").exists(), "comprobar no instala ni crea nada");
    }

    #[test]
    fn tras_instalar_y_liberar_el_mundo_la_misma_propuesta_compila() {
        let dir = project(&[("main.typ", "Inicio.")]);
        let cache = tempfile::tempdir().unwrap();
        let worlds = CheckWorlds::with_cache(cache.path().to_path_buf());
        let main = dir.path().join("main.typ").to_string_lossy().to_string();
        let root = dir.path().to_string_lossy().to_string();
        let proposal = [file(&dir, "main.typ", IMPORT_FALTA)];
        assert_eq!(check(&worlds, &root, &main, &proposal).unwrap().missing_packages.len(), 1);

        install_by_hand(cache.path(), "paquete-que-no-existe-dbv", "0.0.1", "#let f() = [Hecho]");
        worlds.release();
        let after = check(&worlds, &root, &main, &proposal).unwrap();

        assert!(after.missing_packages.is_empty(), "{after:?}");
        assert!(after.diagnostics.iter().all(|d| d.level != Level::Error), "{:?}", after.diagnostics);
    }

    #[test]
    fn instalar_sin_liberar_el_mundo_tambien_se_ve_en_la_siguiente_comprobacion() {
        // Si `comemo` o el almacén de ficheros recordaran el fallo, `release` sería imprescindible: se comprueba que no hace falta.
        let dir = project(&[("main.typ", "Inicio.")]);
        let cache = tempfile::tempdir().unwrap();
        let worlds = CheckWorlds::with_cache(cache.path().to_path_buf());
        let main = dir.path().join("main.typ").to_string_lossy().to_string();
        let root = dir.path().to_string_lossy().to_string();
        let proposal = [file(&dir, "main.typ", IMPORT_FALTA)];
        assert_eq!(check(&worlds, &root, &main, &proposal).unwrap().missing_packages.len(), 1);
        install_by_hand(cache.path(), "paquete-que-no-existe-dbv", "0.0.1", "#let f() = [Hecho]");
        let after = check(&worlds, &root, &main, &proposal).unwrap();
        assert!(after.missing_packages.is_empty(), "el mundo sigue recordando que faltaba: {after:?}");
    }

    #[test]
    fn con_un_paquete_ausente_la_comprobacion_es_incompleta_y_el_error_real_sale_al_instalarlo() {
        // El compilador se detiene en el `#import` que falla: un error real de un fichero posterior queda oculto
        // hasta que el paquete está. Por eso el frontend dice «no se pudo comprobar del todo» y, tras instalar,
        // repite la comprobación (RF-109.1, RF-109.2).
        let dir = project(&[("main.typ", "Inicio."), ("cap.typ", "Hola.")]);
        let cache = tempfile::tempdir().unwrap();
        let worlds = CheckWorlds::with_cache(cache.path().to_path_buf());
        let main = dir.path().join("main.typ").to_string_lossy().to_string();
        let root = dir.path().to_string_lossy().to_string();
        let proposal = [file(&dir, "main.typ", &format!("{IMPORT_FALTA}\n#include \"cap.typ\"")), file(&dir, "cap.typ", "#no-existe-de-verdad")];

        let before = check(&worlds, &root, &main, &proposal).unwrap();
        assert_eq!(before.missing_packages.len(), 1);
        assert!(before.diagnostics.iter().all(|d| d.level != Level::Error), "{:?}", before.diagnostics);

        install_by_hand(cache.path(), "paquete-que-no-existe-dbv", "0.0.1", "#let f() = [Hecho]");
        let after = check(&worlds, &root, &main, &proposal).unwrap();
        assert!(after.missing_packages.is_empty());
        assert!(after.diagnostics.iter().any(|d| d.level == Level::Error && d.file.as_deref() == Some("cap.typ")), "{:?}", after.diagnostics);
    }
}
