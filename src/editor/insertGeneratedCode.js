// =============================================================================
// DBV Typst Editor — Inserción de código generado en el editor CodeMirror
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Extraído en /code-simplify de v0.7.0: `diagramEditor.js`, `equationEditor.js`,
// `sequenceEditor.js` y `ganttEditor.js` habían llegado, cada uno por su
// cuenta, al mismo bloque de ~12 líneas para volcar el código Typst generado
// por su asistente en el documento — con el mismo import opcional al
// principio del fichero y el mismo cálculo de dónde queda el cursor después.
// Único sitio en vez de cuatro copias que solo podrían desincronizarse.

/**
 * Inserta `code` en el documento de `view`, opcionalmente precedido de una
 * línea de import al principio del fichero.
 *
 * @param {import('@codemirror/view').EditorView} view
 * @param {object} opts
 * @param {string} opts.code Código Typst ya formateado, sin salto de línea final.
 * @param {string} [opts.importText] Línea de import completa (con su propio
 *   `\n\n` final) a anteponer si el documento aún no la tiene; cadena vacía
 *   si no hace falta.
 * @param {{from: number, to: number}} [opts.replaceRange] Si se indica,
 *   sustituye ese rango en vez de insertar en la posición del cursor — caso
 *   de reeditar un bloque ya existente (RF-31.3).
 */
export function insertGeneratedCode(view, { code, importText = '', replaceRange = null }) {
  const changes = [];
  let offsetChars = 0;
  if (importText) {
    changes.push({ from: 0, to: 0, insert: importText });
    offsetChars = importText.length;
  }

  if (replaceRange) {
    const { from, to } = replaceRange;
    changes.push({ from, to, insert: code });
    view.dispatch({ changes, selection: { anchor: from + offsetChars + code.length } });
  } else {
    const docText = view.state.doc.toString();
    const { from, to } = view.state.selection.main;
    const insertion = (from === 0 ? '' : docText[from - 1] === '\n' ? '\n' : '\n\n') + code + '\n';
    changes.push({ from, to, insert: insertion });
    view.dispatch({ changes, selection: { anchor: from + offsetChars + insertion.length } });
  }

  view.focus();
}
