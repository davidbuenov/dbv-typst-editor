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

pub mod archive;
pub mod commands;
pub mod error;
pub mod project;
pub mod templates;
pub mod typst_engine;
pub mod watcher;

/// Arranca la aplicación. Invocado desde `main.rs`.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(watcher::WatcherState::default())
        .manage(typst_engine::compile::EngineState::default())
        .invoke_handler(tauri::generate_handler![
            archive::export_project_archive,
            archive::import_project_archive,
            archive::pick_archive_dialog,
            commands::app_info::app_info,
            commands::file_io::file_modified_ms,
            commands::file_io::list_directory,
            commands::file_io::open_file_dialog,
            commands::file_io::open_folder_dialog,
            commands::file_io::read_file,
            commands::file_io::reveal_in_file_manager,
            commands::file_io::save_file_dialog,
            commands::file_io::write_file,
            commands::recent_projects::add_recent_project,
            commands::recent_projects::clear_recent_projects,
            commands::recent_projects::get_recent_projects,
            commands::startup::startup_document,
            project::open_project,
            templates::create_project,
            templates::list_templates,
            project::read_project_manifest,
            typst_engine::compile::typst_cancel_preview,
            typst_engine::compile::typst_compile_preview,
            typst_engine::compile::typst_export_pdf,
            typst_engine::compile::typst_preview_page,
            typst_engine::outline::typst_outline,
            typst_engine::typst_version,
            watcher::unwatch_project,
            watcher::watch_project,
        ])
        .run(tauri::generate_context!())
        .expect("error al arrancar la aplicación DBV Typst Editor");
}
