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
/** Abre la ficha de un paquete/plantilla en typst.app/universe, sin instalarlo. */
export const openUniversePackagePage = (spec) => call('open_universe_package_page', { spec });
/** Documento con el que el SO ha arrancado la app (asociación de fichero `.typ`). */
export const getStartupDocument = () => call('startup_document');

// ─── Ficheros ────────────────────────────────────────────────────────────────

export const readFile = (path) => call('read_file', { path });
export const writeFile = (path, content) => call('write_file', { path, content });
export const fileModifiedMs = (path) => call('file_modified_ms', { path });
export const listDirectory = (path) => call('list_directory', { path });
export const revealInFileManager = (path) => call('reveal_in_file_manager', { path });

// ─── Diálogos nativos ────────────────────────────────────────────────────────

export const pickTypstFile = () => call('open_file_dialog');
export const pickProjectFolder = () => call('open_folder_dialog');
export const pickSaveTarget = (defaultName, filterName, extensions) =>
  call('save_file_dialog', { defaultName, filterName, extensions });
export const pickArchiveFile = () => call('pick_archive_dialog');

// ─── Proyecto ────────────────────────────────────────────────────────────────

export const openProject = (path) => call('open_project', { path });
export const readProjectManifest = (root) => call('read_project_manifest', { root });

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

// ─── Compilación (vista previa y exportación) ────────────────────────────────

export const compilePreview = ({ document, root, content, firstPage, windowSize }) =>
  call('typst_compile_preview', {
    document,
    root,
    content: content ?? null,
    firstPage: firstPage ?? 0,
    windowSize: windowSize ?? 2,
  });
export const previewPage = (generation, index) =>
  call('typst_preview_page', { generation, index });
export const cancelPreview = () => call('typst_cancel_preview');
export const getOutline = ({ document, root, content }) =>
  call('typst_outline', { document, root, content: content ?? null });
export const getBibliographyKeys = (root) => call('bibliography_keys', { root });

// ─── Gestión de imágenes por arrastre (Beta, §7.10) ──────────────────────────

export const copyAssetIntoProject = (projectRoot, sourcePath) =>
  call('copy_asset_into_project', { projectRoot, sourcePath });
export const pickImageFile = () => call('pick_image_dialog');
/** Arrastrar una fuente al proyecto (Beta, §7.10): copia a `fonts/`. */
export const copyFontIntoProject = (projectRoot, sourcePath) =>
  call('copy_font_into_project', { projectRoot, sourcePath });

// ─── Terminal avanzado (Beta, §7.14) ──────────────────────────────────────────

/** `args` ya viene troceado — el frontend separa por espacios, sin más. */
export const runTypstCommand = (args) => call('typst_run_raw', { args });
export const exportPdf = ({ document, root, output, content }) =>
  call('typst_export_pdf', { document, root, output, content: content ?? null });
export const exportPng = ({ document, root, output, page, content }) =>
  call('typst_export_png', { document, root, output, page, content: content ?? null });

// ─── Observador de cambios ───────────────────────────────────────────────────

/** Nombre del evento emitido por `watcher.rs` en cada cambio relevante. */
export const PROJECT_CHANGE_EVENT = 'project-file-changed';

export const watchProject = (root, activeDocument) =>
  call('watch_project', { root, activeDocument: activeDocument ?? null });
export const unwatchProject = () => call('unwatch_project');
