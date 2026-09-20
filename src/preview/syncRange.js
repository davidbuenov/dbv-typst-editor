// =============================================================================
// DBV Typst Editor — Rangos de sincronización entre texto compilado y actual (RF-57.5)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Reglas de a qué rango del editor se salta (render → editor) y de qué rango del
// texto compilado se pide (editor → render), según lo tecleado desde que empezó
// la compilación. Puras, para probarlas sin ventana.
//
// El seguimiento solo conoce el fichero ABIERTO en el editor: los demás están en
// disco tal como se compilaron, así que sus posiciones valen sin corregir.

/**
 * Render → editor.
 * @param {ReturnType<import('./changeTracker.js').createChangeTracker>} tracker
 * @param {number | null} renderedStart Compilación cuyo resultado se ve.
 * @param {string | null} openFile Fichero abierto en el editor (relativo a la raíz).
 * @param {{file: string, from: number, to: number}} source Lo localizado en el render.
 * @returns {{from: number, to: number} | 'deleted'}
 */
export function rangeForEditor(tracker, renderedStart, openFile, source) {
  const raw = { from: source.from, to: source.to };
  if (openFile !== source.file || renderedStart === null || !tracker.has(renderedStart)) return raw;
  const mapped = tracker.toCurrent(renderedStart, source.from, source.to);
  if (!mapped) return raw;
  return mapped.collapsed ? 'deleted' : { from: mapped.from, to: mapped.to };
}

/**
 * Editor → render.
 * @param {ReturnType<import('./changeTracker.js').createChangeTracker>} tracker
 * @param {number | null} renderedStart
 * @param {{from: number, to: number}} selection Selección actual del editor.
 * @returns {{from: number, to: number, collapsed: boolean}}
 */
export function rangeForRender(tracker, renderedStart, selection) {
  if (renderedStart === null || !tracker.has(renderedStart)) {
    return { from: selection.from, to: selection.to, collapsed: false };
  }
  const mapped = tracker.toRendered(renderedStart, selection.from, selection.to);
  if (!mapped) return { from: selection.from, to: selection.to, collapsed: false };
  return { from: mapped.from, to: mapped.to, collapsed: mapped.collapsed };
}
