# Changelog — DBV Typst Editor

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Sin publicar] / [Unreleased]

### Added
- **Modo de instalación de WebView2 en Windows (decisión cerrada):** el instalador por defecto usa `downloadBootstrapper` (18 MB) y se añade un overlay opcional `src-tauri/tauri.windows.offline.conf.json` con el script `npm run build:win:offline` para generar bajo demanda el instalador 100% offline (268 MB), pensado para aulas sin conexión.
- Bootstrap del proyecto con el framework [dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops) v2.8.0 (Spec-Driven Development).
- Informe arquitectónico de reutilización de [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader) — ver `dbv-specs-ops/docs/ARCHITECTURE.md`.
- Especificación inicial del producto (visión, MVP, roadmap) — ver `dbv-specs-ops/docs/SPECIFICATIONS.md`.
- Spec Addendum integrado: filosofía de producto "Obsidian for Typst", lanzador orientado a tareas, modelo de Proyecto, marketplace de plantillas, asistentes de inserción rápida, outline estructural, modos de escritura, gestión de imágenes por arrastre, bibliografía, Project Archive `.dbvt`, y re-evaluación confirmada del editor (CodeMirror 6 sobre Monaco).
- Additional Specification Clarification integrada: Package Explorer y Template Explorer como ecosistemas de producto separados sobre una única fuente de datos oficial (`index.json` de Typst Universe), detección automática de "Paquetes usados".
- TYPST CLI INTEGRATION integrada: la integración con Typst pasa de crates Rust embebidas a un binario oficial vendorizado como sidecar de Tauri (creación de proyecto, resolución de paquetes, compilación, preview y exportación); nuevo terminal avanzado opcional para usuarios avanzados.
- Nuevo informe técnico dedicado `dbv-specs-ops/docs/TYPST_ECOSYSTEM_RESEARCH.md`: investigación del CLI de Typst, sistema de paquetes, Typst Universe y registros oficiales, como research phase previo a `/plan` solicitado explícitamente por el usuario.
- **Slice 2 — Integración del compilador Typst:** el CLI oficial de Typst v0.15.1 viaja dentro de la aplicación como sidecar de Tauri, con script de vendorizado sin dependencias externas, módulo `typst_engine` con errores tipados, y una suite de 8 comprobaciones que valida cada subcomando contra el binario real. Corrige tres supuestos erróneos de la fase de investigación (`typst init` con rutas locales, `typst query` deprecado, obtención de la posición de los encabezados) y cierra por adelantado el spike del panel de esquema.
- **Slice 1 — Andamiaje de la aplicación:** proyecto Tauri v2 + Vite operativo, con shell de interfaz, sistema de temas claro/oscuro (tokens portados de DBV Markdown Reader, sin dependencia de fuentes remotas), factoría de paneles flotantes `registerPanel()`, i18n propio ES/EN, backend Rust modularizado (`commands/`) con el comando `app_info` y sus tests, scripts `start`/`stop` multiplataforma y generador de iconos sin dependencias externas.
- Posicionamiento oficial de producto fijado ("el entorno de escritorio más accesible para el ecosistema Typst") y dos principios arquitectónicos guía (reparto de responsabilidades Typst/DBV, Universe-First); Universe Browser reencuadrado como punto de entrada de primer nivel con árbol de navegación explícito (Plantillas / Paquetes); Capa de Plantillas DBV (`dbv-template.toml`) ampliada con localización, capturas, valores por defecto y validación, más diseño de overlay para enriquecer plantillas comunitarias sin riesgo de desincronización.
