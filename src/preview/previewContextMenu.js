// =============================================================================
// DBV Typst Editor — Menú contextual de la vista previa (RF-58)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Botón derecho sobre la página: "Ir al código aquí", que hace lo mismo que el
// doble clic. Existe para quien no sabe del doble clic, y por eso la entrada lo
// dice ("doble clic") como atajo. El punto se toma de donde se pulsó el botón
// derecho, no de donde esté el ratón cuando se elige la entrada.

/**
 * @param {object} deps
 * @param {HTMLElement} deps.hostEl Contenedor de las páginas.
 * @param {(clientX: number, clientY: number) => void | Promise<void>} deps.onGoToSource
 * @param {(key: string) => string} deps.t
 */
export function createPreviewContextMenu({ hostEl, onGoToSource, t }) {
  let menuEl = null;

  function close() {
    menuEl?.remove();
    menuEl = null;
  }

  hostEl.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    close();
    const { clientX, clientY } = event;

    const menu = document.createElement('div');
    menu.className = 'tree-context-menu preview-context-menu';
    menu.setAttribute('role', 'menu');

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'menu-item';
    item.setAttribute('role', 'menuitem');
    item.dataset.action = 'goToSource';
    const label = document.createElement('span');
    label.textContent = t('previewMenu.goToSource');
    const hint = document.createElement('span');
    hint.className = 'menu-item__hint';
    hint.textContent = t('previewMenu.doubleClick');
    item.append(label, hint);
    item.addEventListener('click', () => {
      close();
      onGoToSource(clientX, clientY);
    });
    menu.append(item);

    document.body.append(menu);
    const { width, height } = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(clientX, window.innerWidth - width - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(clientY, window.innerHeight - height - 4))}px`;
    menuEl = menu;
    item.focus();
  });

  document.addEventListener('mousedown', (event) => {
    if (menuEl && !menuEl.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  hostEl.addEventListener('scroll', close);

  return { close, isOpen: () => menuEl !== null };
}
