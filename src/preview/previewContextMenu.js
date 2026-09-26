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
 * @param {(clientX: number, clientY: number) => Promise<{url?: string | null} | null>} [deps.getLinkAt]
 *   Enlace bajo el punto (RF-72): si es externo, se ofrece copiar su dirección.
 */
export function createPreviewContextMenu({ hostEl, onGoToSource, t, getLinkAt }) {
  let menuEl = null;

  function close() {
    menuEl?.remove();
    menuEl = null;
  }

  hostEl.addEventListener('contextmenu', async (event) => {
    event.preventDefault();
    close();
    const { clientX, clientY } = event;
    const link = getLinkAt ? await getLinkAt(clientX, clientY) : null;

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

    if (link?.url) {
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'menu-item';
      copy.setAttribute('role', 'menuitem');
      copy.dataset.action = 'copyLink';
      copy.textContent = t('previewMenu.copyLink');
      copy.addEventListener('click', () => {
        close();
        navigator.clipboard?.writeText(link.url).catch(() => {});
      });
      menu.append(copy);
    }

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
