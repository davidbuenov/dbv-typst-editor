// =============================================================================
// DBV Typst Editor — Buscar (y preparar reemplazos) en todo el proyecto (RF-78)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Un solo motor de expresiones regulares para validar, buscar y calcular los
// reemplazos: el crate `regex` (R-S1). Si el frontend validara con el motor de
// JavaScript y aquí se buscara con el de Rust, habría patrones (lookaround,
// retroreferencias) que se aceptan y luego fallan o se comportan distinto.
//
// Dónde busca: los ficheros de texto editables del proyecto (Typst y los
// acompañantes de RF-60, hasta `MAX_TEXT_BYTES`), sin carpetas de ruido ni
// ocultas (salvo que se pidan) y sin seguir enlaces simbólicos. Las pestañas
// abiertas se buscan en su contenido del editor, con los cambios sin guardar.
//
// Posiciones: línea y columna en unidades UTF-16, como LSP y como las cadenas
// de JavaScript, para que el frontend aplique los reemplazos sin convertir
// nada (R-E1).
//
// Cancelación (R-S2): cada búsqueda lleva un id; una más nueva lo sustituye en
// `LATEST_SEARCH` y la anterior se abandona entre fichero y fichero.

use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};

use crate::commands::file_io::{has_extension, is_noise_dir, path_to_string, COMPANION_EXTENSIONS, MAX_TEXT_BYTES, TYPST_EXTENSIONS};
use crate::error::AppError;

/// Tope de coincidencias por búsqueda: más no se pueden revisar a mano, y
/// pintarlas bloquearía la interfaz (R-S2).
pub const MAX_MATCHES: usize = 10_000;

/// Id de la búsqueda vigente: las anteriores se abandonan.
static LATEST_SEARCH: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SearchOptions {
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub regex: bool,
    /// Patrones separados por comas (`*.typ, cap/**`); vacío = todos.
    pub include: String,
    pub exclude: String,
    /// Buscar también en carpetas y ficheros que empiezan por punto (RF-63.1).
    pub include_hidden: bool,
}

/// Una pestaña abierta con su contenido del editor.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenText {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub struct Position {
    pub line: usize,
    pub character: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub start: Position,
    pub end: Position,
    /// Línea donde empieza la coincidencia, y el tramo resaltado en ella (UTF-16).
    pub preview: String,
    pub preview_start: usize,
    pub preview_end: usize,
    /// Texto que la sustituiría, con `$1`/`${nombre}` ya expandidos.
    pub replacement: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileMatches {
    pub path: String,
    pub relative: String,
    pub matches: Vec<SearchMatch>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub files: Vec<FileMatches>,
    pub total: usize,
    /// Se llegó a `MAX_MATCHES` y no se siguió buscando.
    pub truncated: bool,
    /// Una búsqueda más nueva la sustituyó: el frontend la descarta.
    pub cancelled: bool,
}

/// La expresión de búsqueda. Texto literal si no se pidió expresión regular;
/// palabra completa con `\b`. El error de sintaxis se devuelve tal cual lo da
/// `regex`, para enseñarlo en el campo (RF-78.6).
pub fn build_regex(query: &str, options: &SearchOptions) -> Result<Regex, AppError> {
    let body = if options.regex { query.to_string() } else { regex::escape(query) };
    let pattern = if options.whole_word { format!(r"\b(?:{body})\b") } else { body };
    RegexBuilder::new(&pattern)
        .case_insensitive(!options.case_sensitive)
        .multi_line(true)
        .build()
        .map_err(|error| AppError::Parse(error.to_string()))
}

/// Un patrón de ficheros simple (`*`, `**`, `?`) como expresión regular sobre
/// la ruta relativa con `/`. Sin `/`, basta con que coincida el nombre del
/// fichero o una de sus carpetas (`*.typ`, `apendices`), como en VS Code.
fn glob_to_regex(glob: &str) -> Option<Regex> {
    let glob = glob.trim().trim_start_matches("./").trim_end_matches('/');
    if glob.is_empty() {
        return None;
    }
    let mut body = String::new();
    let mut chars = glob.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '*' if chars.peek() == Some(&'*') => {
                chars.next();
                if chars.peek() == Some(&'/') {
                    chars.next();
                    body.push_str("(?:.*/)?");
                } else {
                    body.push_str(".*");
                }
            }
            '*' => body.push_str("[^/]*"),
            '?' => body.push_str("[^/]"),
            other => body.push_str(&regex::escape(&other.to_string())),
        }
    }
    let pattern = if glob.contains('/') { format!("(?i)^{body}(?:/.*)?$") } else { format!("(?i)(?:^|/){body}(?:/|$)") };
    Regex::new(&pattern).ok()
}

/// Lista de patrones separados por comas.
fn globs(list: &str) -> Vec<Regex> {
    list.split(',').filter_map(glob_to_regex).collect()
}

/// ¿Entra `relative` con los filtros incluir/excluir?
pub fn passes_filters(relative: &str, include: &[Regex], exclude: &[Regex]) -> bool {
    let included = include.is_empty() || include.iter().any(|glob| glob.is_match(relative));
    included && !exclude.iter().any(|glob| glob.is_match(relative))
}

/// Ficheros de texto editables del proyecto, con su ruta relativa (con `/`).
fn project_files(root: &Path, include_hidden: bool) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let walker = walkdir::WalkDir::new(root)
        .follow_links(false)
        .max_depth(64)
        .into_iter()
        .filter_entry(|entry| {
            let name = entry.file_name().to_string_lossy();
            let hidden = name.starts_with('.') && entry.depth() > 0;
            let noise = entry.file_type().is_dir() && is_noise_dir(&name);
            !noise && (include_hidden || !hidden)
        });
    for entry in walker.flatten() {
        if !entry.file_type().is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if !(has_extension(&name, &TYPST_EXTENSIONS) || has_extension(&name, COMPANION_EXTENSIONS)) {
            continue;
        }
        let too_big = entry.metadata().map(|meta| meta.len() > MAX_TEXT_BYTES).unwrap_or(true);
        if too_big {
            continue;
        }
        let Ok(relative) = entry.path().strip_prefix(root) else { continue };
        let relative = relative.to_string_lossy().replace('\\', "/");
        out.push((path_to_string(entry.path()), relative));
    }
    out.sort_by(|a, b| a.1.cmp(&b.1));
    out
}

/// Longitud en unidades UTF-16 de un tramo de texto.
fn utf16_len(text: &str) -> usize {
    text.encode_utf16().count()
}

/// Coincidencias de `regex` en `text`, hasta `budget`.
pub fn find_in_text(text: &str, regex: &Regex, replacement: Option<&str>, budget: usize) -> Vec<SearchMatch> {
    // Inicio (en bytes) de cada línea, para pasar de byte a línea/columna.
    let line_starts: Vec<usize> = std::iter::once(0).chain(text.match_indices('\n').map(|(index, _)| index + 1)).collect();
    let position = |byte: usize| {
        let line = line_starts.partition_point(|&start| start <= byte) - 1;
        Position { line, character: utf16_len(&text[line_starts[line]..byte]) }
    };
    let mut matches = Vec::new();
    for captures in regex.captures_iter(text) {
        if matches.len() >= budget {
            break;
        }
        let whole = captures.get(0).expect("la coincidencia completa existe");
        // Una coincidencia vacía (`^`, `a*`) no es algo que se pueda revisar.
        if whole.start() == whole.end() {
            continue;
        }
        let start = position(whole.start());
        let end = position(whole.end());
        let line_start = line_starts[start.line];
        let line_end = text[line_start..].find('\n').map_or(text.len(), |offset| line_start + offset);
        let preview = text[line_start..line_end].trim_end_matches('\r').to_string();
        let preview_end = if end.line == start.line { end.character } else { utf16_len(&preview) };
        let expanded = replacement.map(|template| {
            let mut out = String::new();
            captures.expand(template, &mut out);
            out
        });
        matches.push(SearchMatch {
            start,
            end,
            preview_start: start.character.min(utf16_len(&preview)),
            preview_end: preview_end.min(utf16_len(&preview)),
            preview,
            replacement: expanded,
        });
    }
    matches
}

/// Búsqueda completa (síncrona; el comando la lanza en un hilo aparte).
pub fn search_project(
    root: &Path,
    query: &str,
    options: &SearchOptions,
    replacement: Option<&str>,
    open: &[OpenText],
    search_id: u64,
) -> Result<SearchResult, AppError> {
    let mut result = SearchResult::default();
    if query.is_empty() {
        return Ok(result);
    }
    let regex = build_regex(query, options)?;
    let include = globs(&options.include);
    let exclude = globs(&options.exclude);
    let case_insensitive_fs = cfg!(any(windows, target_os = "macos"));
    let key = |path: &str| {
        let normal = path.replace('\\', "/");
        if case_insensitive_fs { normal.to_lowercase() } else { normal }
    };
    let open_by_path: HashMap<String, &OpenText> = open.iter().map(|doc| (key(&doc.path), doc)).collect();

    for (path, relative) in project_files(root, options.include_hidden) {
        if search_id != 0 && LATEST_SEARCH.load(Ordering::SeqCst) != search_id {
            result.cancelled = true;
            break;
        }
        if !passes_filters(&relative, &include, &exclude) {
            continue;
        }
        let text = match open_by_path.get(&key(&path)) {
            Some(doc) => doc.content.clone(),
            None => match fs::read_to_string(&path) {
                Ok(text) if !text.contains('\0') => text,
                _ => continue,
            },
        };
        let matches = find_in_text(&text, &regex, replacement, MAX_MATCHES - result.total);
        if matches.is_empty() {
            continue;
        }
        result.total += matches.len();
        result.files.push(FileMatches { path, relative, matches });
        if result.total >= MAX_MATCHES {
            result.truncated = true;
            break;
        }
    }
    Ok(result)
}

/// Busca `query` en el proyecto (RF-78). Con `replacement`, cada coincidencia
/// trae además su texto de reemplazo expandido. Asíncrono: no bloquea la
/// interfaz, y una búsqueda más nueva cancela esta (R-S2).
#[tauri::command]
pub async fn search_project_cmd(
    root: String,
    query: String,
    options: SearchOptions,
    replacement: Option<String>,
    open_documents: Vec<OpenText>,
    search_id: u64,
) -> Result<SearchResult, AppError> {
    LATEST_SEARCH.store(search_id, Ordering::SeqCst);
    tauri::async_runtime::spawn_blocking(move || {
        search_project(Path::new(&root), &query, &options, replacement.as_deref(), &open_documents, search_id)
    })
    .await
    .map_err(|error| AppError::Io(error.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> SearchOptions {
        SearchOptions::default()
    }

    fn project(files: &[(&str, &str)]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for (name, content) in files {
            let path = dir.path().join(name);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, content).unwrap();
        }
        dir
    }

    fn run(dir: &tempfile::TempDir, query: &str, options: &SearchOptions) -> SearchResult {
        search_project(dir.path(), query, options, None, &[], 0).unwrap()
    }

    #[test]
    fn distingue_mayusculas_solo_si_se_pide() {
        let dir = project(&[("main.typ", "Gato gato GATO")]);
        assert_eq!(run(&dir, "gato", &options()).total, 3);
        assert_eq!(run(&dir, "gato", &SearchOptions { case_sensitive: true, ..options() }).total, 1);
    }

    #[test]
    fn palabra_completa_no_casa_dentro_de_otra() {
        let dir = project(&[("main.typ", "gato gatos engatusar")]);
        assert_eq!(run(&dir, "gato", &SearchOptions { whole_word: true, ..options() }).total, 1);
    }

    #[test]
    fn el_texto_literal_escapa_los_simbolos_de_regex() {
        let dir = project(&[("main.typ", "#box(width: 1cm) y box(")]);
        assert_eq!(run(&dir, "box(", &options()).total, 2);
    }

    #[test]
    fn expresion_regular_con_grupos_y_reemplazo_expandido() {
        let dir = project(&[("main.typ", "fig-gato y fig-perro")]);
        let opts = SearchOptions { regex: true, ..options() };
        let result = search_project(dir.path(), r"fig-(\w+)", &opts, Some("figura-$1"), &[], 0).unwrap();
        let replacements: Vec<_> = result.files[0].matches.iter().map(|m| m.replacement.clone().unwrap()).collect();
        assert_eq!(replacements, vec!["figura-gato", "figura-perro"]);
    }

    #[test]
    fn una_expresion_regular_invalida_es_un_error_con_el_mensaje_de_regex() {
        let dir = project(&[("main.typ", "x")]);
        let error = search_project(dir.path(), "(?<=a)b", &SearchOptions { regex: true, ..options() }, None, &[], 0).unwrap_err();
        assert!(matches!(error, AppError::Parse(message) if message.contains("look")), "sin lookaround en `regex`");
    }

    #[test]
    fn columnas_utf16_con_acentos_y_emoji() {
        let dir = project(&[("main.typ", "ñandú 😀 gato\nsegunda gato")]);
        let result = run(&dir, "gato", &options());
        let matches = &result.files[0].matches;
        assert_eq!(matches[0].start, Position { line: 0, character: 9 }, "ñandú(5) espacio 😀(2) espacio");
        assert_eq!(matches[0].end, Position { line: 0, character: 13 });
        assert_eq!(matches[1].start, Position { line: 1, character: 8 });
        assert_eq!(&matches[0].preview, "ñandú 😀 gato");
    }

    #[test]
    fn ocultos_ruido_binarios_y_no_editables_se_excluyen() {
        let dir = project(&[
            ("main.typ", "gato"),
            (".oculto/a.typ", "gato"),
            (".git/config.typ", "gato"),
            ("node_modules/x.typ", "gato"),
            ("imagen.png", "gato"),
            ("datos.csv", "gato"),
        ]);
        fs::write(dir.path().join("binario.typ"), b"gato\0\x01").unwrap();
        let files: Vec<_> = run(&dir, "gato", &options()).files.into_iter().map(|file| file.relative).collect();
        assert_eq!(files, vec!["datos.csv", "main.typ"]);

        let with_hidden: Vec<_> =
            run(&dir, "gato", &SearchOptions { include_hidden: true, ..options() }).files.into_iter().map(|file| file.relative).collect();
        assert!(with_hidden.contains(&".oculto/a.typ".to_string()));
        assert!(!with_hidden.iter().any(|file| file.starts_with(".git/")), "el ruido de repositorio nunca");
    }

    #[test]
    fn filtros_incluir_y_excluir() {
        let dir = project(&[("main.typ", "gato"), ("cap/uno.typ", "gato"), ("refs.bib", "gato"), ("apendices/a.typ", "gato")]);
        let names = |include: &str, exclude: &str| -> Vec<String> {
            let opts = SearchOptions { include: include.into(), exclude: exclude.into(), ..options() };
            run(&dir, "gato", &opts).files.into_iter().map(|file| file.relative).collect()
        };
        assert_eq!(names("*.typ", ""), vec!["apendices/a.typ", "cap/uno.typ", "main.typ"]);
        assert_eq!(names("*.typ", "apendices"), vec!["cap/uno.typ", "main.typ"]);
        assert_eq!(names("cap/**", ""), vec!["cap/uno.typ"]);
        assert_eq!(names("*.bib, cap/*.typ", ""), vec!["cap/uno.typ", "refs.bib"]);
    }

    #[test]
    fn los_ficheros_por_encima_del_limite_se_omiten() {
        let dir = project(&[("main.typ", "gato")]);
        fs::write(dir.path().join("grande.typ"), format!("gato{}", "x".repeat(MAX_TEXT_BYTES as usize))).unwrap();
        let files: Vec<_> = run(&dir, "gato", &options()).files.into_iter().map(|file| file.relative).collect();
        assert_eq!(files, vec!["main.typ"]);
    }

    #[test]
    fn las_pestanas_abiertas_se_buscan_en_su_contenido_del_editor() {
        let dir = project(&[("main.typ", "en disco")]);
        let open = vec![OpenText { path: path_to_string(&dir.path().join("main.typ")), content: "gato sin guardar".into() }];
        let result = search_project(dir.path(), "gato", &options(), None, &open, 0).unwrap();
        assert_eq!(result.total, 1);
    }

    #[test]
    fn una_busqueda_mas_nueva_cancela_la_anterior() {
        let dir = project(&[("a.typ", "gato"), ("b.typ", "gato")]);
        LATEST_SEARCH.store(7, Ordering::SeqCst);
        let result = search_project(dir.path(), "gato", &options(), None, &[], 6).unwrap();
        assert!(result.cancelled);
        assert!(result.files.is_empty());
    }

    #[test]
    fn rendimiento_doscientos_ficheros_en_menos_de_un_segundo() {
        let files: Vec<(String, String)> = (0..200)
            .map(|i| (format!("cap{i}/capitulo.typ"), format!("= Capítulo {i}\n{}\nEl gato duerme.\n", "Texto de relleno. ".repeat(400))))
            .collect();
        let refs: Vec<(&str, &str)> = files.iter().map(|(a, b)| (a.as_str(), b.as_str())).collect();
        let dir = project(&refs);
        let started = std::time::Instant::now();
        let result = run(&dir, "gato", &options());
        assert_eq!(result.total, 200);
        assert!(started.elapsed().as_millis() < 1000, "tardó {:?}", started.elapsed());
    }
}
