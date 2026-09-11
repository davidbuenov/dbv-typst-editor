// =============================================================================
// DBV Typst Editor — Desplegable de citas (Beta, ARCHITECTURE.md §7.7.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Asistente "Insertar cita con autocompletado sobre las claves reales del
// .bib del proyecto" — el botón "Cite" de la barra (RF-13) ya no inserta un
// marcador genérico: abre este desplegable, filtrable, con las claves reales.
//
// Desde RF-17 la mecánica del desplegable (cargar, filtrar, elegir, salida de
// escape) vive en `filterablePicker.js`, compartida con el de imágenes. Aquí
// queda solo lo propio de citar: de dónde salen las entradas y qué se inserta.
//
// RF-35 (v0.6.0): la etiqueta deja de ser solo la clave y pasa a mostrar el
// campo completo (título, autor, año) — `bibliography_entries`, parseado con
// `hayagriva`, en vez del escaneo ligero de `bibliography_keys` (que sigue
// existiendo para quien solo necesita las claves, p. ej. el explorador de
// paquetes). Una entrada duplicada o sin título/autor lleva un aviso ⚠ en la
// propia etiqueta — visible, sin bloquear la inserción (RF-35.3).

import { getBibliographyEntries } from '../services/backend.js';
import { createFilterablePicker } from './filterablePicker.js';

/**
 * Etiqueta visible del desplegable para una entrada de `bibliography_entries`.
 * @param {{key: string, title: string|null, authors: string[], year: number|null, duplicate: boolean, missingRequired: boolean}} entry
 */
export function labelForEntry(entry) {
  const authorPart = entry.authors[0] ? entry.authors[0].split(',')[0] : null;
  const yearPart = entry.year ?? null;
  const detail = [entry.title, authorPart && yearPart ? `${authorPart}, ${yearPart}` : authorPart || yearPart]
    .filter(Boolean)
    .join(' — ');
  const warning = entry.duplicate || entry.missingRequired ? '⚠ ' : '';
  return detail ? `${warning}${entry.key} — ${detail}` : `${warning}${entry.key}`;
}

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
  function insertCitation(entry) {
    const view = getView();
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const text = `#cite(<${entry.key}>)`;
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
      const result = await getBibliographyEntries(root);
      return result.ok ? result.value : [];
    },
    onPick: insertCitation,
    labelOf: labelForEntry,
    emptyKey: 'citation.empty',
    noMatchesKey: 'citation.noMatches',
  });
}
