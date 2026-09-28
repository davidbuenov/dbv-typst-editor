// =============================================================================
// DBV Typst Editor — Modelo de Proyecto
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La unidad de trabajo es un proyecto (SPECIFICATIONS.md §4, ARCHITECTURE.md
// §7.5), no un fichero suelto. Dos reglas de este módulo son restricciones
// congeladas, no detalles de implementación:
//
//   · R-MVP-3 — el manifiesto `settings/dbv-project.toml` es OPCIONAL. Abrir un
//     repositorio Git clonado o un proyecto Typst ajeno debe funcionar igual de
//     bien, y NINGUNA operación de apertura puede escribir el manifiesto por su
//     cuenta. Solo lo escriben acciones explícitas: `create_project`
//     (asistente) y marcar el documento principal (RF-83).
//   · Un `.typ` suelto es un proyecto de un solo fichero, no un caso degradado.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::commands::file_io::{has_extension, path_to_string, write_atomic, TYPST_EXTENSIONS};
use crate::error::AppError;

/// Ruta del manifiesto propio de DBV, relativa a la raíz del proyecto.
pub const MANIFEST_RELATIVE_PATH: &str = "settings/dbv-project.toml";

/// Nombre preferido del documento principal cuando existe.
const PREFERRED_ENTRYPOINT: &str = "main.typ";

/// Manifiesto mínimo que se crea al marcar el principal en un proyecto que no
/// lo tenía (RF-83.1). Los comentarios explican el fichero a quien lo vea
/// aparecer en `git status` (RF-83.7).
const MANIFEST_TEMPLATE: &str = "\
# Manifiesto de DBV Typst Editor. Otras aplicaciones lo ignoran.
# Guarda el documento principal del proyecto: súbelo a git para que viaje con él.
";

/// De dónde sale el documento principal de un proyecto abierto (RF-83.3).
pub const ENTRYPOINT_FROM_MANIFEST: &str = "manifest";
pub const ENTRYPOINT_FROM_HEURISTIC: &str = "heuristic";

/// Metadatos que Typst no conoce y que sí interesan a DBV: de qué plantilla
/// salió el proyecto y con qué valores se rellenó su formulario. Nunca
/// metadatos de compilación — esos son responsabilidad exclusiva de Typst.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ProjectManifest {
    #[serde(default)]
    pub template_id: Option<String>,
    #[serde(default)]
    pub template_version: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub entrypoint: Option<String>,
    /// Valores del formulario del asistente, tal cual se sustituyeron.
    #[serde(default)]
    pub fields: BTreeMap<String, String>,
}

/// Un proyecto abierto, tal como lo ve el frontend.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    /// Carpeta raíz del proyecto (para un `.typ` suelto, su carpeta contenedora).
    pub root: String,
    /// Nombre legible que se muestra en la barra de título y en Recientes.
    pub name: String,
    /// Documento que se compila por defecto, si se pudo determinar.
    pub entrypoint: Option<String>,
    /// True si se abrió un `.typ` suelto en vez de una carpeta.
    pub is_single_file: bool,
    /// True si el proyecto trae manifiesto DBV. Su ausencia NO degrada nada
    /// salvo los campos del asistente (R-MVP-3).
    pub has_manifest: bool,
    pub manifest: Option<ProjectManifest>,
    /// `"manifest"` si el principal lo declara el manifiesto y existe;
    /// `"heuristic"` si no (RF-83.3: el frontend aplica entonces la elección
    /// guardada en la aplicación antes que la heurística).
    pub entrypoint_source: String,
}

/// Elige el documento principal entre los `.typ` de la raíz del proyecto.
///
/// Orden de preferencia: `main.typ` → único `.typ` disponible → el primero por
/// orden alfabético insensible a mayúsculas. Función pura, sin acceso a disco:
/// es la regla que decide qué compila la app al abrir un proyecto ajeno, así
/// que conviene poder fijarla con tests en vez de con una prueba manual.
pub fn pick_entrypoint(file_names: &[String]) -> Option<String> {
    let mut typst_files: Vec<&String> = file_names
        .iter()
        .filter(|name| has_extension(name, &TYPST_EXTENSIONS))
        .collect();
    typst_files.sort_by_key(|name| name.to_lowercase());

    let preferred = typst_files
        .iter()
        .find(|name| name.eq_ignore_ascii_case(PREFERRED_ENTRYPOINT))
        .or_else(|| typst_files.first())
        .map(|name| (*name).clone());
    preferred
}

/// Convierte un nombre escrito por el usuario en un nombre de carpeta seguro.
///
/// Solo ASCII alfanumérico y guiones: evita a la vez los caracteres prohibidos
/// de Windows (`<>:"/\|?*`) y las sorpresas de codificación al pasar la ruta al
/// proceso hijo `typst`. Los acentos se transliteran en lugar de eliminarse,
/// porque "Trabajo de Fin de Grado" no debe convertirse en "trabajo-de-fin-de-grado"
/// con huecos donde había tildes.
pub fn slugify(raw: &str) -> String {
    let transliterated: String = raw
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'â' | 'ã' | 'Á' | 'À' | 'Ä' | 'Â' | 'Ã' => 'a',
            'é' | 'è' | 'ë' | 'ê' | 'É' | 'È' | 'Ë' | 'Ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' | 'Í' | 'Ì' | 'Ï' | 'Î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' | 'õ' | 'Ó' | 'Ò' | 'Ö' | 'Ô' | 'Õ' => 'o',
            'ú' | 'ù' | 'ü' | 'û' | 'Ú' | 'Ù' | 'Ü' | 'Û' => 'u',
            'ñ' | 'Ñ' => 'n',
            'ç' | 'Ç' => 'c',
            other => other,
        })
        .collect();

    let mut slug = String::with_capacity(transliterated.len());
    for c in transliterated.chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c.to_ascii_lowercase());
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let cleaned = slug.trim_matches('-').to_string();
    if cleaned.is_empty() {
        "proyecto".to_string()
    } else {
        cleaned
    }
}

/// Parsea el manifiesto DBV. Un manifiesto corrupto es un error explícito, no
/// un `None` silencioso: si el usuario tiene uno, quiere que se use.
pub fn parse_manifest(raw: &str) -> Result<ProjectManifest, AppError> {
    toml::from_str(raw).map_err(|error| AppError::Parse(error.to_string()))
}

/// Serializa el manifiesto. Solo lo llama `create_project` (R-MVP-3).
pub fn render_manifest(manifest: &ProjectManifest) -> Result<String, AppError> {
    toml::to_string_pretty(manifest).map_err(|error| AppError::Parse(error.to_string()))
}

/// Marca temporal ISO-8601 aproximada (UTC, segundos) sin dependencia de
/// `chrono`: el manifiesto solo necesita una fecha legible y ordenable.
fn now_iso8601() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0);
    let days = secs / 86_400;
    let time_of_day = secs % 86_400;
    let (year, month, day) = civil_from_days(days as i64);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        time_of_day / 3600,
        (time_of_day % 3600) / 60,
        time_of_day % 60
    )
}

/// Algoritmo `civil_from_days` de Howard Hinnant (dominio público): convierte
/// días desde epoch a fecha civil sin arrastrar una dependencia de calendario
/// para el único sitio de la app que necesita una fecha.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Lee el manifiesto de un proyecto si existe. `Ok(None)` cuando no lo hay: es
/// el caso normal de un proyecto ajeno, no un error (R-MVP-3).
#[tauri::command]
pub fn read_project_manifest(root: String) -> Result<Option<ProjectManifest>, AppError> {
    let manifest_path = PathBuf::from(&root).join(MANIFEST_RELATIVE_PATH);
    if !manifest_path.is_file() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&manifest_path).map_err(|error| AppError::Io(error.to_string()))?;
    let manifest = parse_manifest(&raw)?;
    Ok(Some(manifest))
}

/// Construye el `Project` a partir de una ruta, sea carpeta o `.typ` suelto.
/// No escribe nada en disco bajo ninguna circunstancia.
pub fn describe(path: &Path) -> Result<Project, AppError> {
    if path.is_file() {
        return describe_single_file(path);
    }
    if !path.is_dir() {
        return Err(AppError::NotFound(path_to_string(path)));
    }

    // `dunce::canonicalize`, no `fs::canonicalize`: en Windows este último
    // devuelve el prefijo de longitud extendida `\\?\`, que el sidecar `typst`
    // no resuelve bien como `--root` ("os error 2" al compilar).
    let root = dunce::canonicalize(path).map_err(|error| AppError::Io(error.to_string()))?;
    let file_names: Vec<String> = fs::read_dir(&root)
        .map_err(|error| AppError::Io(error.to_string()))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().map(|kind| kind.is_file()).unwrap_or(false))
        .map(|entry| entry.file_name().to_string_lossy().to_string())
        .collect();

    let manifest = read_project_manifest(path_to_string(&root))?;
    // El manifiesto puede fijar un entrypoint distinto del heurístico (por
    // ejemplo `tesis.typ`); si lo trae, manda sobre la heurística. Viene de un
    // fichero del proyecto (quizá de un repositorio ajeno): se valida igual
    // que cuando lo escribe la app.
    let declared = manifest
        .as_ref()
        .and_then(|m| m.entrypoint.clone())
        .filter(|name| validate_entrypoint(&root, name).is_ok());
    let entrypoint_source =
        if declared.is_some() { ENTRYPOINT_FROM_MANIFEST } else { ENTRYPOINT_FROM_HEURISTIC };
    let entrypoint = declared.or_else(|| pick_entrypoint(&file_names));

    let project = Project {
        name: root
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| path_to_string(&root)),
        root: path_to_string(&root),
        entrypoint,
        is_single_file: false,
        has_manifest: manifest.is_some(),
        manifest,
        entrypoint_source: entrypoint_source.to_string(),
    };
    Ok(project)
}

/// Un `.typ` suelto: la raíz es su carpeta y él mismo es el entrypoint. No se
/// busca ni se escribe manifiesto — abrir el `.typ` de otra persona no puede
/// tener efectos secundarios en su carpeta.
fn describe_single_file(path: &Path) -> Result<Project, AppError> {
    if !has_extension(&path.to_string_lossy(), &TYPST_EXTENSIONS) {
        return Err(AppError::InvalidPath(path_to_string(path)));
    }
    let canonical = dunce::canonicalize(path).map_err(|error| AppError::Io(error.to_string()))?;
    let file_name = canonical
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "documento.typ".to_string());

    let project = Project {
        root: canonical.parent().map(path_to_string).unwrap_or_default(),
        name: file_name.clone(),
        entrypoint: Some(file_name),
        is_single_file: true,
        has_manifest: false,
        manifest: None,
        entrypoint_source: ENTRYPOINT_FROM_HEURISTIC.to_string(),
    };
    Ok(project)
}

/// Abre un proyecto (carpeta) o un documento suelto (`.typ`).
#[tauri::command]
pub fn open_project(path: String) -> Result<Project, AppError> {
    describe(Path::new(&path))
}

/// Escribe el manifiesto DBV de un proyecto recién creado (asistente de
/// creación, acción explícita del usuario). Para cambiar el principal de un
/// proyecto existente se usa `set_project_entrypoint`, que conserva el resto.
pub fn write_manifest(root: &Path, manifest: &ProjectManifest) -> Result<(), AppError> {
    let settings_dir = root.join("settings");
    fs::create_dir_all(&settings_dir).map_err(|error| AppError::Io(error.to_string()))?;
    let rendered = render_manifest(manifest)?;
    fs::write(root.join(MANIFEST_RELATIVE_PATH), rendered)
        .map_err(|error| AppError::Io(error.to_string()))?;
    Ok(())
}

/// ¿Es una ruta relativa que no sale del proyecto? Mismo criterio que
/// `isSafeRelativePath` del frontend (RF-83.6): ni absoluta (`/…`, `\…`,
/// `C:…`) ni con un componente `..`.
fn is_safe_relative_path(value: &str) -> bool {
    let bytes = value.as_bytes();
    let starts_absolute = value.starts_with(['/', '\\'])
        || (bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':');
    let escapes = value.split(['/', '\\']).any(|part| part == "..");
    !value.is_empty() && !starts_absolute && !escapes
}

/// Comprueba que `entrypoint` puede ser el documento principal de `root`
/// (RF-83.6): relativa y confinada, `.typ`, existente y, resuelta (enlaces
/// simbólicos incluidos), dentro del proyecto.
pub fn validate_entrypoint(root: &Path, entrypoint: &str) -> Result<(), AppError> {
    if !is_safe_relative_path(entrypoint) || !has_extension(entrypoint, &TYPST_EXTENSIONS) {
        return Err(AppError::InvalidPath(entrypoint.to_string()));
    }
    let target = root.join(entrypoint);
    if !target.is_file() {
        return Err(AppError::NotFound(entrypoint.to_string()));
    }
    let canonical_root = dunce::canonicalize(root).map_err(|error| AppError::Io(error.to_string()))?;
    let canonical = dunce::canonicalize(&target).map_err(|error| AppError::Io(error.to_string()))?;
    if !canonical.starts_with(&canonical_root) {
        return Err(AppError::Denied(entrypoint.to_string()));
    }
    Ok(())
}

/// Cambia (o quita, con `None`) SOLO la clave `entrypoint` de un manifiesto,
/// conservando el resto del texto: comentarios, orden y demás claves (RF-83.2).
/// Un manifiesto que no es TOML válido es un error: no se pisa lo del usuario.
pub fn edit_manifest_entrypoint(raw: &str, entrypoint: Option<&str>) -> Result<String, AppError> {
    let mut document = raw
        .parse::<toml_edit::Document>()
        .map_err(|error| AppError::Parse(error.to_string()))?;
    match entrypoint {
        Some(value) => document["entrypoint"] = toml_edit::value(value),
        None => {
            document.remove("entrypoint");
        }
    }
    Ok(document.to_string())
}

/// Escribe en el manifiesto el principal `entrypoint` (o lo quita con `None`).
/// Si no existía, parte de la plantilla mínima. `settings` como fichero, o una
/// carpeta en la que no se puede escribir, es un error: el frontend recuerda
/// entonces la elección solo en este equipo (RF-83.4).
fn update_manifest_file(root: &Path, entrypoint: Option<&str>) -> Result<ProjectManifest, AppError> {
    let settings_dir = root.join("settings");
    if settings_dir.exists() && !settings_dir.is_dir() {
        return Err(AppError::Denied(path_to_string(&settings_dir)));
    }
    let manifest_path = root.join(MANIFEST_RELATIVE_PATH);
    // Uno nuevo lleva la cabecera explicativa delante: `toml_edit` dejaría los
    // comentarios de un documento sin claves al final.
    let edited = if manifest_path.is_file() {
        let raw = fs::read_to_string(&manifest_path).map_err(|error| AppError::Io(error.to_string()))?;
        edit_manifest_entrypoint(&raw, entrypoint)?
    } else {
        format!("{MANIFEST_TEMPLATE}{}", edit_manifest_entrypoint("", entrypoint)?)
    };
    let manifest = parse_manifest(&edited)?;
    fs::create_dir_all(&settings_dir).map_err(|error| AppError::Io(error.to_string()))?;
    write_atomic(&manifest_path, &edited).map_err(|error| AppError::Io(error.to_string()))?;
    Ok(manifest)
}

/// Fija el documento principal en el manifiesto del proyecto (RF-83). Es una
/// acción explícita del usuario («Establecer como documento principal», o
/// renombrar/mover el principal desde el árbol), así que cumple R-MVP-3. Si el
/// manifiesto no existe, se crea, también en proyectos que no creó DBV.
#[tauri::command]
pub fn set_project_entrypoint(root: String, entrypoint: String) -> Result<ProjectManifest, AppError> {
    let root = Path::new(&root);
    validate_entrypoint(root, &entrypoint)?;
    update_manifest_file(root, Some(&entrypoint))
}

/// Quita `entrypoint` del manifiesto (el principal se eliminó, RF-83.5). Sin
/// manifiesto no hay nada que quitar, y no se crea uno.
#[tauri::command]
pub fn clear_project_entrypoint(root: String) -> Result<(), AppError> {
    let root = Path::new(&root);
    if root.join(MANIFEST_RELATIVE_PATH).is_file() {
        update_manifest_file(root, None)?;
    }
    Ok(())
}

/// Manifiesto inicial para un proyecto creado por el asistente.
pub fn new_manifest(
    template_id: &str,
    template_version: &str,
    entrypoint: &str,
    fields: BTreeMap<String, String>,
) -> ProjectManifest {
    ProjectManifest {
        template_id: Some(template_id.to_string()),
        template_version: Some(template_version.to_string()),
        created_at: Some(now_iso8601()),
        entrypoint: Some(entrypoint.to_string()),
        fields,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(list: &[&str]) -> Vec<String> {
        list.iter().map(|name| name.to_string()).collect()
    }

    #[test]
    fn pick_entrypoint_prefiere_main_typ() {
        let candidates = names(&["anexo.typ", "main.typ", "refs.bib"]);
        assert_eq!(pick_entrypoint(&candidates), Some("main.typ".into()));
    }

    #[test]
    fn pick_entrypoint_usa_el_unico_typ_disponible() {
        let candidates = names(&["tesis.typ", "refs.bib", "README.md"]);
        assert_eq!(pick_entrypoint(&candidates), Some("tesis.typ".into()));
    }

    #[test]
    fn pick_entrypoint_desempata_alfabeticamente_sin_main() {
        let candidates = names(&["zeta.typ", "alfa.typ"]);
        assert_eq!(pick_entrypoint(&candidates), Some("alfa.typ".into()));
    }

    #[test]
    fn pick_entrypoint_sin_typ_devuelve_none() {
        assert_eq!(pick_entrypoint(&names(&["refs.bib", "logo.png"])), None);
    }

    #[test]
    fn slugify_translitera_acentos_y_normaliza_separadores() {
        assert_eq!(slugify("Mi TFG de Ingeniería"), "mi-tfg-de-ingenieria");
        assert_eq!(slugify("  Año   académico  "), "ano-academico");
        assert_eq!(slugify("a/b\\c:d"), "a-b-c-d");
    }

    #[test]
    fn slugify_nunca_devuelve_cadena_vacia() {
        assert_eq!(slugify(""), "proyecto");
        assert_eq!(slugify("///"), "proyecto");
    }

    #[test]
    fn parse_manifest_lee_campos_y_formulario() {
        let raw = r#"
template_id = "tfg"
template_version = "0.1.0"
entrypoint = "main.typ"

[fields]
titulo = "Mi trabajo"
autor = "David"
"#;
        let manifest = parse_manifest(raw).unwrap();
        assert_eq!(manifest.template_id.as_deref(), Some("tfg"));
        assert_eq!(manifest.fields.get("autor").map(String::as_str), Some("David"));
    }

    #[test]
    fn parse_manifest_de_toml_invalido_es_error_de_parseo() {
        assert!(matches!(parse_manifest("esto no es toml ="), Err(AppError::Parse(_))));
    }

    #[test]
    fn parse_manifest_tolera_un_manifiesto_vacio() {
        let manifest = parse_manifest("").unwrap();
        assert_eq!(manifest, ProjectManifest::default());
    }

    #[test]
    fn render_y_parse_del_manifiesto_son_simetricos() {
        let mut fields = BTreeMap::new();
        fields.insert("titulo".to_string(), "Mi TFG".to_string());
        let original = new_manifest("tfg", "0.1.0", "main.typ", fields);

        let rendered = render_manifest(&original).unwrap();
        assert_eq!(parse_manifest(&rendered).unwrap(), original);
    }

    #[test]
    fn describe_de_carpeta_sin_manifiesto_funciona_igual_de_bien() {
        // R-MVP-3: un proyecto ajeno (repo clonado) se abre sin manifiesto...
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), "= Hola").unwrap();
        fs::create_dir_all(dir.path().join(".git")).unwrap();

        let project = describe(dir.path()).unwrap();
        assert_eq!(project.entrypoint.as_deref(), Some("main.typ"));
        assert!(!project.has_manifest);
        assert!(!project.is_single_file);
        // ...y abrirlo no puede haber escrito nada.
        assert!(!dir.path().join(MANIFEST_RELATIVE_PATH).exists());
    }

    #[test]
    fn describe_lee_el_manifiesto_cuando_existe() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), "= Hola").unwrap();
        fs::write(dir.path().join("tesis.typ"), "= Tesis").unwrap();
        fs::create_dir_all(dir.path().join("settings")).unwrap();
        fs::write(
            dir.path().join(MANIFEST_RELATIVE_PATH),
            "template_id = \"tfg\"\nentrypoint = \"tesis.typ\"\n",
        )
        .unwrap();

        let project = describe(dir.path()).unwrap();
        assert!(project.has_manifest);
        // El entrypoint del manifiesto manda sobre la preferencia por main.typ.
        assert_eq!(project.entrypoint.as_deref(), Some("tesis.typ"));
    }

    #[test]
    fn describe_de_typ_suelto_es_un_proyecto_de_un_fichero() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("apuntes.typ");
        fs::write(&file, "= Apuntes").unwrap();

        let project = describe(&file).unwrap();
        assert!(project.is_single_file);
        assert_eq!(project.entrypoint.as_deref(), Some("apuntes.typ"));
        assert_eq!(project.name, "apuntes.typ");
    }

    #[test]
    fn describe_rechaza_un_fichero_que_no_es_typst() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("notas.md");
        fs::write(&file, "# no").unwrap();
        assert!(matches!(describe(&file), Err(AppError::InvalidPath(_))));
    }

    #[test]
    fn describe_de_ruta_inexistente_es_notfound() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("no-existe");
        assert!(matches!(describe(&missing), Err(AppError::NotFound(_))));
    }

    #[test]
    fn write_manifest_crea_settings_y_es_releible() {
        let dir = tempfile::tempdir().unwrap();
        let manifest = new_manifest("cv", "0.1.0", "main.typ", BTreeMap::new());

        write_manifest(dir.path(), &manifest).unwrap();
        let read_back = read_project_manifest(path_to_string(dir.path())).unwrap();
        assert_eq!(read_back, Some(manifest));
    }

    #[test]
    fn now_iso8601_tiene_forma_de_fecha_utc() {
        let stamp = now_iso8601();
        assert_eq!(stamp.len(), 20, "formato inesperado: {stamp}");
        assert!(stamp.ends_with('Z'));
        assert!(stamp.starts_with("20"));
    }

    #[test]
    fn set_project_entrypoint_gana_a_la_heuristica_alfabetica() {
        // El caso real que lo motivó: sin `main.typ`, un proyecto con
        // "CexsTasks.typ" e "IP.typ" elegía el primero por orden alfabético,
        // aunque el documento real del usuario fuera "IP.typ".
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("CexsTasks.typ"), "= Tareas").unwrap();
        fs::write(dir.path().join("IP.typ"), "= IP").unwrap();
        let before = describe(dir.path()).unwrap();
        assert_eq!(before.entrypoint.as_deref(), Some("CexsTasks.typ"));
        assert_eq!(before.entrypoint_source, ENTRYPOINT_FROM_HEURISTIC);

        set_project_entrypoint(path_to_string(dir.path()), "IP.typ".to_string()).unwrap();

        let after = describe(dir.path()).unwrap();
        assert_eq!(after.entrypoint.as_deref(), Some("IP.typ"));
        assert_eq!(after.entrypoint_source, ENTRYPOINT_FROM_MANIFEST);
        let raw = fs::read_to_string(dir.path().join(MANIFEST_RELATIVE_PATH)).unwrap();
        assert!(raw.starts_with("# Manifiesto de DBV Typst Editor"), "{raw}");
    }

    #[test]
    fn set_project_entrypoint_conserva_el_resto_del_manifiesto() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), "= Hola").unwrap();
        fs::write(dir.path().join("tesis.typ"), "= Tesis").unwrap();
        let mut fields = BTreeMap::new();
        fields.insert("titulo".to_string(), "Mi TFG".to_string());
        write_manifest(dir.path(), &new_manifest("tfg", "0.1.0", "main.typ", fields)).unwrap();

        let updated =
            set_project_entrypoint(path_to_string(dir.path()), "tesis.typ".to_string()).unwrap();

        assert_eq!(updated.entrypoint.as_deref(), Some("tesis.typ"));
        assert_eq!(updated.template_id.as_deref(), Some("tfg"));
        assert_eq!(updated.fields.get("titulo").map(String::as_str), Some("Mi TFG"));
    }

    #[test]
    fn set_project_entrypoint_conserva_comentarios_y_claves_escritos_a_mano() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("cap")).unwrap();
        fs::write(dir.path().join("cap/libro.typ"), "= Libro").unwrap();
        fs::create_dir_all(dir.path().join("settings")).unwrap();
        let original = "# Escrito a mano\ntemplate_id = \"propia\" # mi plantilla\nentrypoint = \"viejo.typ\"\n\n[fields]\n# autor del libro\nautor = \"David\"\n";
        fs::write(dir.path().join(MANIFEST_RELATIVE_PATH), original).unwrap();

        set_project_entrypoint(path_to_string(dir.path()), "cap/libro.typ".to_string()).unwrap();

        let raw = fs::read_to_string(dir.path().join(MANIFEST_RELATIVE_PATH)).unwrap();
        assert_eq!(raw, original.replace("viejo.typ", "cap/libro.typ"));
    }

    #[test]
    fn set_project_entrypoint_rechaza_rutas_que_no_valen() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), "= Hola").unwrap();
        fs::write(dir.path().join("notas.md"), "# notas").unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("fuera.typ"), "= Fuera").unwrap();
        let root = path_to_string(dir.path());
        let absolute = path_to_string(&outside.path().join("fuera.typ"));

        for bad in ["../fuera.typ", "cap/../../fuera.typ", "/main.typ", "\\main.typ", "C:main.typ", "", "notas.md"] {
            let result = set_project_entrypoint(root.clone(), bad.to_string());
            assert!(matches!(result, Err(AppError::InvalidPath(_))), "{bad}: {result:?}");
        }
        assert!(matches!(set_project_entrypoint(root.clone(), absolute), Err(AppError::InvalidPath(_))));
        assert!(matches!(
            set_project_entrypoint(root, "no-existe.typ".to_string()),
            Err(AppError::NotFound(_))
        ));
        assert!(!dir.path().join("settings").exists(), "un rechazo no debe crear nada");
    }

    #[test]
    fn set_project_entrypoint_con_settings_como_fichero_devuelve_error() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), "= Hola").unwrap();
        fs::write(dir.path().join("settings"), "no soy una carpeta").unwrap();

        let result = set_project_entrypoint(path_to_string(dir.path()), "main.typ".to_string());

        assert!(matches!(result, Err(AppError::Denied(_))), "{result:?}");
        assert_eq!(fs::read_to_string(dir.path().join("settings")).unwrap(), "no soy una carpeta");
    }

    #[test]
    fn set_project_entrypoint_no_pisa_un_manifiesto_roto() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), "= Hola").unwrap();
        fs::create_dir_all(dir.path().join("settings")).unwrap();
        fs::write(dir.path().join(MANIFEST_RELATIVE_PATH), "esto no = = es toml").unwrap();

        let result = set_project_entrypoint(path_to_string(dir.path()), "main.typ".to_string());

        assert!(matches!(result, Err(AppError::Parse(_))));
        assert_eq!(fs::read_to_string(dir.path().join(MANIFEST_RELATIVE_PATH)).unwrap(), "esto no = = es toml");
    }

    #[test]
    fn clear_project_entrypoint_quita_solo_esa_clave_y_no_crea_manifiesto() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), "= Hola").unwrap();
        clear_project_entrypoint(path_to_string(dir.path())).unwrap();
        assert!(!dir.path().join("settings").exists());

        fs::create_dir_all(dir.path().join("settings")).unwrap();
        fs::write(dir.path().join(MANIFEST_RELATIVE_PATH), "# hola\ntemplate_id = \"x\"\nentrypoint = \"main.typ\"\n").unwrap();
        clear_project_entrypoint(path_to_string(dir.path())).unwrap();
        let raw = fs::read_to_string(dir.path().join(MANIFEST_RELATIVE_PATH)).unwrap();
        assert_eq!(raw, "# hola\ntemplate_id = \"x\"\n");
    }

    #[test]
    fn describe_ignora_un_principal_del_manifiesto_que_sale_del_proyecto() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("proyecto/settings")).unwrap();
        fs::write(dir.path().join("fuera.typ"), "= Fuera").unwrap();
        fs::write(dir.path().join("proyecto/main.typ"), "= Hola").unwrap();
        fs::write(dir.path().join("proyecto").join(MANIFEST_RELATIVE_PATH), "entrypoint = \"../fuera.typ\"\n").unwrap();

        let project = describe(&dir.path().join("proyecto")).unwrap();

        assert_eq!(project.entrypoint.as_deref(), Some("main.typ"));
        assert_eq!(project.entrypoint_source, ENTRYPOINT_FROM_HEURISTIC);
    }
}
