// =============================================================================
// DBV Typst Editor — Tests de los rangos de sincronización (RF-57.5)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { createChangeTracker } from './changeTracker.js';
import { rangeForEditor, rangeForRender } from './syncRange.js';

const DOC = 'Hola mundo cruel';
const source = { file: 'main.typ', from: 5, to: 10 };

function tracked(spec) {
  const tracker = createChangeTracker();
  const id = tracker.start(DOC.length);
  if (spec) tracker.record(EditorState.create({ doc: DOC }).update({ changes: spec }).changes);
  return { tracker, id };
}

describe('rangeForEditor (render → editor)', () => {
  it('sin cambios devuelve el rango tal cual', () => {
    const { tracker, id } = tracked();

    expect(rangeForEditor(tracker, id, 'main.typ', source)).toEqual({ from: 5, to: 10 });
  });

  it('con lo tecleado antes de la palabra, la desplaza', () => {
    const { tracker, id } = tracked({ from: 0, insert: 'XX' });

    expect(rangeForEditor(tracker, id, 'main.typ', source)).toEqual({ from: 7, to: 12 });
  });

  it('si la palabra se borró devuelve "deleted" en vez de aterrizar en otro sitio', () => {
    const { tracker, id } = tracked({ from: 5, to: 10 });

    expect(rangeForEditor(tracker, id, 'main.typ', source)).toBe('deleted');
  });

  it('un fichero que NO es el abierto no se corrige: está en disco como se compiló', () => {
    const { tracker, id } = tracked({ from: 0, insert: 'XX' });

    expect(rangeForEditor(tracker, id, 'otro.typ', { ...source, file: 'cap.typ' })).toEqual({ from: 5, to: 10 });
  });

  it('sin compilación conocida (o tras cambiar de documento) usa el rango sin corregir', () => {
    const { tracker, id } = tracked({ from: 0, insert: 'XX' });
    tracker.reset();

    expect(rangeForEditor(tracker, id, 'main.typ', source)).toEqual({ from: 5, to: 10 });
    expect(rangeForEditor(tracker, null, 'main.typ', source)).toEqual({ from: 5, to: 10 });
  });
});

describe('rangeForRender (editor → render)', () => {
  it('traduce la selección actual al texto que se compiló', () => {
    const { tracker, id } = tracked({ from: 0, insert: 'XX' });

    expect(rangeForRender(tracker, id, { from: 7, to: 12 })).toEqual({ from: 5, to: 10, collapsed: false });
  });

  it('un cursor sin selección (from == to) sigue siendo un punto', () => {
    const { tracker, id } = tracked({ from: 0, insert: 'XX' });

    expect(rangeForRender(tracker, id, { from: 7, to: 7 })).toMatchObject({ from: 5, to: 5, collapsed: false });
  });

  it('avisa (collapsed) si lo seleccionado es texto que no existía al compilar', () => {
    const { tracker, id } = tracked({ from: 5, insert: 'NUEVO' });

    expect(rangeForRender(tracker, id, { from: 5, to: 10 }).collapsed).toBe(true);
  });

  it('sin compilación conocida usa la selección tal cual', () => {
    const tracker = createChangeTracker();

    expect(rangeForRender(tracker, null, { from: 3, to: 4 })).toEqual({ from: 3, to: 4, collapsed: false });
    expect(rangeForRender(tracker, 99, { from: 3, to: 4 })).toEqual({ from: 3, to: 4, collapsed: false });
  });
});
