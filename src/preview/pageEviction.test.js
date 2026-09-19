// =============================================================================
// DBV Typst Editor — Tests del descarte de páginas de la vista previa
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Un libro real de 220 páginas son 86 MB de SVG. Sin descartar las páginas que
// el lector deja atrás, el DOM vivo crecía sin techo (8,9 GB en un Mac). Aquí se
// comprueba que una página lejana suelta su marcado, conserva su hueco y vuelve
// a pedirse si el lector regresa.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const compilePreview = vi.fn();
const previewPage = vi.fn();

vi.mock('../services/backend.js', () => ({
  compilePreview: (...args) => compilePreview(...args),
  previewPage: (...args) => previewPage(...args),
  cancelPreview: vi.fn(),
}));

const { createPreview, debounceFor } = await import('./preview.js');

/** Observadores controlables, distinguidos por su `rootMargin`. */
const observers = [];
class ControlledObserver {
  constructor(callback, options = {}) {
    this.callback = callback;
    this.margin = options.rootMargin;
    this.watched = new Set();
    observers.push(this);
  }
  observe(el) {
    this.watched.add(el);
  }
  unobserve(el) {
    this.watched.delete(el);
  }
  disconnect() {
    this.watched.clear();
  }
  fire(el, isIntersecting) {
    this.callback([{ target: el, isIntersecting }]);
  }
}
const byMargin = (margin) => observers.filter((o) => o.margin === margin).at(-1);

class ResizeStub {
  observe() {}
  disconnect() {}
}

const TARGET = { document: '/p/main.typ', root: '/p', singleFile: false, dirtyPath: null, dirtyContent: null };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('descarte de páginas lejanas de la vista previa', () => {
  let pagesEl;

  beforeEach(async () => {
    observers.length = 0;
    globalThis.IntersectionObserver = ControlledObserver;
    globalThis.ResizeObserver = ResizeStub;
    localStorage.clear();
    compilePreview.mockReset().mockResolvedValue({
      ok: true,
      value: {
        generation: 1,
        geometry: [{ widthPt: 595, heightPt: 842 }, { widthPt: 595, heightPt: 842 }],
        pages: [{ index: 0, svg: '<svg id="p0"/>' }],
        warnings: '',
        stale: false,
      },
    });
    previewPage.mockReset().mockResolvedValue({ ok: true, value: { svg: '<svg id="again"/>' } });

    document.body.innerHTML = `
      <div id="pages"></div><pre id="band"></pre>
      <div id="band-splitter"></div><span id="status"></span><span id="zoom"></span>`;
    pagesEl = document.getElementById('pages');
    const preview = createPreview({
      pagesEl,
      bandEl: document.getElementById('band'),
      bandSplitterEl: document.getElementById('band-splitter'),
      statusEl: document.getElementById('status'),
      zoomLabelEl: document.getElementById('zoom'),
      getTarget: () => TARGET,
    });
    preview.restart();
    await settle();
  });

  it('una página ya pintada suelta su marcado al alejarse, pero conserva el hueco', () => {
    const page = pagesEl.children[0];
    expect(page.querySelector('svg')).not.toBeNull();

    byMargin('2500px').fire(page, false);

    expect(page.querySelector('svg')).toBeNull();
    expect(page.dataset.loaded).toBeUndefined();
    expect(page.style.getPropertyValue('--page-ratio')).not.toBe('');
  });

  it('una página visible o cercana NO se descarta', () => {
    const page = pagesEl.children[0];

    byMargin('2500px').fire(page, true);

    expect(page.querySelector('svg')).not.toBeNull();
  });

  it('una página descartada vuelve a pedirse cuando el lector regresa', async () => {
    const page = pagesEl.children[0];
    byMargin('2500px').fire(page, false);

    byMargin('600px').fire(page, true);
    await settle();

    expect(previewPage).toHaveBeenCalledWith(1, 0);
    expect(page.querySelector('#again')).not.toBeNull();
  });
});

describe('pausa de escritura adaptativa', () => {
  it('con compilaciones rápidas se queda en el mínimo', () => {
    expect(debounceFor(0)).toBe(350);
    expect(debounceFor(80)).toBe(350);
  });

  it('con un libro de 4,6 s espera lo equivalente a 1,5 compilaciones', () => {
    expect(debounceFor(4600)).toBe(6000); // 6900 ms recortados por el techo
    expect(debounceFor(2000)).toBe(3000);
  });

  it('tiene techo', () => {
    expect(debounceFor(60_000)).toBe(6000);
  });
});

describe('la pausa se adapta a lo que tarda la compilación', () => {
  let preview;

  beforeEach(async () => {
    // `performance` incluido: la vista previa mide con `performance.now()`.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
    observers.length = 0;
    globalThis.IntersectionObserver = ControlledObserver;
    globalThis.ResizeObserver = ResizeStub;
    localStorage.clear();
    document.body.innerHTML = `
      <div id="pages"></div><pre id="band"></pre>
      <div id="band-splitter"></div><span id="status"></span><span id="zoom"></span>`;
    // Una compilación que tarda 4 s de reloj simulado, como el libro de 220 páginas.
    compilePreview.mockReset().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                value: {
                  generation: 1,
                  geometry: [{ widthPt: 595, heightPt: 842 }],
                  pages: [],
                  warnings: '',
                  stale: false,
                },
              }),
            4000
          );
        })
    );
    preview = createPreview({
      pagesEl: document.getElementById('pages'),
      bandEl: document.getElementById('band'),
      bandSplitterEl: document.getElementById('band-splitter'),
      statusEl: document.getElementById('status'),
      zoomLabelEl: document.getElementById('zoom'),
      getTarget: () => TARGET,
    });
    preview.restart();
    await vi.advanceTimersByTimeAsync(5000);
  });

  afterEach(() => vi.useRealTimers());

  it('tras una compilación lenta NO recompila a los 400 ms de dejar de escribir', async () => {
    compilePreview.mockClear();

    preview.onContentChanged();
    await vi.advanceTimersByTimeAsync(500);

    expect(compilePreview).not.toHaveBeenCalled();
  });

  it('pero sí recompila cuando pasa la pausa adaptada (1,5 veces lo que tardó)', async () => {
    compilePreview.mockClear();

    preview.onContentChanged();
    await vi.advanceTimersByTimeAsync(6100);

    expect(compilePreview).toHaveBeenCalledOnce();
  });
});
