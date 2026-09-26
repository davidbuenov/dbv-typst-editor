// =============================================================================
// DBV Typst Editor — Operaciones de ficheros del panel Archivos (RF-69)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Crear, renombrar, mover, duplicar, copiar desde fuera y eliminar dentro de un
// proyecto. Dos reglas que valen para TODAS las operaciones:
//
//   · Confinamiento (R-F2): origen y destino tienen que estar dentro de la raíz
//     del proyecto, comprobado sobre rutas canónicas. El destino todavía no
//     existe, así que se canonicaliza su antepasado existente más cercano y se
//     le añade el resto, que no puede llevar `..`. Un enlace simbólico que
//     apunta fuera se resuelve al canonicalizar y queda rechazado. Es el mismo
//     criterio anti-escape que la importación `.dbvt` (RF-11).
//   · Nunca se sobrescribe: una colisión es un error antes de tocar nada, y
//     copiar desde fuera elige un nombre libre.
//
// Las operaciones de varios elementos (mover, eliminar) validan TODO antes de
// empezar, para que un error en el tercero no deje los dos primeros hechos.

use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::assets::unique_destination;
use crate::commands::file_io::path_to_string;
use crate::error::AppError;

/// Caracteres que ningún sistema de los tres admite en un nombre (o que
/// Windows rechaza). Se rechazan en todos para que un proyecto creado en Linux
/// se pueda abrir en Windows.
const FORBIDDEN_CHARS: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|'];

/// Nombres de dispositivo reservados de Windows, con o sin extensión.
const RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Comprueba que `name` es un nombre de fichero o carpeta válido y portable
/// (RF-69.8). El mensaje es el que ve el usuario junto a la fila editable.
pub fn validate_name(name: &str) -> Result<(), AppError> {
    let denied = |message: &str| Err(AppError::Denied(message.to_string()));
    if name.trim().is_empty() {
        return denied("El nombre no puede estar vacío.");
    }
    if name == "." || name == ".." {
        return denied("Ese nombre está reservado.");
    }
    if let Some(bad) = name.chars().find(|c| FORBIDDEN_CHARS.contains(c) || c.is_control()) {
        let shown = if bad.is_control() { "un carácter de control".to_string() } else { format!("«{bad}»") };
        return Err(AppError::Denied(format!("El nombre no puede contener {shown}.")));
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return denied("El nombre no puede terminar en punto ni en espacio (Windows no lo admite).");
    }
    let stem = name.split('.').next().unwrap_or(name).trim_end();
    if RESERVED_NAMES.iter().any(|reserved| reserved.eq_ignore_ascii_case(stem)) {
        return Err(AppError::Denied(format!("«{stem}» es un nombre reservado en Windows.")));
    }
    if name.len() > 255 {
        return denied("El nombre es demasiado largo.");
    }
    Ok(())
}

/// Raíz del proyecto canonicalizada. Tiene que ser una carpeta existente.
fn canonical_root(root: &str) -> Result<PathBuf, AppError> {
    let root_path = PathBuf::from(root);
    if !root_path.is_dir() {
        return Err(AppError::InvalidPath(root.to_string()));
    }
    dunce::canonicalize(&root_path).map_err(|e| AppError::Io(e.to_string()))
}

/// Resuelve `target` (exista o no) y comprueba que queda dentro de `root`
/// (que ya es canónica). Devuelve la ruta resuelta.
pub fn ensure_inside(root: &Path, target: &Path) -> Result<PathBuf, AppError> {
    let outside = || AppError::Denied(format!("La ruta queda fuera del proyecto: {}", target.display()));

    // Antepasado existente más cercano + lo que falta por crear.
    let mut existing = target.to_path_buf();
    let mut pending: Vec<std::ffi::OsString> = Vec::new();
    while !existing.exists() {
        let Some(name) = existing.file_name() else { return Err(outside()) };
        pending.push(name.to_os_string());
        if !existing.pop() {
            return Err(outside());
        }
    }
    let mut resolved = dunce::canonicalize(&existing).map_err(|e| AppError::Io(e.to_string()))?;
    for name in pending.iter().rev() {
        let piece = Path::new(name);
        if piece.components().any(|c| !matches!(c, Component::Normal(_))) {
            return Err(outside());
        }
        resolved.push(piece);
    }
    if !resolved.starts_with(root) {
        return Err(outside());
    }
    Ok(resolved)
}

/// Como `ensure_inside`, pero además exige que no sea la propia raíz: ni se
/// renombra, ni se mueve, ni se elimina el proyecto entero desde su árbol.
fn ensure_strictly_inside(root: &Path, target: &Path) -> Result<PathBuf, AppError> {
    let resolved = ensure_inside(root, target)?;
    if resolved == root {
        return Err(AppError::Denied("No se puede hacer esto con la carpeta raíz del proyecto.".into()));
    }
    Ok(resolved)
}

/// Carpeta de destino: dentro del proyecto y existente.
fn ensure_dir_inside(root: &Path, dir: &str) -> Result<PathBuf, AppError> {
    let resolved = ensure_inside(root, Path::new(dir))?;
    if !resolved.is_dir() {
        return Err(AppError::InvalidPath(dir.to_string()));
    }
    Ok(resolved)
}

/// True si `candidate` ocupa ya un sitio en disco que NO es `source`. Cubre el
/// cambio solo de mayúsculas: en Windows y macOS `Cap1.typ` "existe" cuando
/// existe `cap1.typ`, pero es el mismo fichero y no es una colisión.
fn collides(candidate: &Path, source: Option<&Path>) -> bool {
    if !candidate.exists() {
        return false;
    }
    match source {
        Some(source) => match (dunce::canonicalize(candidate), dunce::canonicalize(source)) {
            (Ok(a), Ok(b)) => a != b,
            _ => true,
        },
        None => true,
    }
}

fn collision_error(path: &Path) -> AppError {
    let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    AppError::Denied(format!("Ya existe «{name}» en esa carpeta."))
}

fn file_name_of(path: &Path) -> Result<String, AppError> {
    path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or_else(|| AppError::InvalidPath(path_to_string(path)))
}

/// Copia `source` (fichero o carpeta, de forma recursiva) en `target`.
fn copy_recursive(source: &Path, target: &Path) -> std::io::Result<()> {
    if source.is_dir() {
        fs::create_dir(target)?;
        for entry in fs::read_dir(source)? {
            let entry = entry?;
            copy_recursive(&entry.path(), &target.join(entry.file_name()))?;
        }
        Ok(())
    } else {
        fs::copy(source, target).map(|_| ())
    }
}

fn io(error: std::io::Error) -> AppError {
    AppError::Io(error.to_string())
}

/// Un movimiento hecho: de dónde a dónde. El frontend lo usa para actualizar
/// el documento abierto, el principal y las referencias (RF-70).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Moved {
    pub from: String,
    pub to: String,
}

/// Crea un fichero vacío `name` en `dir`. Devuelve su ruta.
#[tauri::command]
pub fn fs_create_file(root: String, dir: String, name: String) -> Result<String, AppError> {
    validate_name(&name)?;
    let root = canonical_root(&root)?;
    let dir = ensure_dir_inside(&root, &dir)?;
    let target = ensure_inside(&root, &dir.join(&name))?;
    if collides(&target, None) {
        return Err(collision_error(&target));
    }
    fs::OpenOptions::new().write(true).create_new(true).open(&target).map_err(io)?;
    Ok(path_to_string(&target))
}

/// Crea una carpeta `name` en `dir`. Devuelve su ruta.
#[tauri::command]
pub fn fs_create_dir(root: String, dir: String, name: String) -> Result<String, AppError> {
    validate_name(&name)?;
    let root = canonical_root(&root)?;
    let dir = ensure_dir_inside(&root, &dir)?;
    let target = ensure_inside(&root, &dir.join(&name))?;
    if collides(&target, None) {
        return Err(collision_error(&target));
    }
    fs::create_dir(&target).map_err(io)?;
    Ok(path_to_string(&target))
}

/// Renombra `path` a `new_name` en la misma carpeta. Admite cambiar solo
/// mayúsculas (`cap1.typ` → `Cap1.typ`).
#[tauri::command]
pub fn fs_rename(root: String, path: String, new_name: String) -> Result<Moved, AppError> {
    validate_name(&new_name)?;
    let root = canonical_root(&root)?;
    let source = ensure_strictly_inside(&root, Path::new(&path))?;
    if !source.exists() {
        return Err(AppError::NotFound(path));
    }
    let parent = source.parent().ok_or_else(|| AppError::InvalidPath(path.clone()))?;
    // Se une el nombre tal cual a la carpeta (ya canónica y dentro del
    // proyecto; `validate_name` impide separadores). Canonicalizar el destino
    // en Windows devolvería el nombre de disco actual (`cap1.typ` en vez de
    // `Cap1.typ`) y el cambio solo de mayúsculas no haría nada.
    let target = parent.join(&new_name);
    if collides(&target, Some(&source)) {
        return Err(collision_error(&target));
    }
    fs::rename(&source, &target).map_err(io)?;
    let moved = Moved { from: path_to_string(&source), to: path_to_string(&target) };
    crate::history::follow_moved(std::slice::from_ref(&moved));
    Ok(moved)
}

/// Mueve `paths` a la carpeta `dest_dir`. Lo que ya está en esa carpeta se
/// omite (no es un error). Se valida todo antes de mover nada.
#[tauri::command]
pub fn fs_move(root: String, paths: Vec<String>, dest_dir: String) -> Result<Vec<Moved>, AppError> {
    let root = canonical_root(&root)?;
    let dest = ensure_dir_inside(&root, &dest_dir)?;

    let mut plan: Vec<(PathBuf, PathBuf)> = Vec::new();
    for path in &paths {
        let source = ensure_strictly_inside(&root, Path::new(path))?;
        if !source.exists() {
            return Err(AppError::NotFound(path.clone()));
        }
        if source.parent() == Some(dest.as_path()) {
            continue;
        }
        if dest.starts_with(&source) {
            return Err(AppError::Denied(format!(
                "No se puede mover «{}» dentro de sí misma.",
                file_name_of(&source)?
            )));
        }
        let target = dest.join(file_name_of(&source)?);
        if collides(&target, None) || plan.iter().any(|(_, planned)| planned == &target) {
            return Err(collision_error(&target));
        }
        plan.push((source, target));
    }

    let mut moved = Vec::with_capacity(plan.len());
    for (source, target) in plan {
        fs::rename(&source, &target).map_err(io)?;
        moved.push(Moved { from: path_to_string(&source), to: path_to_string(&target) });
    }
    crate::history::follow_moved(&moved);
    Ok(moved)
}

/// Deshace movimientos o renombrados (RF-70.8): cada `to` vuelve a su `from`,
/// en orden inverso. Se valida todo antes de mover nada: si algo ya no está
/// donde se dejó, o su sitio original está ocupado, no se deshace nada.
/// Devuelve los movimientos hechos (`to → from`), para que el frontend
/// actualice el estado y vuelva a reescribir las referencias en sentido inverso.
#[tauri::command]
pub fn fs_revert_moves(root: String, moved: Vec<Moved>) -> Result<Vec<Moved>, AppError> {
    let root = canonical_root(&root)?;
    let mut plan = Vec::with_capacity(moved.len());
    for step in moved.iter().rev() {
        let current = ensure_strictly_inside(&root, Path::new(&step.to))?;
        if !current.exists() {
            return Err(AppError::Denied(format!(
                "«{}» ya no está donde se movió; no se puede deshacer.",
                file_name_of(&current)?
            )));
        }
        let original = ensure_strictly_inside(&root, Path::new(&step.from))?;
        let parent_missing = original.parent().is_none_or(|parent| !parent.is_dir());
        if parent_missing || collides(&original, Some(&current)) {
            return Err(AppError::Denied(format!(
                "El sitio original de «{}» ya no está libre; no se puede deshacer.",
                file_name_of(&original)?
            )));
        }
        plan.push((current, PathBuf::from(&step.from)));
    }
    let mut reverted = Vec::with_capacity(plan.len());
    for (current, original) in plan {
        fs::rename(&current, &original).map_err(io)?;
        reverted.push(Moved { from: path_to_string(&current), to: path_to_string(&original) });
    }
    crate::history::follow_moved(&reverted);
    Ok(reverted)
}

/// Duplica `path` (fichero o carpeta) en su misma carpeta, con un nombre libre
/// (`cap1-1.typ`). Devuelve la ruta de la copia.
#[tauri::command]
pub fn fs_duplicate(root: String, path: String) -> Result<String, AppError> {
    let root = canonical_root(&root)?;
    let source = ensure_strictly_inside(&root, Path::new(&path))?;
    if !source.exists() {
        return Err(AppError::NotFound(path));
    }
    let parent = source.parent().ok_or_else(|| AppError::InvalidPath(path.clone()))?;
    let target = unique_destination(parent, &file_name_of(&source)?);
    copy_recursive(&source, &target).map_err(io)?;
    Ok(path_to_string(&target))
}

/// Copia ficheros o carpetas de FUERA del proyecto (soltados desde el
/// explorador del sistema, RF-69.6) en `dest_dir`. Nunca sobrescribe: si el
/// nombre existe, elige uno libre. Devuelve las rutas creadas.
#[tauri::command]
pub fn fs_copy_into(root: String, sources: Vec<String>, dest_dir: String) -> Result<Vec<String>, AppError> {
    let root = canonical_root(&root)?;
    let dest = ensure_dir_inside(&root, &dest_dir)?;
    let mut checked = Vec::with_capacity(sources.len());
    for source in &sources {
        let source_path = dunce::canonicalize(source).map_err(|_| AppError::NotFound(source.clone()))?;
        // Copiar una carpeta dentro de sí misma no terminaría nunca.
        if source_path.is_dir() && dest.starts_with(&source_path) {
            return Err(AppError::Denied(format!(
                "No se puede copiar «{}» dentro de sí misma.",
                file_name_of(&source_path)?
            )));
        }
        checked.push(source_path);
    }
    let mut created = Vec::with_capacity(checked.len());
    for source in checked {
        let target = unique_destination(&dest, &file_name_of(&source)?);
        copy_recursive(&source, &target).map_err(io)?;
        created.push(path_to_string(&target));
    }
    Ok(created)
}

/// Envía `paths` a la papelera del sistema (RF-69.7). Si la papelera no está
/// disponible (unidad de red, sistema sin papelera), devuelve
/// `TrashUnavailable` y el frontend ofrece el borrado definitivo.
#[tauri::command]
pub fn fs_trash(root: String, paths: Vec<String>) -> Result<(), AppError> {
    let root = canonical_root(&root)?;
    let mut checked = Vec::with_capacity(paths.len());
    for path in &paths {
        checked.push(ensure_strictly_inside(&root, Path::new(path))?);
    }
    trash::delete_all(&checked).map_err(|e| AppError::TrashUnavailable(e.to_string()))
}

/// Borra `paths` de forma definitiva. Solo se llama tras una confirmación
/// explícita del usuario, cuando la papelera no está disponible.
#[tauri::command]
pub fn fs_delete_permanently(root: String, paths: Vec<String>) -> Result<(), AppError> {
    let root = canonical_root(&root)?;
    let mut checked = Vec::with_capacity(paths.len());
    for path in &paths {
        checked.push(ensure_strictly_inside(&root, Path::new(path))?);
    }
    for path in checked {
        if path.is_dir() { fs::remove_dir_all(&path) } else { fs::remove_file(&path) }.map_err(io)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let root = path_to_string(&dunce::canonicalize(dir.path()).unwrap());
        (dir, root)
    }

    fn at(root: &str, relative: &str) -> String {
        path_to_string(&Path::new(root).join(relative))
    }

    #[test]
    fn validate_name_acepta_nombres_normales_y_con_puntos() {
        for name in ["cap1.typ", "Capítulo 2.typ", ".gitignore", "img", "a.b.c"] {
            assert!(validate_name(name).is_ok(), "{name}");
        }
    }

    #[test]
    fn validate_name_rechaza_vacios_separadores_reservados_y_finales_invalidos() {
        for name in ["", "   ", ".", "..", "a/b", "a\\b", "x:y", "¿qué?.typ", "CON", "con.typ", "Com1.txt", "nota.", "nota ", "a\u{7}b"] {
            assert!(validate_name(name).is_err(), "{name:?}");
        }
    }

    #[test]
    fn ensure_inside_rechaza_escapar_con_puntos() {
        let (_dir, root) = project();
        let root_path = PathBuf::from(&root);
        assert!(ensure_inside(&root_path, &root_path.join("..").join("fuera.typ")).is_err());
        assert!(ensure_inside(&root_path, &root_path.join("nuevo").join("..").join("..").join("x")).is_err());
        assert!(ensure_inside(&root_path, &root_path.join("nueva").join("cap.typ")).is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn ensure_inside_rechaza_un_enlace_simbolico_que_apunta_fuera() {
        let (_dir, root) = project();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), Path::new(&root).join("enlace")).unwrap();
        let root_path = PathBuf::from(&root);
        assert!(ensure_inside(&root_path, &root_path.join("enlace").join("x.typ")).is_err());
    }

    #[test]
    fn crear_fichero_y_carpeta_y_rechazar_colisiones() {
        let (_dir, root) = project();
        let created = fs_create_file(root.clone(), root.clone(), "cap1.typ".into()).unwrap();
        assert!(Path::new(&created).is_file());
        assert!(fs_create_file(root.clone(), root.clone(), "cap1.typ".into()).is_err());

        let folder = fs_create_dir(root.clone(), root.clone(), "capitulos".into()).unwrap();
        assert!(Path::new(&folder).is_dir());
        assert!(fs_create_file(root.clone(), folder, "../../fuera.typ".into()).is_err());
    }

    #[test]
    fn renombrar_admite_cambiar_solo_mayusculas_y_rechaza_colisiones() {
        let (_dir, root) = project();
        fs::write(at(&root, "cap1.typ"), "= Uno").unwrap();
        fs::write(at(&root, "cap2.typ"), "= Dos").unwrap();

        assert!(fs_rename(root.clone(), at(&root, "cap1.typ"), "cap2.typ".into()).is_err());

        let moved = fs_rename(root.clone(), at(&root, "cap1.typ"), "Cap1.typ".into()).unwrap();
        assert!(moved.to.ends_with("Cap1.typ"));
        let names: Vec<String> = fs::read_dir(&root).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().to_string()).collect();
        assert!(names.contains(&"Cap1.typ".to_string()), "{names:?}");
        assert_eq!(fs::read_to_string(at(&root, "Cap1.typ")).unwrap(), "= Uno");
    }

    #[test]
    fn no_se_opera_sobre_la_raiz_del_proyecto() {
        let (_dir, root) = project();
        assert!(fs_rename(root.clone(), root.clone(), "otro".into()).is_err());
        assert!(fs_delete_permanently(root.clone(), vec![root.clone()]).is_err());
    }

    #[test]
    fn mover_varios_valida_todo_antes_y_omite_lo_que_ya_esta_en_destino() {
        let (_dir, root) = project();
        fs::create_dir(at(&root, "capitulos")).unwrap();
        fs::write(at(&root, "a.typ"), "a").unwrap();
        fs::write(at(&root, "b.typ"), "b").unwrap();
        fs::write(at(&root, "capitulos/b.typ"), "otro b").unwrap();
        fs::write(at(&root, "capitulos/c.typ"), "c").unwrap();

        // b.typ colisiona: no se mueve NADA, tampoco a.typ.
        let error = fs_move(root.clone(), vec![at(&root, "a.typ"), at(&root, "b.typ")], at(&root, "capitulos"));
        assert!(error.is_err());
        assert!(Path::new(&at(&root, "a.typ")).exists());

        // c.typ ya está en capitulos: se omite sin error.
        let moved = fs_move(root.clone(), vec![at(&root, "a.typ"), at(&root, "capitulos/c.typ")], at(&root, "capitulos")).unwrap();
        assert_eq!(moved.len(), 1);
        assert!(Path::new(&at(&root, "capitulos/a.typ")).exists());
    }

    #[test]
    fn no_se_mueve_una_carpeta_dentro_de_si_misma() {
        let (_dir, root) = project();
        fs::create_dir_all(at(&root, "partes/sub")).unwrap();
        assert!(fs_move(root.clone(), vec![at(&root, "partes")], at(&root, "partes/sub")).is_err());
        assert!(fs_move(root.clone(), vec![at(&root, "partes")], at(&root, "partes")).is_err());
    }

    #[test]
    fn revertir_movimientos_devuelve_cada_cosa_a_su_sitio_o_no_toca_nada() {
        let (_dir, root) = project();
        fs::create_dir(at(&root, "capitulos")).unwrap();
        fs::write(at(&root, "a.typ"), "a").unwrap();
        fs::write(at(&root, "b.typ"), "b").unwrap();
        let moved = fs_move(root.clone(), vec![at(&root, "a.typ"), at(&root, "b.typ")], at(&root, "capitulos")).unwrap();

        // Si el sitio original de uno está ocupado, no se deshace NINGUNO.
        fs::write(at(&root, "b.typ"), "otro b").unwrap();
        assert!(fs_revert_moves(root.clone(), moved.clone()).is_err());
        assert!(Path::new(&at(&root, "capitulos/a.typ")).exists());

        fs::remove_file(at(&root, "b.typ")).unwrap();
        let reverted = fs_revert_moves(root.clone(), moved).unwrap();
        assert_eq!(reverted.len(), 2);
        assert_eq!(fs::read_to_string(at(&root, "a.typ")).unwrap(), "a");
        assert_eq!(fs::read_to_string(at(&root, "b.typ")).unwrap(), "b");
    }

    #[test]
    fn duplicar_elige_un_nombre_libre_y_copia_carpetas_enteras() {
        let (_dir, root) = project();
        fs::write(at(&root, "cap1.typ"), "= Uno").unwrap();
        let copy = fs_duplicate(root.clone(), at(&root, "cap1.typ")).unwrap();
        assert!(copy.ends_with("cap1-1.typ"));
        assert_eq!(fs::read_to_string(&copy).unwrap(), "= Uno");

        fs::create_dir_all(at(&root, "img/sub")).unwrap();
        fs::write(at(&root, "img/sub/a.png"), "x").unwrap();
        let folder_copy = fs_duplicate(root.clone(), at(&root, "img")).unwrap();
        assert!(Path::new(&folder_copy).join("sub").join("a.png").is_file());
    }

    #[test]
    fn copiar_desde_fuera_nunca_sobrescribe() {
        let (_dir, root) = project();
        let outside = tempfile::tempdir().unwrap();
        let source = outside.path().join("logo.png");
        fs::write(&source, "nuevo").unwrap();
        fs::write(at(&root, "logo.png"), "original").unwrap();

        let created = fs_copy_into(root.clone(), vec![path_to_string(&source)], root.clone()).unwrap();
        assert!(created[0].ends_with("logo-1.png"));
        assert_eq!(fs::read_to_string(at(&root, "logo.png")).unwrap(), "original");
    }

    #[test]
    fn borrar_definitivamente_quita_ficheros_y_carpetas() {
        let (_dir, root) = project();
        fs::create_dir_all(at(&root, "viejo/sub")).unwrap();
        fs::write(at(&root, "nota.txt"), "x").unwrap();
        fs_delete_permanently(root.clone(), vec![at(&root, "viejo"), at(&root, "nota.txt")]).unwrap();
        assert!(!Path::new(&at(&root, "viejo")).exists());
        assert!(!Path::new(&at(&root, "nota.txt")).exists());
    }
}
