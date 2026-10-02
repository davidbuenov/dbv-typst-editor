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

use serde::Deserialize;
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

/// Mundo de comprobación, reutilizado mientras no cambien raíz y principal.
#[derive(Default)]
pub struct CheckWorlds {
    current: Mutex<Option<(PathBuf, PathBuf, Arc<EngineWorld>)>>,
}

impl CheckWorlds {
    fn world(&self, root: &PathBuf, main: &PathBuf) -> Result<Arc<EngineWorld>, AiError> {
        let mut current = self.current.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some((known_root, known_main, world)) = current.as_ref() {
            if known_root == root && known_main == main {
                return Ok(world.clone());
            }
        }
        let world = EngineWorld::new(root, main).map_err(|error| AiError::Config(error.to_string()))?;
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
pub fn check(worlds: &CheckWorlds, root: &str, main: &str, files: &[FileContent]) -> Result<Vec<Diagnostic>, AiError> {
    let root = PathBuf::from(root);
    let main = PathBuf::from(main);
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
    Ok(result)
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

        let errors = check(&worlds, &root, &main, &[file(&dir, "cap.typ", "#no-existe")]).unwrap();
        assert!(errors.iter().any(|d| d.level == Level::Error && d.file.as_deref() == Some("cap.typ")), "{errors:?}");
        assert_eq!(std::fs::read_to_string(dir.path().join("cap.typ")).unwrap(), "Hola.");

        let fine = check(&worlds, &root, &main, &[file(&dir, "cap.typ", "= Capítulo\nTexto.")]).unwrap();
        assert!(fine.iter().all(|d| d.level != Level::Error), "{fine:?}");
    }

    #[test]
    fn un_fichero_nuevo_propuesto_se_puede_incluir() {
        let dir = project(&[("main.typ", "Inicio.")]);
        let worlds = CheckWorlds::default();
        let main = dir.path().join("main.typ").to_string_lossy().to_string();
        let root = dir.path().to_string_lossy().to_string();
        let proposal = [file(&dir, "main.typ", "#include \"caps/nuevo.typ\""), file(&dir, "caps/nuevo.typ", "= Nuevo")];
        let result = check(&worlds, &root, &main, &proposal).unwrap();
        assert!(result.iter().all(|d| d.level != Level::Error), "{result:?}");
        assert!(!dir.path().join("caps").exists(), "no se crea nada en disco");
    }

    #[test]
    fn la_comprobacion_no_deja_sustituciones_puestas() {
        let dir = project(&[("main.typ", "Bien.")]);
        let worlds = CheckWorlds::default();
        let main = dir.path().join("main.typ").to_string_lossy().to_string();
        let root = dir.path().to_string_lossy().to_string();
        check(&worlds, &root, &main, &[file(&dir, "main.typ", "#roto(")]).unwrap();
        let after = check(&worlds, &root, &main, &[]).unwrap();
        assert!(after.iter().all(|d| d.level != Level::Error), "{after:?}");
    }
}
