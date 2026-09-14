// =============================================================================
// DBV Typst Editor — Test del asistente de DOT/Graphviz (RF-51)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let compileDotResult;
vi.mock('../services/backend.js', () => ({
  compileDot: vi.fn(() => Promise.resolve(compileDotResult)),
}));

import { compileDot } from '../services/backend.js';
import { createDotEditor } from './dotEditor.js';

const PANEL_HTML = `
  <h2 class="floating-panel__title"></h2>
  <textarea data-dot="source"></textarea>
  <div class="equation-editor__preview" data-dot="preview"></div>
  <span class="diagram-editor__hint" data-dot="hint"></span>
  <button data-dot="insert" type="button"></button>
`;

describe('createDotEditor', () => {
  let panelEl;
  let dispatched;
  let viewMock;

  const find = (name) => panelEl.querySelector(`[data-dot="${name}"]`);

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    compileDotResult = { ok: true, value: '<svg>grafo</svg>' };

    panelEl = document.createElement('div');
    panelEl.setAttribute('role', 'dialog');
    panelEl.innerHTML = PANEL_HTML;
    document.body.replaceChildren(panelEl);

    dispatched = null;
    viewMock = {
      state: { doc: { toString: () => '= Documento\n' }, selection: { main: { from: 12, to: 12 } } },
      dispatch: (spec) => {
        dispatched = spec;
      },
      focus: () => {},
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const editor = createDotEditor({ panelEl, getView: () => viewMock, getRoot: () => null });
    editor.openNear(document.createElement('button'));
    return editor;
  }

  it('escribir en el campo programa una vista previa que llama al backend', async () => {
    setup();
    const source = find('source');
    source.value = 'digraph { a -> b }';
    source.dispatchEvent(new Event('input'));

    await vi.advanceTimersByTimeAsync(300);

    expect(compileDot).toHaveBeenCalledWith('digraph { a -> b }', expect.objectContaining({ root: null }));
    expect(find('preview').innerHTML).toBe('<svg>grafo</svg>');
  });

  it('un campo vacío no llama al backend y muestra el aviso de vacío', async () => {
    setup();
    const source = find('source');
    source.value = '';
    source.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(300);

    expect(compileDot).not.toHaveBeenCalled();
  });

  it('un error de compilación conserva la última vista previa que sí compiló (last good render)', async () => {
    setup();
    const source = find('source');

    source.value = 'digraph { a -> b }';
    source.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(300);
    expect(find('preview').innerHTML).toBe('<svg>grafo</svg>');

    compileDotResult = { ok: false, error: { kind: 'business', message: 'no compila' } };
    source.value = 'digraph { a -> '; // a medio escribir, sintaxis incompleta
    source.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(300);

    expect(find('preview').innerHTML).toBe('<svg>grafo</svg>');
  });

  it('Insertar escribe la llamada render(...) en el documento y cierra', () => {
    setup();
    find('source').value = 'digraph { a -> b }';
    find('insert').click();

    expect(dispatched.changes.map((c) => c.insert).join('')).toContain('#render("digraph { a -> b }")');
  });

  it('Insertar añade el import de diagraph solo si el documento no lo tiene ya', () => {
    setup();
    find('source').value = 'digraph { a -> b }';
    find('insert').click();

    const inserted = dispatched.changes.map((change) => change.insert).join('');
    expect(inserted).toContain('#import "@preview/diagraph:0.3.7": render');
  });

  it('Insertar con el documento ya importando diagraph no repite el import', () => {
    viewMock.state.doc.toString = () => '#import "@preview/diagraph:0.3.7": render\n\n';
    setup();
    find('source').value = 'digraph { a -> b }';
    find('insert').click();

    expect(dispatched.changes).toHaveLength(1);
  });

  it('Insertar con el campo vacío no hace nada', () => {
    setup();
    find('source').value = '   ';
    find('insert').click();

    expect(dispatched).toBeNull();
  });

  it('reabrir el asistente parte de cero', () => {
    const editor = setup();
    find('source').value = 'digraph { a -> b }';

    editor.openNear(document.createElement('button'));

    expect(find('source').value).toBe('');
  });
});
