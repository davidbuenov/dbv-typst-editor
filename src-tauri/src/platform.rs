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
    let mut parts: Vec<String> = extra
        .into_iter()
        .filter(|p| p.is_dir())
        .map(|p| p.to_string_lossy().into_owned())
        .collect();

    if let Ok(current) = std::env::var("PATH") {
        parts.push(current);
    }

    if !parts.is_empty() {
        // SAFETY: Invocado al inicio del proceso antes de iniciar hilos de trabajo.
        unsafe {
            std::env::set_var("PATH", parts.join(sep));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
