// =============================================================================
// DBV Typst Editor — Edición en varios ficheros (RF-77.4, RF-78.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Una sola maquinaria para aplicar cambios a muchos ficheros a la vez:
// renombrar un símbolo con Tinymist (RF-77) y reemplazar en todo el proyecto
// (RF-78). Las reglas son las de RF-70 (R-E1):
//   · las pestañas abiertas se editan en el editor (con sus cambios sin
//     guardar), nunca en su disco; los ficheros cerrados se escriben de forma
//     atómica y dejan copia en el historial local (RF-73);
//   · se valida TODO antes de escribir nada: cada fichero cerrado se lee y,
//     justo antes de escribir, se comprueba que su huella no ha cambiado;
//   · se lleva un diario de lo hecho: si algo falla a medias se informa, y
//     Deshacer es todo o nada (comprueba que nada cambió desde entonces).
//
// Las posiciones son las de LSP: línea y columna en unidades UTF-16. Las
// cadenas de JavaScript también lo son, así que aquí no hay conversión que
// pueda romper los acentos o los emoji.

import { t } from '../i18n/i18n.js';
import { uriToPath } from '../editor/lspClient.js';
import { isSafeRelativePath } from './entrypoint.js';
import { pathKey, relativeToRoot } from './paths.js';

/** Cuántas líneas de cambios se enseñan antes de resumir. */
const PREVIEW_LIMIT = 40;

/**
 * Posición absoluta (UTF-16) de una posición LSP en `text`, o -1 si no existe.
 * @param {string} text
 * @param {{line: number, character: number}} position
 * @returns {number}
 */
export function offsetAt(text, position) {
  let offset = 0;
  let line = 0;
  while (line < position.line && offset !== -1) {
    const next = text.indexOf('\n', offset);
    offset = next === -1 ? -1 : next + 1;
    line += 1;
  }
  let result = -1;
  if (offset !== -1) {
    const lineEnd = text.indexOf('\n', offset);
    const end = lineEnd === -1 ? text.length : lineEnd;
    const target = offset + position.character;
    result = target <= end ? target : -1;
  }
  return result;
}

/**
 * Ediciones LSP → ediciones por posición, ordenadas y sin solapes. `null` si
 * alguna no encaja en el texto (el fichero cambió) o dos se solapan.
 * @param {string} text
 * @param {Array<{range: {start: {line: number, character: number}, end: {line: number, character: number}}, newText: string}>} edits
 * @returns {Array<{from: number, to: number, insert: string}> | null}
 */
export function toOffsetEdits(text, edits) {
  const converted = edits.map((edit) => ({
    from: offsetAt(text, edit.range.start),
    to: offsetAt(text, edit.range.end),
    insert: edit.newText,
  }));
  converted.sort((a, b) => a.from - b.from || a.to - b.to);
  const valid = converted.every((edit, index) => {
    const previous = converted[index - 1];
    return edit.from >= 0 && edit.to >= edit.from && (!previous || previous.to <= edit.from);
  });
  return valid ? converted : null;
}

/**
 * Aplica ediciones por posición (ordenadas y sin solapes) a un texto.
 * @param {string} text
 * @param {Array<{from: number, to: number, insert: string}>} edits
 * @returns {string}
 */
export function applyOffsetEdits(text, edits) {
  let result = text;
  for (const edit of [...edits].sort((a, b) => b.from - a.from)) {
    result = result.slice(0, edit.from) + edit.insert + result.slice(edit.to);
  }
  return result;
}

/**
 * Normaliza un `WorkspaceEdit` de LSP (`changes` o `documentChanges`) a una
 * lista de ficheros con sus ediciones. Las operaciones de fichero (crear,
 * renombrar, borrar) no se aplican aquí: se devuelven aparte, porque renombrar
 * un fichero se hace con RF-69/RF-70 para actualizar TODAS sus referencias
 * (R-L4). `needsConfirmation` avisa de un cambio aproximado (R-L3).
 * @param {any} workspaceEdit
 * @returns {{files: Array<{path: string, edits: any[]}>, fileOperations: Array<{kind: string, oldPath?: string, newPath?: string, path?: string}>, needsConfirmation: boolean}}
 */
export function normalizeWorkspaceEdit(workspaceEdit) {
  const byPath = new Map();
  const fileOperations = [];
  const annotations = workspaceEdit?.changeAnnotations ?? {};
  let needsConfirmation = false;
  const add = (uri, edits) => {
    const path = uriToPath(uri);
    const key = pathKey(path);
    if (!byPath.has(key)) byPath.set(key, { path, edits: [] });
    for (const edit of edits ?? []) {
      if (edit.annotationId && annotations[edit.annotationId]?.needsConfirmation) needsConfirmation = true;
      byPath.get(key).edits.push({ range: edit.range, newText: edit.newText });
    }
  };
  for (const [uri, edits] of Object.entries(workspaceEdit?.changes ?? {})) add(uri, edits);
  for (const change of workspaceEdit?.documentChanges ?? []) {
    if (change.kind === 'rename') fileOperations.push({ kind: 'rename', oldPath: uriToPath(change.oldUri), newPath: uriToPath(change.newUri) });
    else if (change.kind === 'create' || change.kind === 'delete') fileOperations.push({ kind: change.kind, path: uriToPath(change.uri) });
    else if (change.textDocument) add(change.textDocument.uri, change.edits);
  }
  return { files: [...byPath.values()].filter((file) => file.edits.length > 0), fileOperations, needsConfirmation };
}

/**
 * Líneas de «Ver cambios»: `fichero:línea — antes → después`, una por línea
 * del texto afectada.
 * @param {Array<{relative: string, before: string, after: string, edits: Array<{from: number, to: number, insert: string}>}>} files
 * @returns {string}
 */
export function describeChanges(files) {
  const lines = [];
  for (const file of files) {
    // Ediciones agrupadas por la línea en la que empiezan.
    const touched = new Map();
    for (const edit of file.edits) {
      const lineStart = file.before.lastIndexOf('\n', edit.from - 1) + 1;
      if (!touched.has(lineStart)) touched.set(lineStart, []);
      touched.get(lineStart).push(edit);
    }
    for (const [lineStart, edits] of touched) {
      const lineEnd = file.before.indexOf('\n', lineStart);
      const original = file.before.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      const line = file.before.slice(0, lineStart).split('\n').length;
      const shifted = edits.map((edit) => ({ ...edit, from: edit.from - lineStart, to: Math.min(edit.to - lineStart, original.length) }));
      lines.push(`${file.relative}:${line} — ${original.trim()} → ${applyOffsetEdits(original, shifted).trim()}`);
    }
  }
  const rest = lines.length - PREVIEW_LIMIT;
  const shown = lines.slice(0, PREVIEW_LIMIT);
  if (rest > 0) shown.push(t('edit.moreChanges').replace('{n}', String(rest)));
  return shown.join('\n');
}

/**
 * @param {object} deps
 * @param {{getTabContent: (path: string) => string | null, applyBufferEdits: (edits: any[], path: string) => void, getRoot: () => string | null}} deps.workspace
 * @param {{readFile: Function, writeFile: Function, fileFingerprint: Function}} deps.backend
 * @param {{ask: Function}} deps.dialog
 * @param {(message: string, tone?: string, durationMs?: number, actions?: Array) => void} deps.notify
 */
export function createMultiFileEdit({ workspace, backend, dialog, notify }) {
  const relative = (path) => relativeToRoot(workspace.getRoot(), path) ?? path;

  /**
   * Lee el contenido actual de cada fichero y calcula el resultado. `null`
   * (y se avisa) si algún fichero no se puede leer o las ediciones no encajan.
   */
  async function prepare(files) {
    // Solo dentro del proyecto (hallazgo Crítico de /code-simplify): un
    // `WorkspaceEdit` de Tinymist puede nombrar ficheros de la caché de
    // paquetes, y una ruta con `..` pasaría un simple filtro por prefijo.
    const outside = files.find((file) => !isSafeRelativePath(relativeToRoot(workspace.getRoot(), file.path)));
    if (outside) {
      notify(t('edit.outsideProject').replace('{file}', outside.path), 'error');
      return null;
    }
    const prepared = [];
    for (const file of files) {
      const tabContent = workspace.getTabContent(file.path);
      let before = tabContent;
      let hash = null;
      if (before === null) {
        const read = await backend.readFile(file.path);
        if (!read.ok) {
          notify(`${t('edit.readError').replace('{file}', relative(file.path))} — ${read.error.message}`, 'error');
          return null;
        }
        before = read.value.content;
        hash = read.value.contentHash;
      }
      const edits = toOffsetEdits(before, file.edits);
      if (!edits) {
        notify(t('edit.invalid').replace('{file}', relative(file.path)), 'error');
        return null;
      }
      prepared.push({
        path: file.path,
        relative: relative(file.path),
        inTab: tabContent !== null,
        before,
        hash,
        edits,
        after: applyOffsetEdits(before, edits),
      });
    }
    return prepared;
  }

  /** Nada ha cambiado desde `prepare` (el usuario pudo escribir durante la vista previa). */
  async function stillCurrent(prepared) {
    for (const file of prepared) {
      const changed = file.inTab
        ? workspace.getTabContent(file.path) !== file.before
        : await fingerprintDiffers(file.path, file.hash);
      if (changed) {
        notify(t('edit.stale').replace('{file}', file.relative), 'error');
        return false;
      }
    }
    return true;
  }

  async function fingerprintDiffers(path, hash) {
    const fingerprint = await backend.fileFingerprint(path);
    return !fingerprint.ok || fingerprint.value.missing || fingerprint.value.contentHash !== hash;
  }

  /**
   * Aplica `files` (ediciones LSP por ruta). Con `confirm`, enseña antes la
   * lista de cambios con Aplicar/Cancelar (R-L3). Devuelve el diario, o `null`
   * si no se aplicó nada.
   * @param {Array<{path: string, edits: any[]}>} files
   * @param {{reason: 'rename' | 'replace', confirm?: boolean}} options
   */
  async function apply(files, { reason, confirm = false }) {
    const prepared = files.length ? await prepare(files) : null;
    if (!prepared) return null;
    if (confirm) {
      const choice = await dialog.ask({
        titleKey: 'edit.confirmTitle',
        textKey: 'edit.confirmText',
        text: describeChanges(prepared),
        choices: [
          { key: 'cancel', labelKey: 'action.cancel' },
          { key: 'apply', labelKey: 'edit.apply', tone: 'primary' },
        ],
      });
      if (choice !== 'apply' || !(await stillCurrent(prepared))) return null;
    } else if (!(await stillCurrent(prepared))) {
      return null;
    }

    const journal = [];
    let failure = null;
    for (const file of prepared) {
      if (file.inTab) {
        workspace.applyBufferEdits(file.edits, file.path);
        journal.push({ ...file, afterHash: null });
        continue;
      }
      const written = await backend.writeFile(file.path, file.after, reason);
      if (!written.ok) {
        failure = { file, message: written.error.message };
        break;
      }
      journal.push({ ...file, afterHash: written.value.contentHash });
    }
    const total = journal.reduce((sum, file) => sum + file.edits.length, 0);
    return { journal, failure, total, files: prepared.length };
  }

  /**
   * Deshace un diario de `apply`, todo o nada: si algún fichero ha cambiado
   * desde entonces, no toca ninguno y lo dice.
   */
  async function undo(journal, reason) {
    for (const file of journal) {
      const changed = file.inTab
        ? workspace.getTabContent(file.path) !== file.after
        : await fingerprintDiffers(file.path, file.afterHash);
      if (changed) {
        notify(t('edit.undoConflict').replace('{file}', file.relative), 'error');
        return false;
      }
    }
    for (const file of journal) {
      if (file.inTab) workspace.applyBufferEdits([{ from: 0, to: file.after.length, insert: file.before }], file.path);
      else await backend.writeFile(file.path, file.before, reason);
    }
    notify(t('edit.undone'));
    return true;
  }

  /**
   * Aviso final: «N cambios en M ficheros» con Ver cambios y Deshacer, o el
   * fallo a medias con la opción de deshacer lo aplicado (R-E1).
   */
  function report(result, reason) {
    if (!result) return;
    const actions = [
      { label: t('edit.viewChanges'), run: () => dialog.ask({ titleKey: 'edit.changesTitle', textKey: 'edit.changesText', text: describeChanges(result.journal), choices: [{ key: 'close', labelKey: 'refs.close', tone: 'primary' }] }) },
      { label: t('edit.undo'), run: () => undo(result.journal, reason) },
    ];
    if (result.failure) {
      const message = t('edit.partial')
        .replace('{n}', String(result.journal.length))
        .replace('{m}', String(result.files))
        .replace('{file}', result.failure.file.relative)
        .replace('{error}', result.failure.message);
      notify(message, 'error', 15000, actions);
      return;
    }
    if (result.total === 0) return;
    notify(t('edit.applied').replace('{n}', String(result.total)).replace('{m}', String(result.files)), 'info', undefined, actions);
  }

  return { apply, undo, report };
}
