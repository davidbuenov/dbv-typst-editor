// =============================================================================
// DBV Typst Editor — Modos de escritura (Beta, ARCHITECTURE.md §7.9)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cuatro preajustes de qué paneles se ven: Escritura (solo editor, sin
// herramientas), Edición (todo — el layout de siempre), Dividido (editor +
// vista previa) y Lectura (solo vista previa a pantalla completa). Sin
// infraestructura nueva: son reglas CSS sobre `[data-mode]` en `.workspace`,
// igual que el tema usa `[data-theme]` en `<html>` (`themes/theme.js`).

const STORAGE_KEY = 'dbv-typst-writing-mode';

export const WRITING_MODES = ['edicion', 'escritura', 'dividido', 'lectura'];

function resolveInitialMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (WRITING_MODES.includes(stored)) return stored;
  } catch {
    // Ver comentario equivalente en theme.js: un WebView que bloquee el
    // almacenamiento no debe impedir arrancar con el modo por defecto.
  }
  return 'edicion';
}

let currentMode = resolveInitialMode();

/** @returns {'edicion'|'escritura'|'dividido'|'lectura'} */
export function getWritingMode() {
  return currentMode;
}

/**
 * @param {'edicion'|'escritura'|'dividido'|'lectura'} mode
 * @param {HTMLElement} targetEl Elemento `.workspace` sobre el que se fija `data-mode`.
 */
export function setWritingMode(mode, targetEl) {
  if (!WRITING_MODES.includes(mode)) return;
  currentMode = mode;
  if (targetEl) targetEl.dataset.mode = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ver resolveInitialMode().
  }
}
