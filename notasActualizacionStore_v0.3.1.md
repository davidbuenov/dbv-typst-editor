# Notas de actualización v0.3.1 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Actualización importante — corrige un fallo crítico de la versión anterior.

La versión publicada anteriormente en la Store se empaquetó sin el compilador Typst incluido. Como consecuencia, la aplicación abría y permitía escribir, pero fallaba al crear proyectos desde plantilla, al mostrar la vista previa y al exportar a PDF.

Esta versión lo corrige por completo:

• El compilador Typst vuelve a viajar dentro de la aplicación, como estaba previsto. La vista previa en tiempo real, la exportación a PDF/PNG y la creación de proyectos funcionan con normalidad, sin conexión y sin instalar nada más.
• Se restaura el catálogo de plantillas académicas (TFG, TFM, Tesis, Artículo, Informe técnico, Presentación, CV y Proyecto en blanco), que no aparecía en algunas instalaciones.
• La terminal Typst integrada resuelve ya correctamente las rutas relativas del proyecto abierto.
• Las rutas de archivo se muestran en formato legible en la barra de título y en la lista de proyectos recientes.

Si instalaste la versión anterior desde la Store, actualiza: no necesitas hacer nada más ni reinstalar.

Gracias a los usuarios que reportaron el problema.
```

### 🇬🇧 English

```text
Important update — fixes a critical issue in the previous release.

The previous Store release was packaged without the bundled Typst compiler. As a result, the app opened and let you type, but failed when creating projects from a template, rendering the live preview, or exporting to PDF.

This version fixes it completely:

• The Typst compiler ships inside the app again, as intended. Real-time preview, PDF/PNG export and project creation all work normally — offline and with nothing else to install.
• The academic template catalogue is restored (Bachelor/Master thesis, PhD thesis, Paper, Technical report, Presentation, CV and Blank project), which was missing on some installations.
• The built-in Typst terminal now resolves relative paths against the open project correctly.
• File paths are displayed in readable form in the title bar and the recent projects list.

If you installed the previous version from the Store, just update — nothing else to do, no reinstall needed.

Thanks to the users who reported the problem.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**. Conviene explicar el cambio para agilizar la revisión.

```text
SUBMISSION NOTES — v0.3.1 (bug-fix release)

WHAT CHANGED SINCE THE PREVIOUS SUBMISSION:
The previously certified package was built by a third-party MSIX packaging tool that did not include the application's bundled sidecar binary (the Typst compiler) inside the package. The app therefore launched correctly and passed certification, but every compiler-dependent feature failed at runtime. This submission fixes the packaging so the compiler and the bundled template catalogue are included. The package is consequently larger than the previous one (~30 MB instead of ~6 MB); this size increase is expected and is the fix itself.

NO CREDENTIALS REQUIRED:
This application is 100% local and offline-first. No login, account creation, or credentials are required.

QUICK 2-MINUTE TESTING GUIDE (this is exactly what failed in the previous build):
1. Launch the application. The Task Launcher screen appears.
2. Under "Templates", click "Blank Project" (or any template such as "TFG / Bachelor Thesis").
   -> Verify the template list is NOT empty. An empty list indicates the packaging bug.
3. Click "Create project" and choose any folder on disk.
   -> The project must be created without an error message.
4. The editor opens with the Typst code editor on the left and the live document preview on the right.
5. Type any text (e.g. "= Test Heading").
   -> The preview pane on the right must re-render in real time. This is the key check.
6. Click "Export PDF" to verify standalone PDF generation.

ADDITIONAL TECHNICAL CONTEXT:
- The Typst CLI engine is bundled inside the application package, requiring no external dependencies, LaTeX installation, or internet connectivity.
- Internet connectivity is only used if the user explicitly browses or downloads optional community packages from Typst Universe.
- No background telemetry, no advertising, no tracking.
```

---

## 3. Recordatorio antes de subir

- El paquete a subir debe declarar **`0.3.1.0`**, no `0.3.0.0` (Partner Center rechaza una versión igual o inferior a la publicada).
- **No** subir un paquete firmado con el certificado de pruebas autofirmado: la Store lo firma con el suyo.
- Verificación obligatoria de `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6 — en particular, que el `.msix` pese ~30 MB y no ~6 MB.
