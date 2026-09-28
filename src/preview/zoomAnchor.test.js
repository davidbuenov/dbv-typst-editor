// =============================================================================
// DBV Typst Editor — Tests del punto de lectura al cambiar el zoom de la vista previa
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El fallo: al pulsar "Ajustar al ancho" (o +/−) la vista previa saltaba a otra
// página. El zoom cambia el alto de todas las páginas pero `scrollTop` se
// quedaba con los mismos píxeles. jsdom no calcula layout, así que aquí se
// simula: cada página mide `1000 × zoom` px y hay 16 px entre páginas.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/backend.js', () => ({
  compilePreview: vi.fn(),
  previewPage: vi.fn(),
  cancelPreview: vi.fn(),
}));

const { createPreview } = await import('./preview.js');

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const PAGE_PX = 1000;
const GAP_PX = 16;
const PAGES = 30;

function build({ panelWidth = 952 } = {}) {
  document.body.innerHTML = `
    <div id="pages"></div><pre id="band"></pre>
    <div id="band-splitter"></div><span id="status"></span><span id="zoom"></span>
  `;
  const pagesEl = document.getElementById('pages');
  const zoomOf = () => Number(pagesEl.style.getPropertyValue('--preview-zoom') || 1);

  let scrollTop = 0;
  Object.defineProperty(pagesEl, 'scrollTop', {
    get: () => scrollTop,
    set: (v) => {
      scrollTop = v;
    },
  });
  // `fitZoom` = (clientWidth − 32) / 920.
  Object.defineProperty(pagesEl, 'clientWidth', { get: () => panelWidth });

  for (let i = 0; i < PAGES; i++) {
    const pageEl = document.createElement('div');
    pageEl.className = 'preview-page';
    pageEl.dataset.index = String(i);
    Object.defineProperty(pageEl, 'offsetHeight', { get: () => PAGE_PX * zoomOf() });
    Object.defineProperty(pageEl, 'offsetTop', { get: () => GAP_PX + i * (PAGE_PX * zoomOf() + GAP_PX) });
    pagesEl.append(pageEl);
  }

  const preview = createPreview({
    pagesEl,
    bandEl: document.getElementById('band'),
    bandSplitterEl: document.getElementById('band-splitter'),
    statusEl: document.getElementById('status'),
    zoomLabelEl: document.getElementById('zoom'),
    getTarget: () => null,
  });
  return { preview, pagesEl };
}

/** Coloca el borde superior del panel a mitad de la página `index` (0-indexada). */
function scrollToMiddleOf(pagesEl, index) {
  const pageEl = pagesEl.children[index];
  pagesEl.scrollTop = pageEl.offsetTop + pageEl.offsetHeight / 2;
}

describe('la vista previa conserva la página al cambiar el zoom', () => {
  beforeEach(() => {
    globalThis.IntersectionObserver = ObserverStub;
    globalThis.ResizeObserver = ObserverStub;
    localStorage.clear();
  });

  it('"Ajustar al ancho" sigue en la misma página y en el mismo punto de ella', () => {
    // Panel de 1872 px → zoom de ajuste (1872 − 32) / 920 = 2.
    const { preview, pagesEl } = build({ panelWidth: 1872 });
    scrollToMiddleOf(pagesEl, 11);
    expect(preview.getCurrentPage()).toBe(12);

    preview.toggleFitWidth();

    expect(preview.getCurrentPage()).toBe(12);
    const pageEl = pagesEl.children[11];
    expect(pagesEl.scrollTop).toBe(pageEl.offsetTop + pageEl.offsetHeight / 2);
  });

  it('desactivar "Ajustar al ancho" también vuelve a la misma página', () => {
    const { preview, pagesEl } = build({ panelWidth: 1872 });
    preview.toggleFitWidth();
    scrollToMiddleOf(pagesEl, 20);

    preview.toggleFitWidth();

    expect(preview.getCurrentPage()).toBe(21);
  });

  it('acercar, alejar y volver al 100 % no cambian de página', () => {
    const { preview, pagesEl } = build();
    scrollToMiddleOf(pagesEl, 7);

    preview.zoomIn();
    expect(preview.getCurrentPage()).toBe(8);
    preview.zoomOut();
    preview.zoomOut();
    expect(preview.getCurrentPage()).toBe(8);
    preview.zoomReset();
    expect(preview.getCurrentPage()).toBe(8);
  });
});
