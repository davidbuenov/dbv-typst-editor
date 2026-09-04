# Changelog — DBV Typst Editor

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Sin publicar] / [Unreleased]

### Added
- Bootstrap del proyecto con el framework [dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops) v2.8.0 (Spec-Driven Development).
- Informe arquitectónico de reutilización de [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader) — ver `dbv-specs-ops/docs/ARCHITECTURE.md`.
- Especificación inicial del producto (visión, MVP, roadmap) — ver `dbv-specs-ops/docs/SPECIFICATIONS.md`.
- Spec Addendum integrado: filosofía de producto "Obsidian for Typst", lanzador orientado a tareas, modelo de Proyecto, marketplace de plantillas, asistentes de inserción rápida, outline estructural, modos de escritura, gestión de imágenes por arrastre, bibliografía, Project Archive `.dbvt`, y re-evaluación confirmada del editor (CodeMirror 6 sobre Monaco).
- Additional Specification Clarification integrada: Package Explorer y Template Explorer como ecosistemas de producto separados sobre una única fuente de datos oficial (`index.json` de Typst Universe), detección automática de "Paquetes usados".
- TYPST CLI INTEGRATION integrada: la integración con Typst pasa de crates Rust embebidas a un binario oficial vendorizado como sidecar de Tauri (creación de proyecto, resolución de paquetes, compilación, preview y exportación); nuevo terminal avanzado opcional para usuarios avanzados.
- Nuevo informe técnico dedicado `dbv-specs-ops/docs/TYPST_ECOSYSTEM_RESEARCH.md`: investigación del CLI de Typst, sistema de paquetes, Typst Universe y registros oficiales, como research phase previo a `/plan` solicitado explícitamente por el usuario.
