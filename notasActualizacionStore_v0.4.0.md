# Notas de actualización v0.4.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.4.0 — Sincronización bidireccional, compilación completa y mejoras de experiencia:

• Sincronización bidireccional editor ↔ vista previa: haz doble clic sobre cualquier elemento de la vista previa para saltar a ese archivo y línea en el editor; o pulsa el botón de chincheta en la barra para llevar la vista previa a la página del cursor.
• Compilación del documento completo (Doc / Fich): alterna entre compilar el documento raíz (main.typ) o solo el fichero abierto. Compilar el documento completo mantiene el contexto global de capítulos, etiquetas y bibliografía mientras editas módulos individuales.
• Control de refresco: modo automático (recompila mientras escribes) o manual (botón Refrescar e indicador de desactualización) para optimizar CPU y batería en documentos extensos.
• Asistente de imágenes mejorado: el botón Fig despliega las imágenes existentes en la carpeta images/ del proyecto o permite examinar el equipo, con soporte de arrastre en toda la ventana.
• Indicadores visuales de carga durante la composición inicial y al desplazarse rápidamente por documentos de muchas páginas.
• Eliminación rápida de proyectos recientes en el lanzador mediante icono de cruz.
• Panel de ayuda integrado actualizado en español e inglés.
```

### 🇬🇧 English

```text
Version 0.4.0 — Bidirectional sync, whole-document compilation, and UX improvements:

• Bidirectional editor ↔ preview sync: double-click anywhere on the preview to jump straight to that file and line in the editor; or click the pin button in the toolbar to scroll the preview to the cursor position.
• Whole-document compilation (Doc / File): toggle between compiling the root document (main.typ) or only the open file. Compiling the full document preserves global cross-references, chapters, and bibliography context while editing modular files.
• Refresh control: choose between automatic mode (recompiles as you type) or manual mode (Refresh button with out-of-date indicator) to save CPU and battery on long documents.
• Enhanced image picker: the Fig button drops down existing images in the project images/ folder or lets you browse your machine, with universal drag-and-drop across the window.
• Visual loading indicators during initial typesetting and fast scrolling through multi-page documents.
• Quick removal of recent projects directly from the launcher with a cross icon.
• Updated bilingual in-app help in English and Spanish.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.4.0 (Feature Release)

WHAT'S NEW IN THIS VERSION:
- Bidirectional synchronization between editor and preview (double-click in preview navigates editor; pin icon in toolbar navigates preview to cursor).
- Root document compilation scope toggle (Doc / File) preserving chapters, labels, and bibliography across modular projects.
- Automatic and manual compilation refresh modes to optimize battery and CPU usage.
- Enhanced image insertion assistant with project images dropdown and universal drag-and-drop.
- Visual loading indicators for multi-page documents.
- Fast removal of recent projects from the launcher.

CREDENTIALS:
None required. The application is completely offline, privacy-friendly, and does not use any user accounts or authentication.

QUICK 1-MINUTE TESTING INSTRUCTIONS:
1. Launch the application. On the launcher screen, click "Blank project" or select any template (e.g. "Academic paper").
2. Type text in the editor panel (middle) and observe the real-time live preview rendering in the right panel.
3. Double-click on any paragraph or heading in the preview panel to verify that the editor cursor automatically jumps to that source line.
4. Click the PDF export icon in the top header to verify successful PDF generation.
```

---

## 3. Checklist de verificación del paquete MSIX

Antes de subir el archivo `.msix` generado a Partner Center:

- [ ] Comprobar versión del paquete: **`0.4.0.0`** (en el nombre del archivo `.msix`).
- [ ] Comprobar tamaño del paquete: **~30 MB**. Si pesa ~6 MB, **NO SUBIR** (indicaría que faltan los binarios vendorizados).
- [ ] En Partner Center → Envíos → Paquetes: arrastrar el archivo `.msix` generado en `src-tauri/target/appx/`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de "Novedades de esta versión" en español e inglés.
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2 de este documento.
