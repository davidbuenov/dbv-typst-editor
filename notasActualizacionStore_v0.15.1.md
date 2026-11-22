# Notas de actualización v0.15.1 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`. Actualiza la 0.15.0 (ya publicada en la Store).

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres; 927 el texto en español y 865 el inglés).

### 🇪🇸 Español

```text
Versión 0.15.1: arreglos de exportación y de plantillas, y mejoras para quien usa la aplicación en inglés.

• Exportar a PDF ya no falla con proyectos que importan una plantilla con funciones (los errores «the character # is not valid in code» que aparecían al exportar, aunque la vista previa funcionara). Exportar PDF, PNG y el esquema compilan ahora exactamente tu documento.
• «Mostrar en el explorador» selecciona el fichero en el Explorador de Windows, también cuando la ruta tiene espacios (antes abría la carpeta por defecto).
• Plantillas en tu idioma: con la aplicación en inglés, artículo, informe técnico, presentación, currículum y proyecto en blanco se crean en inglés (textos, ficheros, etiquetas del formulario e idioma del documento).
• Cerrar pestaña en el menú Archivo (Ctrl+W), para cerrar el documento activo sin tocar la barra de pestañas.
• Motor de la aplicación (Tauri) actualizado a la última versión.
```

### 🇬🇧 English

```text
Version 0.15.1: export and template fixes, plus improvements for people who use the app in English.

• Exporting to PDF no longer fails on projects that import a template with functions (the "the character # is not valid in code" errors that appeared on export even though the preview worked). PDF export, PNG export and the outline now compile exactly your document.
• "Reveal in file manager" selects the file in Windows Explorer, also when the path contains spaces (it used to open the default folder instead).
• Templates in your language: with the app in English, paper, technical report, presentation, CV and blank project are created in English (texts, file names, form labels and document language).
• Close tab in the File menu (Ctrl+W), to close the active document without touching the tab bar.
• The app engine (Tauri) was updated to the latest version.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.15.1 (Patch Release over 0.15.0)

WHAT'S NEW IN 0.15.1:
- Fixed PDF/PNG export and the document outline failing with "the character # is not valid in code" on projects whose imported template contains functions: export now compiles the exact document, without the internal preview sync anchors.
- Fixed "Reveal in file manager" on Windows: it now opens Explorer with the file selected, also when the path contains spaces (previously it opened the default folder).
- The five generic bundled templates (blank project, academic paper, technical report, presentation, CV) now have English variants: with the app interface in English, a new project is created with English texts, file names, form labels and document language.
- New "Close tab" entry in the File menu (Ctrl+W).
- Updated the Tauri framework to its latest version. macOS-only menu-bar changes in this release do not affect the Windows package.

CREDENTIALS:
None required. Every feature of the editor works offline without any account. The optional AI assistant and read-only `--mcp` mode are off unless the user configures their own local server, CLI tool, or API key; keys remain in the Windows Credential Manager, never in a file.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch DBV Typst Editor and open File > New document… > "Academic paper" (set the interface language to English first with the language switch in the header). Fill the form and create the project in any temporary folder: the generated project has English section files (e.g. `01-introduction.typ` style names) and English labels.
2. In the Files panel, right-click `main.typ` > "Reveal in file manager" (or File > "Reveal in Explorer"): Windows Explorer opens on that folder with `main.typ` selected. Repeat with a project folder whose path contains spaces.
3. In any project, create a file `plantilla.typ` with a multi-line function:
   line 1: #let diapositiva(titulo, cuerpo) = {
   line 2:   [== #titulo \]]
   line 3:   [Intervalo \[0, 1\) y \(nota\]]
   line 4: (empty)
   line 5:   cuerpo
   line 6: }
   and use it from `main.typ`: `#import "plantilla.typ": diapositiva` followed by `#diapositiva("Uno")[Texto]`. Choose File > Export PDF…: the PDF is created without errors (before 0.15.1 it failed with "the character # is not valid in code").
4. Open two documents in tabs and choose File > "Close tab": only the active tab closes.
5. Type `= Hello v0.15.1` in `main.typ` to verify the live preview compiles with zero external dependencies.

ADDITIONAL TECHNICAL CONTEXT:
- Same two bundled sidecars (`typst.exe` 0.15.1 and `tinymist.exe`), `templates/`, and `resources/typst-docs.json.gz`.
- No new network destinations unless explicitly initiated by the user (Typst Universe packages, manual update check, user-configured AI provider/CLI, or confirmed Google Fonts font install).
- No background telemetry, advertising, or tracking. Privacy policy: https://davidbuenov.github.io/dbv-typst-editor/privacy.html
```

---

## 3. Checklist de verificación del paquete MSIX

Siguen siendo **DOS sidecars** (`typst.exe` y `tinymist.exe`, `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6), `templates/` y `resources/typst-docs.json.gz`, más el alias de ejecución `dbv-typst-editor.exe`.

- [x] `npm run vendor:typst` y `npm run vendor:tinymist` presentes en `src-tauri/binaries/` (`typst-x86_64-pc-windows-msvc.exe` y `tinymist-x86_64-pc-windows-msvc.exe`).
- [x] Revisados los assets de `src-tauri/gen/windows/Assets/*.png` (sin cambios respecto a la 0.15.0, ya revisados: sin placeholders de color sólido).
- [x] Comprobar versión del paquete: **`0.15.1.0`** (en el nombre de `.msixbundle` y `Version="0.15.1.0"` en `AppxManifest.xml`). *(verificado el 2026-11-22)*
- [x] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe`, `templates\` y `resources\typst-docs.json.gz`. *(verificado: los cuatro presentes, con 69 ficheros en `templates\`)*
- [x] Comprobar tamaño de `src-tauri\target\msix\dbv-typst-editor_0.15.1.0.msixbundle`: del orden de `v0.15.0` (~78–85 MB). Si cae a ~30 MB, falta un sidecar — **NO SUBIR**. *(**78,96 MB** / `82.797.542` bytes, verificado)*
- [x] `AppxManifest.xml` contiene un único `<Extensions>` con la asociación `.typ` y `windows.appExecutionAlias` (`Alias="dbv-typst-editor.exe"`). *(verificado: XML válido)*
- [ ] Instalar el `.msixbundle` en local (certificado de pruebas + `signtool` + `Add-AppxPackage`) y pasar la guía de prueba de 2 minutos.
- [ ] En Partner Center → Envíos → Paquetes: subir `src-tauri/target/msix/dbv-typst-editor_0.15.1.0.msixbundle`.
- [ ] En Partner Center → Descripciones de la Store: copiar los textos actualizados de `descripcionStore_es.md` y `descripcionStore_en.md` (Descripción, Novedades de esta versión [sección 1], Características del producto).
- [ ] Opcional en ficha de Store: las capturas de `docs/screenshots/` no cambian en esta versión.
