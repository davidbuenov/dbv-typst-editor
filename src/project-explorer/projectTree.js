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
import { getPref, onPrefsChanged } from '../app/prefs.js';

/**
 * @typedef {object} TreeEntry
 * @property {string} name
 * @property {string} path
 * @property {boolean} isDir
 * @property {boolean} isTypst
 * @property {boolean} isEditable
 */

/** Compara rutas sin depender del separador de la plataforma. */
const sameFile = (a, b) => Boolean(a && b) && a.replaceAll('\\', '/') === b.replaceAll('\\', '/');

/** True si `filePath` cuelga de la carpeta `dirPath` (a cualquier profundidad). */
function isAncestorOf(dirPath, filePath) {
  if (!dirPath || !filePath) return false;
  const dir = dirPath.replaceAll('\\', '/').replace(/\/+$/, '');
  const file = filePath.replaceAll('\\', '/');
  return file.startsWith(`${dir}/`);
}

/** True si `name` es un dotfile (`.git`, `.gitignore`, `.claude`…). */
const isDotEntry = (name) => name.startsWith('.');

export function createProjectTree(containerEl, { onOpenFile, onSetEntrypoint } = {}) {
  if (!(containerEl instanceof HTMLElement)) {
    throw new TypeError('createProjectTree: containerEl debe ser un HTMLElement');
  }

  let root = null;
  let generation = 0;
  /** @type {TreeEntry[]} Ficheros abribles ya conocidos (niveles cargados). */
  const knownFiles = [];
  /** @type {Array<{wrapper: HTMLElement, entry: TreeEntry}>} Toda fila pintada, para poder re-evaluar el filtro de ocultos sin repintar el árbol (RF-63.1). */
  const renderedEntries = [];
  let activePath = null;
  /** Ruta ABSOLUTA del documento principal del proyecto, para marcarlo. */
  let entrypointPath = null;
  let openMenuEl = null;

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

  function closeContextMenu() {
    openMenuEl?.remove();
    openMenuEl = null;
  }

  /**
   * Menú contextual de una fila. "Establecer como documento principal" solo
   * aparece en ficheros `.typ` (el resto no pueden ser raíz de compilación) y
   * no se ofrece si ya lo es. "Mostrar en el explorador" es lo que hacía el
   * botón derecho antes de existir este menú, y se conserva.
   */
  function openContextMenu(event, entry) {
    closeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'tree-context-menu';
    menu.setAttribute('role', 'menu');

    const addItem = (label, action) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item';
      item.setAttribute('role', 'menuitem');
      item.textContent = label;
      item.addEventListener('click', () => {
        closeContextMenu();
        action();
      });
      menu.append(item);
    };

    if (entry.isTypst && !entry.isDir && !sameFile(entry.path, entrypointPath) && onSetEntrypoint) {
      addItem(t('action.setEntrypoint'), () => onSetEntrypoint(entry.path));
    }
    // RF-60.6: un fichero que la aplicación no reconoce como texto se puede abrir
    // igualmente como texto plano; las guardas de lectura rechazan lo binario.
    if (!entry.isDir && !entry.isEditable && onOpenFile) {
      addItem(t('action.openAsText'), () => onOpenFile(entry.path));
    }
    addItem(t('action.reveal'), () => revealInFileManager(entry.path));

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
    applyEntrypointBadge(row);

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
      openContextMenu(event, entry);
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
      const wrapper = buildRow(entry, depth);
      renderedEntries.push({ wrapper, entry });
      // Cada fila se clasifica al crearse (encontrado en /code-simplify): el
      // estado de las filas ya pintadas no cambia por cargar un nivel más, así
      // que no hace falta un `applyHiddenFilter()` completo aquí — evita un
      // repaso O(n) de todo lo ya pintado por cada carpeta que se expande.
      wrapper.classList.toggle('tree-item--dotfile-hidden', isHiddenByDotfileFilter(entry));
      fragment.append(wrapper);
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
    setEntrypointPath,
    /** Ficheros abribles conocidos, para el selector rápido de documento. */
    getKnownFiles: () => knownFiles.slice(),
    getRoot: () => root,
  };
}
