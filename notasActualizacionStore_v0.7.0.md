# Notas de actualización v0.7.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.7.0 — Editor de ecuaciones, cinco asistentes de diagramación y ayuda contextual:

• Editor visual e interactivo de ecuaciones matemáticas: escribe o pulsa una pieza y ve el resultado real compilado por Typst al momento, o pega una fórmula LaTeX ya escrita.
• Cinco asistentes de diagramación nuevos: flujogramas con decisiones, diagramas de secuencia, diagramas de Gantt con fechas reales, tableros Kanban y render de grafos DOT/Graphviz.
• Botón de ayuda "?" en cada asistente, con enlace directo a la documentación original del paquete o lenguaje que usa.
• Zoom contextual: Ctrl++/Ctrl+-/Ctrl+0 y Ctrl+rueda ajustan el editor o la vista previa según dónde tengas el foco.
• Guardar, Guardar como, Exportar PDF y Exportar PNG ahora viven en el menú Archivo.
• Pantalla de inicio rediseñada, con recientes mostrando tiempo relativo ("hoy", "ayer"...) y un enlace "Ver todos".
```

### 🇬🇧 English

```text
Version 0.7.0 — Equation editor, five diagramming assistants, and contextual help:

• Visual, interactive equation editor: type or click a piece and see the real result compiled by Typst instantly, or paste an already-written LaTeX formula.
• Five new diagramming assistants: flowcharts with decisions, sequence diagrams, Gantt charts with real dates, Kanban boards, and DOT/Graphviz graph rendering.
• A "?" help button in every assistant, linking directly to the original documentation of the package or language it uses.
• Contextual zoom: Ctrl++/Ctrl+-/Ctrl+0 and Ctrl+wheel adjust the editor or the preview depending on where your focus is.
• Save, Save As, Export PDF and Export PNG now live in the File menu.
• Redesigned home screen, with recent projects showing relative time ("today", "yesterday"...) and a "View all" link.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.7.0 (Feature Release)

WHAT'S NEW IN THIS VERSION:
- New visual, interactive equation editor: click-to-insert math pieces (fractions, exponents, sums, integrals, matrices, Greek letters, delimiters) with a REAL live preview compiled by the actual Typst compiler, plus "Paste LaTeX" support via the MiTeX package.
- Five new diagramming assistants, all reachable from the Tools menu: flowcharts with decision nodes, sequence diagrams (chronos package), Gantt charts with real dates (gantty package), Kanban boards (kantan package), and DOT/Graphviz graph rendering (diagraph package, no external Graphviz install required).
- A contextual "?" help button was added to all six diagramming panels, opening the in-app Help already scrolled to that assistant's section, plus a link to that package's original external documentation.
- Contextual zoom (Ctrl++/Ctrl+-/Ctrl+0 and Ctrl+wheel) now adjusts the code editor's font size or the PDF preview's zoom depending on which one has focus, instead of falling back to the WebView's native zoom.
- Save/Save As/Export PDF/Export PNG moved from the document toolbar into the File menu; the home screen was redesigned with a 2x2 action grid and a compact recent-projects list showing relative time.

CREDENTIALS:
None required. The application is completely offline, privacy-friendly, and does not use any user accounts or authentication.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application. On the launcher screen, click "Blank project" or select any template.
2. In the Tools menu (header), click "Equation editor" (∑ icon): click a couple of piece buttons (e.g. fraction, square root) and verify a live formula preview renders below the text field, then click "Insert".
3. In the same Tools menu, click "Sequence diagram" (⇄ icon) OR "Kanban board" (▥ icon): add two entries using the form and click "Insert" — verify the generated code compiles in the live preview on the right.
4. Open the DOT/Graphviz assistant from the Tools menu, type `digraph { a -> b }` in the text field, and verify a live graph preview appears below it.
5. Click the "?" button in the header of any of the assistant panels above and verify the in-app Help panel opens, already scrolled to that assistant's section, with a documentation link at the end of it.
6. Open the File menu (header) and verify Save/Save As/Export PDF/Export PNG are listed there.

ADDITIONAL TECHNICAL CONTEXT:
- The Typst CLI compiler AND the tinymist Language Server are both bundled inside the application package — two sidecars, no external dependencies, no internet connectivity required. This version adds no new sidecar binaries: the new assistants are pure Rust/JavaScript code compiled into the existing app and sidecar-compilation pipeline.
- Internet connectivity is only used if the user explicitly browses or downloads optional community packages from Typst Universe, explicitly uses the Git/clone features, or clicks one of the new external documentation links (opened with the system's default browser, never inside the app).
- No background telemetry, no advertising, no tracking.
```

---

## 3. Checklist de verificación del paquete MSIX

Antes de subir el archivo `.msix`/`.msixbundle` generado a Partner Center — **sigue habiendo DOS sidecars, sin cambios desde v0.5.0** (ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6):

- [ ] Haber ejecutado `npm run vendor:typst` **y** `npm run vendor:tinymist` antes de empaquetar.
- [ ] Comprobar versión del paquete: **`0.7.0.0`** (en el nombre del archivo `.msix`/`.msixbundle`).
- [ ] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe` **y** `templates\` (sin el sufijo del target triple en los nombres de los `.exe`).
- [ ] Comprobar tamaño del paquete: del mismo orden que v0.6.0 (typst ~51 MB + tinymist ~64 MB sin comprimir). Si el tamaño cae muy por debajo, falta uno de los dos sidecars — **NO SUBIR**.
- [ ] Instalar el paquete localmente (certificado de pruebas + `signtool` + `Add-AppxPackage`) y ejecutar la guía de prueba de 2 minutos de la sección 2 — es el único paso que detecta de verdad un sidecar ausente.
- [ ] En Partner Center → Envíos → Paquetes: arrastrar el archivo `.msix`/`.msixbundle` generado en `src-tauri/target/msix/`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de "Novedades de esta versión" en español e inglés.
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2 de este documento.

Pasos completos de compilación y firma (vendorizar sidecars, variables `TAURI_SIGNING_*`, orden exacto de comandos): ver [`dbv-specs-ops/docs/WINDOWS_RELEASE.md`](./dbv-specs-ops/docs/WINDOWS_RELEASE.md).
