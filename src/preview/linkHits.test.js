import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLinkClickGate, linkAt, linkTitle } from './linkHits.js';

const box = (xPt, yPt, wPt, hPt, extra = {}) => ({ xPt, yPt, wPt, hPt, ...extra });

describe('linkAt (RF-72)', () => {
  const links = [box(10, 10, 100, 20, { url: 'https://a' }), box(40, 12, 10, 10, { targetPage: 3 })];

  it('encuentra el enlace bajo el punto, bordes incluidos', () => {
    expect(linkAt(links, { xPt: 15, yPt: 25 })?.url).toBe('https://a');
    expect(linkAt(links, { xPt: 110, yPt: 30 })?.url).toBe('https://a');
    expect(linkAt(links, { xPt: 5, yPt: 5 })).toBeNull();
  });

  it('si se solapan, gana el más pequeño', () => {
    expect(linkAt(links, { xPt: 45, yPt: 15 })?.targetPage).toBe(3);
  });

  it('las coordenadas son de la página: el zoom no cambia el resultado', () => {
    // El frontend convierte la pantalla a pt con `documentPointAt` antes de
    // llamar: el mismo punto de documento a 50 % o 200 % da el mismo enlace.
    for (const zoom of [0.5, 1, 2]) {
      const screen = { x: 45 * zoom, y: 15 * zoom };
      expect(linkAt(links, { xPt: screen.x / zoom, yPt: screen.y / zoom })?.targetPage).toBe(3);
    }
  });
});

describe('createLinkClickGate (R-L1)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('un clic navega tras la espera', () => {
    const onActivate = vi.fn();
    const gate = createLinkClickGate({ onActivate });
    gate.click({ url: 'https://a' });
    vi.advanceTimersByTime(200);
    expect(onActivate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onActivate).toHaveBeenCalledWith({ url: 'https://a' });
  });

  it('un doble clic cancela la navegación', () => {
    const onActivate = vi.fn();
    const gate = createLinkClickGate({ onActivate });
    gate.click({ url: 'https://a' });
    gate.cancel();
    vi.advanceTimersByTime(1000);
    expect(onActivate).not.toHaveBeenCalled();
  });
});

describe('linkTitle', () => {
  it('muestra la URL, o a qué página lleva un enlace interno', () => {
    const t = () => 'Ir a la página {page}';
    expect(linkTitle({ url: 'https://typst.app' }, t)).toBe('https://typst.app');
    expect(linkTitle({ targetPage: 7 }, t)).toBe('Ir a la página 7');
  });
});
