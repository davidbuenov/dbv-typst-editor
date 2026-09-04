// =============================================================================
// DBV Typst Editor — Diálogo modal de elección
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Adaptación del modal de conflicto de DBV Markdown Reader (ARCHITECTURE.md §3
// fila 3). Se usa exclusivamente para decisiones en las que cualquier opción por
// defecto podría destruir trabajo del usuario: el resto de avisos de la
// aplicación van por la banda no intrusiva (`ui/toast.js`).

import { t } from '../i18n/i18n.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.dialogEl Contenedor del modal.
 * @param {HTMLElement} deps.titleEl
 * @param {HTMLElement} deps.textEl
 * @param {HTMLElement} deps.actionsEl Contenedor de los botones.
 */
export function createChoiceDialog({ dialogEl, titleEl, textEl, actionsEl }) {
  /** @type {null | ((choice: string) => void)} */
  let resolveCurrent = null;

  function close(choice) {
    dialogEl.classList.add('hidden');
    const resolve = resolveCurrent;
    resolveCurrent = null;
    resolve?.(choice);
  }

  // Escape equivale a cancelar: nunca a la acción destructiva.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && resolveCurrent) close('cancel');
  });

  /**
   * Muestra el modal y resuelve con la clave de la opción elegida.
   * @param {{titleKey: string, textKey: string, text?: string, choices: Array<{key: string, labelKey: string, tone?: 'primary'|'danger'}>}} options
   * @returns {Promise<string>}
   */
  function ask({ titleKey, textKey, text, choices }) {
    // Una segunda pregunta encima de otra sin resolver dejaría la primera
    // colgada para siempre: se cancela explícitamente antes de sustituirla.
    if (resolveCurrent) close('cancel');

    titleEl.textContent = t(titleKey);
    textEl.textContent = text ? `${t(textKey)}\n${text}` : t(textKey);

    const fragment = document.createDocumentFragment();
    for (const choice of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button';
      if (choice.tone === 'primary') button.classList.add('button--primary');
      if (choice.tone === 'danger') button.classList.add('button--danger');
      button.textContent = t(choice.labelKey);
      button.addEventListener('click', () => close(choice.key));
      fragment.append(button);
    }
    actionsEl.replaceChildren(fragment);

    dialogEl.classList.remove('hidden');
    actionsEl.querySelector('button')?.focus();

    return new Promise((resolve) => {
      resolveCurrent = resolve;
    });
  }

  return { ask };
}
