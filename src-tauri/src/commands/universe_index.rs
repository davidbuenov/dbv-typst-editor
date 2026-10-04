// =============================================================================
// DBV Typst Editor — Índice completo de Typst Universe (RF-34)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Descarga y cachea en memoria el índice público de Typst Universe
// (`packages.typst.org/preview/index.json`, ~4.700 paquetes), la fuente que
// ya usa `curatedCatalog.js` para su whitelist curada — aquí se sirve SIN
// filtrar, para el catálogo completo de RF-34. Nunca se guarda en un registro
// propio (`ADR-UNIVERSE-001`): siempre el mismo dataset oficial.
//
// Forma de cada entrada verificada contra una descarga real del índice
// (`spikes/universe-index/index-sample.json`, 2026-09-11, 4.711 paquetes):
// no todos los campos documentados existen siempre (p. ej. `categories` solo
// aparece en plantillas), así que los opcionales se deserializan como tales
// en vez de asumir que siempre están.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

const INDEX_URL: &str = "https://packages.typst.org/preview/index.json";

/// Plantilla de una entrada del índice (`template.path` y `template.entrypoint`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateInfo {
    /// Carpeta de la plantilla dentro del paquete (`template`).
    pub path: Option<String>,
    /// Fichero de entrada de la plantilla (`main.typ`).
    pub entrypoint: Option<String>,
}

/// Una entrada del índice tal como la sirve `packages.typst.org`: una línea
/// por **versión** (4 876 entradas para 1 651 paquetes el 2026-10-04). Se leen
/// los campos que la galería muestra y los que la IA necesita para no
/// recomendar una versión que el compilador no admite (RF-108.1): `compiler`
/// (versión mínima), `updatedAt`, `repository`, `disciplines` y los datos de la
/// plantilla.
///
/// No se copian `exclude` ni `entrypoint`, que nadie usa.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(from = "RawEntry", rename_all = "camelCase")]
pub struct UniverseIndexEntry {
    pub name: String,
    pub version: String,
    pub description: String,
    pub authors: Vec<String>,
    pub license: String,
    pub categories: Vec<String>,
    pub keywords: Vec<String>,
    pub disciplines: Vec<String>,
    /// Versión mínima del compilador (`compiler`), si el paquete la declara.
    pub compiler: Option<String>,
    pub repository: Option<String>,
    /// Segundos Unix de la publicación de esta versión (`updatedAt`).
    pub updated_at: Option<u64>,
    /// True si esta entrada es una PLANTILLA (se crea con `typst init`), no un
    /// paquete para `#import`. Typst Universe no separa paquetes y plantillas
    /// en dos listas: es la MISMA entrada de `index.json`, y lo único que la
    /// distingue es que trae —o no— una clave `template`.
    ///
    /// Hasta este campo, ese dato se descartaba en el `#[derive(Deserialize)]`
    /// de serde sin más — y el buscador del catálogo completo (RF-34)
    /// insertaba `#import "@preview/campanile:..."` en el documento abierto
    /// para una plantilla de tesis, que no se importa, se crea. Hallazgo del
    /// usuario, 2026-09-12 (`campanile` trae `template`, `cetz` no).
    pub is_template: bool,
    /// Datos de la plantilla, solo si lo es.
    pub template: Option<TemplateInfo>,
}

/// La forma del JSON del índice. Todos los campos salvo el nombre y la versión
/// son opcionales: no todos existen siempre (`categories` solo en plantillas) y
/// un campo nuevo del registro no debe tirar abajo el catálogo entero.
#[derive(Deserialize)]
struct RawEntry {
    name: String,
    version: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    authors: Vec<String>,
    #[serde(default)]
    license: String,
    #[serde(default)]
    categories: Vec<String>,
    #[serde(default)]
    keywords: Vec<String>,
    #[serde(default)]
    disciplines: Vec<String>,
    #[serde(default)]
    compiler: Option<String>,
    #[serde(default)]
    repository: Option<String>,
    #[serde(default, rename = "updatedAt")]
    updated_at: Option<u64>,
    /// Solo importa si existe y no es `null`; su contenido se lee con tolerancia.
    #[serde(default)]
    template: Option<serde_json::Value>,
}

impl From<RawEntry> for UniverseIndexEntry {
    fn from(raw: RawEntry) -> Self {
        let template = raw.template.filter(|value| !value.is_null());
        let text = |key: &str| template.as_ref().and_then(|value| value.get(key)).and_then(|value| value.as_str()).map(str::to_string);
        let info = template.as_ref().map(|_| TemplateInfo { path: text("path"), entrypoint: text("entrypoint") });
        Self {
            name: raw.name,
            version: raw.version,
            description: raw.description,
            authors: raw.authors,
            license: raw.license,
            categories: raw.categories,
            keywords: raw.keywords,
            disciplines: raw.disciplines,
            compiler: raw.compiler,
            repository: raw.repository,
            updated_at: raw.updated_at,
            is_template: template.is_some(),
            template: info,
        }
    }
}

/// Caché en memoria del índice completo: se descarga una sola vez por sesión
/// de la aplicación (los ~4.700 paquetes pesan ~2,2 MB), no en cada apertura
/// del panel de Universe — coherente con la pregunta abierta de
/// `SPECIFICATIONS.md` §9 sobre comunicar un catálogo "cacheado en el último
/// sincronizado", no en vivo.
#[derive(Default)]
pub struct UniverseIndexState {
    cached: Mutex<Option<Vec<UniverseIndexEntry>>>,
}

/// Fichero del índice en la carpeta de datos de la aplicación: el JSON tal como
/// lo sirve el registro, para que lo lean también las conexiones locales de la
/// IA sin red (RF-108.6, RNF-IA.9.3). Su fecha de modificación es la del último
/// sincronizado.
pub const CACHE_FILE: &str = "universe-index.json";

/// Descarga (o sirve de caché) el índice completo de Typst Universe. Si no hay
/// red, usa el del último sincronizado en disco antes que fallar.
#[tauri::command]
pub fn fetch_universe_index(
    app: tauri::AppHandle,
    state: tauri::State<'_, UniverseIndexState>,
) -> Result<Vec<UniverseIndexEntry>, AppError> {
    if let Ok(guard) = state.cached.lock() {
        if let Some(entries) = guard.as_ref() {
            return Ok(entries.clone());
        }
    }

    let dir = tauri::Manager::path(&app).app_data_dir().ok();
    let entries = match download_index() {
        Ok((entries, raw)) => {
            if let Some(dir) = dir.as_deref() {
                // No poder guardarlo no es un fallo: la galería ya tiene lo que pidió.
                let _ = save_cache(dir, &raw);
            }
            entries
        }
        Err(error) => dir.as_deref().and_then(|dir| load_cache(dir).map(|cached| cached.entries)).ok_or(error)?,
    };

    if let Ok(mut guard) = state.cached.lock() {
        *guard = Some(entries.clone());
    }

    Ok(entries)
}

fn download_index() -> Result<(Vec<UniverseIndexEntry>, Vec<u8>), AppError> {
    let response = ureq::get(INDEX_URL)
        .call()
        .map_err(|error| AppError::Io(format!("No se pudo descargar el catálogo: {error}")))?;

    let raw = response
        .into_body()
        .read_to_vec()
        .map_err(|error| AppError::Io(format!("No se pudo leer el catálogo: {error}")))?;
    let entries = parse_index(&raw)?;
    Ok((entries, raw))
}

/// Interpreta el JSON del índice. Una entrada con un formato inesperado tira
/// abajo el catálogo entero: preferible a enseñar uno a medias sin decirlo.
pub fn parse_index(raw: &[u8]) -> Result<Vec<UniverseIndexEntry>, AppError> {
    serde_json::from_slice::<Vec<UniverseIndexEntry>>(raw)
        .map_err(|error| AppError::Parse(format!("El catálogo de Typst Universe llegó con un formato inesperado: {error}")))
}

/// Lo que hay en disco del último sincronizado.
pub struct CachedIndex {
    pub entries: Vec<UniverseIndexEntry>,
    /// Segundos Unix de su última modificación (cuándo se sincronizó).
    pub fetched_at: Option<u64>,
}

/// Guarda el índice tal como llegó, de forma atómica (fichero temporal y
/// renombrado): una escritura a medias no debe dejar un catálogo roto.
pub fn save_cache(dir: &std::path::Path, raw: &[u8]) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;
    let target = dir.join(CACHE_FILE);
    let temporary = dir.join(format!("{CACHE_FILE}.tmp"));
    std::fs::write(&temporary, raw)?;
    std::fs::rename(&temporary, &target)
}

/// Lee el índice guardado. `None` si no existe o no se puede interpretar (se
/// ignora en silencio: se vuelve a descargar cuando el usuario abra la galería).
pub fn load_cache(dir: &std::path::Path) -> Option<CachedIndex> {
    let path = dir.join(CACHE_FILE);
    let raw = std::fs::read(&path).ok()?;
    let entries = parse_index(&raw).ok()?;
    let fetched_at = std::fs::metadata(&path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|elapsed| elapsed.as_secs());
    Some(CachedIndex { entries, fetched_at })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Copiado de una descarga real (`spikes/universe-index/index-sample.json`,
    // 2026-09-11): un paquete normal y una plantilla, con y sin `categories`,
    // igual que la disciplina que ya aplicó `parse_git_status_output` en
    // `commands/git.rs` — comprobar el formato contra la herramienta real,
    // no escribirlo de memoria.
    const SAMPLE: &str = r#"[
        {
            "name": "a2c-nums",
            "version": "0.0.1",
            "entrypoint": "src/lib.typ",
            "authors": ["Zhuo Nengwen <soarowl@yeah.net>"],
            "license": "MIT",
            "description": "Convert a number to Chinese",
            "repository": "https://github.com/soarowl/a2c-nums.git",
            "keywords": ["Converter", "number", "Chinese", "Currency"],
            "compiler": "0.10.0",
            "exclude": ["demo.pdf"],
            "updatedAt": 1704708827
        },
        {
            "name": "abiding-ifacconf",
            "version": "0.1.0",
            "entrypoint": "lib.typ",
            "authors": ["Alexander Von Moll <https://avonmoll.github.io>"],
            "license": "MIT-0",
            "description": "An IFAC-style paper template",
            "repository": "https://github.com/avonmoll/ifacconf-typst",
            "keywords": ["IFAC", "conference"],
            "categories": ["paper"],
            "disciplines": ["computer-science", "engineering"],
            "compiler": "0.11.0",
            "template": {"path": "template", "entrypoint": "main.typ", "thumbnail": "thumbnail.png"},
            "updatedAt": 1711039864
        }
    ]"#;

    #[test]
    fn deserializa_una_entrada_sin_categories() {
        let entries: Vec<UniverseIndexEntry> = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(entries[0].name, "a2c-nums");
        assert_eq!(entries[0].version, "0.0.1");
        assert_eq!(entries[0].license, "MIT");
        assert!(entries[0].categories.is_empty());
        assert_eq!(entries[0].authors, vec!["Zhuo Nengwen <soarowl@yeah.net>".to_string()]);
        // Sin clave `template` en el JSON de origen: un paquete normal.
        assert!(!entries[0].is_template);
    }

    #[test]
    fn deserializa_una_entrada_con_categories_y_reconoce_que_es_una_plantilla() {
        // Antes de `is_template`, este mismo test se llamaba
        // "...campos_de_plantilla_ignorados": documentaba el hallazgo sin
        // actuar sobre él. `abiding-ifacconf` es justo el caso real que hizo
        // saltar el fallo (2026-09-12) — una plantilla que el buscador del
        // catálogo completo insertaba como si fuera un paquete para `#import`.
        let entries: Vec<UniverseIndexEntry> = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(entries[1].name, "abiding-ifacconf");
        assert_eq!(entries[1].categories, vec!["paper".to_string()]);
        assert!(entries[1].is_template);
    }

    #[test]
    fn guarda_el_indice_en_disco_y_lo_vuelve_a_leer_con_su_fecha() {
        let dir = tempfile::tempdir().unwrap();
        assert!(load_cache(dir.path()).is_none(), "sin fichero no hay caché");
        save_cache(dir.path(), SAMPLE.as_bytes()).unwrap();
        let cached = load_cache(dir.path()).expect("se lee lo que se guardó");
        assert_eq!(cached.entries.len(), 2);
        assert!(cached.entries[1].is_template);
        assert!(cached.fetched_at.is_some_and(|secs| secs > 1_700_000_000), "la fecha es la de la última modificación");
        assert!(!dir.path().join(format!("{CACHE_FILE}.tmp")).exists(), "no queda el fichero temporal");
    }

    #[test]
    fn un_fichero_de_cache_danado_se_ignora_sin_fallar() {
        let dir = tempfile::tempdir().unwrap();
        save_cache(dir.path(), b"[{ esto no es json").unwrap();
        assert!(load_cache(dir.path()).is_none());
    }

    #[test]
    fn conserva_el_compilador_las_fechas_y_los_datos_de_la_plantilla() {
        let entries: Vec<UniverseIndexEntry> = serde_json::from_str(SAMPLE).unwrap();
        assert_eq!(entries[0].compiler.as_deref(), Some("0.10.0"));
        assert_eq!(entries[0].updated_at, Some(1_704_708_827));
        assert_eq!(entries[0].repository.as_deref(), Some("https://github.com/soarowl/a2c-nums.git"));
        assert!(entries[0].template.is_none());
        assert_eq!(entries[1].disciplines, vec!["computer-science".to_string(), "engineering".to_string()]);
        assert_eq!(entries[1].template.as_ref().and_then(|t| t.entrypoint.as_deref()), Some("main.typ"));
        assert_eq!(entries[1].template.as_ref().and_then(|t| t.path.as_deref()), Some("template"));
    }

    #[test]
    fn una_clave_template_nula_no_es_una_plantilla() {
        let entry: UniverseIndexEntry = serde_json::from_str(r#"{"name":"x","version":"1.0.0","template":null}"#).unwrap();
        assert!(!entry.is_template);
        assert!(entry.template.is_none());
    }

    #[test]
    fn el_recorte_del_indice_real_deserializa_sin_error() {
        // `spikes/universe-index/index-sample.json` es un recorte de 25
        // entradas de una descarga real del 2026-09-11 (el índice completo
        // tenía 4.711 paquetes, comprobado a mano, no versionado entero por
        // peso). Aquí solo se comprueba que la FORMA se deserializa sin
        // error, no un recuento — para eso está el spike documentado.
        let ruta = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("spikes")
            .join("universe-index")
            .join("index-sample.json");
        let Ok(contenido) = std::fs::read_to_string(&ruta) else {
            return;
        };
        let entries: Vec<UniverseIndexEntry> = serde_json::from_str(&contenido)
            .expect("el índice real de Typst Universe debe deserializar sin error");
        assert!(!entries.is_empty());
    }
}
