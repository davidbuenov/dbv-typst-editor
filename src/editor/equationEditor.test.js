// =============================================================================
// DBV Typst Editor — Test del editor visual de ecuaciones (RF-46)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El panel se monta con el MISMO marcado que `index.html` (mismo criterio que
// `diagramEditor.test.js`): el editor busca sus controles por
// `data-equation`, así que un test con elementos sueltos pasaría aunque el
// HTML real no los llevara.

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

let compileEquationResult;
vi.mock('../services/backend.js', () => ({
  compileEquation: vi.fn(() => Promise.resolve(compileEquationResult)),
}));

import { compileEquation } from '../services/backend.js';
import { createEquationEditor } from './equationEditor.js';

const PANEL_HTML = `
  <h2 class="floating-panel__title"></h2>
  <div class="diagram-editor__toolbar"><span data-equation="group-structure"></span></div>
  <div class="diagram-editor__toolbar"><span data-equation="group-bigop"></span></div>
  <div class="diagram-editor__toolbar"><span data-equation="group-matrix"></span></div>
  <div class="diagram-editor__toolbar"><span data-equation="group-symbol"></span></div>
  <div class="diagram-editor__toolbar"><span data-equation="group-operator"></span></div>
  <div class="diagram-editor__toolbar"><span data-equation="group-delimiter"></span></div>
  <input data-equation="source" type="text" />
  <div class="equation-editor__preview" data-equation="preview"></div>
  <span class="diagram-editor__hint" data-equation="hint"></span>
  <div class="diagram-editor__toolbar">
    <input data-equation="latex" type="text" />
    <button data-equation="latex-insert" type="button"></button>
  </div>
  <button data-equation="insert" type="button"></button>
`;

describe('createEquationEditor', () => {
  let panelEl;
  let dispatched;
  let viewMock;

  const find = (name) => panelEl.querySelector(`[data-equation="${name}"]`);

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    compileEquationResult = { ok: true, value: '<svg>fórmula</svg>' };

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
    const editor = createEquationEditor({ panelEl, getView: () => viewMock, getRoot: () => null });
    editor.openNear(document.createElement('button'));
    return editor;
  }

  it('construye un botón por cada pieza del catálogo, repartido en sus grupos', () => {
    setup();
    // 5 estructura + 4 grandes operadores + 1 matriz + 7 símbolos + 7 relaciones + 4 delimitadores = 28
    const allButtons = panelEl.querySelectorAll('.equation-editor__snippet');
    expect(allButtons.length).toBeGreaterThan(20);
    expect(find('group-structure').children.length).toBeGreaterThan(0);
    expect(find('group-symbol').children.length).toBeGreaterThan(0);
  });

  it('pulsar una pieza la inserta en el campo de la fórmula', () => {
    setup();
    panelEl.querySelector('[data-equation-snippet="sqrt"]').click();
    expect(find('source').value).toBe('sqrt()');
  });

  it('escribir en el campo programa una vista previa que llama al backend', async () => {
    setup();
    const source = find('source');
    source.value = 'x^2';
    source.dispatchEvent(new Event('input'));

    await vi.advanceTimersByTimeAsync(300);

    expect(compileEquation).toHaveBeenCalledWith('x^2', expect.objectContaining({ root: null }));
    expect(find('preview').innerHTML).toBe('<svg>fórmula</svg>');
  });

  it('un error de compilación conserva la última fórmula que sí se vio bien (last good render)', async () => {
    setup();
    const source = find('source');

    source.value = 'x^2';
    source.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(300);
    expect(find('preview').innerHTML).toBe('<svg>fórmula</svg>');

    compileEquationResult = { ok: false, error: { kind: 'business', message: 'no compila' } };
    source.value = 'x^2 +'; // a medio escribir, sintaxis incompleta
    source.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(300);

    expect(find('preview').innerHTML).toBe('<svg>fórmula</svg>');
  });

  it('un campo vacío no llama al backend y muestra el aviso de vacío', async () => {
    setup();
    const source = find('source');
    source.value = '';
    source.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(300);

    expect(compileEquation).not.toHaveBeenCalled();
  });

  it('"Pegar LaTeX" inserta la llamada a mi(...) con el LaTeX escapado', () => {
    setup();
    find('latex').value = '\\frac{1}{2}';
    find('latex-insert').click();

    expect(find('source').value).toBe('mi("\\\\frac{1}{2}")');
    expect(find('latex').value).toBe(''); // se vacía tras insertar
  });

  it('Insertar escribe la ecuación envuelta en $...$ en el documento y cierra', () => {
    setup();
    find('source').value = 'x^2 + y^2';
    find('insert').click();

    expect(dispatched.changes[0].insert).toContain('$ x^2 + y^2 $');
  });

  it('Insertar con una fórmula que usa MiTeX añade el import solo una vez', () => {
    setup();
    find('source').value = 'mi("\\\\frac{1}{2}")';
    find('insert').click();

    const inserted = dispatched.changes.map((change) => change.insert).join('');
    expect(inserted).toContain('#import "@preview/mitex:0.2.7": mi');
  });

  it('Insertar con el campo vacío no hace nada', () => {
    setup();
    find('source').value = '   ';
    find('insert').click();

    expect(dispatched).toBeNull();
  });
});
