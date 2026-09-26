// =============================================================================
// DBV Typst Editor — «Nuevo capítulo…» (RF-71)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Crear un capítulo son dos pasos que el usuario hacía a mano (y el primero,
// fuera de la aplicación): crear el `.typ` y enlazarlo con `#include` en el
// documento principal. El enlace se coloca con el analizador de Typst, justo
// después del último `#include` de NIVEL SUPERIOR —uno dentro de un bloque o
// de una función no cuenta: insertar ahí cambiaría su semántica— y con el
// mismo estilo de ruta que ya usan los demás.

use std::fs;
use std::path::Path;

use serde::Serialize;
use typst::syntax::{ast, LinkedNode, SyntaxKind};

use crate::commands::file_io::{path_to_string, write_atomic};
use crate::commands::fs_ops::{ensure_inside, validate_name};
use crate::error::AppError;
use crate::refs::{resolve_ref, BufferEdit};

/// Un `#include` de nivel superior: su valor y dónde acaba su línea.
struct TopInclude {
    value: String,
    line_end: usize,
}

fn top_level_includes(text: &str) -> Vec<TopInclude> {
    let root = typst::syntax::parse(text);
    let linked = LinkedNode::new(&root);
    linked
        .children()
        .filter(|child| child.kind() == SyntaxKind::ModuleInclude)
        .filter_map(|include| {
            let source = include.children().find(|c| c.kind() == SyntaxKind::Str)?;
            let value = source.cast::<ast::Str>()?.get().to_string();
            let end = include.range().end;
            let line_end = text[end..].find('\n').map_or(text.len(), |offset| end + offset + 1);
            Some(TopInclude { value, line_end })
        })
        .collect()
}

/// Dónde insertar un `#include` nuevo en `text` y si hace falta un salto de
/// línea delante (el fichero no termina en uno).
pub fn include_insertion(text: &str) -> (usize, bool) {
    let offset = top_level_includes(text).last().map_or(text.len(), |last| last.line_end);
    let needs_newline = offset > 0 && !text[..offset].ends_with('\n');
    (offset, needs_newline)
}

/// Carpeta (relativa al proyecto) donde ya viven los capítulos incluidos por
/// el principal `main` (relativo al proyecto): la más repetida. Sin
/// `#include`, la carpeta del propio principal.
pub fn chapter_folder_hint(main: &str, text: &str) -> String {
    let mut counts: Vec<(String, usize)> = Vec::new();
    for include in top_level_includes(text) {
        let Some(target) = resolve_ref(main, &include.value) else { continue };
        let folder = target.rfind('/').map_or(String::new(), |cut| target[..cut].to_string());
        match counts.iter_mut().find(|(known, _)| *known == folder) {
            Some((_, count)) => *count += 1,
            None => counts.push((folder, 1)),
        }
    }
    // En caso de empate gana la primera que aparece (orden del documento).
    let best = counts.iter().fold(None::<&(String, usize)>, |best, item| match best {
        Some(current) if current.1 >= item.1 => Some(current),
        _ => Some(item),
    });
    best.map(|(folder, _)| folder.clone())
        .unwrap_or_else(|| main.rfind('/').map_or(String::new(), |cut| main[..cut].to_string()))
}

/// Valor del `#include` para `chapter` (relativo al proyecto) escrito en
/// `main`: absoluto al proyecto si los `#include` existentes lo son, relativo
/// al principal si no.
pub fn include_value(main: &str, text: &str, chapter: &str) -> String {
    if top_level_includes(text).iter().any(|include| include.value.starts_with('/')) {
        return format!("/{chapter}");
    }
    let main_dir: Vec<&str> = main.rfind('/').map_or(Vec::new(), |cut| main[..cut].split('/').collect());
    let target: Vec<&str> = chapter.split('/').collect();
    let common = main_dir.iter().zip(&target).take_while(|(a, b)| a == b).count();
    let mut parts: Vec<&str> = vec![".."; main_dir.len() - common];
    parts.extend(&target[common..]);
    parts.join("/")
}

fn relative_to(root: &Path, path: &Path) -> Option<String> {
    let relative = path.strip_prefix(root).ok()?;
    Some(relative.components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/"))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterLink {
    /// Edición del principal abierto (posiciones UTF-16 de `open_content`);
    /// `None` si el principal no estaba abierto y se escribió en disco.
    pub edit: Option<BufferEdit>,
    pub include_value: String,
}

/// Carpeta propuesta (relativa al proyecto, `""` = raíz) para un capítulo nuevo.
#[tauri::command]
pub fn chapter_folder(root: String, main_path: String, main_content: String) -> Result<String, AppError> {
    let root = dunce::canonicalize(&root).map_err(|e| AppError::Io(e.to_string()))?;
    let main = ensure_inside(&root, Path::new(&main_path))?;
    let main_rel = relative_to(&root, &main).ok_or(AppError::InvalidPath(main_path))?;
    Ok(chapter_folder_hint(&main_rel, &main_content))
}

/// Crea `folder/file_name` (carpetas incluidas, dentro del proyecto) con el
/// encabezado `= title`. Nunca sobrescribe. Devuelve la ruta creada.
#[tauri::command]
pub fn chapter_create(root: String, folder: String, file_name: String, title: String) -> Result<String, AppError> {
    validate_name(&file_name)?;
    for segment in folder.split(['/', '\\']).filter(|s| !s.is_empty()) {
        validate_name(segment)?;
    }
    let root = dunce::canonicalize(&root).map_err(|e| AppError::Io(e.to_string()))?;
    let dir = ensure_inside(&root, &root.join(&folder))?;
    let target = ensure_inside(&root, &dir.join(&file_name))?;
    if target.exists() {
        return Err(AppError::Denied(format!("Ya existe «{file_name}» en esa carpeta.")));
    }
    fs::create_dir_all(&dir).map_err(|e| AppError::Io(e.to_string()))?;
    let heading = title.trim().replace('\n', " ");
    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .and_then(|mut file| std::io::Write::write_all(&mut file, format!("= {heading}\n\n").as_bytes()))
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(path_to_string(&target))
}

/// Enlaza `chapter_path` con `#include` en el principal. Si el principal está
/// abierto (`open_content`), devuelve la edición para el editor; si no, la
/// escribe en disco de forma atómica.
#[tauri::command]
pub fn chapter_link(
    root: String,
    main_path: String,
    open_content: Option<String>,
    chapter_path: String,
) -> Result<ChapterLink, AppError> {
    let root = dunce::canonicalize(&root).map_err(|e| AppError::Io(e.to_string()))?;
    let main = ensure_inside(&root, Path::new(&main_path))?;
    let chapter = ensure_inside(&root, Path::new(&chapter_path))?;
    let main_rel = relative_to(&root, &main).ok_or_else(|| AppError::InvalidPath(main_path.clone()))?;
    let chapter_rel = relative_to(&root, &chapter).ok_or_else(|| AppError::InvalidPath(chapter_path.clone()))?;

    let text = match &open_content {
        Some(content) => content.clone(),
        None => fs::read_to_string(&main).map_err(|e| AppError::Io(e.to_string()))?,
    };
    let value = include_value(&main_rel, &text, &chapter_rel);
    let (offset, needs_newline) = include_insertion(&text);
    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
    let insert = format!("{}#include \"{escaped}\"\n", if needs_newline { "\n" } else { "" });

    if open_content.is_some() {
        let at = text[..offset].encode_utf16().count();
        return Ok(ChapterLink { edit: Some(BufferEdit { from: at, to: at, insert }), include_value: value });
    }
    let mut updated = text;
    updated.insert_str(offset, &insert);
    write_atomic(&main, &updated).map_err(|e| AppError::Io(e.to_string()))?;
    Ok(ChapterLink { edit: None, include_value: value })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn insert_at(text: &str) -> String {
        let (offset, newline) = include_insertion(text);
        let mut out = text.to_string();
        out.insert_str(offset, &format!("{}#include \"nuevo.typ\"\n", if newline { "\n" } else { "" }));
        out
    }

    #[test]
    fn inserta_tras_el_ultimo_include_de_nivel_superior() {
        let text = "#set page(numbering: \"1\")\n#include \"a.typ\"\n#include \"b.typ\"\n\n#bibliography(\"refs.bib\")\n";
        assert_eq!(
            insert_at(text),
            "#set page(numbering: \"1\")\n#include \"a.typ\"\n#include \"b.typ\"\n#include \"nuevo.typ\"\n\n#bibliography(\"refs.bib\")\n"
        );
    }

    #[test]
    fn sin_includes_va_al_final_con_salto_de_linea_si_falta() {
        assert_eq!(insert_at("= Libro"), "= Libro\n#include \"nuevo.typ\"\n");
        assert_eq!(insert_at("= Libro\n"), "= Libro\n#include \"nuevo.typ\"\n");
        assert_eq!(insert_at(""), "#include \"nuevo.typ\"\n");
    }

    #[test]
    fn un_include_dentro_de_un_bloque_no_cuenta_como_nivel_superior() {
        let text = "#include \"a.typ\"\n#if true {\n  include \"anexo.typ\"\n}\nFin.\n";
        assert_eq!(insert_at(text), "#include \"a.typ\"\n#include \"nuevo.typ\"\n#if true {\n  include \"anexo.typ\"\n}\nFin.\n");
    }

    #[test]
    fn la_carpeta_propuesta_es_la_de_los_capitulos_ya_incluidos() {
        let text = "#include \"capitulos/uno.typ\"\n#include \"capitulos/dos.typ\"\n#include \"portada.typ\"\n";
        assert_eq!(chapter_folder_hint("main.typ", text), "capitulos");
        assert_eq!(chapter_folder_hint("libro/main.typ", "#include \"../partes/a.typ\""), "partes");
        assert_eq!(chapter_folder_hint("libro/main.typ", "= Sin capítulos"), "libro");
        assert_eq!(chapter_folder_hint("main.typ", ""), "");
    }

    #[test]
    fn el_valor_del_include_sigue_el_estilo_existente() {
        assert_eq!(include_value("main.typ", "#include \"a.typ\"", "capitulos/c.typ"), "capitulos/c.typ");
        assert_eq!(include_value("libro/main.typ", "", "capitulos/c.typ"), "../capitulos/c.typ");
        assert_eq!(include_value("main.typ", "#include \"/capitulos/a.typ\"", "capitulos/c.typ"), "/capitulos/c.typ");
    }

    #[test]
    fn crear_y_enlazar_un_capitulo_de_punta_a_punta() {
        let dir = tempfile::tempdir().unwrap();
        let root = dunce::canonicalize(dir.path()).unwrap();
        let root_text = path_to_string(&root);
        let main = root.join("main.typ");
        fs::write(&main, "#include \"capitulos/uno.typ\"\n").unwrap();

        let created = chapter_create(root_text.clone(), "capitulos".into(), "dos.typ".into(), "Capítulo dos".into()).unwrap();
        assert_eq!(fs::read_to_string(&created).unwrap(), "= Capítulo dos\n\n");
        assert!(chapter_create(root_text.clone(), "capitulos".into(), "dos.typ".into(), "Otra vez".into()).is_err());
        assert!(chapter_create(root_text.clone(), "../fuera".into(), "x.typ".into(), "X".into()).is_err());

        let link = chapter_link(root_text.clone(), path_to_string(&main), None, created.clone()).unwrap();
        assert!(link.edit.is_none());
        assert_eq!(fs::read_to_string(&main).unwrap(), "#include \"capitulos/uno.typ\"\n#include \"capitulos/dos.typ\"\n");

        // Con el principal abierto no se toca el disco: vuelve la edición.
        let open = "= Título 🎉\n#include \"capitulos/uno.typ\"\n".to_string();
        let link = chapter_link(root_text, path_to_string(&main), Some(open.clone()), created).unwrap();
        let edit = link.edit.unwrap();
        let utf16: Vec<u16> = open.encode_utf16().collect();
        assert_eq!(edit.from, utf16.len());
        assert_eq!(edit.insert, "#include \"capitulos/dos.typ\"\n");
    }
}
