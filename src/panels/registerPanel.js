// =============================================================================
// DBV Typst Editor — Factoría de paneles flotantes y modales
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Portado de dbv-md-reader/src/app.js:1058-1088 (ARCHITECTURE.md §3 fila 13),
// adaptado de IIFE + `var` a módulo ESM. La semántica es la misma: un único
// mecanismo de apertura/cierre para TODO panel flotante o modal de la app.

/** @type {Array<() => void>} Cierres registrados, para "cerrar todo" (p. ej. Escape). */
const panelClosers = [];

/**
 * Registra un panel y devuelve sus controles de apertura/cierre.
 *
 * @param {HTMLElement} panelEl Elemento del panel (usa la clase `hidden`).
 * @param {object} [opts]
 * @param {HTMLElement|HTMLElement[]} [opts.trigger] Botón(es) que lo abren.
 * @param {boolean} [opts.toggle] El trigger alterna abrir/cerrar.
 * @param {boolean} [opts.closeOnOutsideClick] Cierra al hacer clic fuera.
 * @param {() => void} [opts.onOpen] Efecto al abrir (foco, carga de datos...).
 * @param {() => void} [opts.onClose] Efecto al cerrar.
 * @returns {{ open: () => void, close: () => void }}
 */
export function registerPanel(panelEl, opts = {}) {
  if (!(panelEl instanceof HTMLElement)) {
    throw new TypeError('registerPanel: panelEl debe ser un HTMLElement');
  }

  const triggers = opts.trigger ? [].concat(opts.trigger) : [];

  const close = () => {
    panelEl.classList.add('hidden');
    opts.onClose?.();
  };

  const open = () => {
    panelEl.classList.remove('hidden');
    opts.onOpen?.();
  };

  for (const trigger of triggers) {
    trigger.addEventListener('click', (event) => {
      if (!opts.toggle) {
        open();
        return;
      }
      // Con toggle hay que frenar la propagación: si no, el mismo clic que abre
      // el panel llega al listener de "clic fuera" y lo vuelve a cerrar.
      event.stopPropagation();
      if (panelEl.classList.contains('hidden')) open();
      else close();
    });
  }

  if (opts.closeOnOutsideClick) {
    document.addEventListener('click', (event) => {
      const isOpen = !panelEl.classList.contains('hidden');
      const clickedInside = panelEl.contains(event.target);
      const clickedTrigger = triggers.includes(event.target);
      if (isOpen && !clickedInside && !clickedTrigger) close();
    });
  }

  panelClosers.push(close);
  return { open, close };
}

/** Cierra todos los paneles registrados (p. ej. al pulsar Escape). */
export function closeAllPanels() {
  for (const close of panelClosers) close();
}
