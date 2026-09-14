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

import { describe, expect, it, vi } from 'vitest';
import { setHelpTrigger } from '../help/helpTrigger.js';
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

// Petición explícita del usuario (2026-09-11): "haz que todas las ventanas
// puedan cerrarse y moverse". Se resuelve en la factoría, así que es aquí
// donde hay que sujetarlo: si alguien vuelve a dejarlo en manos de cada panel,
// estos tests caen.
describe('registerPanel — cabecera automática de los diálogos', () => {
  function crearDialogo(interior = '') {
    const panel = document.createElement('div');
    panel.className = 'floating-panel hidden';
    panel.setAttribute('role', 'dialog');
    panel.innerHTML = interior;
    document.body.append(panel);
    return panel;
  }

  it('un diálogo sin cabecera recibe una con botón de cierre', () => {
    const panel = crearDialogo('<p>contenido</p>');
    registerPanel(panel);

    const cerrar = panel.querySelector('[data-panel-close]');
    expect(cerrar).not.toBeNull();
    expect(cerrar.closest('.panel__header')).not.toBeNull();
  });

  it('ese botón cierra el panel de verdad', () => {
    const panel = crearDialogo();
    const { open } = registerPanel(panel);
    open();

    panel.querySelector('[data-panel-close]').click();

    expect(panel.classList.contains('hidden')).toBe(true);
  });

  it('el título suelto del panel se muda a la cabecera, que si no quedaría vacía', () => {
    const panel = crearDialogo('<h2 class="floating-panel__title">Tabla</h2>');
    registerPanel(panel);

    expect(panel.querySelector('.panel__header > .floating-panel__title')).not.toBeNull();
  });

  it('no duplica el botón de cierre de un panel que ya traía el suyo', () => {
    const panel = crearDialogo(
      '<div class="panel__header"><h2>Ayuda</h2><button data-i18n-title="action.close">✕</button></div>'
    );
    registerPanel(panel);

    expect(panel.querySelectorAll('.panel__header button').length).toBe(1);
  });

  it('arrastrar la cabecera mueve el panel', () => {
    const panel = crearDialogo();
    registerPanel(panel);
    const header = panel.querySelector('.panel__header');

    header.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }));
    header.dispatchEvent(new MouseEvent('pointermove', { clientX: 160, clientY: 140, bubbles: true }));

    expect(panel.style.left).toBe('60px');
    expect(panel.style.top).toBe('40px');
  });

  // Un menú de tres opciones se cierra solo al elegir: una cabecera con "✕"
  // encima estorbaría más de lo que ayuda.
  it('un menú desplegable no recibe cabecera', () => {
    const menu = document.createElement('div');
    menu.className = 'floating-panel hidden';
    menu.setAttribute('role', 'menu');
    document.body.append(menu);

    registerPanel(menu);

    expect(menu.querySelector('[data-panel-close]')).toBeNull();
  });
});

// RF-52: botón "?" opt-in vía `data-help-section` — petición del usuario tras
// probar el asistente de DOT sin ninguna ayuda visual de sintaxis.
describe('registerPanel — botón de ayuda por sección (RF-52)', () => {
  function crearDialogo({ helpSection } = {}) {
    const panel = document.createElement('div');
    panel.className = 'floating-panel hidden';
    panel.setAttribute('role', 'dialog');
    if (helpSection) panel.dataset.helpSection = helpSection;
    document.body.append(panel);
    return panel;
  }

  it('un panel sin data-help-section no gana botón de ayuda', () => {
    const panel = crearDialogo();
    registerPanel(panel);

    expect(panel.querySelector('[data-panel-help]')).toBeNull();
  });

  it('un panel con data-help-section gana un botón "?" en su cabecera', () => {
    const panel = crearDialogo({ helpSection: 'dot' });
    registerPanel(panel);

    const helpButton = panel.querySelector('[data-panel-help]');
    expect(helpButton).not.toBeNull();
    expect(helpButton.closest('.panel__header')).not.toBeNull();
  });

  it('pulsarlo abre la Ayuda en la sección declarada', () => {
    const opened = vi.fn();
    setHelpTrigger(opened);

    const panel = crearDialogo({ helpSection: 'kanban' });
    registerPanel(panel);
    panel.querySelector('[data-panel-help]').click();

    expect(opened).toHaveBeenCalledWith('kanban');
    setHelpTrigger(null);
  });

  it('no duplica el botón de ayuda si el panel ya lo trae', () => {
    const panel = crearDialogo({ helpSection: 'dot' });
    panel.innerHTML = '<div class="panel__header"><button data-panel-help>?</button></div>';
    registerPanel(panel);

    expect(panel.querySelectorAll('[data-panel-help]').length).toBe(1);
  });

  it('ayuda y cierre comparten un mismo grupo, para que space-between no los separe', () => {
    const panel = crearDialogo({ helpSection: 'dot' });
    registerPanel(panel);

    const header = panel.querySelector('.panel__header');
    expect(header.children.length).toBe(1); // el título está ausente en este fixture: solo queda el grupo de acciones
    const actions = header.querySelector('.panel__header-actions');
    expect(actions).not.toBeNull();
    expect(actions.querySelector('[data-panel-help]')).not.toBeNull();
    expect(actions.querySelector('[data-panel-close]')).not.toBeNull();
  });
});
