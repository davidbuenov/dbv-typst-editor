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
pub mod assets;
pub mod bibliography;
pub mod commands;
pub mod error;
pub mod project;
pub mod templates;
pub mod typst_engine;
pub mod watcher;

#[cfg(desktop)]
use tauri::{Emitter, Manager};

/// Arranca la aplicación. Invocado desde `main.rs`.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Instancia única (Beta) — mismo patrón que DBV Markdown Reader
    // (ARCHITECTURE.md, "solo desktop": el plugin no existe en móvil). Debe
    // registrarse ANTES que el resto de plugins, tal como exige su propia
    // documentación, para que la comprobación de instancia ya existente
    // ocurra antes de que arranque nada más. Un segundo lanzamiento (doble
    // clic en otro `.typ` con la app ya abierta) no crea un proceso nuevo:
    // enfoca la ventana existente y le pide abrir el documento nuevo.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        if let Some(document) = commands::startup::first_document_argument(argv) {
            let _ = app.emit("open-document", document);
        }
    }));

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(watcher::WatcherState::default())
        .manage(typst_engine::compile::EngineState::default())
        .invoke_handler(tauri::generate_handler![
            archive::export_project_archive,
            archive::import_project_archive,
            archive::pick_archive_dialog,
            assets::copy_asset_into_project,
            assets::pick_image_dialog,
            bibliography::bibliography_keys,
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
            typst_engine::compile::typst_export_png,
            typst_engine::compile::typst_preview_page,
            typst_engine::outline::typst_outline,
            typst_engine::typst_run_raw,
            typst_engine::typst_version,
            watcher::unwatch_project,
            watcher::watch_project,
        ])
        .run(tauri::generate_context!())
        .expect("error al arrancar la aplicación DBV Typst Editor");
}
