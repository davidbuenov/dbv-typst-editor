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

import { t } from '../i18n/i18n.js';
import { listDirectory, revealInFileManager } from '../services/backend.js';

/**
 * @typedef {object} TreeEntry
 * @property {string} name
 * @property {string} path
 * @property {boolean} isDir
 * @property {boolean} isTypst
 * @property {boolean} isEditable
 */

export function createProjectTree(containerEl, { onOpenFile }) {
  if (!(containerEl instanceof HTMLElement)) {
    throw new TypeError('createProjectTree: containerEl debe ser un HTMLElement');
  }

  let root = null;
  let generation = 0;
  /** @type {TreeEntry[]} Ficheros abribles ya conocidos (niveles cargados). */
  const knownFiles = [];
  let activePath = null;

  function reset() {
    generation += 1;
    containerEl.innerHTML = '';
    knownFiles.length = 0;
  }

  function showMessage(key) {
    const message = document.createElement('p');
    message.className = 'tree__message';
    message.textContent = t(key);
    containerEl.replaceChildren(message);
  }

  /** Marca visualmente qué fichero está abierto en el editor. */
  function setActivePath(path) {
    activePath = path;
    for (const row of containerEl.querySelectorAll('.tree-row')) {
      row.classList.toggle('is-active', row.dataset.path === path);
    }
  }

  function buildRow(entry, depth) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tree-item';

    const row = document.createElement('div');
    row.className = 'tree-row';
    row.classList.add(entry.isDir ? 'is-dir' : entry.isEditable ? 'is-file' : 'is-dimmed');
    row.classList.toggle('is-active', entry.path === activePath);
    row.style.paddingLeft = `${8 + depth * 14}px`;
    row.dataset.name = entry.name;
    row.dataset.path = entry.path;
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

    wrapper.append(row);

    if (entry.isDir) {
      const children = document.createElement('div');
      children.className = 'tree-children hidden';
      wrapper.append(children);

      let expanded = false;
      const toggleFolder = () => {
        expanded = !expanded;
        toggle.classList.toggle('is-expanded', expanded);
        children.classList.toggle('hidden', !expanded);
        if (expanded && !children.dataset.loaded) {
          children.dataset.loaded = '1';
          renderLevel(children, entry.path, depth + 1);
        }
      };
      row.addEventListener('click', toggleFolder);
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleFolder();
        }
      });
    } else if (entry.isEditable) {
      const open = () => onOpenFile(entry.path);
      row.addEventListener('click', open);
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') open();
      });
    }

    row.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      revealInFileManager(entry.path);
    });

    return wrapper;
  }

  /**
   * Pinta un nivel del árbol. `depth === 0` es la raíz.
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
    for (const entry of entries) {
      if (!entry.isDir && entry.isEditable) knownFiles.push(entry);
      fragment.append(buildRow(entry, depth));
    }
    hostEl.append(fragment);
    return true;
  }

  /** Reconstruye el árbol con `dirPath` como raíz. No-op si ya lo era. */
  async function setRoot(dirPath, { force = false } = {}) {
    if (!dirPath) return false;
    if (dirPath === root && !force) return true;
    root = dirPath;
    reset();
    return renderLevel(containerEl, dirPath, 0);
  }

  /** Vuelve a leer el árbol desde disco conservando la raíz actual. */
  async function refresh() {
    if (!root) return false;
    return setRoot(root, { force: true });
  }

  /** Filtro de texto sobre los nodos ya cargados. */
  function filter(query) {
    const needle = query.trim().toLowerCase();
    for (const row of containerEl.querySelectorAll('.tree-row')) {
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
    /** Ficheros abribles conocidos, para el selector rápido de documento. */
    getKnownFiles: () => knownFiles.slice(),
    getRoot: () => root,
  };
}
