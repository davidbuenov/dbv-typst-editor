// =============================================================================
// DBV Typst Editor — Tests de la marca visual de la sincronización
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Tras un salto de sincronización el cursor se movía, pero nada decía a qué
// bloque había saltado: en un fichero de 6.000 líneas el usuario lo perdía de
// vista. Aquí se comprueba que el bloque se resalta, que se retira solo y que
// una segunda marca sustituye a la primera.

import { EditorState, Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FLASH_DURATION_MS, revealAndFlash, syncBlockRange, syncFlashField } from './syncFlash.js';

const doc = (text) => Text.of(text.split('\n'));

describe('syncBlockRange', () => {
  const text = doc('= Titulo\n\nPrimer parrafo\nsigue aqui\n\nSegundo parrafo\n');

  it('cubre el bloque hasta la línea en blanco siguiente', () => {
    expect(syncBlockRange(text, 3)).toEqual({ from: 3, to: 4 });
  });

  it('un bloque de una sola línea es solo esa línea', () => {
    expect(syncBlockRange(text, 1)).toEqual({ from: 1, to: 1 });
  });

  it('el último bloque llega hasta el final del documento', () => {
    expect(syncBlockRange(text, 6)).toEqual({ from: 6, to: 6 });
  });

  it('una línea fuera del documento se recorta en vez de fallar', () => {
    expect(syncBlockRange(text, 999).from).toBe(text.lines);
    expect(syncBlockRange(text, -5).from).toBe(1);
  });

  it('un bloque larguísimo (un listado) no se resalta entero', () => {
    const long = doc(Array.from({ length: 200 }, (_, i) => `linea ${i}`).join('\n'));

    const { from, to } = syncBlockRange(long, 1);

    expect(from).toBe(1);
    expect(to - from + 1).toBeLessThanOrEqual(15);
  });
});

describe('revealAndFlash con un editor real', () => {
  let host;
  let view;

  beforeEach(() => {
    // jsdom no implementa la geometría de `Range`, que CodeMirror usa al medir.
    const emptyRects = () => Object.assign([], { item: () => null });
    Range.prototype.getClientRects = emptyRects;
    Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.append(host);
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: 'uno\ndos\n\ntres\ncuatro\n\ncinco',
        extensions: [syncFlashField],
      }),
    });
  });

  afterEach(() => {
    view.destroy();
    host.remove();
    vi.useRealTimers();
  });

  const flashed = () => [...host.querySelectorAll('.cm-sync-flash')].map((el) => el.textContent);

  it('mueve el cursor al inicio del bloque y lo resalta', () => {
    revealAndFlash(view, 4);

    expect(view.state.selection.main.head).toBe(view.state.doc.line(4).from);
    expect(flashed()).toEqual(['tres', 'cuatro']);
  });

  it('la marca se retira sola pasado el tiempo', () => {
    revealAndFlash(view, 1);
    expect(flashed()).toEqual(['uno', 'dos']);

    vi.advanceTimersByTime(FLASH_DURATION_MS + 50);

    expect(flashed()).toEqual([]);
  });

  it('una segunda marca sustituye a la primera y reinicia el tiempo', () => {
    revealAndFlash(view, 1);
    vi.advanceTimersByTime(FLASH_DURATION_MS - 500);
    revealAndFlash(view, 7);

    expect(flashed()).toEqual(['cinco']);
    // El temporizador de la primera no debe retirar la segunda antes de tiempo.
    vi.advanceTimersByTime(600);
    expect(flashed()).toEqual(['cinco']);
    vi.advanceTimersByTime(FLASH_DURATION_MS);
    expect(flashed()).toEqual([]);
  });

  it('no rompe si el editor se destruye antes de que venza la marca', () => {
    revealAndFlash(view, 1);
    view.destroy();

    expect(() => vi.advanceTimersByTime(FLASH_DURATION_MS + 50)).not.toThrow();
  });

  it('el texto del documento no se altera', () => {
    revealAndFlash(view, 4);

    expect(view.state.doc.toString()).toBe('uno\ndos\n\ntres\ncuatro\n\ncinco');
  });
});
