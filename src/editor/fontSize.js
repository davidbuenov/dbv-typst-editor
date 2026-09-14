// =============================================================================
// DBV Typst Editor — Tamaño de fuente del editor (RF-42)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Funciones puras, sin DOM — el mismo reparto que `ui/splitter.js` (cálculo
// aparte del cableado de eventos): fáciles de testear, y la única lógica que
// de verdad puede tener un error de razonamiento (un paso al revés, un
// límite mal puesto) es esta, no la parte que solo lee `event.clientX`.

export const EDITOR_FONT_MIN = 11;
export const EDITOR_FONT_MAX = 22;
export const EDITOR_FONT_DEFAULT = 13;
const STEP = 1;

/** Recorta un tamaño de fuente al rango utilizable del editor. */
export function clampEditorFontSize(px) {
  return Math.min(EDITOR_FONT_MAX, Math.max(EDITOR_FONT_MIN, px));
}

/**
 * Un paso de zoom desde `current`. `direction` es `1` (acercar) o `-1`
 * (alejar) — el signo, no la magnitud, para que Ctrl++/Ctrl+- y Ctrl+rueda
 * compartan la misma unidad de paso sin que uno "salte" más que el otro.
 */
export function stepEditorFontSize(current, direction) {
  return clampEditorFontSize(current + Math.sign(direction) * STEP);
}
