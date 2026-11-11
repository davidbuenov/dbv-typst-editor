# Notas de actualización v0.15.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.15.0: edición más cómoda y veloz, 10 temas WCAG, Modo Vim opcional, snippets con atajos y nueva interfaz de IA.

• 10 temas curados + tema personalizado: contraste sintáctico corregido en modo oscuro y catálogo ampliado (Nord, Dracula, Catppuccin, Solarized Dark, Gruvbox Dark, Alto contraste…), con 3 botones rápidos asignables y editor de colores propio con comprobación WCAG.
• Modo Vim opcional (Preferencias): edición modal con @replit/codemirror-vim, insignia en la nueva micro-barra inferior (Ln/Col y selección), números de línea relativos y Escape respetuoso con los paneles.
• Refresco manual con latencia cero: escribir documentos largos con vista previa manual ya no recalcula ni reconstruye la interfaz por tecla.
• Snippets con atajos y menú contextual: admite "key" en .vscode/*.code-snippets y keybindings.json (también $TM_SELECTED_TEXT) y añade «Insertar snippet ›» en el clic derecho.
• Ventanas y menús pulidos: paneles flotantes con apilamiento dinámico al frente y navegación por teclado en menús.
• IA unificada y ayuda ampliada: nueva vista tripartita de conexión con selector de modelo/esfuerzo y soporte para Google Antigravity, más manual de usuario bilingüe y ayuda ampliada.
```

### 🇬🇧 English

```text
Version 0.15.0: smoother and faster editing, 10 WCAG themes, optional Vim mode, snippet keybindings, and refreshed AI dialog.

• 10 curated themes + custom theme: fixed dark-mode syntax contrast and expanded catalog (Nord, Dracula, Catppuccin, Solarized Dark, Gruvbox Dark, High Contrast…), with 3 assignable quick-switch buttons and a custom color editor with live WCAG contrast check.
• Optional Vim mode (Preferences): modal editing via @replit/codemirror-vim, live mode badge in the new bottom status bar (Ln/Col & selection), relative line numbers, and panel-friendly Escape handling.
• Zero typing latency in Manual Refresh: typing long documents with manual preview refresh no longer re-serializes or rebuilds the UI on every keystroke.
• Snippet keybindings & context menu: supports "key" in .vscode/*.code-snippets and keybindings.json (with $TM_SELECTED_TEXT) plus an "Insert snippet ›" right-click submenu.
• Refined windows & menus: floating panels stack dynamically to the front and header menus support full keyboard navigation.
• Unified AI & expanded docs: tripartite connection modal with model/reasoning selector and Google Antigravity support, plus bilingual User Manual and expanded Help.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.15.0 (Minor Release over 0.14.0)

WHAT'S NEW IN 0.15.0:
- Fixed dark-mode Typst syntax highlighting contrast and expanded theme system to 10 curated themes + a user-customizable theme with live WCAG AA contrast check and 3 configurable quick-switch buttons in Preferences > "Themes & colors…".
- Optional lazy-loaded Vim mode (@replit/codemirror-vim) toggled from Preferences, with a live status bar (Ln/Col, selection, Vim mode badge) and optional relative line numbers.
- Zero typing latency in Manual Refresh mode (debounced LSP sync and incremental tab indicator updates).
- VS Code snippet keybindings ("key" in .vscode/*.code-snippets and keybindings.json, with $TM_SELECTED_TEXT) plus an "Insert snippet ›" submenu in the editor context menu.
- Dynamic floating-panel stacking order (active panel moves to front), mutually exclusive header dropdown menus with full keyboard navigation, and outside-click dismissal on Git.
- Refreshed optional AI assistant dialog organized into Local, Subscription CLI (adding Google Antigravity alongside Claude Code, Codex, Gemini CLI, Copilot CLI), and Cloud API keys, with per-turn model & reasoning-effort selector.
- Complete bilingual PDF user manual typeset in Typst and refreshed in-app Help.

CREDENTIALS:
None required. Every feature of the editor works offline without any account. The optional AI assistant and read-only `--mcp` mode are off unless the user configures their own local server, CLI tool, or API key; keys remain in Windows Credential Manager.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch DBV Typst Editor and open File > New blank project in any temporary folder. Confirm the bottom status bar shows `Ln 1, Col 1`.
2. Switch themes via the 3 quick buttons in the header or Preferences > "Themes & colors…": preview Dark, Nord, Dracula, or Catppuccin Latte and check crisp syntax colors in the editor.
3. Toggle Preferences > "Vim mode" and "Relative line numbers": confirm the `NORMAL` badge appears in the bottom status bar and pressing `i` / `Escape` toggles INSERT/NORMAL mode smoothly.
4. Right-click inside the editor to verify the context menu (including "Insert snippet ›" when user snippets have `"contextMenu": true`).
5. Click Tools > "Connect an AI…" to inspect the three-category dialog (Local, Subscription, Cloud) and close it without adding credentials.
6. Type `= Hello v0.15` in `main.typ` to verify the live PDF/SVG preview compiles with zero external dependencies, then File > Export PDF.

ADDITIONAL TECHNICAL CONTEXT:
- Same two bundled sidecars (`typst.exe` 0.15.1 and `tinymist.exe`), `templates/`, and `resources/typst-docs.json.gz`.
- No new network destinations unless explicitly initiated by the user (Typst Universe packages, manual update check, user-configured AI provider/CLI, or confirmed Google Fonts font install).
- No background telemetry, advertising, or tracking. Privacy policy: https://davidbuenov.github.io/dbv-typst-editor/privacy.html
```

---

## 3. Checklist de verificación del paquete MSIX

Siguen siendo **DOS sidecars** (`typst.exe` y `tinymist.exe`, `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6), `templates/` y `resources/typst-docs.json.gz`, más el alias de ejecución `dbv-typst-editor.exe`.

- [x] `npm run vendor:typst` y `npm run vendor:tinymist` presentes en `src-tauri/binaries/` (`typst-x86_64-pc-windows-msvc.exe` y `tinymist-x86_64-pc-windows-msvc.exe`).
- [x] Revisados visualmente los assets de `src-tauri/gen/windows/Assets/*.png` (`Wide310x150Logo.png`, `Square150x150Logo.png`, `Square44x44Logo.png`, `StoreLogo.png` — sin placeholders de color sólido).
- [x] Comprobar versión del paquete: **`0.15.0.0`** (en el nombre de `.msixbundle` y `Version="0.15.0.0"` en `AppxManifest.xml`). *(verificado el 2026-11-11)*
- [x] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe`, `templates\` y `resources\typst-docs.json.gz`. *(verificado: los cuatro presentes, con 53 ficheros en `templates\`)*
- [x] Comprobar tamaño de `src-tauri\target\msix\dbv-typst-editor_0.15.0.0.msixbundle`: del orden de `v0.14.0` (~78–85 MB). Si cae a ~30 MB, falta un sidecar — **NO SUBIR**. *(**78,79 MB** / `82.613.523` bytes, verificado el 2026-11-11)*
- [x] `AppxManifest.xml` contiene un único `<Extensions>` con la asociación `.typ` y `windows.appExecutionAlias` (`Alias="dbv-typst-editor.exe"`). *(verificado: XML válido)*
- [ ] Instalar el `.msixbundle` en local (certificado de pruebas + `signtool` + `Add-AppxPackage`) y pasar la guía de prueba de 2 minutos.
- [ ] En Partner Center → Envíos → Paquetes: subir `src-tauri/target/msix/dbv-typst-editor_0.15.0.0.msixbundle`.
- [ ] En Partner Center → Descripciones de la Store: copiar los textos actualizados de `descripcionStore_es.md` y `descripcionStore_en.md` (Descripción, Novedades de esta versión [sección 1], Características del producto [20/20] y Descripción corta) + las notas de certificación de la sección 2.
- [ ] Opcional en ficha de Store: subir capturas actualizadas de `docs/screenshots/` (`01`, `10`, `11`, `12`, `15`, `17` en ES y `_en` en EN).

