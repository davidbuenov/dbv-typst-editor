// =============================================================================
// DBV Typst Editor — Paneles del espacio de trabajo (Beta, §7.9, rediseñado)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Sustituye a los cuatro modos fijos (Edición/Escritura/Dividido/Lectura) por
// tres interruptores independientes — proyecto/esquema, editor, vista previa —
// que se combinan libremente: cada uno se oculta o se muestra por su cuenta y
// los que quedan visibles se reparten siempre todo el ancho disponible (ver
// las reglas de `grid-template-columns` en `layout.css`). Petición explícita
// del usuario tras probar la Beta: los 4 preajustes fijos eran menos flexibles
// que el equivalente de DBV Markdown Reader (mostrar/ocultar Índice/Archivos,
// editor y vista previa por separado).

const STORAGE_KEY = 'dbv-typst-workspace-panels';

export const PANELS = ['sidebar', 'editor', 'preview'];

function resolveInitialState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && PANELS.every((panel) => typeof stored[panel] === 'boolean')) return stored;
  } catch {
    // Un WebView que bloquee el almacenamiento, o un valor corrupto, no debe
    // impedir arrancar con los tres paneles visibles.
  }
  return { sidebar: true, editor: true, preview: true };
}

let state = resolveInitialState();

/** @returns {{sidebar: boolean, editor: boolean, preview: boolean}} */
export function getPanelState() {
  return { ...state };
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ver resolveInitialState().
  }
}

function apply(targetEl) {
  if (!targetEl) return;
  for (const panel of PANELS) {
    targetEl.dataset[`panel${panel[0].toUpperCase()}${panel.slice(1)}`] = state[panel] ? 'show' : 'hide';
  }
}

/**
 * Alterna un panel. Si sería el último visible, no hace nada — siempre debe
 * quedar al menos uno, o el usuario se quedaría sin ninguna forma de volver a
 * mostrar los otros dos.
 *
 * @param {'sidebar'|'editor'|'preview'} panel
 * @param {HTMLElement} targetEl Elemento `.workspace` sobre el que se fijan los `data-*`.
 */
export function togglePanel(panel, targetEl) {
  if (!PANELS.includes(panel)) return;
  const nextValue = !state[panel];
  if (!nextValue && PANELS.filter((candidate) => candidate !== panel).every((candidate) => !state[candidate])) {
    return;
  }
  state = { ...state, [panel]: nextValue };
  apply(targetEl);
  persist();
}

/** Aplica el estado ya cargado sobre el elemento — llamar una vez al arrancar. */
export function initPanels(targetEl) {
  apply(targetEl);
}
