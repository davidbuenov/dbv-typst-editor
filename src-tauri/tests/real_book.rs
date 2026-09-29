// =============================================================================
// DBV Typst Editor — Aceptación sobre un libro real (RF-78.7, RF-82.5, RF-89.7)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Los criterios de aceptación de la 0.12.0 se piden sobre un libro real de
// más de 200 páginas (`z6-IPbook`), que no se versiona: no es nuestro. Estos
// tests se ejecutan a mano, con una COPIA del libro (el de escritura trabaja
// sobre ella y la restaura):
//
//   DBV_REAL_BOOK=<carpeta con una copia> DBV_REAL_BOOK_MAIN=IP.typ \
//     cargo test --release --test real_book -- --ignored --nocapture

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

use dbv_typst_editor_lib::engine::outline::headings;
use dbv_typst_editor_lib::engine::text_layer::TextLayer;
use dbv_typst_editor_lib::engine::world::EngineWorld;
use dbv_typst_editor_lib::search::{search_project, SearchOptions};
use dbv_typst_editor_lib::typst_engine::outline::{parse_cli_outline, OUTLINE_QUERY};
use typst_layout::PagedDocument;

/// Los tests comparten UNA copia del libro y uno de ellos la reescribe (y la
/// restaura): en paralelo, la prueba de paridad del esquema leía un encabezado
/// a medio reemplazar (visto en `/test` de la 0.12.1). Se ejecutan de uno en uno.
static BOOK_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn lock_book() -> std::sync::MutexGuard<'static, ()> {
    BOOK_LOCK.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

fn book() -> Option<(PathBuf, PathBuf)> {
    let root = PathBuf::from(std::env::var("DBV_REAL_BOOK").ok()?);
    let main = root.join(std::env::var("DBV_REAL_BOOK_MAIN").unwrap_or_else(|_| "main.typ".into()));
    Some((root, main))
}

/// Byte de una posición (línea, columna UTF-16) de `text`.
fn byte_at(text: &str, line: usize, character: usize) -> usize {
    let start: usize = text.split_inclusive('\n').take(line).map(str::len).sum();
    let mut units = 0;
    for (offset, c) in text[start..].char_indices() {
        if units >= character {
            return start + offset;
        }
        units += c.len_utf16();
    }
    text.len()
}

/// Aplica los reemplazos de una búsqueda (de atrás hacia delante).
fn apply(root: &Path, result: &dbv_typst_editor_lib::search::SearchResult) {
    for file in &result.files {
        let path = root.join(&file.relative);
        let mut text = fs::read_to_string(&path).unwrap();
        let mut edits: Vec<_> = file
            .matches
            .iter()
            .map(|m| (byte_at(&text, m.start.line, m.start.character), byte_at(&text, m.end.line, m.end.character), m.replacement.clone().unwrap()))
            .collect();
        edits.sort_by(|a, b| b.0.cmp(&a.0));
        for (from, to, insert) in edits {
            text.replace_range(from..to, &insert);
        }
        fs::write(path, text).unwrap();
    }
}

/// RF-78.7: buscar una palabra que sale en varios ficheros los lista todos en
/// menos de 1 s; reemplazarla (por un texto con `Ñ`, para ejercitar las columnas
/// UTF-16) y deshacer (el reemplazo inverso) deja el libro exactamente como estaba.
#[test]
#[ignore = "necesita DBV_REAL_BOOK con una copia del libro"]
fn buscar_reemplazar_y_deshacer_en_el_libro_real() {
    let _book = lock_book();
    let Some((root, _)) = book() else { return };
    // Una palabra que salga en varios ficheros del libro (`DBV_REAL_BOOK_WORD`).
    let word = std::env::var("DBV_REAL_BOOK_WORD").unwrap_or_else(|_| "program".into());
    let options = SearchOptions { whole_word: true, case_sensitive: true, ..SearchOptions::default() };
    let before: Vec<(PathBuf, String)> = walk(&root).into_iter().map(|p| (p.clone(), fs::read_to_string(&p).unwrap_or_default())).collect();

    let started = Instant::now();
    let found = search_project(&root, &word, &options, None, &[], 0).unwrap();
    let elapsed = started.elapsed();
    println!("«{word}»: {} coincidencias en {} ficheros, {:?}", found.total, found.files.len(), elapsed);
    assert!(found.files.len() > 1, "debe salir en varios ficheros");
    assert!(elapsed.as_millis() < 1000, "demasiado lenta: {elapsed:?}");

    let replaced = search_project(&root, &word, &options, Some("PALABRA_Ñ_X"), &[], 0).unwrap();
    apply(&root, &replaced);
    assert_eq!(search_project(&root, &word, &options, None, &[], 0).unwrap().total, 0);
    let undo = search_project(&root, "PALABRA_Ñ_X", &options, Some(&word), &[], 0).unwrap();
    assert_eq!(undo.total, found.total);
    apply(&root, &undo);

    for (path, text) in before {
        assert_eq!(fs::read_to_string(&path).unwrap_or_default(), text, "{} no quedó como estaba", path.display());
    }
}

/// RF-82.5: una palabra de la página 150 se encuentra (con la capa de texto,
/// sin haber pintado ninguna página) y el texto de un párrafo es legible.
#[test]
#[ignore = "necesita DBV_REAL_BOOK con una copia del libro"]
fn buscar_en_la_pagina_150_del_libro_real() {
    let _book = lock_book();
    let Some((root, main)) = book() else { return };
    let world = EngineWorld::new(&root, &main).unwrap();
    world.begin_compile();
    let document = typst::compile::<PagedDocument>(&*world).output.expect("el libro debe compilar");
    println!("{} páginas", document.pages().len());
    assert!(document.pages().len() >= 150);

    let started = Instant::now();
    let layer = TextLayer::build(&document);
    println!("capa de texto: {:?}", started.elapsed());
    let page = layer.page(149).unwrap();
    // Una palabra larga de la página 150 que no salga antes.
    let word = page
        .text
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.chars().count() >= 9)
        .find(|w| layer.search(w, true).first().map(|m| m.page) == Some(150))
        .expect("alguna palabra propia de la página 150");
    let matches = layer.search(word, true);
    println!("«{word}»: primera coincidencia en la página {}", matches[0].page);
    assert_eq!(matches[0].page, 150);
    let sample: String = page.text.chars().take(300).collect();
    println!("texto de la página 150: {sample}…");
    assert!(sample.split_whitespace().count() > 20, "el texto debe salir con sus espacios");
}

/// Ficheros de texto del libro (para comparar antes y después).
/// RF-89.7: el esquema del motor en proceso es el mismo que el del CLI (el
/// respaldo) sobre el libro real: mismas entradas, nivel, página y posición
/// exactos, y el mismo texto salvo espacios. Necesita además el sidecar
/// vendorizado (`npm run vendor:typst`).
#[test]
#[ignore = "necesita DBV_REAL_BOOK con una copia del libro"]
fn el_esquema_en_proceso_coincide_con_el_del_cli_en_el_libro_real() {
    let _book = lock_book();
    let Some((root, main)) = book() else { return };
    let world = EngineWorld::new(&root, &main).unwrap();
    world.begin_compile();
    let document = typst::compile::<PagedDocument>(&*world).output.expect("el libro debe compilar");
    let started = Instant::now();
    let inproc = headings(&document);
    println!("esquema en proceso: {} entradas en {:?}", inproc.len(), started.elapsed());

    let sidecar = fs::read_dir(Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries"))
        .unwrap()
        .flatten()
        .map(|entry| entry.path())
        .find(|path| path.file_name().is_some_and(|name| name.to_string_lossy().starts_with("typst-")))
        .expect("falta el sidecar: npm run vendor:typst");
    let output = Command::new(sidecar)
        .args(["eval", OUTLINE_QUERY, "--root"])
        .arg(&root)
        .arg("--in")
        .arg(&main)
        .args(["--format", "json"])
        .output()
        .unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    let cli = parse_cli_outline(&String::from_utf8_lossy(&output.stdout)).unwrap();
    println!("esquema del CLI: {} entradas", cli.len());

    let squash = |text: &str| text.split_whitespace().collect::<Vec<_>>().join(" ");
    assert!(!inproc.is_empty(), "el libro tiene encabezados");
    assert_eq!(inproc.len(), cli.len(), "distinto número de entradas");
    for (a, b) in inproc.iter().zip(&cli) {
        assert_eq!((a.level, a.page), (b.level, b.page), "{a:?} vs {b:?}");
        assert!((a.y_pt - b.y_pt).abs() < 0.01, "posición distinta: {a:?} vs {b:?}");
        assert_eq!(squash(&a.text), squash(&b.text), "texto distinto");
    }
}

fn walk(root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let mut pending = vec![root.to_path_buf()];
    while let Some(dir) = pending.pop() {
        for entry in fs::read_dir(dir).unwrap().flatten() {
            let path = entry.path();
            if entry.file_type().unwrap().is_dir() {
                if !entry.file_name().to_string_lossy().starts_with('.') {
                    pending.push(path);
                }
            } else if path.extension().is_some_and(|e| e == "typ" || e == "bib") {
                out.push(path);
            }
        }
    }
    out
}
