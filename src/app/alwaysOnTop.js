// =============================================================================
// DBV Typst Editor — Chincheta "mantener la ventana encima" (RF-28)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Portado de DBV Markdown Reader, con su misma decisión de fondo (ADR-023 allí,
// ADR-VENTANA-001 aquí): **por ventana y sin persistencia**. Fijar una ventana
// encima es una decisión del momento —"quiero verla mientras trabajo en otra
// cosa"—, no una preferencia permanente; una aplicación que arranca por encima
// de todo lo demás porque una vez se pulsó una chincheta sorprende, y la vía de
// escape no es evidente.
//
// La ventana llega inyectada en vez de importarse aquí para que el módulo se
// pueda probar sin Tauri: lo único que necesita es algo con `isAlwaysOnTop()` y
// `setAlwaysOnTop()`.

import { t } from '../i18n/i18n.js';

/**
 * @param {object} deps
 * @param {HTMLButtonElement} deps.buttonEl Control de la cabecera.
 * @param {{isAlwaysOnTop: () => Promise<boolean>, setAlwaysOnTop: (value: boolean) => Promise<void>}} deps.appWindow
 * @param {(message: string) => void} [deps.onError] Aviso al usuario si la ventana no obedece.
 */
export function createAlwaysOnTop({ buttonEl, appWindow, onError }) {
  /** @type {boolean} Último estado CONFIRMADO por la ventana, no el deseado. */
  let pinned = false;

  function render() {
    const key = pinned ? 'action.alwaysOnTopActive' : 'action.alwaysOnTop';
    buttonEl.classList.toggle('active', pinned);
    // `data-i18n-title` se relee al cambiar de idioma, así que el texto correcto
    // sobrevive a un cambio ES/EN con la ventana ya fijada.
    buttonEl.setAttribute('data-i18n-title', key);
    buttonEl.title = t(key);
    buttonEl.setAttribute('aria-label', t(key));
    buttonEl.setAttribute('aria-pressed', String(pinned));
  }

  async function toggle() {
    const objetivo = !pinned;
    try {
      await appWindow.setAlwaysOnTop(objetivo);
      // Solo se da por bueno lo que la ventana confirma: si `setAlwaysOnTop`
      // falla, el control no puede quedarse diciendo que está fijada (RF-28.5).
      pinned = objetivo;
    } catch (error) {
      onError?.(String(error?.message ?? error));
    }
    render();
  }

  buttonEl.addEventListener('click', toggle);
  render();

  return {
    toggle,
    isPinned: () => pinned,
    /** Repinta el texto tras un cambio de idioma. */
    refreshLanguage: render,
    /** Sincroniza con el estado real de la ventana (por si algo lo cambió fuera). */
    async sync() {
      try {
        pinned = await appWindow.isAlwaysOnTop();
      } catch {
        pinned = false;
      }
      render();
    },
  };
}
