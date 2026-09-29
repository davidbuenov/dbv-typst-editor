// =============================================================================
// DBV Typst Editor — Aviso «motor clásico» de la vista previa (RF-87.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Al retirar el conmutador de motor (RF-87) desapareció también la única forma
// de reactivar el motor rápido tras una desactivación de sesión (plazo agotado
// o pánico): `engine_set_mode('inproc')` es lo que la borra. La sincronización
// se quedaba por párrafo hasta reiniciar la app (hallado al probar la 0.12.1).
// Este aviso es el camino de vuelta: solo se ve mientras lo que hay en pantalla
// lo compiló el motor clásico de respaldo, dice por qué y, al pulsarlo,
// reactiva el motor rápido y recompila.

import { t } from '../i18n/i18n.js';

/**
 * @param {object} deps
 * @param {HTMLButtonElement} deps.button Chip de la barra de la vista previa.
 * @param {(mode: 'inproc') => Promise<unknown>} deps.setMode `engineSetMode`.
 * @param {() => void} deps.restart Recompila la vista previa.
 */
export function createEngineNotice({ button, setMode, restart }) {
  /** Motivo del último paso al clásico: las compilaciones siguientes ya no lo traen. */
  let reason = null;

  function hide() {
    button.classList.add('hidden');
  }

  function refreshTitle() {
    button.title = t('preview.engineClassicTitle').replace('{reason}', reason ?? t('preview.engineClassicUnknown'));
  }

  button.addEventListener('click', async () => {
    hide();
    await setMode('inproc');
    restart();
  });
  document.addEventListener('dbv-lang-changed', refreshTitle);

  return {
    /** Resultado de cada compilación de la vista previa (`onCompiled`). */
    onCompiled(result) {
      if (!result.ok) return;
      if (result.engine === 'inproc') {
        reason = null;
        hide();
        return;
      }
      if (result.fallbackReason) reason = result.fallbackReason;
      refreshTitle();
      button.classList.remove('hidden');
    },
  };
}
