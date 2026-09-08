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
//
// Desde RF-17 la mecánica del desplegable (cargar, filtrar, elegir, salida de
// escape) vive en `filterablePicker.js`, compartida con el de imágenes. Aquí
// queda solo lo propio de citar: de dónde salen las claves y qué se inserta.

import { getBibliographyKeys } from '../services/backend.js';
import { createFilterablePicker } from './filterablePicker.js';

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
  function insertCitation(key) {
    const view = getView();
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const text = `#cite(<${key}>)`;
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    view.focus();
  }

  return createFilterablePicker({
    panelEl,
    listEl,
    filterEl,
    actionButtonEl: newEntryButtonEl,
    onAction: onCreateNew,
    load: async () => {
      const root = getRoot();
      if (!root) return [];
      const result = await getBibliographyKeys(root);
      return result.ok ? result.value.keys : [];
    },
    onPick: insertCitation,
    labelOf: (key) => key,
    emptyKey: 'citation.empty',
    noMatchesKey: 'citation.noMatches',
  });
}
