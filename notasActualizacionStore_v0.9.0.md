# Notas de actualización v0.9.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.9.0 — Vista previa ultrarrápida y sincronización exacta:

• Nuevo motor de vista previa: cada edición de un libro de 220 páginas tarda medio segundo en vez de varios.
• Sincronización exacta: haz doble clic (o botón derecho → "Ir al código aquí") en la vista previa y el editor selecciona la palabra; desde el editor, Ctrl+Alt+P marca la palabra en la vista previa.
• Menú contextual en el editor: Ir a la vista previa, Cortar, Copiar, Pegar y Seleccionar todo.
• Errores y avisos subrayados en el editor, con un contador y una lista para saltar a cada uno.
• Edita también ficheros de código y texto (.cpp, .java, .py, .json, .csv… y unos 40 tipos más) con resaltado; si el documento los incrusta, la vista previa los sigue sin guardar.
• Si el motor rápido no puede compilar, la aplicación usa sola el clásico.
```

### 🇬🇧 English

```text
Version 0.9.0 — Ultra-fast preview and exact sync:

• New preview engine: each edit of a 220-page book takes half a second instead of several.
• Exact sync: double-click (or right-click → "Go to code here") in the preview and the editor selects the word; from the editor, Ctrl+Alt+P marks the word in the preview.
• Editor context menu: Go to preview, Cut, Copy, Paste and Select all.
• Errors and warnings underlined in the editor, with a counter and a list to jump to each one.
• Also edit code and text files (.cpp, .java, .py, .json, .csv… and about 40 more types) with highlighting; if the document embeds them, the preview follows them without saving.
• If the fast engine cannot compile, the app falls back to the classic one by itself.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.9.0 (In-process preview engine release)

WHAT'S NEW IN THIS VERSION:
- The live preview now compiles with the Typst engine linked inside the application (no separate process), which makes each edit of a large document take about half a second. If it cannot compile for any reason it falls back automatically to the bundled Typst CLI, so nothing changes for the user.
- Exact source sync: double-clicking a word in the preview (or right-click -> "Go to code here") selects that word in the editor; from the editor, Ctrl+Alt+P (or the right-click menu -> "Go to preview") highlights it in the preview.
- The editor has a context menu (Go to preview, Cut, Copy, Paste, Select all).
- Compilation errors and warnings are underlined in the editor and listed in a problems chip next to the document name.
- The editor can open and save code and text files (.cpp, .java, .py, .json, .csv, .md... about 40 extensions), with syntax highlighting; binary, non-UTF-8 and files over 5 MB are refused with a message.
- The preview engine setting ("Engine: fast (beta) / classic") is next to the preview; the fast one is the default.

CREDENTIALS:
None required. The application is completely offline, privacy-friendly, and does not use any user accounts or authentication.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application. On the launcher screen, click "Blank project" or select any template.
2. Type a few paragraphs in the editor and verify the live preview updates on the right after a short pause.
3. Double-click a word in the preview: verify the editor selects that same word and highlights it for a few seconds. Right-click the preview and verify the menu offers "Go to code here" with "double-click" shown as its shortcut.
4. Click a word in the editor and press Ctrl+Alt+P (or right-click in the editor -> "Go to preview"): verify the word is highlighted in the preview.
5. Type "#unknown-thing" in the editor and verify it is underlined and a problems chip with a counter appears next to the document name; click the chip and verify the list jumps to the error.
6. In the file tree, right-click a file with an unknown extension and verify "Open as text" is offered.

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
