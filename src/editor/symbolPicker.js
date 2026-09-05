// =============================================================================
// DBV Typst Editor — Galería de símbolos (Beta, ARCHITECTURE.md §7.7.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// "El hueco más visible de una barra plana para escritura matemática" — el
// botón "Σ" de la barra abre esta galería en vez de insertar un único símbolo
// fijo. Mismo patrón de panel que `citationPicker.js`: posición dinámica bajo
// el botón, filtro de texto, degradación limpia si no hay coincidencias.

import { registerPanel } from '../panels/registerPanel.js';
import { insertSymbolAction } from './toolbarActions.js';
import { SYMBOL_GALLERY } from './symbolGallery.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl
 * @param {HTMLElement} deps.gridEl
 * @param {HTMLInputElement} deps.filterEl
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 */
export function createSymbolPicker({ panelEl, gridEl, filterEl, getView }) {
  function matches(symbol, query) {
    if (!query) return true;
    if (symbol.name.toLowerCase().includes(query)) return true;
    return symbol.keywords.some((keyword) => keyword.toLowerCase().includes(query));
  }

  function insert(symbolName) {
    const view = getView();
    if (!view) return;
    view.dispatch(insertSymbolAction(symbolName)(view.state));
    view.focus();
  }

  function renderGrid() {
    const query = filterEl.value.trim().toLowerCase();
    const filtered = SYMBOL_GALLERY.filter((symbol) => matches(symbol, query));

    gridEl.replaceChildren();
    const fragment = document.createDocumentFragment();
    for (const symbol of filtered) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'symbol-picker__item';
      button.textContent = symbol.glyph;
      button.title = symbol.name;
      button.addEventListener('click', () => {
        insert(symbol.name);
        panel.close();
      });
      fragment.append(button);
    }
    gridEl.append(fragment);
  }

  const panel = registerPanel(panelEl, {
    closeOnOutsideClick: true,
    onOpen: () => {
      filterEl.value = '';
      renderGrid();
      filterEl.focus();
    },
  });

  filterEl.addEventListener('input', renderGrid);

  return {
    /** Abre la galería justo debajo del botón que la disparó. */
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
