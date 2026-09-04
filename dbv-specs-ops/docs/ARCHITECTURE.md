# 🏗 Arquitectura Técnica: DBV Typst Editor

> **Fase:** `/plan` (Planificación Técnica) — Informe de análisis de reutilización sobre DBV Markdown Reader
> **Estado:** 🔒 **CONGELADO v1.0 — 2026-09-04** (baseline arquitectónica para el MVP, validada en el Architecture Review final). Incorpora Spec Addendum, Additional Specification Clarification, TYPST CLI INTEGRATION, el research phase dedicado y el feedback de posicionamiento del usuario.
> **Regla de congelación:** las decisiones de §7 son la línea base de `/build`. Cualquier desviación descubierta durante la implementación exige registrar un ADR en `memory.md` **antes** de implementarla, y actualizar este documento — no se cambia la arquitectura de facto en el código.
> **Última Revisión:** 2026-09-04
> **Fuente analizada:** `d:/Programacion/github-davidbuenov/dbv-md-reader` (v0.15.0, commit `23fccad`) + investigación del ecosistema Typst en [`TYPST_ECOSYSTEM_RESEARCH.md`](./TYPST_ECOSYSTEM_RESEARCH.md)

---

## 0. Resumen ejecutivo

DBV Markdown Reader es una base de reutilización **excelente en infraestructura de aplicación** (shell Tauri, ciclo de vida de ficheros, empaquetado, auto-actualización, i18n, theming) pero **insuficiente en el núcleo de edición**: es fundamentalmente un *visor* con capacidad de edición mínima (un `<textarea>` plano), mientras que DBV Typst Editor necesita ser una herramienta de escritura orientada a documento/proyecto desde el día 1 (ver Spec Addendum en `SPECIFICATIONS.md` §2: "para Typst lo que Obsidian es para Markdown", no un editor de código para desarrolladores). La integración con Typst en sí se resuelve **vía el CLI oficial vendorizado como sidecar de Tauri** (§7.2, decisión explícita del usuario, respaldada por la investigación de `TYPST_ECOSYSTEM_RESEARCH.md`), no embebiendo las crates Rust del compilador.

### 0.1. Principios arquitectónicos guía

Confirmados explícitamente por el usuario el 2026-09-04 tras revisar el informe de investigación; cualquier decisión de diseño posterior debe poder justificarse contra estos dos principios:

1. **Reparto de responsabilidades Typst ↔ DBV.** Typst aporta la infraestructura (compilador, gestión de paquetes, inicialización de plantillas, caché, el propio ecosistema); **DBV Typst Editor aporta la experiencia** (gestión de proyectos, flujos académicos, exploración visual, productividad). El objetivo del producto no es "otra implementación de Typst", es **"el mejor cliente de escritorio para el ecosistema Typst"** — posicionamiento explícito del usuario, que sustituye a cualquier formulación anterior tipo "editor de código con soporte Typst".
2. **Universe-First.** Siempre que sea posible, preferir consumir recursos oficiales del ecosistema Typst (`index.json`, paquetes/plantillas oficiales, flujos del propio CLI) antes que crear un registro paralelo propio de DBV. Solo se construye infraestructura propia cuando aporta un valor claro y verificable a la experiencia del usuario final (p. ej. el sidecar `dbv-template.toml`, §7.6.3 — enriquece, nunca sustituye, al `typst.toml` oficial).

Estos dos principios explican por qué §7.6 (antes descrita como "marketplace de plantillas", una funcionalidad más entre otras) se reencuadra en esta revisión como **Universe Browser** — un punto de entrada de primer nivel de la aplicación, no un añadido — ver §7.6.0.1.

### 0.2. Restricciones de construcción para el MVP (aprobadas al autorizar `/build`)

Aunque el Universe Browser completo es Beta, el MVP **no debe tomar decisiones que dificulten esa integración futura**. Restricciones concretas y verificables durante `/build`:

- **R-MVP-1 — Catálogo de plantillas tras una abstracción, no rutas fijas.** El lanzador y el asistente leen las plantillas a través de un `TemplateSource` con una forma de dato **compatible con las entradas de `index.json`** (name, version, authors, description, categories, `template{path,entrypoint,thumbnail}`); en el MVP existe una sola implementación (plantillas locales curadas), y en Beta se añade la del catálogo remoto cacheado **sin tocar el lanzador ni el asistente**.
- **R-MVP-2 — Scaffolding siempre vía `typst init`.** Nunca copiar directorios a mano. ⚠️ *Mecanismo corregido en el Slice 2 tras verificar contra el binario real:* `typst init` **solo acepta especificadores de paquete**, no rutas de fichero. Las plantillas propias se sirven como paquetes del namespace `@local` desde un directorio propio de DBV (`typst init --package-path <dir> @local/<n>:<v>`), y las comunitarias como `@preview/<n>:<v>` — el mismo camino de código sigue sirviendo para ambas, que es lo que esta restricción persigue.
- **R-MVP-3 — Proyectos ajenos como ciudadanos de primera clase** (`SPECIFICATIONS.md` RF-02b). El manifiesto `settings/dbv-project.toml` es opcional en todo el flujo: abrir un repositorio Git clonado, un proyecto Typst preexistente o uno generado por `typst init` fuera de DBV debe funcionar sin diferencias, salvo las funciones que dependen intrínsecamente de metadatos DBV. **Ninguna operación debe escribir el manifiesto sin acción explícita del usuario.**
- **R-MVP-4 — El `typst_engine` no asume proyectos DBV.** Compilar, exportar y consultar operan sobre rutas de fichero, no sobre el modelo de Proyecto — para que el mismo motor sirva a un `.typ` suelto, a un proyecto ajeno y a uno creado por el asistente.

| Categoría | % aprox. del esfuerzo total evitado | Ejemplos |
| --- | --- | --- |
| Reutilizable sin cambios | ~30% | Watcher de ficheros, single-instance, recent-files, updater, CI de release, patrón de tests Rust |
| Adaptación menor o conceptual | ~30% | Theming CSS, paneles flotantes, file-tree→project-tree, atajos de teclado, toolbar de inserción (patrón, no código), empaquetado/asociación de fichero |
| Trabajo nuevo (núcleo de producto) | ~40% | Integración del sidecar `typst`, editor CodeMirror 6, lanzador, asistente de proyecto, Universe Browser (Package + Template Explorer) sobre `index.json` oficial, outline, Project Archive, terminal avanzado |

---

## 1. Arquitectura actual de DBV Markdown Reader

### 1.1. Vista de conjunto

```text
Sistema Operativo (Windows / Linux / macOS)
        │
        ▼
   CORE (Rust, src-tauri/src/lib.rs — monolito de 1194 líneas)
        │  · Estado: WatcherState, OpenedFileState, OpenDocumentsState
        │  · 13 comandos #[tauri::command] (I/O, dialogs, watcher, recent-files...)
        │  · Menú nativo macOS hecho a mano (no hay File menu de Tauri por defecto)
        │  · Gestión de single-instance + RunEvent::Opened (cold/warm start, deep-link)
        │ Tauri IPC Bridge (window.__TAURI__, withGlobalTauri: true)
        ▼
   FRONTEND (WebView nativo del SO — sin bundler, scripts IIFE vendorizados)
        · index.html (368 líneas) — shell único, todos los paneles en el DOM
        · app.js (2297 líneas) — pipeline de render, edición, guardado, atajos...
        · filetree.js (358 líneas) — árbol de directorio + Quick Open
        · i18n.js (322 líneas) — diccionario ES/EN hecho a mano
        · styles.css (1295 líneas) — temas vía CSS custom properties
```

Backend **no modularizado** (todo en `lib.rs`): decisión consciente y documentada en `NATIVE_DESKTOP_APPS.md` para un proyecto de este tamaño, pero **DBV Typst Editor va a superar ampliamente ese tamaño** (compilador embebido, LSP, gestión de proyectos, marketplace de plantillas) — se recomienda modularizar desde el inicio (ver §7.4).

### 1.2. Comandos Tauri expuestos (`src-tauri/src/lib.rs`)

| Comando | Rol | Reutilizable para Typst Editor |
| --- | --- | --- |
| `get_cli_argument` | Path inicial (argv / stash macOS) | ✅ Sin cambios (agnóstico de formato) |
| `register_open_document` | Dedupe ventana↔path para single-instance | ✅ Sin cambios |
| `get_app_version` / `is_packaged_app` | Metadatos para panel Acerca de / updater | ✅ Sin cambios |
| `read_file` | Lee local o descarga remoto (`http://`) | 🟡 Adaptar (eliminar rama remota, ver §5) |
| `write_file` | Escribe local, rechaza remoto | ✅ Reutilizable casi sin cambios |
| `open_file_dialog` | Diálogo nativo (`tauri-plugin-dialog`) | 🟡 Adaptar filtro de extensión (`.typ`) |
| `resolve_relative_path` | Resuelve enlaces/imágenes relativos | 🟡 Adaptar (Typst resuelve sus propios assets en compilación, ver §7.2) |
| `watch_file` | Watcher `notify` sobre directorio padre, emite `file-changed` | ✅ **Reutilizable casi literal** — mecanismo más valioso a heredar |
| `get_recent_files` / `add_recent_file` / `clear_recent_files` | Recientes persistidos en JSON | ✅ Sin cambios (pasan a ser "recent **projects**", mismo mecanismo) |
| `list_directory` | Árbol de directorio (1 nivel, lazy) | ✅ Sin cambios — base del explorador de proyecto (§7.5) |
| `reveal_in_file_manager` | "Mostrar en el explorador" | ✅ Sin cambios |
| `open_in_new_window` | Nueva ventana, mismo proceso | ✅ Sin cambios |

### 1.3. Frontend: patrón arquitectónico

**No hay componentes ni framework** — convención "IIFE + espacio de nombres `window.DBV*`" (`window.DBVApp`, `window.DBVFileTree`, `window.DBV_I18N`). Cada fichero JS se auto-encapsula; `NATIVE_DESKTOP_APPS.md` (§3) documenta por qué esto es **obligatorio** en este patrón sin bundler (colisión de identificadores globales = fallo de parseo silencioso de todo el fichero).

Primitivas reutilizables clave:
- `registerPanel(panelEl, opts)` (`app.js:1058-1088`) — factoría de apertura/cierre/click-fuera para **todo** panel flotante o modal. Candidata directa a reutilización literal (Settings, About, marketplace de plantillas, asistente de creación de proyecto...).
- `applyInlineWrap`/`applyHeading`/`applyLinePrefix`/`applyLinkWrap`/`applyBlockInsert` (`app.js:1901-2037`) — toolbar que hace manipulación de string sobre el `<textarea>` para insertar sintaxis Markdown. **El patrón** (botón → inserta marcado en la posición del cursor/selección) es directamente reutilizable como base conceptual de los "asistentes de inserción rápida" del Spec Addendum (§7.7) — solo cambia la API de destino (de `textarea.value` a transacciones de CodeMirror 6) y el marcado generado (Typst en vez de Markdown).

### 1.4. Pipeline de renderizado y mecanismo de watch→reload (el más relevante para Typst)

```text
Fichero .md en disco
   │  (usuario edita en textarea O editor externo)
   ▼
notify::RecommendedWatcher sobre el DIRECTORIO PADRE (no el fichero)
   │  → sobrevive a guardado atómico (write-temp + rename)
   ▼
app.emit("file-changed", path)          [Rust → JS, evento IPC]
   │
   ▼
JS: listener con supresión de auto-eco (suppressSelfWriteUntil,
    fijado ANTES de invoke("write_file"), no después — el watcher
    es un canal async independiente que puede disparar antes de que
    la promesa del invoke se resuelva)
   │
   ▼
debounce 150ms → reloadCurrentDocument()
   │  · si hay cambios sin guardar en modo edición → modal de conflicto
   │  · si no, re-render completo (no incremental)
   ▼
extractMath → markdown-it.parse/render → DOMPurify.sanitize
   → Prism.highlightElement (code) + mermaid.render (diagramas)
   → katex.renderToString (fórmulas) → interceptLinks/resolveImages
   → buildToc/setupScrollSpy
```

Este es el **hallazgo más valioso del análisis**: el patrón *watch(directorio padre) → debounce → supresión de auto-eco → recompilar → re-render preservando scroll* es exactamente la arquitectura que necesita un editor Typst con vista previa en tiempo real. Solo cambian los pasos finales (parseo Markdown→HTML se sustituye por invocar al compilador Typst y volcar el resultado como SVG/PDF, ver §7.2-7.3). El paso final `buildToc/setupScrollSpy` es además el precedente directo del panel de navegación estructural del Addendum (§7.8).

### 1.5. Ventana/UI, persistencia de configuración, auto-actualizador, asociación de fichero, plantillas, testing

- **No hay `tauri-plugin-store`**: preferencias de UI en `localStorage`; solo `recent_files.json` vive en `app_data_dir()` gestionado por Rust.
- **Auto-actualizador** (`tauri-plugin-updater`): chequeo solo bajo demanda, deshabilitado en Android/MSIX (`is_packaged_app`), firmado con minisign. Config en `tauri.conf.json` `plugins.updater`.
- **Asociación de fichero**: 100% declarativa en `bundle.fileAssociations` — sin código Rust adicional.
- **Plantillas**: `templates/` en la raíz contiene 34 `.md` estáticos (ES/EN) **sin ninguna integración en la app** — ni comando Rust, ni selector UI, ni siquiera existe un "Guardar como". El sistema de plantillas de DBV Typst Editor es **trabajo nuevo al 100%** en cuanto a integración, aunque el Spec Addendum ya fija la organización por categorías a imitar (ver §7.6).
- **CI/Build**: `release-linux.yml` y `release-macos.yml`. **Windows es 100% manual**. NSIS muy personalizado.
- **Testing**: sin frameworks JS. Tests Rust inline en `lib.rs` (`#[cfg(test)]`, ~30 tests) sobre funciones puras extraídas de los comandos `#[tauri::command]`, más `tempfile`. Patrón directamente reutilizable.

---

## 2. Tecnologías utilizadas (DBV Markdown Reader)

**Backend (Rust / `src-tauri/Cargo.toml`):** `tauri` 2.0 (feature `protocol-asset`), `tauri-plugin-shell/dialog/updater/process/os` 2.x, `tauri-plugin-single-instance` 2.4.3 (solo desktop), `tauri-plugin-saf` (plugin propio, solo Android), `serde`/`serde_json` 1.0, `notify` 8.2.0, `ureq` 3.4.0, `rustls` 0.23 (provider `ring`), `ctor` 0.8, `sys-locale` 0.3, `tempfile` 3.27 (dev).

**Frontend (`package.json`, sin bundler en runtime):** `markdown-it` 14.1 + plugins, `dompurify` 3.4.13, `katex` 0.18.4, `mermaid` 11.4.1, `pako` 3.0.1, `prismjs` 1.29 (+20 gramáticas), `@tauri-apps/api` 2.2, `@tauri-apps/plugin-{process,shell,updater}` 2.x. Todo vendorizado a mano en `src/vendor/*.min.js`.

**Empaquetado:** NSIS (Windows), AppImage + .deb (Linux), dmg/.app (macOS, sin firmar hoy). Sin bundler de frontend.

---

## 3. Componentes reutilizables — clasificación explícita

Leyenda: 🟢 Reutilizable sin cambios · 🟡 Adaptación menor · 🔴 Reemplazo/trabajo nuevo

| # | Componente | Origen (fichero) | Clasificación | Complejidad de adaptación |
| --- | --- | --- | --- | --- |
| 1 | Watcher de fichero (directorio padre + debounce + evento IPC) | `lib.rs:457-503` + `app.js:552-568` | 🟢 | Trivial |
| 2 | Supresión de auto-eco en guardado (`suppressSelfWriteUntil`) | `app.js:2153` | 🟢 | Trivial |
| 3 | Modal de conflicto (cambio externo con ediciones sin guardar) | `app.js` (`conflictPending`) | 🟢 | Trivial |
| 4 | Single-instance + apertura por doble clic (`RunEvent::Opened`, cold/warm) | `lib.rs:154-171, 800-938` | 🟢 | Trivial — cambiar extensiones a `.typ`/`.dbvt` |
| 5 | Recent files→projects (JSON en `app_data_dir`, cap 10, autolimpieza) | `lib.rs:209-228, 505-530` | 🟢 | Trivial |
| 6 | Explorador de directorio lazy (`list_directory`) + Quick Open | `lib.rs:574-590`, `filetree.js` | 🟢 | Trivial — base del explorador de proyecto (§7.5) |
| 7 | Auto-actualizador (`tauri-plugin-updater`, UI bajo demanda, detección MSIX) | `lib.rs:349-361, 798`, `app.js:1236-1299` | 🟢 | Trivial |
| 8 | CI de Release (Linux/macOS `tauri-action`, draft release) | `.github/workflows/*.yml` | 🟢 | Trivial |
| 9 | Scripts `build.mjs` / `generate-latest-json.mjs` / `installer-name.mjs` | `scripts/` | 🟢 | Trivial |
| 10 | Patrón de tests Rust (funciones puras extraídas + `tempfile`) | `lib.rs:941-1194` | 🟢 | Trivial |
| 11 | Asociación de fichero declarativa (`bundle.fileAssociations`) | `tauri.conf.json:47-55` | 🟡 | Baja — `.typ` (y decidir si `.dbvt` también se asocia) |
| 12 | Sistema de theming (CSS custom properties, `[data-theme]`) | `styles.css:10-99` | 🟡 | Baja |
| 13 | `registerPanel()` — factoría de paneles flotantes/modales | `app.js:1058-1088` | 🟡 | Baja — reutilizado también por marketplace/asistente de proyecto |
| 14 | i18n hecho a mano (diccionario ES/EN + `t()`) | `i18n.js` | 🟡 | Baja |
| 15 | Layout resizable con persistencia `localStorage` | `app.js:1707-1732` | 🟡 | Baja — base de los "Modos de escritura" (§7.9) |
| 16 | Menú nativo macOS + eventos `menu-open-file`/`menu-save` | `lib.rs:643-779, 846-866` | 🟡 | Media |
| 17 | Gestión de "guardar"/dirty-state/confirmación de descarte | `app.js` (`setDirty`, `confirmDiscardUnsavedChanges:89-99`) | 🟡 | Baja — formato-agnóstico |
| 18 | Capabilities/permisos Tauri (`capabilities/main.json`) | `src-tauri/capabilities/` | 🟡 | Baja |
| 19 | **Toolbar de inserción por manipulación de string** (patrón) | `app.js:1901-2037` | 🟡 | Media — mismo patrón conceptual, nueva API (CM6) y nuevo marcado (Typst); base de los asistentes de inserción rápida (§7.7) |
| 20 | Construcción de TOC / scroll-spy (patrón) | `app.js` (`buildToc`/`setupScrollSpy`) | 🟡 | Media — mismo patrón conceptual, nueva fuente de datos (outline de Typst vía `typst-ide`, §7.8) |
| 21 | Pipeline `markdown-it → DOMPurify → Prism/Mermaid/KaTeX` | `app.js:598-627` | 🔴 | Sustituido por invocación al compilador Typst (§7.2) |
| 22 | Componente de edición: `<textarea>` + numeración manual | `index.html:239`, `app.js:1901-2037` | 🔴 | Sustituido por CodeMirror 6 (§7.1). No existe resaltado, autocompletado ni plegado en el original |
| 23 | Scroll-sync editor↔preview por anclas de heading | `app.js` (`fullScrollAnchors`/`interpolateScroll`) | 🔴 | Reemplazado por mapeo de posición real vía `typst-ide` (Beta) |
| 24 | Integración de plantillas en la app (selector, carga, "Guardar como") | `templates/` (sin integración) | 🔴 | Trabajo nuevo — lanzador, asistente de proyecto y marketplace (§7.6) |
| 25 | Resolución de imágenes relativas / `asset://` para Markdown | `app.js` (`resolveImages`) | 🔴 | No aplica — Typst resuelve sus propios assets al compilar |
| 26 | Ayuda de sintaxis Markdown (`markdownhelp_{es,en}.md`) | `src/*.md` | 🔴 | Sustituir por chuleta de sintaxis Typst (o innecesario si los asistentes de inserción cubren el caso de uso) |
| 27 | Lanzador de tareas ("¿Qué quieres crear hoy?") | *(no existe en el original)* | 🔴 | Trabajo nuevo (§7.13) — DBV Markdown Reader abre directamente el último/un documento |
| 28 | Asistente de creación de proyecto (formulario de metadatos) | *(no existe en el original)* | 🔴 | Trabajo nuevo (§7.6.2) |
| 29 | Project Archive (`.dbvt`, empaquetado/desempaquetado) | *(no existe en el original)* | 🔴 | Trabajo nuevo (§7.12) |
| 30 | Gestión de imágenes por arrastre (copiar + generar `figure()`) | *(no existe — el original solo resuelve rutas ya existentes, no copia)* | 🔴 | Trabajo nuevo, Beta (§7.10) |

---

## 4. Dependencias que pueden mantenerse

| Dependencia | Capa | Motivo |
| --- | --- | --- |
| `tauri` 2.x + `tauri-plugin-{shell,dialog,updater,process,os,single-instance}` | Rust | Núcleo de la plataforma; `tauri-plugin-shell` pasa de "reservado por si acaso" a **imprescindible** (gestión del sidecar `typst`, §7.2) |
| `serde` / `serde_json` | Rust | (De)serialización de config/recent-projects/manifiestos de plantilla/`typst.toml` |
| `notify` | Rust | Watcher de ficheros |
| `zip` | Rust | Export/import de Project Archive `.dbvt` (§7.12) — nueva, no presente en DBV Markdown Reader |
| `tempfile` | Rust (dev/runtime) | Fixtures de test aisladas; también directorio temporal de trabajo para la salida SVG multi-página del sidecar (§7.3) |
| `@tauri-apps/api` + plugins JS homónimos | JS | Bindings oficiales |
| `dompurify` | JS | Sanitizar cualquier string dinámico insertado como HTML en la UI (mensajes de error del compilador, metadatos de plantillas comunitarias) |

## 5. Dependencias que deberían sustituirse (o eliminarse)

| Dependencia actual | Motivo | Sustituto propuesto |
| --- | --- | --- |
| `markdown-it` + plugins | No hay Markdown que parsear | *(eliminar)* — compilador Typst |
| `prismjs` (+20 gramáticas) | El resaltado de salida HTML no aplica | Modo de lenguaje Typst para CodeMirror 6 (§7.1) |
| `mermaid` + `pako` | Typst tiene sus propios paquetes de diagramas (`cetz`) | *(eliminar)* |
| `katex` | Typst tiene tipografía matemática nativa | *(eliminar)* |
| `ureq` (descarga remota vía HTTP) | Casos de uso Typst son locales; la descarga de paquetes/plantillas comunitarias (Beta) ocurre dentro del propio sidecar `typst`, no vía un cliente HTTP propio en Rust. La única descarga HTTP propia de DBV es la del `index.json` de catálogo (§7.6.1), para la que basta un cliente HTTP mínimo si se necesita (a evaluar en `/build`: reutilizar `tauri-plugin-http` en vez de reintroducir `ureq`) | *(eliminar del MVP; revalorar cliente HTTP mínimo en Beta solo para `index.json`)* |
| Uso de `<textarea>` como editor | Sin resaltado/autocompletado/plegado | **CodeMirror 6** (§7.1) |
| Crates Rust embebidas del compilador (`typst`, `typst-pdf`, `typst-svg`, `typst-ide`, `typst-kit`) — *decisión anterior, revertida* | El usuario ha pedido explícitamente integración vía CLI oficial (§7.2) | **Binario `typst` oficial vendorizado como sidecar de Tauri**, no como dependencia de Cargo |

---

## 6. Riesgos técnicos

| Riesgo | Severidad | Mitigación propuesta |
| --- | --- | --- |
| El backend Rust de DBV Markdown Reader es un monolito de ~1200 líneas; el Typst Editor añade gestión de proceso sidecar + gestión de proyecto + marketplace + (Beta) LSP. | Media | Modularizar desde el inicio (`commands/`, `watcher.rs`, `typst_engine/`, `project.rs`, `templates.rs`) — ver §7.4. |
| **[REVISADO]** El CLI oficial de Typst puede cambiar flags/formato de salida entre versiones (aunque de forma más conservadora que una API de librería interna). | Media | Fijar la versión exacta del binario vendorizado como sidecar (§7.2); actualizar de forma explícita y probada, no automática; aislar toda la construcción de comandos/parseo de salida tras el módulo `typst_engine`. |
| **[NUEVO]** Distribución del sidecar: hay que vendorizar y mantener actualizado un binario por plataforma (Windows/Linux/macOS) dentro del instalador, con su propia gestión de versión, en vez de una dependencia de Cargo declarativa. | Media | Automatizar en CI la descarga de los binarios de release oficiales (nombrados por *target triple*, compatibles con la convención de sidecar de Tauri — ver `TYPST_ECOSYSTEM_RESEARCH.md` §1.1) y su colocación en `src-tauri/binaries/` antes de `tauri build`. |
| CodeMirror 6 es ES Modules-first — incompatible con el patrón "sin bundler" de DBV Markdown Reader. | Media | Introducir Vite solo para el frontend del Typst Editor — cambio consciente, ver §7.1. |
| Sincronización editor↔preview por posición real y outline estructural dependen de que `typst query`/`typst-ide` (vía `tinymist` en Beta) expongan información de posición suficiente vía CLI/LSP; no hay precedente reutilizable directo (el de Markdown usa anclas de heading). | Media | Spike de validación en `/build` (ver `TYPST_ECOSYSTEM_RESEARCH.md` §1.5); plan B con `tinymist` si `typst query` no basta. Se pospone a Beta. |
| ~~Tamaño del instalador~~ → **riesgo CERRADO y medido en el Slice 2: 18 MB**, por debajo incluso del objetivo original de 30 MB (que el usuario ya había relajado). | — | Hallazgo: el peso problemático no era el compilador Typst (51 MB sin comprimir, ~14 MB tras la compresión LZMA de NSIS) sino `webviewInstallMode: offlineInstaller` heredado de DBV Markdown Reader, que embebe el instalador completo de WebView2 (~200 MB) y llevaba el total a **268 MB**. Cambiado a `downloadBootstrapper`. Ver contrapartida en §7.15. |
| **[NUEVO]** No existe comando CLI de "actualizar paquete" (`TYPST_ECOSYSTEM_RESEARCH.md` §2.4) — el Package Explorer debe reescribir el `#import` él mismo. | Baja | Documentado como decisión de diseño en §7.6.2; cubrir con test de la función de reescritura de versión. |
| **[NUEVO]** Si en el futuro DBV enriquece plantillas *comunitarias* (no propias) con `dbv-template.toml`, un desajuste entre la versión que DBV curó y una versión más nueva del paquete comunitario puede producir metadatos obsoletos o un formulario que ya no corresponde a los ficheros reales de la plantilla. | Baja-Media | No co-ubicar el sidecar dentro de la caché de Typst (fuera del control de DBV); usar un overlay propio indexado por `(namespace/nombre, versión)` con degradación limpia a "sin formulario, solo `typst init`" si no hay overlay para la versión instalada — ver §7.6.3. |
| **[NUEVO] Alcance del MVP creció tras el Spec Addendum** (lanzador, asistente de proyecto, Project Archive pasan a ser MVP). | Media | El core técnico no cambia; son capas de UI/orquestación sobre infraestructura ya heredada — ver estimación de complejidad actualizada en §8. Confirmar con el usuario expectativa de plazo. |
| **[NUEVO] Marketplace de plantillas comunitarias (Beta) implica compilar código Typst de terceros** — riesgo de cadena de suministro, aunque Typst es un lenguaje de tipografía sin acceso arbitrario a red/FS fuera de su sandbox de compilación por diseño. | Media | Empezar con una whitelist curada (paquetes/plantillas verificados por DBV) antes de abrir a todo el registro `@preview` sin filtro; mostrar siempre autor/versión/origen en la ficha de la plantilla (ya previsto en el Addendum). Auditar en el gate de seguridad de `/code-simplify`. |
| **[NUEVO] Project Archive `.dbvt` como ZIP**: importar un archivo `.dbvt` construido a mano/malicioso puede intentar un *zip-slip* (rutas `../` que escriben fuera del directorio destino). | Media | Sanitizar/normalizar cada ruta de entrada del ZIP en el comando de importación Rust antes de escribir a disco; rechazar cualquier entrada que resuelva fuera del directorio de proyecto destino. |
| Ausencia total de tests JS choca con la necesidad de testear lógica no trivial de UI del editor (autocompletado, asistentes de inserción, outline). | Baja-Media | Extender el patrón "funciones puras testeables" al lado JS; evaluar Vitest solo para esa capa. |
| Licencias del ecosistema Typst y de plantillas comunitarias de terceros. | Baja | Auditoría de licencias en el gate de `/code-simplify`; para plantillas comunitarias, mostrar licencia declarada en la ficha antes de instalar. |

---

## 7. Propuesta de migración / decisiones técnicas clave

### 7.1. Editor de código: CodeMirror 6 — re-evaluación tras el Spec Addendum (Monaco solicitado explícitamente como opción principal a evaluar)

El Spec Addendum pide evaluar **Monaco Editor como opción principal**, citando minimapa, multi-cursor y experiencia en documentos largos. Se repite la evaluación con estos criterios añadidos:

| Criterio | Monaco Editor | CodeMirror 6 |
| --- | --- | --- |
| Tamaño (min+gzip) | ~2-5 MB (motor de VS Code completo) | ~200-400 KB core, modular |
| Modelo de distribución | AMD/UMD pesado | ESM nativo, tree-shakeable |
| Encaja con "ligero/offline-first" | Contradice el objetivo de instalador ligero de la familia DBV | Alineado |
| Soporte de lenguaje Typst | Sin gramática Typst oficial activamente mantenida | Ecosistema de modos Typst en la comunidad; es la base del editor web oficial de Typst (app.typst.io) |
| **Multi-cursor / selección múltiple** (pedido en el Addendum) | Nativo y maduro | **También nativo** (`EditorState` soporta rangos múltiples de forma built-in) — no es una carencia real de CM6 |
| **Minimapa** (pedido en el Addendum) | Nativo | Disponible como extensión de comunidad (p. ej. `@replit/codemirror-minimap`), menos maduro que el de Monaco — único punto real a favor de Monaco |
| **Documentos largos** (pedido en el Addendum, p. ej. tesis) | Buen rendimiento (nace para ficheros de código grandes) | Buen rendimiento (estructura de datos tipo *rope*); a esta escala (una tesis, no un repositorio) no es un diferenciador real |
| Integración LSP (`tinymist`, Beta) | Nació para LSP de VS Code | También soportado (`codemirror-languageserver`), algo más de integración manual |
| **Alineamiento con la filosofía "Obsidian for Typst" del Addendum** | Monaco *es*, perceptualmente, "VS Code embebido" — refuerza la sensación de "editor de código", justo lo contrario de lo que pide el Addendum (§2: "el usuario no debe ver código si no quiere") | **Obsidian —la referencia explícita del propio Addendum— usa CodeMirror 6 como motor de edición.** Su modelo de extensiones (decoraciones, widgets, paneles) es además el mecanismo estándar con el que Obsidian construye su "Live Preview" (ocultar/transformar marcado en línea) — el mismo patrón que necesitan los asistentes de inserción rápida del Addendum (§7.7) |

**Decisión (confirmada, no revertida):** **CodeMirror 6**. La única ventaja real y no discutible de Monaco tras esta segunda evaluación es el minimapa nativo (más maduro que la alternativa de CM6); no se considera suficiente para invertir la decisión, dado el coste en tamaño/filosofía y que el propio producto de referencia del Addendum (Obsidian) confirma que CM6 es viable a este nivel de calidad de producto. El minimapa se marca como mejora evaluable en Beta con la extensión de comunidad si el equipo de UX lo considera necesario tras probar el MVP.

**Coste de esta decisión:** rompe el patrón "sin bundler" de DBV Markdown Reader. Se acepta conscientemente: se introduce **Vite** solo para el frontend del Typst Editor, manteniendo `withGlobalTauri: true` para los plugins Tauri consumidos vía `window.__TAURI__`.

### 7.2. Integración del compilador Typst — CLI oficial como sidecar (decisión revisada 2026-09-04)

> **Esta decisión sustituye a la versión anterior de esta sección** (que proponía embeber las crates Rust `typst`/`typst-pdf`/`typst-svg`/`typst-ide`/`typst-kit`). El usuario ha indicado explícitamente ("TYPST CLI INTEGRATION") que DBV Typst Editor debe integrar y usar internamente el **CLI oficial de Typst** para creación de proyectos, resolución de paquetes, compilación, vista previa en vivo y exportación — el usuario normal no debe invocar comandos manualmente, pero el mecanismo interno de la app sí se apoya en el binario oficial. Registrado como reversión explícita de ADR en `memory.md`.

**Decisión:** vendorizar el binario oficial `typst` (CLI) **como sidecar de Tauri** (`tauri-plugin-shell`, ya presente en el stack heredado de DBV Markdown Reader — `capabilities/main.json` ya anticipaba "revisar permisos de shell si se añade sidecar", §3 fila 18), una copia por plataforma en `src-tauri/binaries/typst-<target-triple>[.exe]`, con versión fijada y actualizada junto con el resto de la app (mismo canal de auto-actualización ya heredado, no `typst update`, ver `TYPST_ECOSYSTEM_RESEARCH.md` §1.6). **No** se embebe ninguna de las crates Rust de Typst como librería del backend.

Justificación:

- Petición explícita del usuario, con alcance concreto: creación de proyecto (`typst init`), resolución de paquetes (transparente dentro de `typst compile`/`typst init`), compilación, preview y exportación — ver mapeo comando↔función en la tabla siguiente.
- Sigue siendo coherente con "single self-contained binary" (el sidecar viaja *dentro* del instalador, igual que WebView2 en DBV Markdown Reader) — la app no depende de que el usuario tenga `typst` en su `PATH`.
- Los binarios de release oficiales usan nombres por *target triple* (`typst-x86_64-pc-windows-msvc.zip`, `typst-aarch64-apple-darwin.tar.xz`...) que **coinciden con la convención de sidecar de Tauri**, minimizando fricción de empaquetado — ver `TYPST_ECOSYSTEM_RESEARCH.md` §1.1.
- Superficie de integración más simple de razonar (invocar un proceso y parsear su salida) que enlazar con una API interna de crates que cambia rápido entre versiones menores — el riesgo de inestabilidad no desaparece, pero se traslada de "API de Rust" a "flags/formato de salida del CLI", que Typst versiona de forma más conservadora (compatibilidad de línea de comandos suele durar más que la de APIs internas de librería).

**Mapeo funcionalidad → subcomando CLI** (detalle completo en `TYPST_ECOSYSTEM_RESEARCH.md`):

| Funcionalidad de la app | Subcomando | Notas |
| --- | --- | --- |
| Crear proyecto desde plantilla (§7.6.4) | `typst init --package-path <dir> @local/<n>:<v> <destino>` (propias) · `typst init @preview/<n>:<v> <destino>` (comunidad) | ⚠️ **Corregido en Slice 2:** `init` **no acepta rutas de fichero**, solo especificadores de paquete. Copia literal, sin sustitución de variables — el asistente de DBV post-procesa después |
| Compilación / preview en vivo (§7.3) | `typst compile <input> [output] --format {svg,pdf} [--pages ...]` | *One-shot* por ciclo de debounce (recomendado, ver `TYPST_ECOSYSTEM_RESEARCH.md` §1.4) en vez de `typst watch` en el MVP |
| Exportación PDF final (RF-10) | `typst compile input.typ -` | Escribe el PDF a stdout — sin fichero temporal |
| Resolución de paquetes `@preview/*` | Transparente dentro de `compile`/`init` | Sin comando dedicado; no hay "instalar paquete" ni "actualizar paquete" como operación de CLI (ver `TYPST_ECOSYSTEM_RESEARCH.md` §2.4) |
| Outline estructural (§7.8, Beta) | `typst eval 'query(heading).map(...)' --in <input> --format json` | ⚠️ **Corregido en Slice 2:** `typst query` está deprecado en 0.15.1 y no serializa la posición. ✅ **Spike cerrado:** `eval` sí devuelve nivel, texto, **página y coordenada `y`** por encabezado |
| Terminal avanzado (§7.14, nuevo) | Cualquier subcomando oficial | Exposición directa para usuarios avanzados |

**Consecuencias sobre decisiones ya tomadas en este documento (a propagar):**
- §7.6.1/§7.6.2: la resolución/caché de paquetes ya no se invoca vía `typst-kit::PackageStorage` como API Rust — ocurre *dentro* del proceso hijo `typst` al compilar/inicializar; DBV no gestiona la caché de paquetes directamente, solo la caché de su propio índice de descubrimiento (`index.json`).
- §7.6.2 (detección de "Paquetes usados"): se abandona la idea de usar `typst::syntax::parse` como crate embebida (contradiría "todo vía CLI"); se sustituye por un escaneo de texto ligero — ver `TYPST_ECOSYSTEM_RESEARCH.md` §2.5.
- El módulo `typst_engine` (§7.4) pasa de "envoltorio de llamadas a crates" a "gestor de procesos hijo": construcción de comandos, captura de stdout/stderr, códigos de salida, ficheros temporales para salidas multi-página, cancelación de compilaciones en curso cuando llega un cambio más reciente.

### 7.3. Estrategia de vista previa en tiempo real

**Decisión:** renderizar cada página como **SVG** (`typst compile --format svg`, salida multi-fichero con marcador `{0p}` de página, ver `TYPST_ECOSYSTEM_RESEARCH.md` §1.3) para la vista previa en vivo; reservar el **PDF real** (`typst compile input.typ -`, directo a stdout sin fichero temporal) para guardado/exportación final.

Justificación: SVG es vectorial, permite refresco incremental sin PDF.js, y reutiliza el mecanismo watch→debounce→re-render de §1.4. La vista previa SVG requiere un directorio temporal de trabajo (multi-página exige múltiples ficheros de salida); la exportación PDF final puede evitar el filesystem por completo leyendo stdout del proceso sidecar.

### 7.4. Estructura de directorios propuesta

```text
/
├── src/                      # Frontend (Vite + CodeMirror 6 para el editor)
│   ├── launcher/                # NUEVO — pantalla "¿Qué quieres crear hoy?" (§7.13)
│   ├── project-wizard/           # NUEVO — asistente de creación de proyecto (§7.6.2)
│   ├── editor/                    # CodeMirror 6 + modo Typst + asistentes de inserción (§7.7)
│   ├── preview/                    # Panel de vista previa SVG + zoom/paginación
│   ├── outline/                     # NUEVO — panel de navegación estructural (§7.8)
│   ├── templates-marketplace/        # NUEVO, Beta — Instaladas/Comunidad/Favoritas/Recientes (§7.6)
│   ├── panels/                        # registerPanel() heredado: Settings, About, Quick Open...
│   ├── project-explorer/               # Heredado de dbv-md-reader/src/filetree.js
│   ├── i18n/                            # Heredado del patrón de dbv-md-reader/src/i18n.js
│   ├── themes/                           # CSS custom properties heredadas + paleta propia
│   └── vendor/                            # Solo lo que NO pase por Vite (si se opta por híbrido)
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs                # Orquestación: registro de plugins/comandos, run()
│   │   ├── commands/               # file_io.rs, recent_projects.rs...
│   │   ├── watcher.rs                # Heredado de lib.rs:457-503
│   │   ├── project.rs                 # NUEVO — modelo de proyecto, manifiesto (§7.5)
│   │   ├── templates.rs                # NUEVO — scaffolding sobre `typst init`, índice Universe cacheado (§7.6)
│   │   ├── archive.rs                   # NUEVO — export/import .dbvt (zip), sanitización de rutas (§7.12)
│   │   └── typst_engine/                 # NUEVO — gestión del proceso sidecar `typst` (§7.2): compile/init/query/watch
│   └── tauri.conf.json + overlays por plataforma (heredado)
├── src-tauri/binaries/typst-<target-triple>[.exe]  # Sidecar oficial de Typst, vendorizado por plataforma (§7.2)
├── templates/                 # Plantillas .typ (es/en) por categoría — patrón heredado del Addendum
│   ├── academico/{articulo,tfg,tfm,tesis,ieee,acm,springer,lncs}/
│   ├── docencia/{apuntes,practicas,examen,guia-docente}/
│   ├── profesional/{informe-tecnico,propuesta,memorando,cv}/
│   └── presentaciones/{deck,charla-tecnica,seminario}/
│       └── (cada plantilla: typst.toml + [template] oficial + dbv-template.toml sidecar, §7.6.3)
├── dbv-specs-ops/              # Documentación SDD (este directorio)
├── start.cmd / start.sh        # Heredado sin cambios
└── stop.cmd / stop.sh           # Heredado sin cambios
```

### 7.5. Modelo de Proyecto

**Decisión:** la unidad de trabajo es un directorio de proyecto (`SPECIFICATIONS.md` §4: `main.typ`, `refs.bib`, `chapters/`, `images/`, `assets/`, `settings/`), con un manifiesto propio de DBV (p. ej. `settings/dbv-project.toml`) que registra metadatos **que Typst no conoce** (plantilla de origen, versión de la plantilla, fecha de creación, valores de los campos del asistente §7.6.2) — nunca metadatos de compilación, que son responsabilidad exclusiva de Typst.

Arquitectura: extiende `list_directory`/`filetree.js` (§3 fila 6) para mostrar la estructura completa del proyecto en vez de un único fichero; añade comandos Rust `create_project(template_id, target_dir, form_values)`, `open_project(dir)`, `read_project_manifest(dir)`. Un `.typ` suelto abierto directamente se trata como "proyecto de un solo fichero" (sin manifiesto) para mantener compatibilidad con documentos Typst ya existentes fuera de DBV Typst Editor.

### 7.6. Universe Browser: Paquetes y Plantillas del ecosistema Typst

> Sección revisada dos veces el 2026-09-04: primero tras la Additional Specification Clarification del usuario (que exige tratar **Paquetes** y **Plantillas** como dos ecosistemas distintos a nivel de producto/UX), después tras su feedback de posicionamiento (que eleva esta sección de "una funcionalidad más" a **punto de entrada de primer nivel de la aplicación** — ver principio "Universe-First" en §0.1: *"el valor de DBV Typst Editor no es solo editar ficheros Typst, es hacer accesible el ecosistema Typst"*). La investigación técnica (documentación oficial de `typst/packages` y del propio `index.json` servido en producción) aclara además un matiz importante que refina —sin contradecir— la separación pedida: a nivel de **datos**, Paquetes y Plantillas comparten una única fuente de verdad; la separación real está en cómo cada uno se presenta y en qué acción principal dispara cada uno.
>
> **Nota de alcance (no de arquitectura):** elevar el Universe Browser a "primer nivel" es una decisión de **posicionamiento e importancia conceptual** del producto, no una reapertura de la fase en la que se entrega (sigue siendo Beta según el roadmap ya acordado en `SPECIFICATIONS.md` §11, salvo las plantillas propias curadas de DBV, que ya eran MVP). La conexión concreta con el MVP es que **el Lanzador (§7.13, MVP) es, en efecto, una primera versión reducida del Template Explorer** — muestra el catálogo curado sin la pestaña Comunidad — por lo que el usuario ya experimenta el "Universe-first, piensa en documentos no en paquetes" desde el primer arranque, aunque el explorador completo llegue en Beta.

#### 7.6.0. Hallazgo técnico: una única fuente de datos, dos superficies de producto

Investigación realizada contra la documentación pública de `typst/packages` y el índice servido en producción:

- **No existen dos registros separados.** Existe **un único** repositorio oficial, [`typst/packages`](https://github.com/typst/packages), con todos los paquetes bajo `packages/preview/{name}/{version}/`, cada uno con un manifiesto `typst.toml` obligatorio. Una GitHub Action del propio repo genera, en cada push, un `index.json` único con los metadatos de **todos** los paquetes y lo publica en `https://packages.typst.org/preview/index.json` (servido vía CDN) — ver [`packages/README.md`](https://github.com/typst/packages/blob/main/README.md).
- **Una "plantilla" no es más que un paquete con una sección `[template]` adicional en su `typst.toml`** (`path`, `entrypoint`, `thumbnail`) — ver [`docs/manifest.md`](https://github.com/typst/packages/blob/main/docs/manifest.md). El propio CLI oficial de Typst usa exactamente esta sección para su comando `typst init @preview/{name}:{version}` (scaffolding de proyecto nuevo). Un paquete "normal" (sin `[template]`) solo se consume vía `#import`.
- **Cada entrada del `index.json`** trae: `name`, `version`, `entrypoint`, `authors`, `license`, `description`, `repository`, `keywords`, `categories` (hasta 3, de una lista cerrada oficial), `disciplines`, `compiler` (versión mínima de Typst), `exclude`, `updatedAt`, y — solo si es plantilla — el objeto `template` con `path`/`entrypoint`/`thumbnail`.
- La web `typst.app/universe/search/?kind=packages` vs. `?kind=templates` que citas **es exactamente ese mismo dataset, filtrado en el propio frontend de Typst Universe por la presencia o no del campo `template`** — no son dos fuentes distintas. Las categorías que expone esa UI confirman esta doble naturaleza: hay categorías funcionales compartidas (Components, Visualization, Model, Layout, Text, Languages, Scripting, Integration, Utility, Fun) y categorías de tipo-de-documento que solo tienen sentido para plantillas (Book, Report, Paper, Thesis, Poster, Flyer, Presentation, CV, Office).
- Al inspeccionar la página se detectó además una referencia a `api.typst.app/v1/` — es la API **privada** del propio sitio web de Typst Universe (búsqueda con "featured"/"officially affiliated", autenticación, etc.), no un contrato público documentado para terceros. **Decisión: DBV Typst Editor no debe depender de `api.typst.app`** (sin documentación pública, sujeta a cambios/rate-limiting/ToS sin aviso); debe apoyarse exclusivamente en el `index.json` público — la misma fuente que usa el propio compilador Typst — más, si se desea replicar exactamente la experiencia visual de Typst Universe, lectura directa del repositorio `typst/packages` en GitHub (miniaturas, READMEs) vía su API pública de contenidos.

Consecuencia arquitectónica: **una sola capa de sincronización de datos** (descarga y cachea `index.json`, ~250-300+ entradas y creciendo), sobre la que se construyen **dos experiencias de producto separadas** (Package Explorer, §7.6.2, y Template Explorer, §7.6.3), tal como pide el usuario — la separación vive en la capa de presentación/interacción, no obliga a duplicar la capa de datos.

#### 7.6.0.1. Estructura de navegación del Universe Browser

Árbol de navegación propuesto (Beta), reflejando la petición explícita del usuario de que Paquetes y Plantillas sean secciones primarias bajo un mismo punto de entrada, no fusionadas entre sí:

```text
Universe
├─ Plantillas (Template Explorer, §7.6.3)
│   ├─ Instaladas · Comunidad · Favoritas · Recientes · Actualizaciones
└─ Paquetes (Package Explorer, §7.6.2)
    ├─ Instaladas · Comunidad · Favoritas · Recientes · Actualizaciones
```

"Plantillas" y "Paquetes" son el primer nivel de navegación (mismo peso, ninguno subordinado al otro); cada uno conserva sus propias pestañas Instaladas/Comunidad/Favoritas/Recientes/Actualizaciones ya especificadas en §7.6.2/§7.6.3 — no se fusionan entre kinds (p. ej. "Instaladas" de Paquetes y "Instaladas" de Plantillas son listas distintas), coherente con que representan modelos mentales de usuario distintos (funcionalidad reutilizable vs. arrancadores de proyecto). Ambas vistas comparten la misma capa de sincronización de datos (§7.6.0, §7.6.1) y el mismo componente de lista virtualizada/búsqueda local.

#### 7.6.1. Descarga, caché y actualización del índice y de los paquetes

- **Índice de metadatos:** descargar `index.json` (~cientos de KB) y cachearlo localmente (p. ej. `app_data_dir()/typst-universe-index.json` con timestamp), con un botón "Actualizar catálogo" bajo demanda — mismo patrón UX que el auto-actualizador ya existente en DBV Markdown Reader (`tauri-plugin-updater`, chequeo manual, nunca automático). Nunca bloquea el arranque offline: si no hay índice cacheado y no hay red, el Package/Template Explorer muestra un estado vacío con reintento, sin degradar el resto de la app.
- **Contenido de cada paquete (tarballs):** con la integración vía CLI sidecar (§7.2), la descarga y el cacheado de un paquete concreto ocurre **dentro del propio proceso `typst`** al compilar/inicializar (resolución en cascada: `package_path` local → `package_cache_path` → descarga de `https://packages.typst.org` solo para el namespace `@preview`, cacheado en el directorio de caché del SO — ver `TYPST_ECOSYSTEM_RESEARCH.md` §2.2). **DBV no gestiona la caché de paquetes directamente ni escribe un cliente de descarga propio**: "Añadir al proyecto" en el Package Explorer se limita a insertar el `#import` y disparar una compilación (§7.2), que descarga/cachea el paquete como efecto colateral, igual que ocurriría si el usuario lo escribiera a mano.
- **Miniaturas de plantillas:** el campo `template.thumbnail` del manifiesto es una ruta *dentro* del propio paquete, no una URL directa — obtenerla implica descargar/extraer el tarball del paquete (parcial o completo) antes de poder mostrar la imagen en la ficha. *(Verificar en el spike de `/build` si existe una URL directa servida por `packages.typst.org` para la miniatura sin tener que descargar el tarball completo; si no, evaluar pre-generar y cachear un directorio de miniaturas propio actualizado periódicamente, para no penalizar el scroll del catálogo con descargas de tarball por cada tarjeta visible.)*

#### 7.6.2. Package Explorer (Beta)

Vista dedicada, distinta de la de plantillas, para el ecosistema de **paquetes** (funcionalidad reutilizable: figuras, diagramas, tablas, presentaciones, bibliografía, utilidades — nunca "arrancadores de proyecto"):

- **Buscar / Explorar categorías / Instalados / Detalle de paquete / Documentación / Información de versión / Actualizaciones disponibles** (funcionalidades pedidas explícitamente por el usuario). La ficha de cada paquete instalado muestra explícitamente **Versión actual** / **Última versión** / una insignia "Actualización disponible" cuando difieren — campos concretos pedidos por el usuario, ya sustentados por el escaneo de "Paquetes usados" y el índice cacheado (§7.6.1) desde el diseño inicial de esta vista, no como añadido posterior.
- Acción principal: **"Añadir al proyecto"** → inserta automáticamente `#import "@preview/{name}:{version}"` en el fichero activo (reutilizando el mecanismo de inserción de los asistentes rápidos, §7.7) y dispara la resolución/caché del paquete (§7.6.1) para que la siguiente compilación no tenga que ir a red.
- **"Paquetes usados" (detección automática):** al abrir un proyecto, escanear sus ficheros `.typ` en busca de sentencias `#import "@preview/..."` y construir la lista de dependencias automáticamente (ejemplo del usuario: `✓ erna 0.1.0`, `✓ cetz 0.4.2`), cruzándola contra el índice cacheado para mostrar nombre/versión/actualizaciones disponibles. **Decisión técnica (revisada):** dado que la integración con Typst ahora es 100% vía CLI sidecar (§7.2), sin crates Rust embebidas, el escaneo se implementa como un **escaneo de texto ligero** (patrón acotado sobre líneas no comentadas) en vez de usar el parser `typst::syntax::parse` como librería — mantiene toda la interacción con Typst detrás de un único proceso externo. Detalle y plan B (vía `typst query`) en `TYPST_ECOSYSTEM_RESEARCH.md` §2.5.
- **"Actualizar" un paquete:** no existe un subcomando de CLI equivalente a "actualizar paquete" (`TYPST_ECOSYSTEM_RESEARCH.md` §2.4) — el botón "Actualizar" reescribe directamente el string de versión en el `#import` correspondiente (transacción de CodeMirror 6, §7.7) y deja que la siguiente compilación descargue la nueva versión.
- El **usuario no gestiona imports a mano por defecto** — la resolución en compilación siempre funciona igual (transparente, dentro del proceso `typst`) tanto si el paquete se añadió desde el Package Explorer como si se escribió el `#import` directamente; el Explorer es una capa de descubrimiento/comodidad, no un requisito para que el proyecto compile.

*(Nota de alcance: la **resolución** de `#import "@preview/..."` durante la compilación —es decir, que un proyecto que use un paquete simplemente funcione— ya está cubierta desde el MVP por el propio `typst_engine` de §7.2, sin trabajo adicional; lo que se difiere a Beta es únicamente la **UI de descubrimiento** — Package Explorer y el panel "Paquetes usados".)*

#### 7.6.3. Template Explorer (Beta) y plantillas propias de DBV (MVP)

Vista dedicada, visual y **orientada a proyecto**, distinta del Package Explorer:

- Cada plantilla se presenta con **imagen de vista previa, nombre, descripción, autor, categoría, versión** — acción principal **"Crear Proyecto"**, nunca "Descargar código". El usuario piensa "quiero una tesis", no "necesito el paquete X y el paquete Y" — una plantilla puede depender internamente de varios paquetes sin que el usuario necesite saberlo (el Package Explorer y "Paquetes usados" del §7.6.2 quedan disponibles para quien sí quiera profundizar).
- Pestañas (Addendum original): Instaladas / Comunidad / Favoritas / Recientes / Actualizaciones.
- **Conexión con el MVP:** el Lanzador (§7.13, ya MVP) es funcionalmente un Template Explorer reducido al catálogo curado de DBV, sin las pestañas Comunidad/Favoritas/Recientes/Actualizaciones — el usuario ya vive el flujo "Nuevo Proyecto → Explorar plantillas → Configurar → Crear Proyecto" desde el primer arranque; Beta generaliza esa misma vista con el catálogo comunitario completo.

**"Capa de Plantillas DBV" (`dbv-template.toml`) — MVP, plantillas propias de DBV:**

Cada plantilla propia curada de DBV es un **proyecto Typst completo** (no solo un `.typ`) descrito con el **mismo formato oficial** `typst.toml` + sección `[template]` (path/entrypoint/thumbnail) que usa el propio ecosistema Typst, **desplegada dentro de un árbol de namespace de paquete** (`<dir-plantillas-dbv>/local/<nombre>/<versión>/typst.toml`) para poder invocarla con `typst init --package-path <dir-plantillas-dbv> @local/<nombre>:<versión>` — mecanismo verificado en el Slice 2, ver `TYPST_ECOSYSTEM_RESEARCH.md` §1.2 — por compatibilidad y para poder, si se desea en el futuro, publicarlas también en el `typst/packages` oficial sin reescritura. Como Typst no tiene concepto de "campos de formulario para un asistente" ni de metadatos académicos, se añade un **fichero sidecar propio y opcional** `dbv-template.toml` (junto al `typst.toml`, nunca sustituyéndolo — coherente con el principio Universe-First de §0.1: DBV **enriquece**, no reemplaza) con:

- `dbv_category` — taxonomía académica propia (§ más abajo).
- `[[fields]]` — campos del formulario del asistente de creación (§7.6.4).
- `localization` — nombre/descripción traducidos por idioma (ES/EN), independiente de la traducción que pueda o no tener el `typst.toml` oficial.
- `screenshots` — galería de capturas adicionales más allá del único `thumbnail` oficial, para una ficha más rica en el Template Explorer.
- `defaults` — valores por defecto sugeridos en el formulario (p. ej. precargar el nombre de universidad más usado por el usuario, leído de su configuración local — nunca datos remotos).
- `validation` — reglas simples por campo (obligatorio, longitud, patrón) para el formulario del asistente.

```toml

```toml
# typst.toml (formato oficial Typst — reutilizable/publicable tal cual)
[package]
name = "dbv-tfg-es"
version = "1.0.0"
entrypoint = "main.typ"
authors = ["DBV <https://github.com/davidbuenov>"]
license = "MIT"
description = "Trabajo de Fin de Grado (ES) con portada, índice, capítulos y bibliografía"
categories = ["thesis"]

[template]
path = "template"
entrypoint = "main.typ"
thumbnail = "thumbnail.png"
```

```toml
# dbv-template.toml (sidecar propio de DBV — opcional, §7.6.3)
dbv_category = "academico"   # taxonomía propia de DBV (más específica que las
                               # categorías oficiales: TFG/TFM no son categorías
                               # oficiales de Typst Universe, solo "thesis" lo es)

[localization.es]
name = "TFG"
description = "Trabajo de Fin de Grado con portada, índice, capítulos y bibliografía"

[localization.en]
name = "Undergraduate Thesis"
description = "Final year project with cover page, table of contents, chapters and bibliography"

screenshots = ["screenshots/portada.png", "screenshots/capitulo.png"]

[[fields]]
key = "titulo"
label = "Título"
type = "text"
validation = { required = true, max_length = 200 }

[[fields]]
key = "autor"
label = "Autor"
type = "text"
default = "{{usuario.nombre}}"   # precargado desde la configuración local de DBV, nunca remoto
validation = { required = true }
# ... tutor, universidad, curso, titulación (Addendum original)
```

- Catálogo inicial (MVP, curado): Artículo académico, TFG, TFM, Tesis doctoral, Informe técnico, CV, Presentación. Ampliación v1.0 (categorías completas del Addendum): Académico (+ IEEE, ACM, Springer, LNCS, informe de investigación), Docencia (apuntes, prácticas, examen, guía docente, material de curso), Profesional (propuesta, memorándum), Presentaciones (charlas técnicas, seminarios).
- **Pestaña "Comunidad" (Beta):** filtra el mismo `index.json` cacheado (§7.6.0-7.6.1) por entradas con `template != null`, cruzado con una whitelist curada inicial de DBV antes de abrir al catálogo completo sin filtrar (mitigación de riesgo de cadena de suministro, §6). "Instalar" en una plantilla comunitaria = descargar/cachear su paquete (§7.6.1) + ejecutar el mismo flujo de scaffolding que una plantilla propia (§7.6.4), leyendo `template.path`/`template.entrypoint` de su `typst.toml` oficial (no requiere que la plantilla comunitaria tenga un `dbv-template.toml` — sin sidecar, el asistente simplemente no ofrece campos de formulario y crea el proyecto tal cual, igual que haría `typst init`).
- **Enriquecer plantillas comunitarias con la Capa DBV (spike, pregunta abierta en `SPECIFICATIONS.md` §9):** si en el futuro DBV quisiera curar/enriquecer una plantilla *comunitaria* (no propia) con campos de asistente/localización, **no debe co-ubicarse un `dbv-template.toml` dentro de la caché de paquetes de Typst** (directorio que DBV no controla y que el propio CLI puede sobrescribir al actualizar el paquete). El diseño correcto es un **overlay indexado por `(namespace/nombre, versión)`** en la propia capa de catálogo de DBV (junto al `index.json` cacheado, §7.6.1), de forma que: si la plantilla comunitaria sube de versión y DBV no tiene overlay para la versión nueva, el asistente degrada limpiamente a "sin campos de formulario, scaffolding puro vía `typst init`" (nunca un error) — evita el problema de mantenimiento (metadatos DBV desincronizados de una plantilla de terceros) sin bloquear el uso básico de la plantilla.

Para catálogos de "cientos o miles" de plantillas sin degradar la UX: lista virtualizada en el frontend + el índice de búsqueda local ya cacheado en §7.6.1 (sin repetir consultas de red por cada tecleo de búsqueda).

#### 7.6.4. Asistente de creación de proyecto

Pensado explícitamente como diferenciador de producto (§0.1): el usuario debe sentir que está **creando un documento**, no inicializando un paquete. Flujo: `typst init` (§7.2) hace el scaffolding real → formulario generado dinámicamente desde `dbv-template.toml.fields` de la plantilla elegida si existe (reutiliza `registerPanel()`, §3 fila 13, como modal/panel) → sustitución de tokens como paso posterior de DBV. Campos base recomendados, comunes a la mayoría de plantillas académicas (cada plantilla puede añadir los suyos propios vía `[[fields]]`): **nombre del proyecto** (carpeta/identificador, distinto del título del documento), **título**, **autor**, **institución**, **supervisor/tutor**, **curso/año académico**.

Si la plantilla no trae sidecar (caso de plantillas comunitarias sin curar por DBV), se crea el proyecto directamente desde `template.path`/`template.entrypoint` del `typst.toml` oficial, sin formulario — sigue siendo un "Crear Proyecto" válido, solo que sin los campos de DBV. Al confirmar con sidecar, invoca `create_project(template_id, target_dir, form_values)`, que copia el directorio `template.path` (vía `typst init`) y sustituye los tokens (`{{titulo}}`, etc.) en los ficheros `.typ` mediante sustitución de texto simple (no requiere un motor de plantillas complejo tipo Handlebars). El usuario no edita variables Typst a mano salvo que lo desee explícitamente después.

*(Pregunta abierta en `SPECIFICATIONS.md` §9, refinada: ya no es "si Comunidad se apoya en el registro oficial o no" —resuelto: sí, es el `index.json` público— sino el tamaño exacto de la whitelist curada inicial y el criterio de expansión hacia el catálogo completo.)*

### 7.7. Asistentes de inserción rápida

Extiende el patrón ya existente en DBV Markdown Reader (§1.3, §3 fila 19: botones de toolbar que insertan marcado en la posición del cursor) a la API de transacciones de CodeMirror 6 (`EditorView.dispatch({changes, selection})`), generando Typst en vez de Markdown:

| Botón | Marcado Typst generado (orientativo) |
| --- | --- |
| Insertar figura | `#figure(image("images/..."), caption: [...])` |
| Insertar tabla | `#table(columns: ..., [...], [...])` |
| Insertar ecuación | `$ ... $` |
| Insertar cita | `#cite(<clave>)` |
| Insertar bibliografía | `#bibliography("refs.bib")` |
| Insertar bloque de código | ```` ```lang\n...\n``` ```` |
| Insertar sección | `= Título de sección` |
| Insertar referencia cruzada | `@etiqueta` |

Cada asistente puede abrir un mini-formulario (vía `registerPanel()`) para los casos que necesiten datos (p. ej. "Insertar tabla" pide número de filas/columnas antes de generar el esqueleto). Beta, según roadmap de `SPECIFICATIONS.md` §6.

### 7.8. Panel de navegación estructural (Outline)

Sustituye la fuente de datos del patrón `buildToc`/`setupScrollSpy` (§3 fila 20): en vez de parsear encabezados HTML, invoca el sidecar (§7.2) para obtener los encabezados del documento compilado en JSON, permitiendo clic→navegación tanto en el editor como en la vista previa.

✅ **Spike cerrado en el Slice 2** (adelantado respecto al plan, que lo situaba en Beta). Comando verificado contra el binario real:

```bash
typst eval 'query(heading).map(h => (nivel: h.level, texto: h.body, pagina: h.location().page(), y: h.location().position().y))' \
  --in main.typ --format json
```

Devuelve por cada encabezado: nivel, texto, **número de página y coordenada vertical** — suficiente para la navegación clic→posición sin necesidad de `tinymist` como plan B. Dos avisos de implementación: `typst query` está **deprecado** en 0.15.1 (usar `eval`), y el campo `texto` llega como objeto anidado `{func, text}`, no como cadena plana. Detalle en `TYPST_ECOSYSTEM_RESEARCH.md` §1.5. Beta.

### 7.9. Modos de escritura (Escritura / Edición / Dividido / Lectura)

Extiende el layout resizable con persistencia (§3 fila 15): cada modo es un preajuste de qué paneles están visibles y con qué anchura (Escritura: solo editor, sin barras de herramientas; Edición: editor + todas las herramientas; Dividido: editor + preview; Lectura: solo preview a pantalla completa). No requiere nueva infraestructura de layout, solo presets sobre la ya heredada. Beta.

### 7.10. Gestión de imágenes por arrastre

Nuevo comando Rust `copy_asset_into_project(project_root, source_path) -> relative_path` que copia el fichero soltado a `images/` del proyecto activo y devuelve la ruta relativa; el frontend usa esa ruta para invocar el asistente "Insertar figura" (§7.7) automáticamente. A diferencia de `resolveImages()` en DBV Markdown Reader (que solo *resuelve* rutas ya existentes, de solo lectura), esto requiere una operación de escritura nueva. Beta.

### 7.11. Bibliografía

MVP: las plantillas académicas incluyen `refs.bib` vacío/de ejemplo y ya invocan `#bibliography("refs.bib")` — soporte nativo de Typst, sin trabajo adicional de integración. Beta: panel de exploración de entradas `.bib` (requiere elegir una crate de parseo BibTeX en Rust — pregunta abierta en `SPECIFICATIONS.md` §9) + autocompletado de claves de cita en el asistente "Insertar cita" (§7.7).

### 7.12. Exportaciones y Project Archive (`.dbvt`)

**Decisión:** `.dbvt` es un archivo **ZIP** (crate `zip` en Rust, licencia MIT/Apache-2.0, ampliamente usada) que empaqueta el directorio de proyecto completo (§7.5) más un `manifest.json` propio (versión de la app, versión de Typst usada, plantilla de origen si aplica) para checks de compatibilidad al importar. Dos comandos nuevos: `export_project_archive(project_dir, output_path)` / `import_project_archive(archive_path, target_dir)`.

**Mitigación de seguridad obligatoria (ver riesgo en §6):** el comando de importación debe normalizar y validar cada ruta de entrada del ZIP, rechazando cualquier entrada cuya ruta resuelta caiga fuera del directorio de proyecto destino (protección *zip-slip*), antes de escribir nada a disco.

Exportaciones de documento (distintas del Project Archive): PDF (MVP, artefacto final vía `typst compile ... -` a stdout, §7.2), PNG (Beta, página actual/rango/documento completo, `--format png --pages ...`), SVG (v1.0). "Paquete Docente" (v1.0): combina PDF+SVG+PNG+recursos en un único paquete para plataformas educativas (Moodle, Teams, SharePoint).

### 7.13. Lanzador orientado a tareas

Pantalla inicial nueva (no existe en DBV Markdown Reader, que abre directamente el último/un documento): "¿Qué quieres crear hoy?" con las plantillas del catálogo curado (§7.6.1) + acceso a proyectos recientes (reutilizando el mecanismo de recent-files, §3 fila 5). Sustituye a la apertura directa de documento como pantalla de bienvenida. MVP.

### 7.14. Terminal avanzado

Panel opcional, oculto por defecto (coherente con la filosofía "el usuario no debe ver código si no quiere", `SPECIFICATIONS.md` §2), que expone una consola donde un usuario avanzado puede ejecutar directamente subcomandos oficiales de Typst (`compile`, `query`, `fonts`...) contra el proyecto activo, mostrando la salida (stdout/stderr) dentro de la propia app. Arquitectura: reutiliza exactamente el mismo mecanismo de sidecar de §7.2 (`tauri_plugin_shell::process::Command::sidecar("typst")`), sin lógica adicional de parseo — se limita a mostrar la salida cruda con formato monoespaciado. No sustituye a ningún flujo guiado de la app (creación de proyecto, exportar, etc.); es una vía de escape explícita para quien prefiera trabajar con comandos. Fase: Beta (bajo coste una vez existe la infraestructura de sidecar del MVP, pero es explícitamente una funcionalidad "avanzada", no del flujo principal).


### 7.15. Modo de instalación de WebView2 en Windows (medido en el Slice 2)

**Decisión (pendiente de confirmación del usuario):** `webviewInstallMode: downloadBootstrapper` en vez del `offlineInstaller` que hereda DBV Markdown Reader.

| Modo | Instalador resultante (medido) | Instala sin conexión |
| --- | --- | --- |
| `offlineInstaller` (heredado) | **268 MB** | Sí, siempre |
| `downloadBootstrapper` (elegido) | **18 MB** | Solo si WebView2 ya está en el sistema |

Justificación: WebView2 viene preinstalado en Windows 11 y en Windows 10 actualizado, así que embeber su instalador completo (~200 MB) es peso muerto para la gran mayoría de usuarios. La promesa offline-first del producto es sobre **usar** la aplicación —compilar documentos sin red, que se cumple igual— no sobre instalarla sin red. El caso afectado (máquina sin WebView2 *y* sin conexión durante la instalación) es cada año más raro.

*Si el usuario prefiere priorizar la instalación 100% offline, revertir es cambiar una línea en `tauri.windows.conf.json`, a cambio de multiplicar por 15 el tamaño del instalador.*

---

## 8. Estimación de complejidad por bloque de trabajo

| Bloque | Complejidad | Motivo |
| --- | --- | --- |
| Portar infraestructura Rust reutilizable (§3, filas 1-10) | 🟢 Baja | Copiar y renombrar, tests ya existentes como red de seguridad |
| Adaptar theming/paneles/i18n/layout (§3, filas 11-18) | 🟢 Baja-Media | Mecanismo probado, solo cambia contenido |
| Integrar CodeMirror 6 + modo Typst + Vite | 🟠 Media-Alta | Primera introducción de bundler en la familia DBV |
| Gestión del sidecar `typst` (`typst_engine`: spawn, captura stdout/stderr, cancelación, ficheros temporales de salida SVG) | 🟠 Media | Superficie más simple que integrar crates (proceso + parseo de salida), pero nueva infraestructura de gestión de procesos hijo; corazón técnico del producto |
| Vendorizado del binario `typst` por plataforma en CI (descarga de release oficial, colocación en `src-tauri/binaries/`) | 🟡 Media-Baja | Mecánico una vez definido, pero nuevo paso de CI no presente en DBV Markdown Reader |
| Modelo de Proyecto + explorador de proyecto | 🟢 Baja-Media | Extiende `list_directory`/`filetree.js` ya existentes |
| Lanzador de tareas | 🟢 Baja | UI nueva pero simple, sin lógica de negocio compleja |
| Asistente de creación de proyecto (invoca `typst init` + post-procesa tokens del sidecar `dbv-template.toml`) | 🟠 Media | `typst init` resuelve el scaffolding; el trabajo propio es el formulario dinámico y la sustitución de tokens posterior |
| 7 plantillas curadas iniciales (contenido Typst + `typst.toml`/`[template]` + `dbv-template.toml`) | 🟠 Media | Trabajo de contenido más que de ingeniería; requiere conocimiento de maquetación Typst por tipo de documento |
| Project Archive `.dbvt` (export/import zip + sanitización de rutas) | 🟢 Baja-Media | Crate `zip` madura; la parte delicada es la validación de seguridad (§6), acotada y testeable |
| Package Explorer + Template Explorer (Beta) — capa de sincronización de `index.json` compartida | 🟠 Media | Fuente de datos única y pública ya identificada (`TYPST_ECOSYSTEM_RESEARCH.md` §5); el esfuerzo real está en UX de catálogos grandes (virtualización, búsqueda local) y en las dos superficies de presentación separadas |
| "Paquetes usados" (detección automática de `#import`) + reescritura de versión para "Actualizar" | 🟡 Media-Baja | Escaneo de texto acotado (no crate embebida) + una transacción de edición en CodeMirror; sin comando CLI equivalente que reutilizar (§6) |
| Asistentes de inserción rápida (Beta) | 🟠 Media | Patrón ya validado en DBV Markdown Reader (§3 fila 19), solo cambia la API de destino |
| Outline estructural (Beta) | 🟠 Media | Vía `typst query heading` del sidecar ya existente (§7.2); pendiente de spike de formato de salida, pero sin nueva infraestructura de proceso |
| Sincronización editor↔preview por posición real (Beta) | 🔴 Alta | Sin precedente reutilizable; depende de `tinymist` (LSP separado); pospuesto a Beta |
| Terminal avanzado (Beta) | 🟢 Baja | Reutiliza literalmente la infraestructura de sidecar del MVP; solo añade una vista de salida cruda |
| Gestión de imágenes por arrastre (Beta) | 🟡 Media-Baja | Un comando Rust nuevo + reutilizar el asistente "Insertar figura" |
| Bibliografía visual (Beta) | 🟠 Media | Depende de elegir crate de parseo BibTeX (pregunta abierta) |
| Empaquetado Windows/Linux (CI, NSIS, AppImage/deb) | 🟢 Baja | Config casi copiable de dbv-md-reader |
| Auto-actualizador | 🟢 Baja | Reutilizable sin cambios funcionales |

---

## 🔑 Decisiones Técnicas Clave (resumen)

### Seguridad

- **Sin red obligatoria en el flujo de compilación/edición** — 100% offline en el MVP; red opcional solo para descarga bajo demanda de plantillas/paquetes comunitarios (Beta), con caché local tras la primera descarga.
- **Importación de `.dbvt`:** validación obligatoria anti *zip-slip* antes de escribir a disco (§7.12, §6).
- **Plantillas comunitarias (Beta):** whitelist curada inicial antes de abrir al registro completo sin filtrar (§7.6.3, §6).
- **Datos sensibles:** ninguno específico del dominio; se mantiene el principio de menor privilegio ya aplicado en `capabilities/main.json` de DBV Markdown Reader.

### Estilo de Código

- Mismas convenciones que el resto de proyectos `dbv-*` (`<coding_standards>` de `MASTER_PROMPT.md`): un solo `return` + guard clauses, patrón `Result`, tipado estricto (Rust ya lo impone; activar `strict` en `tsconfig.json` del frontend con Vite — recomendado adoptar TypeScript dado que CodeMirror 6 está escrito en TypeScript).

### Gestión de Estado

- Backend: patrón `.manage()` de Tauri con structs `Mutex<...>` (Watcher, documentos/proyectos abiertos); añadir `TypstEngineState` (proceso sidecar activo, cancelación de compilaciones en curso) y `UniverseIndexState` (caché en memoria del `index.json` de catálogo, §7.6.1).
- Frontend: mantener el patrón `window.DBV*` para los módulos heredados; CodeMirror 6 gestiona su propio estado interno (`EditorState`/`EditorView`).

---

## ⚠️ Restricciones y Riesgos Técnicos

Ver tabla completa en §6. Restricción transversal: cualquier desviación de las decisiones de §7 tomada durante `/build` debe registrarse en `dbv-specs-ops/memory.md` bajo `## 🏗️ Log de Decisiones Técnicas`, tal como exige `MASTER_PROMPT.md`.

---

## 🤖 Agent Harness (Arnés del Agente)

- **Contexto Estático:** `CLAUDE.md`/`GEMINI.md`/`.windsurfrules`/`.github/copilot-instructions.md` (raíz) + `dbv-specs-ops/project.config.md` + este fichero + `memory.md`.
- **Contexto Dinámico / Skills:** No aplica todavía.
- **Servidores MCP:** Ninguno requerido para el MVP.
- **Sandboxing:** Desarrollo local estándar; compilación Rust nativa por plataforma.
- **Guardrails:** Herencia directa de los ya usados en `dbv-md-reader`, más las mitigaciones específicas de §6 (zip-slip, whitelist de plantillas).
- **Agent Readiness (Web):** No aplica.

---

**Instrucción para la IA:** Este documento fija las decisiones de §7 como línea base para `/plan` y `/build`, gobernadas por los principios arquitectónicos de §0.1 (Typst aporta infraestructura, DBV aporta experiencia; Universe-First): editor CodeMirror 6 (reconfirmado tras re-evaluación de Monaco), integración con Typst **vía CLI oficial vendorizado como sidecar** (no crates embebidas — decisión revisada, ver §7.2 y `TYPST_ECOSYSTEM_RESEARCH.md`), preview SVG en vivo + PDF final por stdout, modelo de Proyecto, **Universe Browser** (Package Explorer + Template Explorer, §7.6) como punto de entrada de primer nivel sobre el `index.json` oficial de Typst Universe, Project Archive `.dbvt` como ZIP con protección zip-slip, y terminal avanzado para usuarios avanzados. Cualquier cambio debe registrarse como Decisión Técnica en `memory.md` antes de implementarse.
