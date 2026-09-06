// =============================================================================
// DBV Typst Editor — Motor Typst (gestión del proceso sidecar)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Única frontera con el compilador Typst (ARCHITECTURE.md §7.2): todo el resto
// de la aplicación habla con este módulo, nunca directamente con el binario.
// Aislar aquí la construcción de comandos y el parseo de salida es lo que
// permite absorber cambios de flags entre versiones del CLI sin tocar el resto.
//
// El sidecar se invoca SIEMPRE desde Rust, nunca desde el frontend: así el
// WebView no necesita permisos de shell (principio de menor privilegio) y toda
// ejecución pasa por comandos nuestros, validados.

pub mod compile;
pub mod outline;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

/// Nombre del sidecar declarado en `tauri.conf.json` (`bundle.externalBin`).
pub(crate) const SIDECAR: &str = "typst";

/// Error tipado del motor. Cruza el puente IPC hacia el frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum TypstError {
    /// El binario no está disponible (falta el vendorizado previo al build).
    SidecarUnavailable(String),
    /// El proceso arrancó pero no se pudo completar su ejecución.
    ExecutionFailed(String),
    /// El proceso terminó con un código de salida distinto de cero. Solo
    /// lleva el `stderr` (el código de salida no lo consume nadie, ni aquí ni
    /// en el frontend) — a propósito: con dos campos, `#[serde(tag =
    /// "kind", content = "message")]` serializaba `message` como un OBJETO
    /// `{code, stderr}` en vez de una cadena, y `normalizeError()` del
    /// frontend (`services/backend.js`), que asume `message: string` para
    /// TODA variante, lo convertía en el literal `"[object Object]"` — el
    /// error que veía el usuario en cualquier fallo real de compilación, en
    /// vez del texto de Typst. Un único campo mantiene la garantía "el
    /// mensaje siempre es una cadena" para las cuatro variantes del enum.
    CompilationFailed(String),
    /// Se pidió una página de una vista previa ya sustituida por otra más
    /// reciente. No es un fallo: el frontend espera a la compilación nueva.
    PreviewExpired(String),
}

/// Salida completa de una invocación del CLI.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypstOutput {
    pub stdout: String,
    pub stderr: String,
}

/// Ejecuta el sidecar con los argumentos dados y devuelve su salida de texto.
///
/// Falla de forma tipada si el binario no está, si no se puede ejecutar, o si
/// termina con un código distinto de cero — nunca con un `panic` ni con un
/// booleano mágico.
pub async fn run(app: &AppHandle, args: &[&str]) -> Result<TypstOutput, TypstError> {
    let command = app
        .shell()
        .sidecar(SIDECAR)
        .map_err(|error| TypstError::SidecarUnavailable(error.to_string()))?;

    let output = command
        .args(args)
        .output()
        .await
        .map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let result = if output.status.success() {
        Ok(TypstOutput { stdout, stderr })
    } else {
        Err(TypstError::CompilationFailed(stderr))
    };
    result
}

/// Salida completa de un comando de terminal avanzado (Beta, §7.14).
///
/// A diferencia de `run()`, conserva `stdout` aunque el proceso termine con un
/// código de salida distinto de cero: un usuario que teclea `typst fonts` a
/// mano quiere ver lo que salió, no solo un error genérico.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutput {
    pub stdout: String,
    pub stderr: String,
    pub code: Option<i32>,
}

/// Ejecuta un subcomando arbitrario del sidecar `typst` (Beta, terminal
/// avanzado, §7.14) — vía de escape explícita para quien prefiera trabajar con
/// comandos, no sustituye a ningún flujo guiado de la app.
///
/// `args` ya llega troceado: "sin lógica adicional de parseo" es literal en el
/// diseño (§7.14) — el frontend separa por espacios, sin intentar entender
/// comillas ni variables de entorno. Sigue sin haber superficie de inyección
/// nueva: los argumentos van a `Command::args()` como array, nunca a un
/// intérprete de shell — es el mismo binario vendorizado que ya ejecutan
/// compile/export/outline, con argumentos que el propio usuario escribe para
/// su propio proyecto.
#[tauri::command]
pub async fn typst_run_raw(app: AppHandle, args: Vec<String>) -> Result<TerminalOutput, TypstError> {
    let command = app
        .shell()
        .sidecar(SIDECAR)
        .map_err(|error| TypstError::SidecarUnavailable(error.to_string()))?;

    let output = command
        .args(args)
        .output()
        .await
        .map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;

    Ok(TerminalOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        code: output.status.code(),
    })
}

/// Extrae el número de versión de la salida de `typst --version`.
///
/// Función pura, testeable sin `AppHandle` ni binario real — el patrón de
/// tests heredado de DBV Markdown Reader (ARCHITECTURE.md §3 fila 10).
/// Entrada esperada: `"typst 0.15.1 (9dfd3a08)"` → `"0.15.1"`.
pub fn parse_version(raw: &str) -> Option<String> {
    let version = raw
        .split_whitespace()
        .nth(1)
        .filter(|token| token.chars().next().is_some_and(|c| c.is_ascii_digit()))
        .map(str::to_string);
    version
}

/// Carpeta de fuentes propias de un proyecto, relativa a su raíz.
pub const PROJECT_FONTS_DIR: &str = "fonts";

/// Argumentos `--font-path` para un proyecto que trae sus propias fuentes.
///
/// Un proyecto compartido (el de un compañero, un repositorio clonado, un
/// `.dbvt` importado) sólo se compone igual en otra máquina si las fuentes
/// viajan con él: instalarlas a mano en el sistema es justo la fricción que
/// este producto existe para quitar, y además no siempre es posible (aulas,
/// equipos sin permisos de administrador). Si el proyecto tiene una carpeta
/// `fonts/`, se le pasa al compilador y sus fuentes quedan disponibles para
/// ese documento y sólo para él.
///
/// Verificado contra el binario real (0.15.1) antes de implementarlo, porque
/// de la ayuda del CLI dependía todo el diseño: `--font-path` **añade**
/// directorios —no sustituye a las del sistema, para eso está
/// `--ignore-system-fonts`—, busca de forma **recursiva**, y lo aceptan tanto
/// `compile` como `eval` (el subcomando del esquema). Comprobado también que
/// una fuente puesta ahí se encuentra de verdad.
///
/// Función pura (sólo mira el sistema de ficheros) para poder testearla sin
/// `AppHandle` ni binario, igual que `parse_version`.
pub fn font_path_args(root: &std::path::Path) -> Vec<String> {
    let dir = root.join(PROJECT_FONTS_DIR);
    if dir.is_dir() {
        vec!["--font-path".to_string(), dir.to_string_lossy().to_string()]
    } else {
        Vec::new()
    }
}

/// Versión del compilador Typst embebido en la aplicación.
#[tauri::command]
pub async fn typst_version(app: AppHandle) -> Result<String, TypstError> {
    // Un fallo del sidecar solo se vería en el DOM si no se traza aquí: en un
    // WebView sin DevTools abiertos eso es invisible, y en CI directamente no
    // existe. Se emite a stderr para que quede en el log del proceso.
    let output = run(&app, &["--version"]).await.inspect_err(|error| {
        eprintln!("[typst_engine] fallo al invocar el sidecar: {error:?}");
    })?;

    let version = parse_version(&output.stdout).unwrap_or_else(|| output.stdout.trim().to_string());
    Ok(version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_version_extrae_el_numero_de_la_salida_real_del_cli() {
        assert_eq!(parse_version("typst 0.15.1 (9dfd3a08)"), Some("0.15.1".into()));
    }

    #[test]
    fn parse_version_tolera_espacios_y_saltos_de_linea() {
        assert_eq!(parse_version("  typst 0.15.1 (9dfd3a08)\n"), Some("0.15.1".into()));
    }

    #[test]
    fn parse_version_devuelve_none_si_el_formato_no_es_el_esperado() {
        assert_eq!(parse_version(""), None);
        assert_eq!(parse_version("typst"), None);
        assert_eq!(parse_version("error: algo ha ido mal"), None);
    }

    #[test]
    fn font_path_args_pasa_la_carpeta_del_proyecto_si_existe() {
        let dir = tempfile::tempdir().unwrap();
        let fonts = dir.path().join(PROJECT_FONTS_DIR);
        std::fs::create_dir(&fonts).unwrap();

        let args = font_path_args(dir.path());
        assert_eq!(args.len(), 2);
        assert_eq!(args[0], "--font-path");
        assert_eq!(std::path::Path::new(&args[1]), fonts);
    }

    #[test]
    fn font_path_args_no_pasa_nada_si_el_proyecto_no_trae_fuentes() {
        let dir = tempfile::tempdir().unwrap();
        assert!(font_path_args(dir.path()).is_empty());
    }

    #[test]
    fn font_path_args_ignora_un_fichero_llamado_fonts() {
        // Un `fonts` que no sea carpeta no debe generar un `--font-path` que
        // haría fallar al compilador.
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(PROJECT_FONTS_DIR), "no soy una carpeta").unwrap();
        assert!(font_path_args(dir.path()).is_empty());
    }
}
