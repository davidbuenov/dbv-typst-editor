# Notas de actualización v0.6.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.6.0 — Diagramas, Git y el catálogo completo de Typst Universe:

• Editor visual de diagramas: nodos, flechas con dirección y trazo, colores y zoom — inserta diagramas de flujo y de bloques sin escribir código, y reábrelos para seguir editando.
• Integración con Git: estado, commit, push, pull y clonar un repositorio por URL desde la cabecera, con resolución visual de conflictos de fusión.
• Buscador sobre el catálogo completo de Typst Universe (~4.700 paquetes y plantillas), no solo una selección curada.
• Bibliografía visual: el asistente de citas muestra título, autor y año, y avisa de entradas duplicadas o incompletas.
• Runner de JavaScript integrado para generar figuras y datos dinámicos.
• Pegar una imagen directamente desde el portapapeles.
```

### 🇬🇧 English

```text
Version 0.6.0 — Diagrams, Git, and the full Typst Universe catalog:

• Visual diagram editor: nodes, arrows with direction and stroke, colors and zoom — insert flowcharts and block diagrams without writing code, and reopen them to keep editing.
• Git integration: status, commit, push, pull, and clone a repository by URL from the header, with visual merge-conflict resolution.
• Search across the full Typst Universe catalog (~4,700 packages and templates), not just a curated selection.
• Visual bibliography: the citation assistant shows title, author, and year, and warns about duplicate or incomplete entries.
• Built-in JavaScript runner for dynamic figures and data.
• Paste an image straight from the clipboard.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.6.0 (Feature Release)

WHAT'S NEW IN THIS VERSION:
- New WYSIWYG diagram editor (nodes, arrows with direction/stroke, colors, zoom, drag-and-drop), replacing the previous CeTZ code-only assistant.
- Git integration: status, commit, push, pull, and clone-by-URL from the header, with a visual merge-conflict resolution dialog.
- Full Typst Universe Browser: search across the entire public catalog (~4,700 packages/templates), with automatic package-vs-template detection.
- Visual bibliography assistant (title/author/year, duplicate-entry warning) powered by the hayagriva engine.
- Built-in JavaScript runner ("jogs") for dynamic figures and data, with a 45-second safety timeout on every compilation.
- Paste an image directly from the clipboard into the active document.

CREDENTIALS:
None required. The application is completely offline, privacy-friendly, and does not use any user accounts or authentication.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application. On the launcher screen, click "Blank project" or select any template.
2. In the editor toolbar, click the diagram editor button (pencil/diagram icon): add a shape, connect it with an arrow, and click "Insert" — verify the generated code compiles in the live preview on the right.
3. Click the Git icon in the header (only relevant if the opened folder is a Git repository) to verify the status popover opens.
4. Open the Typst Universe panel (✦ icon) and use its search field to look up a package by name — verify results appear from the full catalog, not just a short curated list.
5. Copy any image to the clipboard (e.g. a screenshot) and paste it (Ctrl+V) with the editor focused — verify it is inserted as a figure with a relative path.
6. Click the PDF export icon in the top header to verify successful PDF generation.

ADDITIONAL TECHNICAL CONTEXT:
- The Typst CLI compiler AND the tinymist Language Server are both bundled inside the application package — two sidecars, no external dependencies, no internet connectivity required.
- Internet connectivity is only used if the user explicitly browses or downloads optional community packages from Typst Universe, or explicitly uses the Git/clone features.
- No background telemetry, no advertising, no tracking.
```

---

## 3. Checklist de verificación del paquete MSIX

Antes de subir el archivo `.msix`/`.msixbundle` generado a Partner Center — **sigue habiendo DOS sidecars, sin cambios desde v0.5.0** (ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6):

- [ ] Haber ejecutado `npm run vendor:typst` **y** `npm run vendor:tinymist` antes de empaquetar.
- [ ] Comprobar versión del paquete: **`0.6.0.0`** (en el nombre del archivo `.msix`/`.msixbundle`).
- [ ] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe` **y** `templates\` (sin el sufijo del target triple en los nombres de los `.exe`).
- [ ] Comprobar tamaño del paquete: del mismo orden que v0.5.0 (típst ~51 MB + tinymist ~64 MB sin comprimir). Si el tamaño cae muy por debajo, falta uno de los dos sidecars — **NO SUBIR**.
- [ ] Instalar el paquete localmente (certificado de pruebas + `signtool` + `Add-AppxPackage`) y ejecutar la guía de prueba de 2 minutos de la sección 2 — es el único paso que detecta de verdad un sidecar ausente.
- [ ] En Partner Center → Envíos → Paquetes: arrastrar el archivo `.msix`/`.msixbundle` generado en `src-tauri/target/msix/`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de "Novedades de esta versión" en español e inglés.
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2 de este documento.

Pasos completos de compilación y firma (vendorizar sidecars, variables `TAURI_SIGNING_*`, orden exacto de comandos): ver [`dbv-specs-ops/docs/WINDOWS_RELEASE.md`](./dbv-specs-ops/docs/WINDOWS_RELEASE.md).
