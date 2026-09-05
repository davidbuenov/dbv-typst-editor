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

fn describe(error: &typst_engine::TypstError) -> String {
    match error {
        typst_engine::TypstError::SidecarUnavailable(message)
        | typst_engine::TypstError::ExecutionFailed(message)
        | typst_engine::TypstError::PreviewExpired(message) => message.clone(),
        typst_engine::TypstError::CompilationFailed { stderr, .. } => stderr.clone(),
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
}
