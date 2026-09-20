// =============================================================================
// DBV Typst Editor — Tests de la sincronización exacta del motor en proceso (RF-57)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Con el motor en proceso, el doble clic ya no busca un ancla de bloque: pregunta
// al backend qué palabra se escribió en ese punto, y la sincronización desde el
// editor marca una caja por línea. Con el motor clásico nada cambia. Se comprueba
// aquí el contrato del frontend con el backend simulado.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const compilePreview = vi.fn();
const previewPage = vi.fn();
const getSyncAnchors = vi.fn();
const engineLocate = vi.fn();
const engineReveal = vi.fn();

vi.mock('../services/backend.js', () => ({
  compilePreview: (...args) => compilePreview(...args),
  previewPage: (...args) => previewPage(...args),
  cancelPreview: vi.fn(),
  getSyncAnchors: (...args) => getSyncAnchors(...args),
  engineLocate: (...args) => engineLocate(...args),
  engineReveal: (...args) => engineReveal(...args),
}));

const { createPreview } = await import('./preview.js');

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const TARGET = { document: '/p/main.typ', root: '/p', singleFile: false, dirtyPath: null, dirtyContent: null };

const outcome = (extra = {}) => ({
  ok: true,
  value: {
    generation: 5,
    geometry: [
      { widthPt: 595, heightPt: 842 },
      { widthPt: 595, heightPt: 842 },
    ],
    pages: [],
    warnings: '',
    stale: false,
    engine: 'inproc',
    diagnostics: [],
    fallbackReason: null,
    ...extra,
  },
});

describe('sincronización exacta con el motor en proceso', () => {
  let pagesEl;
  let hooks;
  let preview;

  async function build(compileResult = outcome()) {
    compilePreview.mockReset().mockResolvedValue(compileResult);
    document.body.innerHTML = `
      <div id="pages"></div><pre id="band"></pre>
      <div id="band-splitter"></div><span id="status"></span><span id="zoom"></span>`;
    pagesEl = document.getElementById('pages');
    pagesEl.scrollTo = vi.fn();
    hooks = {
      onCompileStart: vi.fn().mockReturnValue(11),
      onRendered: vi.fn(),
      onCompiled: vi.fn(),
    };
    preview = createPreview({
      pagesEl,
      bandEl: document.getElementById('band'),
      bandSplitterEl: document.getElementById('band-splitter'),
      statusEl: document.getElementById('status'),
      zoomLabelEl: document.getElementById('zoom'),
      getTarget: () => TARGET,
      ...hooks,
    });
    preview.restart();
    await vi.advanceTimersByTimeAsync(10);
    // jsdom no calcula maquetación: se fija a mano la de las páginas (escala 1).
    [...pagesEl.querySelectorAll('.preview-page')].forEach((page, index) => {
      page.getBoundingClientRect = () => ({
        left: 16,
        right: 611,
        top: 16 + index * 858,
        bottom: 858 + index * 858,
        width: 595,
        height: 842,
      });
      Object.defineProperty(page, 'offsetHeight', { value: 842, configurable: true });
      Object.defineProperty(page, 'offsetWidth', { value: 595, configurable: true });
      Object.defineProperty(page, 'offsetLeft', { value: 16, configurable: true });
      Object.defineProperty(page, 'offsetTop', { value: 16 + index * 858, configurable: true });
    });
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    globalThis.IntersectionObserver = ObserverStub;
    globalThis.ResizeObserver = ObserverStub;
    localStorage.clear();
    engineLocate.mockReset();
    engineReveal.mockReset();
    getSyncAnchors.mockReset().mockResolvedValue({ ok: true, value: [] });
  });

  afterEach(() => vi.useRealTimers());

  const marks = () => [...pagesEl.querySelectorAll('.preview-sync-mark')];

  it('recuerda qué motor compiló lo que se ve', async () => {
    await build(outcome({ engine: 'inproc' }));
    expect(preview.getEngine()).toBe('inproc');

    await build(outcome({ engine: 'classic' }));
    expect(preview.getEngine()).toBe('classic');
  });

  it('un resultado sin el campo engine (versión anterior del backend) es del motor clásico', async () => {
    await build(outcome({ engine: undefined }));

    expect(preview.getEngine()).toBe('classic');
  });

  it('el doble clic pregunta al backend por la palabra bajo el punto, con la generación vigente', async () => {
    await build();
    engineLocate.mockResolvedValue({
      ok: true,
      value: { file: 'cap.typ', startLine: 4, startColumn: 7, endLine: 4, endColumn: 12, from: 30, to: 35 },
    });

    // Punto dentro de la página 1: (100, 50) pt → cliente (116, 66).
    const source = await preview.sourceAt(116, 66);

    expect(engineLocate).toHaveBeenCalledWith(5, 1, 100, 50);
    expect(source).toMatchObject({ file: 'cap.typ', line: 4, column: 7, endColumn: 12, from: 30, to: 35, exact: true });
  });

  it('el punto sobre la segunda página se pide con el número de página correcto', async () => {
    await build();
    engineLocate.mockResolvedValue({ ok: true, value: null });

    await preview.sourceAt(116, 16 + 858 + 30);

    expect(engineLocate).toHaveBeenCalledWith(5, 2, 100, 30);
  });

  it('sin nada con origen en el fuente bajo el punto, no hay resultado', async () => {
    await build();
    engineLocate.mockResolvedValue({ ok: true, value: null });

    expect(await preview.sourceAt(116, 66)).toBeNull();
  });

  it('una generación caducada da null en vez de un salto a un sitio equivocado', async () => {
    await build();
    engineLocate.mockResolvedValue({ ok: false, error: { kind: 'previewExpired', message: 'x' } });

    expect(await preview.sourceAt(116, 66)).toBeNull();
  });

  it('un punto fuera de toda página no llega a preguntar al backend', async () => {
    await build();

    expect(await preview.sourceAt(5, 5)).toBeNull();
    expect(engineLocate).not.toHaveBeenCalled();
  });

  it('con el motor clásico el doble clic sigue por las anclas y no llama a engine_locate', async () => {
    await build(outcome({ engine: 'classic' }));
    getSyncAnchors.mockResolvedValue({
      ok: true,
      value: [{ file: 'a.typ', line: 3, page: 1, xPt: 56, yPt: 40 }],
    });

    const source = await preview.sourceAt(116, 66);

    expect(engineLocate).not.toHaveBeenCalled();
    expect(source).toMatchObject({ file: 'a.typ', line: 3 });
  });

  it('revealSource lleva la vista previa a la primera caja y marca UNA CAJA POR RECTÁNGULO', async () => {
    await build();
    engineReveal.mockResolvedValue({
      ok: true,
      value: [
        { page: 1, xPt: 100, yPt: 200, wPt: 80, hPt: 14 },
        { page: 1, xPt: 56, yPt: 216, wPt: 60, hPt: 14 },
      ],
    });

    const found = await preview.revealSource('main.typ', 10, 40);

    expect(found).toBe(true);
    expect(engineReveal).toHaveBeenCalledWith(5, 'main.typ', 10, 40);
    expect(pagesEl.scrollTo).toHaveBeenCalled();
    expect(marks()).toHaveLength(2);
    expect(marks()[0].style.left).toBe('116px');
    expect(marks()[0].style.top).toBe('216px');
    expect(marks()[0].style.width).toBe('80px');
  });

  it('revealSource con scroll:false solo marca, sin mover la vista', async () => {
    await build();
    engineReveal.mockResolvedValue({ ok: true, value: [{ page: 1, xPt: 100, yPt: 200, wPt: 80, hPt: 14 }] });

    await preview.revealSource('main.typ', 10, 15, { scroll: false });

    expect(pagesEl.scrollTo).not.toHaveBeenCalled();
    expect(marks()).toHaveLength(1);
  });

  it('una marca nueva sustituye a la anterior y todas se retiran solas', async () => {
    await build();
    engineReveal.mockResolvedValue({ ok: true, value: [{ page: 1, xPt: 100, yPt: 200, wPt: 80, hPt: 14 }] });

    await preview.revealSource('main.typ', 1, 5);
    await preview.revealSource('main.typ', 6, 9);
    expect(marks()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(5300);

    expect(marks()).toHaveLength(0);
  });

  it('si no hay nada que marcar, revealSource devuelve false y no deja marcas', async () => {
    await build();
    engineReveal.mockResolvedValue({ ok: true, value: [] });

    expect(await preview.revealSource('main.typ', 1, 5)).toBe(false);
    expect(marks()).toHaveLength(0);
  });

  it('un error del backend al revelar no lanza y devuelve false', async () => {
    await build();
    engineReveal.mockResolvedValue({ ok: false, error: { kind: 'previewExpired', message: 'x' } });

    expect(await preview.revealSource('main.typ', 1, 5)).toBe(false);
  });

  it('con el motor clásico revealSource no hace nada (la sincronización es por bloque)', async () => {
    await build(outcome({ engine: 'classic' }));

    expect(await preview.revealSource('main.typ', 1, 5)).toBe(false);
    expect(engineReveal).not.toHaveBeenCalled();
  });

  it('avisa al seguimiento de cambios: inicio de compilación, pintado y resultado', async () => {
    await build(outcome({ fallbackReason: 'Typst entró en pánico' }));

    expect(hooks.onCompileStart).toHaveBeenCalled();
    expect(hooks.onRendered).toHaveBeenCalledWith(11);
    expect(hooks.onCompiled).toHaveBeenCalledWith({
      ok: true,
      startId: 11,
      engine: 'inproc',
      generation: 5,
      fallbackReason: 'Typst entró en pánico',
    });
    expect(preview.getRenderedStart()).toBe(11);
  });

  it('una compilación con error avisa con ok:false y NO da por pintada la compilación', async () => {
    await build({ ok: false, error: { kind: 'compilationFailed', message: 'error: algo' } });

    expect(hooks.onCompiled).toHaveBeenCalledWith({ ok: false, startId: 11 });
    expect(hooks.onRendered).not.toHaveBeenCalled();
  });
});
