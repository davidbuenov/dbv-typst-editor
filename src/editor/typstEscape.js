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
// Nótese que esto es DISTINTO de `escapeTypstContent()` en `diagramModel.js`,
// que escapa `[`, `]` y `#` para texto en modo MARCADO (dentro de un `[...]`
// de contenido) — un problema distinto, con caracteres especiales distintos,
// que no debe fusionarse con este solo porque los dos se llamen "escapar".

/**
 * Escapa `value` para que quepa dentro de una cadena Typst (`"..."`).
 * @param {string} value
 */
export function escapeTypstString(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
