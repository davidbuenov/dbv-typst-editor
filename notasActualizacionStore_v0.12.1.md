# Notas de actualización v0.12.1 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.12.1 — Esquema más rápido y correcciones:

• El panel Esquema sale del mismo compilado que la vista previa: aparece al instante, sin compilar dos veces, e indica mientras se genera.
• Lista los encabezados que irían en el índice del documento.
• Si no puede mostrar el esquema, dice por qué: el documento tiene errores (y conserva el último esquema) o ha fallado la herramienta.
• Si la vista previa pasa al motor de respaldo, un aviso permite volver al motor rápido y recuperar la sincronización por palabra.
• Corregido: la vista previa se salía de la ventana con el panel estrecho.
• Corregido: algunos títulos del esquema perdían espacios o apóstrofos.
• La insignia de Tinymist ya se muestra en el idioma elegido.
```

### 🇬🇧 English

```text
Version 0.12.1 — Faster outline and fixes:

• The Outline panel comes from the same compilation as the preview: it appears instantly, without compiling twice, and shows when it is being generated.
• It lists the headings that would go in the document's table of contents.
• When it cannot show the outline, it says why: the document has errors (and the last outline is kept) or the tool failed.
• If the preview falls back to the backup engine, a notice lets you go back to the fast engine and word-level sync.
• Fixed: the preview spilled out of the window with a narrow panel.
• Fixed: some outline titles lost spaces or apostrophes.
• The Tinymist badge now follows the chosen language.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.12.1 (Patch Release)

WHAT'S NEW IN THIS VERSION:
- The Outline panel (sidebar, "Outline" tab) is now built from the same in-process compilation as the live preview, instead of running the bundled Typst command-line tool a second time. It lists the headings that would appear in the document's table of contents, shows "Generating the outline…" while the first one is computed, keeps the last good outline with a notice when the document has errors, and shows the actual reason if the outline cannot be obtained.
- The preview engine toggle was removed. If the fast engine ever falls back to the classic one, a "Classic engine" notice appears in the preview bar; clicking it switches back.
- Fixes: the preview panel overflowing the window when narrow; outline titles losing spaces or apostrophes; the Tinymist badge not being translated.

CREDENTIALS:
None required. The application is completely offline, privacy-friendly, and does not use any user accounts or authentication.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application and choose File > New blank project; create it in any folder. main.typ opens with the live preview on the right.
2. In the editor, type on separate lines:  = Introduction  ,  some text  ,  == Details  ,  #heading(outlined: false)[Hidden]
3. Click the "Outline" tab in the left sidebar: "Introduction" and "Details" are listed ("Hidden" is not, as in a table of contents). Click "Details": the preview scrolls to it.
4. Type an unclosed bracket such as  #text(  on a new line: the outline stays in place with a notice that it may be out of date. Delete it: the notice disappears.
5. Make the window narrow and drag the separator so the preview panel is small: the preview toolbar wraps onto a second line and nothing is cut off.

ADDITIONAL TECHNICAL CONTEXT:
- No changes to the bundled sidecars (Typst compiler + tinymist Language Server) or to their packaging; no new capabilities or dependencies.
- No background telemetry, no advertising, no tracking — consistent with all previous releases.
```

---

## 3. Checklist de verificación del paquete MSIX

Antes de subir el archivo `.msixbundle` generado a Partner Center — **sigue habiendo DOS sidecars, sin
cambios respecto a v0.5.0+** (ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6). Esta versión solo cambia
código propio (Rust y frontend): **ningún sidecar nuevo, ninguna dependencia nueva, ningún cambio de
empaquetado**.

- [x] Haber ejecutado `npm run vendor:typst` **y** `npm run vendor:tinymist` antes de empaquetar (`src-tauri/binaries/` con los dos `.exe`).
- [x] Comprobar versión del paquete: **`0.12.1.0`** (en el nombre del archivo y en `AppxManifest.xml`).
- [x] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe` **y** `templates\` (sin el sufijo del target triple en los nombres de los `.exe`).
- [x] Comprobar tamaño del paquete: del orden de la v0.12.0 (~80 MB). Si el tamaño cae de forma notable (~30 MB), falta uno de los dos sidecars — **NO SUBIR**.
- [ ] Instalar el `.msixbundle` localmente (certificado de pruebas + `signtool` + `Add-AppxPackage`) y ejecutar la guía de prueba de 2 minutos de la sección 2.
- [ ] En Partner Center → Envíos → Paquetes: arrastrar `src-tauri/target/msix/dbv-typst-editor_0.12.1.0.msixbundle`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de "Novedades de esta versión" en español e inglés.
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2 de este documento.
