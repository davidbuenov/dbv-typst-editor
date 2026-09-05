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

/// Claves de cita disponibles en el proyecto (Beta, asistente "Insertar cita").
///
/// Solo mira `.bib` en la raíz del proyecto — es donde las 8 plantillas
/// curadas de DBV colocan `refs.bib`, y cubre el caso real sin recorrer todo
/// el árbol de un proyecto ajeno pieza a pieza. Un proyecto sin `.bib` no es
/// un error: devuelve una lista vacía (RF-02b, degradación limpia).
#[tauri::command]
pub fn bibliography_keys(root: String) -> Result<BibliographyKeys, AppError> {
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err(AppError::InvalidPath(root));
    }

    let mut keys = Vec::new();
    let Ok(entries) = fs::read_dir(root_path) else {
        return Ok(BibliographyKeys { keys });
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
            keys.extend(extract_keys(&source));
        }
    }
    keys.sort();
    keys.dedup();
    Ok(BibliographyKeys { keys })
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
}
