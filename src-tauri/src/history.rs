// =============================================================================
// DBV Typst Editor — Historial local de versiones (RF-73)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La red de seguridad del guardado automático (RF-64) y de las reescrituras
// automáticas (RF-70, RF-71): antes de sobrescribir un fichero del proyecto se
// guarda una copia de lo que había, FUERA del proyecto (en la carpeta de datos
// de la aplicación), para no ensuciarlo ni a él ni a Git.
//
// La copia se toma aquí, en el backend, dentro de cada escritura (R-H2): así
// cubre también lo que escribe Rust sin pasar por el frontend. Solo «antes de
// recargar desde disco» la pide el frontend, porque lo que se pierde ahí es el
// contenido del editor, que no está en disco.
//
// Estructura: `<datos>/history/<proyecto>/<fichero>/index.json` + `<id>.txt`,
// donde `<proyecto>` y `<fichero>` son huellas FNV-1a de la raíz canónica y de
// la ruta relativa. FNV y no el `DefaultHasher` de Rust: este no es estable
// entre versiones del compilador, y tras una actualización de la aplicación el
// historial dejaría de encontrarse. Si se mueve la carpeta del proyecto, su
// historial deja de verse (decisión del usuario, plan §6).

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::commands::file_io::MAX_TEXT_BYTES;
use crate::commands::fs_ops::Moved;
use crate::error::AppError;

/// Guardados automáticos: como mucho una versión cada 5 minutos por fichero.
pub const AUTO_CONSOLIDATION_MS: u64 = 5 * 60 * 1000;
/// Retención por fichero.
pub const MAX_VERSIONS_PER_FILE: usize = 50;
pub const MAX_AGE_MS: u64 = 30 * 24 * 60 * 60 * 1000;
/// Tope total del historial, para todos los proyectos.
pub const MAX_TOTAL_BYTES: u64 = 200 * 1024 * 1024;

/// Huella FNV-1a de 64 bits, estable entre versiones y plataformas.
fn fnv1a(text: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in text.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0100_0000_01b3);
    }
    format!("{hash:016x}")
}

const CASE_INSENSITIVE: bool = cfg!(any(windows, target_os = "macos"));

/// Clave de una ruta: sin distinguir mayúsculas donde el sistema no lo hace.
fn key_of(text: &str) -> String {
    let normalized = text.replace('\\', "/");
    fnv1a(&if CASE_INSENSITIVE { normalized.to_lowercase() } else { normalized })
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0)
}

/// Una versión guardada.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Version {
    /// Milisegundos desde epoch; también es el nombre del fichero guardado.
    pub id: u64,
    /// `save`, `auto`, `reload`, `refs`.
    pub reason: String,
    pub size: u64,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct Index {
    relative: String,
    versions: Vec<Version>,
}

/// Si una copia con `reason` y huella `hash` debe guardarse (RF-73.3): no si
/// repite el contenido de la última, ni si es un guardado automático y ya hay
/// otro de hace menos de `AUTO_CONSOLIDATION_MS`.
pub fn should_store(versions: &[Version], reason: &str, hash: &str, now: u64) -> bool {
    if versions.last().is_some_and(|last| last.hash == hash) {
        return false;
    }
    if reason == "auto" {
        let recent_auto = versions
            .iter()
            .rev()
            .any(|v| v.reason == "auto" && now.saturating_sub(v.id) < AUTO_CONSOLIDATION_MS);
        return !recent_auto;
    }
    true
}

/// Versiones que sobran (RF-73.4): más antiguas que `MAX_AGE_MS`, y las que
/// excedan `MAX_VERSIONS_PER_FILE` empezando por las más antiguas.
pub fn prune(versions: &[Version], now: u64) -> Vec<u64> {
    let mut remove: Vec<u64> = versions.iter().filter(|v| now.saturating_sub(v.id) > MAX_AGE_MS).map(|v| v.id).collect();
    let alive: Vec<&Version> = versions.iter().filter(|v| !remove.contains(&v.id)).collect();
    if alive.len() > MAX_VERSIONS_PER_FILE {
        remove.extend(alive[..alive.len() - MAX_VERSIONS_PER_FILE].iter().map(|v| v.id));
    }
    remove
}

/// Qué versiones borrar (de todas, las más antiguas primero) para que el total
/// quede por debajo de `max_bytes`. Cada elemento es `(id, tamaño, clave)`.
pub fn over_budget<T: Clone>(mut all: Vec<(u64, u64, T)>, max_bytes: u64) -> Vec<(u64, T)> {
    let mut total: u64 = all.iter().map(|(_, size, _)| size).sum();
    all.sort_by_key(|(id, _, _)| *id);
    let mut remove = Vec::new();
    for (id, size, key) in all {
        if total <= max_bytes {
            break;
        }
        total -= size;
        remove.push((id, key));
    }
    remove
}

/// El almacén del historial en una carpeta base.
#[derive(Debug, Clone)]
pub struct Store {
    base: PathBuf,
}

impl Store {
    pub fn new(base: PathBuf) -> Self {
        Self { base }
    }

    fn project_dir(&self, root: &Path) -> PathBuf {
        self.base.join(key_of(&root.to_string_lossy()))
    }

    fn file_dir(&self, root: &Path, relative: &str) -> PathBuf {
        self.project_dir(root).join(key_of(relative))
    }

    fn read_index(dir: &Path) -> Index {
        fs::read_to_string(dir.join("index.json"))
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }

    fn write_index(dir: &Path, index: &Index) -> std::io::Result<()> {
        let raw = serde_json::to_string(index).map_err(std::io::Error::other)?;
        crate::commands::file_io::write_atomic(&dir.join("index.json"), &raw)
    }

    /// Guarda `content` como versión de `relative`. Devuelve si se guardó.
    pub fn snapshot(&self, root: &Path, relative: &str, content: &[u8], reason: &str, now: u64) -> std::io::Result<bool> {
        if content.len() as u64 > MAX_TEXT_BYTES || std::str::from_utf8(content).is_err() {
            return Ok(false);
        }
        let dir = self.file_dir(root, relative);
        let mut index = Self::read_index(&dir);
        let hash = crate::commands::file_io::content_hash(content);
        if !should_store(&index.versions, reason, &hash, now) {
            return Ok(false);
        }
        fs::create_dir_all(&dir)?;
        let mut id = now;
        while index.versions.iter().any(|v| v.id == id) {
            id += 1;
        }
        fs::write(dir.join(format!("{id}.txt")), content)?;
        index.relative = relative.to_string();
        index.versions.push(Version { id, reason: reason.to_string(), size: content.len() as u64, hash });
        for old in prune(&index.versions, now) {
            let _ = fs::remove_file(dir.join(format!("{old}.txt")));
            index.versions.retain(|v| v.id != old);
        }
        Self::write_index(&dir, &index)?;
        Ok(true)
    }

    /// Versiones de `relative`, de la más reciente a la más antigua.
    pub fn list(&self, root: &Path, relative: &str) -> Vec<Version> {
        let mut versions = Self::read_index(&self.file_dir(root, relative)).versions;
        versions.reverse();
        versions
    }

    pub fn read(&self, root: &Path, relative: &str, id: u64) -> std::io::Result<String> {
        fs::read_to_string(self.file_dir(root, relative).join(format!("{id}.txt")))
    }

    /// El historial sigue al fichero movido o renombrado desde la aplicación
    /// (RF-73.6). `moves` son pares de rutas relativas `desde → hasta`; una
    /// carpeta movida arrastra el historial de todo lo que contiene.
    pub fn follow_moves(&self, root: &Path, moves: &[(String, String)]) {
        let Ok(entries) = fs::read_dir(self.project_dir(root)) else { return };
        for entry in entries.flatten() {
            let dir = entry.path();
            let mut index = Self::read_index(&dir);
            if index.relative.is_empty() {
                continue;
            }
            let Some(moved_to) = crate::refs::remap(&index.relative, moves, CASE_INSENSITIVE) else { continue };
            let target = self.file_dir(root, &moved_to);
            if target.exists() && target != dir {
                continue;
            }
            index.relative = moved_to;
            if Self::write_index(&dir, &index).is_ok() && target != dir {
                let _ = fs::rename(&dir, &target);
            }
        }
    }

    /// Borra versiones antiguas de TODOS los proyectos hasta quedar por debajo
    /// de `max_bytes` (RF-73.4).
    pub fn enforce_total(&self, max_bytes: u64) {
        let mut all = Vec::new();
        let Ok(projects) = fs::read_dir(&self.base) else { return };
        for project in projects.flatten() {
            let Ok(files) = fs::read_dir(project.path()) else { continue };
            for file in files.flatten() {
                let dir = file.path();
                for version in Self::read_index(&dir).versions {
                    all.push((version.id, version.size, dir.clone()));
                }
            }
        }
        for (id, dir) in over_budget(all, max_bytes) {
            let _ = fs::remove_file(dir.join(format!("{id}.txt")));
            let mut index = Self::read_index(&dir);
            index.versions.retain(|v| v.id != id);
            let _ = Self::write_index(&dir, &index);
        }
    }

    pub fn clear(&self) -> std::io::Result<()> {
        if self.base.exists() {
            fs::remove_dir_all(&self.base)?;
        }
        Ok(())
    }
}

// ── Configuración global ─────────────────────────────────────────────────────
//
// Global porque la escritura (`write_file`, `refs.rs`, `chapters.rs`) no recibe
// estado de Tauri y se prueba sin él: sin `init`, todo esto no hace nada.

struct Config {
    store: Store,
    root: Option<PathBuf>,
    enabled: bool,
}

static CONFIG: Mutex<Option<Config>> = Mutex::new(None);

/// Se llama una vez al arrancar, con la carpeta de datos de la aplicación.
pub fn init(base: PathBuf) {
    if let Ok(mut config) = CONFIG.lock() {
        *config = Some(Config { store: Store::new(base), root: None, enabled: true });
    }
}

/// Ruta relativa (con `/`) de `path` dentro de `root`.
fn relative_in(root: &Path, path: &Path) -> Option<String> {
    let path = dunce::canonicalize(path).ok().or_else(|| {
        // El fichero puede no existir aún (se va a crear): su carpeta sí.
        let parent = dunce::canonicalize(path.parent()?).ok()?;
        Some(parent.join(path.file_name()?))
    })?;
    let relative = path.strip_prefix(root).ok()?;
    Some(relative.components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/"))
}

/// Guarda como versión el contenido ACTUAL de `path` antes de sobrescribirlo.
/// No hace nada si el historial no está activo, si el fichero no existe o si
/// queda fuera del proyecto abierto. Nunca falla: el historial no debe
/// impedir guardar.
pub fn capture_before_write(path: &Path, reason: &str) {
    let Ok(config) = CONFIG.lock() else { return };
    let Some(config) = config.as_ref().filter(|c| c.enabled) else { return };
    let Some(root) = config.root.as_ref() else { return };
    let Some(relative) = relative_in(root, path) else { return };
    if let Ok(bytes) = fs::read(path) {
        let _ = config.store.snapshot(root, &relative, &bytes, reason, now_ms());
    }
}

/// El historial sigue a los ficheros movidos desde el árbol (rutas absolutas).
pub fn follow_moved(moved: &[Moved]) {
    let Ok(config) = CONFIG.lock() else { return };
    let Some(config) = config.as_ref() else { return };
    let Some(root) = config.root.as_ref() else { return };
    let pairs: Vec<(String, String)> = moved
        .iter()
        .filter_map(|m| Some((relative_in(root, Path::new(&m.from))?, relative_in(root, Path::new(&m.to))?)))
        .collect();
    config.store.follow_moves(root, &pairs);
}

fn with_config<T>(action: impl FnOnce(&Config, &Path) -> Result<T, AppError>) -> Result<T, AppError> {
    let config = CONFIG.lock().map_err(|e| AppError::Io(e.to_string()))?;
    let config = config.as_ref().ok_or_else(|| AppError::Denied("Historial no disponible.".into()))?;
    let root = config.root.clone().ok_or_else(|| AppError::Denied("No hay proyecto abierto.".into()))?;
    action(config, &root)
}

fn relative_or_error(root: &Path, path: &str) -> Result<String, AppError> {
    relative_in(root, Path::new(path)).ok_or_else(|| AppError::InvalidPath(path.to_string()))
}

/// Proyecto abierto y si el historial está activo (preferencia RF-73.7).
/// Al configurar se aplica también el tope total de espacio.
#[tauri::command]
pub fn history_configure(root: Option<String>, enabled: bool) -> Result<(), AppError> {
    let mut config = CONFIG.lock().map_err(|e| AppError::Io(e.to_string()))?;
    let Some(config) = config.as_mut() else { return Ok(()) };
    config.root = root.and_then(|r| dunce::canonicalize(r).ok());
    config.enabled = enabled;
    config.store.enforce_total(MAX_TOTAL_BYTES);
    Ok(())
}

/// Guarda `content` (lo que hay en el editor) como versión de `path`: lo usa
/// «Recargar desde disco» antes de descartar los cambios (RF-73.1).
#[tauri::command]
pub fn history_snapshot(path: String, content: String, reason: String) -> Result<bool, AppError> {
    with_config(|config, root| {
        if !config.enabled {
            return Ok(false);
        }
        let relative = relative_or_error(root, &path)?;
        config
            .store
            .snapshot(root, &relative, content.as_bytes(), &reason, now_ms())
            .map_err(|e| AppError::Io(e.to_string()))
    })
}

#[tauri::command]
pub fn history_list(path: String) -> Result<Vec<Version>, AppError> {
    with_config(|config, root| Ok(config.store.list(root, &relative_or_error(root, &path)?)))
}

#[tauri::command]
pub fn history_read(path: String, id: u64) -> Result<String, AppError> {
    with_config(|config, root| {
        config.store.read(root, &relative_or_error(root, &path)?, id).map_err(|e| AppError::Io(e.to_string()))
    })
}

/// Vacía el historial de todos los proyectos (RF-73.7).
#[tauri::command]
pub fn history_clear() -> Result<(), AppError> {
    let config = CONFIG.lock().map_err(|e| AppError::Io(e.to_string()))?;
    match config.as_ref() {
        Some(config) => config.store.clear().map_err(|e| AppError::Io(e.to_string())),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MINUTE: u64 = 60 * 1000;
    const DAY: u64 = 24 * 60 * MINUTE;

    fn version(id: u64, reason: &str, hash: &str) -> Version {
        Version { id, reason: reason.into(), size: 10, hash: hash.into() }
    }

    #[test]
    fn la_huella_fnv_es_estable() {
        // Valores de referencia de FNV-1a 64: si cambian, el historial de las
        // versiones anteriores dejaría de encontrarse.
        assert_eq!(fnv1a(""), "cbf29ce484222325");
        assert_eq!(fnv1a("a"), "af63dc4c8601ec8c");
    }

    #[test]
    fn consolidacion_de_guardados_automaticos_y_contenido_repetido() {
        let now = 100 * MINUTE;
        let versions = vec![version(now - 2 * MINUTE, "auto", "h1")];
        assert!(!should_store(&versions, "auto", "h2", now), "otro automático antes de 5 min");
        assert!(should_store(&versions, "auto", "h2", now + 4 * MINUTE), "pasados 5 min, sí");
        assert!(should_store(&versions, "save", "h2", now), "un guardado manual siempre");
        assert!(should_store(&versions, "reload", "h2", now));
        assert!(!should_store(&versions, "save", "h1", now), "el mismo contenido que la última, no");
    }

    #[test]
    fn retencion_por_antiguedad_y_por_numero() {
        let now = 100 * DAY;
        let mut versions: Vec<Version> = (0..60).map(|i| version(now - 60 * MINUTE + i * MINUTE, "save", &i.to_string())).collect();
        versions.insert(0, version(now - 31 * DAY, "save", "vieja"));
        let remove = prune(&versions, now);
        assert!(remove.contains(&(now - 31 * DAY)), "más de 30 días");
        assert_eq!(remove.len(), 1 + 10, "la vieja y las 10 que exceden de 50");
        assert!(!remove.contains(&versions.last().unwrap().id), "nunca la más reciente");
    }

    #[test]
    fn tope_total_borra_lo_mas_antiguo_de_cualquier_proyecto() {
        let all = vec![(30, 100, "b"), (10, 100, "a"), (20, 100, "a")];
        let remove = over_budget(all, 150);
        assert_eq!(remove, vec![(10, "a"), (20, "a")]);
        assert!(over_budget(vec![(1, 10, "x")], 100).is_empty());
    }

    #[test]
    fn guardar_listar_leer_y_seguir_un_renombrado() {
        let data = tempfile::tempdir().unwrap();
        let project = tempfile::tempdir().unwrap();
        let root = dunce::canonicalize(project.path()).unwrap();
        let store = Store::new(data.path().join("history"));

        assert!(store.snapshot(&root, "cap1.typ", "= Uno".as_bytes(), "save", 1_000).unwrap());
        assert!(store.snapshot(&root, "cap1.typ", "= Uno bis".as_bytes(), "save", 2_000).unwrap());
        assert!(!store.snapshot(&root, "cap1.typ", "= Uno bis".as_bytes(), "save", 3_000).unwrap(), "repetido");
        assert!(!store.snapshot(&root, "logo.png", &[0xff, 0xfe, 0x00], "save", 3_000).unwrap(), "binario");

        let versions = store.list(&root, "cap1.typ");
        assert_eq!(versions.iter().map(|v| v.id).collect::<Vec<_>>(), [2_000, 1_000]);
        assert_eq!(store.read(&root, "cap1.typ", 1_000).unwrap(), "= Uno");

        // Mover la carpeta que lo contiene arrastra su historial.
        store.follow_moves(&root, &[("cap1.typ".into(), "capitulos/cap1.typ".into())]);
        assert!(store.list(&root, "cap1.typ").is_empty());
        assert_eq!(store.read(&root, "capitulos/cap1.typ", 2_000).unwrap(), "= Uno bis");

        store.enforce_total(0);
        assert!(store.list(&root, "capitulos/cap1.typ").is_empty());
        store.clear().unwrap();
        assert!(!data.path().join("history").exists());
    }

    #[test]
    fn otro_proyecto_no_ve_el_historial_de_este() {
        let data = tempfile::tempdir().unwrap();
        let (a, b) = (tempfile::tempdir().unwrap(), tempfile::tempdir().unwrap());
        let store = Store::new(data.path().to_path_buf());
        store.snapshot(a.path(), "main.typ", b"a", "save", 1).unwrap();
        assert!(store.list(b.path(), "main.typ").is_empty());
    }
}
