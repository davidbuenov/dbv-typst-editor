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
#[cfg(target_os = "macos")]
pub mod macos_menu;
pub mod platform;
pub mod project;
pub mod templates;
pub mod typst_engine;
pub mod universe;
pub mod watcher;

#[cfg(desktop)]
use tauri::{Emitter, Manager};

/// Arranca la aplicación. Invocado desde `main.rs`.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    platform::augment_path();
    let builder = tauri::Builder::default();

    // Instancia única (Beta) — mismo patrón que DBV Markdown Reader
    // (ARCHITECTURE.md, "solo desktop": el plugin no existe en móvil). Debe
    // registrarse ANTES que el resto de plugins, tal como exige su propia
    // documentación, para que la comprobación de instancia ya existente
    // ocurra antes de que arranque nada más. Un segundo lanzamiento (doble
    // clic en otro `.typ` con la app ya abierta) no crea un proceso nuevo:
    // enfoca la ventana existente y le pide abrir el documento nuevo.
    //
    // Esto cubre Windows y Linux. En macOS un segundo doble clic tampoco crea
    // proceso nuevo, pero la ruta no llega por `argv` sino por Apple Event
    // (`RunEvent::Opened`, más abajo).
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

    // Auto-actualización (Beta, ADR-ACTUALIZADOR-001). Solo escritorio: el
    // plugin no existe en móvil. `process` es lo que permite reiniciar la
    // aplicación después de instalar la versión nueva.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(watcher::WatcherState::default())
        .manage(typst_engine::compile::EngineState::default())
        .manage(commands::startup::PendingDocument::default())
        .manage(commands::tinymist::TinymistState::default())
        .manage(commands::universe_index::UniverseIndexState::default())
        .setup(|_app| {
            // Menú nativo de macOS (Beta): Tauri v2 no trae uno por defecto en
            // esta plataforma, y sin él no hay Cmd+Q, Cmd+H ni el Edit del
            // sistema (NATIVE_DESKTOP_APPS.md §6.10). No es un plugin, por
            // eso se registra aquí y no arriba con `.plugin(...)`.
            #[cfg(target_os = "macos")]
            macos_menu::setup(_app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            archive::export_project_archive,
            archive::import_project_archive,
            archive::pick_archive_dialog,
            assets::copy_asset_into_project,
            assets::save_pasted_image,
            assets::copy_font_into_project,
            assets::pick_image_dialog,
            assets::project_images,
            assets::supported_asset_extensions,
            bibliography::bibliography_entries,
            bibliography::bibliography_keys,
            commands::app_info::app_info,
            commands::app_info::is_packaged_app,
            commands::file_io::file_modified_ms,
            commands::file_io::list_directory,
            commands::file_io::open_file_dialog,
            commands::file_io::open_folder_dialog,
            commands::file_io::read_file,
            commands::file_io::reveal_in_file_manager,
            commands::file_io::save_file_dialog,
            commands::file_io::write_file,
            commands::git::git_clone,
            commands::git::git_commit,
            commands::git::git_pull,
            commands::git::git_push,
            commands::git::git_status,
            commands::python_runner::check_python_status,
            commands::python_runner::execute_python_script,
            commands::python_runner::setup_shared_python_env,
            commands::recent_projects::add_recent_project,
            commands::recent_projects::clear_recent_projects,
            commands::recent_projects::get_recent_projects,
            commands::recent_projects::remove_recent_project,
            commands::startup::startup_document,
            commands::tinymist::tinymist_send_notification,
            commands::tinymist::tinymist_send_request,
            commands::tinymist::tinymist_start,
            commands::tinymist::tinymist_status,
            commands::tinymist::tinymist_stop,
            commands::universe_index::fetch_universe_index,
            project::open_project,
            templates::create_project,
            templates::list_templates,
            universe::create_project_from_universe,
            universe::preview_universe_template,
            universe::open_universe_package_page,
            project::read_project_manifest,
            typst_engine::compile::typst_cancel_preview,
            typst_engine::compile::typst_compile_preview,
            typst_engine::compile::typst_export_pdf,
            typst_engine::compile::typst_export_png,
            typst_engine::compile::typst_preview_page,
            typst_engine::outline::typst_outline,
            typst_engine::sync::typst_sync_anchors,
            typst_engine::typst_run_raw,
            typst_engine::typst_version,
            watcher::unwatch_project,
            watcher::watch_project,
        ])
        .build(tauri::generate_context!())
        .expect("error al arrancar la aplicación DBV Typst Editor")
        // `build` + bucle propio en vez de `run(context)` porque es la única
        // forma de ver `RunEvent::Opened`: el evento con el que macOS —y solo
        // macOS— entrega el fichero que el usuario ha abierto desde Finder
        // (NATIVE_DESKTOP_APPS.md §8). Sin esto la app arranca sin documento.
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                if let Some(document) = commands::startup::first_document_url(urls) {
                    commands::startup::deliver(_app, document);
                }
            }
        });
}
