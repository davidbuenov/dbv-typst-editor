// =============================================================================
// DBV Typst Editor — Diálogo de dimensiones de tabla (Beta, ARCHITECTURE.md §7.7.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El botón "Tabla" de la barra siempre genera un 2×2 fijo (RF-13). Este
// diálogo es el asistente que pide filas, columnas y si lleva cabecera antes
// de generarla — la lógica real vive en `toolbarActions.tableAction()`, aquí
// solo se recogen los tres valores y se aplica la transacción resultante.

import { registerPanel } from '../panels/registerPanel.js';
import { tableAction } from './toolbarActions.js';

const MIN_DIMENSION = 1;
const MAX_DIMENSION = 20;

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl
 * @param {HTMLInputElement} deps.rowsEl
 * @param {HTMLInputElement} deps.colsEl
 * @param {HTMLInputElement} deps.headerEl Checkbox.
 * @param {HTMLButtonElement} deps.insertButtonEl
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 */
export function createTableDialog({ panelEl, rowsEl, colsEl, headerEl, insertButtonEl, getView }) {
  function clampDimension(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return MIN_DIMENSION;
    return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, parsed));
  }

  function insert() {
    const view = getView();
    if (!view) return;

    const rows = clampDimension(rowsEl.value);
    const cols = clampDimension(colsEl.value);
    const spec = tableAction({ rows, cols, header: headerEl.checked })(view.state);
    view.dispatch(spec);
    view.focus();
    panel.close();
  }

  const panel = registerPanel(panelEl, {
    closeOnOutsideClick: true,
    onOpen: () => {
      rowsEl.value = '2';
      colsEl.value = '2';
      headerEl.checked = false;
      rowsEl.focus();
    },
  });

  insertButtonEl.addEventListener('click', insert);

  return {
    /** Abre el diálogo justo debajo del botón que lo disparó. */
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
