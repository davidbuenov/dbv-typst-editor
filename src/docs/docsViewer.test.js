// =============================================================================
// DBV Typst Editor — Tests del visor de documentación (RF-96.6)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { createDocsViewer, splitTarget, wordAt } from './docsViewer.js';

describe('wordAt', () => {
  it('encuentra la función bajo el cursor sin el #', () => {
    expect(wordAt('#table(columns: 2)', 3)).toBe('table');
    expect(wordAt('  table.header([a])', 8)).toBe('table.header');
    expect(wordAt('#figure(', 7)).toBe('figure');
    expect(wordAt('#figure(', 8)).toBe('');
    expect(wordAt('   ', 1)).toBe('');
    expect(wordAt('12pt', 1)).toBe('');
  });
});

describe('splitTarget', () => {
  it('separa ruta y ancla', () => {
    expect(splitTarget('reference/model/table#parameters')).toEqual({ path: 'reference/model/table', anchor: 'parameters' });
    expect(splitTarget('guides/tables')).toEqual({ path: 'guides/tables', anchor: null });
  });
});

describe('createDocsViewer', () => {
  function setup() {
    document.body.innerHTML = '<div id="p"><h2 id="t"></h2><input id="i"><div id="r"></div><article id="c"></article><button id="b"></button></div>';
    const pages = {
      'reference/model/table': '# table\n\nVer [figure](typst:reference/model/figure).\n\n## Parameters {#parameters}\n\ncols',
      'reference/model/figure': '# figure\n\nUna figura.',
    };
    const backend = {
      docsInfo: vi.fn(async () => ({ ok: true, value: { typstVersion: '0.15.1' } })),
      docsSearch: vi.fn(async () => ({ ok: true, value: [{ path: 'reference/model/table', title: 'table', heading: 'Parameters', anchor: 'parameters' }] })),
      docsPage: vi.fn(async (path) => (pages[path] ? { ok: true, value: { path, title: path, markdown: pages[path] } } : { ok: false, error: { message: 'no' } })),
      openExternalUrl: vi.fn(),
    };
    const show = vi.fn();
    const viewer = createDocsViewer({
      elements: { panel: document.getElementById('p'), title: document.getElementById('t'), input: document.getElementById('i'), results: document.getElementById('r'), content: document.getElementById('c'), back: document.getElementById('b') },
      backend,
      show,
    });
    return { viewer, backend, show };
  }

  it('abrir con una búsqueda enseña los resultados y la primera página', async () => {
    const { viewer, show } = setup();
    await viewer.open({ query: 'cabecera de tabla' });
    expect(show).toHaveBeenCalled();
    expect(document.querySelectorAll('.docs__hit')).toHaveLength(1);
    expect(document.getElementById('c').textContent).toContain('table');
  });

  it('los enlaces typst: navegan dentro del visor y Atrás vuelve', async () => {
    const { viewer } = setup();
    await viewer.open({ target: 'reference/model/table' });
    document.querySelector('#c a').click();
    await vi.waitFor(() => expect(document.getElementById('c').textContent).toContain('Una figura.'));
    const back = document.getElementById('b');
    expect(back.disabled).toBe(false);
    back.click();
    await vi.waitFor(() => expect(document.getElementById('c').textContent).toContain('Parameters'));
  });

  it('una página que no existe se dice, sin romper', async () => {
    const { viewer } = setup();
    await viewer.open({ target: 'no/existe' });
    expect(document.getElementById('c').textContent).toContain('no');
  });

  it('openFor va a la página que se llama como la palabra', async () => {
    const { viewer, backend } = setup();
    await viewer.openFor('table');
    expect(backend.docsPage).toHaveBeenCalledWith('reference/model/table');
  });
});
