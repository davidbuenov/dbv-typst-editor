// =============================================================================
// DBV Typst Editor — Desplegable filtrable reutilizable (Beta, §7.7.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Extraído de `citationPicker.js` al añadir el desplegable de imágenes (RF-17):
// los dos asistentes son el mismo componente con datos distintos —una lista que
// se carga al abrir, un filtro por texto, y un botón final de escape para el
// caso "lo que busco no está aquí"—. La especificación de RF-17 pide
// explícitamente reutilizar el modelo del de citas, no duplicarlo.

import { t } from '../i18n/i18n.js';
import { registerPanel } from '../panels/registerPanel.js';

/**
 * @template T
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl Panel flotante que contiene el desplegable.
 * @param {HTMLElement} deps.listEl Contenedor de la lista de resultados.
 * @param {HTMLInputElement} deps.filterEl Campo de filtro por texto.
 * @param {HTMLButtonElement} [deps.actionButtonEl] Salida de escape del final
 *   ("No encuentro la fuente que busco", "Buscar una imagen…").
 * @param {() => void} [deps.onAction] Qué hace esa salida de escape.
 * @param {() => Promise<T[]>} deps.load Carga los elementos al abrir el panel.
 * @param {(item: T) => void} deps.onPick Qué hacer con el elegido.
 * @param {(item: T) => string} deps.labelOf Texto visible, y por el que filtra.
 * @param {string} deps.emptyKey Clave i18n para "no hay nada que ofrecer".
 * @param {string} deps.noMatchesKey Clave i18n para "el filtro no encuentra nada".
 */
export function createFilterablePicker({
  panelEl,
  listEl,
  filterEl,
  actionButtonEl,
  onAction,
  load,
  onPick,
  labelOf,
  emptyKey,
  noMatchesKey,
}) {
  /** @type {T[]} Elementos de la última carga; se re-filtran sin recargar. */
  let items = [];

  function renderList() {
    const query = filterEl.value.trim().toLowerCase();
    const filtered = query
      ? items.filter((item) => labelOf(item).toLowerCase().includes(query))
      : items;

    listEl.replaceChildren();
    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'picker__empty';
      empty.textContent = t(items.length === 0 ? emptyKey : noMatchesKey);
      listEl.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const item of filtered) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'picker__item';
      button.textContent = labelOf(item);
      button.addEventListener('click', () => {
        onPick(item);
        panel.close();
      });
      fragment.append(button);
    }
    listEl.append(fragment);
  }

  const panel = registerPanel(panelEl, {
    closeOnOutsideClick: true,
    onOpen: async () => {
      filterEl.value = '';
      // Recarga en cada apertura: si el usuario acaba de añadir una entrada al
      // `.bib` o de arrastrar una imagen, la quiere ver sin reabrir la app.
      items = await load();
      renderList();
      filterEl.focus();
    },
  });

  filterEl.addEventListener('input', renderList);

  actionButtonEl?.addEventListener('click', () => {
    panel.close();
    onAction?.();
  });

  return {
    /** Abre el desplegable justo debajo del botón que lo disparó. */
    openNear(triggerEl) {
      const rect = triggerEl.getBoundingClientRect();
      panelEl.style.top = `${rect.bottom + 6}px`;
      panelEl.style.left = `${rect.left}px`;
      panelEl.style.right = 'auto';
      panel.open();
    },
    close: panel.close,
  };
}
