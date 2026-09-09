// =============================================================================
// DBV Typst Editor — Plantillas de Typst Universe (Beta, ARCHITECTURE.md §7.6.3)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Crear un proyecto desde una plantilla de la comunidad es el MISMO comando que
// desde una plantilla curada de DBV (`templates.rs`), cambiando el namespace:
// `@local/dbv-tfg:1.0.0` con `--package-path` → `@preview/charged-ieee:0.1.4`
// sin él. Verificado contra el binario real antes de escribir esto: el CLI
// descarga el paquete, lo cachea y genera el proyecto sin más intervención.
//
// Diferencia de producto respecto al catálogo propio, y hay que decirla: una
// plantilla de Universe NO trae `dbv-template.toml`, así que no tiene formulario
// — el asistente solo pide nombre y ubicación, y el documento se rellena a mano
// después. Es la degradación limpia que ya preveía el diseño ("sin overlay, solo
// scaffolding"), no una carencia de esta implementación.
//
// Seguridad: es código de terceros que se descarga y ejecuta en la máquina del
// usuario. La política acordada (decisión editorial del usuario, no técnica) es
// lista curada + campo libre para quien sepa lo que pega; este módulo no filtra
// nada por su cuenta, la curación vive en el catálogo del frontend.

use std::path::{Path, PathBuf};
use std::{collections::BTreeMap, fs};

use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

use crate::error::AppError;
use crate::project::{self, Project};
use crate::templates::PROJECT_DIRS;
use crate::typst_engine;

/// Namespace público del registro oficial de Typst.
const PREVIEW_NAMESPACE: &str = "preview";

/// Identificador de paquete de Universe ya validado.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UniverseSpec {
    pub namespace: String,
    pub name: String,
    pub version: String,
}

impl UniverseSpec {
    /// Vuelve a la forma canónica que entiende el CLI.
    pub fn to_spec(&self) -> String {
        format!("@{}/{}:{}", self.namespace, self.name, self.version)
    }
}

/// Valida un identificador `@preview/nombre:version` escrito por el usuario.
///
/// Función pura y estricta a propósito: lo que entre aquí acaba siendo un
/// argumento de un proceso hijo. No basta con que "parezca" un identificador —
/// se comprueba forma, namespace y que ni nombre ni versión traigan separadores
/// de ruta o caracteres que no correspondan.
pub fn parse_universe_spec(raw: &str) -> Result<UniverseSpec, AppError> {
    let trimmed = raw.trim();
    let rest = trimmed
        .strip_prefix('@')
        .ok_or_else(|| AppError::InvalidPath(format!("Un identificador debe empezar por '@': {trimmed}")))?;

    let (namespace, remainder) = rest
        .split_once('/')
        .ok_or_else(|| AppError::InvalidPath(format!("Falta el namespace, p. ej. @preview/nombre:version: {trimmed}")))?;
    let (name, version) = remainder
        .split_once(':')
        .ok_or_else(|| AppError::InvalidPath(format!("Falta la versión, p. ej. @preview/nombre:0.1.0: {trimmed}")))?;

    // Solo el registro público oficial: `@local` es el de las plantillas
    // propias (y necesita `--package-path`, otro camino distinto).
    if namespace != PREVIEW_NAMESPACE {
        return Err(AppError::InvalidPath(format!(
            "Solo se admite el namespace @{PREVIEW_NAMESPACE}: {trimmed}"
        )));
    }

    let name_ok = !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if !name_ok {
        return Err(AppError::InvalidPath(format!("Nombre de paquete no válido: {name}")));
    }

    let version_ok = !version.is_empty()
        && version.split('.').count() == 3
        && version.split('.').all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()));
    if !version_ok {
        return Err(AppError::InvalidPath(format!(
            "La versión debe ser X.Y.Z con números: {version}"
        )));
    }

    Ok(UniverseSpec {
        namespace: namespace.to_string(),
        name: name.to_string(),
        version: version.to_string(),
    })
}

/// Crea un proyecto desde una plantilla de Typst Universe.
///
/// Mismo orden de operaciones que `templates::create_project` salvo la
/// sustitución de marcadores, que aquí no aplica (no hay `dbv-template.toml`
/// del que sacar campos).
#[tauri::command]
pub async fn create_project_from_universe(
    app: AppHandle,
    spec: String,
    parent_dir: String,
    project_name: String,
) -> Result<Project, AppError> {
    let parsed = parse_universe_spec(&spec)?;

    let folder = project::slugify(&project_name);
    let target = PathBuf::from(&parent_dir).join(&folder);

    if target.exists() {
        return Err(AppError::Denied(
            crate::commands::file_io::path_to_string(&target),
        ));
    }
    if !Path::new(&parent_dir).is_dir() {
        return Err(AppError::InvalidPath(parent_dir));
    }

    let canonical = parsed.to_spec();
    let target_str = target.to_string_lossy().to_string();
    let args: Vec<&str> = vec!["init", &canonical, &target_str];

    typst_engine::run(&app, &args)
        .await
        .map_err(|error| AppError::Io(describe(&error)))?;

    for dir in PROJECT_DIRS {
        let _ = fs::create_dir_all(target.join(dir));
    }

    let entrypoint = project::describe(&target)?
        .entrypoint
        .unwrap_or_else(|| "main.typ".to_string());
    // El manifiesto deja constancia de la plantilla de origen, igual que con
    // las curadas: sin él, un proyecto creado desde Universe sería
    // indistinguible de una carpeta cualquiera.
    let manifest = project::new_manifest(
        &format!("@{}/{}", parsed.namespace, parsed.name),
        &parsed.version,
        &entrypoint,
        BTreeMap::new(),
    );
    project::write_manifest(&target, &manifest)?;

    project::describe(&target)
}

/// `typst init` sobre un paquete que no es plantilla falla con un mensaje
/// estable, comprobado contra el binario vendorizado antes de escribir esto:
///
/// ```text
/// error: package @preview/cetz:0.3.1 is not a template
/// ```
///
/// Se traduce a su propio `kind` en vez de dejar pasar el error crudo, porque es
/// el caso que el usuario va a encontrarse de verdad: `parse_universe_spec`
/// valida la FORMA del identificador, no que sea una plantilla, así que
/// `@preview/cetz:0.3.1` pasa la validación entera y solo falla aquí.
fn classify_init_error(spec: &str, error: &typst_engine::TypstError) -> AppError {
    let message = describe(error);
    if message.contains("is not a template") {
        AppError::NotATemplate(spec.to_string())
    } else {
        AppError::Io(message)
    }
}

/// Previsualiza una plantilla de Typst Universe sin dejar nada en el disco del
/// usuario ni crear proyecto alguno.
///
/// Existe por una decisión de producto explícita (RF-26.6, `SPECIFICATIONS.md`
/// §5d): en la pestaña de identificador libre de la galería **no se descarga ni
/// se ejecuta nada al teclear**, solo cuando el usuario pulsa un control que
/// declara que va a hacerlo. Descargar y ejecutar código de terceros por el mero
/// hecho de escribir en un campo contradiría la política editorial de
/// `ARCHITECTURE.md` §6.
///
/// El beneficio que no era el objetivo pero acaba siendo el principal: convierte
/// el fallo de "esto no es una plantilla" en un mensaje dentro de la galería,
/// junto al campo, en lugar de aparecer tres pasos después con el usuario ya
/// eligiendo carpeta y nombre en el asistente.
#[tauri::command]
pub async fn preview_universe_template(app: AppHandle, spec: String) -> Result<String, AppError> {
    // El identificador NO viaja crudo hasta el disco: se reconstruye desde sus
    // partes ya validadas, igual que en `open_universe_package_page` y por el
    // mismo motivo — lo que no pasa la validación tampoco puede colarse aquí
    // como fragmento de ruta.
    let parsed = parse_universe_spec(&spec)?;
    let canonical = parsed.to_spec();

    // `TempDir` borra el árbol entero al soltarse, salga esta función por donde
    // salga: no hay ningún camino de error que deje basura en `%TEMP%`, y no
    // hace falta repetir la limpieza en cada `?`.
    let workdir = tempfile::tempdir().map_err(|error| AppError::Io(error.to_string()))?;
    // `typst init` crea el directorio destino, así que se le da uno que todavía
    // no existe dentro del temporal.
    let target = workdir.path().join("preview");
    let target_str = crate::commands::file_io::path_to_string(&target);

    typst_engine::run(&app, &["init", &canonical, &target_str])
        .await
        .map_err(|error| classify_init_error(&canonical, &error))?;

    // Una plantilla de Universe no trae manifiesto de DBV; `describe` cae a su
    // heurística de entrypoint, que es justo lo que hace `create_project_from_universe`.
    let entrypoint = project::describe(&target)?
        .entrypoint
        .unwrap_or_else(|| "main.typ".to_string());

    let output = workdir.path().join("preview.svg");
    let mut args: Vec<String> = vec![
        "compile".to_string(),
        "--root".to_string(),
        target_str.clone(),
        "--format".to_string(),
        "svg".to_string(),
        // Solo la primera página: es una previsualización de la maquetación, no
        // el documento. Una plantilla de artículo puede traer varias.
        "--pages".to_string(),
        "1".to_string(),
    ];
    args.extend(typst_engine::font_path_args(&target));
    args.push(crate::commands::file_io::path_to_string(&target.join(&entrypoint)));
    args.push(crate::commands::file_io::path_to_string(&output));

    let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
    typst_engine::run(&app, &borrowed)
        .await
        .map_err(|error| AppError::Io(describe(&error)))?;

    fs::read_to_string(&output).map_err(|error| AppError::Io(error.to_string()))
}

/// Abre la ficha de un paquete/plantilla en typst.app/universe con el
/// navegador del sistema, para quien quiera leer su documentación o revisar
/// el código antes de fiarse — sin que ese clic dispare también la
/// instalación, que es lo que hace el resto de la tarjeta.
///
/// Reutiliza `parse_universe_spec` para construir la URL en vez de aceptar el
/// nombre suelto desde el frontend: así un identificador que no pasa la
/// validación tampoco puede colarse aquí como fragmento de URL.
// `Shell::open` está marcado deprecado en favor de `tauri-plugin-opener`, pero
// no arrastrar una dependencia nueva solo para un `open()` cuando ya está
// `tauri-plugin-shell` en el árbol (Cargo.toml, requisito del sidecar) es la
// decisión correcta aquí: sigue funcionando en 2.x y no hay plan de retirarlo.
#[allow(deprecated)]
#[tauri::command]
pub fn open_universe_package_page(app: AppHandle, spec: String) -> Result<(), AppError> {
    let parsed = parse_universe_spec(&spec)?;
    let url = format!("https://typst.app/universe/package/{}", parsed.name);
    app.shell()
        .open(url, None)
        .map_err(|error| AppError::Io(error.to_string()))
}

fn describe(error: &typst_engine::TypstError) -> String {
    match error {
        typst_engine::TypstError::SidecarUnavailable(message)
        | typst_engine::TypstError::ExecutionFailed(message)
        | typst_engine::TypstError::PreviewExpired(message) => message.clone(),
        typst_engine::TypstError::CompilationFailed(stderr) => stderr.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_acepta_un_identificador_real_de_universe() {
        // Verificado contra el registro real: existe y es la última versión.
        let spec = parse_universe_spec("@preview/charged-ieee:0.1.4").unwrap();
        assert_eq!(spec.name, "charged-ieee");
        assert_eq!(spec.version, "0.1.4");
        assert_eq!(spec.to_spec(), "@preview/charged-ieee:0.1.4");
    }

    #[test]
    fn parse_tolera_espacios_alrededor() {
        assert!(parse_universe_spec("  @preview/cetz:0.5.2  ").is_ok());
    }

    #[test]
    fn parse_rechaza_lo_que_no_es_un_identificador() {
        for entrada in [
            "preview/cetz:0.5.2",   // sin @
            "@preview/cetz",        // sin versión
            "@cetz:0.5.2",          // sin namespace
            "@local/dbv-tfg:1.0.0", // namespace propio, va por otro camino
            "@preview/cetz:0.5",    // versión incompleta
            "@preview/cetz:x.y.z",  // versión no numérica
            "",
        ] {
            assert!(
                parse_universe_spec(entrada).is_err(),
                "debería rechazarse: {entrada}"
            );
        }
    }

    #[test]
    fn parse_rechaza_intentos_de_salirse_por_la_ruta() {
        // Lo que entra aquí acaba siendo argumento de un proceso hijo: un
        // nombre con separadores de ruta no puede llegar nunca al CLI.
        for entrada in [
            "@preview/../../etc/passwd:1.0.0",
            "@preview/cetz/../otro:1.0.0",
            "@preview/ce tz:1.0.0",
            "@preview/cetz:1.0.0/../..",
        ] {
            assert!(
                parse_universe_spec(entrada).is_err(),
                "debería rechazarse: {entrada}"
            );
        }
    }

    // El mensaje contra el que se compara está copiado de una ejecución real del
    // binario vendorizado (`typst init @preview/cetz:0.3.1`), no inventado: si
    // Typst lo cambia, este test es el que avisa antes que el usuario.
    #[test]
    fn classify_reconoce_el_paquete_que_no_es_una_plantilla() {
        let error = typst_engine::TypstError::CompilationFailed(
            "error: package @preview/cetz:0.3.1 is not a template\n".to_string(),
        );
        let clasificado = classify_init_error("@preview/cetz:0.3.1", &error);
        assert_eq!(
            clasificado,
            AppError::NotATemplate("@preview/cetz:0.3.1".to_string())
        );
    }

    // Un fallo de red no debe disfrazarse de "no es una plantilla": el usuario
    // que está sin conexión necesita saber que el problema es la descarga, no su
    // identificador.
    #[test]
    fn classify_no_confunde_otros_fallos_con_una_plantilla_ausente() {
        let error = typst_engine::TypstError::CompilationFailed(
            "error: failed to download package (network unreachable)".to_string(),
        );
        let clasificado = classify_init_error("@preview/charged-ieee:0.1.4", &error);
        assert!(matches!(clasificado, AppError::Io(_)));
    }

    // Lo que llega al disco es la forma canónica reconstruida desde las partes
    // validadas, nunca la cadena que escribió el usuario. Es la misma garantía
    // que protege a `open_universe_package_page`.
    #[test]
    fn la_previsualizacion_usa_el_identificador_reconstruido_no_el_crudo() {
        let parsed = parse_universe_spec("  @preview/charged-ieee:0.1.4  ").unwrap();
        assert_eq!(parsed.to_spec(), "@preview/charged-ieee:0.1.4");
    }
}
