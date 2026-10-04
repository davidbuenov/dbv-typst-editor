// =============================================================================
// DBV Typst Editor — Búsqueda en Typst Universe para la IA (RF-108.2, RNF-IA.9)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// `search_universe` consulta el catálogo de una versión por paquete
// (`universe_catalog`) con una búsqueda léxica local y devuelve POCOS
// resultados, cada uno con su identificador completo (`@preview/cetz:0.5.2`):
// un modelo local tiene poco contexto y no debe inventar paquetes ni versiones.
//
// RNF-IA.9: el modelo nunca toca la red. Estos comandos solo leen lo que ya hay
// en memoria o en disco; descargar el índice es otro comando (`ai_universe_refresh`)
// que el frontend solo invoca con una conexión en la nube.

use std::collections::BTreeMap;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use super::AiError;
use crate::commands::universe_index::{cached_entries, refresh_index, UniverseIndexEntry, UniverseIndexState};
use crate::universe::parse_universe_spec;
use crate::universe_catalog::{build_catalog, compiler_version, Catalog, CatalogEntry, NewerVersion, UnavailableEntry};

/// Resultados como máximo por búsqueda (RF-107.5: respuestas cortas para modelos pequeños).
pub const MAX_HITS: usize = 8;
const DESCRIPTION_LIMIT: usize = 140;

/// Qué se busca.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Any,
    Package,
    Template,
}

impl Kind {
    pub fn parse(text: Option<&str>) -> Self {
        match text.map(str::trim) {
            Some("package") => Self::Package,
            Some("template") => Self::Template,
            _ => Self::Any,
        }
    }

    fn admits(self, entry: &CatalogEntry) -> bool {
        match self {
            Self::Any => true,
            Self::Package => !entry.is_template,
            Self::Template => entry.is_template,
        }
    }
}

/// Un resultado, ya en la forma que se le enseña al modelo.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hit {
    /// Identificador completo: lo único que la IA debe escribir en un `#import`.
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    /// `package` (se importa) o `template` (se crea).
    pub kind: &'static str,
    pub categories: Vec<String>,
    pub license: String,
    /// `AAAA-MM-DD` de la publicación de esta versión.
    pub updated: Option<String>,
    pub newer_incompatible: Option<NewerVersion>,
}

/// Quita acentos y pasa a minúsculas ASCII para comparar.
fn fold(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'â' => 'a',
            'é' | 'è' | 'ë' | 'ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' => 'o',
            'ú' | 'ù' | 'ü' | 'û' => 'u',
            'ñ' => 'n',
            other => other,
        })
        .collect()
}

fn words(text: &str) -> Vec<String> {
    fold(text).split(|c: char| !c.is_alphanumeric()).filter(|w| w.chars().count() >= 2).map(str::to_string).collect()
}

/// Términos en español que alguien escribe y el índice (en inglés) no contiene.
const GLOSSARY: &[(&str, &str)] = &[
    ("tesis", "thesis"),
    ("tesina", "thesis"),
    ("articulo", "article paper"),
    ("informe", "report"),
    ("memoria", "report thesis"),
    ("curriculum", "cv resume"),
    ("presentacion", "slides presentation"),
    ("presentaciones", "slides presentation"),
    ("diapositivas", "slides"),
    ("cartel", "poster"),
    ("carta", "letter"),
    ("apuntes", "notes"),
    ("examen", "exam"),
    ("libro", "book"),
    ("dibujar", "draw drawing"),
    ("dibujo", "drawing draw"),
    ("dibujos", "drawing draw"),
    ("diagrama", "diagram"),
    ("diagramas", "diagram"),
    ("grafico", "chart plot"),
    ("graficos", "chart plot"),
    ("tabla", "table"),
    ("tablas", "table"),
    ("matematicas", "math"),
    ("fisica", "physics"),
    ("quimica", "chemistry"),
    ("codigo", "code"),
    ("bibliografia", "bibliography"),
    ("ecuacion", "equation math"),
    ("ecuaciones", "equation math"),
    ("algoritmo", "algorithm"),
    ("musica", "music"),
    ("partitura", "music score"),
    ("grafo", "graph"),
    ("grafos", "graph"),
    ("circuito", "circuit"),
    ("circuitos", "circuit"),
    ("factura", "invoice"),
    ("tarjeta", "card"),
];

/// Términos de la consulta con el glosario aplicado. El segundo valor son solo los originales.
fn query_terms(query: &str) -> (Vec<String>, Vec<String>) {
    let originals = words(query);
    let mut expanded = originals.clone();
    for word in &originals {
        if let Some((_, english)) = GLOSSARY.iter().find(|(spanish, _)| spanish == word) {
            expanded.extend(english.split(' ').map(str::to_string));
        }
    }
    expanded.sort();
    expanded.dedup();
    (expanded, originals)
}

/// Puntuación léxica de una entrada para un término, y si el término apareció.
fn score_term(entry: &CatalogEntry, name_words: &[String], keywords: &[String], tags: &[String], description: &str, term: &str) -> u32 {
    let name = fold(&entry.name);
    let mut score = 0;
    if name == term {
        // Quien escribe el nombre exacto de un paquete quiere ESE paquete, no los que dependen de él
        // (`cetz` frente a `cetz-fields`, que lo cita en nombre, palabras clave y descripción).
        score += 60;
    } else if name_words.iter().any(|w| w == term) {
        score += 8;
    } else if name.contains(term) {
        score += 5;
    }
    if keywords.iter().any(|k| k == term) {
        score += 5;
    } else if keywords.iter().any(|k| k.contains(term)) {
        score += 3;
    }
    if tags.iter().any(|t| t == term) {
        score += 4;
    } else if tags.iter().any(|t| t.contains(term)) {
        score += 2;
    }
    if words(description).iter().any(|w| w == term) {
        score += 2;
    } else if fold(description).contains(term) {
        score += 1;
    }
    score
}

fn days_to_date(seconds: u64) -> String {
    // Algoritmo de Howard Hinnant: días desde 1970-01-01 → fecha civil.
    let z = (seconds / 86_400) as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { year + 1 } else { year };
    format!("{year:04}-{month:02}-{day:02}")
}

fn shorten(text: &str) -> String {
    let single: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if single.chars().count() <= DESCRIPTION_LIMIT {
        return single;
    }
    let cut: String = single.chars().take(DESCRIPTION_LIMIT).collect();
    format!("{}…", cut.trim_end())
}

fn to_hit(entry: &CatalogEntry) -> Hit {
    Hit {
        id: format!("@preview/{}:{}", entry.name, entry.version),
        name: entry.name.clone(),
        version: entry.version.clone(),
        description: shorten(&entry.description),
        kind: if entry.is_template { "template" } else { "package" },
        categories: entry.categories.iter().take(3).cloned().collect(),
        license: entry.license.clone(),
        updated: entry.updated_at.map(days_to_date),
        newer_incompatible: entry.newer_incompatible.clone(),
    }
}

/// Búsqueda léxica en el catálogo: nombre, palabras clave, categorías y
/// disciplinas, y descripción. Con todas las palabras de la consulta presentes
/// sube de puesto; a igualdad, la publicación más reciente.
pub fn search(catalog: &Catalog, query: &str, kind: Kind, limit: usize) -> Vec<Hit> {
    let (terms, originals) = query_terms(query);
    if terms.is_empty() {
        return Vec::new();
    }
    let mut scored: Vec<(u32, &CatalogEntry)> = Vec::new();
    for entry in catalog.entries.iter().filter(|e| kind.admits(e)) {
        let name_words = words(&entry.name);
        let keywords: Vec<String> = entry.keywords.iter().map(|k| fold(k)).collect();
        let tags: Vec<String> = entry.categories.iter().chain(entry.disciplines.iter()).map(|t| fold(t)).collect();
        let mut total = 0;
        let mut matched = 0;
        for term in &terms {
            let score = score_term(entry, &name_words, &keywords, &tags, &entry.description, term);
            if score > 0 {
                matched += 1;
            }
            total += score;
        }
        if total == 0 {
            continue;
        }
        // Todas las palabras que escribió el usuario (no las del glosario) aparecen en algún sitio.
        let covers_all = originals.iter().all(|w| score_term(entry, &name_words, &keywords, &tags, &entry.description, w) > 0);
        let bonus = if covers_all && matched > 0 { 6 } else { 0 };
        scored.push((total + bonus, entry));
    }
    scored.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.updated_at.cmp(&a.1.updated_at)).then(a.1.name.cmp(&b.1.name)));
    scored.into_iter().take(limit.clamp(1, MAX_HITS)).map(|(_, entry)| to_hit(entry)).collect()
}

/// Veredicto sobre un identificador que la IA ha escrito.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IdCheck {
    pub id: String,
    /// `ok`, `unknownPackage`, `unknownVersion`, `outdated`, `needsNewerCompiler`, `notAnId`, `unavailable`.
    pub status: &'static str,
    /// La versión que sí conviene usar.
    pub latest: Option<String>,
    pub compiler: Option<String>,
}

fn verdict(id: &str, status: &'static str, latest: Option<String>, compiler: Option<String>) -> IdCheck {
    IdCheck { id: id.to_string(), status, latest, compiler }
}

/// Comprueba un identificador `@preview/nombre:versión` contra el índice: que el
/// paquete exista, que la versión exista y que sea la que conviene (RF-108.4).
pub fn check_id(entries: &[UniverseIndexEntry], catalog: &Catalog, id: &str) -> IdCheck {
    let Ok(spec) = parse_universe_spec(id) else {
        return verdict(id, "notAnId", None, None);
    };
    let by_name: BTreeMap<&str, &CatalogEntry> = catalog.entries.iter().map(|e| (e.name.as_str(), e)).collect();
    if let Some(chosen) = by_name.get(spec.name.as_str()) {
        if chosen.version == spec.version {
            return verdict(id, "ok", None, None);
        }
        if let Some(newer) = chosen.newer_incompatible.as_ref().filter(|n| n.version == spec.version) {
            return verdict(id, "needsNewerCompiler", Some(chosen.version.clone()), Some(newer.compiler.clone()));
        }
        let exists = entries.iter().any(|e| e.name == spec.name && e.version == spec.version);
        return verdict(id, if exists { "outdated" } else { "unknownVersion" }, Some(chosen.version.clone()), None);
    }
    match catalog.unavailable.iter().find(|u| u.name == spec.name) {
        Some(UnavailableEntry { compiler, .. }) => verdict(id, "unavailable", None, Some(compiler.clone())),
        None => verdict(id, "unknownPackage", None, None),
    }
}

/// Lo que la revisión enseña de un paquete que se va a descargar (RF-109.2).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageInfo {
    pub id: String,
    /// Está en el catálogo descargado (si no, solo se conoce el identificador).
    pub known: bool,
    pub license: String,
    pub description: String,
    pub repository: Option<String>,
    pub is_template: bool,
}

/// Licencia, descripción y repositorio de la versión EXACTA de un identificador.
pub fn info_for(entries: &[UniverseIndexEntry], id: &str) -> PackageInfo {
    let found = parse_universe_spec(id).ok().and_then(|spec| entries.iter().find(|e| e.name == spec.name && e.version == spec.version));
    match found {
        Some(entry) => PackageInfo {
            id: id.to_string(),
            known: true,
            license: entry.license.clone(),
            description: shorten(&entry.description),
            repository: entry.repository.clone(),
            is_template: entry.is_template,
        },
        None => PackageInfo { id: id.to_string(), known: false, license: String::new(), description: String::new(), repository: None, is_template: false },
    }
}

/// Resultado de `ai_universe_search`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    /// `ok` o `noCatalog` (no hay índice descargado todavía).
    pub status: &'static str,
    pub hits: Vec<Hit>,
    /// Segundos Unix del último sincronizado.
    pub fetched_at: Option<u64>,
    /// Paquetes con ese nombre exacto que existen pero no caben en este compilador.
    pub unavailable: Vec<UnavailableEntry>,
}

fn data_dir(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_data_dir().ok()
}

/// Busca en el catálogo YA descargado; nunca abre una conexión (RNF-IA.9.3).
#[tauri::command]
pub fn ai_universe_search(app: AppHandle, state: State<'_, UniverseIndexState>, query: String, kind: Option<String>, limit: Option<usize>) -> Result<SearchResult, AiError> {
    let dir = data_dir(&app);
    let result = match cached_entries(dir.as_deref(), &state) {
        None => SearchResult { status: "noCatalog", hits: Vec::new(), fetched_at: None, unavailable: Vec::new() },
        Some(cached) => {
            let catalog = build_catalog(&cached.entries, compiler_version());
            let wanted = fold(query.trim());
            SearchResult {
                status: "ok",
                hits: search(&catalog, &query, Kind::parse(kind.as_deref()), limit.unwrap_or(MAX_HITS)),
                fetched_at: cached.fetched_at,
                unavailable: catalog.unavailable.iter().filter(|u| fold(&u.name) == wanted).cloned().collect(),
            }
        }
    };
    Ok(result)
}

/// Descarga el índice público de Universe. Solo se invoca con una conexión en la
/// nube (RNF-IA.9.3); no envía nada del proyecto: es un GET del índice oficial.
#[tauri::command]
pub async fn ai_universe_refresh(app: AppHandle) -> Result<Option<u64>, AiError> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<UniverseIndexState>();
        let dir = data_dir(&app);
        refresh_index(dir.as_deref(), &state).map_err(|error| AiError::Network(error.to_string()))?;
        Ok(dir.as_deref().and_then(crate::commands::universe_index::cache_time))
    })
    .await
    .map_err(|error| AiError::Server(error.to_string()))?
}

/// Datos de los paquetes que la revisión pide descargar (sin red: lee el catálogo ya guardado).
#[tauri::command]
pub fn ai_universe_info(app: AppHandle, state: State<'_, UniverseIndexState>, ids: Vec<String>) -> Vec<PackageInfo> {
    let cached = cached_entries(data_dir(&app).as_deref(), &state);
    let entries = cached.as_ref().map(|c| c.entries.as_slice()).unwrap_or(&[]);
    ids.iter().take(20).map(|id| info_for(entries, id)).collect()
}

/// Comprueba identificadores contra el catálogo ya descargado (sin red).
#[tauri::command]
pub fn ai_universe_check(app: AppHandle, state: State<'_, UniverseIndexState>, ids: Vec<String>) -> Vec<IdCheck> {
    let Some(cached) = cached_entries(data_dir(&app).as_deref(), &state) else {
        return Vec::new();
    };
    let catalog = build_catalog(&cached.entries, compiler_version());
    ids.iter().take(20).map(|id| check_id(&cached.entries, &catalog, id)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(json: serde_json::Value) -> UniverseIndexEntry {
        serde_json::from_value(json).unwrap()
    }

    fn sample() -> Vec<UniverseIndexEntry> {
        vec![
            entry(serde_json::json!({ "name": "charged-ieee", "version": "0.1.4", "compiler": "0.12.0", "description": "An IEEE-style paper template to publish at conferences and journals", "keywords": ["IEEE", "Computer Science"], "categories": ["paper"], "disciplines": ["computer-science"], "license": "MIT-0", "updatedAt": 1_736_000_000u64, "template": { "path": "template", "entrypoint": "main.typ" } })),
            entry(serde_json::json!({ "name": "wired-ieee", "version": "1.0.1", "compiler": "0.13.0", "description": "A multilanguage template for writing academic papers in the IEEE style.", "keywords": ["ieee", "academic"], "categories": ["paper"], "updatedAt": 1_700_000_000u64, "template": { "path": "template", "entrypoint": "main.typ" } })),
            entry(serde_json::json!({ "name": "cetz", "version": "0.4.2", "compiler": "0.13.0", "description": "Drawing library", "keywords": ["drawing", "diagram"] })),
            entry(serde_json::json!({ "name": "cetz", "version": "0.5.2", "compiler": "0.14.0", "description": "A library for drawing with Typst, inspired by TikZ and Processing", "keywords": ["drawing", "diagram", "canvas"], "license": "LGPL-3.0-or-later", "updatedAt": 1_760_000_000u64 })),
            entry(serde_json::json!({ "name": "cetz", "version": "0.6.0", "compiler": "0.16.0", "description": "Future", "keywords": ["drawing"] })),
            entry(serde_json::json!({ "name": "ieee-monolith", "version": "0.1.0", "description": "Single column paper with IEEE-style references and bibliography.", "template": { "path": "template", "entrypoint": "main.typ" } })),
            entry(serde_json::json!({ "name": "tablex", "version": "0.0.9", "description": "Tables with more features", "keywords": ["table"] })),
            entry(serde_json::json!({ "name": "clean-thesis", "version": "0.2.0", "description": "A clean thesis template", "keywords": ["thesis"], "template": { "path": "template", "entrypoint": "main.typ" } })),
            entry(serde_json::json!({ "name": "futuro", "version": "1.0.0", "compiler": "0.16.0", "description": "Needs a newer compiler" })),
        ]
    }

    fn catalog() -> Catalog {
        build_catalog(&sample(), compiler_version())
    }

    #[test]
    fn ieee_devuelve_plantillas_con_su_identificador_completo_y_no_un_paquete_para_importar() {
        let hits = search(&catalog(), "ieee", Kind::Any, 8);
        let ids: Vec<&str> = hits.iter().map(|h| h.id.as_str()).collect();
        assert!(ids.contains(&"@preview/charged-ieee:0.1.4") && ids.contains(&"@preview/wired-ieee:1.0.1") && ids.contains(&"@preview/ieee-monolith:0.1.0"), "{ids:?}");
        assert!(hits.iter().all(|h| h.kind == "template"), "una plantilla no se presenta como paquete a importar");
    }

    #[test]
    fn cetz_sale_una_vez_con_la_ultima_version_compatible_y_dice_que_hay_otra_mas_nueva() {
        let hits = search(&catalog(), "cetz drawing", Kind::Package, 8);
        assert_eq!(hits.iter().filter(|h| h.name == "cetz").count(), 1);
        assert_eq!(hits[0].id, "@preview/cetz:0.5.2");
        assert_eq!(hits[0].newer_incompatible.as_ref().map(|n| n.version.as_str()), Some("0.6.0"));
        assert_eq!(hits[0].updated.as_deref(), Some("2025-10-09"));
    }

    #[test]
    fn el_nombre_exacto_gana_a_los_paquetes_que_dependen_de_el() {
        // Descubierto con el índice real: «cetz» devolvía cetz-fields y compañía y no el propio cetz.
        let mut entries = sample();
        entries.push(entry(serde_json::json!({ "name": "cetz-fields", "version": "0.2.0", "description": "Coulomb-field diagrams drawn with CeTZ", "keywords": ["cetz", "physics", "diagram"], "categories": ["cetz"] })));
        entries.push(entry(serde_json::json!({ "name": "visual-cetz", "version": "0.1.0", "description": "Show a CeTZ snippet and its output", "keywords": ["cetz"] })));
        let hits = search(&build_catalog(&entries, compiler_version()), "cetz", Kind::Package, 8);
        assert_eq!(hits[0].id, "@preview/cetz:0.5.2");
        assert!(hits.len() >= 3, "los que dependen de él siguen apareciendo, detrás");
    }

    #[test]
    fn el_filtro_de_tipo_separa_paquetes_de_plantillas() {
        let packages = search(&catalog(), "ieee", Kind::Package, 8);
        assert!(packages.is_empty(), "ningún paquete de la muestra habla de IEEE");
        let templates = search(&catalog(), "thesis", Kind::Template, 8);
        assert_eq!(templates[0].name, "clean-thesis");
    }

    #[test]
    fn el_glosario_lleva_el_espanol_al_ingles_del_indice() {
        assert_eq!(search(&catalog(), "plantilla de tesis", Kind::Template, 8)[0].name, "clean-thesis");
        assert_eq!(search(&catalog(), "una tabla", Kind::Any, 8)[0].name, "tablex");
        assert_eq!(search(&catalog(), "artículo", Kind::Template, 8).iter().map(|h| h.name.as_str()).collect::<Vec<_>>().len() >= 2, true);
    }

    #[test]
    fn a_igualdad_de_texto_gana_la_publicacion_mas_reciente_y_el_nombre_exacto_gana_a_todo() {
        let hits = search(&catalog(), "ieee paper", Kind::Template, 8);
        assert_eq!(hits[0].name, "charged-ieee", "misma coincidencia que wired-ieee, pero más reciente");
        assert_eq!(search(&catalog(), "tablex", Kind::Any, 8)[0].name, "tablex");
    }

    #[test]
    fn son_pocos_resultados_cortos_y_sin_resultados_no_inventa() {
        let mut big = sample();
        for i in 0..30 {
            big.push(entry(serde_json::json!({ "name": format!("ieee-extra-{i}"), "version": "0.1.0", "description": "x".repeat(400) })));
        }
        let hits = search(&build_catalog(&big, compiler_version()), "ieee", Kind::Any, 50);
        assert_eq!(hits.len(), MAX_HITS, "nunca más de {MAX_HITS}");
        assert!(hits.iter().all(|h| h.description.chars().count() <= DESCRIPTION_LIMIT + 1));
        assert!(search(&catalog(), "zzzzqqq", Kind::Any, 8).is_empty());
        assert!(search(&catalog(), "   ", Kind::Any, 8).is_empty());
    }

    #[test]
    fn la_fecha_de_publicacion_se_formatea_aaaa_mm_dd() {
        assert_eq!(days_to_date(0), "1970-01-01");
        assert_eq!(days_to_date(1_709_164_800), "2024-02-29");
        assert_eq!(days_to_date(1_760_000_000), "2025-10-09");
    }

    #[test]
    fn la_informacion_de_un_paquete_es_la_de_su_version_exacta() {
        let entries = vec![
            entry(serde_json::json!({ "name": "cetz", "version": "0.4.2", "description": "Drawing" })),
            entry(serde_json::json!({ "name": "cetz", "version": "0.5.2", "license": "LGPL-3.0-or-later", "repository": "https://github.com/cetz-package/cetz", "description": "A library for drawing" })),
            entry(serde_json::json!({ "name": "charged-ieee", "version": "0.1.4", "template": { "path": "template", "entrypoint": "main.typ" } })),
        ];
        let info = info_for(&entries, "@preview/cetz:0.5.2");
        assert_eq!((info.known, info.license.as_str(), info.is_template), (true, "LGPL-3.0-or-later", false));
        assert_eq!(info.repository.as_deref(), Some("https://github.com/cetz-package/cetz"));
        let old = info_for(&entries, "@preview/cetz:0.4.2");
        assert!(old.known && old.license.is_empty(), "la 0.4.2 de la muestra no declara licencia: no se le atribuye la de otra versión");
        assert!(info_for(&entries, "@preview/charged-ieee:0.1.4").is_template);
        assert!(!info_for(&entries, "@preview/inventado:1.0.0").known);
        assert!(!info_for(&entries, "no-es-un-id").known);
    }

    #[test]
    fn verifica_los_identificadores_que_escribe_la_ia() {
        let entries = sample();
        let catalog = catalog();
        let check = |id: &str| check_id(&entries, &catalog, id);
        assert_eq!(check("@preview/cetz:0.5.2").status, "ok");
        let outdated = check("@preview/cetz:0.4.2");
        assert_eq!((outdated.status, outdated.latest.as_deref()), ("outdated", Some("0.5.2")), "existe pero hay una más reciente compatible");
        let invented = check("@preview/cetz:9.9.9");
        assert_eq!((invented.status, invented.latest.as_deref()), ("unknownVersion", Some("0.5.2")));
        let newer = check("@preview/cetz:0.6.0");
        assert_eq!((newer.status, newer.latest.as_deref(), newer.compiler.as_deref()), ("needsNewerCompiler", Some("0.5.2"), Some("0.16.0")));
        assert_eq!(check("@preview/no-existe-dbv:0.1.0").status, "unknownPackage");
        assert_eq!(check("@preview/futuro:1.0.0").status, "unavailable");
        assert_eq!(check("cetz:0.5.2").status, "notAnId");
        assert_eq!(check("@preview/../etc:1.0.0").status, "notAnId", "un identificador con la ruta rota no llega a comprobarse");
    }

    /// Calidad de la búsqueda con el índice real completo (fuera de la CI).
    /// `DBV_UNIVERSE_INDEX=<ruta> cargo test --lib busquedas_con_el_indice_real -- --ignored --nocapture`
    #[test]
    #[ignore = "necesita DBV_UNIVERSE_INDEX con una descarga real del índice"]
    fn busquedas_con_el_indice_real() {
        let path = std::env::var("DBV_UNIVERSE_INDEX").expect("define DBV_UNIVERSE_INDEX");
        let entries = crate::commands::universe_index::parse_index(&std::fs::read(path).unwrap()).unwrap();
        let catalog = build_catalog(&entries, compiler_version());
        for (query, kind) in [("ieee", Kind::Template), ("cetz", Kind::Package), ("dibujar diagramas", Kind::Package), ("tesis", Kind::Template), ("currículum", Kind::Template), ("presentación", Kind::Any), ("tablas avanzadas", Kind::Package), ("bibliografia", Kind::Package), ("poster", Kind::Template)] {
            let hits = search(&catalog, query, kind, 5);
            println!("
«{query}» ({kind:?}):");
            for hit in &hits {
                println!("  {} [{}] {}", hit.id, hit.kind, hit.description.chars().take(70).collect::<String>());
            }
            assert!(!hits.is_empty(), "{query} no devuelve nada");
        }
    }
}
