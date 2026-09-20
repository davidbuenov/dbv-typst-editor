// =============================================================================
// DBV Typst Editor — Tests de la marca visual en la vista previa (RF-16)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Tras un salto de sincronización la vista previa se desplazaba, pero nada
// indicaba qué parte del render correspondía al fuente. Se comprueba que aparece
// una banda sobre el bloque, que se retira sola, que no se lleva por delante la
// carga de páginas, y que el doble clic puede marcar el bloque que resolvió.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const compilePreview = vi.fn();
const previewPage = vi.fn();
const getSyncAnchors = vi.fn();

vi.mock('../services/backend.js', () => ({
  compilePreview: (...args) => compilePreview(...args),
  previewPage: (...args) => previewPage(...args),
  cancelPreview: vi.fn(),
  getSyncAnchors: (...args) => getSyncAnchors(...args),
}));

const { createPreview } = await import('./preview.js');

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const TARGET = { document: '/p/main.typ', root: '/p', singleFile: false, dirtyPath: null, dirtyContent: null };
const ANCHORS = [
  { file: 'cap.typ', line: 3, page: 1, xPt: 56, yPt: 100 },
  { file: 'cap.typ', line: 9, page: 1, xPt: 56, yPt: 250 },
  { file: 'cap.typ', line: 20, page: 2, xPt: 56, yPt: 80 },
];

describe('marca de la sincronización en la vista previa', () => {
  let pagesEl;
  let preview;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    globalThis.IntersectionObserver = ObserverStub;
    globalThis.ResizeObserver = ObserverStub;
    localStorage.clear();
    compilePreview.mockReset().mockResolvedValue({
      ok: true,
      value: {
        generation: 1,
        geometry: [
          { widthPt: 595, heightPt: 842 },
          { widthPt: 595, heightPt: 842 },
        ],
        pages: [],
        warnings: '',
        stale: false,
      },
    });
    getSyncAnchors.mockReset().mockResolvedValue({ ok: true, value: ANCHORS });

    document.body.innerHTML = `
      <div id="pages"></div><pre id="band"></pre>
      <div id="band-splitter"></div><span id="status"></span><span id="zoom"></span>`;
    pagesEl = document.getElementById('pages');
    pagesEl.scrollTo = vi.fn();
    preview = createPreview({
      pagesEl,
      bandEl: document.getElementById('band'),
      bandSplitterEl: document.getElementById('band-splitter'),
      statusEl: document.getElementById('status'),
      zoomLabelEl: document.getElementById('zoom'),
      getTarget: () => TARGET,
    });
    preview.restart();
    await vi.advanceTimersByTimeAsync(10);

    // jsdom no calcula maquetación: se fija a mano la de las páginas.
    [...pagesEl.querySelectorAll('.preview-page')].forEach((page, index) => {
      Object.defineProperty(page, 'offsetHeight', { value: 842, configurable: true });
      Object.defineProperty(page, 'offsetWidth', { value: 595, configurable: true });
      Object.defineProperty(page, 'offsetLeft', { value: 16, configurable: true });
      Object.defineProperty(page, 'offsetTop', { value: 16 + index * 858, configurable: true });
    });
  });

  afterEach(() => vi.useRealTimers());

  const marks = () => pagesEl.querySelectorAll('.preview-sync-mark');

  it('editor → vista previa: además de desplazarse, marca el bloque', async () => {
    const found = await preview.scrollToSource('cap.typ', 9);

    expect(found).toBe(true);
    expect(pagesEl.scrollTo).toHaveBeenCalled();
    expect(marks()).toHaveLength(1);
  });

  it('la banda se coloca sobre el bloque y cubre hasta la ancla siguiente', async () => {
    await preview.scrollToSource('cap.typ', 3);

    const mark = marks()[0];
    // Escala 1: 842 px de alto para 842 pt. Ancla en y=100 → top = 16 + 100.
    expect(mark.style.top).toBe('116px');
    expect(mark.style.left).toBe('16px');
    expect(mark.style.width).toBe('595px');
    // Hasta la ancla siguiente de la misma página: 250 - 100 = 150 pt.
    expect(mark.style.height).toBe('150px');
  });

  it('en la segunda página la banda se coloca contra el desplazamiento de esa página', async () => {
    await preview.scrollToSource('cap.typ', 20);

    expect(marks()[0].style.top).toBe(`${16 + 858 + 80}px`);
  });

  it('se retira sola', async () => {
    await preview.scrollToSource('cap.typ', 3);
    expect(marks()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(5300);

    expect(marks()).toHaveLength(0);
  });

  it('una marca nueva sustituye a la anterior en vez de acumularse', async () => {
    await preview.scrollToSource('cap.typ', 3);
    await preview.scrollToSource('cap.typ', 9);

    expect(marks()).toHaveLength(1);
  });

  it('no deja de ser inerte: no captura el ratón ni cuenta como página', async () => {
    await preview.scrollToSource('cap.typ', 3);

    expect(pagesEl.querySelectorAll('.preview-page')).toHaveLength(2);
    expect(marks()[0].classList.contains('preview-page')).toBe(false);
  });

  it('flashAnchor (doble clic en el render) marca el bloque resuelto', async () => {
    await preview.scrollToSource('cap.typ', 3); // rellena la tabla de anclas
    await vi.advanceTimersByTimeAsync(5300);
    expect(marks()).toHaveLength(0);

    preview.flashAnchor(ANCHORS[1]);

    expect(marks()).toHaveLength(1);
    // Último bloque de la página 1: alto por defecto de 60 pt.
    expect(marks()[0].style.height).toBe('60px');
  });

  it('un ancla de una página que no existe no rompe nada', () => {
    expect(() => preview.flashAnchor({ file: 'x.typ', line: 1, page: 99, xPt: 0, yPt: 0 })).not.toThrow();
    expect(marks()).toHaveLength(0);
  });

  it('sin tabla de anclas no hay salto ni marca', async () => {
    getSyncAnchors.mockResolvedValue({ ok: false, error: { message: 'x' } });
    preview.restart();
    await vi.advanceTimersByTimeAsync(10);

    const found = await preview.scrollToSource('cap.typ', 3);

    expect(found).toBe(false);
    expect(marks()).toHaveLength(0);
  });
});
