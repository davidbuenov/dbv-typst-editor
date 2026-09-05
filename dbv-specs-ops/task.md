# Backlog — DBV Typst Editor

## Contexto del Proyecto (Context Snapshot)

* **Objetivo**: Construir "el entorno de escritorio más accesible para el ecosistema Typst" (posicionamiento oficial) — no un editor de código con soporte Typst — orientado a documento/proyecto ("para Typst lo que Obsidian es para Markdown"), ligero, offline-first y multiplataforma, reutilizando al máximo la arquitectura de [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader).
* **Estado actual**: Fases `/spec` y `/plan` **cerradas y congeladas**. **`/build` COMPLETADA: los 10 slices del MVP v0.1 están construidos, verificados y commiteados.** El bucle de valor completo funciona de punta a punta: crear un proyecto desde una plantilla → escribirlo con resaltado Typst → ver el PDF actualizarse solo → guardarlo → exportarlo a PDF.
* **Última decisión técnica**: Ver `memory.md`. Del `/build`: modo de lenguaje Typst por parser Lezer sin WASM (R-02 cerrado), carga perezosa de páginas en la vista previa tras medir 82 MB de SVG en una tesis de 209 páginas (R-03 cerrado), plantillas curadas autocontenidas y con fuentes embebidas, e instalador de WebView2 con variante offline bajo demanda.
* **Próximo paso**: **Fase `/test`** — la cobertura automática actual (75 tests Rust + 28 comprobaciones contra el compilador real) no incluye pruebas de la capa de frontend ni de integración de la ventana. Ver "Pendiente" al final.

## Checklist de Tareas

- [x] **Fase 0: Bootstrap del framework**
  - [x] Copiar `dbv-specs-ops` v2.8.0 a la raíz del proyecto y generar activadores.
  - [x] Rellenar `project.config.md`, generar `README.md` / `README.en.md`, `LICENSE` (MIT), `.gitignore`.
  - [x] `git init` + commit inicial (confirmado explícitamente por el usuario).

- [x] **Fase 1: Especificación y arquitectura (`/spec` + análisis `/plan` inicial)**
  - [x] Análisis exhaustivo de DBV Markdown Reader y clasificación de componentes reutilizables.
  - [x] Spec Addendum, Additional Specification Clarification, TYPST CLI INTEGRATION y feedback de posicionamiento procesados.
  - [x] Research phase dedicado del ecosistema Typst (`docs/TYPST_ECOSYSTEM_RESEARCH.md`).
  - [x] **🔒 Especificaciones y arquitectura CONGELADAS v1.0/v1.1 (2026-09-04).**
  - [ ] `docs/DESIGN.md` — sistema de diseño visual. **Deuda documental consciente:** el sistema visual existe y es coherente (tokens en `src/themes/tokens.css`, layout en `layout.css`), pero no está escrito como documento de diseño. No bloquea nada; conviene escribirlo antes de tocar la interfaz a fondo.

- [x] **Fase 2: Planificación de implementación (`/plan`)** — plan generado y **APROBADO por el usuario** (2026-09-04) con alcance reducido de v0.1.

- [x] **Fase 3: Construcción (`/build`) — COMPLETADA (2026-09-05).** Un commit por slice, la app arrancable al final de cada uno:
  - [x] **Slice 1** — Andamiaje Tauri v2 + Vite + shell (theming, paneles, i18n). ✅ `7a77fe2`
  - [x] **Slice 2** — Sidecar `typst` v0.15.1 verificado contra binario real (8/8). ✅ `8023821`
  - [x] **Decisión de instalador WebView2 cerrada** — `downloadBootstrapper` (18 MB) por defecto + overlay `npm run build:win:offline` (268 MB) para aulas sin conexión. ✅ `bc74407`
  - [x] **Slice 3** — Modelo de Proyecto, explorador y operaciones de proyecto (RF-02, RF-02b, RF-02c). ✅ `5c695d8`
  - [x] **Slice 4** — Editor CodeMirror 6 + lenguaje Typst (RF-05). R-02 cerrado a favor. ✅ `50e72a1`
  - [x] **Slice 5** — Bucle de vista previa SVG (RF-06), con los 4 requisitos del Adversarial Review. R-03 cerrado a favor. ✅ `78fb3bc`
  - [x] **Slice 6** — Guardar / Guardar como / conflicto externo (RF-07). ✅ `dadb582`
  - [x] **Slice 7** — Lanzador orientado a tareas + asistente de creación (RF-01, RF-03). ✅ `08bdf0e`
  - [x] **Slice 8** — Plantillas curadas: Proyecto en blanco, TFG, Artículo académico, CV (RF-04). ✅ `d9800b6`
  - [x] **Slice 9** — Exportación PDF (RF-10). ✅ `d26b257`
  - [x] **Slice 10** — Empaquetado, asociación `.typ` y CI (RF-12). ✅ `ccce34a`

- [ ] **Fase 4: Pruebas (`/test`)** — parcialmente cubierta durante `/build`, no ejecutada como fase.
- [ ] **Fase 5: Simplificar (`/code-simplify`)** — no iniciada.
- [ ] **Fase 6: Entrega (`/ship`)** — no iniciada.

---

## 🔄 Context Snapshot / Snapshot de Contexto

> ### 👉 CÓMO RETOMAR ESTE PROYECTO (leer esto primero)
>
> **Si el usuario dice solo "continuar": el trabajo pendiente es la fase `/test`.** El `/build` del MVP
> está terminado y commiteado, slice a slice. No hay que replanificar ni volver a analizar nada.
>
> **Última sesión:** 2026-09-05 · **Rama:** `master` · **Árbol de trabajo limpio.**
>
> **Aviso de la sesión:** el MVP arrancó con un fallo que ninguna verificación detectaba (un import mal
> usado del paquete de lenguaje Typst). Está corregido y ahora existe `npm run verify:frontend` para esa
> clase de error, pero es la señal de que **la fase `/test` no es opcional**: el frontend es la capa con
> menos red de seguridad del proyecto.

### ✅ Qué funciona hoy (MVP v0.1 completo)

| Funcionalidad | Requisito | Estado |
| --- | --- | --- |
| Lanzador orientado a tareas | RF-01 | ✅ |
| Modelo de Proyecto + explorador | RF-02 | ✅ |
| Proyectos ajenos sin manifiesto | RF-02b | ✅ (y no se escribe nada en su carpeta) |
| Abrir carpeta / Mostrar en el SO / Recientes | RF-02c | ✅ |
| Asistente de creación de proyecto | RF-03 | ✅ |
| 4 plantillas curadas | RF-04 | ✅ |
| Editor Typst (CodeMirror 6) | RF-05 | ✅ |
| Vista previa en tiempo real | RF-06 | ✅ |
| Guardar / Guardar como / conflicto | RF-07 | ✅ |
| Temas claro y oscuro | RF-08 | ✅ |
| Configuración persistente (tema, idioma, anchos, zoom, recientes) | RF-09 | ✅ |
| Exportación PDF | RF-10 | ✅ |
| Empaquetado Windows/Linux + asociación `.typ` | RF-12 | ✅ |
| Project Archive `.dbvt` | RF-11 | ⏸ diferido a v0.2 por decisión de alcance |

### 📊 Verificación disponible (ejecutable, no manual)

```bash
npm test                 # 77 tests del backend Rust
npm run verify:frontend  # 7 comprobaciones: extensiones del editor, parser Typst y elementos del DOM
npm run verify:typst     # 8 comprobaciones del sidecar contra el binario real
npm run verify:templates # 20 comprobaciones: cada plantilla se instancia y compila sin avisos
npm run build:vite       # build del frontend
```

Los cuatro primeros se ejecutan también en CI (`.github/workflows/ci.yml`) en cada push.

### ▶️ PENDIENTE — Fase `/test`

Lo que la cobertura actual **no** cubre y debería cubrir la fase `/test`:

1. **Frontend con cobertura parcial.** `npm run verify:frontend` cubre ya lo que tumbaba el arranque
   (extensiones del editor y elementos del DOM), pero no hay runner de tests de JavaScript para la lógica.
   Candidatos naturales, todos funciones puras ya aisladas a propósito: `validateFields` (wizard),
   `localizeTemplate` (launcher), `joinPath`/`baseName` (workspace) y `normalizeError` (services/backend).
2. **Prueba de integración de la ventana real:** arrancar la app, abrir un proyecto de prueba, teclear y
   comprobar que la vista previa cambia. Hoy es prueba manual.
3. **Escenarios de conflicto (RF-07) en integración:** editar el mismo fichero desde otro programa y
   comprobar las tres ramas (eco propio ignorado, recarga silenciosa, modal de conflicto).
4. **Prueba del instalador generado**, en las dos variantes de Windows y en Linux.

### ⚠️ Deuda técnica registrada durante `/build`

- **`docs/DESIGN.md` sin escribir** (ver Fase 1). El sistema visual existe y es coherente; falta documentarlo.
- **El bundle del frontend son 520 kB** (161 kB gzip), por encima de los 200-400 kB estimados en
  ADR-EDITOR-001. Son los datos de autocompletado de la biblioteca estándar de Typst. Aceptado y
  registrado; si molestase, la vía es cargar el paquete de lenguaje con `import()` dinámico.
- **Sin instancia única ni multiventana.** DBV Markdown Reader tiene ambas (`tauri-plugin-single-instance`);
  aquí, abrir un segundo `.typ` desde el explorador arranca una segunda instancia. No estaba en el alcance
  del MVP, pero es visible para el usuario en cuanto usa la asociación de fichero más de una vez.
- **El espejo de vista previa (`.dbv-preview.typ`)** es un fichero oculto y transitorio en la carpeta del
  usuario mientras hay cambios sin guardar. Filtrado del explorador y del watcher; si la aplicación muriese
  a mitad de una compilación podría quedar uno huérfano (se sobrescribe en el siguiente arranque).

### 🛠️ Comandos útiles

```bash
npm install              # dependencias
npm run vendor:typst     # descarga el sidecar Typst (OBLIGATORIO tras clonar; no se versiona)
npm run dev              # arranca la app (start.cmd / start.sh equivalentes)
./stop.cmd               # cierra app + libera el puerto 1420 de Vite
npm run build            # instalador release (Windows: NSIS ~18 MB)
npm run build:win:offline # variante Windows con WebView2 embebido (~268 MB)
```

### 📌 Reglas vigentes

- **Priorizar software funcionando** sobre refinamiento arquitectónico (regla fijada por el usuario).
- **No reabrir decisiones congeladas** salvo bloqueante real, asunción demostrada falsa, o ADR explícito.
  En los tres casos: **ADR en `memory.md` primero, cambio después.**
- Un commit por slice o por unidad de trabajo cerrada, con la app arrancable al final de cada uno.
