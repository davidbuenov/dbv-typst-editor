// =============================================================================
// DBV Typst Editor — Tests del visor de datos (RF-98)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { createCsvViewer, ROW_HEIGHT, visibleRange } from './csvViewer.js';

describe('visibleRange', () => {
  it('pinta solo lo visible más un margen', () => {
    expect(visibleRange(0, 10 * ROW_HEIGHT, 100000)).toEqual({ first: 0, last: 20 });
    expect(visibleRange(5000 * ROW_HEIGHT, 10 * ROW_HEIGHT, 100000)).toEqual({ first: 4990, last: 5020 });
    expect(visibleRange(0, 400, 3)).toEqual({ first: 0, last: 3 });
  });
});

describe('createCsvViewer', () => {
  function setup() {
    document.body.innerHTML = `
      <h2 id="title"></h2><input type="checkbox" id="header"><select id="delimiter"><option value=",">,</option><option value=";">;</option><option value="\t">tab</option></select>
      <input id="filter"><select id="filterColumn"></select><span id="count"></span>
      <div id="scroller"><table><thead id="head"></thead><tbody id="body"></tbody></table></div>
      <input type="checkbox" id="asFigure"><input id="caption"><input id="label"><button id="insert"></button><button id="copyStatic"></button>`;
    const ids = ['title', 'header', 'delimiter', 'filter', 'filterColumn', 'count', 'scroller', 'head', 'body', 'asFigure', 'caption', 'label', 'insert', 'copyStatic'];
    const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
    const insertIntoDocument = vi.fn(async () => true);
    const copy = vi.fn(async () => {});
    const notify = vi.fn();
    const viewer = createCsvViewer({ elements, show: vi.fn(), insertIntoDocument, getTargetTyp: () => 'cap/uno.typ', copy, notify });
    return { viewer, elements, insertIntoDocument, copy, notify };
  }

  const csv = 'curso;alumnos\nTFG;12\nTFM;3\nTesis;1\n';

  it('detecta separador y cabecera, y ordena al pulsar la cabecera', () => {
    const { viewer, elements } = setup();
    viewer.open({ text: csv, path: 'C:/p/data/cursos.csv', relative: 'data/cursos.csv' });
    expect(elements.delimiter.value).toBe(';');
    expect(elements.header.checked).toBe(true);
    expect(elements.count.textContent).toContain('3');
    elements.head.querySelectorAll('button')[1].click();
    expect([...elements.body.querySelectorAll('tr td:first-child')].map((td) => td.textContent)).toEqual(['Tesis', 'TFM', 'TFG']);
  });

  it('filtra y copia la vista como tabla Typst', async () => {
    const { viewer, elements, copy } = setup();
    viewer.open({ text: csv, path: 'x.csv', relative: 'x.csv' });
    elements.filter.value = 'tf';
    elements.filter.dispatchEvent(new Event('input'));
    expect(elements.body.querySelectorAll('tr td:first-child')).toHaveLength(2);
    elements.copyStatic.click();
    await Promise.resolve();
    expect(copy.mock.calls[0][0]).toContain('table.header([curso], [alumnos])');
    expect(copy.mock.calls[0][0]).not.toContain('Tesis');
  });

  it('inserta la tabla leída con csv() desde el .typ de destino', async () => {
    const { viewer, elements, insertIntoDocument } = setup();
    viewer.open({ text: csv, path: 'C:/p/data/cursos.csv', relative: 'data/cursos.csv' });
    elements.insert.click();
    await vi.waitFor(() => expect(insertIntoDocument).toHaveBeenCalled());
    expect(insertIntoDocument.mock.calls[0][0]).toContain('csv("../data/cursos.csv", delimiter: ";")');
    expect(insertIntoDocument.mock.calls[0][0]).toContain('align: (left, right)');
  });

  it('un fichero de fuera del proyecto no se puede insertar hasta copiarlo', () => {
    const { viewer, elements } = setup();
    viewer.open({ text: csv, path: 'D:/fuera/x.csv', relative: null });
    expect(elements.insert.disabled).toBe(true);
  });
});
