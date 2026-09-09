// =============================================================================
// DBV Typst Editor — Asistente de Diagramas CeTZ (RF-23)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Facilita la creación e inserción de diagramas de flujo, diagramas de bloques,
// gráficas de funciones 2D y lienzos básicos vectoriales con CeTZ sin necesidad
// de memorizar la sintaxis de macros y garantizando que el paquete esté importado.

import { registerPanel } from '../panels/registerPanel.js';
import { cetzAction } from './toolbarActions.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 */
export function createCetzAssistant({ panelEl, getView }) {
  function selectType(type) {
    const view = getView();
    if (!view) return;

    const spec = cetzAction(type)(view.state);
    view.dispatch(spec);
    view.focus();
    panel.close();
  }

  const panel = registerPanel(panelEl, {
    closeOnOutsideClick: true,
  });

  panelEl.querySelectorAll('[data-cetz-type]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.cetzType;
      selectType(type);
    });
  });

  return {
    /** Abre el asistente cerca del botón disparador de la barra. */
    openNear(triggerEl) {
      const rect = triggerEl.getBoundingClientRect();
      panelEl.style.top = `${rect.bottom + 6}px`;
      panelEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 340, rect.left))}px`;
      panelEl.style.right = 'auto';
      panel.open();
    },
    close: panel.close,
  };
}
