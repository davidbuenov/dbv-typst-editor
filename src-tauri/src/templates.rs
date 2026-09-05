// =============================================================================
// DBV Typst Editor — Catálogo de plantillas y creación de proyectos
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Restricciones congeladas que gobiernan este módulo (ARCHITECTURE.md §0.2):
//
//   · R-MVP-1 — el catálogo se lee tras una abstracción con forma de dato
//     compatible con las entradas de `index.json` de Typst Universe (name,
//     version, authors, description, categories, template{path, entrypoint,
//     thumbnail}). En el MVP hay una sola implementación —plantillas locales
//     curadas— y en Beta se añade la del catálogo remoto cacheado SIN tocar el
//     lanzador ni el asistente, porque ambos consumen `TemplateInfo`, no rutas.
//   · R-MVP-2 — el scaffolding va SIEMPRE por `typst init`, nunca copiando
//     directorios a mano. Las plantillas propias se sirven como paquetes del
//     namespace `@local` desde un directorio propio de DBV:
//     `typst init --package-path <dir> @local/<nombre>:<versión> <destino>`.
//
// Hallazgo del Slice 7, verificado contra el binario real: el proyecto generado
// NO debe importar su propio paquete (`#import "@local/dbv-tfg:1.0.0"`), porque
// entonces solo compila si se le vuelve a pasar `--package-path` — y forzar ese
// flag en toda compilación taparía los paquetes `@local` propios del usuario.
// Las plantillas curadas son autocontenidas: su `template/` incluye el fichero
// de estilo y `main.typ` lo importa por ruta relativa. Consecuencia deseable:
// un proyecto creado con DBV compila con `typst` a secas, sin DBV de por medio.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::commands::file_io::path_to_string;
use crate::error::AppError;
use crate::project::{self, Project};
use crate::typst_engine::{self, TypstError};

/// Namespace de paquetes bajo el que viven las plantillas curadas.
const LOCAL_NAMESPACE: &str = "local";

/// Manifiesto oficial de Typst (`typst.toml`). Solo se leen los campos que el
/// catálogo necesita; el resto se ignora sin fallar.
#[derive(Debug, Clone, Default, Deserialize)]
struct TypstManifest {
    #[serde(default)]
    package: TypstPackage,
    #[serde(default)]
    template: Option<TypstTemplate>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct TypstPackage {
    #[serde(default)]
    name: String,
    #[serde(default)]
    version: String,
    #[serde(default)]
    authors: Vec<String>,
    #[serde(default)]
    description: String,
    #[serde(default)]
    categories: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct TypstTemplate {
    #[serde(default)]
    path: String,
    #[serde(default)]
    entrypoint: String,
    #[serde(default)]
    thumbnail: Option<String>,
}

/// Sidecar propio de DBV (`dbv-template.toml`). Estrictamente opcional: una
/// plantilla sin él sigue siendo utilizable, solo que sin formulario.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct DbvTemplate {
    #[serde(default)]
    pub dbv_category: Option<String>,
    #[serde(default)]
    pub localization: BTreeMap<String, Localization>,
    #[serde(default)]
    pub screenshots: Vec<String>,
    #[serde(default)]
    pub fields: Vec<TemplateField>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Localization {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
}

/// Un campo del formulario del asistente de creación (§7.6.4).
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateField {
    pub key: String,
    #[serde(default)]
    pub label: String,
    #[serde(default = "default_field_type", rename = "type")]
    pub field_type: String,
    #[serde(default)]
    pub default: Option<String>,
    #[serde(default)]
    pub placeholder: Option<String>,
    #[serde(default)]
    pub validation: FieldValidation,
}

fn default_field_type() -> String {
    "text".to_string()
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldValidation {
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub max_length: Option<usize>,
}

/// Entrada del catálogo tal como la consumen el lanzador y el asistente.
///
/// La forma es deliberadamente la de una entrada de `index.json` (R-MVP-1) más
/// la capa DBV opcional: en Beta, el catálogo comunitario producirá este mismo
/// tipo y ninguna vista tendrá que cambiar.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateInfo {
    /// `@local/<nombre>` — identificador estable de la plantilla.
    pub id: String,
    pub name: String,
    pub version: String,
    pub authors: Vec<String>,
    pub description: String,
    pub categories: Vec<String>,
    pub entrypoint: String,
    pub thumbnail: Option<String>,
    /// Capa DBV. `None` en una plantilla comunitaria sin sidecar: el asistente
    /// degrada limpiamente a "sin formulario", nunca a un error.
    pub dbv: Option<DbvTemplate>,
}

/// Localiza el directorio de plantillas curadas.
///
/// Se prueban en orden las tres ubicaciones posibles: el recurso empaquetado
/// (dos formas, según cómo haya resuelto Tauri la ruta al empaquetar) y el
/// árbol de fuentes, que es lo que hay durante el desarrollo.
pub fn templates_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let mut candidates = Vec::new();
    if let Ok(resources) = app.path().resource_dir() {
        candidates.push(resources.join("templates"));
        candidates.push(resources.join("_up_").join("templates"));
    }
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../templates"));

    let found = candidates
        .into_iter()
        .find(|candidate| candidate.join(LOCAL_NAMESPACE).is_dir())
        .ok_or_else(|| {
            AppError::NotFound("no se encuentra el catálogo de plantillas".to_string())
        })?;
    Ok(found)
}

/// Lee una plantilla desde `<dir>/local/<nombre>/<versión>/`.
fn read_template(dir: &Path) -> Option<TemplateInfo> {
    let manifest_raw = fs::read_to_string(dir.join("typst.toml")).ok()?;
    let manifest: TypstManifest = toml::from_str(&manifest_raw).ok()?;
    let template = manifest.template?;

    // El sidecar DBV es opcional y su ausencia nunca invalida la plantilla; un
    // sidecar corrupto tampoco, porque perder el formulario es preferible a
    // hacer desaparecer la plantilla del catálogo sin explicación.
    let dbv = fs::read_to_string(dir.join("dbv-template.toml"))
        .ok()
        .and_then(|raw| toml::from_str::<DbvTemplate>(&raw).ok());

    Some(TemplateInfo {
        id: format!("@{LOCAL_NAMESPACE}/{}", manifest.package.name),
        name: manifest.package.name,
        version: manifest.package.version,
        authors: manifest.package.authors,
        description: manifest.package.description,
        categories: manifest.package.categories,
        entrypoint: if template.entrypoint.is_empty() {
            "main.typ".to_string()
        } else {
            template.entrypoint
        },
        thumbnail: template
            .thumbnail
            .map(|file| path_to_string(&dir.join(&template.path).join(file))),
        dbv,
    })
}

/// Recorre el árbol de plantillas y devuelve el catálogo.
///
/// De cada plantilla se toma **una sola** versión, la mayor por orden
/// lexicográfico del nombre de carpeta: el catálogo es una lista de "qué puedo
/// crear", no un historial de versiones.
pub fn scan_catalog(root: &Path) -> Vec<TemplateInfo> {
    let namespace_dir = root.join(LOCAL_NAMESPACE);
    let Ok(entries) = fs::read_dir(&namespace_dir) else {
        return Vec::new();
    };

    let mut catalog: Vec<TemplateInfo> = entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_dir())
        .filter_map(|entry| latest_version_dir(&entry.path()))
        .filter_map(|version_dir| read_template(&version_dir))
        .collect();

    catalog.sort_by_key(|template| template.name.to_lowercase());
    catalog
}

/// Carpeta de la versión más alta de una plantilla.
fn latest_version_dir(template_dir: &Path) -> Option<PathBuf> {
    let mut versions: Vec<PathBuf> = fs::read_dir(template_dir)
        .ok()?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect();
    versions.sort();
    versions.pop()
}

/// Sustituye los marcadores `{{clave}}` por los valores del formulario.
///
/// Sustitución de texto simple, sin motor de plantillas (ARCHITECTURE.md
/// §7.6.4). Los marcadores sin valor se dejan tal cual en lugar de vaciarse:
/// un hueco visible es más fácil de corregir que un campo desaparecido.
pub fn substitute_tokens(source: &str, values: &BTreeMap<String, String>) -> String {
    let mut result = source.to_string();
    for (key, value) in values {
        result = result.replace(&format!("{{{{{key}}}}}"), value);
    }
    result
}

/// Extensiones de fichero en las que se sustituyen marcadores.
const SUBSTITUTABLE: [&str; 3] = ["typ", "bib", "toml"];

/// Aplica la sustitución a todo el árbol recién creado.
fn substitute_in_tree(dir: &Path, values: &BTreeMap<String, String>) -> Result<(), AppError> {
    let entries = fs::read_dir(dir).map_err(|error| AppError::Io(error.to_string()))?;
    for entry in entries.filter_map(|entry| entry.ok()) {
        let path = entry.path();
        if path.is_dir() {
            substitute_in_tree(&path, values)?;
            continue;
        }
        let is_substitutable = path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| SUBSTITUTABLE.iter().any(|kind| kind.eq_ignore_ascii_case(ext)));
        if !is_substitutable {
            continue;
        }
        // Un fichero binario mal etiquetado no debe abortar la creación entera.
        let Ok(source) = fs::read_to_string(&path) else {
            continue;
        };
        let rendered = substitute_tokens(&source, values);
        if rendered != source {
            fs::write(&path, rendered).map_err(|error| AppError::Io(error.to_string()))?;
        }
    }
    Ok(())
}

/// Carpetas de la estructura de proyecto (SPECIFICATIONS.md §4) que se crean
/// vacías si la plantilla no las trae, para que el usuario tenga desde el
/// primer momento dónde poner sus imágenes y recursos.
pub(crate) const PROJECT_DIRS: [&str; 2] = ["images", "assets"];

/// Catálogo de plantillas disponibles.
#[tauri::command]
pub fn list_templates(app: AppHandle) -> Result<Vec<TemplateInfo>, AppError> {
    let root = templates_dir(&app)?;
    Ok(scan_catalog(&root))
}

/// Crea un proyecto desde una plantilla (RF-03).
///
/// Orden de operaciones: `typst init` hace el scaffolding real (R-MVP-2), DBV
/// sustituye los marcadores encima y solo entonces escribe su manifiesto — que
/// es la única escritura de `settings/dbv-project.toml` de toda la aplicación,
/// y ocurre porque el usuario ha pulsado "Crear proyecto" (R-MVP-3).
#[tauri::command]
pub async fn create_project(
    app: AppHandle,
    template_name: String,
    template_version: String,
    parent_dir: String,
    project_name: String,
    fields: BTreeMap<String, String>,
) -> Result<Project, AppError> {
    let templates_root = templates_dir(&app)?;
    let folder = project::slugify(&project_name);
    let target = PathBuf::from(&parent_dir).join(&folder);

    if target.exists() {
        return Err(AppError::Denied(path_to_string(&target)));
    }
    if !Path::new(&parent_dir).is_dir() {
        return Err(AppError::InvalidPath(parent_dir));
    }

    let spec = format!("@{LOCAL_NAMESPACE}/{template_name}:{template_version}");
    let args = vec![
        "init",
        "--package-path",
        &templates_root.to_string_lossy(),
        &spec,
        &target.to_string_lossy(),
    ]
    .into_iter()
    .map(str::to_string)
    .collect::<Vec<String>>();

    let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
    typst_engine::run(&app, &borrowed)
        .await
        .map_err(|error| AppError::Io(describe_typst_error(&error)))?;

    substitute_in_tree(&target, &fields)?;

    for dir in PROJECT_DIRS {
        let _ = fs::create_dir_all(target.join(dir));
    }

    let entrypoint = project::describe(&target)?
        .entrypoint
        .unwrap_or_else(|| "main.typ".to_string());
    let manifest = project::new_manifest(&template_name, &template_version, &entrypoint, fields);
    project::write_manifest(&target, &manifest)?;

    project::describe(&target)
}

/// Traduce el error del motor a un mensaje legible para el usuario.
fn describe_typst_error(error: &TypstError) -> String {
    match error {
        TypstError::SidecarUnavailable(message) => message.clone(),
        TypstError::ExecutionFailed(message) => message.clone(),
        TypstError::PreviewExpired(message) => message.clone(),
        TypstError::CompilationFailed { stderr, .. } => stderr.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn values(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(key, value)| (key.to_string(), value.to_string()))
            .collect()
    }

    fn write_template(root: &Path, name: &str, version: &str, with_sidecar: bool) {
        let dir = root.join(LOCAL_NAMESPACE).join(name).join(version);
        fs::create_dir_all(dir.join("template")).unwrap();
        fs::write(
            dir.join("typst.toml"),
            format!(
                "[package]\nname = \"{name}\"\nversion = \"{version}\"\nauthors = [\"DBV\"]\n\
                 description = \"Plantilla de prueba\"\ncategories = [\"thesis\"]\n\n\
                 [template]\npath = \"template\"\nentrypoint = \"main.typ\"\n"
            ),
        )
        .unwrap();
        fs::write(dir.join("template").join("main.typ"), "= {{titulo}}\n").unwrap();
        if with_sidecar {
            fs::write(
                dir.join("dbv-template.toml"),
                "dbv_category = \"academico\"\n\n[localization.es]\nname = \"Prueba\"\n\
                 description = \"Plantilla de prueba\"\n\n[[fields]]\nkey = \"titulo\"\n\
                 label = \"Título\"\ntype = \"text\"\nvalidation = { required = true }\n",
            )
            .unwrap();
        }
    }

    #[test]
    fn substitute_tokens_reemplaza_los_marcadores_presentes() {
        let source = "= {{titulo}}\nAutor: {{autor}}";
        let rendered = substitute_tokens(&source, &values(&[("titulo", "Mi TFG"), ("autor", "David")]));
        assert_eq!(rendered, "= Mi TFG\nAutor: David");
    }

    #[test]
    fn substitute_tokens_deja_visible_el_marcador_sin_valor() {
        let rendered = substitute_tokens("= {{titulo}} / {{tutor}}", &values(&[("titulo", "X")]));
        assert_eq!(rendered, "= X / {{tutor}}");
    }

    #[test]
    fn substitute_tokens_sin_valores_no_toca_nada() {
        let source = "= {{titulo}}";
        assert_eq!(substitute_tokens(source, &BTreeMap::new()), source);
    }

    #[test]
    fn scan_catalog_lee_las_plantillas_con_y_sin_sidecar() {
        let root = tempfile::tempdir().unwrap();
        write_template(root.path(), "dbv-tfg", "1.0.0", true);
        write_template(root.path(), "dbv-blank", "0.1.0", false);

        let catalog = scan_catalog(root.path());
        assert_eq!(catalog.len(), 2);
        // Orden alfabético por nombre.
        assert_eq!(catalog[0].name, "dbv-blank");
        assert_eq!(catalog[0].id, "@local/dbv-blank");
        // Sin sidecar la plantilla sigue estando: solo se queda sin formulario.
        assert!(catalog[0].dbv.is_none());
        assert_eq!(catalog[1].dbv.as_ref().unwrap().fields.len(), 1);
        assert_eq!(catalog[1].dbv.as_ref().unwrap().fields[0].key, "titulo");
    }

    #[test]
    fn scan_catalog_toma_solo_la_version_mas_alta() {
        let root = tempfile::tempdir().unwrap();
        write_template(root.path(), "dbv-tfg", "1.0.0", false);
        write_template(root.path(), "dbv-tfg", "1.1.0", false);

        let catalog = scan_catalog(root.path());
        assert_eq!(catalog.len(), 1);
        assert_eq!(catalog[0].version, "1.1.0");
    }

    #[test]
    fn scan_catalog_ignora_una_carpeta_sin_manifiesto() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.path().join(LOCAL_NAMESPACE).join("rota").join("1.0.0")).unwrap();

        assert!(scan_catalog(root.path()).is_empty());
    }

    #[test]
    fn scan_catalog_en_un_directorio_inexistente_devuelve_vacio() {
        assert!(scan_catalog(Path::new("dbv-no-existe")).is_empty());
    }

    /// El catálogo REAL que se empaqueta, no una copia de prueba.
    ///
    /// Un `typst.toml` mal escrito o un `dbv-template.toml` corrupto haría
    /// desaparecer la plantilla del lanzador en silencio (`read_template`
    /// devuelve `None` a propósito, para que una plantilla rota no tumbe el
    /// catálogo entero). Sin este test, ese silencio solo se notaría abriendo
    /// la aplicación y viendo un hueco.
    #[test]
    fn el_catalogo_empaquetado_se_lee_completo_y_con_su_capa_dbv() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../templates");
        let catalog = scan_catalog(&root);

        let nombres: Vec<&str> = catalog.iter().map(|t| t.name.as_str()).collect();
        assert_eq!(
            nombres,
            vec![
                "dbv-articulo",
                "dbv-blank",
                "dbv-cv",
                "dbv-informe-tecnico",
                "dbv-presentacion",
                "dbv-tesis",
                "dbv-tfg",
                "dbv-tfm",
            ],
            "el catálogo de v0.2 son estas 8 plantillas (v0.1 diferió 4 a este slice)"
        );

        for template in &catalog {
            assert!(!template.version.is_empty(), "{} sin versión", template.name);
            assert_eq!(template.entrypoint, "main.typ", "{}", template.name);
            let dbv = template
                .dbv
                .as_ref()
                .unwrap_or_else(|| panic!("{} debería traer sidecar DBV", template.name));
            assert!(dbv.dbv_category.is_some(), "{} sin categoría", template.name);
            // El lanzador cae al nombre del paquete si falta la localización, y
            // "dbv-tfg" no es lo que debe leer un usuario.
            for idioma in ["es", "en"] {
                let localizado = dbv
                    .localization
                    .get(idioma)
                    .unwrap_or_else(|| panic!("{} sin localización {idioma}", template.name));
                assert!(!localizado.name.is_empty());
                assert!(!localizado.description.is_empty());
            }
        }
    }

    /// Los campos del formulario deben corresponderse con marcadores reales de
    /// la plantilla: un campo que no sustituye nada le pide al usuario un dato
    /// que después no aparece en su documento.
    #[test]
    fn cada_campo_del_formulario_tiene_su_marcador_en_la_plantilla() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../templates");
        for template in scan_catalog(&root) {
            let Some(dbv) = template.dbv.as_ref() else { continue };
            let dir = root
                .join(LOCAL_NAMESPACE)
                .join(&template.name)
                .join(&template.version)
                .join("template");
            let contenido: String = walk(&dir)
                .into_iter()
                .filter_map(|file| fs::read_to_string(file).ok())
                .collect();

            for field in &dbv.fields {
                assert!(
                    contenido.contains(&format!("{{{{{}}}}}", field.key)),
                    "el campo '{}' de {} no aparece en ningún fichero de la plantilla",
                    field.key,
                    template.name
                );
            }
        }
    }

    fn walk(dir: &Path) -> Vec<PathBuf> {
        let Ok(entries) = fs::read_dir(dir) else {
            return Vec::new();
        };
        let mut found = Vec::new();
        for entry in entries.filter_map(|entry| entry.ok()) {
            let path = entry.path();
            if path.is_dir() {
                found.extend(walk(&path));
            } else {
                found.push(path);
            }
        }
        found
    }

    #[test]
    fn substitute_in_tree_solo_toca_los_ficheros_de_texto_del_proyecto() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("chapters")).unwrap();
        fs::write(dir.path().join("main.typ"), "= {{titulo}}").unwrap();
        fs::write(dir.path().join("chapters/01.typ"), "Autor: {{autor}}").unwrap();
        fs::write(dir.path().join("logo.png"), [0x89, 0x50, 0x4e, 0x47]).unwrap();

        substitute_in_tree(dir.path(), &values(&[("titulo", "Tesis"), ("autor", "David")])).unwrap();

        assert_eq!(fs::read_to_string(dir.path().join("main.typ")).unwrap(), "= Tesis");
        assert_eq!(
            fs::read_to_string(dir.path().join("chapters/01.typ")).unwrap(),
            "Autor: David"
        );
        assert_eq!(fs::read(dir.path().join("logo.png")).unwrap(), [0x89, 0x50, 0x4e, 0x47]);
    }
}
