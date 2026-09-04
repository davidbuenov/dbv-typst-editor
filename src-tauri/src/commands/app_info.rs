// =============================================================================
// DBV Typst Editor — Comando `app_info`
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

use serde::Serialize;

/// Información básica de la aplicación expuesta al frontend.
#[derive(Debug, Clone, Serialize)]
pub struct AppInfo {
    pub version: String,
    pub platform: String,
}

/// Identificador de la plataforma en la que corre el binario.
///
/// Función pura y sin dependencias de Tauri, para poder testearla sin un
/// `AppHandle` real — el patrón de tests heredado de DBV Markdown Reader
/// (ARCHITECTURE.md §3 fila 10).
pub fn platform_name() -> &'static str {
    let name = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "unknown"
    };
    name
}

/// Devuelve versión y plataforma. Es el "hola mundo" del puente Tauri↔frontend
/// que valida el criterio de aceptación del Slice 1.
#[tauri::command]
pub fn app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: platform_name().to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn platform_name_devuelve_un_identificador_conocido() {
        let name = platform_name();
        assert!(
            ["windows", "linux", "macos", "unknown"].contains(&name),
            "identificador de plataforma inesperado: {name}"
        );
    }

    #[test]
    fn app_info_expone_la_version_del_paquete() {
        let info = app_info();
        assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
        assert!(!info.platform.is_empty());
    }
}
