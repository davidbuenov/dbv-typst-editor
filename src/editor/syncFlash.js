// =============================================================================
// DBV Typst Editor — Marca visual de la sincronización (RF-16)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Al saltar del render al fuente, el cursor se movía pero nada decía QUÉ bloque
// era el correspondiente: en un fichero de 6.000 líneas, el usuario perdía de
// vista dónde había caído. Aquí se resalta ese bloque del fuente unos segundos
// y se centra en pantalla.
//
// Se marca un BLOQUE, no una palabra: las anclas de sincronización van entre
// bloques (ADR-SYNC-001), así que la precisión disponible es "este párrafo",
// no "esta palabra". Es lo que el mecanismo puede afirmar sin mentir.

import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';

/** Un bloque muy largo (un listado) no se resalta entero: solo su principio. */
const MAX_BLOCK_LINES = 15;

/** Cuánto dura la marca antes de retirarse sola. */
export const FLASH_DURATION_MS = 5000;

/**
 * Rango de líneas (1-indexadas, inclusivo) del bloque que empieza en
 * `lineNumber`: hasta la línea anterior a la siguiente en blanco, con un tope.
 * Función pura sobre cualquier objeto con `lines` y `line(n).text`, para poder
 * probarla sin montar un editor.
 *
 * @param {{lines: number, line: (n: number) => {text: string}}} doc
 * @param {number} lineNumber
 * @returns {{from: number, to: number}}
 */
export function syncBlockRange(doc, lineNumber) {
  const from = Math.min(Math.max(1, lineNumber), doc.lines);
  let to = from;
  while (to < doc.lines && to - from + 1 < MAX_BLOCK_LINES && doc.line(to + 1).text.trim() !== '') {
    to += 1;
  }
  return { from, to };
}

const flashEffect = StateEffect.define();

/** Campo de decoraciones: las líneas marcadas ahora mismo, si hay alguna. */
export const syncFlashField = StateField.define({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let result = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(flashEffect)) continue;
      if (effect.value === null) {
        result = Decoration.none;
      } else {
        if (effect.value.range) {
          const { from, to } = effect.value.range;
          result = to > from ? Decoration.set([Decoration.mark({ class: 'cm-sync-flash-range' }).range(from, to)]) : Decoration.none;
          continue;
        }
        const ranges = [];
        for (let n = effect.value.from; n <= effect.value.to; n += 1) {
          ranges.push(Decoration.line({ class: 'cm-sync-flash' }).range(transaction.state.doc.line(n).from));
        }
        result = Decoration.set(ranges);
      }
    }
    return result;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const timers = new WeakMap();

/**
 * Lleva el cursor a la línea, la centra en pantalla y marca su bloque unos
 * segundos. Una segunda llamada sustituye a la marca anterior.
 *
 * @param {EditorView} view
 * @param {number} lineNumber Línea 1-indexada; una fuera del documento se recorta.
 * @param {number} [durationMs]
 */
export function revealAndFlash(view, lineNumber, durationMs = FLASH_DURATION_MS) {
  const { from, to } = syncBlockRange(view.state.doc, lineNumber);
  const position = view.state.doc.line(from).from;

  view.dispatch({
    selection: { anchor: position },
    effects: [EditorView.scrollIntoView(position, { y: 'center' }), flashEffect.of({ from, to })],
  });

  clearTimeout(timers.get(view));
  timers.set(
    view,
    setTimeout(() => {
      // El editor pudo destruirse (cambio de proyecto) antes de que venciera.
      try {
        view.dispatch({ effects: flashEffect.of(null) });
      } catch {
        // Sin editor vivo no hay marca que retirar.
      }
    }, durationMs)
  );
}

/**
 * Lleva el cursor a un rango EXACTO del fuente (RF-57, motor en proceso), lo
 * selecciona, lo centra y lo marca unos segundos. Es la versión precisa de
 * `revealAndFlash`: la palabra o frase, no el bloque. Los extremos se recortan
 * al documento para no reventar si el texto cambió desde la compilación.
 *
 * @param {EditorView} view
 * @param {number} from Desplazamiento UTF-16 (el de CodeMirror).
 * @param {number} to
 * @param {number} [durationMs]
 */
export function revealRangeAndFlash(view, from, to, durationMs = FLASH_DURATION_MS) {
  const length = view.state.doc.length;
  const start = Math.min(Math.max(0, from), length);
  const end = Math.min(Math.max(start, to), length);

  view.dispatch({
    selection: { anchor: start, head: end },
    effects: [EditorView.scrollIntoView(start, { y: 'center' }), flashEffect.of({ range: { from: start, to: end } })],
  });

  clearTimeout(timers.get(view));
  timers.set(
    view,
    setTimeout(() => {
      try {
        view.dispatch({ effects: flashEffect.of(null) });
      } catch {
        // Sin editor vivo no hay marca que retirar.
      }
    }, durationMs)
  );
}
