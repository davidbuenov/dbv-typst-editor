// =============================================================================
// DBV Typst Editor — Actualización de referencias al mover o renombrar (RF-70)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cuando el usuario mueve o renombra ficheros desde el árbol (RF-69), las rutas
// escritas en los `.typ` del proyecto (`#include "capitulos/cap1.typ"`,
// `image("img/logo.png")`…) dejan de apuntar a su sitio. Este módulo las
// encuentra con el ANALIZADOR SINTÁCTICO de Typst —nunca con búsqueda de
// texto, que tocaría cualquier cosa que se pareciera a una ruta— y las
// reescribe.
//
// Reglas de resolución, tomadas de `typst-library` 0.15.1
// (`foundations/path.rs`), no supuestas:
//   · una ruta relativa se resuelve desde la carpeta del fichero donde se
//     LLAMA a la función; `./x` equivale a `x`;
//   · una ruta que empieza por `/` se resuelve desde la raíz del proyecto.
//
// Se trabaja DESPUÉS de mover (`fs_move` ya validó todo antes de tocar nada):
// cada `.typ` se analiza en su sitio nuevo, se calcula dónde estaba antes
// (movimiento inverso) y dónde está ahora cada destino, y solo se reescribe la
// cadena cuya resolución ha cambiado. Así se cubren a la vez las referencias
// que ENTRAN a lo movido y las que SALEN de un fichero movido.
//
// Límite aceptado (ADR-V0110-001): solo se ven cadenas literales pasadas
// directamente. Una ruta construida (`"figs/" + nombre`), guardada en una
// variable o pasada a una plantilla no se toca; si queda rota, el compilador
// la señala como fichero no encontrado.

use std::fs;
use std::ops::Range;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use typst::syntax::{ast, LinkedNode, SyntaxKind};

use crate::commands::file_io::{is_noise_dir, path_to_string, write_atomic, MAX_TEXT_BYTES};
use crate::commands::fs_ops::Moved;
use crate::error::AppError;

/// Funciones de Typst cuyo primer argumento posicional es una ruta.
pub const PATH_FUNCTIONS: &[&str] =
    &["image", "bibliography", "read", "json", "csv", "yaml", "toml", "xml", "cbor", "plugin", "path"];

/// Una ruta escrita en el fuente: dónde está el literal (con sus comillas) y
/// qué valor tiene ya descodificado (sin escapes).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PathRef {
    pub range: Range<usize>,
    pub value: String,
}

/// Todas las rutas literales de un fuente Typst, en orden.
pub fn find_path_refs(text: &str) -> Vec<PathRef> {
    let root = typst::syntax::parse(text);
    let mut out = Vec::new();
    visit(&LinkedNode::new(&root), &mut out);
    out
}

fn push_str(node: &LinkedNode, out: &mut Vec<PathRef>) {
    if node.kind() != SyntaxKind::Str {
        return;
    }
    if let Some(literal) = node.cast::<ast::Str>() {
        out.push(PathRef { range: node.range(), value: literal.get().to_string() });
    }
}

/// Primer hijo que es una expresión (salta palabras clave, espacios y signos).
fn first_expr<'a>(node: &LinkedNode<'a>) -> Option<LinkedNode<'a>> {
    node.children().find(|child| child.cast::<ast::Expr>().is_some())
}

fn visit(node: &LinkedNode, out: &mut Vec<PathRef>) {
    match node.kind() {
        SyntaxKind::ModuleInclude | SyntaxKind::ModuleImport => {
            if let Some(source) = first_expr(node) {
                push_str(&source, out);
            }
        }
        SyntaxKind::FuncCall => {
            let callee = node
                .cast::<ast::FuncCall>()
                .and_then(|call| match call.callee() {
                    ast::Expr::Ident(ident) => Some(ident.get().to_string()),
                    _ => None,
                });
            if let Some(name) = callee.filter(|name| PATH_FUNCTIONS.contains(&name.as_str())) {
                let first_positional = node
                    .children()
                    .find(|child| child.kind() == SyntaxKind::Args)
                    .and_then(|args| first_expr(&args));
                if let Some(argument) = first_positional {
                    if argument.kind() == SyntaxKind::Array && name == "bibliography" {
                        for item in argument.children() {
                            push_str(&item, out);
                        }
                    } else {
                        push_str(&argument, out);
                    }
                }
            }
        }
        _ => {}
    }
    for child in node.children() {
        visit(&child, out);
    }
}

/// Carpeta (relativa al proyecto, con `/`) de un fichero relativo.
fn parent_rel(file: &str) -> &str {
    file.rfind('/').map_or("", |cut| &file[..cut])
}

fn same(a: &str, b: &str, case_insensitive: bool) -> bool {
    if case_insensitive { a.to_lowercase() == b.to_lowercase() } else { a == b }
}

/// Resuelve `value` escrito en `file` (ambos relativos al proyecto, con `/`) a
/// una ruta relativa al proyecto. `None` para paquetes (`@preview/…`) y para
/// rutas que salen del proyecto con `..`.
pub fn resolve_ref(file: &str, value: &str) -> Option<String> {
    if value.starts_with('@') || value.is_empty() {
        return None;
    }
    let (base, rest) = match value.strip_prefix('/') {
        Some(rest) => ("", rest),
        None => (parent_rel(file), value),
    };
    let mut stack: Vec<&str> = base.split('/').filter(|part| !part.is_empty()).collect();
    for segment in rest.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                stack.pop()?;
            }
            other => stack.push(other),
        }
    }
    Some(stack.join("/"))
}

/// Ruta relativa desde la carpeta de `from_file` hasta `target`.
fn relative_path(from_file: &str, target: &str, case_insensitive: bool) -> String {
    let from: Vec<&str> = parent_rel(from_file).split('/').filter(|p| !p.is_empty()).collect();
    let to: Vec<&str> = target.split('/').filter(|p| !p.is_empty()).collect();
    let common = from
        .iter()
        .zip(&to)
        .take_while(|(a, b)| same(a, b, case_insensitive))
        .count();
    let mut parts: Vec<&str> = vec![".."; from.len() - common];
    parts.extend(&to[common..]);
    parts.join("/")
}

/// Valor nuevo para una ruta que ahora vive en `file` y debe apuntar a
/// `target`, conservando el estilo del original: absoluta al proyecto si
/// empezaba por `/`, y con `./` delante si lo llevaba.
pub fn rewrite_value(original: &str, file: &str, target: &str, case_insensitive: bool) -> String {
    if original.starts_with('/') {
        return format!("/{target}");
    }
    let relative = relative_path(file, target, case_insensitive);
    if original.starts_with("./") && !relative.starts_with("../") {
        format!("./{relative}")
    } else {
        relative
    }
}

/// Dónde está `path` tras `moves` (pares de rutas relativas `desde → hasta`).
/// Si era uno de ellos o colgaba de una carpeta movida, su ruta nueva.
pub fn remap(path: &str, moves: &[(String, String)], case_insensitive: bool) -> Option<String> {
    for (from, to) in moves {
        if same(path, from, case_insensitive) {
            return Some(to.clone());
        }
        let prefix_len = from.len() + 1;
        // `is_char_boundary`: cortar por la longitud en bytes de `from` en mitad
        // de un carácter (una ruta con acentos) sería un pánico.
        if path.len() > prefix_len
            && path.is_char_boundary(from.len())
            && path.as_bytes()[from.len()] == b'/'
            && same(&path[..from.len()], from, case_insensitive)
        {
            return Some(format!("{to}/{}", &path[prefix_len..]));
        }
    }
    None
}

/// Literal Typst para `value`, con las comillas y los escapes necesarios.
fn literal(value: &str) -> String {
    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

/// Un cambio en un fuente: sustituir `range` por `replacement`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Change {
    pub range: Range<usize>,
    pub line: usize,
    pub old_value: String,
    pub new_value: String,
    pub replacement: String,
}

/// Cambios necesarios en el fuente `text`, que HOY vive en `file` (relativo
/// al proyecto), después de aplicar `moves`.
pub fn plan_file(file: &str, text: &str, moves: &[(String, String)], case_insensitive: bool) -> Vec<Change> {
    let inverse: Vec<(String, String)> = moves.iter().map(|(from, to)| (to.clone(), from.clone())).collect();
    let old_file = remap(file, &inverse, case_insensitive).unwrap_or_else(|| file.to_string());
    let file_moved = !same(&old_file, file, case_insensitive);

    let mut changes = Vec::new();
    for reference in find_path_refs(text) {
        let Some(old_target) = resolve_ref(&old_file, &reference.value) else { continue };
        let new_target = remap(&old_target, moves, case_insensitive);
        if !file_moved && new_target.is_none() {
            continue;
        }
        let new_target = new_target.unwrap_or(old_target);
        let still_resolves = resolve_ref(file, &reference.value)
            .is_some_and(|resolved| same(&resolved, &new_target, case_insensitive));
        if still_resolves {
            continue;
        }
        let new_value = rewrite_value(&reference.value, file, &new_target, case_insensitive);
        changes.push(Change {
            line: text[..reference.range.start].matches('\n').count() + 1,
            replacement: literal(&new_value),
            old_value: reference.value,
            new_value,
            range: reference.range,
        });
    }
    changes
}

/// `text` con `changes` aplicados (de atrás hacia delante, para que las
/// posiciones sigan valiendo).
pub fn apply_changes(text: &str, changes: &[Change]) -> String {
    let mut out = text.to_string();
    for change in changes.iter().rev() {
        out.replace_range(change.range.clone(), &change.replacement);
    }
    out
}

/// Posición UTF-16 (la de CodeMirror) de un desplazamiento en bytes (R-R2).
fn utf16_offset(text: &str, byte: usize) -> usize {
    text[..byte].encode_utf16().count()
}

// ── Comandos ─────────────────────────────────────────────────────────────────

const CASE_INSENSITIVE: bool = cfg!(any(windows, target_os = "macos"));

/// Documento abierto en el editor: se edita su contenido en memoria (con los
/// cambios sin guardar), nunca el disco (RF-70.5).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDocument {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChangeReport {
    pub line: usize,
    pub old_value: String,
    pub new_value: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileReport {
    pub path: String,
    pub relative: String,
    pub changes: Vec<ChangeReport>,
}

/// Una edición del documento abierto, en posiciones UTF-16 del texto enviado.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BufferEdit {
    pub from: usize,
    pub to: usize,
    pub insert: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RefsReport {
    /// Ficheros con cambios (incluido el abierto, si los tiene).
    pub files: Vec<FileReport>,
    /// Ediciones del documento abierto; el frontend las aplica al editor.
    pub open_document_edits: Vec<BufferEdit>,
    pub total: usize,
    /// Ficheros que no se pudieron escribir (se informa, no se aborta).
    pub failed: Vec<String>,
}

/// Ruta relativa al proyecto (con `/`) de una ruta absoluta, o `None` si no
/// cuelga de `root`.
fn to_relative(root: &str, path: &str) -> Option<String> {
    let normalize = |value: &str| value.replace('\\', "/").trim_end_matches('/').to_string();
    let root = normalize(root);
    let path = normalize(path);
    let prefix = format!("{root}/");
    if path.len() > prefix.len() && path.is_char_boundary(prefix.len()) && same(&path[..prefix.len()], &prefix, CASE_INSENSITIVE) {
        Some(path[prefix.len()..].to_string())
    } else {
        None
    }
}

/// Todos los `.typ` del proyecto, sin entrar en carpetas de ruido (`.git`…).
fn typst_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            if !is_noise_dir(&name) {
                typst_files(&path, out);
            }
        } else if name.to_lowercase().ends_with(".typ") {
            out.push(path);
        }
    }
}

fn plan_project(root: &str, moved: &[Moved], open: Option<&OpenDocument>, write: bool) -> Result<RefsReport, AppError> {
    let root_path = dunce::canonicalize(root).map_err(|e| AppError::Io(e.to_string()))?;
    let root_text = path_to_string(&root_path);
    let moves: Vec<(String, String)> = moved
        .iter()
        .filter_map(|m| Some((to_relative(&root_text, &m.from)?, to_relative(&root_text, &m.to)?)))
        .collect();
    let mut report = RefsReport::default();
    if moves.is_empty() {
        return Ok(report);
    }
    let open_relative = open.and_then(|doc| to_relative(&root_text, &doc.path));

    let mut files = Vec::new();
    typst_files(&root_path, &mut files);
    files.sort();
    for path in files {
        let absolute = path_to_string(&path);
        let Some(relative) = to_relative(&root_text, &absolute) else { continue };
        let is_open = open_relative.as_deref().is_some_and(|open| same(open, &relative, CASE_INSENSITIVE));
        let text = if is_open {
            open.map(|doc| doc.content.clone()).unwrap_or_default()
        } else {
            let too_big = fs::metadata(&path).map(|meta| meta.len() > MAX_TEXT_BYTES).unwrap_or(true);
            match (too_big, fs::read_to_string(&path)) {
                (false, Ok(text)) => text,
                _ => continue,
            }
        };
        let changes = plan_file(&relative, &text, &moves, CASE_INSENSITIVE);
        if changes.is_empty() {
            continue;
        }
        if is_open {
            report.open_document_edits = changes
                .iter()
                .map(|change| BufferEdit {
                    from: utf16_offset(&text, change.range.start),
                    to: utf16_offset(&text, change.range.end),
                    insert: change.replacement.clone(),
                })
                .collect();
        } else if write && {
            crate::history::capture_before_write(&path, "refs");
            write_atomic(&path, &apply_changes(&text, &changes)).is_err()
        } {
            report.failed.push(absolute.clone());
            continue;
        }
        report.total += changes.len();
        report.files.push(FileReport {
            path: absolute,
            relative,
            changes: changes
                .into_iter()
                .map(|change| ChangeReport { line: change.line, old_value: change.old_value, new_value: change.new_value })
                .collect(),
        });
    }
    Ok(report)
}

/// Qué referencias cambiarían tras `moved`, sin escribir nada (para la
/// preferencia «Preguntar antes de actualizar referencias», RF-70.9).
#[tauri::command]
pub fn refs_plan(root: String, moved: Vec<Moved>, open_document: Option<OpenDocument>) -> Result<RefsReport, AppError> {
    plan_project(&root, &moved, open_document.as_ref(), false)
}

/// Reescribe las referencias afectadas por `moved` en disco (de forma atómica,
/// fichero a fichero) y devuelve las ediciones del documento abierto para que
/// el frontend las aplique a su contenido sin guardar.
#[tauri::command]
pub fn refs_apply(root: String, moved: Vec<Moved>, open_document: Option<OpenDocument>) -> Result<RefsReport, AppError> {
    plan_project(&root, &moved, open_document.as_ref(), true)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn moves(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
        pairs.iter().map(|(a, b)| (a.to_string(), b.to_string())).collect()
    }

    fn rewritten(file: &str, text: &str, pairs: &[(&str, &str)]) -> String {
        apply_changes(text, &plan_file(file, text, &moves(pairs), true))
    }

    #[test]
    fn encuentra_include_import_y_funciones_de_ruta_pero_no_texto_suelto() {
        let text = r#"#import "plantilla.typ": conf
#import "@preview/cetz:0.3.1"
#include "capitulos/cap1.typ"
Esto "capitulos/cap1.typ" es texto, no una ruta.
#figure(image("img/logo.png", width: 50%))
#let datos = json("/datos/a.json")
#bibliography(("refs.bib", "otros.bib"))
#let p = path("x.csv")
#text(font: "fuente.ttf")[hola]"#;
        let values: Vec<String> = find_path_refs(text).into_iter().map(|r| r.value).collect();
        assert_eq!(
            values,
            ["plantilla.typ", "@preview/cetz:0.3.1", "capitulos/cap1.typ", "img/logo.png", "/datos/a.json", "refs.bib", "otros.bib", "x.csv"]
        );
    }

    #[test]
    fn resuelve_como_typst_relativa_al_fichero_absoluta_al_proyecto_y_con_puntos() {
        assert_eq!(resolve_ref("capitulos/cap1.typ", "img/a.png").as_deref(), Some("capitulos/img/a.png"));
        assert_eq!(resolve_ref("capitulos/cap1.typ", "./img/a.png").as_deref(), Some("capitulos/img/a.png"));
        assert_eq!(resolve_ref("capitulos/cap1.typ", "../img/a.png").as_deref(), Some("img/a.png"));
        assert_eq!(resolve_ref("capitulos/cap1.typ", "/img/a.png").as_deref(), Some("img/a.png"));
        assert_eq!(resolve_ref("main.typ", "../fuera.typ"), None);
        assert_eq!(resolve_ref("main.typ", "@preview/x:1.0.0"), None);
    }

    #[test]
    fn mover_un_capitulo_actualiza_el_include_que_entra() {
        let text = "#include \"cap1.typ\"\n#include \"cap2.typ\"\n";
        assert_eq!(
            rewritten("main.typ", text, &[("cap1.typ", "capitulos/cap1.typ")]),
            "#include \"capitulos/cap1.typ\"\n#include \"cap2.typ\"\n"
        );
    }

    #[test]
    fn mover_un_capitulo_reescribe_tambien_sus_propias_rutas_relativas() {
        // cap1.typ estaba en la raíz y usaba img/a.png; ahora vive en capitulos/.
        let text = "#image(\"img/a.png\")\n#image(\"/img/b.png\")\n";
        assert_eq!(
            rewritten("capitulos/cap1.typ", text, &[("cap1.typ", "capitulos/cap1.typ")]),
            "#image(\"../img/a.png\")\n#image(\"/img/b.png\")\n"
        );
    }

    #[test]
    fn una_ruta_absoluta_al_proyecto_conserva_su_estilo() {
        let text = "#image(\"/img/logo.png\")";
        assert_eq!(rewritten("main.typ", text, &[("img", "recursos/img")]), "#image(\"/recursos/img/logo.png\")");
    }

    #[test]
    fn el_prefijo_punto_barra_se_conserva() {
        let text = "#include \"./cap1.typ\"";
        assert_eq!(rewritten("main.typ", text, &[("cap1.typ", "partes/cap1.typ")]), "#include \"./partes/cap1.typ\"");
    }

    #[test]
    fn mover_una_carpeta_no_toca_las_referencias_internas_y_si_las_que_entran_y_salen() {
        let moved = [("partes", "anexos/partes")];
        // Dentro de la carpeta movida: la interna sigue valiendo; la que sale no.
        let inside = "#image(\"img/x.png\")\n#include \"../comun.typ\"";
        assert_eq!(rewritten("anexos/partes/a.typ", inside, &moved), "#image(\"img/x.png\")\n#include \"../../comun.typ\"");
        // Desde fuera: la que entra.
        assert_eq!(rewritten("main.typ", "#include \"partes/a.typ\"", &moved), "#include \"anexos/partes/a.typ\"");
    }

    #[test]
    fn bibliography_con_array_actualiza_solo_el_elemento_movido() {
        let text = "#bibliography((\"refs.bib\", \"otros.bib\"))";
        assert_eq!(
            rewritten("main.typ", text, &[("refs.bib", "bib/refs.bib")]),
            "#bibliography((\"bib/refs.bib\", \"otros.bib\"))"
        );
    }

    #[test]
    fn import_con_alias_se_actualiza() {
        let text = "#import \"utils.typ\" as u";
        assert_eq!(rewritten("main.typ", text, &[("utils.typ", "lib/utils.typ")]), "#import \"lib/utils.typ\" as u");
    }

    #[test]
    fn una_ruta_en_una_variable_no_se_toca() {
        // Límite declarado: solo se ven literales pasados directamente.
        let text = "#let logo = \"img/logo.png\"\n#image(logo)";
        assert_eq!(rewritten("main.typ", text, &[("img", "recursos/img")]), text);
    }

    #[test]
    fn distingue_mayusculas_solo_si_el_sistema_no_lo_hace() {
        let text = "#include \"Cap1.typ\"";
        assert_eq!(rewritten("main.typ", text, &[("cap1.typ", "capitulos/cap1.typ")]), "#include \"capitulos/cap1.typ\"");
        let sensitive = apply_changes(text, &plan_file("main.typ", text, &moves(&[("cap1.typ", "capitulos/cap1.typ")]), false));
        assert_eq!(sensitive, text);
    }

    #[test]
    fn escapes_y_caracteres_no_ascii_se_respetan() {
        let text = "= Título con acentos 🎉\n#include \"capítulo 1.typ\" // ñ\n";
        assert_eq!(
            rewritten("main.typ", text, &[("capítulo 1.typ", "partes/capítulo 1.typ")]),
            "= Título con acentos 🎉\n#include \"partes/capítulo 1.typ\" // ñ\n"
        );
        // Posiciones UTF-16 para el editor (R-R2): el emoji ocupa dos unidades.
        let changes = plan_file("main.typ", text, &moves(&[("capítulo 1.typ", "partes/capítulo 1.typ")]), true);
        let start = utf16_offset(text, changes[0].range.start);
        let utf16: Vec<u16> = text.encode_utf16().collect();
        assert_eq!(String::from_utf16(&utf16[start..start + 1]).unwrap(), "\"");
        assert_eq!(changes[0].line, 2);
    }

    #[test]
    fn un_fichero_con_errores_de_sintaxis_se_actualiza_en_lo_reconocible() {
        let text = "#include \"cap1.typ\"\n#let x = (\n";
        assert!(rewritten("main.typ", text, &[("cap1.typ", "c/cap1.typ")]).starts_with("#include \"c/cap1.typ\""));
    }

    #[test]
    fn refs_apply_reescribe_el_disco_y_devuelve_las_ediciones_del_abierto() {
        let dir = tempfile::tempdir().unwrap();
        let root = dunce::canonicalize(dir.path()).unwrap();
        fs::create_dir(root.join("capitulos")).unwrap();
        fs::write(root.join("capitulos").join("cap1.typ"), "#image(\"img/a.png\")").unwrap();
        fs::write(root.join("otro.typ"), "#include \"cap1.typ\"").unwrap();
        let main = root.join("main.typ");
        fs::write(&main, "#include \"cap1.typ\"").unwrap();
        let moved = vec![Moved {
            from: path_to_string(&root.join("cap1.typ")),
            to: path_to_string(&root.join("capitulos").join("cap1.typ")),
        }];
        let open = OpenDocument { path: path_to_string(&main), content: "= Sin guardar\n#include \"cap1.typ\"".into() };

        let report = refs_apply(path_to_string(&root), moved, Some(open)).unwrap();

        assert_eq!(fs::read_to_string(root.join("otro.typ")).unwrap(), "#include \"capitulos/cap1.typ\"");
        assert_eq!(fs::read_to_string(root.join("capitulos").join("cap1.typ")).unwrap(), "#image(\"../img/a.png\")");
        // El abierto NO se escribe: se devuelve la edición sobre su contenido.
        assert_eq!(fs::read_to_string(&main).unwrap(), "#include \"cap1.typ\"");
        assert_eq!(report.open_document_edits, vec![BufferEdit { from: 23, to: 33, insert: "\"capitulos/cap1.typ\"".into() }]);
        assert_eq!(report.total, 3);
        assert_eq!(report.files.len(), 3);
    }

    #[test]
    fn refs_plan_no_escribe_nada() {
        let dir = tempfile::tempdir().unwrap();
        let root = dunce::canonicalize(dir.path()).unwrap();
        fs::write(root.join("main.typ"), "#include \"cap1.typ\"").unwrap();
        let moved = vec![Moved { from: path_to_string(&root.join("cap1.typ")), to: path_to_string(&root.join("c").join("cap1.typ")) }];
        let report = refs_plan(path_to_string(&root), moved, None).unwrap();
        assert_eq!(report.total, 1);
        assert_eq!(fs::read_to_string(root.join("main.typ")).unwrap(), "#include \"cap1.typ\"");
    }

    /// R-R3: las reglas de resolución son las de Typst de verdad. Se mueve un
    /// capítulo con `fs_move`, se actualizan las referencias y el motor en
    /// proceso compila el proyecto sin «file not found» (sin actualizar, falla).
    #[test]
    fn tras_mover_y_actualizar_el_proyecto_compila_con_el_motor_real() {
        use crate::commands::fs_ops::fs_move;
        use crate::engine::world::EngineWorld;
        use typst_layout::PagedDocument;

        let dir = tempfile::tempdir().unwrap();
        let root = dunce::canonicalize(dir.path()).unwrap();
        fs::create_dir_all(root.join("datos")).unwrap();
        fs::create_dir_all(root.join("capitulos")).unwrap();
        fs::write(root.join("datos").join("a.txt"), "hola").unwrap();
        fs::write(root.join("main.typ"), "#include \"cap1.typ\"\n").unwrap();
        fs::write(root.join("cap1.typ"), "= Uno\n#read(\"datos/a.txt\")\n").unwrap();
        let root_text = path_to_string(&root);
        let compile = || {
            let world = EngineWorld::new(&root, &root.join("main.typ")).unwrap();
            world.begin_compile();
            typst::compile::<PagedDocument>(&*world)
                .output
                .map(|_| ())
                .map_err(|errors| errors.iter().map(|e| e.message.to_string()).collect::<Vec<_>>().join(" | "))
        };
        assert!(compile().is_ok());

        let moved = fs_move(root_text.clone(), vec![path_to_string(&root.join("cap1.typ"))], path_to_string(&root.join("capitulos"))).unwrap();
        assert!(compile().is_err(), "sin actualizar referencias el proyecto debe romperse");

        refs_apply(root_text, moved, None).unwrap();
        compile().expect("tras actualizar las referencias debe compilar");
    }

    #[test]
    fn rendimiento_doscientos_ficheros_en_menos_de_un_segundo() {
        let dir = tempfile::tempdir().unwrap();
        let root = dunce::canonicalize(dir.path()).unwrap();
        let body: String = (0..40).map(|i| format!("= Sección {i}\n#image(\"img/f{i}.png\")\nTexto de relleno.\n")).collect();
        for i in 0..200 {
            fs::write(root.join(format!("c{i}.typ")), format!("#include \"cap.typ\"\n{body}")).unwrap();
        }
        let moved = vec![Moved { from: path_to_string(&root.join("cap.typ")), to: path_to_string(&root.join("x").join("cap.typ")) }];
        let started = std::time::Instant::now();
        let report = refs_plan(path_to_string(&root), moved, None).unwrap();
        assert_eq!(report.total, 200);
        assert!(started.elapsed().as_millis() < 1000, "{:?}", started.elapsed());
    }
}
