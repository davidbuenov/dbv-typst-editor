# Backlog — DBV Typst Editor

## Contexto del Proyecto (Context Snapshot)

* **Objetivo**: Construir "el entorno de escritorio más accesible para el ecosistema Typst" (posicionamiento oficial) — no un editor de código con soporte Typst — orientado a documento/proyecto ("para Typst lo que Obsidian es para Markdown"), ligero, offline-first y multiplataforma, reutilizando al máximo la arquitectura de [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader).
* **Ubicación**: `d:/Programacion/github-davidbuenov/dbv-typst-editor` (renombrado el 2026-09-05 desde `dbv-academic-writer` para cerrar la ambigüedad con el nombre oficial del producto; si esa ruta no existe, probar el nombre antiguo).
* **Estado actual**: Fases `/spec` y `/plan` **cerradas y congeladas**. **`/build` COMPLETADA: los 10 slices del MVP v0.1 están construidos, verificados y commiteados.** El bucle de valor completo funciona de punta a punta: crear un proyecto desde una plantilla → escribirlo con resaltado Typst → ver el PDF actualizarse solo → guardarlo → exportarlo a PDF.
* **Última decisión técnica**: Ver `memory.md`. Del `/build`: modo de lenguaje Typst por parser Lezer sin WASM (R-02 cerrado), carga perezosa de páginas en la vista previa tras medir 82 MB de SVG en una tesis de 209 páginas (R-03 cerrado), plantillas curadas autocontenidas y con fuentes embebidas, e instalador de WebView2 con variante offline bajo demanda.
* **Próximo paso**: `/build`, `/test`, `/code-simplify` y la documentación de `/ship` de v0.1.0 están cerrados (2026-09-05: 110 tests automáticos — 33 Vitest + 77 Rust —, 0 hallazgos Críticos, remoto configurado con CI en verde). Queda una **decisión de publicación** (etiquetar `v0.1.0` y publicar la Release) y, como siguiente trabajo técnico, el **Slice 11 (RF-13, v0.2)**. Ver Context Snapshot.

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

- [x] **Slice 11 — RF-13, Barra de herramientas de inserción del editor — COMPLETADO (2026-09-05).** Subida de Beta a v0.2 a petición del usuario: sin ella el producto contradice su principio nº2 ("el usuario no debe ver código si no quiere") y es una regresión frente a DBV Markdown Reader. ADR-EDITOR-002 · `SPECIFICATIONS.md` v1.2 RF-13 · `ARCHITECTURE.md` §7.7.
  - `src/editor/toolbarActions.js`: tabla de 21 acciones como dato (no `switch`), cada una con `buildTransaction(state)` puro y testable sin DOM. Envolver + alternancia (marcadores simétricos y asimétricos), listas/encabezados con familias mutuamente excluyentes, plantillas con hueco para enlace/figura/tabla/ecuación/etc., y `isInsideMath()` vía el árbol Lezer real para la sensibilidad al contexto.
  - `src/editor/toolbar.js`: capa DOM fina — pinta los botones, aplica la transacción con `view.dispatch`, refresca tooltips en cambio de idioma y deshabilita/reordena grupos dentro de una ecuación.
  - `editor.js`: `buildToolbarKeymap()` añade los 7 atajos (Mod-b/i/e/k, Mod-Shift-1/2/3) al keymap de CodeMirror; `getView()` y `onSelectionChange` nuevos en el contrato del editor.
  - **24 tests nuevos** (`toolbarActions.test.js`) — 57/57 Vitest + 77/77 Rust en verde tras el cambio.
  - **Decisión de alcance registrada:** no todas las ~21 acciones tienen atajo de teclado — el modelo de interacción principal es el clic (así lo enmarca la propia arquitectura, §7.7.4); asignar 21 combinaciones sin colisión no aportaba valor proporcional al riesgo.
  - **Deuda pendiente heredada de ADR-EDITOR-002, sin resolver en este slice:** los glifos de los botones y la comparación con la barra del editor web oficial de Typst siguen sin verificarse contra la aplicación real — se implementó el objetivo de producto documentado, no una réplica comprobada.
  - **✅ Validado en ventana real por el usuario (2026-09-05), con 2 fallos encontrados y corregidos en la misma sesión** — confirma exactamente la lección de la fase `/test`: ninguno de los 57 tests de Vitest ni las 8 comprobaciones de `verify:frontend` los detectaba.
    1. Pulsar sobre una cita/referencia cruzada insertada por la barra reventaba la app entera (`TypeError: r.href.startsWith is not a function`). Causa: los `<a>` que Typst incrusta en el SVG para citas/referencias son elementos SVG reales sin `href`, y `SVGAElement.href` siempre devuelve un `SVGAnimatedString`, nunca una cadena. Corregido en `preview.js` (fase de captura sobre el contenedor de páginas).
    2. El zoom por encima del 100% recortaba el documento de forma asimétrica al hacer scroll (hueco a la derecha, contenido inaccesible a la izquierda). Causa: `align-items: center` en un flex con overflow no reparte el desbordamiento por igual en Chromium. Corregido con `margin-inline: auto`.
  - **Mejora pedida, no implementada todavía:** que el botón "Cite" abra un desplegable con las claves reales del `.bib` del proyecto. Ya está en el alcance — es literalmente el asistente "Insertar cita con autocompletado" de `ARCHITECTURE.md` §7.7.4, agendado para **Beta** (necesita parseo de BibTeX + UI de desplegable, más trabajo que un botón de la barra). Pendiente de que el usuario decida si se adelanta a v0.2, como se hizo con RF-13, o se deja en Beta.
  - [x] **Slice 12 — Project Archive `.dbvt` (RF-11) — COMPLETADO (2026-09-05).** Diseño cerrado en `ARCHITECTURE.md` §7.12, sin re-análisis. `src-tauri/src/archive.rs`: ZIP con `manifest.json` propio (versión de la app, del compilador, plantilla de origen); import con doble comprobación anti zip-slip (`enclosed_name()` de la crate `zip` + verificación independiente de que la ruta resuelta sigue dentro del destino). 8 tests nuevos (incluida la entrada maliciosa `../fuera-del-proyecto.typ`, rechazada). UI: "Exportar proyecto" en las acciones de proyecto, "Importar proyecto" en el lanzador. Verificación: 83/83 Rust, 57/57 Vitest, build y `verify:frontend` (8/8, 58 elementos) en verde.
  - [x] **Slice 13 — 4 plantillas restantes (RF-04, v0.2) — COMPLETADO (2026-09-05).** TFM (estructura de TFG, misma normativa en la práctica), Tesis doctoral (dedicatoria, agradecimientos, resumen + abstract bilingüe, 5 capítulos, apéndice con numeración propia), Informe técnico (más ligero: sin portada a toda página, resumen ejecutivo destacado, cabecera repetida por página) y Presentación (diapositivas 16:9 **sin ningún paquete de Typst Universe** — usa el preset nativo `presentation-16-9`, coherente con que las plantillas de v0.1 ya eran autocontenidas). Catálogo: 4 → 8 plantillas. `npm run verify:templates`: 40/40 en verde. Test de Rust que fijaba la lista de v0.1 actualizado a las 8 de v0.2.

- [x] **Fase 4: Pruebas (`/test`) — cerrada el 2026-09-05**, con alcance explícitamente acotado (ver decisión de alcance debajo):
  - [x] **Cobertura de lógica del frontend** (era cero antes de esta fase): Vitest + jsdom, 33 tests sobre las funciones puras ya aisladas — `isTypstPath`/`joinPath`/`baseName`, `validateFields`, `localizeTemplate`, el contrato `Result` de `call()`. `commit 94aaad5`.
  - [x] **Verificación completa en verde tras el cambio**: 33/33 Vitest · 77/77 Rust · `build:vite` · `verify:frontend` 8/8.
  - [x] **Lección de la fase registrada en `memory.md`**: interacción `mockReset()` manual + `restoreMocks: true` que hacía parecer un fallo del código de producción.
  - [ ] ⏸ **Diferido conscientemente, no bloquea `/ship` v0.1.0** (ver razón en cada punto):
    - Prueba de integración de ventana real (arrancar la app, escribir, comprobar que la vista previa cambia). Razón: exige `tauri-driver` + WebDriver de Edge/WebKitGTK, infraestructura no montada aún y con alto riesgo de fragilidad cross-plataforma; ya está **validada a mano por el usuario** (ver Context Snapshot). Candidato a Beta, cuando el terminal avanzado y el Universe Browser obliguen de todos modos a automatizar la ventana.
    - Los tres escenarios de conflicto de RF-07 en integración. Misma razón — cubiertos hoy por prueba manual + la lógica ya testeada de `workspace.js`.
    - Prueba del instalador generado en las dos variantes de Windows y en Linux. Razón: exige máquinas limpias sin WebView2/deps preinstaladas; el instalador de Linux ni siquiera se ha generado nunca (`release-linux.yml` solo dispara con tags `v*.*.*`).

- [x] **Fase 5: Simplificar (`/code-simplify`) — cerrada el 2026-09-05.** Revisión de tres pases de `docs/REVIEW.md` sobre el estado del repo (construcción de argumentos del sidecar `typst`, `reveal_in_file_manager`, manejo de rutas, secretos): **0 hallazgos Críticos.** 1 hallazgo Importante — `baseName()` duplicada en `app/workspace.js` y `launcher/launcher.js` — corregido (launcher importa la de workspace). Registrado en `CHANGELOG.md`.
- [x] **Fase 6: Entrega (`/ship`) — cerrada el 2026-09-05** en lo que es documentación: README raíz actualizado, `walkthrough.md` completado, gate de `/code-simplify` satisfecho (0 Críticos), `CHANGELOG.md` con sección fechada `[0.1.0] - 2026-09-05`. **No incluye** crear el tag `v0.1.0` ni publicar la Release de GitHub — acción de mayor alcance, dispara `release-linux.yml` y produce artefactos públicos, dejada pendiente de confirmación explícita del usuario.

- [ ] **Fase 7: Beta (v0.2–v0.4) — en curso desde el 2026-09-05.** Sesión autónoma ("avanza todo lo que puedas hasta la versión Beta"), sin el usuario disponible para resolver ambigüedades: se prioriza lo ya especificado sin preguntas abiertas, en slices verificados uno a uno, y se deja explícitamente fuera lo que exige una decisión del usuario o infraestructura no disponible aquí (ver "Deliberadamente fuera de esta sesión" al final de esta fase).
  - [x] **Slice 16 — Asistente "Insertar cita" con autocompletado (§7.7.4) — COMPLETADO (2026-09-05).** Es la mejora que el usuario pidió explícitamente al validar el Slice 11 en la ventana real ("cuando se pulsa sobre Cite debería salir un desplegable con las citas disponibles"); confirmó dejarla "donde estuviera planificado" (Beta), y esta sesión llegó hasta ahí. `src-tauri/src/bibliography.rs`: extrae solo las CLAVES de los `.bib` de la raíz del proyecto con un escaneo de texto ligero (`@tipo{clave,`) — a propósito **no** un parser BibTeX completo, así que no reabre la pregunta pendiente de `SPECIFICATIONS.md` §9 sobre qué crate usar (esa pregunta es para leer los CAMPOS de cada entrada, que este asistente no necesita). Mismo patrón que la detección de "Paquetes usados" del Package Explorer (Beta, §7.6.2), que abandonó un parser completo por el mismo motivo. Frontend: el botón "Cite" de la barra (antes insertaba un marcador genérico) ahora abre un desplegable filtrable posicionado bajo el propio botón; elegir una clave inserta `#cite(<clave>)`. 8 tests nuevos en Rust. Verificación: 97/97 Rust, 57/57 Vitest, `verify:frontend` (8/8, 65 elementos).
  - [x] **Slice 15 — Exportación PNG, alcance "página actual" (§7.12) — COMPLETADO (2026-09-05).** Verificado contra el binario real que `--pages N` con una sola página acepta un nombre de fichero normal como salida (el patrón `{p}`/`{0p}` solo hace falta para exportar más de una imagen a la vez, que no es el caso). Botón junto a "Exportar PDF"; exporta la página que se está leyendo en ese momento en la vista previa. **No cubre** rango de páginas ni documento completo (multi-PNG) — quedaría para un slice propio, con selector de rango y patrón de nombre de fichero, más scope del que aporta este slice.
  - [x] **Slice 14 — Panel de navegación estructural / Outline (§7.8) — COMPLETADO (2026-09-05).** Spike de `typst eval` del Slice 2 llevado a producción, con dos sorpresas del binario real absorbidas en `typst_engine/outline.rs`: el cuerpo del encabezado no es una cadena (es contenido Typst serializado, `{"func":"text","text":...}` o una `sequence` si mezcla estilos — se aplana recursivamente) y la coordenada `y` llega como cadena con unidad (`"70.87pt"`), no como número. Comando `typst_outline` reutiliza `prepare_input` de `compile.rs` (ahora `pub(crate)`) para ver también los cambios sin guardar, igual que la vista previa. Frontend: panel flotante junto al árbol de proyecto, clic→navegación **a la vista previa** (página + desplazamiento vertical, con el `heightPt` real de cada página aunque su SVG no haya cargado todavía). **No cubre** clic→navegación en el editor: mapear posición de PDF a posición de texto fuente es la sincronización "por posición real" que `ARCHITECTURE.md` ya deja aparte, más adelante en Beta. 6 tests nuevos en Rust, incluida la deserialización de una salida real capturada del binario. Verificación: 89/89 Rust, 57/57 Vitest, `verify:frontend` (8/8, 61 elementos).

---

## 🔄 Context Snapshot / Snapshot de Contexto

> ### 👉 CÓMO RETOMAR ESTE PROYECTO (leer esto primero)
>
> **`/build`, `/test`, `/code-simplify` y la parte documental de `/ship` están cerrados para v0.1.0.**
> Si el usuario dice solo "continuar", lo pendiente es una decisión suya, no trabajo técnico: **¿se etiqueta
> `v0.1.0` y se publica la Release?** (ver "Decisión pendiente" más abajo). Si la respuesta es no o se
> aplaza, el siguiente trabajo técnico es el **Slice 11 (RF-13, barra de herramientas del editor, v0.2)**.
>
> **Última sesión:** 2026-09-05 · **Rama:** `master` · remoto `origin` = `github.com/davidbuenov/dbv-typst-editor` (público) · **Árbol de trabajo limpio tras el push.**
>
> **✅ MVP VALIDADO A MANO POR EL USUARIO (2026-09-05).** Probó el bucle completo en la aplicación real
> y funciona. Es la primera confirmación de producto, no solo de tests.
>
> **Decisión pendiente — crear el tag `v0.1.0` y publicar la Release.** No se hizo en esta sesión a
> propósito: es una acción de mayor alcance que documentar la versión en `CHANGELOG.md` (ya hecho) —
> dispara `release-linux.yml`, genera artefactos públicos descargables (AppImage, `.deb`) y, para
> Windows, exige subir el instalador a mano al borrador de Release. Ver `walkthrough.md` de esta sesión.
>
> **Aviso permanente (de la sesión anterior, sigue vigente):** los tres fallos que aparecieron al usar la
> app de verdad (arranque muerto por un import mal usado, `window.confirm` sin permiso, y la vista previa
> intentando compilar `refs.bib`) no los detectó ninguna verificación automática de entonces. Siguen
> corregidos; `npm run verify:frontend` cubre ya sus categorías y esta sesión añadió 33 tests de lógica
> de frontend (antes, cero) — pero el frontend sigue siendo la capa con menos red de seguridad del
> proyecto, y las pruebas de integración de ventana real (ver más abajo) siguen sin automatizar.

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
npm test                 # 33 tests de lógica del frontend (Vitest) + 77 del backend Rust
npm run verify:frontend  # 8 comprobaciones: extensiones del editor, parser Typst, elementos del DOM y ausencia de diálogos nativos
npm run verify:typst     # 8 comprobaciones del sidecar contra el binario real
npm run verify:templates # 20 comprobaciones: cada plantilla se instancia y compila sin avisos
npm run build:vite       # build del frontend
```

Los cuatro primeros se ejecutan también en CI (`.github/workflows/ci.yml`) en cada push.

### ⏸ Diferido conscientemente de la fase `/test` (no bloquea `/ship`)

1. **Prueba de integración de la ventana real:** arrancar la app, abrir un proyecto de prueba, teclear y
   comprobar que la vista previa cambia. Razón: exige `tauri-driver` + WebDriver (Edge/WebKitGTK), infraestructura
   no montada aún y con riesgo de fragilidad cross-plataforma; el flujo ya está validado a mano por el usuario.
2. **Escenarios de conflicto (RF-07) en integración:** editar el mismo fichero desde otro programa y
   comprobar las tres ramas (eco propio ignorado, recarga silenciosa, modal de conflicto). Misma razón —
   cubiertos hoy por prueba manual más la lógica ya testeada de `workspace.js`.
3. **Prueba del instalador generado**, en las dos variantes de Windows y en Linux. Razón: exige máquinas
   limpias sin WebView2/deps preinstaladas; el instalador de Linux ni siquiera se ha generado nunca.

### ✅ Infraestructura resuelta (2026-09-05)

**Remoto configurado y código empujado.** `origin` = `https://github.com/davidbuenov/dbv-typst-editor` (repositorio **público**, creado por el usuario). `git push -u origin master` hecho: 147 ficheros, sin `node_modules`, `dist`, binarios ni claves. `ci.yml` dispara con `["master", "main"]`, así que no hizo falta renombrar la rama. **`ci.yml` se ha ejecutado por primera vez y pasa en verde** (run `33957280085`, 6/6 pasos: tests de backend, build del frontend, verify:frontend, verify:typst, verify:templates y compilación de los ficheros de prueba) — deja de estar "verificado solo por lectura". `release-linux.yml` sigue sin ejecutarse nunca: dispara con tags `v*.*.*`, así que su primera ejecución real será en `/ship`.

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

### 🧭 Pasos siguientes acordados (orden recomendado)

1. ~~**Crear el repositorio remoto y empujar.**~~ ✅ **HECHO el 2026-09-05.**
2. ~~**Fase `/test`.**~~ ✅ **CERRADA el 2026-09-05** — 33 tests de frontend nuevos; 3 puntos diferidos a propósito (ver arriba).
3. ~~**Fase `/code-simplify`.**~~ ✅ **CERRADA el 2026-09-05** — 0 hallazgos Críticos, 1 Importante corregido.
4. ~~**Fase `/ship` v0.1.0 (documentación).**~~ ✅ **CERRADA el 2026-09-05** — README, `walkthrough.md`, `CHANGELOG.md` con sección `[0.1.0]`.
5. **Decisión pendiente del usuario:** etiquetar `v0.1.0` (`git tag` + Release de GitHub, con el instalador de Windows subido a mano). No es trabajo técnico nuevo — es una decisión de publicación.
6. **Slice 11 (RF-13, v0.2)** — barra de herramientas del editor. Diseño ya cerrado en `ARCHITECTURE.md` §7.7, listo para construir sin re-análisis.

*Candidatos que pueden colarse antes del Slice 11 si el usuario lo prefiere:* **instancia única** (con la
asociación `.typ` ya activa, abrir dos documentos lanza dos instancias — es el defecto de producto más
visible que queda) y **`docs/DESIGN.md`**.

### 📜 Commits de la sesión del 2026-09-05

| Commit | Qué |
| --- | --- |
| `bc74407` | Decisión de WebView2 cerrada (ligero por defecto + variante offline) |
| `5c695d8` · `50e72a1` · `78fb3bc` | Slices 3, 4 y 5 |
| `dadb582` · `08bdf0e` · `d9800b6` | Slices 6, 7 y 8 |
| `d26b257` · `ccce34a` | Slices 9 y 10 |
| `9a660e7` | 3 defectos de la revisión propia (historial de deshacer, página visible, separador de ruta) |
| `2ca1328` | **Fallo de arranque** + `verify:frontend` |
| `1590fb9` | Ficheros de prueba en `testfiles/` |
| `36e5e7c` | `dialog.confirm` sin permiso + vista previa compilando el `.bib` |
| `2039359` · `8785298` · `a383df6` | Documentación: punto de retorno, validación manual, renombrado |

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
