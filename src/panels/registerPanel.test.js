// =============================================================================
// DBV Typst Editor — Tests del registro de paneles flotantes
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Este fichero existe por un fallo que estuvo a un paso de ocurrir al retirar
// `#btn-launcher-universe` en RF-25 (riesgo R-25 del plan). El array de
// disparadores se construía con `[].concat(opts.trigger)` sin filtrar, y
// `el('x')` devuelve `null` cuando el botón ya no está en el HTML: el
// `addEventListener` de dentro habría lanzado durante el cableado inicial. Eso
// no degrada el panel afectado — impide que arranque la aplicación entera.

import { describe, expect, it } from 'vitest';
import { registerPanel } from './registerPanel.js';

describe('registerPanel', () => {
  function crearPanel() {
    const panel = document.createElement('div');
    panel.className = 'floating-panel hidden';
    document.body.append(panel);
    return panel;
  }

  it('tolera un disparador nulo sin romper el arranque', () => {
    const panel = crearPanel();
    const boton = document.createElement('button');
    document.body.append(boton);

    // Exactamente la forma del array de `main.js` cuando uno de los botones ya
    // no existe en el HTML.
    expect(() => registerPanel(panel, { trigger: [boton, null], toggle: true })).not.toThrow();
  });

  it('el disparador que sí existe sigue abriendo el panel', () => {
    const panel = crearPanel();
    const boton = document.createElement('button');
    document.body.append(boton);

    registerPanel(panel, { trigger: [null, boton], toggle: true });
    boton.click();

    expect(panel.classList.contains('hidden')).toBe(false);
  });

  it('acepta un disparador suelto, no solo un array', () => {
    const panel = crearPanel();
    const boton = document.createElement('button');
    document.body.append(boton);

    registerPanel(panel, { trigger: boton, toggle: true });
    boton.click();

    expect(panel.classList.contains('hidden')).toBe(false);
  });
});
