# Backlog — DBV Typst Editor

## Contexto del Proyecto (Context Snapshot)

* **Objetivo**: Construir un editor de escritorio (Windows/Linux, macOS después) para documentos Typst, ligero, offline-first y multiplataforma, reutilizando al máximo la arquitectura de [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader).
* **Estado actual**: Bootstrap del framework `dbv-specs-ops` v2.8.0 completado (activadores, `project.config.md`, README, LICENSE, `git init` + primer commit). Informe arquitectónico de reutilización completado en `docs/ARCHITECTURE.md`, especificación inicial en `docs/SPECIFICATIONS.md`. **Ningún código de aplicación escrito todavía.**
* **Última decisión técnica**: Ver `memory.md` — editor CodeMirror 6, compilación Typst embebida vía crates Rust, preview SVG+PDF, introducción de Vite. Registradas 2026-09-04.
* **Próximo paso**: Validar con el usuario las decisiones de `ARCHITECTURE.md` §7 (y las Preguntas Abiertas de `SPECIFICATIONS.md` §6) antes de desglosar el plan de implementación (`implementation_plan.md`) del MVP en `/plan` → `/build`.

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
  - [ ] Validación del usuario sobre las decisiones anteriores (pendiente).
  - [ ] `docs/DESIGN.md` — sistema de diseño visual (pendiente, opcional en esta fase según `MASTER_PROMPT.md`).

- [ ] **Fase 2: Planificación de implementación (`/plan`)**
  - [ ] Desglosar el MVP (RF-01 a RF-11 de `SPECIFICATIONS.md`) en `implementation_plan.md` con dependencias, riesgos y estrategia de rollback.
  - [ ] Adversarial Architect Review formal sobre el plan del MVP.

- [ ] **Fase 3: Construcción (`/build`)** — no iniciada.
- [ ] **Fase 4: Pruebas (`/test`)** — no iniciada.
- [ ] **Fase 5: Simplificar (`/code-simplify`)** — no iniciada.
- [ ] **Fase 6: Entrega (`/ship`)** — no iniciada.

---

## 🔄 Context Snapshot / Snapshot de Contexto

> **Última actualización:** 2026-09-04
> **Punto exacto:** Bootstrap + informe arquitectónico entregados. Repo git local inicializado con un único commit (`chore: bootstrap DBV Typst Editor con framework dbv-specs-ops v2.8.0`). Documentos vivos actualizados: `project.config.md`, `docs/SPECIFICATIONS.md`, `docs/ARCHITECTURE.md`, `memory.md`, `CHANGELOG.md`, `task.md` (este fichero). `docs/DESIGN.md` sigue con placeholders.
> **Pendiente:** Validación del usuario de las decisiones técnicas de `ARCHITECTURE.md` §7 y respuesta a las Preguntas Abiertas de `SPECIFICATIONS.md` §6 (en particular: ¿publicación en stores desde el MVP o después?).
> **Próximo paso:** Si el usuario valida, continuar con `/plan` (desglose de `implementation_plan.md` del MVP) y después `/build` (primer slice: shell Tauri + estructura de directorios de `ARCHITECTURE.md` §7.4, portando la infraestructura reutilizable de DBV Markdown Reader).
