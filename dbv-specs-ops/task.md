# Backlog — DBV Typst Editor

## Contexto del Proyecto (Context Snapshot)

* **Objetivo**: Construir "el entorno de escritorio más accesible para el ecosistema Typst" (posicionamiento oficial) — no un editor de código con soporte Typst — orientado a documento/proyecto ("para Typst lo que Obsidian es para Markdown"), ligero, offline-first y multiplataforma, reutilizando al máximo la arquitectura de [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader).
* **Estado actual**: Bootstrap del framework `dbv-specs-ops` v2.8.0 completado. `docs/ARCHITECTURE.md` y `docs/SPECIFICATIONS.md` en v4, incorporando cuatro rondas de refinamiento del usuario (2026-09-04): **Spec Addendum**, **Additional Specification Clarification**, **TYPST CLI INTEGRATION** (con research phase dedicado, `docs/TYPST_ECOSYSTEM_RESEARCH.md`) y **feedback de posicionamiento de producto** (principios arquitectónicos guía, Universe Browser como punto de entrada de primer nivel, Capa de Plantillas DBV ampliada). **Ningún código de aplicación escrito todavía.**
* **Última decisión técnica**: Ver `memory.md` — editor CodeMirror 6 (reconfirmado dos veces), integración con Typst vía CLI oficial como sidecar, dos principios arquitectónicos guía (reparto de responsabilidades Typst↔DBV, Universe-First), Universe Browser (Plantillas + Paquetes, mismo nivel de navegación), Capa de Plantillas DBV (`dbv-template.toml`) ampliada con localización/capturas/defaults/validación, campos base del asistente de creación estandarizados, `.dbvt` como ZIP con protección zip-slip, terminal avanzado. Registradas 2026-09-04.
* **Próximo paso**: Validar con el usuario las decisiones de `ARCHITECTURE.md` §7 (y las Preguntas Abiertas de `SPECIFICATIONS.md` §9) antes de desglosar el plan de implementación (`implementation_plan.md`) del MVP en `/plan` → `/build`.

## Checklist de Tareas

- [x] **Fase 0: Bootstrap del framework**
  - [x] Copiar `dbv-specs-ops` v2.8.0 (última versión confirmada contra `origin/master`) a la raíz del proyecto.
  - [x] Generar activadores en la raíz (`CLAUDE.md`, `GEMINI.md`, `ANTIGRAVITY.md`, `.windsurfrules`, `.github/copilot-instructions.md`).
  - [x] Rellenar `project.config.md` (nombre, autor, licencia, stack, Agent Readiness).
  - [x] Generar `README.md` / `README.en.md`, `LICENSE` (MIT), `.gitignore`.
  - [x] `git init` + commit inicial (confirmado explícitamente por el usuario).
  - [x] Resetear `CHANGELOG.md`, `memory.md`, `task.md` (venían con el historial del propio framework, no del proyecto).

- [x] **Fase 1: Especificación y arquitectura (`/spec` + análisis `/plan` inicial)**
  - [x] Análisis exhaustivo de DBV Markdown Reader vía agente de exploración de código; clasificación explícita de componentes reutilizables (`ARCHITECTURE.md` §3); dependencias a mantener/sustituir (§4-5); riesgos (§6).
  - [x] **Spec Addendum procesado:** filosofía "Obsidian for Typst", lanzador, modelo de Proyecto, plantillas + marketplace inicial, asistente de creación, asistentes de inserción, outline, modos de escritura, imágenes por arrastre, bibliografía, Project Archive `.dbvt`, re-evaluación Monaco vs. CodeMirror 6 (reconfirmado CM6), roadmap reconciliado.
  - [x] **Additional Specification Clarification procesada:** Package Explorer y Template Explorer separados a nivel de producto; hallazgo técnico de fuente de datos única (`index.json`) tras investigación; detección automática de "Paquetes usados".
  - [x] **TYPST CLI INTEGRATION procesada:** integración vía CLI oficial vendorizado como sidecar (reversión de la decisión anterior de crates embebidas, propagada a §7.6/§7.8/§3/§4-5/§6/§8); terminal avanzado para power users (§7.14).
  - [x] **Research phase dedicado completado** (`docs/TYPST_ECOSYSTEM_RESEARCH.md`): CLI (init/compile/watch/query/update/instalación), sistema de paquetes (manifiesto, resolución, caché, flujo de actualización), Typst Universe (paquetes y plantillas), registros oficiales (`index.json` vs. `api.typst.app` privada), oportunidades de integración. Hallazgos propagados a `ARCHITECTURE.md` y `SPECIFICATIONS.md`.
  - [x] **Feedback de posicionamiento de producto procesado:** dos principios arquitectónicos guía en `ARCHITECTURE.md` §0.1 (Typst=infraestructura/DBV=experiencia; Universe-First); Universe Browser reencuadrado como punto de entrada de primer nivel con árbol de navegación explícito (§7.6.0.1); Capa de Plantillas DBV ampliada (localización, capturas, defaults, validación) y diseño de overlay para enriquecer plantillas comunitarias sin riesgo de desincronización; campos base canónicos del asistente de creación; posicionamiento oficial de producto en `SPECIFICATIONS.md` §2.
  - [ ] Validación del usuario sobre las decisiones anteriores (pendiente).
  - [ ] `docs/DESIGN.md` — sistema de diseño visual (pendiente, opcional en esta fase según `MASTER_PROMPT.md`).

- [ ] **Fase 2: Planificación de implementación (`/plan`)** — **no iniciada por instrucción explícita del usuario** ("Do not start implementation planning until this research report has been completed").
  - [ ] Desglosar el MVP (RF-01 a RF-12 de `SPECIFICATIONS.md` §5) en `implementation_plan.md` con dependencias, riesgos y estrategia de rollback.
  - [ ] Adversarial Architect Review formal sobre el plan del MVP.
  - [ ] Resolver los spikes técnicos pendientes de `SPECIFICATIONS.md` §9 (URL directa de miniaturas/capturas; posición de página en `typst query heading`) antes o al inicio de `/build`.

- [ ] **Fase 3: Construcción (`/build`)** — no iniciada.
- [ ] **Fase 4: Pruebas (`/test`)** — no iniciada.
- [ ] **Fase 5: Simplificar (`/code-simplify`)** — no iniciada.
- [ ] **Fase 6: Entrega (`/ship`)** — no iniciada.

---

## 🔄 Context Snapshot / Snapshot de Contexto

> **Última actualización:** 2026-09-04
> **Punto exacto:** Bootstrap (`26dfdb2`) + informe arquitectónico v1 (`31b5ae4`) + Spec Addendum v2 (`9d100f4`) + Additional Specification Clarification/TYPST CLI INTEGRATION/research phase v3 (`06256c4`) commiteados. Pendiente de commitear en esta misma sesión: feedback de posicionamiento de producto (`ARCHITECTURE.md`/`SPECIFICATIONS.md` v4, `memory.md` actualizado).
> **Pendiente:** Validación del usuario de las decisiones técnicas de `ARCHITECTURE.md` §7 y respuesta a las Preguntas Abiertas de `SPECIFICATIONS.md` §9 (publicación en stores, tamaño de whitelist curada, nombre definitivo de `.dbvt`, crate BibTeX, spikes de miniaturas/outline, UX de catálogo offline-cacheado).
> **Próximo paso:** Si el usuario valida, continuar con `/plan` (desglose de `implementation_plan.md` del MVP, RF-01 a RF-12) y después `/build` (primer slice: shell Tauri + estructura de directorios de `ARCHITECTURE.md` §7.4, portando la infraestructura reutilizable de DBV Markdown Reader, más el vendorizado inicial del sidecar `typst`).
