// =============================================================================
// DBV Typst Editor — Operaciones de ficheros del panel Archivos (RF-69)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La capa entre el árbol (`projectTree.js`, que solo sabe de DOM) y el disco
// (`commands/fs_ops.rs`, que confina y valida). Aquí se decide qué se
// pregunta, qué se avisa y cómo se mantiene coherente el resto de la
// aplicación: el documento abierto, el principal y el observador (vía
// `workspace.applyPathMoves` / `handleDeletedPaths` / `runOwnOperation`).

import { t } from '../i18n/i18n.js';
import { getPref } from '../app/prefs.js';
import { baseName, relativeToRoot, samePath } from '../app/paths.js';
import {
  fsCopyInto,
  fsCreateDir,
  fsCreateFile,
  fsDeletePermanently,
  fsDuplicate,
  fsMove,
  fsRename,
  fsTrash,
  listDirectory,
} from '../services/backend.js';

/** Cuántos nombres se listan en la confirmación de eliminar antes de resumir. */
const DELETE_LIST_LIMIT = 6;

/**
 * Texto con la lista de lo que se va a eliminar (RF-69.7): hasta
 * `DELETE_LIST_LIMIT` nombres y, si hay más, cuántos quedan.
 * @param {string[]} names
 * @returns {string}
 */
export function describeDeletion(names) {
  const shown = names.slice(0, DELETE_LIST_LIMIT).map((name) => `• ${name}`);
  const rest = names.length - shown.length;
  if (rest > 0) shown.push(t('tree.deleteMore').replace('{n}', String(rest)));
  return shown.join('\n');
}

/**
 * @param {object} deps
 * @param {ReturnType<import('./projectTree.js').createProjectTree>} deps.tree
 * @param {object} deps.workspace  El de `createWorkspace` (openDocument, applyPathMoves…).
 * @param {{ask: Function}} deps.dialog
 * @param {(message: string, tone?: string) => void} deps.notify
 * @param {(moved: Array<{from: string, to: string}>) => Promise<void>} [deps.afterMove]
 *   Gancho tras mover o renombrar (RF-70 actualiza aquí las referencias).
 * @param {(context: object) => void} [deps.onNewChapter]  RF-71.
 * @param {(entry: object) => void} [deps.onHistory]  RF-73.
 */
export function createFileOperations({ tree, workspace, dialog, notify, afterMove, onNewChapter, onHistory }) {
  const root = () => tree.getRoot();

  /** Si el nombre es un dotfile y los ocultos no se ven, avisa de dónde está (RF-69.12). */
  function warnIfHidden(name) {
    if (name.startsWith('.') && !getPref('showHiddenFiles')) notify(t('tree.createdHidden'));
  }

  /** Abre en el editor un fichero recién creado, si el editor sabe abrirlo. */
  async function openIfEditable(dirPath, path) {
    const listing = await listDirectory(dirPath);
    const entry = listing.ok ? listing.value.find((item) => samePath(item.path, path)) : null;
    if (entry?.isEditable) await workspace.openDocument(path);
  }

  /** Tras mover o renombrar: estado de la aplicación y, luego, referencias. */
  async function finishMoves(moved) {
    await workspace.applyPathMoves(moved);
    await afterMove?.(moved);
  }

  /** `onCommitName` del árbol: crear fichero o carpeta, o renombrar. */
  async function commitName({ mode, dirPath, entry, name }) {
    if (mode === 'create-file' || mode === 'create-dir') {
      const created = mode === 'create-file' ? await fsCreateFile(root(), dirPath, name) : await fsCreateDir(root(), dirPath, name);
      if (!created.ok) return { ok: false, message: created.error.message };
      warnIfHidden(name);
      if (mode === 'create-file') await openIfEditable(dirPath, created.value);
      return { ok: true, path: created.value };
    }

    const renamed = await workspace.runOwnOperation([entry.path], () => fsRename(root(), entry.path, name));
    if (!renamed.ok) return { ok: false, message: renamed.error.message };
    warnIfHidden(name);
    await finishMoves([renamed.value]);
    return { ok: true, path: renamed.value.to };
  }

  async function move(paths, destDir) {
    const moved = await workspace.runOwnOperation(paths, () => fsMove(root(), paths, destDir));
    if (!moved.ok) {
      notify(`${t('tree.moveError')} — ${moved.error.message}`, 'error');
      return;
    }
    if (moved.value.length === 0) return;
    await finishMoves(moved.value);
    await tree.refresh();
    const last = moved.value[moved.value.length - 1];
    if (last) await tree.revealPath(last.to);
  }

  async function duplicate(entry) {
    const copy = await fsDuplicate(root(), entry.path);
    if (!copy.ok) {
      notify(`${t('tree.duplicateError')} — ${copy.error.message}`, 'error');
      return;
    }
    await tree.refresh();
    await tree.revealPath(copy.value);
  }

  /**
   * Eliminar (RF-69.7): confirmación con la lista, a la papelera; si no hay
   * papelera, una segunda confirmación explícita para borrar para siempre.
   */
  async function remove(entries) {
    const paths = entries.map((entry) => entry.path);
    const openPath = workspace.getDocumentPath();
    const touchesDirtyDocument =
      openPath && workspace.isDirty() && paths.some((path) => path === openPath || openPath.startsWith(`${path}/`) || openPath.startsWith(`${path}\\`));

    const choice = await dialog.ask({
      titleKey: 'tree.deleteTitle',
      textKey: touchesDirtyDocument ? 'tree.deleteTextDirty' : 'tree.deleteText',
      text: describeDeletion(entries.map((entry) => entry.name)),
      choices: [
        { key: 'cancel', labelKey: 'action.cancel' },
        { key: 'trash', labelKey: 'tree.moveToTrash', tone: 'danger' },
      ],
    });
    if (choice !== 'trash') return;

    let result = await workspace.runOwnOperation(paths, () => fsTrash(root(), paths));
    if (!result.ok && result.error.kind === 'trashUnavailable') {
      const permanent = await dialog.ask({
        titleKey: 'tree.trashUnavailableTitle',
        textKey: 'tree.trashUnavailableText',
        text: describeDeletion(entries.map((entry) => entry.name)),
        choices: [
          { key: 'cancel', labelKey: 'action.cancel' },
          { key: 'delete', labelKey: 'tree.deletePermanently', tone: 'danger' },
        ],
      });
      if (permanent !== 'delete') return;
      result = await workspace.runOwnOperation(paths, () => fsDeletePermanently(root(), paths));
    }
    if (!result.ok) {
      notify(`${t('tree.deleteError')} — ${result.error.message}`, 'error');
      return;
    }
    await workspace.handleDeletedPaths(paths);
    await tree.refresh();
  }

  async function copyPaths(entries, relative) {
    const text = entries
      .map((entry) => (relative ? relativeToRoot(root(), entry.path) ?? entry.path : entry.path))
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      notify(t('tree.pathCopied'));
    } catch (error) {
      notify(`${t('tree.copyError')} — ${error?.message ?? error}`, 'error');
    }
  }

  /** `onAction` del árbol. */
  function handleAction(action, context) {
    switch (action) {
      case 'duplicate':
        return duplicate(context.entry);
      case 'delete':
        return remove(context.entries);
      case 'copyPath':
        return copyPaths(context.entries, false);
      case 'copyRelativePath':
        return copyPaths(context.entries, true);
      case 'newChapter':
        return onNewChapter?.(context);
      case 'history':
        return onHistory?.(context.entry);
      default:
        return undefined;
    }
  }

  /**
   * Ficheros soltados desde el explorador del sistema sobre una carpeta del
   * árbol (RF-69.6): se copian allí, sin sobrescribir nunca.
   * @param {string[]} sources
   * @param {string} destDir
   */
  async function copyFromSystem(sources, destDir) {
    const copied = await fsCopyInto(root(), sources, destDir);
    if (!copied.ok) {
      notify(`${t('tree.copyIntoError')} — ${copied.error.message}`, 'error');
      return;
    }
    await tree.refresh();
    const last = copied.value[copied.value.length - 1];
    if (last) await tree.revealPath(last);
    notify(t('tree.copiedInto').replace('{n}', String(copied.value.length)).replace('{dir}', baseName(destDir)));
  }

  return { commitName, handleAction, move, copyFromSystem };
}
