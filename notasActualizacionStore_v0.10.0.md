# Notas de actualización v0.10.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.10.0 — Guardado automático, resaltado de bibliografía y pulido:

• Guardado automático opcional (apagado por defecto): guarda tras una pausa al escribir o al cambiar de ventana, sin sobrescribir nunca un cambio hecho por otro programa.
• El aviso "sin guardar" pasa a ser un punto discreto junto al nombre del documento.
• Cerrar la ventana con cambios sin guardar queda protegido siempre, aunque el guardado automático esté apagado.
• Resaltado de sintaxis para ficheros .bib (bibliografía).
• Los ficheros ocultos (.git, etc.) dejan de listarse en el panel de archivos por defecto.
• Números de línea optativos, y botón de refresco de la vista previa siempre visible.
• Barra del documento más limpia: solo el nombre del fichero, con la ruta completa disponible al pasar el ratón.
• Corregido: el botón "Formatear" ya no puede aplicar cambios al fichero equivocado si hay uno de bibliografía abierto.
```

### 🇬🇧 English

```text
Version 0.10.0 — Auto-save, bibliography highlighting, and polish:

• Optional auto-save (off by default): saves after a typing pause or when switching windows, never overwriting a change made by another program.
• The "unsaved" warning is now a discreet dot next to the document name.
• Closing the window with unsaved changes is always protected, even with auto-save off.
• Syntax highlighting for .bib (bibliography) files.
• Hidden files (.git, etc.) no longer list in the file panel by default.
• Optional line numbers, and an always-visible preview refresh button.
• Cleaner document bar: just the file name, with the full path available on hover.
• Fixed: the "Format" button can no longer apply changes to the wrong file when a bibliography file is open.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.10.0 (Feature Release)

WHAT'S NEW IN THIS VERSION:
- Optional auto-save (off by default): saves after a 2s typing pause or on window/editor blur, using the same atomic-write path as manual Save; never overwrites a file changed by another program (pauses and warns instead).
- "Unsaved" text replaced by a small modified-state dot next to the document name.
- Closing the window with unsaved changes is now always protected (confirmation dialog, or auto-save-then-close), regardless of the auto-save setting.
- New BibTeX (.bib) syntax highlighting.
- New "Preferences" menu: hide dotfiles in the file tree (on by default), toggle line numbers, toggle auto-save, toggle full path display.
- Preview refresh button is now always visible (previously only in manual refresh mode).
- Document bar shows a short file name by default (full path on hover; a setting restores the full path inline).
- Bugfix: the "Format" (Typstyle) button could previously apply formatting edits to the wrong file when a non-Typst file (e.g. a .bib) was the active editor tab.

CREDENTIALS:
None required. The application is completely offline, privacy-friendly, and does not use any user accounts or authentication.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application, open or create a project with a main.typ and a references.bib file.
2. Open the .bib file and verify it shows syntax highlighting (colored entry types, field names, values) instead of plain text.
3. Open main.typ, click the "Format" button in the document bar to verify it still formats correctly, and confirm it (or the doc-bar toggle) looks disabled/greyed when a .bib is the active tab.
4. Open the header "Preferences" menu (gear icon) and toggle "Auto-save" on. Type a change in the editor, wait ~2 seconds without touching anything, and verify the modified dot next to the file name disappears (saved) without any dialog appearing.
5. With unsaved changes present, try to close the app window and verify you either get a confirmation prompt (auto-save off) or the app saves and closes cleanly (auto-save on) — it should never close silently discarding the change.
6. In the file explorer panel, verify a `.git` folder (if present) is not listed; toggle "Show hidden files" in Preferences to confirm it then appears.

ADDITIONAL TECHNICAL CONTEXT:
- Frontend-only release: no changes to the bundled sidecars (Typst compiler + tinymist Language Server) or to their packaging.
- No background telemetry, no advertising, no tracking — consistent with all previous releases.
```

---

## 3. Checklist de verificación del paquete MSIX

Antes de subir el archivo `.msix` generado a Partner Center — **sigue habiendo DOS sidecars, sin cambios
respecto a v0.5.0+** (ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6). Esta versión es **frontend-only**:
ningún sidecar nuevo, ningún cambio de empaquetado.

- [ ] Haber ejecutado `npm run vendor:typst` **y** `npm run vendor:tinymist` antes de empaquetar.
- [ ] Comprobar versión del paquete: **`0.10.0.0`** (en el nombre del archivo `.msix`).
- [ ] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe` **y** `templates\` (sin el sufijo del target triple en los nombres de los `.exe`).
- [ ] Comprobar tamaño del paquete: del orden de lo mismo que v0.9.0 (~95 MB o más; sin sidecars nuevos, el salto grande de tamaño ya ocurrió en v0.9.0 por las dependencias del motor en proceso). Si el tamaño cae de forma notable, falta uno de los dos sidecars — **NO SUBIR**.
- [ ] Instalar el `.msix` localmente (certificado de pruebas + `signtool` + `Add-AppxPackage`) y ejecutar la guía de prueba de 2 minutos de la sección 2.
- [ ] En Partner Center → Envíos → Paquetes: arrastrar el archivo `.msix` generado en `src-tauri/target/msix/`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de "Novedades de esta versión" en español e inglés.
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2 de este documento.
