// =============================================================================
// DBV Typst Editor — Tests del editor WYSIWYG de diagramas (RF-31)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El primer bug real de este módulo (feedback del usuario, 2026-09-11: "no
// se pueden mover ni arrastrar") era invisible a un test que solo comprobara
// el modelo puro (`diagramModel.test.js`) — hacía falta simular la secuencia
// real de eventos de puntero sobre el DOM que `createDiagramEditor` produce,
// exactamente lo que faltaba antes. `pointerdown/move/up` se simulan con
// `MouseEvent` (jsdom no implementa `PointerEvent`, pero el código solo lee
// `clientX`/`clientY`, que `MouseEvent` sí tiene — el tipo del evento coincide
// por nombre, no por clase, así que `addEventListener('pointerdown', ...)` lo
// recibe igual).

import { EditorState } from '@codemirror/state';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDiagramEditor } from './diagramEditor.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function pointerEvent(type, { clientX = 0, clientY = 0 } = {}) {
  return new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
}

describe('createDiagramEditor', () => {
  let panelEl;
  let svgEl;
  let seedRowEl;
  let seedFlowchartBtn;
  let seedBlockBtn;
  let addNodeButtonEl;
  let connectButtonEl;
  let deleteButtonEl;
  let insertButtonEl;
  let hintEl;
  let dispatched;
  let viewMock;

  beforeEach(() => {
    panelEl = document.createElement('div');
    panelEl.className = 'hidden';
    svgEl = document.createElementNS(SVG_NS, 'svg');
    svgEl.setAttribute('viewBox', '0 0 440 320');
    // jsdom no calcula layout: sin esto, `clientWidth` es 0 y el código cae
    // al factor de escala 1, que es justo el que quieren estos tests.
    Object.defineProperty(svgEl, 'clientWidth', { value: 0, configurable: true });
    seedRowEl = document.createElement('div');
    seedFlowchartBtn = document.createElement('button');
    seedBlockBtn = document.createElement('button');
    addNodeButtonEl = document.createElement('button');
    connectButtonEl = document.createElement('button');
    deleteButtonEl = document.createElement('button');
    insertButtonEl = document.createElement('button');
    hintEl = document.createElement('span');

    dispatched = null;
    const state = EditorState.create({ doc: '= Documento\n' });
    viewMock = {
      state,
      dispatch: (spec) => {
        dispatched = spec;
      },
      focus: () => {},
    };
  });

  function setup() {
    return createDiagramEditor({
      panelEl,
      svgEl,
      seedRowEl,
      seedFlowchartBtn,
      seedBlockBtn,
      addNodeButtonEl,
      connectButtonEl,
      deleteButtonEl,
      insertButtonEl,
      hintEl,
      getView: () => viewMock,
    });
  }

  it('al abrir sin diagrama previo, muestra la fila de plantillas de arranque', () => {
    const editor = setup();
    editor.openNear(document.createElement('button'));
    expect(seedRowEl.classList.contains('hidden')).toBe(false);
  });

  it('sembrar con la plantilla de flujo crea 3 nodos conectados y oculta las plantillas', () => {
    const editor = setup();
    editor.openNear(document.createElement('button'));

    seedFlowchartBtn.click();

    expect(svgEl.querySelectorAll('.diagram-node').length).toBe(3);
    expect(svgEl.querySelectorAll('.diagram-edge').length).toBe(2);
    expect(seedRowEl.classList.contains('hidden')).toBe(true);
  });

  it('arrastrar un nodo lo mueve de verdad, sin destruir el elemento que empezó el arrastre', () => {
    const editor = setup();
    editor.openNear(document.createElement('button'));
    seedFlowchartBtn.click();

    const g = svgEl.querySelector('.diagram-node');
    const rect = g.querySelector('.diagram-node__rect');
    const startX = Number(rect.getAttribute('x'));
    const startY = Number(rect.getAttribute('y'));

    g.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    g.dispatchEvent(pointerEvent('pointermove', { clientX: 140, clientY: 130 }));

    // El regresión exacta del bug real: `render()` reconstruía el SVG en
    // cada movimiento, así que el `<g>` que capturó el puntero dejaba de
    // estar en el documento a partir del primer píxel de arrastre.
    expect(svgEl.contains(g)).toBe(true);
    expect(g.querySelector('.diagram-node__rect')).toBe(rect);

    expect(Number(rect.getAttribute('x'))).toBe(startX + 40);
    expect(Number(rect.getAttribute('y'))).toBe(startY + 30);

    g.dispatchEvent(pointerEvent('pointerup', { clientX: 140, clientY: 130 }));
  });

  it('arrastrar un nodo mueve también el extremo de sus flechas', () => {
    const editor = setup();
    editor.openNear(document.createElement('button'));
    seedFlowchartBtn.click();

    const firstNode = svgEl.querySelector('.diagram-node');
    const edge = svgEl.querySelector('.diagram-edge[data-from="n1"]');
    const startX2 = Number(edge.getAttribute('x1'));

    firstNode.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    firstNode.dispatchEvent(pointerEvent('pointermove', { clientX: 60, clientY: 0 }));

    expect(Number(edge.getAttribute('x1'))).toBe(startX2 + 60);
  });

  it('un clic sin arrastre pone el foco en el texto del nodo para editarlo', () => {
    const editor = setup();
    editor.openNear(document.createElement('button'));
    seedFlowchartBtn.click();

    const g = svgEl.querySelector('.diagram-node');
    const label = g.querySelector('.diagram-node__label');
    let focused = false;
    label.focus = () => {
      focused = true;
    };

    g.dispatchEvent(pointerEvent('pointerdown', { clientX: 50, clientY: 50 }));
    g.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 50 }));

    expect(focused).toBe(true);
  });

  it('borrar el nodo seleccionado también retira las flechas que lo tocaban', () => {
    const editor = setup();
    editor.openNear(document.createElement('button'));
    seedFlowchartBtn.click();

    const g = svgEl.querySelector('.diagram-node');
    g.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    g.dispatchEvent(pointerEvent('pointerup', { clientX: 0, clientY: 0 }));

    deleteButtonEl.click();

    expect(svgEl.querySelectorAll('.diagram-node').length).toBe(2);
    expect(svgEl.querySelectorAll('.diagram-edge').length).toBe(1);
  });

  it('insertar sin ningún nodo no hace nada (botón inerte, no un documento vacío)', () => {
    const editor = setup();
    editor.openNear(document.createElement('button'));

    insertButtonEl.click();

    expect(dispatched).toBeNull();
  });

  it('insertar con nodos genera código CeTZ y cierra el panel', () => {
    const editor = setup();
    editor.openNear(document.createElement('button'));
    seedBlockBtn.click();

    insertButtonEl.click();

    expect(dispatched).not.toBeNull();
    expect(panelEl.classList.contains('hidden')).toBe(true);
  });
});
