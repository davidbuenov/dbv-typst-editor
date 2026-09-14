// =============================================================================
// DBV Typst Editor — Tests de insertGeneratedCode
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { insertGeneratedCode } from './insertGeneratedCode.js';

function makeView(doc, selection) {
  const state = EditorState.create({ doc, selection });
  let dispatched = null;
  const view = {
    state,
    dispatch: (spec) => {
      dispatched = spec;
    },
    focus: () => {},
  };
  return { view, getDispatched: () => dispatched };
}

describe('insertGeneratedCode', () => {
  it('inserta el código en el cursor sin import cuando ya existe', () => {
    const { view, getDispatched } = makeView('= Título\n', { anchor: 9 });
    insertGeneratedCode(view, { code: '#diagram(...)', importText: '' });

    const dispatched = getDispatched();
    expect(dispatched.changes).toHaveLength(1);
    expect(dispatched.changes[0].insert).toBe('\n#diagram(...)\n');
  });

  it('antepone el import cuando hace falta', () => {
    const { view, getDispatched } = makeView('= Título\n', { anchor: 9 });
    insertGeneratedCode(view, { code: '#diagram(...)', importText: '#import "@preview/cetz:0.5.2"\n\n' });

    const dispatched = getDispatched();
    expect(dispatched.changes).toHaveLength(2);
    expect(dispatched.changes[0]).toEqual({ from: 0, to: 0, insert: '#import "@preview/cetz:0.5.2"\n\n' });
    expect(dispatched.selection.anchor).toBe('#import "@preview/cetz:0.5.2"\n\n'.length + 9 + '\n#diagram(...)\n'.length);
  });

  it('no añade salto de línea previo cuando el cursor está al principio del documento', () => {
    const { view, getDispatched } = makeView('', { anchor: 0 });
    insertGeneratedCode(view, { code: '#diagram(...)', importText: '' });

    expect(getDispatched().changes[0].insert).toBe('#diagram(...)\n');
  });

  it('sustituye replaceRange en vez de insertar en el cursor', () => {
    const { view, getDispatched } = makeView('#diagram(a)\n', { anchor: 0 });
    insertGeneratedCode(view, { code: '#diagram(b)', importText: '', replaceRange: { from: 0, to: 11 } });

    const dispatched = getDispatched();
    expect(dispatched.changes).toEqual([{ from: 0, to: 11, insert: '#diagram(b)' }]);
    expect(dispatched.selection.anchor).toBe(11);
  });

  it('con replaceRange e import, el cursor tiene en cuenta el desplazamiento del import', () => {
    const { view, getDispatched } = makeView('#diagram(a)\n', { anchor: 0 });
    insertGeneratedCode(view, {
      code: '#diagram(b)',
      importText: '#import "x"\n\n',
      replaceRange: { from: 0, to: 11 },
    });

    const dispatched = getDispatched();
    expect(dispatched.changes).toEqual([
      { from: 0, to: 0, insert: '#import "x"\n\n' },
      { from: 0, to: 11, insert: '#diagram(b)' },
    ]);
    expect(dispatched.selection.anchor).toBe('#import "x"\n\n'.length + 11);
  });
});
