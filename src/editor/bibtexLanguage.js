// =============================================================================
// DBV Typst Editor — Resaltado de sintaxis para BibTeX (RF-62)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// `@codemirror/language-data` no trae ningún paquete para BibTeX (solo `sTeX`
// y `LaTeX`): sin esto, `detectLanguage` (RF-60) clasifica un `.bib` como
// texto plano y se abre sin colores — justo lo que reportó el amigo del
// usuario que probó la 0.9.0. Un modo con `StreamLanguage` basta para un
// formato tan simple, y no arrastra ningún paquete nuevo: `token()` devuelve
// el NOMBRE de una etiqueta estándar (`keyword`, `string`, `number`…), que
// CodeMirror resuelve internamente contra las mismas de `@lezer/highlight` —
// las que ya pinta `defaultHighlightStyle` como respaldo para el resto de
// ficheros de código de RF-60 (`editor.js`). Sin CSS propio: los tres temas
// los heredan igual que a un `.cpp` o un `.py`.

import { LanguageDescription, LanguageSupport, StreamLanguage } from '@codemirror/language';

/** Nombre del lenguaje que se enseña en la insignia del documento. */
export const BIBTEX_LABEL = 'BibTeX';

/**
 * Estado del analizador entre llamadas a `token()` — incluidas las que caen
 * en líneas distintas, para que un valor como `{Problem Solving with
 * {C++}}` repartido en varias líneas siga coloreado como una sola cadena.
 *
 * @typedef {object} BibtexState
 * @property {'top'|'key'|'field-name'|'after-name'|'value'|'value-brace'|'value-quote'|'after-value'} context
 * @property {number} braceDepth Anidamiento de `{}` dentro de un valor.
 * @property {'}'|')'} entryClose Carácter que cierra la entrada actual.
 */

/** @returns {BibtexState} */
function startState() {
  return { context: 'top', braceDepth: 0, entryClose: '}' };
}

/**
 * Consume un valor entre llaves respetando el anidamiento (`{{}}` sigue
 * dentro del valor) y sin exigir que abra y cierre en la misma línea: el
 * `braceDepth` que persiste en `state` es lo que hace posible seguir un
 * valor multilínea entre una llamada a `token()` y la siguiente.
 * @param {import('@codemirror/language').StringStream} stream
 * @param {BibtexState} state
 */
function readBraceValue(stream, state) {
  while (!stream.eol()) {
    const ch = stream.next();
    if (ch === '{') state.braceDepth++;
    else if (ch === '}') {
      state.braceDepth--;
      if (state.braceDepth === 0) {
        state.context = 'after-value';
        break;
      }
    }
  }
  return 'string';
}

/** @param {import('@codemirror/language').StringStream} stream @param {BibtexState} state */
function readQuoteValue(stream, state) {
  while (!stream.eol()) {
    const ch = stream.next();
    if (ch === '"') {
      state.context = 'after-value';
      break;
    }
  }
  return 'string';
}

/**
 * El `StreamParser` de BibTeX (RF-62.2): tipo de entrada (`@book{`), clave de
 * cita, nombres de campo, valores entre llaves o comillas (anidados,
 * multilínea), números sueltos y comentarios `%`/`%%` (convención de
 * BibDesk, que es lo que exporta el fichero real que motivó este requisito).
 * @returns {import('@codemirror/language').StreamParser<BibtexState>}
 */
export function bibtexStreamParser() {
  return {
    name: 'bibtex',
    startState,
    token(stream, state) {
      // Un valor entre llaves o comillas puede seguir abierto de la línea
      // anterior: se resuelve ANTES que nada, sin mirar `eatSpace`/comentario,
      // porque los espacios y un `%` sueltos son parte legítima del valor.
      if (state.context === 'value-brace') return readBraceValue(stream, state);
      if (state.context === 'value-quote') return readQuoteValue(stream, state);

      if (stream.eatSpace()) return null;

      if (stream.match(/^%.*/)) {
        stream.skipToEnd();
        return 'comment';
      }

      if (state.context === 'top') {
        if (stream.match(/^@[A-Za-z]+/)) {
          state.context = 'key';
          return 'keyword';
        }
        stream.next();
        return null;
      }

      if (state.context === 'key') {
        if (stream.eat('{')) {
          state.entryClose = '}';
          return null;
        }
        if (stream.eat('(')) {
          state.entryClose = ')';
          return null;
        }
        if (stream.match(/^[^,{}()\s]+/)) {
          state.context = 'field-name';
          return 'atom';
        }
        stream.next();
        return null;
      }

      if (state.context === 'field-name') {
        if (stream.eat(state.entryClose)) {
          state.context = 'top';
          return null;
        }
        if (stream.match(/^[A-Za-z][\w-]*/)) {
          state.context = 'after-name';
          return 'propertyName';
        }
        stream.next();
        return null;
      }

      if (state.context === 'after-name') {
        if (stream.eat('=')) {
          state.context = 'value';
          return null;
        }
        if (stream.eat(state.entryClose)) {
          state.context = 'top';
          return null;
        }
        stream.next();
        return null;
      }

      if (state.context === 'value') {
        if (stream.eat('{')) {
          state.braceDepth = 1;
          state.context = 'value-brace';
          return readBraceValue(stream, state);
        }
        if (stream.eat('"')) {
          state.context = 'value-quote';
          return readQuoteValue(stream, state);
        }
        if (stream.match(/^\d+/)) {
          state.context = 'after-value';
          return 'number';
        }
        if (stream.match(/^[^\s,{}]+/)) {
          state.context = 'after-value';
          return 'atom';
        }
        stream.next();
        return null;
      }

      // 'after-value': entre el valor de un campo y el siguiente `,` o el
      // cierre de la entrada.
      if (stream.eat(state.entryClose)) {
        state.context = 'top';
        return null;
      }
      if (stream.eat(',')) {
        state.context = 'field-name';
        return null;
      }
      stream.next();
      return null;
    },
    languageData: {
      commentTokens: { line: '%' },
    },
  };
}

/**
 * Descripción del lenguaje para `languageSupport.js`. Se construye a mano en
 * vez de venir de `@codemirror/language-data` (que no trae BibTeX) — mismo
 * contrato que las demás: `detectLanguage` la devuelve en `description` y
 * `loadLanguageExtension` llama a `.load()`, que aquí no tiene nada que
 * descargar (va empaquetado, no hay `import()` dinámico que hacer).
 */
export const bibtexLanguageDescription = LanguageDescription.of({
  name: BIBTEX_LABEL,
  extensions: ['bib'],
  load: async () => new LanguageSupport(StreamLanguage.define(bibtexStreamParser())),
});
