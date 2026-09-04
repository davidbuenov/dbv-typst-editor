# 🏗 Arquitectura Técnica: DBV Typst Editor

> **Fase:** `/plan` (Planificación Técnica) — Informe de análisis de reutilización sobre DBV Markdown Reader
> **Estado:** Borrador para validación — v2 (incorpora Spec Addendum del usuario: producto orientado a documento/proyecto, no a código)
> **Última Revisión:** 2026-09-04
> **Fuente analizada:** `d:/Programacion/github-davidbuenov/dbv-md-reader` (v0.15.0, commit `23fccad`)

---

## 0. Resumen ejecutivo

DBV Markdown Reader es una base de reutilización **excelente en infraestructura de aplicación** (shell Tauri, ciclo de vida de ficheros, empaquetado, auto-actualización, i18n, theming) pero **insuficiente en el núcleo de edición**: es fundamentalmente un *visor* con capacidad de edición mínima (un `<textarea>` plano), mientras que DBV Typst Editor necesita ser una herramienta de escritura orientada a documento/proyecto desde el día 1 (ver Spec Addendum en `SPECIFICATIONS.md` §2: "para Typst lo que Obsidian es para Markdown", no un editor de código para desarrolladores).

| Categoría | % aprox. del esfuerzo total evitado | Ejemplos |
| --- | --- | --- |
| Reutilizable sin cambios | ~30% | Watcher de ficheros, single-instance, recent-files, updater, CI de release, patrón de tests Rust |
| Adaptación menor o conceptual | ~30% | Theming CSS, paneles flotantes, file-tree→project-tree, atajos de teclado, toolbar de inserción (patrón, no código), empaquetado/asociación de fichero |
| Trabajo nuevo (núcleo de producto) | ~40% | Compilador Typst embebido, editor CodeMirror 6, lanzador, asistente de proyecto, marketplace de plantillas, outline, Project Archive |

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
| `tauri` 2.x + `tauri-plugin-{shell,dialog,updater,process,os,single-instance}` | Rust | Núcleo de la plataforma |
| `serde` / `serde_json` | Rust | (De)serialización de config/recent-projects/manifiestos de plantilla |
| `notify` | Rust | Watcher de ficheros |
| `tempfile` | Rust (dev) | Fixtures de test aisladas |
| `@tauri-apps/api` + plugins JS homónimos | JS | Bindings oficiales |
| `dompurify` | JS | Sanitizar cualquier string dinámico insertado como HTML en la UI (mensajes de error del compilador, metadatos de plantillas comunitarias) |

## 5. Dependencias que deberían sustituirse (o eliminarse)

| Dependencia actual | Motivo | Sustituto propuesto |
| --- | --- | --- |
| `markdown-it` + plugins | No hay Markdown que parsear | *(eliminar)* — compilador Typst |
| `prismjs` (+20 gramáticas) | El resaltado de salida HTML no aplica | Modo de lenguaje Typst para CodeMirror 6 (§7.1) |
| `mermaid` + `pako` | Typst tiene sus propios paquetes de diagramas (`cetz`) | *(eliminar)* |
| `katex` | Typst tiene tipografía matemática nativa | *(eliminar)* |
| `ureq` (descarga remota vía HTTP) | Casos de uso Typst son locales; salvo la descarga de paquetes/plantillas comunitarias en Beta (§7.6), que usa el propio mecanismo de Typst, no `ureq` genérico | *(eliminar del MVP)* |
| Uso de `<textarea>` como editor | Sin resaltado/autocompletado/plegado | **CodeMirror 6** (§7.1) |

---

## 6. Riesgos técnicos

| Riesgo | Severidad | Mitigación propuesta |
| --- | --- | --- |
| El backend Rust de DBV Markdown Reader es un monolito de ~1200 líneas; el Typst Editor añade compilador embebido + gestión de proyecto + marketplace + (Beta) LSP. | Media | Modularizar desde el inicio (`commands/`, `watcher.rs`, `typst_engine.rs`, `project.rs`, `templates.rs`) — ver §7.4. |
| Las crates del ecosistema Typst (`typst`, `typst-pdf`, `typst-svg`, `typst-ide`, `typst-kit`) tienen API interna que cambia entre versiones menores. | Alta | Fijar versiones exactas, aislar tras un módulo `typst_engine` con interfaz estable propia — ver §7.2. |
| CodeMirror 6 es ES Modules-first — incompatible con el patrón "sin bundler" de DBV Markdown Reader. | Media | Introducir Vite solo para el frontend del Typst Editor — cambio consciente, ver §7.1. |
| Sincronización editor↔preview por posición real requiere mapeo de `SourceSpan` de Typst; no hay precedente reutilizable directo (el de Markdown usa anclas de heading). | Media | Usar `typst-ide` (crate oficial), mismo mecanismo que `tinymist`. Se pospone a Beta. |
| Tamaño del instalador: el compilador Typst embebido (`typst-kit` incluye fuentes) puede superar el objetivo `<30MB`. | Media | Medir en spike temprano de `/build`; considerar fuentes del sistema + descarga opcional bajo demanda si excede el umbral. |
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

### 7.2. Integración del compilador Typst

**Decisión:** embeber las crates Rust oficiales del propio Typst (`typst`, `typst-pdf`, `typst-svg`, `typst-ide`, `typst-kit`) directamente en el backend Tauri, **no** invocar un binario `typst` externo como sidecar/CLI.

Justificación:

- Coherente con la filosofía "single self-contained binary" que ya sigue DBV Markdown Reader.
- Evita desalineación de versión con un `typst` instalado por el usuario.
- Permite compilar a bytes en memoria (SVG/PDF) sin pasar por el sistema de ficheros en cada recompilación.
- Da acceso directo a `typst-ide` para diagnósticos/autocompletado (Beta) y outline (§7.8).
- **La crate `typst-kit` incluye `PackageStorage`**, el mismo mecanismo que usa `typst-cli` para resolver e importar paquetes `@preview/*` con descarga-y-caché local — reutilizable directamente tanto para compilar documentos que importan paquetes de terceros como para el marketplace de plantillas comunitarias (§7.6). *(Nombre de API a confirmar contra la versión exacta de `typst-kit` en `/build`, dado que el ecosistema evoluciona rápido — ver riesgo en §6.)*

**Plan B:** si la API de las crates resulta demasiado inestable, aislar tras `typst_engine` permite migrar a sidecar CLI (`tauri-plugin-shell` ya está en el stack heredado) sin reescribir el resto de la app.

### 7.3. Estrategia de vista previa en tiempo real

**Decisión:** renderizar cada página como **SVG** (`typst-svg`) para la vista previa en vivo; reservar el **PDF real** (`typst-pdf`) para guardado/exportación final.

Justificación: SVG es vectorial, permite refresco incremental sin PDF.js, y reutiliza el mecanismo watch→debounce→re-render de §1.4.

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
│   │   ├── templates.rs                # NUEVO — scaffolding, marketplace/PackageStorage (§7.6)
│   │   ├── archive.rs                   # NUEVO — export/import .dbvt (zip), sanitización de rutas (§7.12)
│   │   └── typst_engine/                 # NUEVO — compilación, SVG/PDF, IDE/diagnósticos/outline
│   └── tauri.conf.json + overlays por plataforma (heredado)
├── templates/                 # Plantillas .typ (es/en) por categoría — patrón heredado del Addendum
│   ├── academico/{articulo,tfg,tfm,tesis,ieee,acm,springer,lncs}/
│   ├── docencia/{apuntes,practicas,examen,guia-docente}/
│   ├── profesional/{informe-tecnico,propuesta,memorando,cv}/
│   └── presentaciones/{deck,charla-tecnica,seminario}/
│       └── (cada plantilla: ficheros .typ + manifest.toml con campos del asistente, §7.6.1)
├── dbv-specs-ops/              # Documentación SDD (este directorio)
├── start.cmd / start.sh        # Heredado sin cambios
└── stop.cmd / stop.sh           # Heredado sin cambios
```

### 7.5. Modelo de Proyecto

**Decisión:** la unidad de trabajo es un directorio de proyecto (`SPECIFICATIONS.md` §4: `main.typ`, `refs.bib`, `chapters/`, `images/`, `assets/`, `settings/`), con un manifiesto propio de DBV (p. ej. `settings/dbv-project.toml`) que registra metadatos **que Typst no conoce** (plantilla de origen, versión de la plantilla, fecha de creación, valores de los campos del asistente §7.6.2) — nunca metadatos de compilación, que son responsabilidad exclusiva de Typst.

Arquitectura: extiende `list_directory`/`filetree.js` (§3 fila 6) para mostrar la estructura completa del proyecto en vez de un único fichero; añade comandos Rust `create_project(template_id, target_dir, form_values)`, `open_project(dir)`, `read_project_manifest(dir)`. Un `.typ` suelto abierto directamente se trata como "proyecto de un solo fichero" (sin manifiesto) para mantener compatibilidad con documentos Typst ya existentes fuera de DBV Typst Editor.

### 7.6. Plantillas y Marketplace

#### 7.6.1. Plantillas propias (MVP y ampliación v1.0)

Cada plantilla es un **proyecto Typst completo** (no solo un `.typ`) más un `manifest.toml`:

```toml
id = "tfg-es"
name = "TFG"
category = "academico"
author = "DBV"
version = "1.0.0"
description = "Trabajo de Fin de Grado con portada, índice, capítulos y bibliografía"

[[fields]]
key = "titulo"
label = "Título"
type = "text"

[[fields]]
key = "autor"
label = "Autor"
type = "text"
# ... tutor, universidad, curso, titulación (§ Addendum)
```

El asistente de creación de proyecto (§7.6.2) lee `fields` para generar el formulario dinámicamente; el comando `create_project` copia el directorio de la plantilla y sustituye los tokens (`{{titulo}}`, etc.) en los ficheros `.typ` mediante una sustitución de texto simple (no requiere un motor de plantillas complejo tipo Handlebars).

Catálogo inicial (MVP, curado): Artículo académico, TFG, TFM, Tesis doctoral, Informe técnico, CV, Presentación. Ampliación v1.0 (categorías completas del Addendum): Académico (+ IEEE, ACM, Springer, LNCS, informe de investigación), Docencia (apuntes, prácticas, examen, guía docente, material de curso), Profesional (propuesta, memorándum), Presentaciones (charlas técnicas, seminarios).

#### 7.6.2. Asistente de creación de proyecto

Formulario generado dinámicamente desde `manifest.toml.fields` de la plantilla elegida (reutiliza `registerPanel()`, §3 fila 13, como modal/panel). Al confirmar, invoca `create_project`. El usuario no edita variables Typst a mano salvo que lo desee explícitamente después.

#### 7.6.3. Marketplace de plantillas comunitarias (Beta)

**Decisión propuesta:** apoyar la pestaña "Comunidad" en el **registro oficial de paquetes de Typst** (`@preview/*`, indexado públicamente como "Typst Universe") en vez de construir un backend propio desde cero para el MVP/Beta — reduce drásticamente el esfuerzo de construir y mantener infraestructura de distribución de paquetes, y da acceso inmediato a un catálogo ya existente y mantenido por la comunidad Typst. La descarga/caché reutiliza el mismo mecanismo `PackageStorage` de `typst-kit` que ya usa el motor de compilación (§7.2) — primera descarga requiere red, uso posterior 100% offline (coherente con el objetivo offline-first).

Pestañas de la UI (Addendum): Instaladas / Comunidad / Favoritas / Recientes / Actualizaciones. Ficha de plantilla: nombre, autor, versión, descripción, capturas, categoría, botones Instalar/Crear Proyecto — sin mostrar código inicialmente.

Para catálogos de "cientos o miles" de plantillas sin degradar la UX: lista virtualizada en el frontend (renderizar solo las filas visibles) + un índice de búsqueda local ligero (JSON/SQLite cacheado, actualizado bajo demanda) en vez de repetir consultas de red por cada tecleo de búsqueda.

*(Pregunta abierta registrada en `SPECIFICATIONS.md` §9: si "Comunidad" se apoya 100% en el registro oficial de Typst o se complementa con curación propia de DBV — la whitelist inicial de seguridad de §6 apunta a que el MVP de esta pestaña debería lanzar con una selección curada, no el registro completo sin filtrar.)*

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

Sustituye la fuente de datos del patrón `buildToc`/`setupScrollSpy` (§3 fila 20): en vez de parsear encabezados HTML, consulta la estructura del documento Typst compilado (mecanismo `query()`, el mismo que respalda `typst query` en la CLI oficial y el "Outline" de `tinymist` en VS Code) para obtener nodos de encabezado con su `SourceSpan`, permitiendo clic→navegación tanto en el editor como en la vista previa. Beta.

### 7.9. Modos de escritura (Escritura / Edición / Dividido / Lectura)

Extiende el layout resizable con persistencia (§3 fila 15): cada modo es un preajuste de qué paneles están visibles y con qué anchura (Escritura: solo editor, sin barras de herramientas; Edición: editor + todas las herramientas; Dividido: editor + preview; Lectura: solo preview a pantalla completa). No requiere nueva infraestructura de layout, solo presets sobre la ya heredada. Beta.

### 7.10. Gestión de imágenes por arrastre

Nuevo comando Rust `copy_asset_into_project(project_root, source_path) -> relative_path` que copia el fichero soltado a `images/` del proyecto activo y devuelve la ruta relativa; el frontend usa esa ruta para invocar el asistente "Insertar figura" (§7.7) automáticamente. A diferencia de `resolveImages()` en DBV Markdown Reader (que solo *resuelve* rutas ya existentes, de solo lectura), esto requiere una operación de escritura nueva. Beta.

### 7.11. Bibliografía

MVP: las plantillas académicas incluyen `refs.bib` vacío/de ejemplo y ya invocan `#bibliography("refs.bib")` — soporte nativo de Typst, sin trabajo adicional de integración. Beta: panel de exploración de entradas `.bib` (requiere elegir una crate de parseo BibTeX en Rust — pregunta abierta en `SPECIFICATIONS.md` §9) + autocompletado de claves de cita en el asistente "Insertar cita" (§7.7).

### 7.12. Exportaciones y Project Archive (`.dbvt`)

**Decisión:** `.dbvt` es un archivo **ZIP** (crate `zip` en Rust, licencia MIT/Apache-2.0, ampliamente usada) que empaqueta el directorio de proyecto completo (§7.5) más un `manifest.json` propio (versión de la app, versión de Typst usada, plantilla de origen si aplica) para checks de compatibilidad al importar. Dos comandos nuevos: `export_project_archive(project_dir, output_path)` / `import_project_archive(archive_path, target_dir)`.

**Mitigación de seguridad obligatoria (ver riesgo en §6):** el comando de importación debe normalizar y validar cada ruta de entrada del ZIP, rechazando cualquier entrada cuya ruta resuelta caiga fuera del directorio de proyecto destino (protección *zip-slip*), antes de escribir nada a disco.

Exportaciones de documento (distintas del Project Archive): PDF (MVP, artefacto final vía `typst-pdf`), PNG (Beta, página actual/rango/documento completo), SVG (v1.0). "Paquete Docente" (v1.0): combina PDF+SVG+PNG+recursos en un único paquete para plataformas educativas (Moodle, Teams, SharePoint).

### 7.13. Lanzador orientado a tareas

Pantalla inicial nueva (no existe en DBV Markdown Reader, que abre directamente el último/un documento): "¿Qué quieres crear hoy?" con las plantillas del catálogo curado (§7.6.1) + acceso a proyectos recientes (reutilizando el mecanismo de recent-files, §3 fila 5). Sustituye a la apertura directa de documento como pantalla de bienvenida. MVP.

---

## 8. Estimación de complejidad por bloque de trabajo

| Bloque | Complejidad | Motivo |
| --- | --- | --- |
| Portar infraestructura Rust reutilizable (§3, filas 1-10) | 🟢 Baja | Copiar y renombrar, tests ya existentes como red de seguridad |
| Adaptar theming/paneles/i18n/layout (§3, filas 11-18) | 🟢 Baja-Media | Mecanismo probado, solo cambia contenido |
| Integrar CodeMirror 6 + modo Typst + Vite | 🟠 Media-Alta | Primera introducción de bundler en la familia DBV |
| Integrar crates Typst (compilación embebida SVG/PDF) | 🔴 Alta | Superficie de API nueva y potencialmente inestable; corazón técnico del producto |
| Modelo de Proyecto + explorador de proyecto | 🟢 Baja-Media | Extiende `list_directory`/`filetree.js` ya existentes |
| Lanzador de tareas | 🟢 Baja | UI nueva pero simple, sin lógica de negocio compleja |
| Asistente de creación de proyecto (formulario + scaffolding) | 🟠 Media | Sin código previo que reutilizar, pero sin incertidumbre técnica |
| 7 plantillas curadas iniciales (contenido Typst + manifest.toml) | 🟠 Media | Trabajo de contenido más que de ingeniería; requiere conocimiento de maquetación Typst por tipo de documento |
| Project Archive `.dbvt` (export/import zip + sanitización de rutas) | 🟢 Baja-Media | Crate `zip` madura; la parte delicada es la validación de seguridad (§6), acotada y testeable |
| Marketplace de plantillas comunitarias (Beta) | 🔴 Alta | Depende de la estabilidad de `typst-kit::PackageStorage` (riesgo §6) y de UX de catálogos grandes (virtualización, búsqueda) |
| Asistentes de inserción rápida (Beta) | 🟠 Media | Patrón ya validado en DBV Markdown Reader (§3 fila 19), solo cambia la API de destino |
| Outline estructural (Beta) | 🔴 Alta | Requiere `typst-ide`/`query()`, sin precedente reutilizable directo |
| Sincronización editor↔preview por posición real (Beta) | 🔴 Alta | Sin precedente reutilizable; pospuesto a Beta |
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

- Backend: patrón `.manage()` de Tauri con structs `Mutex<...>` (Watcher, documentos/proyectos abiertos); añadir `TypstEngineState` (compilación incremental) y `PackageStorageState` (caché de paquetes/plantillas comunitarias).
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

**Instrucción para la IA:** Este documento fija las decisiones de §7 (editor CodeMirror 6 — reconfirmado tras re-evaluación de Monaco, compilador Typst embebido vía crates, preview SVG+PDF, modelo de proyecto, marketplace apoyado en el registro oficial de Typst, Project Archive `.dbvt` como ZIP con protección zip-slip) como línea base para `/plan` y `/build`. Cualquier cambio debe registrarse como Decisión Técnica en `memory.md` antes de implementarse.
