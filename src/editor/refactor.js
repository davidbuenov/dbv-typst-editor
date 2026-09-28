// =============================================================================
// DBV Typst Editor — Renombrar símbolo y acciones de código (RF-77.4, RF-77.5)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// F2 (con el foco en el editor) y Ctrl+. con Tinymist. Los cambios se aplican
// con la maquinaria común de `app/multiFileEdit.js`. Comprobado con el binario
// (hallazgos 3, 4 y 6 del plan):
//   · renombrar un `#let` devuelve `changes` y se aplica sin preguntar (con
//     Deshacer); renombrar una etiqueta viene marcado `needsConfirmation`
//     («fuzzy searched the labels») y se enseña la lista antes (R-L3);
//   · F2 sobre la ruta de un `#include` renombraría el FICHERO actualizando
//     solo esa referencia: se desvía al renombrado del árbol (RF-69), que
//     actualiza todas (RF-70) (R-L4);
//   · Tinymist no ofrece arreglos para los diagnósticos, sino refactorizaciones
//     según el sitio («Increase depth of heading»…): Ctrl+. las lista.

import { normalizeWorkspaceEdit } from '../app/multiFileEdit.js';
import { symbolAt } from './navigation.js';

/**
 * ¿El tramo que se renombraría es la ruta de un fichero? Comprobado con el
 * binario: para la ruta de un `#include`, `prepareRename` devuelve el rango
 * de la cadena CON sus comillas. Una etiqueta (`<fig.a>`, `@eq:1`) o un
 * identificador nunca van entre comillas, aunque lleven puntos.
 * @param {string} rangeText El texto del documento en ese rango.
 */
export function isPathRename(rangeText) {
  return /^".*"$/s.test(rangeText);
}

/**
 * Fichero al que apunta la ruta de un `#include`/`#import`: relativa a la
 * carpeta del documento, o a la raíz del proyecto si empieza por `/` (como
 * resuelve Typst).
 * @param {string} documentPath
 * @param {string} root
 * @param {string} value
 */
export function resolveIncludePath(documentPath, root, value) {
  const clean = value.replace(/^"|"$/g, '');
  const folder = documentPath.replace(/[\\/][^\\/]*$/, '');
  const base = clean.startsWith('/') ? root : folder;
  const resolved = [];
  for (const part of `${base}/${clean.replace(/^\//, '')}`.split(/[\\/]/)) {
    if (part === '..') resolved.pop();
    else if (part !== '.' && part !== '') resolved.push(part);
  }
  return /^[A-Za-z]:$/.test(resolved[0] ?? '') ? resolved.join('/') : `/${resolved.join('/')}`;
}

/**
 * Campo en línea junto al cursor para escribir el nombre nuevo. Intro
 * confirma, Escape o perder el foco cancelan.
 * @param {import('@codemirror/view').EditorView} view
 * @param {number} pos
 * @param {string} value
 * @returns {Promise<string | null>}
 */
export function askInline(view, pos, value, label) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-rename';
    input.value = value;
    input.setAttribute('aria-label', label);
    let coords = null;
    try {
      coords = view.coordsAtPos(pos);
    } catch {
      // Sin geometría: el campo sale en la esquina del editor.
    }
    const box = view.dom.getBoundingClientRect();
    input.style.left = `${Math.max(4, (coords?.left ?? box.left + 8) - 2)}px`;
    input.style.top = `${(coords?.bottom ?? box.top + 8) + 2}px`;
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      input.remove();
      view.focus();
      resolve(result);
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finish(input.value.trim() || null);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish(null);
      }
      event.stopPropagation();
    });
    input.addEventListener('blur', () => finish(null));
    document.body.append(input);
    input.focus();
    input.select();
  });
}

/**
 * Menú con las acciones de código disponibles, junto al cursor.
 * @param {import('@codemirror/view').EditorView} view
 * @param {Array<{title: string}>} actions
 * @returns {Promise<number | null>} Índice elegido.
 */
export function pickAction(view, actions) {
  return new Promise((resolve) => {
    const menu = document.createElement('div');
    menu.className = 'tree-context-menu editor-context-menu';
    menu.setAttribute('role', 'menu');
    let coords = null;
    try {
      coords = view.coordsAtPos(view.state.selection.main.head);
    } catch {
      // Sin geometría: el menú sale en la esquina.
    }
    menu.style.left = `${coords?.left ?? 8}px`;
    menu.style.top = `${(coords?.bottom ?? 8) + 2}px`;
    let done = false;
    const finish = (index) => {
      if (done) return;
      done = true;
      menu.remove();
      document.removeEventListener('mousedown', outside, true);
      view.focus();
      resolve(index);
    };
    const outside = (event) => {
      if (!menu.contains(event.target)) finish(null);
    };
    actions.forEach((action, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item';
      item.setAttribute('role', 'menuitem');
      item.textContent = action.title;
      item.addEventListener('click', () => finish(index));
      menu.append(item);
    });
    menu.addEventListener('keydown', (event) => {
      const items = [...menu.querySelectorAll('.menu-item')];
      const current = items.indexOf(document.activeElement);
      if (event.key === 'Escape') finish(null);
      else if (event.key === 'ArrowDown') items[(current + 1) % items.length]?.focus();
      else if (event.key === 'ArrowUp') items[(current - 1 + items.length) % items.length]?.focus();
      else return;
      event.preventDefault();
    });
    document.addEventListener('mousedown', outside, true);
    document.body.append(menu);
    menu.querySelector('.menu-item')?.focus();
  });
}

/**
 * @param {object} deps
 * @param {ReturnType<import('./lspClient.js').createLspClient> | undefined} deps.lspClient
 * @param {object} deps.workspace
 * @param {ReturnType<import('../app/multiFileEdit.js').createMultiFileEdit>} deps.multiFileEdit
 * @param {{unavailableReason: () => string | null}} deps.navigation
 * @param {(path: string) => void} deps.renameFile Renombrado del árbol (RF-69).
 * @param {(message: string, tone?: string) => void} deps.notify
 * @param {(key: string) => string} deps.t
 * @param {{askName?: typeof askInline, pick?: typeof pickAction}} [deps.ui] Sustituible en los tests.
 */
export function createRefactor({ lspClient, workspace, multiFileEdit, navigation, renameFile, notify, t, ui = {} }) {
  const askName = ui.askName ?? askInline;
  const pick = ui.pick ?? pickAction;

  function lspPosition(view, pos) {
    const line = view.state.doc.lineAt(pos);
    return { line: line.number - 1, character: pos - line.from };
  }

  /** Aplica un `WorkspaceEdit` si nadie tocó el documento desde la petición (R-L5). */
  async function applyEdit(view, textAtRequest, workspaceEdit, reason, { report = true } = {}) {
    if (view.state.doc.toString() !== textAtRequest) {
      notify(t('refactor.stale'), 'error');
      return false;
    }
    const edit = normalizeWorkspaceEdit(workspaceEdit);
    if (edit.fileOperations.length > 0) {
      notify(t('refactor.fileOperation'), 'error');
      return false;
    }
    const result = await multiFileEdit.apply(edit.files, { reason, confirm: edit.needsConfirmation });
    if (report) multiFileEdit.report(result, reason);
    return Boolean(result);
  }

  /** F2 con el foco en el editor (RF-77.4). */
  async function renameSymbol(view) {
    const reason = navigation.unavailableReason();
    if (reason) {
      notify(reason, 'error');
      return false;
    }
    const head = view.state.selection.main.head;
    const { line, character } = lspPosition(view, head);
    const symbol = symbolAt(view.state, head);
    const prepared = await lspClient.requestAt('textDocument/prepareRename', line, character);
    const range = prepared?.range ?? (prepared?.start ? prepared : null);
    if (!range) {
      const message = symbol?.isLabel && workspace.hasEngineErrors() ? t('nav.labelNeedsCompile') : t('refactor.cannotRename');
      notify(message, 'error');
      return false;
    }
    const doc = view.state.doc;
    const from = doc.line(range.start.line + 1).from + range.start.character;
    const to = doc.line(range.end.line + 1).from + range.end.character;
    const rangeText = view.state.sliceDoc(from, to);
    const placeholder = prepared.placeholder ?? rangeText;

    // R-L4: una ruta de fichero se renombra en el árbol, que actualiza todas
    // las referencias a ese fichero, no solo esta.
    if (isPathRename(rangeText)) {
      const target = resolveIncludePath(workspace.getDocumentPath(), workspace.getRoot(), placeholder);
      notify(t('refactor.renameInTree'));
      renameFile(target);
      return false;
    }

    const newName = await askName(view, from, placeholder, t('refactor.newName'));
    if (!newName || newName === placeholder) return false;
    const textAtRequest = view.state.doc.toString();
    const workspaceEdit = await lspClient.requestAt('textDocument/rename', line, character, { newName });
    if (!workspaceEdit) {
      notify(t('refactor.cannotRename'), 'error');
      return false;
    }
    return applyEdit(view, textAtRequest, workspaceEdit, 'rename');
  }

  /** Ctrl+. y el menú contextual (RF-77.5): refactorizaciones de la posición o la selección. */
  async function codeActions(view) {
    const reason = navigation.unavailableReason();
    if (reason) {
      notify(reason, 'error');
      return false;
    }
    const { from, to } = view.state.selection.main;
    const start = lspPosition(view, from);
    const end = lspPosition(view, to);
    const textAtRequest = view.state.doc.toString();
    const result = await lspClient.getCodeActions({ start, end });
    const actions = (result ?? []).filter((action) => action.edit);
    if (actions.length === 0) {
      notify(t('refactor.noActions'));
      return false;
    }
    const index = await pick(view, actions);
    if (index === null) return false;
    // Una acción suele tocar solo el documento abierto: se deshace con Ctrl+Z,
    // sin aviso de «N cambios».
    return applyEdit(view, textAtRequest, actions[index].edit, 'rename', { report: false });
  }

  return { renameSymbol, codeActions };
}

