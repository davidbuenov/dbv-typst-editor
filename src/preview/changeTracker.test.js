// =============================================================================
// DBV Typst Editor — Tests del seguimiento de cambios pendientes (RF-57.5)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Un salto de sincronización nunca debe aterrizar en un sitio equivocado en
// silencio. Aquí se comprueba, con `ChangeSet` reales de CodeMirror, que las
// posiciones se corrigen con lo tecleado desde que empezó la compilación.

import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { createChangeTracker } from './changeTracker.js';

const DOC = 'Hola mundo cruel y adios';

/** Aplica un cambio al estado y devuelve el nuevo estado y su `ChangeSet`. */
function edit(state, spec) {
  const transaction = state.update({ changes: spec });
  return { state: transaction.state, changes: transaction.changes };
}

describe('createChangeTracker', () => {
  it('sin cambios desde la compilación, las posiciones no se mueven y se marca limpio', () => {
    const tracker = createChangeTracker();
    const id = tracker.start(DOC.length);

    expect(tracker.toCurrent(id, 5, 10)).toEqual({ from: 5, to: 10, collapsed: false, clean: true });
    expect(tracker.toRendered(id, 5, 10)).toEqual({ from: 5, to: 10, collapsed: false, clean: true });
  });

  it('lo escrito ANTES de la palabra la desplaza hacia delante (compilado → actual)', () => {
    const tracker = createChangeTracker();
    const id = tracker.start(DOC.length);
    const { changes } = edit(EditorState.create({ doc: DOC }), { from: 0, insert: 'NUEVO ' });
    tracker.record(changes);

    // "mundo" estaba en 5..10 en el texto compilado.
    const mapped = tracker.toCurrent(id, 5, 10);

    expect(mapped).toMatchObject({ from: 11, to: 16, collapsed: false, clean: false });
  });

  it('y al revés: la posición actual se traduce a la del texto compilado (actual → compilado)', () => {
    const tracker = createChangeTracker();
    const id = tracker.start(DOC.length);
    const { changes } = edit(EditorState.create({ doc: DOC }), { from: 0, insert: 'NUEVO ' });
    tracker.record(changes);

    // En el editor ahora "mundo" está en 11..16; en lo compilado, en 5..10.
    expect(tracker.toRendered(id, 11, 16)).toMatchObject({ from: 5, to: 10 });
  });

  it('lo escrito DESPUÉS de la palabra no la toca', () => {
    const tracker = createChangeTracker();
    const id = tracker.start(DOC.length);
    const { changes } = edit(EditorState.create({ doc: DOC }), { from: DOC.length, insert: ' fin' });
    tracker.record(changes);

    expect(tracker.toCurrent(id, 5, 10)).toMatchObject({ from: 5, to: 10 });
  });

  it('si se borra el trozo, el rango se colapsa y se avisa en vez de aterrizar sin decir nada', () => {
    const tracker = createChangeTracker();
    const id = tracker.start(DOC.length);
    const { changes } = edit(EditorState.create({ doc: DOC }), { from: 5, to: 10 });
    tracker.record(changes);

    const mapped = tracker.toCurrent(id, 5, 10);

    expect(mapped.collapsed).toBe(true);
    expect(mapped.from).toBe(mapped.to);
  });

  it('lo escrito justo detrás del rango no lo agranda', () => {
    const tracker = createChangeTracker();
    const id = tracker.start(DOC.length);
    const { changes } = edit(EditorState.create({ doc: DOC }), { from: 10, insert: 'XX' });
    tracker.record(changes);

    expect(tracker.toCurrent(id, 5, 10)).toMatchObject({ from: 5, to: 10 });
  });

  it('lo escrito DENTRO del rango sí lo agranda', () => {
    const tracker = createChangeTracker();
    const id = tracker.start(DOC.length);
    const { changes } = edit(EditorState.create({ doc: DOC }), { from: 7, insert: 'XX' });
    tracker.record(changes);

    expect(tracker.toCurrent(id, 5, 10)).toMatchObject({ from: 5, to: 12 });
  });

  it('varios cambios seguidos se componen', () => {
    const tracker = createChangeTracker();
    const id = tracker.start(DOC.length);
    let state = EditorState.create({ doc: DOC });
    for (const spec of [{ from: 0, insert: 'AA' }, { from: 0, insert: 'BB' }, { from: 4, insert: 'CC' }]) {
      const step = edit(state, spec);
      state = step.state;
      tracker.record(step.changes);
    }

    // Tres inserciones de 2 unidades antes de "mundo".
    expect(tracker.toCurrent(id, 5, 10)).toMatchObject({ from: 11, to: 16 });
    expect(tracker.toRendered(id, 11, 16)).toMatchObject({ from: 5, to: 10 });
  });

  it('cada compilación lleva sus propios cambios: una empezada después no ve los anteriores', () => {
    const tracker = createChangeTracker();
    const first = tracker.start(DOC.length);
    const step = edit(EditorState.create({ doc: DOC }), { from: 0, insert: 'XX' });
    tracker.record(step.changes);
    const second = tracker.start(step.state.doc.length);

    expect(tracker.toCurrent(first, 5, 10)).toMatchObject({ from: 7, clean: false });
    expect(tracker.toCurrent(second, 7, 12)).toMatchObject({ from: 7, clean: true });
  });

  it('rendered() descarta las compilaciones anteriores y conserva la pintada y las posteriores', () => {
    const tracker = createChangeTracker();
    const first = tracker.start(DOC.length);
    const second = tracker.start(DOC.length);
    const third = tracker.start(DOC.length);

    tracker.rendered(second);

    expect(tracker.has(first)).toBe(false);
    expect(tracker.has(second)).toBe(true);
    expect(tracker.has(third)).toBe(true);
  });

  it('una compilación desconocida devuelve null: nadie mapea contra lo que no sabe', () => {
    const tracker = createChangeTracker();

    expect(tracker.toCurrent(99, 0, 1)).toBeNull();
    expect(tracker.toRendered(99, 0, 1)).toBeNull();
  });

  it('reset() olvida todo (se cambió de documento)', () => {
    const tracker = createChangeTracker();
    const id = tracker.start(DOC.length);

    tracker.reset();

    expect(tracker.has(id)).toBe(false);
    expect(tracker.toCurrent(id, 0, 1)).toBeNull();
  });

  it('los identificadores no se repiten tras un reset', () => {
    const tracker = createChangeTracker();
    const before = tracker.start(1);
    tracker.reset();

    expect(tracker.start(1)).toBeGreaterThan(before);
  });
});
