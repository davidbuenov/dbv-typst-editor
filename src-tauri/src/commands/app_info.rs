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

/// Función pura para poder testearla sin un ejecutable real. Detecta si el
/// binario en ejecución vive bajo `...\WindowsApps\...` — la ruta en la que
/// Windows instala siempre un paquete MSIX (Microsoft Store), sea cual sea su
/// nombre — mismo mecanismo que `dbv-md-reader` (`src-tauri/src/lib.rs`).
pub fn is_packaged_path(exe_path: &std::path::Path) -> bool {
    exe_path.components().any(|component| {
        component
            .as_os_str()
            .to_str()
            .is_some_and(|name| name.eq_ignore_ascii_case("WindowsApps"))
    })
}

/// Beta, panel "Acerca de": distingue una instalación de Microsoft Store (que
/// se actualiza sola) de una instalación manual. **No** activa ningún
/// auto-actualizador — `memory.md` fija esa regla explícitamente: la clave de
/// firma la genera el usuario en su propio terminal, nunca la IA
/// (`UPGRADE_PROMPT.md` §4) — esto solo decide qué texto mostrar.
#[tauri::command]
pub fn is_packaged_app() -> bool {
    std::env::current_exe()
        .map(|path| is_packaged_path(&path))
        .unwrap_or(false)
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

    // `Path::components()` solo trocea por `\` en Windows: en Linux/macOS toda
    // esta cadena es un único componente literal y ninguna de las dos
    // aserciones de abajo probaría lo que dicen probar. La CI (`ubuntu-22.04`)
    // nunca había corrido antes del primer `/ship` — este `#[cfg]` es la
    // corrección de ese primer fallo real, no un cambio de comportamiento.
    #[cfg(target_os = "windows")]
    #[test]
    fn is_packaged_path_detecta_una_instalacion_de_microsoft_store() {
        assert!(is_packaged_path(std::path::Path::new(
            r"C:\Program Files\WindowsApps\DBVTypstEditor_1.0.0.0_x64__abc123\dbv-typst-editor.exe"
        )));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn is_packaged_path_no_confunde_una_instalacion_manual() {
        assert!(!is_packaged_path(std::path::Path::new(
            r"C:\Program Files\DBV Typst Editor\dbv-typst-editor.exe"
        )));
    }
}
