// =============================================================================
// DBV Typst Editor — Capa de acceso al backend Rust
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Único punto del frontend que llama a `invoke`. Dos motivos:
//   · Convierte la excepción del puente Tauri en el `Result` discriminado que
//     exigen los estándares de codificación (MASTER_PROMPT §coding_standards),
//     para que ningún módulo de UI tenga que envolver llamadas en try/catch.
//   · Concentra los nombres de comando: renombrar uno en Rust se propaga aquí
//     y en ningún otro sitio.

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * @template T
 * @typedef {{ok: true, value: T} | {ok: false, error: {kind: string, message: string}}} Result
 */

/**
 * Normaliza cualquier fallo del puente al error tipado `{kind, message}`.
 *
 * El backend devuelve `AppError`/`TypstError` ya con esa forma; un fallo del
 * propio puente (comando inexistente, argumentos mal nombrados) llega como
 * cadena, y se etiqueta como `bridge` para que sea distinguible de un error de
 * negocio en los mensajes de la interfaz.
 */
function normalizeError(raw) {
  if (raw && typeof raw === 'object' && typeof raw.kind === 'string') {
    return { kind: raw.kind, message: String(raw.message ?? raw.kind) };
  }
  return { kind: 'bridge', message: String(raw?.message ?? raw) };
}

/**
 * Invoca un comando Rust y devuelve siempre un `Result`, nunca una excepción.
 * @template T
 * @param {string} command
 * @param {Record<string, unknown>} [args]
 * @returns {Promise<Result<T>>}
 */
export async function call(command, args = {}) {
  let result;
  try {
    result = { ok: true, value: await invoke(command, args) };
  } catch (error) {
    result = { ok: false, error: normalizeError(error) };
  }
  return result;
}

/** Suscribe a un evento emitido por el backend. @returns {Promise<() => void>} */
export function on(eventName, handler) {
  return listen(eventName, (event) => handler(event.payload));
}

// ─── Información de la aplicación y del compilador ──────────────────────────

export const getAppInfo = () => call('app_info');
export const getTypstVersion = () => call('typst_version');
/** Beta, panel "Acerca de": ¿viene de Microsoft Store? Ver `commands/app_info.rs`. */
export const isPackagedApp = () => call('is_packaged_app');
/** Beta, §7.6.3: crea un proyecto desde una plantilla de Typst Universe. */
export const createProjectFromUniverse = ({ spec, parentDir, projectName }) =>
  call('create_project_from_universe', { spec, parentDir, projectName });
/**
 * RF-26.6: descarga y compila una plantilla de Universe en un temporal para
 * enseñar su maquetación real, sin crear proyecto ni dejar nada en disco. Es el
 * único punto de la pestaña "Dirección" que toca la red, y solo se llama desde
 * un control que declara que va a hacerlo.
 */
export const previewUniverseTemplate = (spec) => call("preview_universe_template", { spec });
/** Abre la ficha de un paquete/plantilla en typst.app/universe, sin instalarlo. */
export const openUniversePackagePage = (spec) => call('open_universe_package_page', { spec });
/** Abre `url` con el navegador del sistema — enlaces de documentación externa del panel de Ayuda (RF-52.1). */
export const openExternalUrl = (url) => call('open_external_url', { url });
/**
 * RF-34: índice completo de Typst Universe (~4.700 paquetes), cacheado en el
 * backend tras la primera descarga de la sesión — no en vivo en cada apertura
 * del panel, coherente con `SPECIFICATIONS.md` §9.
 */
export const fetchUniverseIndex = () => call('fetch_universe_index');
/** Documento con el que el SO ha arrancado la app (asociación de fichero `.typ`). */
export const getStartupDocument = () => call('startup_document');

// ─── Ficheros ────────────────────────────────────────────────────────────────

export const readFile = (path) => call('read_file', { path });
/** `reason` (`save`, `auto`…) acompaña a la copia que guarda el historial local (RF-73). */
export const writeFile = (path, content, reason = 'save') => call('write_file', { path, content, reason });
export const fileModifiedMs = (path) => call('file_modified_ms', { path });
/** Huella actual en disco (RF-68): `{ missing, modifiedMs, contentHash }`. */
export const fileFingerprint = (path) => call('file_fingerprint', { path });

// Operaciones de ficheros del panel Archivos (RF-69). `root` es la raíz del
// proyecto: el backend rechaza cualquier ruta que quede fuera de ella.
export const fsCreateFile = (root, dir, name) => call('fs_create_file', { root, dir, name });
export const fsCreateDir = (root, dir, name) => call('fs_create_dir', { root, dir, name });
/** Devuelve `{ from, to }`. */
export const fsRename = (root, path, newName) => call('fs_rename', { root, path, newName });
/** Devuelve `[{ from, to }]` (lo que ya estaba en destino se omite). */
export const fsMove = (root, paths, destDir) => call('fs_move', { root, paths, destDir });
export const fsDuplicate = (root, path) => call('fs_duplicate', { root, path });
export const fsCopyInto = (root, sources, destDir) => call('fs_copy_into', { root, sources, destDir });
/** Error `trashUnavailable` si la papelera no está disponible para esas rutas. */
export const fsTrash = (root, paths) => call('fs_trash', { root, paths });
export const fsDeletePermanently = (root, paths) => call('fs_delete_permanently', { root, paths });
/** Deshace movimientos (`to → from`, en orden inverso); todo o nada. */
export const fsRevertMoves = (root, moved) => call('fs_revert_moves', { root, moved });

// Referencias a lo movido (RF-70). `openDocument` es `{ path, content }` del
// documento abierto: se edita en memoria y sus ediciones vuelven en UTF-16.
/**
 * Busca en todo el proyecto (RF-78). `openDocuments` son las pestañas con su
 * contenido del editor; con `replacement`, cada coincidencia trae su texto de
 * reemplazo expandido (`$1`). Una búsqueda con `searchId` mayor cancela esta.
 * @returns {Promise<Result<{files: Array<{path: string, relative: string, matches: any[]}>, total: number, truncated: boolean, cancelled: boolean}>>}
 */
export const searchProject = (root, query, options, { replacement = null, openDocuments = [], searchId = 0 } = {}) =>
  call('search_project_cmd', { root, query, options, replacement, openDocuments, searchId });

// Snippets de usuario (RF-81): el fichero global y los `.vscode/*.code-snippets`.
export const snippetsGlobalPath = () => call('snippets_global_path');
export const snippetsEnsureGlobal = () => call('snippets_ensure_global');
export const snippetsProjectFiles = (root) => call('snippets_project_files', { root });
export const snippetsEnsureProject = (root) => call('snippets_ensure_project', { root });

/** RF-70 con pestañas (R-T3): `openDocuments` son TODAS las pestañas con su contenido del editor. */
export const refsPlan = (root, moved, openDocuments) => call('refs_plan', { root, moved, openDocuments: openDocuments ?? [] });
export const refsApply = (root, moved, openDocuments) => call('refs_apply', { root, moved, openDocuments: openDocuments ?? [] });

// Historial local de versiones (RF-73).
export const historyConfigure = (root, enabled) => call('history_configure', { root, enabled });
export const historySnapshot = (path, content, reason) => call('history_snapshot', { path, content, reason });
export const historyList = (path) => call('history_list', { path });
export const historyRead = (path, id) => call('history_read', { path, id });
export const historyClear = () => call('history_clear');

// «Nuevo capítulo…» (RF-71).
export const chapterFolder = (root, mainPath, mainContent) => call('chapter_folder', { root, mainPath, mainContent });
export const chapterCreate = (root, folder, fileName, title) => call('chapter_create', { root, folder, fileName, title });
/** `openContent`: contenido del principal si está abierto (vuelve la edición), o `null` (se escribe en disco). */
export const chapterLink = (root, mainPath, openContent, chapterPath) =>
  call('chapter_link', { root, mainPath, openContent, chapterPath });
export const listDirectory = (path) => call('list_directory', { path });
export const revealInFileManager = (path) => call('reveal_in_file_manager', { path });

// ─── Diálogos nativos ────────────────────────────────────────────────────────

/** `directory`: carpeta inicial del diálogo (se ignora si ya no existe, RF-106.3). */
export const pickTypstFile = (directory = null) => call('open_file_dialog', { directory });
export const pickProjectFolder = () => call('open_folder_dialog');
export const pickSaveTarget = (defaultName, filterName, extensions, directory = null) =>
  call('save_file_dialog', { defaultName, filterName, extensions, directory });
/** Crea un `.typ` vacío y suelto (RF-106); devuelve la ruta final. No pisa contenido. */
export const createEmptyDocument = (path) => call('create_empty_document', { path });
export const pickArchiveFile = () => call('pick_archive_dialog');

// ─── Proyecto ────────────────────────────────────────────────────────────────

export const openProject = (path) => call('open_project', { path });
export const readProjectManifest = (root) => call('read_project_manifest', { root });
/** RF-83: escribe el documento principal en `settings/dbv-project.toml` (lo crea si falta). */
export const setProjectEntrypoint = (root, entrypoint) => call('set_project_entrypoint', { root, entrypoint });
/** RF-83.5: quita el principal del manifiesto (sin manifiesto no hace nada). */
export const clearProjectEntrypoint = (root) => call('clear_project_entrypoint', { root });

// ─── Project Archive .dbvt (RF-11, v0.2) ─────────────────────────────────────

export const exportProjectArchive = (projectDir, outputPath) =>
  call('export_project_archive', { projectDir, outputPath });
export const importProjectArchive = (archivePath, targetDir) =>
  call('import_project_archive', { archivePath, targetDir });

// ─── Plantillas y creación de proyecto ───────────────────────────────────────

export const listTemplates = () => call('list_templates');
export const createProject = ({ templateName, templateVersion, parentDir, projectName, fields }) =>
  call('create_project', { templateName, templateVersion, parentDir, projectName, fields });

// ─── Proyectos recientes ─────────────────────────────────────────────────────

export const getRecentProjects = () => call('get_recent_projects');
/**
 * Registra una apertura. `path` es lo que habrá que reabrir: la carpeta del
 * proyecto, o el fichero en el caso de un `.typ` suelto — quien llama lo
 * calcula, porque componer rutas es asunto suyo y no de esta capa.
 */
export const addRecentProject = ({ path, name, entrypoint, isSingleFile }) =>
  call('add_recent_project', {
    path,
    name,
    entrypoint: entrypoint ?? null,
    isSingleFile: Boolean(isSingleFile),
  });
export const clearRecentProjects = () => call('clear_recent_projects');
export const removeRecentProject = (path) => call('remove_recent_project', { path });

// ─── Compilación (vista previa y exportación) ────────────────────────────────

/**
 * Objetivo de compilación (RF-14): qué documento se compila, sobre qué raíz, y
 * qué fichero tiene cambios sin guardar. Lo construye el workspace una sola vez
 * y lo comparten la vista previa, el outline y las exportaciones — si cada uno
 * decidiera por su cuenta, el usuario exportaría algo distinto de lo que ve.
 * @typedef {object} CompileTarget
 * @property {string} document Documento objetivo: el entrypoint, o el fichero
 *   abierto si el alcance es "solo este fichero".
 * @property {string} root Raíz del proyecto.
 * @property {boolean} singleFile El proyecto es un `.typ` suelto (RF-02b).
 * @property {string|null} dirtyPath Fichero con cambios sin guardar, si lo hay.
 * @property {string|null} dirtyContent Su contenido en el editor.
 * @property {Array<{path: string, content: string}>} [otherDirty] Pestañas de
 *   fondo con cambios sin guardar (RF-79); solo las usa el motor en proceso.
 */

export const compilePreview = ({ target, firstPage, windowSize }) =>
  call('typst_compile_preview', {
    target,
    firstPage: firstPage ?? 0,
    windowSize: windowSize ?? 2,
  });
export const previewPage = (generation, index) =>
  call('typst_preview_page', { generation, index });
export const cancelPreview = () => call('typst_cancel_preview');
export const getOutline = (target) => call('typst_outline', { target });
/** Tabla de anclas para la sincronización editor↔vista previa (RF-16). */
export const getSyncAnchors = (target) => call('typst_sync_anchors', { target });
export const getBibliographyKeys = (root) => call('bibliography_keys', { root });

// ─── Motor de vista previa en proceso (v0.9.0, RF-56/57/59) ───────────────────

/**
 * Qué se escribió en el punto (`xPt`, `yPt`) de la página `page` (1-indexada) de la
 * vista previa de `generation`. Devuelve `null` si ahí no hay nada con origen en
 * el fuente, y un error `PreviewExpired` si esa generación ya no es la vigente.
 * @returns {Promise<import('./backend.js').Result<null | EngineLocated>>}
 */
/** Enlaces de una página de la vista previa (RF-72). */
export const engineLinks = (generation, page) => call('engine_links', { generation, page });
/** RF-82.1: busca en el texto de TODAS las páginas de la vista previa `generation`. */
export const engineSearch = (generation, query, caseSensitive = false) => call('engine_search', { generation, query, caseSensitive });
/** RF-82.2: texto de una página y la caja (pt) de cada carácter, para seleccionar y copiar. */
export const enginePageText = (generation, page) => call('engine_page_text', { generation, page });
/** Abre un enlace del documento; el backend decide qué esquemas se permiten. */
export const openDocumentLink = (url) => call('open_document_link', { url });
export const engineLocate = (generation, page, xPt, yPt) =>
  call('engine_locate', { generation, page, xPt, yPt });
/** Cajas (una por línea dibujada) de lo escrito entre `from` y `to` (UTF-16) de `file`. */
export const engineReveal = (generation, file, from, to) =>
  call('engine_reveal', { generation, file, from, to });
/** Errores y avisos de la última compilación, con fichero y rango exactos (RF-59). */
export const engineDiagnostics = () => call('engine_diagnostics');
/** Elige el motor de la vista previa: `'inproc'` o `'classic'`. */
export const engineSetMode = (mode) => call('engine_set_mode', { mode });
export const engineStatus = () => call('engine_status');

/** RF-35: bibliografía completa con campos y validación básica (duplicados, campos ausentes). */
export const getBibliographyEntries = (root) => call('bibliography_entries', { root });

// ─── Gestión de imágenes por arrastre (Beta, §7.10) ──────────────────────────

export const copyAssetIntoProject = (projectRoot, sourcePath) =>
  call('copy_asset_into_project', { projectRoot, sourcePath });
export const pickImageFile = () => call('pick_image_dialog');
/** Imagen pegada desde el portapapeles (RF-39): llega en bytes, no como ruta. */
export const savePastedImage = (projectRoot, base64Data, extension) =>
  call('save_pasted_image', { projectRoot, base64Data, extension });
/** Arrastrar una fuente al proyecto (Beta, §7.10): copia a `fonts/`. */
export const copyFontIntoProject = (projectRoot, sourcePath) =>
  call('copy_font_into_project', { projectRoot, sourcePath });
/** Imágenes que ya tiene el proyecto, para el desplegable del botón "Fig" (RF-17). */
export const getProjectImages = (root) => call('project_images', { root });
/** Extensiones de imagen y fuente que acepta la app: única fuente de verdad en Rust (RF-18). */
export const getSupportedAssetExtensions = () => call('supported_asset_extensions');

// ─── Terminal avanzado (Beta, §7.14) ──────────────────────────────────────────

/** `args` ya viene troceado — el frontend separa por espacios, sin más. */
export const runTypstCommand = (args, root) => call('typst_run_raw', { args, root: root ?? null });
export const exportPdf = ({ target, output }) => call('typst_export_pdf', { target, output });
export const exportPng = ({ target, output, page }) =>
  call('typst_export_png', { target, output, page });

// ─── Observador de cambios ───────────────────────────────────────────────────

/** Nombre del evento emitido por `watcher.rs` en cada cambio relevante. */
export const PROJECT_CHANGE_EVENT = 'project-file-changed';

/** R-T4: el observador marca `isOpenDocument` en los avisos de CUALQUIER pestaña abierta. */
export const watchProject = (root, openDocuments) =>
  call('watch_project', { root, openDocuments: openDocuments ?? [] });
export const unwatchProject = () => call('unwatch_project');

// ─── Runner de scripts Python (RF-22) ────────────────────────────────────────

export const executePythonScript = ({ projectPath, code, timeoutSeconds }) =>
  call('execute_python_script', {
    projectPath,
    code,
    timeoutSeconds: timeoutSeconds ?? null,
  });
export const checkPythonStatus = (projectRoot) =>
  call('check_python_status', { projectRoot: projectRoot ?? null });
export const setupSharedPythonEnv = () => call('setup_shared_python_env');

// ─── Control de versiones Git (RF-19) ────────────────────────────────────────

export const gitStatus = (projectPath) => call('git_status', { projectPath });
export const gitAdd = ({ projectPath, relativePath }) =>
  call('git_add', { projectPath, relativePath });
export const gitCommit = ({ projectPath, message }) =>
  call('git_commit', { projectPath, message });
export const gitPush = (projectPath) => call('git_push', { projectPath });
export const gitPull = (projectPath) => call('git_pull', { projectPath });
export const gitClone = ({ url, parentDir }) => call('git_clone', { url, parentDir });

// ─── Language Server Tinymist (RF-21) ────────────────────────────────────────

export const tinymistStart = (rootPath) => call('tinymist_start', { rootPath: rootPath ?? null });
export const tinymistStop = () => call('tinymist_stop');
export const tinymistSendRequest = (method, params) =>
  call('tinymist_send_request', { method, params });
export const tinymistSendNotification = (method, params) =>
  call('tinymist_send_notification', { method, params });
export const tinymistStatus = () => call('tinymist_status');

// ─── Editor visual de ecuaciones (RF-46) ─────────────────────────────────────

/**
 * Compila `math` (cuerpo Typst sin los `$` envolventes) a una "viñeta" SVG
 * recortada al contenido, para la vista previa en vivo del editor de
 * ecuaciones. `root`, si se pasa, permite resolver las fuentes propias del
 * proyecto abierto (`fonts/`) igual que la vista previa principal.
 */
export const compileEquation = (math, { root, fontSizePt, preamble } = {}) =>
  call('typst_compile_equation', {
    math,
    root: root ?? null,
    fontSizePt: fontSizePt ?? null,
    preamble: preamble ?? null,
  });

// ─── Asistente de DOT/Graphviz (RF-51) ───────────────────────────────────────

/**
 * Compila `dot` (texto DOT crudo, sin escapar) a una "viñeta" SVG recortada
 * al contenido, para la vista previa en vivo del asistente de DOT/Graphviz.
 * Mismo patrón que `compileEquation`; `root` permite resolver las fuentes
 * propias del proyecto abierto igual que el resto de vistas previas.
 */
export const compileDot = (dot, { root } = {}) =>
  call('typst_compile_dot', { dot, root: root ?? null });




// ─── Documentación de Typst offline (RF-96) ──────────────────────────────────

/** Versión de Typst de la documentación empaquetada y número de páginas. */
export const docsInfo = () => call('docs_info');
/** Secciones más relevantes para `query` (glosario español → inglés incluido). */
export const docsSearch = (query, limit) => call('docs_search', { query, limit: limit ?? null });
/** Página completa en Markdown (`reference/model/table`). */
export const docsPage = (path) => call('docs_page', { path });
/** Vuelca la documentación a la carpeta de datos (para los agentes ACP) y devuelve su ruta. */
export const docsExportDir = () => call('docs_export_dir');

// ─── Visor de datos CSV/TSV (RF-98) ──────────────────────────────────────────

/** Selector nativo de un `.csv`/`.tsv`. */
export const pickDataFile = () => call('pick_data_file_dialog');

// ─── IA integrada (RF-90 a RF-95) ────────────────────────────────────────────
// Ningún comando devuelve una clave de API: la clave solo viaja de ida, al
// guardar una conexión, y vive en el almacén de credenciales del sistema.

export const aiConnections = () => call('ai_connections');
/** `apiKey`: `null` no la toca, `''` la borra, otro valor la guarda en el almacén del sistema. */
export const aiSaveConnection = (connection, apiKey, activate = false) =>
  call('ai_save_connection', { request: { connection, apiKey: apiKey ?? null, activate } });
export const aiDeleteConnection = (id) => call('ai_delete_connection', { id });
export const aiSetPreferences = ({ active, showAi } = {}) =>
  call('ai_set_preferences', { active: active ?? null, showAi: showAi ?? null });
export const aiProviders = () => call('ai_providers');
export const aiDetect = () => call('ai_detect');
export const aiListModels = (connection, apiKey) => call('ai_list_models', { connection, apiKey: apiKey ?? null });
/** Tamaño, contexto máximo y capacidades del modelo (solo Ollama; `null` en el resto), RF-101 y RF-103. */
export const aiModelInfo = (connection) => call('ai_model_info', { connection });
/** Lanza una petición; la respuesta llega por el evento `ai-stream` con este `requestId`. */
export const aiChat = (requestId, connectionId, request) => call('ai_chat', { requestId, connectionId, request });
export const aiCancel = (requestId) => call('ai_cancel', { requestId });
/** Errores y avisos que tendría el proyecto con `files` (`{path, content}`) en memoria. */
export const aiCheckProposal = (root, main, files) => call('ai_check_proposal', { root, main, files });
export const aiProjectStateLoad = (root) => call('ai_project_state_load', { root });
export const aiProjectStateSave = (root, value) => call('ai_project_state_save', { root, value });
export const aiRelease = () => call('ai_release');
/** Busca en el catálogo de Typst Universe YA descargado (nunca abre una conexión, RNF-IA.9.3). */
export const aiUniverseSearch = (query, kind = 'any', limit = 8) => call('ai_universe_search', { query, kind, limit });
/** Descarga el índice público de Universe; solo con una conexión en la nube. */
export const aiUniverseRefresh = () => call('ai_universe_refresh');
/** Comprueba identificadores `@preview/nombre:versión` contra el catálogo descargado. */
export const aiUniverseCheck = (ids) => call('ai_universe_check', { ids });
/** README, manifiesto y plantilla de un paquete. `allowDownload` solo con una conexión en la nube (RNF-IA.9.3). */
export const aiUniversePackageDocs = (id, allowDownload) => call('ai_universe_package_docs', { id, allowDownload });
/** ¿Cuáles de estos paquetes ya están en la caché del compilador? → `[[id, instalado]]`. */
export const aiUniverseInstalled = (ids) => call('ai_universe_installed', { ids });
/** Instala un paquete en la caché del compilador. SOLO tras la confirmación del usuario (RNF-IA.9.4). */
export const aiUniverseInstall = (id) => call('ai_universe_install', { id });

// ─── Agentes por ACP (RF-91) ─────────────────────────────────────────────────
// Transporte: Rust lanza el agente y reenvía sus mensajes como `acp-message`.

export const acpStart = (spec, cwd) => call('acp_start', { spec, cwd });
export const acpRequest = (method, params) => call('acp_request', { method, params });
export const acpNotify = (method, params) => call('acp_notify', { method, params });
export const acpRespond = (id, result, error) => call('acp_respond', { id, result: result ?? null, error: error ?? null });
export const acpStop = () => call('acp_stop');
export const acpRunning = () => call('acp_running');
/** Punto de restauración de los ficheros de texto del proyecto (antes de cada turno). */
export const acpSnapshot = (root) => call('acp_snapshot', { root });
/** Ficheros que cambiaron en disco desde el punto de restauración. */
export const acpChanges = () => call('acp_changes');
