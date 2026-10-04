// =============================================================================
// DBV Typst Editor — Catálogo de Typst Universe de una versión por paquete (RF-108.1)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El índice de Universe lista TODAS las versiones de cada paquete (4 876
// entradas para 1 651 paquetes, 2026-10-04; CeTZ llega a 0.5.2). Una búsqueda
// ingenua devuelve versiones viejas mezcladas con las nuevas, que es lo que
// llevó a Gemini a recomendar una versión obsoleta de CeTZ. Aquí se reduce a
// UNA entrada por paquete: la última versión que el compilador vendorizado
// admite (`compiler` del paquete <= la versión de Typst de DBV).
//
// Puro y sin red: trabaja sobre las entradas que ya leyó `universe_index`.

use std::collections::BTreeMap;

use serde::Serialize;
use typst::syntax::package::PackageVersion;

use crate::commands::universe_index::{TemplateInfo, UniverseIndexEntry};

/// Versión del compilador contra la que se comprueba la compatibilidad: la de
/// la biblioteca `typst` enlazada, que es la que compila los documentos.
pub fn compiler_version() -> PackageVersion {
    PackageVersion::compiler()
}

/// Una versión más nueva que la elegida pero que el compilador no admite.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NewerVersion {
    pub version: String,
    /// Versión mínima del compilador que pide.
    pub compiler: String,
}

/// La entrada elegida de un paquete.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntry {
    pub name: String,
    pub version: String,
    pub description: String,
    pub categories: Vec<String>,
    pub keywords: Vec<String>,
    pub disciplines: Vec<String>,
    pub license: String,
    pub is_template: bool,
    pub template: Option<TemplateInfo>,
    pub compiler: Option<String>,
    pub updated_at: Option<u64>,
    pub repository: Option<String>,
    /// Hay una versión más nueva que este compilador no admite.
    pub newer_incompatible: Option<NewerVersion>,
}

/// Un paquete del que ninguna versión se puede usar con este compilador.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnavailableEntry {
    pub name: String,
    /// Su versión más antigua publicada (la más probable de funcionar, y aun así no cabe).
    pub version: String,
    pub compiler: String,
}

/// El catálogo reducido.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub entries: Vec<CatalogEntry>,
    pub unavailable: Vec<UnavailableEntry>,
    /// Entradas descartadas porque su versión no es `x.y.z`.
    pub skipped: usize,
}

/// ¿Cabe una entrada en este compilador? Sin `compiler` declarado, sí.
fn fits(entry: &UniverseIndexEntry, compiler: PackageVersion) -> bool {
    entry.compiler.as_deref().and_then(|text| text.parse::<PackageVersion>().ok()).is_none_or(|needed| needed <= compiler)
}

fn to_catalog_entry(entry: &UniverseIndexEntry, newer: Option<NewerVersion>) -> CatalogEntry {
    CatalogEntry {
        name: entry.name.clone(),
        version: entry.version.clone(),
        description: entry.description.clone(),
        categories: entry.categories.clone(),
        keywords: entry.keywords.clone(),
        disciplines: entry.disciplines.clone(),
        license: entry.license.clone(),
        is_template: entry.is_template,
        template: entry.template.clone(),
        compiler: entry.compiler.clone(),
        updated_at: entry.updated_at,
        repository: entry.repository.clone(),
        newer_incompatible: newer,
    }
}

/// Reduce el índice a una entrada por paquete: la última versión compatible con
/// `compiler`. Orden alfabético por nombre (estable para los tests y la salida).
pub fn build_catalog(entries: &[UniverseIndexEntry], compiler: PackageVersion) -> Catalog {
    let mut by_name: BTreeMap<&str, Vec<(PackageVersion, &UniverseIndexEntry)>> = BTreeMap::new();
    let mut skipped = 0;
    for entry in entries {
        match entry.version.parse::<PackageVersion>() {
            Ok(version) => by_name.entry(entry.name.as_str()).or_default().push((version, entry)),
            Err(_) => skipped += 1,
        }
    }

    let mut catalog = Catalog { skipped, ..Catalog::default() };
    for (name, mut versions) in by_name {
        versions.sort_by_key(|version| std::cmp::Reverse(version.0.clone()));
        let newest = versions[0].1;
        match versions.iter().find(|(_, entry)| fits(entry, compiler)) {
            Some((_, chosen)) => {
                let newer = (chosen.version != newest.version).then(|| NewerVersion {
                    version: newest.version.clone(),
                    compiler: newest.compiler.clone().unwrap_or_default(),
                });
                catalog.entries.push(to_catalog_entry(chosen, newer));
            }
            None => {
                // La más antigua es la que tiene más posibilidades; si ni esa cabe, el paquete no sirve aquí.
                let oldest = versions[versions.len() - 1].1;
                catalog.unavailable.push(UnavailableEntry {
                    name: name.to_string(),
                    version: oldest.version.clone(),
                    compiler: oldest.compiler.clone().unwrap_or_default(),
                });
            }
        }
    }
    catalog
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(name: &str, version: &str, compiler: Option<&str>) -> UniverseIndexEntry {
        let json = serde_json::json!({ "name": name, "version": version, "compiler": compiler, "description": format!("{name} {version}") });
        serde_json::from_value(json).unwrap()
    }

    fn compiler(text: &str) -> PackageVersion {
        text.parse().unwrap()
    }

    #[test]
    fn el_compilador_es_el_vendorizado() {
        // Si se actualiza `typst`, este test obliga a repasar el catálogo y la documentación (RF-96.1).
        assert_eq!(compiler_version().to_string(), "0.15.1");
    }

    #[test]
    fn de_un_paquete_con_varias_versiones_sale_una_la_mas_reciente_compatible() {
        let entries = [
            entry("cetz", "0.4.2", Some("0.13.0")),
            entry("cetz", "0.5.2", Some("0.14.0")),
            entry("cetz", "0.5.0", Some("0.14.0")),
            entry("cetz", "0.4.10", Some("0.13.0")),
        ];
        let catalog = build_catalog(&entries, compiler("0.15.1"));
        assert_eq!(catalog.entries.len(), 1);
        assert_eq!(catalog.entries[0].version, "0.5.2", "0.4.10 > 0.4.2 pero 0.5.2 es la última; el orden es semántico, no de texto");
        assert_eq!(catalog.entries[0].newer_incompatible, None);
    }

    #[test]
    fn una_version_que_pide_un_compilador_mas_nuevo_no_se_ofrece_y_se_dice() {
        let entries = [entry("cetz", "0.5.2", Some("0.14.0")), entry("cetz", "0.6.0", Some("0.16.0"))];
        let catalog = build_catalog(&entries, compiler("0.15.1"));
        assert_eq!(catalog.entries[0].version, "0.5.2");
        assert_eq!(catalog.entries[0].newer_incompatible, Some(NewerVersion { version: "0.6.0".into(), compiler: "0.16.0".into() }));
    }

    #[test]
    fn si_ninguna_version_cabe_el_paquete_queda_como_no_disponible() {
        let entries = [entry("futuro", "1.0.0", Some("0.16.0")), entry("futuro", "1.1.0", Some("0.17.0"))];
        let catalog = build_catalog(&entries, compiler("0.15.1"));
        assert!(catalog.entries.is_empty());
        assert_eq!(catalog.unavailable, vec![UnavailableEntry { name: "futuro".into(), version: "1.0.0".into(), compiler: "0.16.0".into() }]);
    }

    #[test]
    fn sin_compilador_declarado_se_considera_compatible_y_el_compilador_igual_tambien() {
        let entries = [entry("viejo", "0.1.0", None), entry("justo", "1.0.0", Some("0.15.1"))];
        let catalog = build_catalog(&entries, compiler("0.15.1"));
        assert_eq!(catalog.entries.iter().map(|e| e.name.as_str()).collect::<Vec<_>>(), vec!["justo", "viejo"]);
    }

    #[test]
    fn una_version_que_no_es_semver_se_descarta_sin_tumbar_el_resto() {
        let entries = [entry("raro", "v1", None), entry("raro", "0.1.0", None), entry("otro", "ñ", None)];
        let catalog = build_catalog(&entries, compiler("0.15.1"));
        assert_eq!(catalog.skipped, 2);
        assert_eq!(catalog.entries.len(), 1);
        assert_eq!(catalog.entries[0].version, "0.1.0");
    }

    #[test]
    fn la_plantilla_conserva_su_carpeta_y_su_fichero_de_entrada() {
        let template = serde_json::json!({
            "name": "charged-ieee", "version": "0.1.4", "compiler": "0.12.0", "categories": ["paper"], "disciplines": ["computer-science"],
            "repository": "https://github.com/typst/templates", "updatedAt": 1700000000,
            "template": { "path": "template", "entrypoint": "main.typ", "thumbnail": "thumbnail.png" }
        });
        let entries = [serde_json::from_value::<UniverseIndexEntry>(template).unwrap()];
        let catalog = build_catalog(&entries, compiler("0.15.1"));
        let found = &catalog.entries[0];
        assert!(found.is_template);
        assert_eq!(found.template, Some(TemplateInfo { path: Some("template".into()), entrypoint: Some("main.typ".into()) }));
        assert_eq!((found.updated_at, found.repository.as_deref()), (Some(1_700_000_000), Some("https://github.com/typst/templates")));
        assert_eq!(found.disciplines, vec!["computer-science".to_string()]);
    }

    #[test]
    fn el_recorte_del_indice_real_se_reduce_a_una_entrada_por_paquete() {
        let ruta = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("spikes").join("universe-index").join("index-sample.json");
        let Ok(contenido) = std::fs::read(&ruta) else {
            return;
        };
        let entries = crate::commands::universe_index::parse_index(&contenido).expect("el índice real debe leerse");
        let catalog = build_catalog(&entries, compiler("0.15.1"));
        let distinct: std::collections::BTreeSet<&str> = entries.iter().map(|e| e.name.as_str()).collect();
        assert!(catalog.entries.len() + catalog.unavailable.len() == distinct.len(), "una entrada por nombre");
        assert!(entries.len() > distinct.len(), "la muestra real trae varias versiones de algún paquete (abbr)");
        let abbr = catalog.entries.iter().find(|e| e.name == "abbr").expect("abbr está en la muestra");
        let latest = entries.iter().filter(|e| e.name == "abbr").map(|e| e.version.parse::<PackageVersion>().unwrap()).max().unwrap();
        assert_eq!(abbr.version, latest.to_string());
    }

    /// Contra una descarga real del índice completo (fuera de la CI: necesita el fichero).
    /// `DBV_UNIVERSE_INDEX=<ruta a index.json> cargo test --lib indice_real_completo -- --ignored --nocapture`
    #[test]
    #[ignore = "necesita DBV_UNIVERSE_INDEX con una descarga real del índice"]
    fn indice_real_completo() {
        let path = std::env::var("DBV_UNIVERSE_INDEX").expect("define DBV_UNIVERSE_INDEX");
        let entries = crate::commands::universe_index::parse_index(&std::fs::read(path).unwrap()).expect("el índice real debe leerse entero");
        let catalog = build_catalog(&entries, compiler_version());
        println!("{} entradas -> {} paquetes ({} no disponibles, {} descartadas)", entries.len(), catalog.entries.len(), catalog.unavailable.len(), catalog.skipped);
        let cetz = catalog.entries.iter().find(|e| e.name == "cetz").expect("cetz");
        println!("cetz -> {} (compilador {:?}); más nueva incompatible: {:?}", cetz.version, cetz.compiler, cetz.newer_incompatible);
        let templates = catalog.entries.iter().filter(|e| e.is_template).count();
        println!("{templates} plantillas; con entrypoint: {}", catalog.entries.iter().filter(|e| e.template.as_ref().is_some_and(|t| t.entrypoint.is_some())).count());
        assert_eq!(catalog.skipped, 0);
        assert!(catalog.entries.len() > 1500);
    }
}
