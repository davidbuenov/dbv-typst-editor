# Notas de actualización v0.12.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.12.0 — Pestañas, navegación y búsqueda en todo el proyecto:

• Pestañas: cada fichero abierto tiene la suya y conserva los cambios, el cursor y el deshacer. Ctrl+W cierra, Ctrl+Tab cambia y se reordenan arrastrando. Se restauran al reabrir el proyecto.
• Ir a la definición (F12 o Ctrl+clic), buscar referencias (Mayús+F12), renombrar un símbolo en todos los ficheros (F2) y acciones de código (Ctrl+.).
• Buscar y reemplazar en todo el proyecto (Ctrl+Mayús+F), con expresiones regulares, filtros de ficheros y deshacer.
• Snippets propios en el formato de VS Code, globales o del proyecto, y «Guardar selección como snippet».
• Busca (Ctrl+F) y copia texto directamente en la vista previa.
• Todos los atajos de teclado, documentados en la Ayuda.
• El documento principal se guarda en el proyecto y se conserva en otro equipo.
• Mejor autocompletado dentro de las funciones, con ayuda de parámetros.
• Corregido: los errores aparecían subrayados en el fichero equivocado, y la vista previa cambiaba de página al ajustar el zoom.
```

### 🇬🇧 English

```text
Version 0.12.0 — Tabs, navigation and project-wide search:

• Tabs: every open file gets its own and keeps its changes, cursor and undo history. Ctrl+W closes, Ctrl+Tab switches, drag to reorder. They are restored when the project is reopened.
• Go to definition (F12 or Ctrl+click), find references (Shift+F12), rename a symbol across all files (F2) and code actions (Ctrl+.).
• Find and replace across the whole project (Ctrl+Shift+F), with regular expressions, file filters and undo.
• Your own snippets in VS Code format, global or per project, plus "Save selection as snippet".
• Find (Ctrl+F) and copy text straight from the preview.
• Every keyboard shortcut, documented in Help.
• The main document is saved in the project and kept on another computer.
• Better autocompletion inside functions, with parameter hints.
• Fixed: errors were underlined in the wrong file, and the preview jumped to another page when changing the zoom.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.12.0 (Feature Release)

WHAT'S NEW IN THIS VERSION:
- Editor tabs: each open file gets a tab that keeps its unsaved changes, cursor and undo history. Ctrl+W (or middle click) closes a tab, Ctrl+Tab / Ctrl+Shift+Tab cycle, tabs can be reordered by dragging and are restored when the project is reopened. Closing the window asks about every tab with unsaved changes.
- Code navigation and refactoring through the bundled tinymist Language Server: Go to definition (F12 or Ctrl+click), Find references (Shift+F12, listed in the new "Search" sidebar tab), Rename symbol across files (F2 in the editor) and Code actions (Ctrl+.). Changes spanning several files show "View changes" and "Undo". All edits are confined to the open project folder.
- Project-wide find and replace (Ctrl+Shift+F): match case, whole word, regular expressions and include/exclude file filters; replace one match, a file or everything, undoable in one step.
- User snippets in VS Code's JSON format (Tools menu > Edit global snippets / Edit project snippets), offered in autocompletion; "Save selection as snippet…" in the editor context menu.
- Find (Ctrl+F with focus in the preview) and copy (drag to select, Ctrl+C) text in the live preview.
- A single, complete keyboard shortcut list, generated into the Help panel.
- The chosen main document is now also stored in the project's settings/dbv-project.toml file.
- Fixes: tinymist autocompletion inside function calls (with signature help), diagnostics underlined in the wrong file, and the preview jumping to another page when zooming.

CREDENTIALS:
None required. The application is completely offline, privacy-friendly, and does not use any user accounts or authentication.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application and choose File > New blank project; create it in any folder. main.typ opens in a tab.
2. In the Files panel, hover and click "New file"; name it "chapter.typ" and click it in the tree: it opens in a second tab. Type some text, then click the main.typ tab and back: the text, cursor and undo history are kept. Press Ctrl+W to close a tab.
3. In main.typ type:  #let greet = "hello"  on one line and  #greet  on the next. Put the cursor on the second "greet" and press F12: the cursor jumps to the definition. Press F2, type "welcome" and Enter: both occurrences are renamed.
4. Press Ctrl+Shift+F, search for "welcome": matches are listed per file in the "Search" sidebar tab. Type a replacement and click "Replace all", then "Undo" in the notice.
5. Click inside the preview panel and press Ctrl+F; search for a word of the document: it is highlighted with an "n of m" counter. Drag over the text in the preview and press Ctrl+C to copy it.
6. Open Help > Keyboard shortcuts to see the full list.
(Tinymist starts a few seconds after opening a project; F12/F2 show a notice if it is still starting.)

ADDITIONAL TECHNICAL CONTEXT:
- No changes to the bundled sidecars (Typst compiler + tinymist Language Server) or to their packaging; no new capabilities are requested.
- New frontend dependency: jsonc-parser (MIT, by Microsoft) to read and edit snippet files. The Rust crates regex, walkdir and toml_edit (already in the dependency tree) are now used directly.
- Global snippets are stored in the application's configuration folder; project snippets live inside the user's project (.vscode folder), only when the user explicitly creates them.
- No background telemetry, no advertising, no tracking — consistent with all previous releases.
```

---

## 3. Checklist de verificación del paquete MSIX

Antes de subir el archivo `.msixbundle` generado a Partner Center — **sigue habiendo DOS sidecars, sin
cambios respecto a v0.5.0+** (ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6). Esta versión trae código
nuevo en el frontend y en Rust (pestañas, navegación, búsqueda, snippets, capa de texto de la vista
previa) y la dependencia npm `jsonc-parser`, pero **ningún sidecar nuevo ni cambio de empaquetado**.

- [x] Haber ejecutado `npm run vendor:typst` **y** `npm run vendor:tinymist` antes de empaquetar (`src-tauri/binaries/` con los dos `.exe`).
- [x] Comprobar versión del paquete: **`0.12.0.0`** (en el nombre del archivo y en `AppxManifest.xml`).
- [x] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe` **y** `templates\` (sin el sufijo del target triple en los nombres de los `.exe`).
- [x] Comprobar tamaño del paquete: del orden de la v0.11.0 (~77 MB). Si el tamaño cae de forma notable (~30 MB), falta uno de los dos sidecars — **NO SUBIR**.
- [ ] Instalar el `.msixbundle` localmente (certificado de pruebas + `signtool` + `Add-AppxPackage`) y ejecutar la guía de prueba de 2 minutos de la sección 2, con especial atención a F12/F2/Ctrl+Mayús+F (que lleguen a la app empaquetada) y a los snippets globales (carpeta de configuración virtualizada del paquete).
- [ ] En Partner Center → Envíos → Paquetes: arrastrar `src-tauri/target/msix/dbv-typst-editor_0.12.0.0.msixbundle`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de "Novedades de esta versión" en español e inglés.
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2 de este documento.
