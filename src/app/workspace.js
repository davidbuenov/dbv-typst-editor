// =============================================================================
// DBV Typst Editor — Espacio de trabajo (proyecto activo + documento activo)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Estado central de la aplicación: qué proyecto está abierto y qué documento se
// está editando. Es el único módulo que conoce ambas cosas a la vez; el árbol,
// el editor y (desde el Slice 5) la vista previa son piezas que él coordina.
//
// Regla de RF-02b / R-MVP-3 que se hace visible aquí: abrir un proyecto NUNCA
// escribe nada en su carpeta. `openProjectAt` solo lee.

import { createEditor } from '../editor/editor.js';
import { t } from '../i18n/i18n.js';
import { getTheme } from '../themes/theme.js';
import {
  PROJECT_CHANGE_EVENT,
  addRecentProject,
  on,
  openProject,
  readFile,
  revealInFileManager,
  unwatchProject,
  watchProject,
} from '../services/backend.js';

/** Une carpeta y nombre de fichero respetando el separador ya presente. */
export function joinPath(dir, name) {
  if (!dir) return name;
  const separator = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  const trimmed = dir.endsWith('/') || dir.endsWith('\\') ? dir.slice(0, -1) : dir;
  return `${trimmed}${separator}${name}`;
}

/** Nombre de fichero de una ruta, con cualquiera de los dos separadores. */
export function baseName(path) {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index >= 0 ? path.slice(index + 1) : path;
}

/**
 * @param {object} deps
 * @param {ReturnType<import('../project-explorer/projectTree.js').createProjectTree>} deps.tree
 * @param {Record<string, HTMLElement>} deps.elements
 * @param {(message: string, tone?: 'info'|'error') => void} deps.notify
 */
export function createWorkspace({ tree, elements, notify }) {
  const editor = createEditor(elements.editorHost, {
    theme: getTheme(),
    onChange: (content) => {
      state.dirty = true;
      renderDocumentBar();
      listeners.documentChanged?.(content);
    },
    onSave: () => listeners.saveRequested?.(),
  });

  const state = {
    /** @type {null | {root: string, name: string, entrypoint: string|null, isSingleFile: boolean, hasManifest: boolean}} */
    project: null,
    /** @type {null | {path: string, fileName: string, modifiedMs: number}} */
    document: null,
    dirty: false,
  };

  /** Ganchos que rellenan los slices posteriores (vista previa, guardado). */
  const listeners = {
    /** @type {null | ((content: string) => void)} */
    documentChanged: null,
    /** @type {null | ((change: {path: string, isActiveDocument: boolean}) => void)} */
    externalChange: null,
    /** @type {null | ((project: object) => void)} */
    projectOpened: null,
    /** @type {null | ((doc: object) => void)} */
    documentOpened: null,
    /** @type {null | (() => void)} */
    saveRequested: null,
  };

  function renderDocumentBar() {
    const hasDocument = Boolean(state.document);
    elements.documentName.textContent = hasDocument ? state.document.fileName : '—';
    elements.documentDirty.classList.toggle('hidden', !state.dirty);
    elements.documentPath.textContent = hasDocument ? state.document.path : '';
  }

  function renderProjectBar() {
    const hasProject = Boolean(state.project);
    elements.projectName.textContent = hasProject ? state.project.name : t('project.none');
    elements.workspaceView.classList.toggle('hidden', !hasProject);
    elements.emptyView.classList.toggle('hidden', hasProject);
    elements.projectActions.classList.toggle('hidden', !hasProject);
    // El aviso de "proyecto sin manifiesto DBV" es informativo, nunca una
    // degradación (RF-02b): se muestra como etiqueta neutra, no como error.
    elements.projectKind.textContent = !hasProject
      ? ''
      : state.project.isSingleFile
        ? t('project.singleFile')
        : state.project.hasManifest
          ? t('project.dbv')
          : t('project.external');
  }

  /**
   * Pide confirmación antes de perder cambios sin guardar. Portado del
   * `confirmDiscardUnsavedChanges` de DBV Markdown Reader (ARCHITECTURE.md §3
   * fila 17): es el único punto de la aplicación que interrumpe al usuario con
   * un diálogo modal, y lo hace porque la alternativa es perder trabajo.
   */
  function confirmDiscardChanges() {
    if (!state.dirty) return true;
    return window.confirm(t('doc.discardConfirm'));
  }

  /** Abre un documento del proyecto en el editor. */
  async function openDocument(path, { force = false } = {}) {
    if (!force && path !== state.document?.path && !confirmDiscardChanges()) return false;

    const result = await readFile(path);
    if (!result.ok) {
      notify(`${t('doc.openError')} — ${result.error.message}`, 'error');
      return false;
    }

    const payload = result.value;
    editor.setDocument(payload.content, payload.path);
    state.document = {
      path: payload.path,
      fileName: payload.fileName,
      modifiedMs: payload.modifiedMs,
    };
    state.dirty = false;
    tree.setActivePath(payload.path);
    renderDocumentBar();
    listeners.documentOpened?.({ ...state.document, content: payload.content });

    // El watcher debe saber cuál es el documento activo para poder distinguir
    // "recompila" de "aviso de conflicto" (Slice 6).
    if (state.project) {
      await watchProject(state.project.root, payload.path);
    }
    return true;
  }

  /**
   * Abre una carpeta de proyecto o un `.typ` suelto. Solo lee: ni crea el
   * manifiesto, ni toca la estructura de la carpeta (R-MVP-3).
   */
  async function openProjectAt(path) {
    if (!confirmDiscardChanges()) return false;

    const result = await openProject(path);
    if (!result.ok) {
      notify(`${t('project.openError')} — ${result.error.message}`, 'error');
      return false;
    }

    state.project = result.value;
    state.document = null;
    state.dirty = false;
    renderProjectBar();
    renderDocumentBar();

    await tree.setRoot(state.project.root, { force: true });
    await addRecentProject(state.project);
    listeners.projectOpened?.(state.project);

    if (state.project.entrypoint) {
      await openDocument(joinPath(state.project.root, state.project.entrypoint), { force: true });
    } else {
      await watchProject(state.project.root, null);
      notify(t('project.noEntrypoint'));
    }
    return true;
  }

  async function closeProject() {
    if (!confirmDiscardChanges()) return false;
    await unwatchProject();
    state.project = null;
    state.document = null;
    state.dirty = false;
    renderProjectBar();
    renderDocumentBar();
    return true;
  }

  function revealProject() {
    if (!state.project) return;
    revealInFileManager(state.project.root);
  }

  // Un cambio en disco refresca el árbol (ficheros nuevos de un `git pull`, por
  // ejemplo) y se reenvía a quien lo necesite: la vista previa recompila
  // (Slice 5) y el guardado detecta conflicto (Slice 6).
  on(PROJECT_CHANGE_EVENT, (change) => {
    listeners.externalChange?.(change);
    if (!change.isActiveDocument) tree.refresh();
  });

  renderProjectBar();
  renderDocumentBar();

  return {
    state,
    editor,
    openProjectAt,
    openDocument,
    closeProject,
    revealProject,
    confirmDiscardChanges,
    /** @param {'dark'|'light'} theme */
    setTheme(theme) {
      editor.setTheme(theme);
    },
    markSaved(modifiedMs) {
      if (!state.document) return;
      state.document.modifiedMs = modifiedMs;
      state.dirty = false;
      renderDocumentBar();
    },
    /** Registra los ganchos que rellenan los slices 5 y 6. */
    setListener(name, handler) {
      listeners[name] = handler;
    },
    renderDocumentBar,
  };
}
