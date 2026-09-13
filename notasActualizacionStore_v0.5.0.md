# Notas de actualización v0.5.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.5.0 — Inteligencia de código, diagramas, Python y Git:

• Autocompletado semántico, diagnósticos en vivo y formateo con un clic: el Language Server oficial de Typst (tinymist) viaja ahora dentro de la aplicación, sin configuración.
• Galería de plantillas rediseñada a 2 columnas, con previsualización maquetada a tamaño completo — también para las plantillas de Typst Universe, que ahora se pueden examinar antes de usarlas.
• Nuevo asistente de diagramas CeTZ: inserta diagramas de flujo, de bloques, gráficas matemáticas y lienzos con un clic.
• Runner de Python integrado para generar figuras y datos dinámicos (Matplotlib, NumPy, pandas), con entorno compartido y aprovisionamiento automático.
• Integración con Git: estado, commit, push y pull desde la cabecera, con comparador de diferencias lado a lado ante cualquier conflicto de guardado.
• Chincheta para mantener la ventana siempre encima.
• Ver la previsualización de cualquier plantilla a tamaño grande con un clic.
```

### 🇬🇧 English

```text
Version 0.5.0 — Code intelligence, diagrams, Python, and Git:

• Semantic autocomplete, live diagnostics, and one-click formatting: the official Typst Language Server (tinymist) now ships inside the app, with zero setup.
• Redesigned two-column template gallery with full-size rendered previews — now also for Typst Universe templates, which you can inspect before using them.
• New CeTZ diagram assistant: insert flowcharts, block diagrams, math plots, and canvases with one click.
• Built-in Python runner for dynamic figures and data (Matplotlib, NumPy, pandas), with a shared environment and automatic provisioning.
• Git integration: status, commit, push, and pull from the header, with a side-by-side diff viewer for any save conflict.
• A pin to keep the window always on top.
• View any template preview at full size with one click.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.5.0 (Feature Release)

WHAT'S NEW IN THIS VERSION:
- Bundled official Typst Language Server (tinymist) as a second sidecar: semantic autocomplete, real-time diagnostics/linting, and one-click code formatting.
- New CeTZ diagram insertion assistant (flowcharts, block diagrams, math plots, canvases).
- Built-in Python runner for Matplotlib/NumPy/pandas-based figures and data, with a shared cross-platform virtual environment.
- Git integration (status, commit, push, pull) and a side-by-side diff viewer for save conflicts.
- Redesigned template gallery with full-size rendered previews, including Typst Universe templates.
- "Always on top" window pin.

CREDENTIALS:
None required. The application is completely offline, privacy-friendly, and does not use any user accounts or authentication.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application. On the launcher screen, click "Blank project" or select any template (e.g. "Academic paper").
2. Type Typst code in the editor panel (left/middle) and observe:
   - The live preview rendering in the right panel.
   - Autocomplete suggestions when typing a function name (e.g. type "#he" and press Ctrl+Space).
3. Introduce a deliberate syntax error and verify a diagnostic underline/tooltip appears in the editor.
4. Click the "Formatear" / format button in the document bar to verify code formatting.
5. Click the pin icon in the header to verify the window stays on top of other applications.
6. Click the PDF export icon in the top header to verify successful PDF generation.

ADDITIONAL TECHNICAL CONTEXT:
- The Typst CLI compiler AND the tinymist Language Server are both bundled inside the application package — two sidecars, no external dependencies, no internet connectivity required.
- Internet connectivity is only used if the user explicitly browses or downloads optional community packages from Typst Universe.
- No background telemetry, no advertising, no tracking.
```

---

## 3. Checklist de verificación del paquete MSIX

Antes de subir el archivo `.msix` generado a Partner Center — **desde v0.5.0 hay DOS sidecars, no uno** (ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6):

- [ ] Haber ejecutado `npm run vendor:typst` **y** `npm run vendor:tinymist` antes de empaquetar.
- [ ] Comprobar versión del paquete: **`0.5.0.0`** (en el nombre del archivo `.msix`).
- [ ] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe` **y** `templates\` (sin el sufijo del target triple en los nombres de los `.exe`).
- [ ] Comprobar tamaño del paquete: del orden de varias decenas de MB más que la v0.4.0 (típst ~51 MB + tinymist ~64 MB sin comprimir). Si el tamaño cae al nivel de la versión anterior, falta uno de los dos sidecars — **NO SUBIR**.
- [ ] Instalar el `.msix` localmente (certificado de pruebas + `signtool` + `Add-AppxPackage`) y ejecutar la guía de prueba de 2 minutos de la sección 2 — es el único paso que detecta de verdad un sidecar ausente.
- [ ] En Partner Center → Envíos → Paquetes: arrastrar el archivo `.msix` generado en `src-tauri/target/msix/`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de "Novedades de esta versión" en español e inglés.
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2 de este documento.
