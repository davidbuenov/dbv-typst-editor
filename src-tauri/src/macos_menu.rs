// =============================================================================
// DBV Typst Editor — Menú nativo de macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Exclusivo de macOS (`#[cfg(target_os = "macos")]` en `lib.rs`): Tauri v2 no trae
// menú de aplicación fuera de Windows/Linux, y sin uno propio no hay `Cmd+Q`,
// `Cmd+H` ni el `Edit` del sistema (`NATIVE_DESKTOP_APPS.md` §6 punto 10).
//
// RF-125 (0.15.1): Archivo, Herramientas y Preferencias ya no se escriben aquí. Los
// describe el DOM de la cabecera (`nativeMenuDom.js` → `set_native_menu`), se sanean en
// `native_menu.rs` y se pintan aquí como submenús `nm:<id>`. Un clic en una de esas
// entradas emite `menu-item` con su id y la webview pulsa el botón de ese id: ninguna
// acción se reimplementa en Rust.
//
// Hasta que llega la descripción (arranque), queda un menú de respaldo con un File
// mínimo para que ⌘N, ⌘O y ⌘S funcionen desde el primer instante (RF-125.9). Sus
// entradas reemiten los eventos `menu-*` de siempre, que `main.js` sigue escuchando,
// igual que el menú Vista, que no tiene equivalente en la cabecera.
//
// Los aceleradores de las entradas propias se resuelven a nivel de sistema, antes
// de que la tecla llegue al DOM: un test de Vitest (`nativeMenu.test.js`) comprueba
// que ninguno pisa un atajo del editor (`APP_SHORTCUTS`).

use tauri::menu::{
    CheckMenuItem, Menu, MenuItem, MenuItemBuilder, MenuItemKind, PredefinedMenuItem, Submenu,
    SubmenuBuilder,
};
use tauri::{App, AppHandle, Emitter, Manager, Runtime};

use crate::native_menu::{NativeItem, NativeMenuDef, NativeMenuSpec, NativeMenuState};

/// Prefijo de las entradas que describe el DOM.
const DOM_PREFIX: &str = "nm:";
/// «Ajustes… ⌘,» del menú de la aplicación (RF-125.8).
const SETTINGS_ID: &str = "menu-settings";
/// Ventana única de la aplicación.
const MAIN_WINDOW: &str = "main";

fn is_spanish() -> bool {
    sys_locale::get_locale()
        .map(|locale| locale.to_lowercase().starts_with("es"))
        .unwrap_or(false)
}

/// Construye y registra el menú de arranque. Llamar una sola vez desde `.setup()`.
pub fn setup<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let menu = build_with(app.handle(), None)?;
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| on_menu_event(app, event.id().0.as_str()));
    Ok(())
}

/// Reparte un clic del menú: entradas del DOM, «Ajustes…» o el menú de respaldo.
fn on_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    if let Some(dom_id) = id.strip_prefix(DOM_PREFIX) {
        let _ = app.emit_to(MAIN_WINDOW, "menu-item", dom_id.to_string());
        return;
    }
    if id == SETTINGS_ID {
        popup_preferences(app);
        return;
    }
    const FORWARDED: [&str; 13] = [
        "menu-new-project",
        "menu-new-document",
        "menu-open-folder",
        "menu-open-file",
        "menu-save",
        "menu-save-as",
        "menu-export-pdf",
        "menu-reveal",
        "menu-close-tab",
        "menu-close-project",
        "menu-toggle-theme",
        "menu-outline",
        "menu-terminal",
    ];
    if let Some(name) = FORWARDED.iter().find(|name| **name == id) {
        let _ = app.emit_to(MAIN_WINDOW, name, ());
    }
}

/// Una entrada del DOM con su acelerador; si Tauri no entiende el atajo, sale sin él (RF-125.10).
fn entry_from<R: Runtime>(handle: &AppHandle<R>, item: &NativeItem) -> tauri::Result<MenuItemKind<R>> {
    if item.kind == "sep" {
        return Ok(MenuItemKind::Predefined(PredefinedMenuItem::separator(handle)?));
    }
    let id = format!("{DOM_PREFIX}{}", item.id);
    let accel = item.accel.as_deref();
    Ok(if item.kind == "check" {
        MenuItemKind::Check(
            CheckMenuItem::with_id(handle, id.clone(), &item.label, item.enabled, item.checked, accel)
                .or_else(|_| CheckMenuItem::with_id(handle, id, &item.label, item.enabled, item.checked, None::<&str>))?,
        )
    } else {
        MenuItemKind::MenuItem(
            MenuItem::with_id(handle, id.clone(), &item.label, item.enabled, accel)
                .or_else(|_| MenuItem::with_id(handle, id, &item.label, item.enabled, None::<&str>))?,
        )
    })
}

/// Submenú `nm:<id>` con las entradas de la descripción (RF-125.2).
fn submenu_from<R: Runtime>(handle: &AppHandle<R>, def: &NativeMenuDef) -> tauri::Result<Submenu<R>> {
    let submenu = Submenu::with_id(handle, format!("{DOM_PREFIX}{}", def.id), &def.title, true)?;
    for item in &def.items {
        submenu.append(&entry_from(handle, item)?)?;
    }
    Ok(submenu)
}

/// Actualiza marcado y habilitado de las entradas YA creadas, sin reconstruir el menú (RF-125.5).
pub fn update_in_place<R: Runtime>(handle: &AppHandle<R>, spec: &NativeMenuSpec) {
    let Some(menu) = handle.menu() else { return };
    for def in &spec.menus {
        let Some(MenuItemKind::Submenu(submenu)) = menu.get(&format!("{DOM_PREFIX}{}", def.id)) else { continue };
        for item in def.items.iter().filter(|i| i.kind != "sep") {
            match submenu.get(&format!("{DOM_PREFIX}{}", item.id)) {
                Some(MenuItemKind::Check(check)) => {
                    let _ = check.set_enabled(item.enabled);
                    let _ = check.set_checked(item.checked);
                }
                Some(MenuItemKind::MenuItem(entry)) => {
                    let _ = entry.set_enabled(item.enabled);
                }
                _ => {}
            }
        }
    }
}

/// «Ajustes… ⌘,»: despliega Preferencias junto al puntero (RF-125.8). Se construye un
/// menú NUEVO con la última descripción en vez de reutilizar el submenú de la barra,
/// para no dar dos padres a un mismo `NSMenu`. Los ids son los mismos (`nm:prefs:*`),
/// así que el clic llega por el camino de siempre.
fn popup_preferences<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<NativeMenuState>();
    let Ok(guard) = state.0.lock() else { return };
    let Some(def) = guard.as_ref().and_then(|p| p.spec.menus.iter().find(|m| m.id == "prefs")).cloned() else {
        return;
    };
    drop(guard);
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else { return };
    let Ok(menu) = Menu::new(app) else { return };
    for item in &def.items {
        match entry_from(app, item) {
            Ok(entry) => {
                let _ = menu.append(&entry);
            }
            Err(_) => return,
        }
    }
    let _ = window.popup_menu(&menu);
}

/// Menú completo. Sin `spec` (arranque), el de respaldo; con ella, Archivo sustituye al
/// File de respaldo y Herramientas y Preferencias se intercalan entre Vista y Ventana.
pub fn build_with<R: Runtime>(handle: &AppHandle<R>, spec: Option<&NativeMenuSpec>) -> tauri::Result<Menu<R>> {
    let es = is_spanish();
    let def = |id: &str| spec.and_then(|s| s.menus.iter().find(|m| m.id == id));

    let settings = MenuItemBuilder::with_id(SETTINGS_ID, if es { "Ajustes…" } else { "Settings…" })
        .accelerator("Cmd+,")
        .enabled(def("prefs").is_some())
        .build(handle)?;
    let app_menu = SubmenuBuilder::new(handle, "DBV Typst Editor")
        .about(None)
        .separator()
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file_menu = match def("file") {
        Some(file) => submenu_from(handle, file)?,
        None => fallback_file_menu(handle, es)?,
    };

    let edit_menu = SubmenuBuilder::new(handle, if es { "Edición" } else { "Edit" })
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(handle, if es { "Vista" } else { "View" })
        .item(&MenuItemBuilder::with_id("menu-toggle-theme", if es { "Cambiar tema claro/oscuro" } else { "Toggle Light/Dark Theme" }).build(handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("menu-outline", if es { "Esquema del documento" } else { "Document Outline" }).build(handle)?)
        .item(&MenuItemBuilder::with_id("menu-terminal", if es { "Terminal avanzado" } else { "Advanced Terminal" }).build(handle)?)
        .build()?;

    let tools_menu = def("tools").map(|d| submenu_from(handle, d)).transpose()?;
    let prefs_menu = def("prefs").map(|d| submenu_from(handle, d)).transpose()?;

    let window_menu = SubmenuBuilder::new(handle, if es { "Ventana" } else { "Window" }).minimize().build()?;

    let menu = Menu::new(handle)?;
    menu.append_items(&[&app_menu, &file_menu, &edit_menu, &view_menu])?;
    if let Some(tools) = &tools_menu {
        menu.append(tools)?;
    }
    if let Some(prefs) = &prefs_menu {
        menu.append(prefs)?;
    }
    menu.append(&window_menu)?;
    Ok(menu)
}

/// File de arranque, hasta que la webview publique su Archivo (RF-125.9). Mismos atajos.
fn fallback_file_menu<R: Runtime>(handle: &AppHandle<R>, es: bool) -> tauri::Result<Submenu<R>> {
    let entry = |id: &str, es_label: &str, en_label: &str, accel: Option<&str>| {
        let builder = MenuItemBuilder::with_id(id, if es { es_label } else { en_label });
        match accel {
            Some(accel) => builder.accelerator(accel).build(handle),
            None => builder.build(handle),
        }
    };
    SubmenuBuilder::new(handle, if es { "Archivo" } else { "File" })
        .item(&entry("menu-new-project", "Nuevo proyecto…", "New Project…", Some("Cmd+N"))?)
        .item(&entry("menu-new-document", "Nuevo .typ vacío…", "New Empty .typ…", Some("Cmd+Alt+N"))?)
        .separator()
        .item(&entry("menu-open-folder", "Abrir carpeta de proyecto…", "Open Project Folder…", Some("Cmd+O"))?)
        .item(&entry("menu-open-file", "Abrir documento .typ…", "Open .typ Document…", Some("Cmd+Shift+O"))?)
        .separator()
        .item(&entry("menu-save", "Guardar", "Save", Some("Cmd+S"))?)
        .item(&entry("menu-save-as", "Guardar como…", "Save As…", Some("Cmd+Shift+S"))?)
        .separator()
        .item(&entry("menu-close-tab", "Cerrar pestaña", "Close Tab", Some("Cmd+W"))?)
        .item(&entry("menu-close-project", "Cerrar proyecto", "Close Project", Some("Cmd+Shift+W"))?)
        .build()
}

/// Publica el menú que describe el frontend: misma estructura → solo marcado y
/// habilitado en sitio; otra → se reconstruye y se instala (RF-125.5).
pub fn publish<R: Runtime>(app: &AppHandle<R>, state: &NativeMenuState, spec: NativeMenuSpec) -> Result<(), String> {
    let signature = crate::native_menu::structure_signature(&spec);
    let mut current = state.0.lock().map_err(|_| "estado del menú no disponible".to_string())?;
    if current.as_ref().is_some_and(|p| p.signature == signature) {
        update_in_place(app, &spec);
    } else {
        let menu = build_with(app, Some(&spec)).map_err(|e| e.to_string())?;
        app.set_menu(menu).map_err(|e| e.to_string())?;
    }
    *current = Some(crate::native_menu::Published { signature, spec });
    Ok(())
}
