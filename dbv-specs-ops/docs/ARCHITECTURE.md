# 🏗 Arquitectura Técnica: DBV Typst Editor

> **Fase:** `/plan` (Planificación Técnica) — Informe de análisis de reutilización sobre DBV Markdown Reader
> **Estado:** Borrador para validación
> **Última Revisión:** 2026-09-04
> **Fuente analizada:** `d:/Programacion/github-davidbuenov/dbv-md-reader` (v0.15.0, commit `23fccad`)

---

## 0. Resumen ejecutivo

DBV Markdown Reader es una base de reutilización **excelente en infraestructura de aplicación** (shell Tauri, ciclo de vida de ficheros, empaquetado, auto-actualización, i18n, theming) pero **insuficiente en el núcleo de edición**: es fundamentalmente un *visor* con capacidad de edición mínima (un `<textarea>` plano), mientras que DBV Typst Editor necesita ser un editor de código profesional desde el día 1. La estrategia recomendada es: **reutilizar ~60% de la infraestructura Rust/Tauri prácticamente sin cambios, adaptar ~25% del frontend (theming, paneles, gestión de ficheros/proyecto) y sustituir por completo el ~15% restante** (todo el pipeline de renderizado Markdown→HTML y el propio componente de edición de texto).

| Categoría | % aprox. del esfuerzo total evitado | Ejemplos |
| --- | --- | --- |
| Reutilizable sin cambios | ~35% | Watcher de ficheros, single-instance, recent-files, updater, CI de release, patrón de tests Rust |
| Adaptación menor | ~25% | Theming CSS, paneles flotantes, file-tree, atajos de teclado, empaquetado/asociación de fichero |
| Reemplazo completo | ~40% (pero es el núcleo del valor del producto) | Pipeline de renderizado, componente de edición, integración con el compilador Typst, sistema de plantillas |

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

Backend **no modularizado** (todo en `lib.rs`): esto es una decisión consciente documentada en `NATIVE_DESKTOP_APPS.md` para un proyecto de este tamaño, pero **DBV Typst Editor va a superar ampliamente ese tamaño** (compilador embebido, LSP, gestión de proyectos multi-fichero) — se recomienda modularizar desde el inicio (ver §7.4).

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
| `watch_file` | Watcher `notify` sobre directorio padre, emite `file-changed` | ✅ **Reutilizable casi literal** — es el mecanismo más valioso a heredar |
| `get_recent_files` / `add_recent_file` / `clear_recent_files` | Recientes persistidos en JSON | ✅ Sin cambios |
| `list_directory` | Árbol de directorio (1 nivel, lazy) | ✅ Sin cambios (para RF-06, gestión de proyecto) |
| `reveal_in_file_manager` | "Mostrar en el explorador" | ✅ Sin cambios |
| `open_in_new_window` | Nueva ventana, mismo proceso | ✅ Sin cambios |

### 1.3. Frontend: patrón arquitectónico

**No hay componentes ni framework** — convención "IIFE + espacio de nombres `window.DBV*`" (`window.DBVApp`, `window.DBVFileTree`, `window.DBV_I18N`). Cada fichero JS se auto-encapsula; el fichero `NATIVE_DESKTOP_APPS.md` (§3) documenta por qué esto es **obligatorio** en este patrón sin bundler (colisión de identificadores globales = fallo de parseo silencioso de todo el fichero).

Primitiva reutilizable clave: `registerPanel(panelEl, opts)` (`app.js:1058-1088`) — factoría de apertura/cierre/click-fuera para **todo** panel flotante o modal (URL, Settings, Search, About, conflicto, Quick Open). Esta es la abstracción resultante del refactor "consolidar paneles flotantes" mencionado en el historial de commits — **candidata directa a reutilización literal**.

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

Este es el **hallazgo más valioso del análisis**: el patrón *watch(directorio padre) → debounce → supresión de auto-eco → recompilar → re-render preservando scroll*, es exactamente la arquitectura que necesita un editor Typst con vista previa en tiempo real. Solo cambian los pasos finales (parseo Markdown→HTML se sustituye por invocar al compilador Typst y volcar el resultado como SVG/PDF, ver §7.2).

### 1.5. Ventana/UI, persistencia de configuración, auto-actualizador, asociación de fichero, plantillas, testing

Ver detalle completo en la tabla de componentes §3. Resumen de hallazgos relevantes:

- **No hay `tauri-plugin-store`**: preferencias de UI en `localStorage` (tema, zoom, splits, últimos docs); solo `recent_files.json` vive en `app_data_dir()` gestionado por Rust.
- **Auto-actualizador** (`tauri-plugin-updater`): chequeo solo bajo demanda (nunca automático), deshabilitado en Android y en builds MSIX de Microsoft Store (`is_packaged_app`), firmado con minisign, `latest.json` generado manualmente (`scripts/generate-latest-json.mjs`). Config en `tauri.conf.json` `plugins.updater`.
- **Asociación de fichero**: 100% declarativa en `bundle.fileAssociations` de `tauri.conf.json` — sin código Rust adicional. El runtime ya soporta el "hilo" cold-start/warm-start/macOS-Opened/Android-Intent de forma agnóstica al formato.
- **Plantillas**: `templates/` en la raíz contiene 34 `.md` estáticos (ES/EN) **sin ninguna integración en la app** — ni comando Rust, ni selector UI, ni siquiera existe un "Guardar como" en la app actual (confirmado leyendo `saveCurrentDocument`, que siempre sobrescribe `currentDoc.path`). Es decir: el sistema de plantillas de DBV Typst Editor es **trabajo nuevo al 100%**, aunque la organización bilingüe/por categorías del directorio es un patrón razonable a imitar.
- **CI/Build**: `release-linux.yml` y `release-macos.yml` (GitHub Actions, `tauri-apps/tauri-action@v0`, Release en borrador). **Windows es 100% manual** (no hay `release-windows.yml`). NSIS muy personalizado (`nsis/hooks.nsh`, `installer.nsi.template`).
- **Testing**: sin frameworks JS (no Jest/Vitest). Tests Rust inline en `lib.rs` (`#[cfg(test)]`, ~30 tests) sobre funciones puras extraídas deliberadamente de los comandos `#[tauri::command]` para ser testeables sin `AppHandle` real, más `tempfile` para fixtures aisladas. Patrón directamente reutilizable.

---

## 2. Tecnologías utilizadas (DBV Markdown Reader)

**Backend (Rust / `src-tauri/Cargo.toml`):** `tauri` 2.0 (feature `protocol-asset`), `tauri-plugin-shell/dialog/updater/process/os` 2.x, `tauri-plugin-single-instance` 2.4.3 (solo desktop), `tauri-plugin-saf` (plugin propio, solo Android), `serde`/`serde_json` 1.0, `notify` 8.2.0, `ureq` 3.4.0, `rustls` 0.23 (provider `ring`), `ctor` 0.8, `sys-locale` 0.3, `tempfile` 3.27 (dev).

**Frontend (`package.json`, sin bundler en runtime):** `markdown-it` 14.1 + `markdown-it-footnote`/`markdown-it-task-lists`, `dompurify` 3.4.13, `katex` 0.18.4, `mermaid` 11.4.1, `pako` 3.0.1, `prismjs` 1.29 (+20 gramáticas), `@tauri-apps/api` 2.2, `@tauri-apps/plugin-{process,shell,updater}` 2.x. Todo vendorizado a mano en `src/vendor/*.min.js`.

**Empaquetado:** NSIS (Windows), AppImage + .deb (Linux), dmg/.app (macOS, sin firmar hoy). Sin bundler de frontend (`frontendDist` apunta directo a `src/`).

---

## 3. Componentes reutilizables — clasificación explícita

Leyenda: 🟢 Reutilizable sin cambios · 🟡 Adaptación menor · 🔴 Reemplazo completo

| # | Componente | Origen (fichero) | Clasificación | Complejidad de adaptación |
| --- | --- | --- | --- | --- |
| 1 | Watcher de fichero (directorio padre + debounce + evento IPC) | `lib.rs:457-503` + `app.js:552-568` | 🟢 | Trivial — copiar tal cual, solo cambia qué se hace tras el evento |
| 2 | Supresión de auto-eco en guardado (`suppressSelfWriteUntil`) | `app.js:2153` | 🟢 | Trivial |
| 3 | Modal de conflicto (cambio externo con ediciones sin guardar) | `app.js` (patrón `conflictPending`) | 🟢 | Trivial |
| 4 | Single-instance + apertura por doble clic (`RunEvent::Opened`, cold/warm) | `lib.rs:154-171, 800-938` | 🟢 | Trivial — cambiar solo la lista de extensiones (`MARKDOWN_EXTENSIONS` → `.typ`) |
| 5 | Recent files (JSON en `app_data_dir`, cap 10, autolimpieza) | `lib.rs:209-228, 505-530` | 🟢 | Trivial |
| 6 | Explorador de directorio lazy (`list_directory`) + Quick Open | `lib.rs:574-590`, `filetree.js` | 🟢 | Trivial — cambiar filtro `is_markdown` → `is_typst` |
| 7 | Auto-actualizador (`tauri-plugin-updater`, UI bajo demanda, detección MSIX) | `lib.rs:349-361, 798`, `app.js:1236-1299` | 🟢 | Trivial |
| 8 | CI de Release (Linux/macOS `tauri-action`, draft release) | `.github/workflows/*.yml` | 🟢 | Trivial — cambiar nombre de producto/identifier |
| 9 | Scripts `build.mjs` / `generate-latest-json.mjs` / `installer-name.mjs` | `scripts/` | 🟢 | Trivial |
| 10 | Patrón de tests Rust (funciones puras extraídas + `tempfile`) | `lib.rs:941-1194` | 🟢 | Trivial — mismo patrón, nuevas funciones |
| 11 | Asociación de fichero declarativa (`bundle.fileAssociations`) | `tauri.conf.json:47-55` | 🟡 | Baja — cambiar extensión/mimeType/rol |
| 12 | Sistema de theming (CSS custom properties, `[data-theme]`, claro/oscuro/sepia) | `styles.css:10-99` | 🟡 | Baja — mantener tokens `--bg-*/--text-*/--accent`, retocar paleta de marca |
| 13 | `registerPanel()` — factoría de paneles flotantes/modales | `app.js:1058-1088` | 🟡 | Baja — reutilizar la función, adaptar los paneles concretos |
| 14 | i18n hecho a mano (diccionario ES/EN + `t()`) | `i18n.js` | 🟡 | Baja — mismo mecanismo, nuevas claves |
| 15 | Layout resizable (split editor/preview, split TOC) con persistencia `localStorage` | `app.js:1707-1732` | 🟡 | Baja — mismo mecanismo, aplicado a editor↔preview |
| 16 | Menú nativo macOS hecho a mano + eventos `menu-open-file`/`menu-save` | `lib.rs:643-779, 846-866` | 🟡 | Media — añadir entradas propias de Typst (compilar, exportar PDF) |
| 17 | Gestión de "guardar"/dirty-state/confirmación de descarte | `app.js` (`setDirty`, `confirmDiscardUnsavedChanges:89-99`) | 🟡 | Baja — formato-agnóstico, ya reutilizable casi literal |
| 18 | Capabilities/permisos Tauri (`capabilities/main.json`) | `src-tauri/capabilities/` | 🟡 | Baja — mismo esqueleto, revisar permisos de shell si se añade sidecar |
| 19 | Pipeline `markdown-it → DOMPurify → Prism/Mermaid/KaTeX` | `app.js:598-627` | 🔴 | Alta — sustituido por invocación al compilador Typst (ver §7.2) |
| 20 | Componente de edición: `<textarea>` + numeración manual + toolbar de manipulación de string | `index.html:239`, `app.js:1901-2037` | 🔴 | Alta — sustituido por CodeMirror 6 (ver §7.1). **No hay nada que adaptar aquí**: no existe resaltado de sintaxis, autocompletado ni plegado en el editor actual. |
| 21 | Scroll-sync editor↔preview por anclas de heading | `app.js` (`fullScrollAnchors`/`interpolateScroll`) | 🔴 | Alta — Typst no tiene "headings HTML"; la sincronización real necesita mapeo de posición de fuente↔página vía `typst-ide`/SourceSpan |
| 22 | Sistema de plantillas | `templates/` (sin integración) | 🔴 | Alta — no hay código que reutilizar, solo el patrón organizativo del directorio |
| 23 | Resolución de imágenes relativas / `asset://` para Markdown | `app.js` (`resolveImages`) | 🔴 | Typst resuelve sus propios assets al compilar; este código no aplica |
| 24 | Ayuda de sintaxis Markdown (`markdownhelp_{es,en}.md`) | `src/*.md` | 🔴 | Contenido específico de Markdown, sustituir por chuleta de sintaxis Typst |

---

## 4. Dependencias que pueden mantenerse

| Dependencia | Capa | Motivo |
| --- | --- | --- |
| `tauri` 2.x + `tauri-plugin-{shell,dialog,updater,process,os,single-instance}` | Rust | Núcleo de la plataforma, sin alternativa mejor para el caso de uso |
| `serde` / `serde_json` | Rust | Estándar de facto para (de)serialización de config/recent-files |
| `notify` | Rust | Watcher de ficheros, ya validado en producción |
| `tempfile` | Rust (dev) | Fixtures de test aisladas |
| `@tauri-apps/api` + plugins JS homónimos | JS | Bindings oficiales, sin alternativa |
| `dompurify` | JS | Aunque el pipeline principal de sanitización de Markdown desaparece, sigue siendo buena práctica sanitizar cualquier string dinámico insertado como HTML en la UI (p. ej. mensajes de error del compilador con rutas de fichero) |

## 5. Dependencias que deberían sustituirse (o eliminarse)

| Dependencia actual | Motivo de sustitución/eliminación | Sustituto propuesto |
| --- | --- | --- |
| `markdown-it` + `markdown-it-footnote` + `markdown-it-task-lists` | No hay Markdown que parsear | *(eliminar)* — compilador Typst |
| `prismjs` (+20 gramáticas) | El resaltado de salida HTML no aplica; el resaltado ahora es del **código fuente Typst en el editor**, no de bloques de código en un HTML renderizado | Modo de lenguaje Typst para CodeMirror 6 (ver §7.1). Si se desea resaltar bloques `raw` embebidos dentro del propio Typst, evaluar en Beta, no en MVP |
| `mermaid` + `pako` (solo usado para el round-trip a mermaid.live) | Sin equivalente de uso — Typst tiene sus propios paquetes de diagramas (`cetz`) compilados nativamente | *(eliminar)* |
| `katex` | Typst tiene tipografía matemática **nativa** en el propio compilador — renderizar LaTeX en el DOM con KaTeX sería redundante y además inconsistente visualmente con el resto del documento compilado | *(eliminar)* |
| `ureq` (descarga de `.md` remotos vía HTTP) | Un proyecto Typst normalmente vive en disco local con dependencias (`.bib`, imágenes) también locales; "abrir un `.typ` remoto por URL" no es un caso de uso claro para este producto | *(eliminar del MVP; revalorar si surge demanda real)* |
| Uso de `<textarea>` como editor | No ofrece resaltado, autocompletado ni plegado — ver hallazgo crítico §1.3/§3#20 | **CodeMirror 6** (ver justificación en §7.1) |

---

## 6. Riesgos técnicos

| Riesgo | Severidad | Mitigación propuesta |
| --- | --- | --- |
| El backend Rust de DBV Markdown Reader es un monolito de ~1200 líneas en un solo `lib.rs`; el Typst Editor añade compilador embebido + gestión de proyecto + (en Beta) LSP, lo que puede triplicar ese tamaño. | Media | Modularizar desde el inicio en submódulos (`commands/`, `watcher.rs`, `typst_engine.rs`, `templates.rs`) en vez de replicar el patrón monolítico — ver propuesta de estructura §7.4. |
| Las crates del ecosistema Typst (`typst`, `typst-pdf`, `typst-svg`, `typst-ide`, `typst-kit`) tienen una API interna que cambia entre versiones menores (Typst evoluciona rápido) y no siempre está pensada para embeberse como librería en apps de terceros (a diferencia de la CLI, que es la superficie "pública" más estable). | Alta | Fijar versiones exactas (`=x.y.z`) en `Cargo.toml`, aislar toda la interacción con esas crates detrás de un módulo `typst_engine` con una interfaz propia y estable, para poder migrar de "crate embebida" a "CLI sidecar" sin tocar el resto de la app si la integración resulta demasiado inestable (ver decisión y plan B en §7.2). |
| CodeMirror 6 es una librería ES Modules-first — **incompatible** con el patrón "sin bundler, IIFE + scripts vendorizados" que usa hoy DBV Markdown Reader (documentado como obligatorio en `NATIVE_DESKTOP_APPS.md` §3 para evitar colisiones de scope global). | Media | Introducir un bundler ligero (Vite) **solo** para el frontend del Typst Editor — es un cambio de filosofía consciente y justificado (ver §7.1), no aplicable retroactivamente a DBV Markdown Reader. |
| Fuente de verdad de la vista previa: si se opta por renderizar SVG por página (recomendado, ver §7.3) en vez de un único PDF, hay que reconstruir desde cero la sincronización de scroll editor↔preview (el mecanismo actual de anclas de *heading* de Markdown no tiene equivalente directo en Typst). | Media | Usar `typst-ide` (crate oficial) para mapear posiciones de fuente (`SourceSpan`) a coordenadas de página/posición renderizada — es el mismo mecanismo que usa `tinymist`/tinymist-preview. Documentar como Decisión Técnica en `memory.md` cuando se implemente en `/build`. |
| Tamaño del instalador: sumar el compilador Typst embebido (crates `typst-kit` incluyen fuentes y el motor completo) puede superar el objetivo `<30MB` fijado en `SPECIFICATIONS.md`. | Media | Medir en un spike temprano de `/build` antes de comprometerse a esa cifra; si excede el umbral, considerar no embeber fuentes por defecto y usar las fuentes del sistema + descarga opcional de paquetes Typst bajo demanda (offline-first sigue cumpliéndose: no hay llamada de red *obligatoria*). |
| Ausencia total de tests JS (ni en el proyecto origen ni, hoy, en ningún proyecto `dbv-*`) choca con la necesidad de testear lógica no trivial de UI del editor (autocompletado, plegado, sincronización). | Baja-Media | Extender el patrón "funciones puras testeables" también al lado JS: extraer lógica de sincronización/estado a módulos puros y evaluar Vitest (ligero, compatible ESM, encaja con la introducción de Vite en §7.1) solo para esa capa, sin convertir todo el proyecto en una app de tests. |
| Licencias del ecosistema Typst: las crates oficiales (`typst`, `typst-pdf`, etc.) son Apache-2.0; hay que confirmar que todas las dependencias transitivas (incluidas fuentes tipográficas empaquetadas, si se embeben) tienen licencias compatibles con distribución en instaladores comerciales/gratuitos. | Baja | Auditoría de licencias como parte del gate de `/code-simplify` (ya previsto en `MASTER_PROMPT.md` §Seguridad) antes del primer `/ship`. |

---

## 7. Propuesta de migración / decisiones técnicas clave

### 7.1. Editor de código: CodeMirror 6 (recomendado) vs. Monaco Editor

| Criterio | Monaco Editor | CodeMirror 6 |
| --- | --- | --- |
| Tamaño (min+gzip) | ~2-5 MB (motor de VS Code completo) | ~200-400 KB core, modular por paquete |
| Modelo de distribución | AMD/UMD pesado, pensado para bundlers grandes | ESM nativo, tree-shakeable |
| Encaja con "ligero/offline-first" (filosofía DBV) | Contradice el objetivo de instalador ligero y arranque instantáneo que ya logra DBV Markdown Reader | Alineado — es la opción que prioriza tamaño y arranque en frío |
| Soporte de lenguaje Typst | No hay gramática Typst oficial mantenida activamente para Monaco a día de hoy | Existe un ecosistema de modos Typst para CodeMirror 6 en la comunidad, y es la base que usa el propio editor web oficial de Typst (app.typst.io), lo que da mayor probabilidad de mantenimiento y compatibilidad futura con el propio proyecto Typst |
| Integración LSP (`tinymist`, para Beta) | Buen soporte (Monaco nació para integrarse con el Language Server Protocol de VS Code) | También soportado (`codemirror-languageserver` y variantes), algo más de trabajo de integración manual |
| API / complejidad de adopción | API orientada a objetos, más "todo incluido" | API funcional basada en extensiones componibles (mayor curva inicial, pero más control fino) |

**Decisión:** **CodeMirror 6**. Justificación: (1) coherencia directa con la filosofía "ligero, offline-first, arranque instantáneo" que es la propuesta de valor central de toda la familia DBV — Monaco la comprometería severamente; (2) el propio ecosistema Typst gravita hacia CodeMirror 6 en su editor web oficial, lo que maximiza la probabilidad de encontrar/mantener un modo de lenguaje Typst de calidad a largo plazo; (3) el MVP no requiere LSP completo (ver `SPECIFICATIONS.md` §4, fuera de alcance en v0.1), por lo que la ventaja de integración LSP de Monaco no pesa en esta fase.

**Coste de esta decisión:** rompe el patrón "sin bundler" de DBV Markdown Reader (§ Riesgos). Se acepta conscientemente: se introduce **Vite** solo para el frontend del Typst Editor, manteniendo igualmente `withGlobalTauri: true` para los plugins Tauri que se sigan consumiendo vía `window.__TAURI__`, y evaluando en `/build` si conviene migrar el resto del frontend a ESM real o mantener híbrido (Vite para el editor, vendorizado para el resto).

### 7.2. Integración del compilador Typst

**Decisión:** embeber las crates Rust oficiales del propio Typst (`typst`, `typst-pdf`, `typst-svg`, `typst-ide`, `typst-kit`) directamente en el backend Tauri, **no** invocar un binario `typst` externo como sidecar/CLI.

Justificación:

- Coherente con la filosofía "single self-contained binary, cero dependencias externas en `PATH`" que ya sigue DBV Markdown Reader (todo el WebView2/runtime va embebido en el instalador).
- Evita problemas de versión desalineada entre el compilador del sistema (si el usuario tiene Typst CLI instalado por su cuenta) y el que espera la app.
- Permite compilar a bytes en memoria (SVG por página o PDF completo) sin pasar por el sistema de ficheros en cada recompilación — más rápido que invocar un proceso externo en cada pulsación tras el debounce.
- Da acceso directo a `typst-ide` para diagnósticos/autocompletado en Beta, sin tener que parsear la salida de texto de un proceso CLI.

**Plan B (documentar en `memory.md` si se activa):** si la superficie de API de las crates resulta demasiado inestable entre versiones (riesgo identificado en §6), aislar la integración detrás de un módulo `typst_engine` con una interfaz estable propia permite migrar a invocar el binario `typst` como sidecar de Tauri (`tauri-plugin-shell` ya está en el stack heredado) sin reescribir el resto de la aplicación.

### 7.3. Estrategia de vista previa en tiempo real

**Decisión:** renderizar cada página como **SVG** (vía `typst-svg`) para el panel de vista previa en vivo durante la edición, y reservar la generación de **PDF real** (vía `typst-pdf`) para el momento de guardado/exportación final.

Justificación: SVG es vectorial (nítido a cualquier zoom, coherente con la calidad tipográfica que es la propuesta de valor de Typst), permite actualizar página a página de forma incremental sin cargar un visor PDF.js completo, y reutiliza casi literalmente el mecanismo de watch→debounce→re-render de §1.4 (solo cambia qué se re-renderiza). El PDF real generado con `typst-pdf` sigue siendo, como es lógico, el artefacto que el usuario exporta/imprime — coincide con la petición explícita del usuario de "vista previa PDF en tiempo real" en el sentido de "documento con fidelidad PDF", aunque el pipeline interno de refresco use SVG por eficiencia.

### 7.4. Estructura de directorios propuesta

```text
/
├── src/                      # Frontend (Vite + CodeMirror 6 para el editor;
│   ├── editor/                #   resto de UI puede seguir el patrón IIFE heredado)
│   ├── preview/                # Panel de vista previa SVG + zoom/paginación
│   ├── panels/                 # registerPanel() heredado: Settings, About, Quick Open...
│   ├── filetree/                # Heredado casi literal de dbv-md-reader/src/filetree.js
│   ├── i18n/                    # Heredado del patrón de dbv-md-reader/src/i18n.js
│   ├── themes/                  # CSS custom properties heredadas + paleta de marca propia
│   └── vendor/                  # Solo lo que NO pase por Vite (si se opta por híbrido)
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs               # Orquestación: registro de plugins/comandos, run()
│   │   ├── commands/            # Módulos por dominio (file_io.rs, recent_files.rs, project.rs...)
│   │   ├── watcher.rs            # Heredado de lib.rs:457-503
│   │   └── typst_engine/         # NUEVO — compilación, SVG/PDF, IDE/diagnósticos
│   └── tauri.conf.json + overlays por plataforma (heredado de dbv-md-reader)
├── templates/                 # Plantillas .typ (es/en) — patrón organizativo heredado
│   ├── es/{articulo,tfg,tfm,tesis,informe,cv,presentacion}.typ
│   └── en/{...}
├── dbv-specs-ops/              # Documentación SDD (este directorio)
├── start.cmd / start.sh        # Heredado sin cambios
└── stop.cmd / stop.sh           # Heredado sin cambios
```

---

## 8. Estimación de complejidad por bloque de trabajo

| Bloque | Complejidad | Motivo |
| --- | --- | --- |
| Portar infraestructura Rust reutilizable (§3, filas 1-10) | 🟢 Baja | Copiar y renombrar, tests ya existentes como red de seguridad |
| Adaptar theming/paneles/i18n/layout (§3, filas 11-18) | 🟢 Baja-Media | Mecanismo probado, solo cambia contenido |
| Integrar CodeMirror 6 + modo Typst + Vite | 🟠 Media-Alta | Primera introducción de bundler en la familia DBV; requiere validar convivencia con `withGlobalTauri` |
| Integrar crates Typst (compilación embebida SVG/PDF) | 🔴 Alta | Superficie de API nueva y potencialmente inestable (riesgo §6); es el corazón técnico del producto |
| Sincronización editor↔preview por posición real (`typst-ide`) | 🔴 Alta | Sin precedente reutilizable en DBV Markdown Reader; se pospone a Beta según `SPECIFICATIONS.md` |
| Sistema de plantillas (picker + scaffolding + 7 plantillas .typ) | 🟠 Media | Sin código previo que reutilizar, pero sin incertidumbre técnica (es "trabajo nuevo conocido", no riesgo) |
| Empaquetado Windows/Linux (CI, NSIS, AppImage/deb) | 🟢 Baja | Config casi copiable de dbv-md-reader, cambiar identidad/branding |
| Auto-actualizador | 🟢 Baja | Reutilizable sin cambios funcionales |

---

## 🔑 Decisiones Técnicas Clave (resumen)

### Seguridad

- **Sin red en el flujo de compilación/edición** — 100% offline (ver `SPECIFICATIONS.md` §5).
- **Datos sensibles:** ninguno específico del dominio (no hay auth ni credenciales); se mantiene el principio de menor privilegio ya aplicado en `capabilities/main.json` de DBV Markdown Reader.

### Estilo de Código

- Mismas convenciones que el resto de proyectos `dbv-*` (ver `<coding_standards>` de `MASTER_PROMPT.md`): un solo `return` + guard clauses, patrón `Result`, tipado estricto (Rust ya lo impone; en TS/JS del nuevo frontend con Vite, activar `strict` en `tsconfig.json` si se adopta TypeScript para el editor — recomendado dado que CodeMirror 6 está escrito en TypeScript).

### Gestión de Estado

- Backend: mismo patrón `.manage()` de Tauri con structs `Mutex<...>` ya usado (Watcher, documentos abiertos); añadir `TypstEngineState` para cachear el `World`/compilación incremental de Typst entre recompilaciones.
- Frontend: mantener el patrón `window.DBV*` para los módulos heredados; el editor CodeMirror 6 gestiona su propio estado interno (`EditorState`/`EditorView`) expuesto mínimamente al resto de la app.

---

## ⚠️ Restricciones y Riesgos Técnicos

Ver tabla completa en §6. Restricción transversal: cualquier desviación de las decisiones de §7 tomada durante `/build` debe registrarse en `dbv-specs-ops/memory.md` bajo `## 🏗️ Log de Decisiones Técnicas`, tal como exige `MASTER_PROMPT.md`.

---

## 🤖 Agent Harness (Arnés del Agente)

- **Contexto Estático:** `CLAUDE.md`/`GEMINI.md`/`.windsurfrules`/`.github/copilot-instructions.md` (raíz) + `dbv-specs-ops/project.config.md` + este fichero + `memory.md`.
- **Contexto Dinámico / Skills:** No aplica todavía (sin Agent Plugin definido; revalorar en `/spec` si se detecta valor en un MCP local para consultar la sintaxis Typst durante el desarrollo).
- **Servidores MCP:** Ninguno requerido para el MVP.
- **Sandboxing:** Desarrollo local estándar (sin contenedor obligatorio); compilación Rust nativa por plataforma.
- **Guardrails:** Herencia directa de los ya usados en `dbv-md-reader` (sin secretos en código, auditoría de dependencias en `/code-simplify`).
- **Agent Readiness (Web):** No aplica — proyecto de escritorio, no web/API (ver `project.config.md`).

---

**Instrucción para la IA:** Este documento fija las decisiones de §7 (editor CodeMirror 6, compilador Typst embebido vía crates, preview SVG+PDF) como la línea base para `/plan` y `/build`. Cualquier cambio debe registrarse como Decisión Técnica en `memory.md` antes de implementarse.
