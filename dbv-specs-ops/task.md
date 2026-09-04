# Backlog — DBV Typst Editor

## Contexto del Proyecto (Context Snapshot)

* **Objetivo**: Construir "el entorno de escritorio más accesible para el ecosistema Typst" (posicionamiento oficial) — no un editor de código con soporte Typst — orientado a documento/proyecto ("para Typst lo que Obsidian es para Markdown"), ligero, offline-first y multiplataforma, reutilizando al máximo la arquitectura de [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader).
* **Estado actual**: Bootstrap del framework `dbv-specs-ops` v2.8.0 completado. `docs/ARCHITECTURE.md` y `docs/SPECIFICATIONS.md` en v4, incorporando cuatro rondas de refinamiento del usuario (2026-09-04): **Spec Addendum**, **Additional Specification Clarification**, **TYPST CLI INTEGRATION** (con research phase dedicado, `docs/TYPST_ECOSYSTEM_RESEARCH.md`) y **feedback de posicionamiento de producto** (principios arquitectónicos guía, Universe Browser como punto de entrada de primer nivel, Capa de Plantillas DBV ampliada). **Ningún código de aplicación escrito todavía.**
* **Última decisión técnica**: Ver `memory.md` — editor CodeMirror 6 (reconfirmado dos veces), integración con Typst vía CLI oficial como sidecar, dos principios arquitectónicos guía (reparto de responsabilidades Typst↔DBV, Universe-First), Universe Browser (Plantillas + Paquetes, mismo nivel de navegación), Capa de Plantillas DBV (`dbv-template.toml`) ampliada con localización/capturas/defaults/validación, campos base del asistente de creación estandarizados, `.dbvt` como ZIP con protección zip-slip, terminal avanzado. Registradas 2026-09-04.
* **Próximo paso**: Aprobación del usuario del `implementation_plan.md` (10 slices) y del alcance de v0.1, para iniciar `/build` por el Slice 1.

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
  - [x] **Architecture Review final entregado** (decisiones, ADRs, asunciones, spikes, riesgos, alcance MVP recomendado).
  - [x] **🔒 Especificaciones y arquitectura CONGELADAS v1.0 (2026-09-04).** Cambios posteriores exigen ADR en `memory.md` + nueva versión del documento + revisión de impacto en `implementation_plan.md`.
  - [ ] `docs/DESIGN.md` — sistema de diseño visual (pendiente, opcional en esta fase según `MASTER_PROMPT.md`; se abordará antes del Slice 4).

- [x] **Fase 2: Planificación de implementación (`/plan`)** — plan generado, **pendiente de aprobación explícita del usuario para iniciar `/build`**.
  - [x] `implementation_plan.md` con frontmatter YAML (dependencies, risks R-01..R-05, rollback_strategy) y desglose en 10 slices.
  - [x] Adversarial Architect Review formal (condición de carrera del bucle de preview con el sidecar `typst` en tesis largas → 4 requisitos obligatorios añadidos al Slice 5).
  - [x] Gate de app nativa compilada resuelto: Linux automatizado por GitHub Actions, Windows manual por el mantenedor, macOS fuera del MVP; paso nuevo de vendorizado del sidecar antes de `tauri build`.
  - [ ] Aprobación del usuario del plan y del alcance de v0.1 (completo RF-01..RF-12 vs. recomendación acotada de §4 del plan).

- [ ] **Fase 3: Construcción (`/build`)** — desglose por slices (ver `implementation_plan.md` §3):
  - [x] **Slice 1 — Andamiaje Tauri v2 + Vite + shell (theming, paneles, i18n).** ✅ Verificado: `cargo check` limpio, 2 tests Rust en verde, `vite build` OK (4,7 kB JS + 3,6 kB CSS), `npm run dev` arranca la ventana sin errores ni warnings y el `invoke('app_info')` responde — **R-04 (convivencia Vite ↔ `withGlobalTauri`) descartado**. RAM en reposo medida: ~33 MB.
  - [x] **Slice 2 — Sidecar `typst` verificado contra binario real.** ✅ Typst v0.15.1 vendorizado (`scripts/vendor-typst.mjs`), módulo `typst_engine` con error tipado, comando `typst_version` operativo en la app, y `scripts/verify-typst-sidecar.mjs` con **8/8 comprobaciones en verde** (re-ejecutable con `npm run verify:typst`). **3 supuestos del research phase resultaron falsos y están corregidos** (ver `memory.md`); el **spike del outline quedó cerrado a favor**, adelantándose a Beta. Riesgo R-05 mitigado. **Instalador medido: 18 MB** (por debajo del objetivo original de 30 MB) tras detectar que `offlineInstaller` de WebView2 —heredado de dbv-md-reader— lo inflaba a 268 MB; R-01 cerrado con dato real.
  - [ ] Slice 3 — Modelo de Proyecto + explorador de ficheros.
  - [ ] Slice 4 — Editor CodeMirror 6 + lenguaje Typst.
  - [ ] Slice 5 — Bucle de vista previa SVG (cancelación, token de generación, TempDir, última vista buena).
  - [ ] Slice 6 — Guardar / Guardar como / conflicto externo.
  - [ ] Slice 7 — Lanzador orientado a tareas + asistente de creación de proyecto.
  - [ ] Slice 8 — Plantillas curadas (3 núcleo / +4 ampliación).
  - [ ] Slice 9 — Exportación PDF (núcleo) + Project Archive `.dbvt` (ampliación).
  - [ ] Slice 10 — Empaquetado Windows/Linux y CI.

- [ ] **Fase 3: Construcción (`/build`)** — no iniciada.
- [ ] **Fase 4: Pruebas (`/test`)** — no iniciada.
- [ ] **Fase 5: Simplificar (`/code-simplify`)** — no iniciada.
- [ ] **Fase 6: Entrega (`/ship`)** — no iniciada.

---

## 🔄 Context Snapshot / Snapshot de Contexto

> **Última actualización:** 2026-09-04
> **Punto exacto:** Fases `/spec` y `/plan` cerradas. `SPECIFICATIONS.md` y `ARCHITECTURE.md` **congelados en v1.0**; `implementation_plan.md` generado con 10 slices, Adversarial Architect Review y gate de CI multiplataforma resuelto. Commits: bootstrap (`26dfdb2`), informe arquitectónico (`31b5ae4`), Spec Addendum (`9d100f4`), clarificación + CLI + research (`06256c4`), posicionamiento + Universe Browser (`10558f2`), congelación + plan (este).
> **Pendiente:** **Aprobación explícita del usuario** del plan y del alcance de v0.1 — completo (RF-01..RF-12) o acotado según la recomendación de `implementation_plan.md` §4 (3 plantillas en vez de 7, `.dbvt` diferido a v0.2). Preguntas abiertas restantes de `SPECIFICATIONS.md` §9 no bloquean el MVP (ver `implementation_plan.md` §5); se asume `.dbvt` como extensión salvo indicación contraria.
> **Próximo paso:** **Slice 3 — Modelo de Proyecto, explorador de ficheros y operaciones de proyecto** (RF-02, RF-02b, RF-02c): portar de DBV Markdown Reader el watcher `notify`, `list_directory`, recent-files→recent-projects, `read_file`/`write_file`, `open_file_dialog` y `reveal_in_file_manager`; añadir `project.rs` con manifiesto **opcional**; y garantizar que un repositorio Git clonado o un proyecto Typst ajeno se abre sin diferencias y **sin que la app le escriba nada**.
>
> **Pendiente de confirmación (no bloquea):** modo de instalación de WebView2 en Windows — `downloadBootstrapper` (18 MB, elegido) frente al `offlineInstaller` heredado de dbv-md-reader (268 MB, instala sin red). Ver `ARCHITECTURE.md` §7.15.
