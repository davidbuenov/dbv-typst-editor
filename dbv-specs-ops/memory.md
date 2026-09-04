# 🧠 Memory & Context

> **Frontera de uso (Memory vs. Tasks):**
> - `task.md` → progreso **operativo**: checklist de tareas, Snapshot de Contexto (el paso exacto siguiente), y estado de la sesión.
> - `memory.md` → contexto **cualitativo y temático**: conocimiento persistente, decisiones técnicas profundas, lecciones, y el área del producto en foco (no el paso específico).
> Si hay info que sirva para los dos, prioriza: datos con fecha/paso exacto → `task.md`; razonamiento/por-qué/lecciones → `memory.md`.
>
> *Instrucción para la IA: Consulta este archivo al inicio de cada sesión para recuperar el hilo técnico. Actualiza las secciones correspondientes cuando el workflow lo indique (triggers en `/plan`, `/build`, `/test` y gate en `/ship`).*

## 🎯 Contexto Activo

- **Estado actual del desarrollo:** Bootstrap completado (framework dbv-specs-ops v2.8.0 instalado) + informe arquitectónico de reutilización de DBV Markdown Reader completado (`docs/ARCHITECTURE.md`) + especificación inicial (`docs/SPECIFICATIONS.md`). Ningún código de aplicación escrito todavía — el proyecto está en fase de análisis/planificación (`/spec` + `/plan` inicial), pendiente de validación del usuario antes de pasar a `/build`.
- **Foco inmediato:** Validar con el usuario las decisiones técnicas clave de `ARCHITECTURE.md` §7 (editor CodeMirror 6, compilación Typst embebida vía crates Rust, preview SVG+PDF) antes de iniciar la implementación del MVP.

## 🏗️ Log de Decisiones Técnicas (ADR Ligero)

*Registro de por qué se tomaron ciertas rutas (ej. cambios en librerías, arquitectura o patrones).*

- **2026-09-04 — Nombre del proyecto:** El nombre oficial es "DBV Typst Editor" (no "DBV Academic Writer", que queda como tagline/eslogan: *"Academic and technical writing made simple. Powered by Typst."*). Confirmado explícitamente por el usuario tras detectar ambigüedad entre el nombre del directorio del repositorio (`dbv-academic-writer`) y el nombre pedido en el prompt inicial.
- **2026-09-04 — Editor de código: CodeMirror 6 en vez de Monaco Editor.** Motivo: Monaco (~2-5MB, motor completo de VS Code) contradice la filosofía "ligero, offline-first, arranque instantáneo" que es la propuesta de valor de toda la familia DBV Markdown Reader / DBV Typst Editor; CodeMirror 6 es ~200-400KB, modular, ESM-first, y es la base que usa el propio editor web oficial de Typst (app.typst.io), lo que maximiza la probabilidad de un modo de lenguaje Typst mantenido a largo plazo. Ver justificación completa en `docs/ARCHITECTURE.md` §7.1.
- **2026-09-04 — Compilador Typst embebido como crates Rust (no CLI sidecar).** Motivo: coherencia con el patrón "single self-contained binary" ya usado por DBV Markdown Reader (WebView2 embebido, sin dependencias externas en PATH), evita desalineación de versión con un `typst` instalado por el usuario, y permite compilar a memoria (SVG/PDF) sin pasar por el sistema de ficheros en cada recompilación. Riesgo aceptado conscientemente: la API de las crates (`typst`, `typst-pdf`, `typst-svg`, `typst-ide`, `typst-kit`) es menos estable que la CLI entre versiones — mitigado aislando la integración detrás de un módulo `typst_engine` con interfaz propia, para poder migrar a sidecar CLI sin reescribir el resto de la app si es necesario. Ver `docs/ARCHITECTURE.md` §7.2 y riesgo en §6.
- **2026-09-04 — Preview en vivo por SVG página a página, PDF real solo en guardado/exportación.** Motivo: SVG es vectorial, permite refresco incremental sin cargar un visor PDF.js completo, y reutiliza casi literalmente el mecanismo de watch→debounce→re-render ya validado en DBV Markdown Reader (`lib.rs:457-503` + `app.js:552-568`). Ver `docs/ARCHITECTURE.md` §7.3.
- **2026-09-04 — Introducción de Vite como bundler del frontend.** Rompe conscientemente el patrón "sin bundler, IIFE + vendor scripts" documentado como obligatorio en `docs/NATIVE_DESKTOP_APPS.md` §3 para DBV Markdown Reader — necesario porque CodeMirror 6 es ES Modules-first. Se mantiene `withGlobalTauri: true` para los plugins Tauri consumidos vía `window.__TAURI__`; a validar en `/build` si el resto del frontend se mantiene híbrido (vendorizado) o migra también a ESM real.

## ⚠️ Lecciones Aprendidas

- **El pipeline "watch(directorio padre) → debounce → supresión de auto-eco → re-render preservando scroll" de DBV Markdown Reader es el activo más valioso a heredar**, muy por encima de cualquier componente visual concreto — es exactamente la arquitectura que necesita un editor con vista previa en tiempo real, independientemente del formato (Markdown u otro lenguaje de composición).
- **DBV Markdown Reader es, pese a su nombre "Reader/editor", fundamentalmente un visor**: su capacidad de edición es un `<textarea>` plano sin resaltado, autocompletado ni plegado. No confundir "hay un modo de edición" con "hay un editor de código reutilizable" — esta distinción cambió sustancialmente el alcance de esfuerzo estimado para el MVP de DBV Typst Editor.
- **El sistema de plantillas de DBV Markdown Reader (`templates/`) no tiene ninguna integración en la app** (ni comando Rust, ni selector UI, ni siquiera existe "Guardar como") — es contenido estático documentado en un README, copiado manualmente por el usuario. Para DBV Typst Editor, el patrón organizativo (bilingüe, por categorías) es reutilizable, pero la carga/scaffolding desde la app es trabajo 100% nuevo.

## 🗺️ Mapa del Producto (Áreas de Foco)

- **Núcleo de edición:** Editor CodeMirror 6 + modo de lenguaje Typst + integración con `typst-ide` (Beta).
- **Motor de compilación:** Módulo `typst_engine` en Rust (crates oficiales), preview SVG + export PDF.
- **Infraestructura heredada:** Watcher de ficheros, single-instance/file-association, recent-files, auto-actualizador, theming, paneles flotantes, CI de release — todo portado de DBV Markdown Reader con adaptaciones menores.
- **Plantillas:** Artículo académico, TFG, TFM, tesis, informe técnico, CV, presentación — sistema nuevo a construir en `/build`.
