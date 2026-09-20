# Notas de actualización v0.9.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

> **Acumulativo:** la última versión publicada en la Store fue la **0.6.0**, así que estos textos recogen todo lo añadido en la 0.7.0, la 0.8.0 y la 0.9.0 que sigue vigente.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.9.0 — Novedades acumuladas desde la 0.6.0:

• Vista previa ultrarrápida: nuevo motor; cada edición de un libro de 220 páginas tarda medio segundo. Si falla, la app usa sola el motor anterior.
• Sincronización exacta editor ↔ vista previa: doble clic (o botón derecho → "Ir al código aquí") selecciona la palabra en el editor; Ctrl+Alt+P la marca en la vista previa.
• Menú contextual en el editor, y errores subrayados con contador y lista para saltar a cada uno.
• Edita ficheros de código y texto (.cpp, .java, .py, .json, .csv… unos 40 tipos) con resaltado.
• Editor visual de ecuaciones con vista previa real y "Pegar LaTeX".
• Nuevos asistentes en Herramientas: diagramas de secuencia, Gantt, Kanban, DOT/Graphviz y flujogramas con decisiones, cada uno con ayuda contextual.
• Documento principal elegible: etiqueta "principal" en el árbol y clic derecho → "Establecer como documento principal".
• Mucho más ágil con libros largos (memoria acotada) y con .typ sueltos en carpetas enormes.
• Tinymist bajo demanda: actívalo o desactívalo desde su insignia.
• Zoom con Ctrl +/−/0 y Ctrl+rueda; Guardar y Exportar en el menú Archivo; pantalla de inicio rediseñada.
• Errores de compilación con tu ruta real y las líneas correctas.
```

### 🇬🇧 English

```text
Version 0.9.0 — Cumulative changes since 0.6.0:

• Ultra-fast preview: new engine; each edit of a 220-page book takes half a second. If it fails, the app falls back to the previous engine by itself.
• Exact editor ↔ preview sync: double-click (or right-click → "Go to code here") selects the word in the editor; Ctrl+Alt+P marks it in the preview.
• Editor context menu, and errors underlined with a counter and a list to jump to each one.
• Edit code and text files (.cpp, .java, .py, .json, .csv… about 40 types) with highlighting.
• Visual equation editor with a real preview and "Paste LaTeX".
• New Tools assistants: sequence diagrams, Gantt, Kanban, DOT/Graphviz and flowcharts with decisions, each with contextual help.
• Selectable main document: "main" badge in the tree and right-click → "Set as main document".
• Much smoother with long books (bounded memory) and with loose .typ files in huge folders.
• Tinymist on demand: turn it on or off from its badge.
• Zoom with Ctrl +/−/0 and Ctrl+wheel; Save and Export in the File menu; redesigned start screen.
• Compilation errors show your real path and the correct lines.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.9.0 (cumulative: everything added since the last published version, 0.6.0)

WHAT'S NEW SINCE 0.6.0:
v0.9.0 — In-process preview engine and exact sync
- The live preview now compiles with the Typst engine linked inside the application (no separate process), which makes each edit of a large document take about half a second. If it cannot compile for any reason it falls back automatically to the bundled Typst CLI, so nothing changes for the user. A setting next to the preview ("Engine: fast (beta) / classic") lets the user choose; the fast one is the default.
- Exact source sync: double-clicking a word in the preview (or right-click -> "Go to code here") selects that word in the editor; from the editor, Ctrl+Alt+P (or the right-click menu -> "Go to preview") highlights it in the preview.
- The editor has a context menu (Go to preview, Cut, Copy, Paste, Select all).
- Compilation errors and warnings are underlined in the editor and listed in a problems chip next to the document name.
- The editor can open and save code and text files (.cpp, .java, .py, .json, .csv, .md... about 40 extensions), with syntax highlighting; binary, non-UTF-8 and files over 5 MB are refused with a message.

v0.8.0 — Performance and usability
- Performance with large documents: the preview releases the markup of pages far from the viewport (a 220-page book previously grew the process to several GB) and the typing pause before recompiling adapts to how long the last compilation took.
- A loose .typ file opened from a huge folder (Downloads, Desktop) no longer makes the app copy that folder into a temporary directory on every compilation.
- Selectable main document: a "main" badge in the file tree, and a context menu (right-click on a .typ file) or the File menu to mark another file as the main document. It is stored per project inside the app; nothing is written to the user's folder.
- The Tinymist language server starts on demand (automatically for small documents, or by clicking its status badge for large ones) and can be turned off from the same badge.
- Compilation errors show the user's real project path and correct line numbers; a spurious error caused by a stray closing parenthesis in plain text was fixed.

v0.7.0 — New assistants and interface polish
- Visual math equation editor (Tools menu) with a REAL preview compiled by Typst on every pause, and "Paste LaTeX" through the MiTeX package.
- New Tools assistants: sequence diagrams (Chronos), Gantt charts with real dates (Gantty), Kanban boards (Kantan) and DOT/Graphviz graphs (Diagraph), plus a flowchart-with-decisions template in the diagram editor. Each one has a contextual "?" help button linking to the original package documentation. These packages are downloaded from Typst Universe only when the user inserts them.
- Contextual zoom: Ctrl +/-/0 and Ctrl+wheel resize the editor font or the preview depending on where the focus is.
- Save, Save As, Export PDF and Export PNG moved to the File menu; the start screen and the recent-projects cards were redesigned; the separator between editor and preview no longer gets stuck when maximizing the window; a benign ResizeObserver browser warning is no longer shown as an application error.

Other platforms (Homebrew for macOS and Linux) were added in v0.8.0; they do not change the Windows/Store package.

CREDENTIALS:
None required. The application is completely offline, privacy-friendly, and does not use any user accounts or authentication.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application. On the launcher screen, click "Blank project" or select any template.
2. Type a few paragraphs in the editor and verify the live preview updates on the right after a short pause.
3. Double-click a word in the preview: verify the editor selects that same word and highlights it for a few seconds. Right-click the preview and verify the menu offers "Go to code here" with "double-click" shown as its shortcut.
4. Click a word in the editor and press Ctrl+Alt+P (or right-click in the editor -> "Go to preview"): verify the word is highlighted in the preview.
5. Type "#unknown-thing" in the editor and verify it is underlined and a problems chip with a counter appears next to the document name; click the chip and verify the list jumps to the error.
6. In the file tree, right-click a .typ file and verify "Set as main document" is offered (a "main" badge appears on it); right-click a file with an unknown extension and verify "Open as text" is offered.
7. Open the Tools menu, choose the equation editor, type "x^2 + y^2 = z^2" and verify a rendered preview appears below the field.

ADDITIONAL TECHNICAL CONTEXT:
- The Typst CLI compiler AND the tinymist Language Server are both bundled inside the application package — two sidecars, no external dependencies, no internet connectivity required. This version adds no new sidecar binaries: the Typst engine is linked into the application executable itself, which is therefore noticeably larger (about 63 MB instead of 19 MB).
- Internet connectivity is only used if the user explicitly browses or downloads optional community packages from Typst Universe, explicitly uses the Git/clone features, or clicks an external documentation link (opened with the system's default browser, never inside the app).
- No background telemetry, no advertising, no tracking.
```

---

## 3. Checklist de verificación del paquete MSIX

Antes de subir el archivo `.msix`/`.msixbundle` generado a Partner Center — **sigue habiendo DOS sidecars, sin cambios desde v0.5.0** (ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6):

- [ ] Haber ejecutado `npm run vendor:typst` **y** `npm run vendor:tinymist` antes de empaquetar.
- [ ] Comprobar versión del paquete: **`0.9.0.0`** (en el nombre del archivo `.msix`/`.msixbundle`).
- [ ] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe` **y** `templates\` (sin el sufijo del target triple en los nombres de los `.exe`).
- [ ] Comprobar tamaño del paquete: el ejecutable principal pasa de ~19 MB a ~63 MB (lleva Typst dentro), más typst ~51 MB + tinymist ~64 MB sin comprimir. Si el tamaño cae muy por debajo, falta uno de los dos sidecars — **NO SUBIR**.
- [ ] Instalar el paquete localmente (certificado de pruebas + `signtool` + `Add-AppxPackage`) y ejecutar la guía de prueba de 2 minutos de la sección 2 — es el único paso que detecta de verdad un sidecar ausente.
- [ ] En Partner Center → Envíos → Paquetes: arrastrar el archivo `.msix`/`.msixbundle` generado en `src-tauri/target/msix/`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de "Novedades de esta versión" en español e inglés.
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2 de este documento.

Pasos completos de compilación y firma (vendorizar sidecars, variables `TAURI_SIGNING_*`, orden exacto de comandos): ver [`dbv-specs-ops/docs/WINDOWS_RELEASE.md`](./dbv-specs-ops/docs/WINDOWS_RELEASE.md).
