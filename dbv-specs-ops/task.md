# Backlog — DBV Typst Editor

## Contexto del Proyecto (Context Snapshot)

* **Objetivo**: Construir una herramienta de escritura de escritorio (Windows/Linux, macOS después) orientada a documento/proyecto para Typst — "para Typst lo que Obsidian es para Markdown" —, ligera, offline-first y multiplataforma, reutilizando al máximo la arquitectura de [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader).
* **Estado actual**: Bootstrap del framework `dbv-specs-ops` v2.8.0 completado. Informe arquitectónico de reutilización completado en `docs/ARCHITECTURE.md` (v2) y especificación completa en `docs/SPECIFICATIONS.md` (v2), incorporando el **Spec Addendum** del usuario (2026-09-04): filosofía de producto orientada a documento, lanzador por tareas, modelo de Proyecto, marketplace de plantillas, asistentes de inserción, outline, modos de escritura, Project Archive `.dbvt`. **Ningún código de aplicación escrito todavía.**
* **Última decisión técnica**: Ver `memory.md` — editor CodeMirror 6 (re-evaluado y reconfirmado frente a Monaco tras el Addendum), compilación Typst embebida vía crates Rust, preview SVG+PDF, Vite, modelo de Proyecto, marketplace apoyado en el registro oficial de Typst, `.dbvt` como ZIP con protección zip-slip. Registradas 2026-09-04.
* **Próximo paso**: Validar con el usuario las decisiones de `ARCHITECTURE.md` §7 (y las Preguntas Abiertas de `SPECIFICATIONS.md` §9) antes de desglosar el plan de implementación (`implementation_plan.md`) del MVP en `/plan` → `/build`.

## Checklist de Tareas

- [x] **Fase 0: Bootstrap del framework**
  - [x] Copiar `dbv-specs-ops` v2.8.0 (última versión confirmada contra `origin/master`) a la raíz del proyecto.
  - [x] Generar activadores en la raíz (`CLAUDE.md`, `GEMINI.md`, `ANTIGRAVITY.md`, `.windsurfrules`, `.github/copilot-instructions.md`).
  - [x] Rellenar `project.config.md` (nombre, autor, licencia, stack, Agent Readiness).
  - [x] Generar `README.md` / `README.en.md`, `LICENSE` (MIT), `.gitignore`.
  - [x] `git init` + commit inicial (confirmado explícitamente por el usuario).
  - [x] Resetear `CHANGELOG.md`, `memory.md`, `task.md` (venían con el historial del propio framework, no del proyecto — corregido para respetar la separación framework/proyecto de `MASTER_PROMPT.md`).

- [x] **Fase 1: Especificación y arquitectura (`/spec` + análisis `/plan` inicial)**
  - [x] Análisis exhaustivo de DBV Markdown Reader (arquitectura backend/frontend, pipeline de renderizado, watcher, settings, updater, file association, plantillas, CI, testing, dependencias) vía agente de exploración de código.
  - [x] Clasificación explícita de componentes: reutilizable sin cambios / adaptación menor / reemplazo completo (`ARCHITECTURE.md` §3).
  - [x] Dependencias a mantener vs. sustituir (`ARCHITECTURE.md` §4-5).
  - [x] Riesgos técnicos identificados y mitigaciones (`ARCHITECTURE.md` §6).
  - [x] Decisión de editor de código: CodeMirror 6 vs. Monaco, con justificación técnica (`ARCHITECTURE.md` §7.1).
  - [x] Estrategia de integración del compilador Typst: crates Rust embebidas vs. CLI sidecar (`ARCHITECTURE.md` §7.2).
  - [x] Estrategia de vista previa en tiempo real: SVG por página + PDF en export (`ARCHITECTURE.md` §7.3).
  - [x] Estructura de directorios propuesta (`ARCHITECTURE.md` §7.4) y estimación de complejidad por bloque (`ARCHITECTURE.md` §8).
  - [x] Visión de producto, MVP, fuera de alcance, riesgos y roadmap por fases (`SPECIFICATIONS.md`).
  - [x] **Spec Addendum del usuario procesado (2026-09-04):** filosofía "Obsidian for Typst", lanzador orientado a tareas, modelo de Proyecto (§4/§7.5), plantillas como funcionalidad de primer nivel + marketplace (§7.6), asistente de creación de proyecto (§7.6.2), asistentes de inserción rápida (§7.7), outline estructural (§7.8), modos de escritura (§7.9), gestión de imágenes por arrastre (§7.10), bibliografía (§7.11), exportaciones + Project Archive `.dbvt` (§7.12), re-evaluación explícita de Monaco vs. CodeMirror 6 con los criterios del Addendum (§7.1, reconfirmado CM6), roadmap y prioridades reconciliados (`SPECIFICATIONS.md` §11).
  - [ ] Validación del usuario sobre las decisiones anteriores (pendiente).
  - [ ] `docs/DESIGN.md` — sistema de diseño visual (pendiente, opcional en esta fase según `MASTER_PROMPT.md`).

- [ ] **Fase 2: Planificación de implementación (`/plan`)**
  - [ ] Desglosar el MVP (RF-01 a RF-12 de `SPECIFICATIONS.md` §5) en `implementation_plan.md` con dependencias, riesgos y estrategia de rollback.
  - [ ] Adversarial Architect Review formal sobre el plan del MVP.

- [ ] **Fase 3: Construcción (`/build`)** — no iniciada.
- [ ] **Fase 4: Pruebas (`/test`)** — no iniciada.
- [ ] **Fase 5: Simplificar (`/code-simplify`)** — no iniciada.
- [ ] **Fase 6: Entrega (`/ship`)** — no iniciada.

---

## 🔄 Context Snapshot / Snapshot de Contexto

> **Última actualización:** 2026-09-04
> **Punto exacto:** Bootstrap + informe arquitectónico (v1) + Spec Addendum del usuario procesado e integrado (v2) entregados. Repo git local con commits de bootstrap e informe v1; el commit del Spec Addendum (v2) está pendiente de crear en esta misma sesión. Documentos vivos actualizados: `project.config.md`, `docs/SPECIFICATIONS.md` (v2), `docs/ARCHITECTURE.md` (v2), `memory.md`, `task.md` (este fichero). `docs/DESIGN.md` sigue con placeholders.
> **Pendiente:** Validación del usuario de las decisiones técnicas de `ARCHITECTURE.md` §7 (en especial la reconfirmación de CodeMirror 6 sobre Monaco) y respuesta a las Preguntas Abiertas de `SPECIFICATIONS.md` §9 (publicación en stores, alcance exacto del marketplace de plantillas en Beta, nombre definitivo de `.dbvt`, crate de parseo BibTeX).
> **Próximo paso:** Si el usuario valida, continuar con `/plan` (desglose de `implementation_plan.md` del MVP, RF-01 a RF-12) y después `/build` (primer slice: shell Tauri + estructura de directorios de `ARCHITECTURE.md` §7.4, portando la infraestructura reutilizable de DBV Markdown Reader).
