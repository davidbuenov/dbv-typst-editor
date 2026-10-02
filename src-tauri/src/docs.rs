// =============================================================================
// DBV Typst Editor — Documentación de Typst offline (RF-96)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La documentación oficial de la versión EXACTA del compilador vendorizado,
// convertida a Markdown por `scripts/typst-docs.mjs` y empaquetada como recurso
// (`resources/typst-docs.json.gz`, ≈0,3 MB). Sin red ni descarga.
//
// Búsqueda léxica (BM25) por SECCIÓN, no por página: a una IA con poco contexto
// le sirve el trozo que habla de `table.header`, no las 30 KB de `table`. La
// documentación está en inglés; un glosario lleva los términos de Typst que un
// usuario escribe en español («cabecera de tabla») a los del original.

use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::error::AppError;

/// Nombre del recurso empaquetado.
const RESOURCE: &str = "typst-docs.json.gz";

/// Términos en español → términos de la documentación (RF-96.3). Las claves
/// van sin tildes y en minúsculas; las de varias palabras se buscan antes.
const GLOSSARY: &[(&str, &str)] = &[
    ("pie de figura", "caption"),
    ("pie de tabla", "caption"),
    ("salto de pagina", "pagebreak"),
    ("salto de linea", "linebreak"),
    ("nota al pie", "footnote"),
    ("notas al pie", "footnote"),
    ("tabla de contenidos", "outline"),
    ("indice de contenidos", "outline"),
    ("numero de pagina", "page numbering counter"),
    ("tamano de letra", "text size"),
    ("tipo de letra", "font"),
    ("referencia cruzada", "ref label"),
    ("encabezado de pagina", "page header"),
    ("pie de pagina", "page footer"),
    ("cabecera", "header"),
    ("encabezado", "heading"),
    ("titulo", "heading title"),
    ("tabla", "table"),
    ("tablas", "table"),
    ("celda", "cell"),
    ("celdas", "cell"),
    ("columna", "column columns"),
    ("columnas", "column columns"),
    ("fila", "row rows"),
    ("filas", "row rows"),
    ("figura", "figure"),
    ("figuras", "figure"),
    ("imagen", "image"),
    ("imagenes", "image"),
    ("ecuacion", "equation math"),
    ("ecuaciones", "equation math"),
    ("formula", "equation math"),
    ("matematicas", "math"),
    ("fraccion", "frac"),
    ("raiz", "sqrt root"),
    ("matriz", "mat matrix"),
    ("lista", "list"),
    ("enumeracion", "enum"),
    ("vinetas", "list"),
    ("bibliografia", "bibliography"),
    ("cita", "cite citation"),
    ("citas", "cite citation"),
    ("referencia", "ref reference"),
    ("etiqueta", "label"),
    ("enlace", "link"),
    ("negrita", "strong bold"),
    ("cursiva", "emph italic"),
    ("subrayado", "underline"),
    ("tachado", "strike"),
    ("color", "color"),
    ("fuente", "font"),
    ("letra", "text font"),
    ("texto", "text"),
    ("parrafo", "par paragraph"),
    ("interlineado", "leading spacing"),
    ("sangria", "indent"),
    ("justificado", "justify"),
    ("alineacion", "align alignment"),
    ("alinear", "align"),
    ("centrar", "align center"),
    ("margen", "margin"),
    ("margenes", "margin"),
    ("pagina", "page"),
    ("paginas", "page"),
    ("numeracion", "numbering"),
    ("contador", "counter"),
    ("indice", "outline"),
    ("cuadro", "box block"),
    ("caja", "box"),
    ("bloque", "block"),
    ("rejilla", "grid"),
    ("cuadricula", "grid"),
    ("espacio", "space spacing"),
    ("espaciado", "spacing"),
    ("borde", "stroke"),
    ("relleno", "fill inset"),
    ("fondo", "fill background"),
    ("rotar", "rotate"),
    ("escalar", "scale"),
    ("codigo", "raw code"),
    ("plantilla", "template"),
    ("importar", "import"),
    ("incluir", "include"),
    ("variable", "let variable"),
    ("funcion", "function"),
    ("bucle", "for loop"),
    ("condicion", "if conditional"),
    ("regla", "set show rule"),
    ("estilo", "set show style"),
    ("idioma", "lang language"),
    ("fecha", "datetime"),
    ("datos", "data csv json"),
    ("leer", "read"),
    ("dibujo", "curve polygon"),
    ("linea", "line"),
    ("rectangulo", "rect"),
    ("circulo", "circle"),
    ("simbolo", "symbol sym"),
    ("simbolos", "symbol sym"),
    ("cabeceras", "header"),
    ("error", "error"),
];

/// Palabras vacías que no deben puntuar.
const STOPWORDS: &[&str] = &[
    "the", "a", "an", "of", "to", "in", "and", "or", "is", "it", "for", "on", "with", "as", "be", "by", "this", "that",
    "are", "can", "you", "your", "how", "de", "la", "el", "en", "y", "los", "las", "un", "una", "del", "con", "por",
    "para", "que", "como", "se", "al", "lo", "mi", "es",
];

#[derive(Debug, Deserialize)]
struct Bundle {
    #[serde(rename = "typstVersion")]
    typst_version: String,
    license: String,
    pages: Vec<Page>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Page {
    pub path: String,
    pub title: String,
    pub markdown: String,
}

/// Una sección de una página: lo que se indexa y lo que se devuelve a la IA.
#[derive(Debug, Clone)]
struct Section {
    page: usize,
    heading: String,
    anchor: Option<String>,
    body: String,
    tokens: Vec<String>,
}

/// Un resultado de búsqueda.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Hit {
    pub path: String,
    pub title: String,
    pub heading: String,
    pub anchor: Option<String>,
    pub snippet: String,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocsInfo {
    pub typst_version: String,
    pub license: String,
    pub pages: usize,
}

/// El índice en memoria. Se monta una vez, la primera vez que se pide.
pub struct DocsIndex {
    typst_version: String,
    license: String,
    pages: Vec<Page>,
    sections: Vec<Section>,
    /// Frecuencia de documento por término.
    df: HashMap<String, usize>,
    avg_len: f64,
}

/// Quita tildes y pasa a minúsculas (para el glosario y la búsqueda).
fn fold(text: &str) -> String {
    text.chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'Á' | 'À' | 'Ä' => 'a',
            'é' | 'è' | 'ë' | 'É' | 'È' | 'Ë' => 'e',
            'í' | 'ì' | 'ï' | 'Í' | 'Ì' | 'Ï' => 'i',
            'ó' | 'ò' | 'ö' | 'Ó' | 'Ò' | 'Ö' => 'o',
            'ú' | 'ù' | 'ü' | 'Ú' | 'Ù' | 'Ü' => 'u',
            'ñ' | 'Ñ' => 'n',
            other => other.to_ascii_lowercase(),
        })
        .collect()
}

/// Términos de un texto: palabras sin tildes, y además las partes de los
/// nombres con guion (`column-gutter` → `column-gutter`, `column`, `gutter`).
fn tokenize(text: &str) -> Vec<String> {
    let folded = fold(text);
    let mut tokens = Vec::new();
    for word in folded.split(|c: char| !(c.is_alphanumeric() || c == '-' || c == '.')) {
        let word = word.trim_matches(|c| c == '-' || c == '.');
        if word.len() < 2 || STOPWORDS.contains(&word) {
            continue;
        }
        tokens.push(word.to_string());
        if word.contains(['-', '.']) {
            tokens.extend(word.split(['-', '.']).filter(|part| part.len() >= 2).map(str::to_string));
        }
    }
    tokens
}

/// Consulta → términos, con el glosario aplicado (los originales se conservan).
pub fn expand_query(query: &str) -> Vec<String> {
    let mut folded = fold(query);
    let mut extra = Vec::new();
    for (spanish, english) in GLOSSARY.iter().filter(|(key, _)| key.contains(' ')) {
        if folded.contains(spanish) {
            extra.push(*english);
            folded = folded.replace(spanish, " ");
        }
    }
    let mut terms = tokenize(&folded);
    for token in terms.clone() {
        if let Some((_, english)) = GLOSSARY.iter().find(|(key, _)| *key == token) {
            extra.push(english);
        }
    }
    for english in extra {
        terms.extend(tokenize(english));
    }
    terms.sort();
    terms.dedup();
    terms
}

/// Parte una página por sus encabezados (fuera de bloques de código).
fn split_sections(page_index: usize, page: &Page) -> Vec<Section> {
    let mut sections = Vec::new();
    let mut heading = page.title.clone();
    let mut anchor = None;
    let mut body = String::new();
    let mut in_code = false;
    let flush = |sections: &mut Vec<Section>, heading: &str, anchor: &Option<String>, body: &str| {
        if body.trim().is_empty() && sections.iter().any(|s: &Section| s.page == page_index) {
            return;
        }
        let mut tokens = tokenize(body);
        // El título de la página y el de la sección pesan más que el cuerpo.
        for _ in 0..3 {
            tokens.extend(tokenize(heading));
        }
        tokens.extend(tokenize(&page.title));
        sections.push(Section { page: page_index, heading: heading.to_string(), anchor: anchor.clone(), body: body.trim().to_string(), tokens });
    };
    for line in page.markdown.lines() {
        if line.starts_with("```") {
            in_code = !in_code;
        }
        let level = line.chars().take_while(|c| *c == '#').count();
        if !in_code && (2..=4).contains(&level) && line.chars().nth(level) == Some(' ') {
            flush(&mut sections, &heading, &anchor, &body);
            let text = line[level + 1..].trim();
            let (title, id) = match text.rfind(" {#") {
                Some(at) if text.ends_with('}') => (&text[..at], Some(text[at + 3..text.len() - 1].to_string())),
                _ => (text, None),
            };
            heading = title.to_string();
            anchor = id;
            body = String::new();
        } else {
            body.push_str(line);
            body.push('\n');
        }
    }
    flush(&mut sections, &heading, &anchor, &body);
    sections
}

impl DocsIndex {
    /// Monta el índice a partir del recurso comprimido.
    pub fn from_gzip(bytes: &[u8]) -> Result<Self, AppError> {
        let mut json = String::new();
        flate2::read::GzDecoder::new(bytes)
            .read_to_string(&mut json)
            .map_err(|error| AppError::Parse(format!("documentación de Typst ilegible: {error}")))?;
        let bundle: Bundle =
            serde_json::from_str(&json).map_err(|error| AppError::Parse(format!("documentación de Typst ilegible: {error}")))?;
        let sections: Vec<Section> =
            bundle.pages.iter().enumerate().flat_map(|(index, page)| split_sections(index, page)).collect();
        let mut df: HashMap<String, usize> = HashMap::new();
        for section in &sections {
            let mut unique = section.tokens.clone();
            unique.sort();
            unique.dedup();
            for token in unique {
                *df.entry(token).or_default() += 1;
            }
        }
        let avg_len = sections.iter().map(|s| s.tokens.len()).sum::<usize>() as f64 / sections.len().max(1) as f64;
        Ok(Self { typst_version: bundle.typst_version, license: bundle.license, pages: bundle.pages, sections, df, avg_len })
    }

    pub fn info(&self) -> DocsInfo {
        DocsInfo { typst_version: self.typst_version.clone(), license: self.license.clone(), pages: self.pages.len() }
    }

    pub fn page(&self, path: &str) -> Option<&Page> {
        self.pages.iter().find(|page| page.path == path)
    }

    pub fn pages(&self) -> &[Page] {
        &self.pages
    }

    /// Las `limit` secciones más relevantes para `query`.
    pub fn search(&self, query: &str, limit: usize) -> Vec<Hit> {
        let terms = expand_query(query);
        let total = self.sections.len() as f64;
        let (k1, b) = (1.2, 0.75);
        let mut scored: Vec<(f64, &Section)> = self
            .sections
            .iter()
            .filter_map(|section| {
                let len = section.tokens.len() as f64;
                let mut score = 0.0;
                for term in &terms {
                    let tf = section.tokens.iter().filter(|token| *token == term).count() as f64;
                    if tf == 0.0 {
                        continue;
                    }
                    let df = *self.df.get(term).unwrap_or(&0) as f64;
                    let idf = ((total - df + 0.5) / (df + 0.5) + 1.0).ln();
                    score += idf * tf * (k1 + 1.0) / (tf + k1 * (1.0 - b + b * len / self.avg_len));
                }
                // La página que se llama exactamente como un término
                // (`reference/model/table` para «table») es la referencia.
                let page = &self.pages[section.page];
                let last = page.path.rsplit('/').next().unwrap_or_default();
                if terms.iter().any(|term| term == last) {
                    score *= 1.6;
                }
                if page.path.starts_with("changelog") {
                    score *= 0.3;
                }
                (score > 0.0).then_some((score, section))
            })
            .collect();
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        scored
            .into_iter()
            .take(limit)
            .map(|(score, section)| {
                let page = &self.pages[section.page];
                Hit {
                    path: page.path.clone(),
                    title: page.title.clone(),
                    heading: section.heading.clone(),
                    anchor: section.anchor.clone(),
                    snippet: section.body.chars().take(1200).collect(),
                    score: (score * 1000.0).round() / 1000.0,
                }
            })
            .collect()
    }
}

/// Estado gestionado por Tauri: el índice se monta perezosamente.
#[derive(Default)]
pub struct DocsState(OnceLock<Result<DocsIndex, AppError>>);

fn resource_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(resources) = app.path().resource_dir() {
        candidates.push(resources.join("resources").join(RESOURCE));
        candidates.push(resources.join(RESOURCE));
    }
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join(RESOURCE));
    candidates
}

fn load(app: &AppHandle) -> Result<DocsIndex, AppError> {
    let path = resource_candidates(app)
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| AppError::NotFound("la documentación de Typst no está en la instalación".into()))?;
    let bytes = std::fs::read(&path).map_err(|error| AppError::Io(error.to_string()))?;
    DocsIndex::from_gzip(&bytes)
}

fn index<'a>(app: &AppHandle, state: &'a DocsState) -> Result<&'a DocsIndex, AppError> {
    state.0.get_or_init(|| load(app)).as_ref().map_err(Clone::clone)
}

#[tauri::command]
pub fn docs_info(app: AppHandle, state: State<'_, DocsState>) -> Result<DocsInfo, AppError> {
    index(&app, &state).map(DocsIndex::info)
}

#[tauri::command]
pub fn docs_search(app: AppHandle, state: State<'_, DocsState>, query: String, limit: Option<usize>) -> Result<Vec<Hit>, AppError> {
    index(&app, &state).map(|docs| docs.search(&query, limit.unwrap_or(8).min(30)))
}

#[tauri::command]
pub fn docs_page(app: AppHandle, state: State<'_, DocsState>, path: String) -> Result<Page, AppError> {
    let docs = index(&app, &state)?;
    docs.page(&path).cloned().ok_or_else(|| AppError::NotFound(format!("no hay página de documentación «{path}»")))
}

/// Escribe la documentación como ficheros Markdown en la carpeta de datos de la
/// aplicación y devuelve su ruta. La usan los agentes por ACP, que leen
/// ficheros con sus propias herramientas (ADR-V0130-002). Se reescribe solo si
/// cambia la versión.
#[tauri::command]
pub fn docs_export_dir(app: AppHandle, state: State<'_, DocsState>) -> Result<String, AppError> {
    let docs = index(&app, &state)?;
    let base = app.path().app_data_dir().map_err(|error| AppError::Io(error.to_string()))?;
    let dir = base.join("typst-docs").join(&docs.typst_version);
    export_to(docs, &dir)?;
    Ok(dir.to_string_lossy().to_string())
}

/// Vuelca cada página como `<ruta>.md` bajo `dir` (idempotente).
pub fn export_to(docs: &DocsIndex, dir: &Path) -> Result<(), AppError> {
    let marker = dir.join(".complete");
    if marker.is_file() {
        return Ok(());
    }
    for page in docs.pages() {
        let file = dir.join(format!("{}.md", page.path.replace('/', std::path::MAIN_SEPARATOR_STR)));
        if let Some(parent) = file.parent() {
            std::fs::create_dir_all(parent).map_err(|error| AppError::Io(error.to_string()))?;
        }
        std::fs::write(&file, &page.markdown).map_err(|error| AppError::Io(error.to_string()))?;
    }
    std::fs::write(&marker, &docs.license).map_err(|error| AppError::Io(error.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bundled() -> DocsIndex {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join(RESOURCE);
        DocsIndex::from_gzip(&std::fs::read(path).expect("recurso de documentación")).unwrap()
    }

    fn vendored_version() -> String {
        let script = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../scripts/vendor-typst.mjs");
        let source = std::fs::read_to_string(script).unwrap();
        let start = source.find("TYPST_VERSION = '").unwrap() + "TYPST_VERSION = '".len();
        source[start..].split('\'').next().unwrap().to_string()
    }

    #[test]
    fn la_documentacion_es_de_la_version_del_compilador_vendorizado() {
        // Si falla: se subió el sidecar y falta `npm run docs:typst` (RF-96.1).
        assert_eq!(bundled().info().typst_version, vendored_version());
    }

    #[test]
    fn la_documentacion_trae_la_referencia_y_las_guias() {
        let docs = bundled();
        assert!(docs.info().pages > 150);
        assert!(docs.page("reference/model/table").is_some());
        assert!(docs.page("guides/tables").is_some());
        assert!(docs.page("tutorial/writing-in-typst").is_some());
    }

    #[test]
    fn table_header_lleva_primero_a_la_pagina_de_table() {
        let hits = bundled().search("table header", 5);
        assert_eq!(hits[0].path, "reference/model/table", "{hits:#?}");
    }

    #[test]
    fn cabecera_de_tabla_llega_a_la_misma_pagina_por_el_glosario() {
        let hits = bundled().search("cabecera de tabla", 5);
        assert_eq!(hits[0].path, "reference/model/table", "{hits:#?}");
    }

    #[test]
    fn pie_de_figura_encuentra_caption_de_figure() {
        let hits = bundled().search("pie de figura", 5);
        assert!(hits.iter().any(|hit| hit.path == "reference/model/figure"), "{hits:#?}");
    }

    #[test]
    fn el_glosario_conserva_los_terminos_originales_y_quita_tildes() {
        let terms = expand_query("Ecuación numerada");
        assert!(terms.contains(&"ecuacion".to_string()));
        assert!(terms.contains(&"equation".to_string()));
        assert!(terms.contains(&"numerada".to_string()));
    }

    #[test]
    fn los_nombres_con_guion_se_buscan_enteros_y_por_partes() {
        let tokens = tokenize("column-gutter");
        assert_eq!(tokens, vec!["column-gutter", "column", "gutter"]);
    }

    #[test]
    fn las_secciones_llevan_su_ancla() {
        let hits = bundled().search("column-gutter", 3);
        assert!(hits.iter().any(|hit| hit.anchor.as_deref() == Some("parameters-column-gutter")), "{hits:#?}");
    }

    #[test]
    fn exportar_escribe_un_md_por_pagina_y_es_idempotente() {
        let docs = bundled();
        let dir = tempfile::tempdir().unwrap();
        export_to(&docs, dir.path()).unwrap();
        let table = dir.path().join("reference").join("model").join("table.md");
        assert!(std::fs::read_to_string(&table).unwrap().contains("table.header"));
        std::fs::remove_file(&table).unwrap();
        export_to(&docs, dir.path()).unwrap();
        assert!(!table.exists(), "con la marca de completado no se reescribe");
    }
}
