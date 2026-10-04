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

// ---------------------------------------------------------------------------
// Para la IA (RF-115.1)
// ---------------------------------------------------------------------------

/// Una referencia tal como se le cuenta a la IA: lo justo para elegir una clave sin inventar ninguna.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiReference {
    pub key: String,
    pub entry_type: String,
    pub title: Option<String>,
    /// Hasta tres autores («Apellido, Nombre»); `etAl` dice si había más.
    pub authors: Vec<String>,
    pub et_al: bool,
    pub year: Option<i32>,
}

/// Resultado de `ai_bibliography`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiBibliography {
    pub references: Vec<AiReference>,
    /// Cuántas coinciden en total (puede ser más de las devueltas).
    pub total: usize,
    /// Ficheros de bibliografía del proyecto que se pudieron leer.
    pub files: Vec<String>,
}

/// Máximo de referencias que se devuelven de una vez: un modelo local tiene poco contexto (RF-107.5).
pub const AI_REFERENCE_LIMIT: usize = 40;

/// Ficheros de bibliografía de la raíz: `.bib` (BibLaTeX) y `.yml`/`.yaml` (Hayagriva). Un `.yml` que no es una
/// bibliografía (una configuración) simplemente no se interpreta y se ignora.
fn read_bibliography_files(root_path: &Path) -> Vec<(String, String, bool)> {
    let mut files = Vec::new();
    let Ok(entries) = fs::read_dir(root_path) else {
        return files;
    };
    for entry in entries.filter_map(|entry| entry.ok()) {
        let path = entry.path();
        let extension = path.extension().and_then(|ext| ext.to_str()).map(str::to_ascii_lowercase).unwrap_or_default();
        let is_yaml = extension == "yml" || extension == "yaml";
        if extension != "bib" && !is_yaml {
            continue;
        }
        // Una bibliografía de 1 MB ya es enorme; más que eso no es una bibliografía.
        if entry.metadata().map(|meta| meta.len() > 1_048_576).unwrap_or(true) {
            continue;
        }
        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if let Ok(text) = fs::read_to_string(&path) {
            files.push((name, text, is_yaml));
        }
    }
    files.sort_by(|a, b| a.0.cmp(&b.0));
    files
}

fn matches_query(reference: &AiReference, query: &str) -> bool {
    let needle = query.trim().to_lowercase();
    needle.is_empty()
        || reference.key.to_lowercase().contains(&needle)
        || reference.title.as_deref().is_some_and(|t| t.to_lowercase().contains(&needle))
        || reference.authors.iter().any(|a| a.to_lowercase().contains(&needle))
        || reference.year.is_some_and(|y| y.to_string() == needle)
}

/// Referencias de la bibliografía del proyecto, filtradas por `query` (clave, título, autor o año) y acotadas.
pub fn collect_ai_bibliography(root_path: &Path, query: &str) -> AiBibliography {
    let mut references = Vec::new();
    let mut files = Vec::new();
    for (name, text, is_yaml) in read_bibliography_files(root_path) {
        let library = if is_yaml { hayagriva::io::from_yaml_str(&text).ok() } else { hayagriva::io::from_biblatex_str(&text).ok() };
        let Some(library) = library else { continue };
        files.push(name);
        for entry in library.iter() {
            let all_authors: Vec<String> = entry.authors().map(|people| people.iter().map(|p| p.name_first(false, false)).collect()).unwrap_or_default();
            references.push(AiReference {
                key: entry.key().to_string(),
                entry_type: format!("{:?}", entry.entry_type()).to_lowercase(),
                title: entry.title().map(|value| value.to_string()),
                et_al: all_authors.len() > 3,
                authors: all_authors.into_iter().take(3).collect(),
                year: entry.date().map(|date| date.year),
            });
        }
    }
    references.sort_by(|a, b| a.key.cmp(&b.key));
    references.dedup_by(|a, b| a.key == b.key);
    let matching: Vec<AiReference> = references.into_iter().filter(|r| matches_query(r, query)).collect();
    let total = matching.len();
    AiBibliography { references: matching.into_iter().take(AI_REFERENCE_LIMIT).collect(), total, files }
}

/// Las referencias del proyecto para la IA (herramienta `list_bibliography`). Solo la raíz del proyecto.
#[tauri::command]
pub fn ai_bibliography(root: String, query: Option<String>) -> Result<AiBibliography, AppError> {
    let root_path = Path::new(&root);
    if !root_path.is_dir() {
        return Err(AppError::InvalidPath(root));
    }
    Ok(collect_ai_bibliography(root_path, query.as_deref().unwrap_or("")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(files: &[(&str, &str)]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for (name, content) in files {
            fs::write(dir.path().join(name), content).unwrap();
        }
        dir
    }

    const BIB: &str = "@article{knuth1984,\n  author = {Donald E. Knuth},\n  title = {Literate Programming},\n  journal = {The Computer Journal},\n  year = {1984},\n}\n\n@book{lamport1994,\n  author = {Leslie Lamport and A. Otro and B. Tercero and C. Cuarto},\n  title = {LaTeX: A Document Preparation System},\n  publisher = {Addison-Wesley},\n  year = {1994},\n}\n";
    const YAML: &str = "turing1950:\n  type: article\n  title: Computing Machinery and Intelligence\n  author: Turing, Alan\n  date: 1950\n  parent:\n    type: periodical\n    title: Mind\n";

    #[test]
    fn la_ia_ve_las_claves_los_titulos_y_los_autores_de_un_bib_y_de_un_yml() {
        let dir = project(&[("refs.bib", BIB), ("extra.yml", YAML)]);
        let result = collect_ai_bibliography(dir.path(), "");
        let keys: Vec<&str> = result.references.iter().map(|r| r.key.as_str()).collect();
        assert_eq!(keys, vec!["knuth1984", "lamport1994", "turing1950"]);
        assert_eq!(result.total, 3);
        assert_eq!(result.files, vec!["extra.yml".to_string(), "refs.bib".to_string()]);
        let knuth = &result.references[0];
        assert_eq!((knuth.year, knuth.title.as_deref()), (Some(1984), Some("Literate Programming")));
        assert_eq!(result.references[2].year, Some(1950));
    }

    #[test]
    fn de_los_autores_solo_van_tres_y_se_dice_si_habia_mas() {
        let dir = project(&[("refs.bib", BIB)]);
        let lamport = &collect_ai_bibliography(dir.path(), "lamport").references[0];
        assert_eq!(lamport.authors.len(), 3);
        assert!(lamport.et_al);
        assert!(!collect_ai_bibliography(dir.path(), "knuth").references[0].et_al);
    }

    #[test]
    fn se_filtra_por_clave_titulo_autor_o_anio_sin_distinguir_mayusculas() {
        let dir = project(&[("refs.bib", BIB), ("extra.yml", YAML)]);
        let keys = |query: &str| collect_ai_bibliography(dir.path(), query).references.into_iter().map(|r| r.key).collect::<Vec<_>>();
        assert_eq!(keys("KNUTH"), vec!["knuth1984"]);
        assert_eq!(keys("machinery"), vec!["turing1950"]);
        assert_eq!(keys("lamport"), vec!["lamport1994"]);
        assert_eq!(keys("1994"), vec!["lamport1994"]);
        assert!(keys("no-existe").is_empty());
    }

    #[test]
    fn nunca_devuelve_mas_de_cuarenta_pero_cuenta_todas() {
        let many: String = (0..90).map(|i| format!("@misc{{ref{i:03},\n  author = {{Autor {i}}},\n  title = {{Titulo {i}}},\n  year = {{2020}},\n}}\n")).collect();
        let dir = project(&[("grande.bib", &many)]);
        let result = collect_ai_bibliography(dir.path(), "");
        assert_eq!(result.references.len(), AI_REFERENCE_LIMIT);
        assert_eq!(result.total, 90);
    }

    #[test]
    fn un_yml_que_no_es_una_bibliografia_y_un_bib_roto_no_tumban_la_lectura() {
        let dir = project(&[("refs.bib", BIB), ("config.yml", "puerto: 8080\nmodo: rapido\n"), ("roto.bib", "@article{sin-cerrar, title = {X")]);
        let result = collect_ai_bibliography(dir.path(), "");
        assert!(result.references.iter().any(|r| r.key == "knuth1984"));
        assert!(!result.files.contains(&"config.yml".to_string()), "{:?}", result.files);
    }

    #[test]
    fn sin_bibliografia_es_una_lista_vacia_no_un_error() {
        let dir = project(&[("main.typ", "Hola")]);
        let result = collect_ai_bibliography(dir.path(), "");
        assert_eq!((result.references.len(), result.total, result.files.len()), (0, 0, 0));
        assert!(ai_bibliography("/no/existe/dbv".into(), None).is_err());
    }

    #[test]
    fn la_misma_clave_en_dos_ficheros_sale_una_vez() {
        let dir = project(&[("a.bib", BIB), ("b.bib", BIB)]);
        assert_eq!(collect_ai_bibliography(dir.path(), "knuth").total, 1);
    }

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
