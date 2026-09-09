// =============================================================================
// DBV Typst Editor — Detección de plataforma y enriquecimiento del PATH
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cuando una aplicación de escritorio arranca en Windows/macOS desde un lanzador
// gráfico (Explorer, dock, acceso directo), hereda un PATH acotado que no siempre
// incluye herramientas instaladas mediante gestores de paquetes como WinGet,
// Scoop, Cargo o Homebrew. Esta función inyecta las rutas comunes antes de iniciar
// la aplicación para que herramientas como `typst`, `git` o `python` se localicen.

use std::path::PathBuf;

/// Añade al PATH del proceso actual las rutas estándar donde las herramientas
/// de desarrollo y gestores de paquetes instalan binarios y shims.
pub fn augment_path() {
    let extra: Vec<PathBuf> = if cfg!(windows) {
        let home = std::env::var("USERPROFILE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(r"C:\Users\Default"));
        let local = std::env::var("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home.join("AppData/Local"));
        let program_data = std::env::var("ProgramData")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(r"C:\ProgramData"));
        let program_files = std::env::var("ProgramFiles")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from(r"C:\Program Files"));

        vec![
            // Shims de winget (donde se instalan Typst, Git, etc.)
            local.join("Microsoft/WinGet/Links"),
            // Shims de Scoop
            home.join("scoop/shims"),
            // Binarios de Chocolatey
            program_data.join("chocolatey/bin"),
            // Herramientas de Cargo/Rust
            home.join(".cargo/bin"),
            // Juliaup
            home.join(".juliaup/bin"),
            // Launcher de Python (`py.exe`)
            local.join("Programs/Python/Launcher"),
            // Git para Windows
            program_files.join("Git/cmd"),
            program_files.join("Git/bin"),
            local.join("Programs/Git/cmd"),
            local.join("Programs/Git/bin"),
        ]
    } else {
        let home = std::env::var("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("/"));
        vec![
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/opt/homebrew/sbin"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/usr/local/sbin"),
            home.join(".cargo/bin"),
            home.join(".local/bin"),
        ]
    };

    let sep = if cfg!(windows) { ";" } else { ":" };
    let existentes: Vec<PathBuf> = extra.into_iter().filter(|p| p.is_dir()).collect();

    if let Some(nuevo) = compose_path(&existentes, std::env::var("PATH").ok().as_deref(), sep) {
        // SAFETY: Invocado al inicio del proceso antes de iniciar hilos de trabajo.
        unsafe {
            std::env::set_var("PATH", nuevo);
        }
    }
}

/// Decide el valor que tendrá el `PATH`, separado de la mutación global para
/// poder comprobarlo: `augment_path` mezclaba lectura de entorno, filtrado por
/// disco y escritura de una variable de proceso, y eso solo se podía probar
/// afirmando que el resultado "no está vacío".
///
/// Las rutas inyectadas van DELANTE del `PATH` actual a propósito: el objetivo
/// del módulo es que una herramienta recién instalada se reconozca aunque la
/// aplicación se abriera desde un acceso directo que no heredó el entorno.
///
/// Devuelve `None` cuando no hay nada que escribir, para no pisar el `PATH` con
/// una cadena vacía.
fn compose_path(inyectadas: &[PathBuf], actual: Option<&str>, sep: &str) -> Option<String> {
    let mut partes: Vec<String> = inyectadas
        .iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect();

    if let Some(actual) = actual {
        partes.push(actual.to_string());
    }

    if partes.is_empty() {
        None
    } else {
        Some(partes.join(sep))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compose_path_pone_las_rutas_inyectadas_por_delante() {
        // El orden es la razón de ser del módulo: una herramienta recién
        // instalada tiene que ganar al PATH heredado, no ir detrás de él.
        let inyectadas = vec![PathBuf::from("/a"), PathBuf::from("/b")];
        let resultado = compose_path(&inyectadas, Some("/usr/bin"), ":").unwrap();
        assert_eq!(resultado, "/a:/b:/usr/bin");
    }

    #[test]
    fn compose_path_funciona_sin_path_previo() {
        let inyectadas = vec![PathBuf::from("/a")];
        assert_eq!(compose_path(&inyectadas, None, ":").unwrap(), "/a");
    }

    #[test]
    fn compose_path_conserva_el_path_cuando_no_hay_nada_que_inyectar() {
        // Ninguna de las rutas candidatas existe en esta máquina: el PATH del
        // usuario debe sobrevivir intacto, no quedarse solo con lo añadido.
        assert_eq!(compose_path(&[], Some("/usr/bin"), ":").unwrap(), "/usr/bin");
    }

    #[test]
    fn compose_path_no_escribe_nada_si_no_hay_nada() {
        // Sin rutas y sin PATH previo NO se devuelve cadena vacía: escribirla
        // dejaría al proceso sin PATH ninguno.
        assert!(compose_path(&[], None, ":").is_none());
    }

    #[test]
    fn compose_path_usa_el_separador_de_windows_cuando_toca() {
        let inyectadas = vec![PathBuf::from(r"C:\bin")];
        let resultado = compose_path(&inyectadas, Some(r"C:\Windows"), ";").unwrap();
        assert!(resultado.contains(';'));
        assert!(resultado.starts_with(r"C:\bin"));
    }

    #[test]
    fn augment_path_no_vacia_el_path() {
        let original = std::env::var("PATH").unwrap_or_default();
        augment_path();
        let nuevo = std::env::var("PATH").unwrap_or_default();
        assert!(!nuevo.is_empty());
        if !original.is_empty() {
            assert!(nuevo.contains(&original));
        }
    }
}
