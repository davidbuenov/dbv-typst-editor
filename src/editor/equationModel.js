// =============================================================================
// DBV Typst Editor — Modelo puro del editor visual de ecuaciones (RF-46)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Funciones puras, sin DOM — mismo reparto que `ui/splitter.js`/`toolbarActions.js`:
// `equationEditor.js` es el cableado fino sobre este modelo.
//
// A diferencia del editor de diagramas (RF-31), aquí NO hace falta un modelo
// de nodos/aristas: la "ecuación que se va construyendo" es, en todo momento,
// el propio código Typst de la fórmula — el usuario ve exactamente ese texto
// renderizado en vivo (mismo principio de fidelidad que RF-31: "el lienzo
// enseña lo que se va a compilar"). Los botones de piezas solo INSERTAN
// fragmentos de ese texto en la posición del cursor de un campo de texto
// normal, con la misma idea que ya usa `toolbarActions.js` para insertar
// marcado en el editor principal.
//
// Cada snippet compilado de humo contra el binario real (2026-09-14) antes de
// fijar su sintaxis — `sum_(i=1)^n`, `root(3, x)`, `lt.eq`/`gt.eq`/`eq.not`,
// `plus.minus`, delimitadores `[]`/`{}` dentro de modo matemático, etc. — para
// no repetir el error de dar por buena una sintaxis sin ejecutarla.

import { escapeTypstString } from './typstEscape.js';

/**
 * Catálogo de piezas insertables. `placeholder`, si aparece dentro de
 * `insert`, se SELECCIONA tras insertar (para que escribir sustituya
 * directamente esa parte); si no hay `placeholder`, el cursor se coloca en
 * `caretAfter` caracteres desde el inicio de lo insertado.
 */
export const EQUATION_SNIPPETS = [
  // Estructura
  { id: 'frac', group: 'structure', insert: '()/()', caretAfter: 1 },
  { id: 'pow', group: 'structure', insert: '^()', caretAfter: 2 },
  { id: 'sub', group: 'structure', insert: '_()', caretAfter: 2 },
  { id: 'sqrt', group: 'structure', insert: 'sqrt()', caretAfter: 5 },
  { id: 'root', group: 'structure', insert: 'root(n, x)', placeholder: 'n' },
  // Grandes operadores
  { id: 'sum', group: 'bigop', insert: 'sum_(i=1)^n ', placeholder: 'i=1' },
  { id: 'integral', group: 'bigop', insert: 'integral_a^b ', placeholder: 'a' },
  { id: 'prod', group: 'bigop', insert: 'product_(i=1)^n ', placeholder: 'i=1' },
  { id: 'lim', group: 'bigop', insert: 'lim_(x -> oo) ', placeholder: 'x -> oo' },
  // Matriz
  { id: 'matrix', group: 'matrix', insert: 'mat(a, b; c, d)', placeholder: 'a' },
  // Símbolos griegos y constantes de uso frecuente
  { id: 'alpha', group: 'symbol', insert: 'alpha' },
  { id: 'beta', group: 'symbol', insert: 'beta' },
  { id: 'gamma', group: 'symbol', insert: 'gamma' },
  { id: 'pi', group: 'symbol', insert: 'pi' },
  { id: 'theta', group: 'symbol', insert: 'theta' },
  { id: 'lambda', group: 'symbol', insert: 'lambda' },
  { id: 'infinity', group: 'symbol', insert: 'infinity' },
  // Operadores y relaciones
  { id: 'times', group: 'operator', insert: 'times' },
  { id: 'div', group: 'operator', insert: 'div' },
  { id: 'plusminus', group: 'operator', insert: 'plus.minus' },
  { id: 'leq', group: 'operator', insert: 'lt.eq' },
  { id: 'geq', group: 'operator', insert: 'gt.eq' },
  { id: 'neq', group: 'operator', insert: 'eq.not' },
  { id: 'approx', group: 'operator', insert: 'approx' },
  // Delimitadores
  { id: 'parens', group: 'delimiter', insert: '()', caretAfter: 1 },
  { id: 'brackets', group: 'delimiter', insert: '[]', caretAfter: 1 },
  { id: 'braces', group: 'delimiter', insert: '{}', caretAfter: 1 },
  { id: 'abs', group: 'delimiter', insert: 'abs()', caretAfter: 4 },
];

/**
 * Inserta `snippet.insert` en `current` sustituyendo la selección
 * `[selectionStart, selectionEnd)` — el mismo contrato que
 * `HTMLInputElement.setRangeText`, pero puro y testeable sin DOM.
 * @returns {{value: string, selectionStart: number, selectionEnd: number}}
 */
export function insertSnippet(current, selectionStart, selectionEnd, snippet) {
  const before = current.slice(0, selectionStart);
  const after = current.slice(selectionEnd);
  const value = before + snippet.insert + after;

  const placeholderIndex = snippet.placeholder ? snippet.insert.indexOf(snippet.placeholder) : -1;
  if (placeholderIndex !== -1) {
    const start = before.length + placeholderIndex;
    return { value, selectionStart: start, selectionEnd: start + snippet.placeholder.length };
  }

  const caret = before.length + (snippet.caretAfter ?? snippet.insert.length);
  return { value, selectionStart: caret, selectionEnd: caret };
}

/**
 * Envuelve el cuerpo matemático ya construido para insertarlo en el
 * documento — con espacio interior, igual que se escribiría a mano; si el
 * cuerpo está vacío no hay nada que insertar.
 * @param {string} math
 * @returns {string | null}
 */
export function wrapEquationForInsert(math) {
  const trimmed = math.trim();
  return trimmed ? `$ ${trimmed} $` : null;
}

// ─── Soporte MiTeX: pegar LaTeX ya escrito ──────────────────────────────────

const MITEX_SPEC = '@preview/mitex:0.2.7';

/** ¿El documento ya importa MiTeX? Mismo patrón que `hasCetzImport`. */
export function hasMitexImport(docText) {
  return /#import\s+["']@preview\/mitex[:0-9.]*["']/.test(docText);
}

export function mitexImportLine() {
  return `#import "${MITEX_SPEC}": mi`;
}

/**
 * Escapa una cadena LaTeX para que quepa dentro de una cadena Typst
 * (`"..."`): cada backslash literal de LaTeX (`\frac`, `\sqrt`...) debe
 * duplicarse, y cualquier comilla doble debe escaparse — si no, el propio
 * `\f`/`\s`... de LaTeX rompería la cadena Typst o se leería como una
 * secuencia de escape distinta. Verificado contra el compilador real: sin
 * este escapado, `mi("\frac{1}{2}")` no es la cadena LaTeX que se pretende.
 *
 * Nombre propio (no solo un re-export de `escapeTypstString`) porque aquí
 * documenta un caso concreto —LaTeX pegado por el usuario—, no la
 * transformación genérica; la lógica en sí vive en un único sitio
 * (`typstEscape.js`), compartida con `sequenceModel.js`/`ganttModel.js`.
 * @param {string} latex
 */
export function escapeLatexForTypstString(latex) {
  return escapeTypstString(latex);
}

/** Código Typst que renderiza `latex` dentro de una fórmula, vía MiTeX. */
export function buildMitexCall(latex) {
  return `mi("${escapeLatexForTypstString(latex)}")`;
}
