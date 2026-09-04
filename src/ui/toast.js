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
   */
  const show = (message, tone = 'info', durationMs = DEFAULT_DURATION_MS) => {
    hostEl.textContent = message;
    hostEl.classList.toggle('is-error', tone === 'error');
    hostEl.classList.remove('hidden');
    if (timer) clearTimeout(timer);
    timer = setTimeout(hide, durationMs);
  };

  hostEl.addEventListener('click', hide);

  return { show, hide };
}
