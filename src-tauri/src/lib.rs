// =============================================================================
// DBV Typst Editor — Orquestación de la aplicación Tauri
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Este fichero se limita a registrar plugins, estado y comandos. Toda la lógica
// vive en submódulos (ARCHITECTURE.md §7.4) — decisión consciente frente al
// monolito de DBV Markdown Reader.

pub mod commands;

/// Arranca la aplicación. Invocado desde `main.rs`.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![commands::app_info::app_info])
        .run(tauri::generate_context!())
        .expect("error al arrancar la aplicación DBV Typst Editor");
}
