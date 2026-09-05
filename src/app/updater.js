// =============================================================================
// DBV Typst Editor — Auto-actualización (Beta, ADR-ACTUALIZADOR-001)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Mismo comportamiento que DBV Markdown Reader (`app.js`, sección updater),
// con las dos reglas que allí se establecieron y aquí se respetan:
//
//   · NUNCA se comprueba al arrancar. Solo cuando el usuario pulsa el botón:
//     una aplicación offline-first no debe salir a la red por su cuenta al
//     abrirse, y menos para algo que el usuario no ha pedido.
//   · En una instalación de Microsoft Store (paquete MSIX) el botón NO se
//     muestra. Ahí las actualizaciones las gestiona la Store, y descargar y
//     ejecutar el instalador dentro de ese entorno aislado fallaría o crearía
//     una segunda instalación desconectada de la primera.
//
// El mismo botón cambia de función una vez hay versión disponible
// ("Buscar actualizaciones" → "Instalar"): evita un segundo botón que solo
// tiene sentido durante unos segundos.

import { t } from '../i18n/i18n.js';

/**
 * @param {object} deps
 * @param {HTMLButtonElement} deps.buttonEl
 * @param {HTMLElement} deps.statusEl
 * @param {boolean} deps.isPackaged ¿Instalado desde Microsoft Store?
 */
export function createUpdater({ buttonEl, statusEl, isPackaged }) {
  /** Actualización ya encontrada y lista para descargar. */
  let pending = null;

  function setStatus(key, extra = '') {
    statusEl.textContent = extra ? `${t(key)} ${extra}` : t(key);
    statusEl.classList.toggle('is-available', Boolean(pending));
  }

  if (isPackaged) {
    // Sin botón: la Store se encarga. Se explica, no se deja en silencio.
    buttonEl.classList.add('hidden');
    setStatus('about.update.store');
    return;
  }

  async function install() {
    buttonEl.disabled = true;
    setStatus('update.downloading');
    try {
      // Los módulos del actualizador se cargan solo cuando de verdad se van a
      // usar: fuera de la ventana de Tauri (tests, `verify:frontend`) ni
      // siquiera existen, y un import estático rompería el arranque.
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await pending.downloadAndInstall();
      setStatus('update.installed');
      await relaunch();
    } catch (error) {
      buttonEl.disabled = false;
      setStatus('update.installFailed', String(error?.message ?? error));
    }
  }

  async function check() {
    buttonEl.disabled = true;
    setStatus('update.checking');
    try {
      const { check: checkForUpdate } = await import('@tauri-apps/plugin-updater');
      const update = await checkForUpdate();
      buttonEl.disabled = false;

      if (!update) {
        setStatus('update.upToDate');
        return;
      }
      pending = update;
      buttonEl.textContent = t('update.install');
      setStatus('update.available', update.version);
    } catch (error) {
      buttonEl.disabled = false;
      setStatus('update.checkFailed', String(error?.message ?? error));
    }
  }

  buttonEl.addEventListener('click', () => (pending ? install() : check()));

  // El texto del botón no lleva `data-i18n` una vez cambia a "Instalar", así
  // que hay que repintarlo a mano al cambiar de idioma.
  document.addEventListener('dbv-lang-changed', () => {
    buttonEl.textContent = t(pending ? 'update.install' : 'update.check');
  });
}
