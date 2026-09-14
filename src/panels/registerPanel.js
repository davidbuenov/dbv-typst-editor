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

import { t } from '../i18n/i18n.js';
import { makeDraggable } from './draggablePanel.js';

/** @type {Array<() => void>} Cierres registrados, para "cerrar todo" (p. ej. Escape). */
const panelClosers = [];

/**
 * Cabeceras que ya existían en el HTML antes de que esto fuera automático.
 * Cada panel las traía con su propio nombre de clase porque se fueron
 * añadiendo una a una; se reconocen todas para no duplicar cabecera en los
 * que ya tenían.
 */
const HEADER_SELECTOR = '.panel__header, .git-popover__header, .terminal__header, .python__header';

/**
 * Garantiza que un panel de tipo diálogo se pueda cerrar y mover.
 *
 * Petición explícita del usuario (2026-09-11): "haz que todas las ventanas
 * puedan cerrarse y moverse". Se resuelve aquí, en la factoría por la que
 * pasan TODOS los paneles, en vez de repetir cabecera y `makeDraggable` en
 * cada uno: así un panel nuevo lo hereda sin que nadie se acuerde de pedirlo,
 * que es justo como se coló la mitad de los que no lo tenían.
 *
 * Respeta lo que ya hubiera: si el panel trae cabecera propia, la usa como
 * asa; si esa cabecera ya trae botón de cierre, no añade otro.
 */
function ensurePanelChrome(panelEl, close) {
  let headerEl = panelEl.querySelector(HEADER_SELECTOR);

  if (!headerEl) {
    headerEl = document.createElement('div');
    headerEl.className = 'panel__header';
    // El título que ya estuviera suelto en el panel pasa a la cabecera, para
    // que el asa de arrastre no quede como una franja vacía encima de él.
    const title = panelEl.querySelector(':scope > .floating-panel__title');
    if (title) headerEl.append(title);
    panelEl.prepend(headerEl);
  }

  const hasClose = headerEl.querySelector('[data-panel-close], [data-i18n-title="action.close"]');
  if (!hasClose) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button icon-button--small';
    button.dataset.panelClose = '';
    // El `data-i18n-title` lo recoge el siguiente cambio de idioma, pero
    // `applyTranslations()` ya ha corrido cuando se cablean los paneles — de
    // ahí el título puesto también a mano, o el botón nacería sin tooltip.
    button.dataset.i18nTitle = 'action.close';
    button.title = t('action.close');
    button.textContent = '✕';
    button.addEventListener('click', close);
    headerEl.append(button);
  }

  makeDraggable(panelEl, headerEl);
}

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

  // `.filter(Boolean)` no es cosmético: `el('x')` devuelve `null` cuando el
  // botón ya no existe en el HTML, y sin filtrar el `addEventListener` de abajo
  // lanzaría durante el cableado inicial — no degradando este panel, sino
  // impidiendo que arranque la aplicación entera. Pasó a un paso de ocurrir al
  // retirar `#btn-launcher-universe` en RF-25.
  const triggers = opts.trigger ? [].concat(opts.trigger).filter(Boolean) : [];

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

  // Los menús desplegables (`role="menu"`) quedan fuera a propósito: se
  // cierran solos al elegir o al pulsar fuera, y una cabecera con "✕" encima
  // de un menú de tres opciones estorba más de lo que ayuda.
  if (panelEl.getAttribute('role') === 'dialog') ensurePanelChrome(panelEl, close);

  panelClosers.push(close);
  return { open, close };
}

/** Cierra todos los paneles registrados (p. ej. al pulsar Escape). */
export function closeAllPanels() {
  for (const close of panelClosers) close();
}

/**
 * Posiciona un panel flotante justo debajo de `triggerEl`, recortando su
 * borde izquierdo para que no se salga de la ventana por la derecha.
 *
 * Extraído en /code-simplify de v0.7.0: `diagramEditor.js`, `equationEditor.js`,
 * `sequenceEditor.js` y `ganttEditor.js` habían llegado, cada uno por su
 * cuenta, al mismo cálculo de cuatro líneas dentro de su `openNear()` — un
 * único sitio en vez de cuatro copias que solo podrían desincronizarse si
 * un quinto editor necesitara el mismo ajuste (p. ej. un margen distinto).
 * @param {HTMLElement} panelEl
 * @param {HTMLElement} triggerEl
 * @param {{width?: number}} [opts] Ancho aproximado del panel — decide cuánto
 *   antes del borde derecho de la ventana empieza a recortarse la posición.
 */
export function positionPanelNear(panelEl, triggerEl, { width = 420 } = {}) {
  const rect = triggerEl.getBoundingClientRect();
  panelEl.style.top = `${rect.bottom + 6}px`;
  panelEl.style.left = `${Math.max(10, Math.min(window.innerWidth - width, rect.left))}px`;
  panelEl.style.right = 'auto';
  panelEl.style.transform = 'none';
}
