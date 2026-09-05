// =============================================================================
// DBV Typst Editor — Desplegable de citas (Beta, ARCHITECTURE.md §7.7.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Asistente "Insertar cita con autocompletado sobre las claves reales del
// .bib del proyecto" — el botón "Cite" de la barra (RF-13) ya no inserta un
// marcador genérico: abre este desplegable, filtrable, con las claves reales
// (`bibliography.rs`, escaneo ligero, sin parser BibTeX completo).

import { t } from '../i18n/i18n.js';
import { registerPanel } from '../panels/registerPanel.js';
import { getBibliographyKeys } from '../services/backend.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl
 * @param {HTMLElement} deps.listEl
 * @param {HTMLInputElement} deps.filterEl
 * @param {HTMLButtonElement} [deps.newEntryButtonEl] "No encuentro la fuente
 *   que busco" (Beta, §7.11): abre el asistente para crear la entrada en
 *   `refs.bib` sin salir del flujo de citar.
 * @param {() => void} [deps.onCreateNew]
 * @param {() => string | null} deps.getRoot Raíz del proyecto activo, o `null`.
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 */
export function createCitationPicker({ panelEl, listEl, filterEl, newEntryButtonEl, onCreateNew, getRoot, getView }) {
  /** @type {string[]} Claves de la última carga; se re-filtran sin recargar. */
  let keys = [];

  function insertCitation(key) {
    const view = getView();
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const text = `#cite(<${key}>)`;
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    view.focus();
  }

  function renderList() {
    const query = filterEl.value.trim().toLowerCase();
    const filtered = query ? keys.filter((key) => key.toLowerCase().includes(query)) : keys;

    listEl.replaceChildren();
    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'citation-picker__empty';
      empty.textContent = t(keys.length === 0 ? 'citation.empty' : 'citation.noMatches');
      listEl.append(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const key of filtered) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'citation-picker__item';
      item.textContent = key;
      item.addEventListener('click', () => {
        insertCitation(key);
        panel.close();
      });
      fragment.append(item);
    }
    listEl.append(fragment);
  }

  const panel = registerPanel(panelEl, {
    closeOnOutsideClick: true,
    onOpen: async () => {
      filterEl.value = '';
      const root = getRoot();
      if (!root) {
        keys = [];
        renderList();
        return;
      }
      // Recarga en cada apertura: si el usuario acaba de añadir una entrada al
      // .bib, la quiere ver sin tener que cerrar y reabrir la aplicación.
      const result = await getBibliographyKeys(root);
      keys = result.ok ? result.value.keys : [];
      renderList();
      filterEl.focus();
    },
  });

  filterEl.addEventListener('input', renderList);

  newEntryButtonEl?.addEventListener('click', () => {
    panel.close();
    onCreateNew?.();
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
