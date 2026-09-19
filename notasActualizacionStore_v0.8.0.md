# Notas de actualización v0.8.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.8.0 — Más rápido con documentos grandes y documento principal elegible:

• Mucho más ágil con libros y tesis largos: la vista previa libera las páginas que quedan lejos (un libro de 220 páginas ya no ocupa varios GB) y espera más antes de recompilar cuando el documento es pesado.
• Los ficheros .typ sueltos que están en carpetas enormes (Descargas, Escritorio) se abren en segundos, no en casi un minuto.
• Documento principal elegible: una etiqueta "principal" en el árbol de ficheros y, con el botón derecho o desde el menú Archivo, "Establecer como documento principal". Imprescindible en proyectos sin main.typ.
• Tinymist bajo demanda: arranca solo con documentos pequeños y puedes activarlo o desactivarlo pulsando su insignia.
• Los errores de compilación señalan tu proyecto real y los números de línea correctos.
• Corregido un error fantasma al compilar documentos con un paréntesis suelto en el texto.
```

### 🇬🇧 English

```text
Version 0.8.0 — Faster with large documents and a selectable main document:

• Much smoother with long books and theses: the preview releases pages that scroll far away (a 220-page book no longer takes several GB) and waits longer before recompiling when the document is heavy.
• Loose .typ files sitting in huge folders (Downloads, Desktop) now open in seconds instead of almost a minute.
• Selectable main document: a "main" badge in the file tree and, with a right-click or from the File menu, "Set as main document". Essential for projects without a main.typ.
• Tinymist on demand: it starts by itself for small documents and you can enable or disable it by clicking its badge.
• Compilation errors now point at your real project, with the correct line numbers.
• Fixed a phantom error when compiling documents with a stray parenthesis in the text.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.8.0 (Performance and usability release)

WHAT'S NEW IN THIS VERSION:
- Performance with large documents: the live preview now releases the markup of pages that are far from the viewport (a 220-page book previously grew the process to several GB), and the typing pause before recompiling adapts to how long the last compilation took.
- A loose .typ file opened from a huge folder (Downloads, Desktop) no longer makes the app copy that folder's contents into a temporary directory on every compilation; it now replicates only files a Typst document can actually read, and skips very large files.
- Selectable main document: the file tree shows a "main" badge on the project's main document, and a context menu (right-click on a .typ file) or the File menu lets the user mark another file as the main document. It is stored per project inside the app and nothing is written to the user's folder.
- The Tinymist language server is now started on demand: automatically for small documents, or manually by clicking its status badge for large ones. Clicking the badge while it is running turns it off, and the choice is remembered.
- Compilation errors now show the user's real project path and correct line numbers instead of a temporary path; a spurious error caused by a stray closing parenthesis in plain text was fixed.
- Distribution on other platforms (Homebrew for macOS and Linux) was added; it does not change the Windows/Store package.

CREDENTIALS:
None required. The application is completely offline, privacy-friendly, and does not use any user accounts or authentication.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application. On the launcher screen, click "Blank project" or select any template.
2. In the file tree (left), right-click any .typ file and verify the context menu offers "Set as main document" and "Show in file manager". Click "Set as main document" and verify a "main" badge appears next to that file and a confirmation message is shown.
3. Open the File menu (header) and verify "Set as main document" is listed there, together with Save / Save As / Export PDF / Export PNG.
4. Type some text in the editor and verify the live PDF preview updates on the right after a short pause.
5. Look at the status badge near the document name: with a small document it shows "Tinymist LSP" (active). Click it once and verify it changes to "Activar Tinymist" (disabled); click it again and verify it turns back on.
6. Start typing "#" in the editor with Tinymist active and verify autocompletion suggestions appear.

ADDITIONAL TECHNICAL CONTEXT:
- The Typst CLI compiler AND the tinymist Language Server are both bundled inside the application package — two sidecars, no external dependencies, no internet connectivity required. This version adds no new sidecar binaries.
- Internet connectivity is only used if the user explicitly browses or downloads optional community packages from Typst Universe, explicitly uses the Git/clone features, or clicks an external documentation link (opened with the system's default browser, never inside the app).
- No background telemetry, no advertising, no tracking.
```

---

## 3. Checklist de verificación del paquete MSIX

Antes de subir el archivo `.msix`/`.msixbundle` generado a Partner Center — **sigue habiendo DOS sidecars, sin cambios desde v0.5.0** (ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6):

- [ ] Haber ejecutado `npm run vendor:typst` **y** `npm run vendor:tinymist` antes de empaquetar.
- [ ] Comprobar versión del paquete: **`0.8.0.0`** (en el nombre del archivo `.msix`/`.msixbundle`).
- [ ] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe` **y** `templates\` (sin el sufijo del target triple en los nombres de los `.exe`).
- [ ] Comprobar tamaño del paquete: del mismo orden que v0.7.0 (typst ~51 MB + tinymist ~64 MB sin comprimir). Si el tamaño cae muy por debajo, falta uno de los dos sidecars — **NO SUBIR**.
- [ ] Instalar el paquete localmente (certificado de pruebas + `signtool` + `Add-AppxPackage`) y ejecutar la guía de prueba de 2 minutos de la sección 2 — es el único paso que detecta de verdad un sidecar ausente.
- [ ] En Partner Center → Envíos → Paquetes: arrastrar el archivo `.msix`/`.msixbundle` generado en `src-tauri/target/msix/`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de "Novedades de esta versión" en español e inglés.
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2 de este documento.

Pasos completos de compilación y firma (vendorizar sidecars, variables `TAURI_SIGNING_*`, orden exacto de comandos): ver [`dbv-specs-ops/docs/WINDOWS_RELEASE.md`](./dbv-specs-ops/docs/WINDOWS_RELEASE.md).
