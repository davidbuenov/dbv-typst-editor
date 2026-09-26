// =============================================================================
// DBV Typst Editor — Explorador de proyecto (árbol de ficheros)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Portado de dbv-md-reader/src/filetree.js (ARCHITECTURE.md §3 fila 6),
// adaptado de IIFE + `var` a ESM y de "árbol del directorio del documento" a
// "árbol del proyecto". Se conserva lo esencial del original:
//   · carga por niveles bajo demanda, nunca un recorrido recursivo de golpe;
//   · token de generación para descartar respuestas de una raíz ya sustituida
//     (dos aperturas seguidas dejan dos `list_directory` en vuelo, y sin esta
//     comprobación la más lenta pinta sus filas encima de las correctas).
//
// v0.11.0 (RF-69) lo convierte en un explorador de verdad: selección múltiple,
// filas editables en línea para crear y renombrar, menú contextual completo,
// F2/Supr, arrastrar para mover y un refresco que conserva las carpetas
// abiertas y la selección. Este módulo solo se ocupa del DOM: las operaciones
// de disco las hace quien lo crea (`fileOperations.js`) a través de callbacks.

import { t } from '../i18n/i18n.js';
import { listDirectory, revealInFileManager } from '../services/backend.js';
import { getPref, onPrefsChanged } from '../app/prefs.js';
import { dropTargetDir, isValidDrop } from './treeDrag.js';

/**
 * @typedef {object} TreeEntry
 * @property {string} name
 * @property {string} path
 * @property {boolean} isDir
 * @property {boolean} isTypst
 * @property {boolean} isEditable
 */

/**
 * @typedef {object} ActionContext
 * @property {TreeEntry} entry      Fila sobre la que se actuó.
 * @property {TreeEntry[]} entries  Selección completa (incluye `entry`).
 * @property {string} dirPath       Carpeta de `entry` (ella misma si es carpeta).
 */

/** Ruta normalizada para comparar: separador `/` y sin barra final. */
const norm = (path) => (path || '').replaceAll('\\', '/').replace(/\/+$/, '');

/** Compara rutas sin depender del separador de la plataforma. */
const sameFile = (a, b) => Boolean(a && b) && norm(a) === norm(b);

/** True si `filePath` cuelga de la carpeta `dirPath` (a cualquier profundidad). */
function isAncestorOf(dirPath, filePath) {
  if (!dirPath || !filePath) return false;
  return norm(filePath).startsWith(`${norm(dirPath)}/`);
}

/** Carpeta que contiene `path`, con el separador original. */
export function parentOf(path) {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return cut > 0 ? path.slice(0, cut) : path;
}

/** True si `name` es un dotfile (`.git`, `.gitignore`, `.claude`…). */
const isDotEntry = (name) => name.startsWith('.');

/** Agrupa los refrescos seguidos (una operación sobre muchos ficheros genera una ráfaga de avisos del observador, R-F3). */
const REFRESH_COALESCE_MS = 150;

/**
 * @param {HTMLElement} containerEl
 * @param {{
 *   onOpenFile?: (path: string) => void,
 *   onSetEntrypoint?: (path: string) => void,
 *   onCommitName?: (request: {mode: 'create-file'|'create-dir'|'rename', dirPath: string, entry?: TreeEntry, name: string}) => Promise<{ok: true, path: string} | {ok: false, message: string}>,
 *   onAction?: (action: string, context: ActionContext) => void,
 *   onMove?: (paths: string[], destDir: string) => void,
 *   features?: {chapter?: boolean, history?: boolean},
 * }} [options]
 */
export function createProjectTree(
  containerEl,
  { onOpenFile, onSetEntrypoint, onCommitName, onAction, onMove, features = {} } = {},
) {
  if (!(containerEl instanceof HTMLElement)) {
    throw new TypeError('createProjectTree: containerEl debe ser un HTMLElement');
  }

  let root = null;
  let generation = 0;
  /** @type {TreeEntry[]} Ficheros abribles ya conocidos (niveles cargados). */
  const knownFiles = [];
  /** @type {Array<{wrapper: HTMLElement, entry: TreeEntry}>} Toda fila pintada, para poder re-evaluar el filtro de ocultos sin repintar el árbol (RF-63.1). */
  const renderedEntries = [];
  /** @type {Map<string, {entry: TreeEntry, row: HTMLElement, expand?: (open: boolean) => Promise<void>}>} por ruta normalizada */
  const rows = new Map();
  let activePath = null;
  /** Ruta ABSOLUTA del documento principal del proyecto, para marcarlo. */
  let entrypointPath = null;
  let openMenuEl = null;
  /** Carpetas abiertas (rutas normalizadas): sobreviven a un refresco. */
  const expanded = new Set();
  /** Selección (rutas normalizadas) y ancla de Mayús+clic. */
  const selection = new Set();
  let anchor = null;
  /** Fila editable en curso (crear o renombrar); un refresco espera a que termine. */
  let editing = null;
  let refreshTimer = null;
  const refreshWaiters = [];
  let refreshAfterEdit = false;

  /**
   * RF-63.1: un dotfile no se lista salvo que el usuario active "Mostrar
   * ficheros ocultos", o salvo que sea (o contenga a) el fichero abierto o el
   * principal — nunca se esconde el camino de vuelta a lo que ya se está
   * editando. Es un filtro de PRESENTACIÓN: no toca qué existe de verdad ni lo
   * que ve Git o el motor.
   * @param {TreeEntry} entry
   */
  function isHiddenByDotfileFilter(entry) {
    if (!isDotEntry(entry.name)) return false;
    if (getPref('showHiddenFiles')) return false;
    if (sameFile(entry.path, activePath) || sameFile(entry.path, entrypointPath)) return false;
    if (entry.isDir && (isAncestorOf(entry.path, activePath) || isAncestorOf(entry.path, entrypointPath))) {
      return false;
    }
    return true;
  }

  /** Reevalúa el filtro de ocultos en todas las filas ya pintadas. */
  function applyHiddenFilter() {
    for (const { wrapper, entry } of renderedEntries) {
      wrapper.classList.toggle('tree-item--dotfile-hidden', isHiddenByDotfileFilter(entry));
    }
  }

  onPrefsChanged(({ key }) => {
    if (key === 'showHiddenFiles') applyHiddenFilter();
  });

  function reset() {
    generation += 1;
    containerEl.innerHTML = '';
    knownFiles.length = 0;
    renderedEntries.length = 0;
    rows.clear();
  }

  function showMessage(key) {
    const message = document.createElement('p');
    message.className = 'tree__message';
    message.textContent = t(key);
    containerEl.replaceChildren(message);
  }

  /** Busca la fila de `path`: primero exacta, luego sin distinguir mayúsculas (Windows). */
  function findRow(path) {
    const key = norm(path);
    if (rows.has(key)) return rows.get(key);
    const lower = key.toLowerCase();
    for (const [candidate, value] of rows) {
      if (candidate.toLowerCase() === lower) return value;
    }
    return null;
  }

  /** Marca visualmente qué fichero está abierto en el editor. */
  function setActivePath(path) {
    activePath = path;
    for (const row of containerEl.querySelectorAll('.tree-row')) {
      row.classList.toggle('is-active', sameFile(row.dataset.path, path));
    }
    applyHiddenFilter();
  }

  /** Pone o quita la etiqueta "principal" en una fila según `entrypointPath`. */
  function applyEntrypointBadge(row) {
    const isMain = !row.classList.contains('is-dir') && sameFile(row.dataset.path, entrypointPath);
    row.classList.toggle('is-entrypoint', isMain);
    let badge = row.querySelector('.tree-row__badge');
    if (isMain && !badge) {
      badge = document.createElement('span');
      badge.className = 'tree-row__badge';
      badge.textContent = t('tree.entrypointBadge');
      badge.title = t('tree.entrypointBadgeTitle');
      row.append(badge);
    } else if (!isMain && badge) {
      badge.remove();
    }
  }

  /** Marca qué fichero es el documento principal (o ninguno con `null`). */
  function setEntrypointPath(path) {
    entrypointPath = path;
    for (const row of containerEl.querySelectorAll('.tree-row')) applyEntrypointBadge(row);
    applyHiddenFilter();
  }

  // ── Selección ──────────────────────────────────────────────────────────────

  function applySelection() {
    for (const [key, { row }] of rows) row.classList.toggle('is-selected', selection.has(key));
  }

  /** Filas visibles en orden de pantalla (para Mayús+clic y las flechas). */
  function visibleRows() {
    return [...containerEl.querySelectorAll('.tree-row[data-path]')].filter(
      (row) => !row.closest('.hidden, .tree-item--dotfile-hidden') && !row.classList.contains('tree-row--hidden'),
    );
  }

  function selectOnly(path) {
    selection.clear();
    selection.add(norm(path));
    anchor = norm(path);
    applySelection();
  }

  function toggleSelected(path) {
    const key = norm(path);
    if (selection.has(key)) selection.delete(key);
    else selection.add(key);
    anchor = key;
    applySelection();
  }

  function selectRange(path) {
    const ordered = visibleRows().map((row) => norm(row.dataset.path));
    const from = ordered.indexOf(anchor);
    const to = ordered.indexOf(norm(path));
    if (from === -1 || to === -1) return selectOnly(path);
    selection.clear();
    for (const key of ordered.slice(Math.min(from, to), Math.max(from, to) + 1)) selection.add(key);
    applySelection();
  }

  /** Entradas seleccionadas, en orden de pantalla. */
  function selectedEntries() {
    return visibleRows()
      .map((row) => norm(row.dataset.path))
      .filter((key) => selection.has(key))
      .map((key) => rows.get(key)?.entry)
      .filter(Boolean);
  }

  /**
   * Carpeta donde crear algo desde la cabecera (RF-69.1): la carpeta
   * seleccionada, la del fichero seleccionado, o la raíz.
   */
  function getTargetDir() {
    const focused = anchor && rows.get(anchor);
    if (!focused || !selection.has(anchor)) return root;
    return focused.entry.isDir ? focused.entry.path : parentOf(focused.entry.path);
  }

  /** Contexto de una acción sobre `entry`: si no estaba seleccionada, pasa a ser la selección. */
  function contextFor(entry) {
    if (!selection.has(norm(entry.path))) selectOnly(entry.path);
    const entries = selectedEntries();
    return {
      entry,
      entries: entries.length ? entries : [entry],
      dirPath: entry.isDir ? entry.path : parentOf(entry.path),
    };
  }

  // ── Menú contextual ────────────────────────────────────────────────────────

  function closeContextMenu() {
    openMenuEl?.remove();
    openMenuEl = null;
  }

  /**
   * Menú contextual de una fila (RF-69.3). Con varios elementos seleccionados
   * solo ofrece lo que tiene sentido para todos a la vez.
   */
  function openContextMenu(event, entry) {
    closeContextMenu();
    const context = contextFor(entry);
    const multiple = context.entries.length > 1;
    const menu = document.createElement('div');
    menu.className = 'tree-context-menu';
    menu.setAttribute('role', 'menu');

    let pendingSeparator = false;
    const addItem = (action, label, run) => {
      if (pendingSeparator && menu.childElementCount > 0) {
        const separator = document.createElement('div');
        separator.className = 'menu-separator';
        separator.setAttribute('role', 'separator');
        menu.append(separator);
      }
      pendingSeparator = false;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item';
      item.dataset.action = action;
      item.setAttribute('role', 'menuitem');
      item.textContent = label;
      item.addEventListener('click', () => {
        closeContextMenu();
        run();
      });
      menu.append(item);
    };
    const separator = () => {
      pendingSeparator = true;
    };
    const host = (action) => () => onAction?.(action, context);

    if (!multiple) {
      if (entry.isTypst && !entry.isDir && !sameFile(entry.path, entrypointPath) && onSetEntrypoint) {
        addItem('setEntrypoint', t('action.setEntrypoint'), () => onSetEntrypoint(entry.path));
      }
      // RF-60.6: un fichero que la aplicación no reconoce como texto se puede abrir
      // igualmente como texto plano; las guardas de lectura rechazan lo binario.
      if (!entry.isDir && !entry.isEditable && onOpenFile) {
        addItem('openAsText', t('action.openAsText'), () => onOpenFile(entry.path));
      }
      separator();
      if (onCommitName) {
        addItem('newFile', t('tree.newFile'), () => startCreate('file', context.dirPath));
        addItem('newFolder', t('tree.newFolder'), () => startCreate('dir', context.dirPath));
      }
      if (features.chapter && onAction) addItem('newChapter', t('tree.newChapter'), host('newChapter'));
      separator();
      if (onCommitName) addItem('rename', t('tree.rename'), () => startRename(entry.path));
      if (onAction) addItem('duplicate', t('tree.duplicate'), host('duplicate'));
    }
    if (onAction) addItem('delete', t('tree.delete'), host('delete'));
    separator();
    if (onAction) {
      addItem('copyPath', t('tree.copyPath'), host('copyPath'));
      addItem('copyRelativePath', t('tree.copyRelativePath'), host('copyRelativePath'));
    }
    if (!multiple) {
      addItem('reveal', t('action.reveal'), () => revealInFileManager(entry.path));
      if (features.history && onAction && !entry.isDir && entry.isEditable) {
        separator();
        addItem('history', t('history.open'), host('history'));
      }
    }

    document.body.append(menu);
    // Se recoloca dentro de la ventana: en el borde derecho o inferior el menú
    // saldría cortado.
    const { width, height } = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(event.clientX, window.innerWidth - width - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(event.clientY, window.innerHeight - height - 4))}px`;
    openMenuEl = menu;
    menu.querySelector('.menu-item')?.focus();
  }

  // Se cierra al pulsar fuera, con Escape o al desplazar el árbol.
  document.addEventListener('mousedown', (event) => {
    if (openMenuEl && !openMenuEl.contains(event.target)) closeContextMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeContextMenu();
  });
  containerEl.addEventListener('scroll', closeContextMenu);

  // ── Filas editables en línea (crear y renombrar, RF-69.2) ──────────────────

  /**
   * Pinta un campo de nombre. `onDone` se llama al terminar (bien o cancelado).
   * Intro confirma; Escape, o salir con el campo vacío, cancela; salir con un
   * nombre lo confirma (como el explorador de VS Code).
   */
  function mountNameEditor(hostRow, { initial = '', selectStem = false, commit, onDone }) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-edit__input';
    input.value = initial;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', t('tree.namePlaceholder'));
    input.placeholder = t('tree.namePlaceholder');
    const error = document.createElement('div');
    error.className = 'tree-edit__error hidden';
    error.setAttribute('role', 'alert');
    hostRow.append(input);
    hostRow.after(error);

    let busy = false;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      error.remove();
      onDone();
    };
    const submit = async () => {
      if (busy || finished) return;
      const name = input.value.trim();
      if (!name || name === initial) {
        finish();
        return;
      }
      busy = true;
      input.disabled = true;
      const result = await commit(name);
      busy = false;
      if (finished) return;
      if (result.ok) {
        finish();
        return;
      }
      input.disabled = false;
      error.textContent = result.message;
      error.classList.remove('hidden');
      input.focus();
    };

    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finish();
      }
    });
    input.addEventListener('blur', () => {
      if (!busy) submit();
    });
    // Los clics dentro del campo no deben seleccionar ni abrir la fila.
    input.addEventListener('click', (event) => event.stopPropagation());
    input.addEventListener('pointerdown', (event) => event.stopPropagation());

    input.focus();
    if (selectStem) {
      const dot = initial.lastIndexOf('.');
      input.setSelectionRange(0, dot > 0 ? dot : initial.length);
    } else {
      input.select();
    }
    return input;
  }

  /** Abre (y carga si hace falta) la carpeta `dirPath`. No-op con la raíz. */
  async function ensureExpanded(dirPath) {
    if (!dirPath || sameFile(dirPath, root)) return;
    const found = findRow(dirPath);
    if (found?.expand) await found.expand(true);
  }

  /** Abre las carpetas que llevan hasta `path` y lo selecciona. */
  async function revealPath(path) {
    if (!root || !path) return;
    const relative = norm(path).slice(norm(root).length).split('/').filter(Boolean);
    let current = norm(root);
    for (const segment of relative.slice(0, -1)) {
      current = `${current}/${segment}`;
      await ensureExpanded(findRow(current)?.entry.path ?? current);
    }
    const found = findRow(path);
    if (!found) return;
    selectOnly(found.entry.path);
    found.row.scrollIntoView?.({ block: 'nearest' });
  }

  /**
   * Crea una fila editable para un fichero (`kind === 'file'`) o una carpeta
   * nuevos dentro de `dirPath` (por defecto, la carpeta de la selección).
   */
  async function startCreate(kind, dirPath = getTargetDir()) {
    if (!root || !onCommitName || editing) return;
    const target = dirPath || root;
    await ensureExpanded(target);
    const isRoot = sameFile(target, root);
    const hostEl = isRoot ? containerEl : findRow(target)?.row.parentElement?.querySelector(':scope > .tree-children');
    if (!hostEl) return;
    containerEl.querySelector(':scope > .tree__message')?.remove();

    const depth = isRoot ? 0 : Number(findRow(target).row.dataset.depth) + 1;
    const row = document.createElement('div');
    row.className = 'tree-row tree-row--editing';
    row.style.paddingLeft = `${8 + depth * 14}px`;
    const icon = document.createElement('span');
    icon.className = 'tree-row__icon';
    icon.textContent = kind === 'dir' ? '📁' : '📄';
    row.append(icon);
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-item';
    wrapper.append(row);
    hostEl.prepend(wrapper);

    editing = { kind };
    mountNameEditor(row, {
      commit: async (name) => {
        const result = await onCommitName({ mode: kind === 'dir' ? 'create-dir' : 'create-file', dirPath: target, name });
        if (result.ok) {
          wrapper.remove();
          editing = null;
          await refresh();
          await revealPath(result.path);
        }
        return result;
      },
      onDone: () => {
        wrapper.remove();
        editing = null;
        flushPendingRefresh();
      },
    });
  }

  /** Sustituye el nombre de la fila de `path` por un campo editable (F2). */
  function startRename(path) {
    const found = findRow(path);
    if (!found || !onCommitName || editing) return;
    const { entry, row } = found;
    const label = row.querySelector('.tree-row__name');
    label.classList.add('hidden');
    row.classList.add('tree-row--editing');

    editing = { kind: 'rename' };
    mountNameEditor(row, {
      initial: entry.name,
      selectStem: !entry.isDir,
      commit: async (name) => {
        const result = await onCommitName({ mode: 'rename', dirPath: parentOf(entry.path), entry, name });
        if (result.ok) {
          editing = null;
          if (expanded.delete(norm(entry.path))) expanded.add(norm(result.path));
          await refresh();
          await revealPath(result.path);
        }
        return result;
      },
      onDone: () => {
        row.querySelector('.tree-edit__input')?.remove();
        label.classList.remove('hidden');
        row.classList.remove('tree-row--editing');
        editing = null;
        flushPendingRefresh();
        row.focus();
      },
    });
  }

  // ── Arrastrar para mover (RF-69.5, R-F1) ───────────────────────────────────
  //
  // Con eventos de puntero, no con la API de drag & drop: la ventana tiene el
  // arrastre NATIVO activado para recibir ficheros del sistema (RF-18), y en
  // Windows eso impide que la página reciba `dragover`/`drop`.

  const DRAG_THRESHOLD_PX = 4;
  const HOVER_EXPAND_MS = 700;
  let drag = null;

  function rowUnderPointer(event) {
    const hit = document.elementFromPoint?.(event.clientX, event.clientY);
    const row = hit?.closest?.('.tree-row[data-path]');
    return row && containerEl.contains(row) ? row : null;
  }

  function clearDropHighlight() {
    containerEl.querySelector('.is-drop-target')?.classList.remove('is-drop-target');
    containerEl.classList.remove('is-drop-root');
  }

  function onDragMove(event) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_THRESHOLD_PX) return;
      drag.active = true;
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'tree-drag-ghost';
      drag.ghost.textContent =
        drag.entries.length === 1 ? drag.entries[0].name : t('tree.dragCount').replace('{n}', String(drag.entries.length));
      document.body.append(drag.ghost);
    }
    drag.ghost.style.left = `${event.clientX + 12}px`;
    drag.ghost.style.top = `${event.clientY + 8}px`;

    const row = rowUnderPointer(event);
    const over = row ? findRow(row.dataset.path)?.entry : null;
    const destDir = dropTargetDir(over, root);
    clearDropHighlight();
    drag.destDir = isValidDrop(drag.entries, destDir) ? destDir : null;
    if (drag.destDir) {
      const targetRow = findRow(drag.destDir)?.row;
      if (targetRow && !sameFile(drag.destDir, root)) targetRow.classList.add('is-drop-target');
      else containerEl.classList.add('is-drop-root');
    }
    // Mantener el puntero sobre una carpeta cerrada la abre.
    if (over?.isDir && !expanded.has(norm(over.path))) {
      if (drag.hoverPath !== over.path) {
        clearTimeout(drag.hoverTimer);
        drag.hoverPath = over.path;
        drag.hoverTimer = setTimeout(() => ensureExpanded(over.path), HOVER_EXPAND_MS);
      }
    } else {
      clearTimeout(drag.hoverTimer);
      drag.hoverPath = null;
    }
  }

  function endDrag() {
    if (!drag) return;
    clearTimeout(drag.hoverTimer);
    drag.ghost?.remove();
    clearDropHighlight();
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
    document.removeEventListener('keydown', onDragKey, true);
    drag = null;
  }

  function onDragEnd() {
    if (!drag) return;
    const { active, destDir, entries } = drag;
    // Un arrastre de verdad no debe terminar en el clic de la fila de origen.
    if (active) {
      const swallow = (event) => {
        event.stopPropagation();
        event.preventDefault();
      };
      containerEl.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => containerEl.removeEventListener('click', swallow, { capture: true }), 0);
    }
    endDrag();
    if (active && destDir) onMove?.(entries.map((entry) => entry.path), destDir);
  }

  function onDragKey(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      endDrag();
    }
  }

  function beginDrag(event, entry) {
    if (!onMove || event.button !== 0 || editing || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const entries = selection.has(norm(entry.path)) ? selectedEntries() : [entry];
    drag = { x: event.clientX, y: event.clientY, entries, active: false, destDir: null, hoverTimer: null, hoverPath: null };
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    document.addEventListener('keydown', onDragKey, true);
  }

  // ── Filas ──────────────────────────────────────────────────────────────────

  function moveFocus(row, delta) {
    const ordered = visibleRows();
    const next = ordered[ordered.indexOf(row) + delta];
    next?.focus();
  }

  function buildRow(entry, depth) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-item';

    const row = document.createElement('div');
    row.className = 'tree-row';
    row.classList.add(entry.isDir ? 'is-dir' : entry.isEditable ? 'is-file' : 'is-dimmed');
    row.classList.toggle('is-active', sameFile(entry.path, activePath));
    row.classList.toggle('is-selected', selection.has(norm(entry.path)));
    row.style.paddingLeft = `${8 + depth * 14}px`;
    row.dataset.name = entry.name;
    row.dataset.path = entry.path;
    row.dataset.depth = String(depth);
    row.tabIndex = 0;

    const toggle = document.createElement('span');
    toggle.className = 'tree-row__toggle';
    toggle.textContent = entry.isDir ? '▸' : '';
    row.append(toggle);

    const icon = document.createElement('span');
    icon.className = 'tree-row__icon';
    icon.textContent = entry.isDir ? '📁' : entry.isTypst ? '📄' : '·';
    row.append(icon);

    const label = document.createElement('span');
    label.className = 'tree-row__name';
    label.textContent = entry.name;
    row.append(label);
    applyEntrypointBadge(row);

    wrapper.append(row);
    const record = { entry, row };
    rows.set(norm(entry.path), record);

    /** Acción principal de la fila: abrir la carpeta o el fichero. */
    let primary = () => {};

    if (entry.isDir) {
      const children = document.createElement('div');
      children.className = 'tree-children hidden';
      wrapper.append(children);

      const setExpanded = async (open) => {
        const isOpen = !children.classList.contains('hidden');
        if (open === isOpen) return;
        toggle.classList.toggle('is-expanded', open);
        children.classList.toggle('hidden', !open);
        if (open) expanded.add(norm(entry.path));
        else expanded.delete(norm(entry.path));
        if (open && !children.dataset.loaded) {
          children.dataset.loaded = '1';
          await renderLevel(children, entry.path, depth + 1);
        }
      };
      record.expand = setExpanded;
      primary = () => setExpanded(children.classList.contains('hidden'));
      if (expanded.has(norm(entry.path))) {
        // Se abre tras un refresco; `renderLevel` la espera (ver más abajo).
        record.reopen = () => setExpanded(true);
      }
    } else if (entry.isEditable) {
      primary = () => onOpenFile?.(entry.path);
    }

    row.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey) {
        toggleSelected(entry.path);
        return;
      }
      if (event.shiftKey && anchor) {
        selectRange(entry.path);
        return;
      }
      selectOnly(entry.path);
      primary();
    });
    row.addEventListener('keydown', (event) => {
      if (event.target !== row) return;
      if (event.key === 'Enter' || (entry.isDir && event.key === ' ')) {
        event.preventDefault();
        selectOnly(entry.path);
        primary();
      } else if (event.key === 'F2') {
        event.preventDefault();
        startRename(entry.path);
      } else if (event.key === 'Delete') {
        event.preventDefault();
        onAction?.('delete', contextFor(entry));
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        moveFocus(row, event.key === 'ArrowDown' ? 1 : -1);
      }
    });
    row.addEventListener('pointerdown', (event) => beginDrag(event, entry));
    row.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      openContextMenu(event, entry);
    });

    return wrapper;
  }

  /**
   * Pinta un nivel del árbol. `depth === 0` es la raíz. Las carpetas que
   * estaban abiertas antes de un refresco se vuelven a abrir aquí.
   * @returns {Promise<boolean>} ¿había algo que listar?
   */
  async function renderLevel(hostEl, dirPath, depth) {
    const currentGeneration = generation;
    const result = await listDirectory(dirPath);

    if (currentGeneration !== generation) return false; // superado por otra raíz
    if (!result.ok) {
      if (depth === 0) showMessage('tree.error');
      return false;
    }

    const entries = result.value;
    if (depth === 0 && entries.length === 0) {
      showMessage('tree.empty');
      return true;
    }

    const fragment = document.createDocumentFragment();
    const reopen = [];
    for (const entry of entries) {
      if (!entry.isDir && entry.isEditable) knownFiles.push(entry);
      const wrapper = buildRow(entry, depth);
      renderedEntries.push({ wrapper, entry });
      // Cada fila se clasifica al crearse (encontrado en /code-simplify): el
      // estado de las filas ya pintadas no cambia por cargar un nivel más, así
      // que no hace falta un `applyHiddenFilter()` completo aquí — evita un
      // repaso O(n) de todo lo ya pintado por cada carpeta que se expande.
      wrapper.classList.toggle('tree-item--dotfile-hidden', isHiddenByDotfileFilter(entry));
      fragment.append(wrapper);
      const record = rows.get(norm(entry.path));
      if (record?.reopen) reopen.push(record.reopen);
    }
    hostEl.append(fragment);
    await Promise.all(reopen.map((open) => open()));
    return true;
  }

  /** Reconstruye el árbol con `dirPath` como raíz. No-op si ya lo era. */
  async function setRoot(dirPath, { force = false } = {}) {
    if (!dirPath) return false;
    if (dirPath === root && !force) return true;
    if (!sameFile(dirPath, root)) {
      expanded.clear();
      selection.clear();
      anchor = null;
    }
    root = dirPath;
    const scrollTop = containerEl.scrollTop;
    reset();
    const ok = await renderLevel(containerEl, dirPath, 0);
    // Lo que ya no existe deja de estar seleccionado.
    for (const key of [...selection]) if (!rows.has(key)) selection.delete(key);
    containerEl.scrollTop = scrollTop;
    return ok;
  }

  async function runRefresh() {
    refreshTimer = null;
    const waiters = refreshWaiters.splice(0);
    const ok = root ? await setRoot(root, { force: true }) : false;
    for (const resolve of waiters) resolve(ok);
  }

  function flushPendingRefresh() {
    if (!refreshAfterEdit) return;
    refreshAfterEdit = false;
    refresh();
  }

  /**
   * Vuelve a leer el árbol desde disco conservando la raíz, las carpetas
   * abiertas y la selección. Las llamadas seguidas se agrupan en una (R-F3), y
   * si hay una fila editándose se espera a que termine para no borrarla.
   */
  function refresh() {
    if (!root) return Promise.resolve(false);
    if (editing) {
      refreshAfterEdit = true;
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      refreshWaiters.push(resolve);
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(runRefresh, REFRESH_COALESCE_MS);
    });
  }

  /** Filtro de texto sobre los nodos ya cargados. */
  function filter(query) {
    const needle = query.trim().toLowerCase();
    for (const row of containerEl.querySelectorAll('.tree-row[data-name]')) {
      const matches = !needle || row.dataset.name.toLowerCase().includes(needle);
      row.classList.toggle('tree-row--hidden', !matches);
    }
  }

  showMessage('tree.noProject');

  return {
    setRoot,
    refresh,
    filter,
    setActivePath,
    setEntrypointPath,
    startCreate,
    startRename,
    revealPath,
    getTargetDir,
    /** Entradas seleccionadas, en orden de pantalla. */
    getSelection: selectedEntries,
    /** Ficheros abribles conocidos, para el selector rápido de documento. */
    getKnownFiles: () => knownFiles.slice(),
    getRoot: () => root,
    /** Entrada ya pintada bajo el punto de pantalla (para soltar ficheros del sistema, RF-69.6). */
    entryAtPoint(clientX, clientY) {
      const row = rowUnderPointer({ clientX, clientY });
      return row ? findRow(row.dataset.path)?.entry ?? null : null;
    },
    /** True si el punto de pantalla cae dentro del árbol. */
    containsPoint(clientX, clientY) {
      const hit = document.elementFromPoint?.(clientX, clientY);
      return Boolean(hit && containerEl.contains(hit));
    },
  };
}
