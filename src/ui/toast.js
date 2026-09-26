// =============================================================================
// DBV Typst Editor — Aviso flotante no intrusivo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Un aviso que no bloquea la escritura. Deliberadamente NO es un `alert()` ni
// un modal: interrumpir a alguien que está redactando una tesis para decirle
// que una carpeta estaba vacía sería peor que el propio problema.

const DEFAULT_DURATION_MS = 4000;
const ACTION_DURATION_MS = 10000;

export function createToast(hostEl) {
  if (!(hostEl instanceof HTMLElement)) {
    throw new TypeError('createToast: hostEl debe ser un HTMLElement');
  }

  let timer = null;

  const hide = () => {
    hostEl.classList.add('hidden');
  };

  /**
   * @param {string} message
   * @param {'info'|'error'} [tone]
   * @param {number} [durationMs]
   * @param {Array<{label: string, run: () => void}>} [actions] Botones del
   *   aviso (RF-70.7: «Ver cambios», «Deshacer»). Con acciones el aviso dura
   *   más, para que dé tiempo a pulsarlas.
   */
  const show = (message, tone = 'info', durationMs = DEFAULT_DURATION_MS, actions = []) => {
    hostEl.textContent = message;
    if (actions.length) {
      const bar = document.createElement('span');
      bar.className = 'toast__actions';
      for (const { label, run } of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'toast__action';
        button.textContent = label;
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          hide();
          run();
        });
        bar.append(button);
      }
      hostEl.append(bar);
      durationMs = Math.max(durationMs, ACTION_DURATION_MS);
    }
    hostEl.classList.toggle('is-error', tone === 'error');
    hostEl.classList.remove('hidden');
    if (timer) clearTimeout(timer);
    timer = setTimeout(hide, durationMs);
  };

  hostEl.addEventListener('click', hide);

  return { show, hide };
}
