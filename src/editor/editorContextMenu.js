// =============================================================================
// DBV Typst Editor — Menú contextual del editor (RF-58)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Botón derecho (o Mayús+F10 / tecla de menú) sobre el editor: la acción propia
// "Ir a la vista previa" y las de portapapeles de siempre. Reutiliza el aspecto
// del menú contextual del árbol (`.tree-context-menu` / `.menu-item`).
//
// `buildMenuItems` es pura y se prueba sin DOM; `createEditorContextMenu` la
// dibuja y la conecta. Cortar/Copiar/Pegar usan la API del portapapeles del
// navegador y, si el sistema la deniega, se avisa en vez de fallar en silencio.

/** Atajo de "Ir a la vista previa" (Ctrl/Cmd + Alt + P). */
export function isGoToPreviewShortcut(event) {
  return Boolean((event.ctrlKey || event.metaKey) && event.altKey && !event.shiftKey && event.code === 'KeyP');
}

/**
 * Entradas del menú según el contexto.
 *
 * @param {{hasSelection: boolean, canGoToPreview: boolean, readOnly?: boolean, canShowHistory?: boolean}} context
 * @returns {{id: string, enabled: boolean, separatorAfter?: boolean}[]}
 */
export function buildMenuItems({ hasSelection, canGoToPreview, readOnly = false, canShowHistory = false }) {
  const items = [
    { id: 'goToPreview', enabled: canGoToPreview, separatorAfter: true },
    { id: 'cut', enabled: hasSelection && !readOnly },
    { id: 'copy', enabled: hasSelection },
    { id: 'paste', enabled: !readOnly },
    { id: 'selectAll', enabled: true, separatorAfter: canShowHistory },
  ];
  // RF-73: el historial local del fichero que se está editando.
  if (canShowHistory) items.push({ id: 'history', enabled: true });
  return items;
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.hostEl Contenedor del editor.
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 * @param {() => boolean} deps.canGoToPreview ¿Hay documento Typst con vista previa a la que ir?
 * @param {() => void | Promise<void>} deps.onGoToPreview
 * @param {(message: string) => void} deps.notify
 * @param {(key: string) => string} deps.t
 * @param {() => boolean} [deps.canShowHistory]
 * @param {() => void} [deps.onShowHistory]
 */
export function createEditorContextMenu({ hostEl, getView, canGoToPreview, onGoToPreview, notify, t, canShowHistory, onShowHistory }) {
  let menuEl = null;

  function close() {
    menuEl?.remove();
    menuEl = null;
  }

  async function run(id, view) {
    const { from, to } = view.state.selection.main;
    try {
      if (id === 'goToPreview') {
        await onGoToPreview();
      } else if (id === 'history') {
        onShowHistory?.();
        return;
      } else if (id === 'copy') {
        await navigator.clipboard.writeText(view.state.sliceDoc(from, to));
      } else if (id === 'cut') {
        await navigator.clipboard.writeText(view.state.sliceDoc(from, to));
        view.dispatch({ changes: { from, to, insert: '' }, userEvent: 'delete.cut' });
      } else if (id === 'paste') {
        const text = await navigator.clipboard.readText();
        view.dispatch(view.state.replaceSelection(text), { userEvent: 'input.paste', scrollIntoView: true });
      } else if (id === 'selectAll') {
        view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
      }
    } catch {
      notify(t('editorMenu.clipboardDenied'));
    }
    view.focus();
  }

  function open(x, y) {
    const view = getView();
    if (!view) return;
    close();

    const items = buildMenuItems({
      hasSelection: !view.state.selection.main.empty,
      canGoToPreview: canGoToPreview(),
      readOnly: view.state.readOnly,
      canShowHistory: Boolean(canShowHistory?.()),
    });
    const menu = document.createElement('div');
    menu.className = 'tree-context-menu editor-context-menu';
    menu.setAttribute('role', 'menu');

    for (const entry of items) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item';
      item.setAttribute('role', 'menuitem');
      item.dataset.action = entry.id;
      item.disabled = !entry.enabled;
      item.textContent = t(`editorMenu.${entry.id}`);
      item.addEventListener('click', () => {
        close();
        run(entry.id, view);
      });
      menu.append(item);
      if (entry.separatorAfter) {
        const rule = document.createElement('div');
        rule.className = 'menu-separator';
        rule.setAttribute('role', 'separator');
        menu.append(rule);
      }
    }

    document.body.append(menu);
    const { width, height } = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - width - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - height - 4))}px`;
    menuEl = menu;
    menu.querySelector('.menu-item:not(:disabled)')?.focus();
  }

  hostEl.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    open(event.clientX, event.clientY);
  });

  hostEl.addEventListener('keydown', (event) => {
    if (isGoToPreviewShortcut(event)) {
      event.preventDefault();
      if (canGoToPreview()) onGoToPreview();
      return;
    }
    const menuKey = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10');
    if (!menuKey) return;
    event.preventDefault();
    const view = getView();
    if (!view) return;
    // Anclado al cursor, no al puntero: es la vía de quien no usa ratón.
    let caret = null;
    try {
      caret = view.coordsAtPos(view.state.selection.main.head);
    } catch {
      // Sin geometría (editor aún no medido): el menú sale en la esquina.
    }
    open(caret?.left ?? 8, (caret?.bottom ?? 8) + 2);
  });

  document.addEventListener('mousedown', (event) => {
    if (menuEl && !menuEl.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  return { open, close, isOpen: () => menuEl !== null };
}
