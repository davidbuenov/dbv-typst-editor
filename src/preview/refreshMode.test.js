// =============================================================================
// DBV Typst Editor — Tests del modo de refresco de la vista previa (RF-15)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El criterio de aceptación de RF-15: en modo manual escribir NO dispara
// ninguna compilación, y la vista se marca visiblemente como desactualizada —
// nunca se enseña contenido viejo como si fuera el actual.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const compilePreview = vi.fn();
const previewPage = vi.fn();
const cancelPreview = vi.fn();

vi.mock('../services/backend.js', () => ({
  compilePreview: (...args) => compilePreview(...args),
  previewPage: (...args) => previewPage(...args),
  cancelPreview: (...args) => cancelPreview(...args),
}));

const { createPreview } = await import('./preview.js');

const TARGET = {
  document: '/proy/main.typ',
  root: '/proy',
  singleFile: false,
  dirtyPath: null,
  dirtyContent: null,
};

/** Respuesta mínima de una compilación con éxito: una página. */
const okOutcome = () => ({
  ok: true,
  value: {
    generation: 1,
    geometry: [{ widthPt: 595, heightPt: 842 }],
    pages: [{ index: 0, svg: '<svg/>' }],
    warnings: '',
    stale: false,
  },
});

function build() {
  document.body.innerHTML = `
    <div id="pages"></div><pre id="band"></pre>
    <div id="band-splitter"></div><span id="status"></span><span id="zoom"></span>
  `;
  const onStaleChange = vi.fn();
  const preview = createPreview({
    pagesEl: document.getElementById('pages'),
    bandEl: document.getElementById('band'),
    bandSplitterEl: document.getElementById('band-splitter'),
    statusEl: document.getElementById('status'),
    zoomLabelEl: document.getElementById('zoom'),
    getTarget: () => TARGET,
    onStaleChange,
  });
  return { preview, onStaleChange };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** jsdom no implementa los observadores del navegador que usa la vista previa
 *  para la carga perezosa de páginas y para "ajustar al ancho". No son objeto de
 *  este test: basta con que existan y no hagan nada. */
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('modo de refresco de la vista previa', () => {
  beforeEach(() => {
    globalThis.IntersectionObserver = ObserverStub;
    globalThis.ResizeObserver = ObserverStub;
    localStorage.clear();
    compilePreview.mockReset().mockResolvedValue(okOutcome());
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('en automático recompila tras la pausa de escritura', async () => {
    const { preview } = build();
    compilePreview.mockClear();

    preview.onContentChanged();
    await vi.advanceTimersByTimeAsync(400);

    expect(compilePreview).toHaveBeenCalledOnce();
  });

  it('en manual escribir NO dispara ninguna compilación', async () => {
    const { preview } = build();
    preview.restart();
    await settle();
    preview.toggleRefreshMode();
    compilePreview.mockClear();

    preview.onContentChanged();
    await vi.advanceTimersByTimeAsync(2000);

    expect(compilePreview).not.toHaveBeenCalled();
    expect(preview.getRefreshMode()).toBe('manual');
  });

  it('en manual marca la vista como desactualizada al escribir', async () => {
    const { preview, onStaleChange } = build();
    preview.restart();
    await settle();
    preview.toggleRefreshMode();

    preview.onContentChanged();

    expect(preview.isStale()).toBe(true);
    expect(onStaleChange).toHaveBeenLastCalledWith(true);
  });

  it('refrescar a mano compila y limpia el estado de desactualizada', async () => {
    const { preview, onStaleChange } = build();
    preview.restart();
    await settle();
    preview.toggleRefreshMode();
    preview.onContentChanged();
    compilePreview.mockClear();

    preview.refreshNow();
    await settle();

    expect(compilePreview).toHaveBeenCalledOnce();
    expect(preview.isStale()).toBe(false);
    expect(onStaleChange).toHaveBeenLastCalledWith(false);
  });

  it('volver a automático con algo pendiente compila de inmediato', async () => {
    // Dejar la vista desactualizada en un modo que promete actualizarse sola
    // sería mentirle al usuario.
    const { preview } = build();
    preview.restart();
    await settle();
    preview.toggleRefreshMode();
    preview.onContentChanged();
    compilePreview.mockClear();

    preview.toggleRefreshMode();
    await settle();

    expect(preview.getRefreshMode()).toBe('auto');
    expect(compilePreview).toHaveBeenCalledOnce();
  });

  it('no marca desactualizada si todavía no se ha pintado nada', async () => {
    // Sin nada compilado en pantalla no hay contenido viejo que desmentir.
    const { preview } = build();
    preview.toggleRefreshMode();

    preview.onContentChanged();

    expect(preview.isStale()).toBe(false);
  });

  it('recuerda el modo entre sesiones', async () => {
    const primera = build();
    primera.preview.toggleRefreshMode();

    const segunda = build();

    expect(segunda.preview.getRefreshMode()).toBe('manual');
  });
});
