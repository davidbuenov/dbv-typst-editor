// =============================================================================
// DBV Typst Editor — Comando `app_info`
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

use crate::error::AppError;

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

/// Abre `url` con el navegador del sistema — usado por los enlaces de
/// documentación externa del panel de Ayuda (RF-52.1: un enlace a la
/// documentación original tras la explicación de cada asistente, p. ej.
/// Graphviz para el asistente de DOT, petición directa del usuario). Las
/// URLs que llegan aquí están escritas a mano en `help/helpContent.js`,
/// nunca compuestas a partir de una entrada de usuario — aun así se exige
/// el esquema `https://` antes de pasarlas al shell del sistema: no confiar
/// ciegamente en el propio frontend a través del puente IPC, mismo criterio
/// que ya aplica `open_universe_package_page` (`universe.rs`) validando el
/// identificador antes de construir su URL.
/// Solo `https://` — descarta `javascript:`/`file:`/`http://` sin cifrar.
/// Función pura para poder testearla sin un `AppHandle` real.
fn is_allowed_doc_url(url: &str) -> bool {
    url.starts_with("https://")
}

// `Shell::open` está marcado deprecado en favor de `tauri-plugin-opener`,
// mismo motivo que en `universe.rs` para no arrastrar una dependencia nueva.
#[allow(deprecated)]
#[tauri::command]
pub fn open_external_url(app: AppHandle, url: String) -> Result<(), AppError> {
    if !is_allowed_doc_url(&url) {
        return Err(AppError::Denied(format!("esquema de URL no permitido: {url}")));
    }
    app.shell()
        .open(url, None)
        .map_err(|error| AppError::Io(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Sin `AppHandle` real no se puede probar la rama de éxito de
    // `open_external_url` (abriría de verdad el navegador) — pero el
    // rechazo de esquema es una función pura por delante de esa llamada, y
    // es la parte que de verdad importa testear (evita `javascript:`/
    // `file:`/`http://` sin cifrar si algún día una URL dejara de estar
    // escrita a mano en `helpContent.js`).
    #[test]
    fn is_allowed_doc_url_exige_https() {
        assert!(is_allowed_doc_url("https://graphviz.org/documentation/"));
        assert!(!is_allowed_doc_url("http://graphviz.org/documentation/"));
        assert!(!is_allowed_doc_url("javascript:alert(1)"));
        assert!(!is_allowed_doc_url("file:///etc/passwd"));
    }

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
