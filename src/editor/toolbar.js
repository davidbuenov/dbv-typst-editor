// =============================================================================
// DBV Typst Editor — Barra de herramientas del editor (DOM)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// RF-13 / ARCHITECTURE.md §7.7. Capa fina de DOM sobre `toolbarActions.js`: no
// contiene ninguna regla de qué marcado generar, solo pinta botones a partir
// de la tabla de acciones y aplica la transacción que cada una calcula.

import { t } from '../i18n/i18n.js';
import { TOOLBAR_ACTIONS, isInsideMath } from './toolbarActions.js';

const GROUPS = ['format', 'structure', 'content', 'typst'];

/** 'Mod-Shift-1' → 'Ctrl+Shift+1' / 'Cmd+Shift+1' según la plataforma. */
function formatShortcut(shortcut) {
  const isMac = /mac/i.test(navigator.platform ?? navigator.userAgent ?? '');
  return shortcut.replace('Mod', isMac ? 'Cmd' : 'Ctrl').replaceAll('-', '+');
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.containerEl
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 * @param {(triggerEl: HTMLButtonElement) => void} [deps.onCitationRequested]
 *   Beta, §7.7.4: el botón "Cite" abre el desplegable de claves reales del
 *   `.bib` del proyecto en vez de insertar un marcador genérico. Si no se da
 *   (por ejemplo en un test), el botón degrada limpiamente al marcador simple
 *   de `toolbarActions.js`.
 */
export function createToolbar({ containerEl, getView, onCitationRequested }) {
  /** @type {Map<string, HTMLButtonElement>} */
  const buttons = new Map();

  function render() {
    containerEl.innerHTML = '';
    buttons.clear();

    GROUPS.forEach((group, index) => {
      if (index > 0) {
        const divider = document.createElement('span');
        divider.className = 'toolbar__divider';
        containerEl.append(divider);
      }

      const groupEl = document.createElement('div');
      groupEl.className = 'toolbar__group';
      groupEl.dataset.group = group;

      for (const action of TOOLBAR_ACTIONS.filter((candidate) => candidate.group === group)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `toolbar__button toolbar__button--${action.id}`;
        button.textContent = action.glyph;
        button.dataset.action = action.id;
        button.addEventListener('click', () => {
          if (action.id === 'citation' && onCitationRequested) {
            onCitationRequested(button);
            return;
          }
          const view = getView();
          if (!view) return;
          const spec = action.buildTransaction(view.state);
          if (spec) view.dispatch(spec);
          view.focus();
        });
        buttons.set(action.id, button);
        groupEl.append(button);
      }

      containerEl.append(groupEl);
    });
  }

  /** Vuelve a poner tooltip/aria-label en el idioma activo. */
  function refreshLabels() {
    for (const action of TOOLBAR_ACTIONS) {
      const button = buttons.get(action.id);
      if (!button) continue;
      const label = t(action.i18nKey);
      button.title = action.shortcut ? `${label} (${formatShortcut(action.shortcut)})` : label;
      button.setAttribute('aria-label', label);
    }
  }

  /**
   * Sensibilidad al contexto (§7.7.3.3): dentro de una ecuación, los botones
   * de formato de texto se deshabilitan y el grupo Typst pasa al frente.
   */
  function refreshContext() {
    const view = getView();
    const insideMath = view ? isInsideMath(view.state) : false;
    containerEl.classList.toggle('toolbar--math', insideMath);
    for (const action of TOOLBAR_ACTIONS) {
      const button = buttons.get(action.id);
      if (button) button.disabled = insideMath && action.group !== 'typst';
    }
  }

  render();
  refreshLabels();
  refreshContext();

  // Disparado por `i18n.js` en cada cambio de idioma (los textos generados a
  // mano, sin atributo `data-i18n`, no pasan por `applyTranslations`).
  document.addEventListener('dbv-lang-changed', refreshLabels);

  return {
    /** Llamar tras cada movimiento de cursor/selección del editor. */
    refresh: refreshContext,
  };
}
