# Notas de actualización v0.11.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.11.0 — Explorador de archivos, enlaces e historial:

• Panel de archivos completo: crea ficheros y carpetas, renombra (F2), duplica, elimina a la papelera, selecciona varios y arrástralos a otra carpeta. También puedes soltar ficheros desde el Explorador de Windows.
• Al mover o renombrar, las rutas de #include, image(), bibliography() y demás se actualizan solas en todo el proyecto, con opción de ver los cambios o deshacerlos.
• Nuevo capítulo: crea el fichero y lo añade al documento principal en un solo paso.
• Los enlaces funcionan en la vista previa: las direcciones web se abren en el navegador, y el índice, las referencias, las citas y las notas llevan a su destino.
• Historial local: cada guardado deja una copia de seguridad que puedes comparar y restaurar.
• Corregido: con el guardado automático activado ya no aparece una y otra vez el aviso «El documento cambió fuera del editor».
```

### 🇬🇧 English

```text
Version 0.11.0 — File explorer, links and history:

• Full file panel: create files and folders, rename (F2), duplicate, delete to the recycle bin, select several items and drag them to another folder. You can also drop files from Windows Explorer.
• When moving or renaming, paths in #include, image(), bibliography() and the rest are updated across the whole project, with the option to review or undo the changes.
• New chapter: creates the file and adds it to the main document in one step.
• Links work in the preview: web addresses open in the browser, and the outline, references, citations and footnotes take you to their target.
• Local history: every save keeps a backup copy you can compare and restore.
• Fixed: with auto-save on, the "The document changed outside the editor" warning no longer keeps popping up.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.11.0 (Feature Release)

WHAT'S NEW IN THIS VERSION:
- Full file explorer in the Files panel: New file / New folder / Refresh buttons (shown on hover), inline rename (F2), duplicate, delete to the system Recycle Bin (Del), multi-select (Ctrl/Shift+click), drag to move, and dropping files from Windows Explorer onto a folder to copy them there. All file operations are confined to the open project folder.
- Automatic reference updates: moving or renaming a file rewrites the paths that point to it in the project's .typ files (using Typst's own parser), with "View changes" and "Undo" buttons.
- "New chapter…" (File menu or folder context menu): creates a .typ file with a heading and adds its #include to the main document.
- Clickable links in the live preview: external links (http, https, mailto only) open in the default browser; internal links (outline, references, citations, footnotes) scroll the preview to their target.
- Local version history: before a file is overwritten, the previous content is kept in the app's local data folder (never inside the user's project), with compare and restore. Can be turned off and cleared from Preferences.
- Bugfix: with auto-save on, the external-change dialog kept appearing because Windows reports attribute-only changes (antivirus, indexer) as modifications. External changes are now detected by content.

CREDENTIALS:
None required. The application is completely offline, privacy-friendly, and does not use any user accounts or authentication.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application and create a new project from any template (e.g. "Blank project").
2. Hover over the Files panel and click "New folder"; name it "chapters". Right-click that folder and choose "New chapter…", type a title and confirm: a new .typ file opens and an #include line appears in main.typ.
3. Right-click a file in the tree and choose "Rename" (or press F2); rename it and confirm that the notice "Updated N references…" appears and the preview still compiles.
4. Drag a file onto another folder in the tree and check it moves; press "Undo" in the notice to put it back.
5. In main.typ add the line #link("https://typst.app")[Typst] and click that link in the preview: it opens in the default browser.
6. Right-click a file and choose "Local history…": the saved versions are listed and can be compared or restored.
7. Right-click a file and choose "Delete": after confirming, it goes to the Windows Recycle Bin.

ADDITIONAL TECHNICAL CONTEXT:
- No changes to the bundled sidecars (Typst compiler + tinymist Language Server) or to their packaging.
- New dependency for sending files to the Recycle Bin (Rust "trash" crate, which uses the standard Windows shell file-operation API). No new capabilities are requested.
- Local history is stored under the application's local data folder and is bounded (50 versions or 30 days per file, 200 MB in total).
- No background telemetry, no advertising, no tracking — consistent with all previous releases.
```

---

## 3. Checklist de verificación del paquete MSIX

Antes de subir el archivo `.msix` generado a Partner Center — **sigue habiendo DOS sidecars, sin cambios
respecto a v0.5.0+** (ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6). Esta versión trae código Rust
nuevo (operaciones de ficheros, referencias, enlaces, historial) y el crate `trash`, pero **ningún sidecar
nuevo ni cambio de empaquetado**.

- [ ] Haber ejecutado `npm run vendor:typst` **y** `npm run vendor:tinymist` antes de empaquetar.
- [ ] Comprobar versión del paquete: **`0.11.0.0`** (en el nombre del archivo `.msix`).
- [ ] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe` **y** `templates\` (sin el sufijo del target triple en los nombres de los `.exe`).
- [ ] Comprobar tamaño del paquete: del orden de la v0.10.0 (~77 MB). Si el tamaño cae de forma notable (~30 MB), falta uno de los dos sidecars — **NO SUBIR**.
- [ ] Instalar el `.msix` localmente (certificado de pruebas + `signtool` + `Add-AppxPackage`) y ejecutar la guía de prueba de 2 minutos de la sección 2, con especial atención a «Eliminar» (papelera de reciclaje desde la app empaquetada) y a «Historial local» (carpeta de datos virtualizada del paquete).
- [ ] En Partner Center → Envíos → Paquetes: arrastrar el archivo `.msix` generado en `src-tauri/target/msix/`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de "Novedades de esta versión" en español e inglés.
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2 de este documento.
