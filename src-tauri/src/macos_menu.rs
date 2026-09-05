// =============================================================================
// DBV Typst Editor — Menú nativo de macOS (Beta)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Todo este fichero es exclusivo de macOS (`#![cfg(target_os = "macos")]` a
// nivel de módulo, no solo de función): Tauri v2 no trae menú de aplicación
// por defecto fuera de Windows/Linux, que ya tienen su propia UI de ventana
// para Cortar/Copiar/Pegar y para cerrar/minimizar — sin uno propio en macOS
// no hay `Cmd+Q`, `Cmd+H` ni el `Edit` del sistema (`NATIVE_DESKTOP_APPS.md`
// §6 punto 10, mismo patrón ya usado en DBV Markdown Reader).
//
// Mismo mecanismo documentado ahí: los ítems propios (no los predefinidos del
// sistema, que el propio SO localiza solo) reemiten un evento normal
// (`app.emit("menu-save", ())`) que el frontend escucha con `listen()` — la
// lógica de cada acción sigue viviendo en JS, una sola vez, no se duplica en
// Rust. Localización a mano vía `sys-locale` para esos ítems propios.
//
// Atajos: solo los estándar universales de macOS (Cmd+N/O/S/Shift+S/W/Q/Z...)
// — ninguno de ellos coincide con los atajos de la barra de inserción del
// editor (Mod-b/i/e/k/Shift-1/2/3, RF-13), comprobado a propósito para que un
// acelerador de menú no capture silenciosamente una combinación que el
// editor ya usa (un acelerador de menú de macOS se resuelve a nivel de
// sistema, antes de que la tecla llegue al DOM — si colisionaran, el atajo
// del editor dejaría de funcionar sin ningún error visible).
//
// ⚠️ Sin verificar por compilación: no hay toolchain de macOS disponible en
// esta sesión (Windows), y `cargo check --target x86_64-apple-darwin` falla
// por falta de un enlazador de macOS, no solo de SDK. Escrito con la mayor
// fidelidad posible contra el código fuente vendorizado de la propia crate
// `tauri` 2.11.5 (`menu::builders`, `menu::predefined`) en vez de contra
// memoria — pero sigue siendo la primera pieza de esta sesión que no pasa por
// el binario/compilador real antes de darse por buena.

use tauri::menu::{MenuItemBuilder, SubmenuBuilder};
use tauri::{App, AppHandle, Emitter, Runtime};

fn is_spanish() -> bool {
    sys_locale::get_locale()
        .map(|locale| locale.to_lowercase().starts_with("es"))
        .unwrap_or(false)
}

/// Reemite un clic de un ítem propio del menú como evento de ventana — el
/// frontend ya tiene toda la lógica detrás de cada botón equivalente, así que
/// aquí no hay más que "avisar del clic" (`NATIVE_DESKTOP_APPS.md` §6.10).
/// `on_menu_event` entrega un `&AppHandle<R>`, no un `&App<R>` — tipo distinto
/// al que recibe `setup()`, aunque ambos implementan `Emitter`.
fn forward<R: Runtime>(app: &AppHandle<R>, event_name: &'static str) {
    let _ = app.emit(event_name, ());
}

/// Construye y registra el menú de aplicación nativo. Llamar una sola vez
/// desde `.setup()`, nunca desde `.plugin()` — no es un plugin de Tauri.
pub fn setup<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let es = is_spanish();

    let app_menu = SubmenuBuilder::new(app, "DBV Typst Editor")
        .about(None)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(app, if es { "Archivo" } else { "File" })
        .item(
            &MenuItemBuilder::with_id(
                "menu-new-project",
                if es { "Nuevo proyecto…" } else { "New Project…" },
            )
            .accelerator("Cmd+N")
            .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(
                "menu-open-folder",
                if es { "Abrir carpeta de proyecto…" } else { "Open Project Folder…" },
            )
            .accelerator("Cmd+O")
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(
                "menu-open-file",
                if es { "Abrir documento .typ…" } else { "Open .typ Document…" },
            )
            .accelerator("Cmd+Shift+O")
            .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("menu-save", if es { "Guardar" } else { "Save" })
                .accelerator("Cmd+S")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(
                "menu-save-as",
                if es { "Guardar como…" } else { "Save As…" },
            )
            .accelerator("Cmd+Shift+S")
            .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(
                "menu-export-pdf",
                if es { "Exportar PDF…" } else { "Export PDF…" },
            )
            .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(
                "menu-reveal",
                if es { "Mostrar en el Finder" } else { "Show in Finder" },
            )
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(
                "menu-close-project",
                if es { "Cerrar proyecto" } else { "Close Project" },
            )
            .accelerator("Cmd+W")
            .build(app)?,
        )
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, if es { "Edición" } else { "Edit" })
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, if es { "Vista" } else { "View" })
        .item(
            &MenuItemBuilder::with_id(
                "menu-toggle-theme",
                if es { "Cambiar tema claro/oscuro" } else { "Toggle Light/Dark Theme" },
            )
            .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(
                "menu-outline",
                if es { "Esquema del documento" } else { "Document Outline" },
            )
            .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(
                "menu-terminal",
                if es { "Terminal avanzado" } else { "Advanced Terminal" },
            )
            .build(app)?,
        )
        .build()?;

    let window_menu = SubmenuBuilder::new(app, if es { "Ventana" } else { "Window" })
        .minimize()
        .build()?;

    let menu = tauri::menu::Menu::new(app)?;
    menu.append_items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu])?;
    app.set_menu(menu)?;

    app.on_menu_event(move |app, event| {
        let id = event.id().0.as_str();
        match id {
            "menu-new-project" => forward(app, "menu-new-project"),
            "menu-open-folder" => forward(app, "menu-open-folder"),
            "menu-open-file" => forward(app, "menu-open-file"),
            "menu-save" => forward(app, "menu-save"),
            "menu-save-as" => forward(app, "menu-save-as"),
            "menu-export-pdf" => forward(app, "menu-export-pdf"),
            "menu-reveal" => forward(app, "menu-reveal"),
            "menu-close-project" => forward(app, "menu-close-project"),
            "menu-toggle-theme" => forward(app, "menu-toggle-theme"),
            "menu-outline" => forward(app, "menu-outline"),
            "menu-terminal" => forward(app, "menu-terminal"),
            _ => {}
        }
    });

    Ok(())
}
