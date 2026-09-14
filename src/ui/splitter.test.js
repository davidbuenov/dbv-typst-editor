// =============================================================================
// DBV Typst Editor — Test del separador redimensionable (RF-41)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Reportado por el usuario en la ventana real: al maximizar, el separador de
// la vista previa se quedaba "bloqueado" sin llegar más a la izquierda, con
// hueco de sobra a la derecha del editor. Causa raíz encontrada leyendo
// `main.js`: `max: 1200` era un tope FIJO en píxeles, ajeno al ancho real de
// `#workspace-view` — en una ventana maximizada ancha, 1200px deja de verse
// como "todo el espacio disponible". El arreglo (`resolveMax` en
// `splitter.js`) acepta también una función del ancho del host; este test
// cubre exactamente esa rama, sin necesitar un navegador real: a diferencia de
// los fallos de `verify-layout.mjs` (que dependen de que el CSS en cascada
// calcule mal una caja), este es puro — con un `getBoundingClientRect` de
// prueba basta para reproducir el mismo cálculo que hace la app.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSplitter } from './splitter.js';

/** Simula un arrastre completo: pointerdown en `clientX` inicial, pointermove al final, pointerup. */
function drag(handleEl, fromX, toX) {
  handleEl.dispatchEvent(new PointerEvent('pointerdown', { clientX: fromX, pointerId: 1 }));
  handleEl.dispatchEvent(new PointerEvent('pointermove', { clientX: toX, pointerId: 1 }));
  handleEl.dispatchEvent(new PointerEvent('pointerup', { clientX: toX, pointerId: 1 }));
}

describe('createSplitter — max dinámico (RF-41)', () => {
  let hostEl;
  let handleEl;
  let hostWidth;

  beforeEach(() => {
    localStorage.clear();
    hostEl = document.createElement('div');
    handleEl = document.createElement('div');
    document.body.append(hostEl, handleEl);

    hostWidth = 1400;
    // jsdom no calcula layout real (por eso `verify-layout.mjs` existe para
    // los fallos de cascada CSS) — para esta pieza basta con controlar el
    // único valor del que depende el cálculo: el ancho del host.
    vi.spyOn(hostEl, 'getBoundingClientRect').mockImplementation(() => ({
      left: 0,
      right: hostWidth,
      top: 0,
      bottom: 0,
      width: hostWidth,
      height: 0,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    hostEl.remove();
    handleEl.remove();
    localStorage.clear();
  });

  it('un `max` numérico se comporta igual que antes (compatibilidad)', () => {
    const splitter = createSplitter(handleEl, {
      hostEl,
      cssVariable: '--preview-width',
      storageKey: 'test-max-numerico',
      measureFrom: 'end',
      min: 240,
      max: 1200,
    });
    drag(handleEl, 1400, 0); // arrastra del todo hacia la izquierda
    expect(hostEl.style.getPropertyValue('--preview-width')).toBe('1200px');
    splitter.apply(0);
  });

  it('un `max` numérico fijo se queda corto en una ventana ancha — el bug real', () => {
    hostWidth = 2400; // "maximizado" en un monitor ancho
    createSplitter(handleEl, {
      hostEl,
      cssVariable: '--preview-width',
      storageKey: 'test-bug-real',
      measureFrom: 'end',
      min: 240,
      max: 1200,
    });
    // Arrastra hasta el borde izquierdo del host: con 2400px de ventana debería
    // poder pedir hasta 2400, pero el tope fijo lo corta en seco a 1200 mucho
    // antes de que el puntero deje de moverse — el síntoma exacto reportado.
    drag(handleEl, 2400, 0);
    expect(hostEl.style.getPropertyValue('--preview-width')).toBe('1200px');
  });

  it('un `max` como función escala con el ancho real del host — el arreglo', () => {
    hostWidth = 2400;
    createSplitter(handleEl, {
      hostEl,
      cssVariable: '--preview-width',
      storageKey: 'test-max-dinamico',
      measureFrom: 'end',
      min: 240,
      max: (width) => Math.max(240, width - 420),
    });
    drag(handleEl, 2400, 0);
    // 2400 - 420 = 1980: muy por encima del tope fijo de 1200 de antes, y
    // proporcional a la ventana real en vez de un número inventado.
    expect(hostEl.style.getPropertyValue('--preview-width')).toBe('1980px');
  });

  it('el `max` dinámico se reevalúa en cada arrastre, no se congela en la creación', () => {
    const splitter = createSplitter(handleEl, {
      hostEl,
      cssVariable: '--preview-width',
      storageKey: 'test-max-vivo',
      measureFrom: 'end',
      min: 240,
      max: (width) => width - 420,
    });
    drag(handleEl, 1400, 0);
    expect(hostEl.style.getPropertyValue('--preview-width')).toBe('980px'); // 1400 - 420

    // La ventana se ensancha (p. ej. se maximiza) DESPUÉS de crear el
    // separador, sin recargar la aplicación — `resolveMax` debe verlo.
    hostWidth = 2400;
    drag(handleEl, 2400, 0);
    expect(hostEl.style.getPropertyValue('--preview-width')).toBe('1980px'); // 2400 - 420
    splitter.apply(0);
  });

  it('nunca baja del mínimo, con `max` numérico o función', () => {
    createSplitter(handleEl, {
      hostEl,
      cssVariable: '--preview-width',
      storageKey: 'test-min',
      measureFrom: 'end',
      min: 240,
      max: (width) => width - 420,
    });
    drag(handleEl, 100, 2000); // intenta encoger por debajo del mínimo
    expect(hostEl.style.getPropertyValue('--preview-width')).toBe('240px');
  });
});
