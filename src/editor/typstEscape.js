// =============================================================================
// DBV Typst Editor — Escapado de cadenas Typst
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Extraído en /code-simplify de v0.7.0: `equationModel.js` (LaTeX pegado vía
// MiTeX), `sequenceModel.js` (nombres de participante, comentarios) y
// `ganttModel.js` (nombres de tarea) habían llegado, cada uno por su cuenta,
// a la MISMA transformación de dos líneas — duplicar cada backslash literal y
// escapar cada comilla doble, la única forma correcta de meter texto
// arbitrario dentro de una cadena Typst ("...") sin que rompa la sintaxis o
// se lea como una secuencia de escape distinta. Un único punto en vez de tres
// copias que solo podrían desincronizarse.
//
// `escapeTypstContent()` resuelve un problema DISTINTO — texto en modo
// MARCADO (dentro de un `[...]` de contenido) tiene sus propios caracteres
// especiales (`[`, `]`, `#`), no los de una cadena — así que es una función
// separada a propósito, nunca fusionada con `escapeTypstString`. Vivía solo
// en `diagramModel.js` hasta que `kanbanModel.js` (RF-50, Slice 66) también
// necesitó escapar nombre/asignado de tarjeta antes de un `[...]` — mismo
// criterio de esta fase: un único sitio para quien ya lo necesite, sin
// tocar la razón por la que las dos funciones siguen siendo dos.

/**
 * Escapa `value` para que quepa dentro de una cadena Typst (`"..."`).
 * @param {string} value
 */
export function escapeTypstString(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Escapa `value` para que quepa dentro de un bloque de contenido Typst (`[...]`). */
export function escapeTypstContent(value) {
  return value.replace(/([\[\]#])/g, '\\$1');
}
