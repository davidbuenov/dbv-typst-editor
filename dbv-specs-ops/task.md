# Backlog — DBV Typst Editor

## Contexto del Proyecto (Context Snapshot)

* **Objetivo**: Construir "el entorno de escritorio más accesible para el ecosistema Typst" (posicionamiento oficial) — no un editor de código con soporte Typst — orientado a documento/proyecto ("para Typst lo que Obsidian es para Markdown"), ligero, offline-first y multiplataforma, reutilizando al máximo la arquitectura de [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader).
* **Estado actual**: Fases `/spec` y `/plan` **cerradas y congeladas** (`SPECIFICATIONS.md` v1.1, `ARCHITECTURE.md` v1.0, ambas con regla de congelación activa). `/build` **en curso**: **Slices 1 y 2 completados, verificados y commiteados**. La aplicación arranca, tiene shell con temas claro/oscuro e i18n ES/EN, y lleva el compilador Typst v0.15.1 embebido como sidecar y respondiendo.
* **Última decisión técnica**: Ver `memory.md` — editor CodeMirror 6 (reconfirmado dos veces), Typst vía CLI oficial como sidecar, principios guía (Typst=infraestructura/DBV=experiencia, Universe-First), Universe Browser, Capa de Plantillas DBV, `.dbvt` como ZIP con protección zip-slip. En el Slice 2 se corrigieron **3 supuestos falsos** del research phase y se **cerró por adelantado el spike del outline**.
* **Próximo paso**: **Slice 3** (ver punto de retorno al final de este fichero).

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

- [x] **Fase 2: Planificación de implementación (`/plan`)** — plan generado y **APROBADO por el usuario** (2026-09-04) con alcance reducido de v0.1.
  - [x] `implementation_plan.md` con frontmatter YAML (dependencies, risks R-01..R-05, rollback_strategy) y desglose en 10 slices.
  - [x] Adversarial Architect Review formal (condición de carrera del bucle de preview con el sidecar `typst` en tesis largas → 4 requisitos obligatorios añadidos al Slice 5).
  - [x] Gate de app nativa compilada resuelto: Linux automatizado por GitHub Actions, Windows manual por el mantenedor, macOS fuera del MVP; paso nuevo de vendorizado del sidecar antes de `tauri build`.
  - [x] Aprobación del usuario del plan y del alcance de v0.1: **alcance reducido** — slices 1-7, slice 8 con 4 plantillas (Proyecto en blanco, TFG, Artículo académico, CV), slice 9 solo PDF, slice 10. `.dbvt` y las 4 plantillas restantes → v0.2.

- [ ] **Fase 3: Construcción (`/build`)** — EN CURSO. Desglose por slices (ver `implementation_plan.md` §3):
  - [x] **Slice 1 — Andamiaje Tauri v2 + Vite + shell (theming, paneles, i18n).** ✅ Verificado: `cargo check` limpio, 2 tests Rust en verde, `vite build` OK (4,7 kB JS + 3,6 kB CSS), `npm run dev` arranca la ventana sin errores ni warnings y el `invoke('app_info')` responde — **R-04 (convivencia Vite ↔ `withGlobalTauri`) descartado**. RAM en reposo medida: ~33 MB.
  - [x] **Slice 2 — Sidecar `typst` verificado contra binario real.** ✅ Typst v0.15.1 vendorizado (`scripts/vendor-typst.mjs`), módulo `typst_engine` con error tipado, comando `typst_version` operativo en la app, y `scripts/verify-typst-sidecar.mjs` con **8/8 comprobaciones en verde** (re-ejecutable con `npm run verify:typst`). **3 supuestos del research phase resultaron falsos y están corregidos** (ver `memory.md`); el **spike del outline quedó cerrado a favor**, adelantándose a Beta. Riesgo R-05 mitigado. **Instalador medido: 18 MB** (por debajo del objetivo original de 30 MB) tras detectar que `offlineInstaller` de WebView2 —heredado de dbv-md-reader— lo inflaba a 268 MB; R-01 cerrado con dato real.
  - [ ] **Slice 3 — Modelo de Proyecto + explorador + operaciones de proyecto. ⬅️ SIGUIENTE** (detalle al final de este fichero).
  - [ ] Slice 4 — Editor CodeMirror 6 + lenguaje Typst.
  - [ ] Slice 5 — Bucle de vista previa SVG (cancelación, token de generación, TempDir, última vista buena).
  - [ ] Slice 6 — Guardar / Guardar como / conflicto externo.
  - [ ] Slice 7 — Lanzador orientado a tareas + asistente de creación de proyecto.
  - [ ] Slice 8 — Plantillas curadas de v0.1: Proyecto en blanco, TFG, Artículo académico, CV.
  - [ ] Slice 9 — Exportación PDF (`.dbvt` diferido a v0.2).
  - [ ] Slice 10 — Empaquetado Windows/Linux y CI.

- [ ] **Fase 4: Pruebas (`/test`)** — no iniciada.
- [ ] **Fase 5: Simplificar (`/code-simplify`)** — no iniciada.
- [ ] **Fase 6: Entrega (`/ship`)** — no iniciada.

---

## 🔄 Context Snapshot / Snapshot de Contexto

> ### 👉 CÓMO RETOMAR ESTE PROYECTO (leer esto primero)
>
> **Si el usuario dice solo "continuar": el trabajo pendiente es el SLICE 3.** No hay que replanificar
> nada ni volver a analizar: las fases `/spec` y `/plan` están cerradas y congeladas, y los slices 1 y 2
> están terminados, verificados y commiteados. Entra directamente en `/build` por el Slice 3.
>
> **Última sesión:** 2026-09-04 · **Rama:** `master` · **Árbol de trabajo limpio, sin cambios sin commitear.**

### ✅ Hecho hasta ahora

| Fase | Estado |
| --- | --- |
| Bootstrap del framework (dbv-specs-ops v2.8.0) | ✅ commit `26dfdb2` |
| Análisis de reutilización de DBV Markdown Reader | ✅ commit `31b5ae4` |
| 4 rondas de refinamiento de specs con el usuario | ✅ commits `9d100f4`, `06256c4`, `10558f2` |
| Congelación de specs + `implementation_plan.md` (10 slices) | ✅ commit `445fe9d` |
| **Slice 1** — Andamiaje Tauri v2 + Vite + shell | ✅ commit `7a77fe2` |
| **Slice 2** — Sidecar Typst verificado + `typst_engine` | ✅ commit `8023821` |

### ▶️ SLICE 3 — lo que toca hacer ahora

**Modelo de Proyecto, explorador de ficheros y operaciones de proyecto** (RF-02, RF-02b, RF-02c de
`docs/SPECIFICATIONS.md`; detalle en `implementation_plan.md` §3).

1. **Portar de DBV Markdown Reader** (`d:/Programacion/github-davidbuenov/dbv-md-reader/src-tauri/src/lib.rs`,
   con las referencias de línea en `docs/ARCHITECTURE.md` §3): watcher `notify` sobre el **directorio padre**
   (no el fichero), `list_directory`, recent-files → recent-**projects**, `read_file`/`write_file`
   (sin la rama de descarga remota), `open_file_dialog` (filtro `.typ`) y `reveal_in_file_manager`.
2. **Crear `src-tauri/src/project.rs`**: `create_project`, `open_project`, `read_project_manifest`
   (`settings/dbv-project.toml`, **opcional**). Un `.typ` suelto = proyecto de un solo fichero.
3. **RF-02b (crítico, restricción R-MVP-3):** abrir un repositorio Git clonado o un proyecto Typst ajeno
   debe funcionar **igual de bien y sin que la app escriba el manifiesto por su cuenta**.
4. **RF-02c:** Abrir carpeta de proyecto · Mostrar carpeta en el explorador del SO · Proyectos recientes.
5. **Portar `filetree.js`** (`dbv-md-reader/src/filetree.js`) como explorador de proyecto, adaptado a ESM.
6. **Criterio de aceptación:** abrir una carpeta con `main.typ` **sin manifiesto DBV** muestra el árbol y
   permite editar/compilar igual que un proyecto creado por la app; los tres comandos de RF-02c funcionan;
   los tests Rust de las funciones puras portadas pasan.

### ⚠️ Pendiente de decisión del usuario (NO bloquea el Slice 3)

**Modo de instalación de WebView2 en Windows.** Se eligió `downloadBootstrapper` (instalador de **18 MB**)
frente al `offlineInstaller` heredado de dbv-md-reader (**268 MB**, pero instala sin conexión). Contrapartida:
con el bootstrapper, instalar en una máquina que a la vez carezca de WebView2 y de red falla. Revertir es una
línea en `src-tauri/tauri.windows.conf.json`. Detalle en `docs/ARCHITECTURE.md` §7.15.

### 🛠️ Comandos útiles

```bash
npm install              # dependencias (ya instaladas)
npm run vendor:typst     # descarga el sidecar Typst (OBLIGATORIO tras clonar; no se versiona)
npm run verify:typst     # 8 comprobaciones del sidecar contra el binario real
npm run dev              # arranca la app (start.cmd / start.sh equivalentes)
./stop.cmd               # cierra app + libera el puerto 1420 de Vite
npm test                 # tests Rust (5 en verde ahora mismo)
npm run build            # instalador release
```

### 📌 Reglas vigentes en `/build`

- **Priorizar software funcionando** sobre refinamiento arquitectónico (regla fijada por el usuario).
- **No reabrir decisiones congeladas** salvo bloqueante real, asunción del research phase demostrada falsa,
  o ADR explícito. En los tres casos: **ADR en `memory.md` primero, cambio después.**
- Un commit por slice, con la app arrancable al final de cada uno.
