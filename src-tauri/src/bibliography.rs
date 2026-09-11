// =============================================================================
// DBV Typst Editor — Claves de citas del proyecto (Beta, ARCHITECTURE.md §7.7.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El asistente "Insertar cita" necesita las claves reales del `.bib` del
// proyecto para el desplegable de autocompletado, no la bibliografía entera
// (autor, título, año...). Igual que la detección de "Paquetes usados" del
// Package Explorer abandonó `typst::syntax::parse` a favor de un escaneo de
// texto ligero (ARCHITECTURE.md §275, `TYPST_ECOSYSTEM_RESEARCH.md` §2.5), esto
// hace lo mismo con BibTeX: solo la clave de cada entrada (`@article{clave,`),
// con una expresión regular acotada — no un parser BibTeX completo. Evita a
// propósito abrir la pregunta pendiente en `SPECIFICATIONS.md` §9 ("qué crate
// de parseo BibTeX usar"), que sigue sin resolver y sigue sin hacer falta para
// esto: el asistente solo necesita saber qué claves existen, no leer los
// campos de cada entrada.

use std::collections::HashSet;
use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::error::AppError;

/// Cada entrada BibTeX empieza por `@tipo{clave,` (con espacios opcionales
/// alrededor de las llaves y de la coma). Se acota a `@` en columna de inicio
/// de "palabra BibTeX", sin exigir que sea el primer carácter de la línea: hay
/// ficheros `.bib` con entradas indentadas o comentarios delante en la misma línea.
fn extract_keys(source: &str) -> Vec<String> {
    let bytes = source.as_bytes();
    let mut keys = Vec::new();
    let mut i = 0;
    while let Some(offset) = source[i..].find('@') {
        let start = i + offset;
        let mut cursor = start + 1;
        // Tipo de entrada: letras (article, book, inproceedings...).
        while cursor < bytes.len() && bytes[cursor].is_ascii_alphabetic() {
            cursor += 1;
        }
        if cursor == start + 1 {
            i = start + 1;
            continue; // "@" suelto (comentario, símbolo de cita en el propio texto...).
        }
        let after_type = &source[cursor..];
        let Some(brace) = after_type.find('{') else {
            i = cursor;
            continue;
        };
        // Solo espacio en blanco entre el tipo y la llave de apertura.
        if !after_type[..brace].trim().is_empty() {
            i = cursor;
            continue;
        }
        let key_start = cursor + brace + 1;
        let Some(comma_offset) = source[key_start..].find(',') else {
            i = key_start;
            continue;
        };
        let key = source[key_start..key_start + comma_offset].trim();
        if !key.is_empty() {
            keys.push(key.to_string());
        }
        i = key_start + comma_offset;
    }
    keys
}

/// Ficheros `.bib` de la raíz del proyecto y las claves que contienen.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BibliographyKeys {
    pub keys: Vec<String>,
}

/// Contenido de cada `.bib` de la raíz del proyecto, concatenado.
///
/// Solo mira `.bib` en la raíz del proyecto — es donde las 8 plantillas
/// curadas de DBV colocan `refs.bib`, y cubre el caso real sin recorrer todo
/// el árbol de un proyecto ajeno pieza a pieza. Compartida entre
/// `bibliography_keys` (Beta) y `bibliography_entries` (RF-35, v0.6.0) para
/// no leer el disco dos veces con dos criterios distintos de qué es un `.bib`.
fn read_project_bib_sources(root_path: &Path) -> Vec<String> {
    let mut sources = Vec::new();
    let Ok(entries) = fs::read_dir(root_path) else {
        return sources;
    };
    for entry in entries.filter_map(|entry| entry.ok()) {
        let path = entry.path();
        let is_bib = path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("bib"));
        if !is_bib {
            continue;
        }
        if let Ok(source) = fs::read_to_string(&path) {
            sources.push(source);
        }
    }
    sources
}

/// Claves de cita disponibles en el proyecto (Beta, asistente "Insertar cita").
///
/// Un proyecto sin `.bib` no es un error: devuelve una lista vacía (RF-02b,
/// degradación limpia).
#[tauri::command]
pub fn bibliography_keys(root: String) -> Result<BibliographyKeys, AppError> {
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err(AppError::InvalidPath(root));
    }

    let mut keys = Vec::new();
    for source in read_project_bib_sources(root_path) {
        keys.extend(extract_keys(&source));
    }
    keys.sort();
    keys.dedup();
    Ok(BibliographyKeys { keys })
}

/// Una entrada bibliográfica ya interpretada, para el explorador de
/// referencias y el autocompletado enriquecido de citas (RF-35, v0.6.0).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BibliographyEntry {
    pub key: String,
    pub entry_type: String,
    pub title: Option<String>,
    pub authors: Vec<String>,
    pub year: Option<i32>,
    /// La misma clave aparece más de una vez en los `.bib` del proyecto —
    /// `hayagriva::Library` es un mapa por clave, así que una entrada
    /// duplicada desaparecería en silencio si no se detectara ANTES de
    /// parsear, sobre el texto crudo (mismo `extract_keys` de arriba).
    pub duplicate: bool,
    /// Sin título o sin ningún autor: el mínimo común a cualquier tipo de
    /// entrada BibTeX. Validación "básica" a propósito (RF-35.3) — reglas
    /// completas por tipo (`article` exige `journal`, etc.) quedan fuera.
    pub missing_required: bool,
}

/// Bibliografía completa del proyecto, con campos y validación básica
/// (RF-35): explorador de referencias y autocompletado de citas enriquecido.
///
/// Parseada con `hayagriva` (`ADR-BIBLIOGRAFIA-001`, memory.md) — el mismo
/// motor que usa el propio compilador Typst para `#bibliography()`, así que
/// lo que aquí se muestra como válido es lo que el compilador acepta de
/// verdad. Una entrada que hayagriva no consigue parsear no tumba el
/// explorador entero: se omite, degradación limpia (RF-02b).
#[tauri::command]
pub fn bibliography_entries(root: String) -> Result<Vec<BibliographyEntry>, AppError> {
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err(AppError::InvalidPath(root));
    }

    let sources = read_project_bib_sources(root_path);

    let mut raw_keys = Vec::new();
    for source in &sources {
        raw_keys.extend(extract_keys(source));
    }
    let mut seen = HashSet::new();
    let duplicated_keys: HashSet<String> =
        raw_keys.into_iter().filter(|key| !seen.insert(key.clone())).collect();

    let mut entries = Vec::new();
    for source in &sources {
        let Ok(library) = hayagriva::io::from_biblatex_str(source) else {
            continue;
        };
        for entry in library.iter() {
            let title = entry.title().map(|value| value.to_string());
            let authors: Vec<String> = entry
                .authors()
                .map(|people| people.iter().map(|person| person.name_first(false, false)).collect())
                .unwrap_or_default();
            entries.push(BibliographyEntry {
                key: entry.key().to_string(),
                entry_type: format!("{:?}", entry.entry_type()).to_lowercase(),
                title: title.clone(),
                duplicate: duplicated_keys.contains(entry.key()),
                missing_required: title.is_none() || authors.is_empty(),
                authors,
                year: entry.date().map(|date| date.year),
            });
        }
    }
    entries.sort_by(|a, b| a.key.cmp(&b.key));
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_keys_lee_entradas_normales() {
        let source = "@article{knuth1984,\n  title = {The TeXbook},\n}\n\
                       @book{ejemplo2025, author = {A}}\n";
        assert_eq!(extract_keys(source), vec!["knuth1984", "ejemplo2025"]);
    }

    #[test]
    fn extract_keys_tolera_espacios_entre_tipo_y_llave() {
        let source = "@article {con-espacio, title = {X}}\n";
        assert_eq!(extract_keys(source), vec!["con-espacio"]);
    }

    #[test]
    fn extract_keys_ignora_una_arroba_suelta_en_el_texto() {
        // Una dirección de correo o una mención en un comentario no debe colarse.
        let source = "% contacto: alguien@ejemplo.com\n@misc{real2025, note = {ok}}\n";
        assert_eq!(extract_keys(source), vec!["real2025"]);
    }

    #[test]
    fn extract_keys_de_fichero_vacio_es_lista_vacia() {
        assert!(extract_keys("").is_empty());
    }

    #[test]
    fn extract_keys_no_revienta_con_una_entrada_sin_cerrar() {
        let source = "@article{sin_coma_ni_cierre";
        assert!(extract_keys(source).is_empty());
    }

    #[test]
    fn bibliography_keys_junta_y_ordena_varios_ficheros_bib() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("refs.bib"), "@article{zeta2020, title={Z}}\n").unwrap();
        fs::write(dir.path().join("extra.bib"), "@book{alfa2019, title={A}}\n").unwrap();
        fs::write(dir.path().join("main.typ"), "= Título\n").unwrap();

        let result = bibliography_keys(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(result.keys, vec!["alfa2019", "zeta2020"]);
    }

    #[test]
    fn bibliography_keys_sin_bib_devuelve_lista_vacia_no_error() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), "= Título\n").unwrap();

        let result = bibliography_keys(dir.path().to_string_lossy().to_string()).unwrap();
        assert!(result.keys.is_empty());
    }

    #[test]
    fn bibliography_keys_rechaza_una_ruta_que_no_es_carpeta() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("main.typ");
        fs::write(&file, "= Título\n").unwrap();

        let result = bibliography_keys(file.to_string_lossy().to_string());
        assert!(matches!(result, Err(AppError::InvalidPath(_))));
    }

    #[test]
    fn bibliography_entries_lee_titulo_autor_y_ano() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            dir.path().join("refs.bib"),
            "@article{knuth1984,\n  title = {The TeXbook},\n  author = {Knuth, Donald E.},\n  year = {1984},\n}\n",
        )
        .unwrap();

        let entries = bibliography_entries(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].key, "knuth1984");
        assert_eq!(entries[0].title.as_deref(), Some("The TeXbook"));
        assert_eq!(entries[0].authors, vec!["Knuth, Donald E.".to_string()]);
        assert_eq!(entries[0].year, Some(1984));
        assert!(!entries[0].duplicate);
        assert!(!entries[0].missing_required);
    }

    #[test]
    fn bibliography_entries_marca_una_clave_duplicada() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            dir.path().join("refs.bib"),
            "@misc{dup2025, title = {Uno}, author = {A}}\n@misc{dup2025, title = {Dos}, author = {B}}\n",
        )
        .unwrap();

        let entries = bibliography_entries(dir.path().to_string_lossy().to_string()).unwrap();
        assert!(entries.iter().all(|entry| entry.duplicate), "{entries:?}");
    }

    #[test]
    fn bibliography_entries_marca_falta_de_titulo_o_autor() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("refs.bib"), "@misc{incompleta2025, note = {sin título ni autor}}\n").unwrap();

        let entries = bibliography_entries(dir.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(entries.len(), 1);
        assert!(entries[0].missing_required);
    }

    #[test]
    fn bibliography_entries_de_proyecto_sin_bib_es_lista_vacia() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), "= Título\n").unwrap();

        let entries = bibliography_entries(dir.path().to_string_lossy().to_string()).unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn bibliography_entries_rechaza_una_ruta_que_no_es_carpeta() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("main.typ");
        fs::write(&file, "= Título\n").unwrap();

        let result = bibliography_entries(file.to_string_lossy().to_string());
        assert!(matches!(result, Err(AppError::InvalidPath(_))));
    }
}
