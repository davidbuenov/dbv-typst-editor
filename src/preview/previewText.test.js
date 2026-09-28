// =============================================================================
// DBV Typst Editor — Tests de buscar y copiar en la vista previa (RF-82)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boundaryAt, createMatchCursor, rangeRects, textBetween, toCss } from './textSelection.js';
import { createPreviewText } from './previewText.js';

// Dos líneas de 10 pt de alto; cada carácter mide 6 pt de ancho.
const LINE_1 = 'Hola gato';
const LINE_2 = 'que duerme';
function pageText() {
  const boxes = [];
  [...LINE_1].forEach((_, i) => boxes.push([72 + i * 6, 100, 6, 10]));
  boxes.push([72 + LINE_1.length * 6, 100, 0, 0]); // separador entre líneas
  [...LINE_2].forEach((_, i) => boxes.push([72 + i * 6, 115, 6, 10]));
  return { text: `${LINE_1} ${LINE_2}`, boxes };
}

describe('selección sobre la capa de texto (funciones puras)', () => {
  it('boundaryAt da el hueco entre caracteres más cercano, en la línea del puntero', () => {
    const text = pageText();
    expect(boundaryAt(text, { xPt: 72 + 5 * 6 + 1, yPt: 105 })).toBe(5); // antes de la «g»
    expect(boundaryAt(text, { xPt: 72 + 5 * 6 + 5, yPt: 105 })).toBe(6); // pasada la mitad de la «g»
    expect(boundaryAt(text, { xPt: 10, yPt: 118 })).toBe(10); // antes de la primera letra de la línea 2
    expect(boundaryAt(text, { xPt: 500, yPt: 118 })).toBe(20); // tras la última
    expect(boundaryAt(text, { xPt: 80, yPt: 300 })).toBeGreaterThanOrEqual(10); // por debajo: la última línea
  });

  it('rangeRects da un rectángulo por línea, sea cual sea el sentido del arrastre', () => {
    const text = pageText();
    const rects = rangeRects(text, 16, 5, 2);
    expect(rects).toHaveLength(2);
    expect(rects[0]).toMatchObject({ page: 2, xPt: 72 + 5 * 6, yPt: 100, wPt: 4 * 6 });
    expect(rects[1]).toMatchObject({ page: 2, xPt: 72, yPt: 115, wPt: 6 * 6 });
    expect(textBetween(text, 5, 16)).toBe('gato que du');
  });

  it('toCss coloca los rectángulos con cualquier zoom (la misma razón que scrollToPage)', () => {
    const rect = { xPt: 72, yPt: 100, wPt: 30, hPt: 10 };
    for (const zoom of [0.75, 1, 1.5, 2]) {
      const page = { offsetTop: 40, offsetLeft: 16, offsetHeight: 842 * zoom };
      expect(toCss(rect, page, 842)).toEqual({ top: 40 + 100 * zoom, left: 16 + 72 * zoom, width: 30 * zoom, height: 10 * zoom });
    }
  });

  it('el cursor de coincidencias cuenta «n de m» y da la vuelta', () => {
    const cursor = createMatchCursor([{ page: 1 }, { page: 3 }, { page: 7 }]);
    expect([cursor.index(), cursor.count()]).toEqual([0, 3]);
    expect(cursor.prev().page).toBe(7);
    expect(cursor.next().page).toBe(1);
    expect(createMatchCursor([]).current()).toBe(null);
  });
});

describe('barra de búsqueda y selección (RF-82)', () => {
  let host;
  let pages;
  let elements;
  let engine;
  let scrollToPage;
  let engineSearch;
  let enginePageText;
  let controller;
  let clipboard;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
    host = document.createElement('div');
    pages = document.createElement('div');
    host.append(pages);
    document.body.append(host);
    // Tres páginas A4 a zoom 1, una debajo de otra.
    for (let i = 0; i < 3; i += 1) {
      const page = document.createElement('div');
      page.className = 'preview-page';
      Object.defineProperties(page, {
        offsetTop: { value: i * 860 },
        offsetLeft: { value: 16 },
        offsetHeight: { value: 842 },
      });
      pages.append(page);
    }
    const make = (tag) => {
      const node = document.createElement(tag);
      host.append(node);
      return node;
    };
    elements = { bar: make('div'), input: make('input'), count: make('span'), caseToggle: make('button'), prev: make('button'), next: make('button'), close: make('button') };
    elements.bar.classList.add('hidden');
    engine = 'inproc';
    scrollToPage = vi.fn();
    engineSearch = vi.fn(async () => ({
      ok: true,
      value: [
        { page: 1, rects: [{ page: 1, xPt: 72, yPt: 100, wPt: 24, hPt: 10 }] },
        { page: 3, rects: [{ page: 3, xPt: 72, yPt: 400, wPt: 24, hPt: 10 }] },
      ],
    }));
    enginePageText = vi.fn(async () => ({ ok: true, value: pageText() }));
    clipboard = { writeText: vi.fn(async () => {}) };
    Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
    controller = createPreviewText({
      pagesEl: pages,
      hostEl: host,
      elements,
      getGeneration: () => 7,
      isInproc: () => engine === 'inproc',
      getPageHeightPt: () => 842,
      scrollToPage,
      // Página 2, en pt: el punto de pantalla es el de la página (sin desplazamiento).
      pointAt: (x, y) => ({ page: 2, xPt: x, yPt: y }),
      engineSearch,
      enginePageText,
      t: (key) => ({ 'previewFind.count': '{n} de {m}' })[key] ?? key,
    });
  });

  afterEach(() => vi.useRealTimers());

  const keydown = (target, init) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  const pointer = (type, x, y) => pages.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }));

  it('Ctrl+F abre la barra; busca en todas las páginas, marca y lleva a cada coincidencia', async () => {
    keydown(pages, { key: 'f', ctrlKey: true });
    expect(elements.bar.classList.contains('hidden')).toBe(false);
    elements.input.value = 'gato';
    elements.input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(250);

    expect(engineSearch).toHaveBeenCalledWith(7, 'gato', false);
    expect(elements.count.textContent).toBe('1 de 2');
    expect(scrollToPage).toHaveBeenLastCalledWith(1, 100);
    const hits = pages.querySelectorAll('.preview-find-hit');
    expect(hits).toHaveLength(2);
    expect(hits[1].style.top).toBe(`${2 * 860 + 400}px`);

    keydown(elements.input, { key: 'Enter' });
    expect(elements.count.textContent).toBe('2 de 2');
    expect(scrollToPage).toHaveBeenLastCalledWith(3, 400);
    keydown(elements.input, { key: 'Enter', shiftKey: true });
    expect(elements.count.textContent).toBe('1 de 2');

    keydown(elements.input, { key: 'Escape' });
    expect(pages.querySelectorAll('.preview-find-hit')).toHaveLength(0);
  });

  it('con el motor clásico la barra dice por qué no hay búsqueda y no pregunta al motor', async () => {
    engine = 'classic';
    controller.openFind();
    expect(elements.input.disabled).toBe(true);
    expect(elements.count.textContent).toBe('previewFind.classic');
    expect(engineSearch).not.toHaveBeenCalled();
  });

  it('arrastrar más de 4 px selecciona, Ctrl+C copia, y el clic que sigue no sigue un enlace', async () => {
    pointer('pointerdown', 72 + 5 * 6 + 1, 105);
    pointer('pointermove', 72 + 5 * 6 + 2, 105);
    expect(pages.classList.contains('is-selecting')).toBe(false);
    pointer('pointermove', 72 + 3 * 6 + 1, 118);
    pointer('pointerup', 72 + 3 * 6 + 1, 118);
    await vi.runAllTimersAsync();

    expect(controller.selectedText()).toBe('gato que');
    expect(pages.querySelectorAll('.preview-selection').length).toBe(2);
    expect(controller.consumeClick()).toBe(true);
    expect(controller.consumeClick()).toBe(false);

    keydown(pages, { key: 'c', ctrlKey: true });
    await vi.runAllTimersAsync();
    expect(clipboard.writeText).toHaveBeenCalledWith('gato que');
  });

  it('un clic sin arrastre no selecciona ni bloquea el enlace, y borra la selección anterior', async () => {
    pointer('pointerdown', 72, 105);
    pointer('pointermove', 100, 105);
    pointer('pointerup', 100, 105);
    await vi.runAllTimersAsync();
    controller.consumeClick();
    expect(controller.hasSelection()).toBe(true);

    pointer('pointerdown', 80, 105);
    pointer('pointerup', 80, 105);
    expect(controller.consumeClick()).toBe(false);
    expect(controller.hasSelection()).toBe(false);
  });

  it('una compilación nueva descarta la selección y repite la búsqueda abierta', async () => {
    controller.openFind();
    elements.input.value = 'gato';
    elements.input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(250);
    controller.onNewGeneration();
    await vi.runAllTimersAsync();
    expect(engineSearch).toHaveBeenCalledTimes(2);
  });
});
