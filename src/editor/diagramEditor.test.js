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
//
// El panel se monta con el MISMO marcado que `index.html`: el editor busca sus
// controles por `data-diagram`, así que un test con elementos sueltos pasaría
// aunque el HTML real no los llevara.

import { EditorState } from '@codemirror/state';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDiagramEditor } from './diagramEditor.js';
import { addNode, createEmptyDiagram, diagramToCetzCode } from './diagramModel.js';

const PANEL_HTML = `
  <h2 class="floating-panel__title"></h2>
  <div class="diagram-editor__seed" data-diagram="seed-row">
    <button data-diagram="seed-flowchart" type="button"></button>
    <button data-diagram="seed-block" type="button"></button>
  </div>
  <div class="diagram-editor__toolbar">
    <button data-diagram-shape="rect" type="button">▭</button>
    <button data-diagram-shape="round" type="button">▢</button>
    <button data-diagram-shape="ellipse" type="button">⬭</button>
    <button data-diagram-shape="diamond" type="button">◇</button>
    <button data-diagram-shape="triangle" type="button">△</button>
    <button data-diagram-shape="hexagon" type="button">⬡</button>
    <button data-diagram="connect" type="button"></button>
    <button data-diagram="delete" type="button"></button>
  </div>
  <div class="diagram-editor__toolbar">
    <span class="diagram-editor__colors" data-diagram="colors"></span>
    <span class="diagram-editor__hint" data-diagram="hint"></span>
  </div>
  <div class="diagram-editor__toolbar hidden" data-diagram="edge-row">
    <button data-diagram-dir="end" type="button">→</button>
    <button data-diagram-dir="start" type="button">←</button>
    <button data-diagram-dir="both" type="button">↔</button>
    <button data-diagram-dir="none" type="button">─</button>
    <button data-diagram-edge-style="solid" type="button">━</button>
    <button data-diagram-edge-style="dashed" type="button">┅</button>
    <input data-diagram="edge-label" type="text" />
  </div>
  <div class="diagram-editor__stage">
    <svg data-diagram="canvas" class="diagram-editor__canvas" viewBox="0 0 640 420">
      <g data-diagram="viewport"></g>
    </svg>
    <div class="diagram-editor__zoom">
      <button data-diagram="zoom-out" type="button">−</button>
      <span data-diagram="zoom-level">100%</span>
      <button data-diagram="zoom-in" type="button">+</button>
      <button data-diagram="zoom-fit" type="button">⤢</button>
    </div>
  </div>
  <div class="diagram-editor__toolbar">
    <input data-diagram="caption" type="text" />
    <input data-diagram="label" type="text" />
  </div>
  <button data-diagram="insert" type="button"></button>
`;

function pointerEvent(type, { clientX = 0, clientY = 0 } = {}) {
  return new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });
}

describe('createDiagramEditor', () => {
  let panelEl;
  let svgEl;
  let viewportEl;
  let dispatched;
  let viewMock;

  const find = (name) => panelEl.querySelector(`[data-diagram="${name}"]`);

  beforeEach(() => {
    panelEl = document.createElement('div');
    panelEl.className = 'hidden';
    panelEl.setAttribute('role', 'dialog');
    panelEl.innerHTML = PANEL_HTML;
    document.body.replaceChildren(panelEl);

    svgEl = find('canvas');
    viewportEl = find('viewport');
    // jsdom no calcula layout: sin esto, `clientWidth` es 0 y el código cae
    // al factor de escala 1, que es justo el que quieren estos tests.
    Object.defineProperty(svgEl, 'clientWidth', { value: 0, configurable: true });

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
    const editor = createDiagramEditor({ panelEl, getView: () => viewMock });
    editor.openNear(document.createElement('button'));
    return editor;
  }

  it('al abrir sin diagrama previo, muestra la fila de plantillas de arranque', () => {
    setup();
    expect(find('seed-row').classList.contains('hidden')).toBe(false);
  });

  it('sembrar con la plantilla de flujo crea 3 nodos conectados y oculta las plantillas', () => {
    setup();

    find('seed-flowchart').click();

    expect(viewportEl.querySelectorAll('.diagram-node').length).toBe(3);
    expect(viewportEl.querySelectorAll('.diagram-edge').length).toBe(2);
    expect(find('seed-row').classList.contains('hidden')).toBe(true);
  });

  it('arrastrar un nodo lo mueve de verdad, sin destruir el elemento que empezó el arrastre', () => {
    setup();
    find('seed-block').click();

    const g = viewportEl.querySelector('.diagram-node');
    const shape = g.querySelector('.diagram-node__shape');
    const startX = Number(shape.getAttribute('x'));
    const startY = Number(shape.getAttribute('y'));

    g.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));
    g.dispatchEvent(pointerEvent('pointermove', { clientX: 140, clientY: 130 }));

    // La regresión exacta del bug real: `render()` reconstruía el SVG en
    // cada movimiento, así que el `<g>` que capturó el puntero dejaba de
    // estar en el documento a partir del primer píxel de arrastre.
    expect(viewportEl.contains(g)).toBe(true);
    expect(g.querySelector('.diagram-node__shape')).toBe(shape);

    expect(Number(shape.getAttribute('x'))).toBe(startX + 40);
    expect(Number(shape.getAttribute('y'))).toBe(startY + 30);

    g.dispatchEvent(pointerEvent('pointerup', { clientX: 140, clientY: 130 }));
  });

  it('arrastrar un nodo mueve también el extremo de sus flechas', () => {
    setup();
    find('seed-block').click();

    const firstNode = viewportEl.querySelector('.diagram-node');
    const edge = viewportEl.querySelector('.diagram-edge[data-from="n1"] .diagram-edge__line');
    const startX = Number(edge.getAttribute('x1'));

    firstNode.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    firstNode.dispatchEvent(pointerEvent('pointermove', { clientX: 60, clientY: 0 }));

    expect(Number(edge.getAttribute('x1'))).toBe(startX + 60);
  });

  // El bug de la punta invisible, visto desde el lienzo: si el extremo de la
  // flecha cae en el CENTRO del nodo de destino, la punta queda debajo de la
  // caja (los nodos se pintan sobre las flechas) y no se ve.
  it('la flecha acaba en el borde del nodo de destino, no en su centro', () => {
    setup();
    find('seed-block').click();

    const line = viewportEl.querySelector('.diagram-edge[data-from="n1"] .diagram-edge__line');
    // Semilla "bloques": n2 ocupa x 240..380, así que su centro está en 310.
    expect(Number(line.getAttribute('x2'))).toBe(240);
  });

  it('un clic sin arrastre pone el foco en el texto del nodo para editarlo', () => {
    setup();
    find('seed-block').click();

    const g = viewportEl.querySelector('.diagram-node');
    const label = g.querySelector('.diagram-node__label');
    let focused = false;
    label.focus = () => {
      focused = true;
    };

    g.dispatchEvent(pointerEvent('pointerdown', { clientX: 50, clientY: 50 }));
    g.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 50 }));

    expect(focused).toBe(true);
  });

  it('cada botón de la paleta inserta su forma, con la primitiva SVG que le toca', () => {
    setup();

    panelEl.querySelector('[data-diagram-shape="ellipse"]').click();
    panelEl.querySelector('[data-diagram-shape="diamond"]').click();
    panelEl.querySelector('[data-diagram-shape="round"]').click();

    const shapes = [...viewportEl.querySelectorAll('.diagram-node__shape')].map((el) => el.tagName);
    expect(shapes).toEqual(['ellipse', 'polygon', 'rect']);
  });

  it('un color de la paleta se aplica al nodo elegido', () => {
    setup();
    panelEl.querySelector('[data-diagram-shape="rect"]').click();

    find('colors').querySelector('[data-color="amber"]').click();

    expect(viewportEl.querySelector('.diagram-node__shape').getAttribute('fill')).toBe('#fef3c7');
  });

  // Sin nodo elegido el color no tiene a qué aplicarse: antes que cambiarlo
  // todo o no hacer nada en silencio, el editor lo dice.
  it('pulsar un color sin nodo elegido avisa en vez de no hacer nada', () => {
    setup();

    find('colors').querySelector('[data-color="amber"]').click();

    expect(find('hint').textContent).not.toBe('');
  });

  it('los botones de zoom escalan el grupo contenedor, no cada coordenada', () => {
    setup();
    find('seed-block').click();

    find('zoom-in').click();

    expect(viewportEl.getAttribute('transform')).toContain('scale(1.2)');
    expect(find('zoom-level').textContent).toBe('120%');
  });

  it('arrastrar sobre el fondo panea la vista sin mover ningún nodo', () => {
    setup();
    find('seed-block').click();
    const shape = viewportEl.querySelector('.diagram-node__shape');
    const startX = Number(shape.getAttribute('x'));

    svgEl.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    svgEl.dispatchEvent(pointerEvent('pointermove', { clientX: 50, clientY: 20 }));
    svgEl.dispatchEvent(pointerEvent('pointerup', { clientX: 50, clientY: 20 }));

    expect(viewportEl.getAttribute('transform')).toContain('translate(50, 20)');
    expect(Number(shape.getAttribute('x'))).toBe(startX);
  });

  it('borrar el nodo seleccionado también retira las flechas que lo tocaban', () => {
    setup();
    find('seed-block').click();

    const g = viewportEl.querySelector('.diagram-node');
    g.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));
    g.dispatchEvent(pointerEvent('pointerup', { clientX: 0, clientY: 0 }));

    find('delete').click();

    expect(viewportEl.querySelectorAll('.diagram-node').length).toBe(2);
    expect(viewportEl.querySelectorAll('.diagram-edge').length).toBe(1);
  });

  // Dirección de las flechas: la petición concreta del usuario tras ver el
  // editor de hilbert-editor (2026-09-12).
  it('pulsar una flecha la elige y abre su fila de propiedades', () => {
    setup();
    find('seed-block').click();

    const edge = viewportEl.querySelector('.diagram-edge');
    edge.dispatchEvent(pointerEvent('pointerdown', { clientX: 0, clientY: 0 }));

    expect(edge.classList.contains('diagram-edge--selected')).toBe(true);
    expect(find('edge-row').classList.contains('hidden')).toBe(false);
  });

  it('cambiar la dirección a "los dos extremos" pone punta en ambos lados', () => {
    setup();
    find('seed-block').click();
    viewportEl.querySelector('.diagram-edge').dispatchEvent(pointerEvent('pointerdown'));

    panelEl.querySelector('[data-diagram-dir="both"]').click();

    const line = viewportEl.querySelector('.diagram-edge .diagram-edge__line');
    expect(line.getAttribute('marker-start')).toBe('url(#diagram-arrow)');
    expect(line.getAttribute('marker-end')).toBe('url(#diagram-arrow)');
  });

  it('quitar la dirección deja la línea sin ninguna punta', () => {
    setup();
    find('seed-block').click();
    viewportEl.querySelector('.diagram-edge').dispatchEvent(pointerEvent('pointerdown'));

    panelEl.querySelector('[data-diagram-dir="none"]').click();

    const line = viewportEl.querySelector('.diagram-edge .diagram-edge__line');
    expect(line.getAttribute('marker-end')).toBeNull();
    expect(line.getAttribute('marker-start')).toBeNull();
  });

  it('el trazo discontinuo se ve en el lienzo, no solo al compilar', () => {
    setup();
    find('seed-block').click();
    viewportEl.querySelector('.diagram-edge').dispatchEvent(pointerEvent('pointerdown'));

    panelEl.querySelector('[data-diagram-edge-style="dashed"]').click();

    expect(viewportEl.querySelector('.diagram-edge .diagram-edge__line').getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('el texto de una flecha se dibuja sobre ella', () => {
    setup();
    find('seed-block').click();
    viewportEl.querySelector('.diagram-edge').dispatchEvent(pointerEvent('pointerdown'));

    const input = find('edge-label');
    input.value = 'sí';
    input.dispatchEvent(new Event('change'));

    expect(viewportEl.querySelector('.diagram-edge__label').textContent).toBe('sí');
  });

  it('borrar con una flecha elegida retira la flecha, no un nodo', () => {
    setup();
    find('seed-block').click();
    viewportEl.querySelector('.diagram-edge').dispatchEvent(pointerEvent('pointerdown'));

    find('delete').click();

    expect(viewportEl.querySelectorAll('.diagram-edge').length).toBe(1);
    expect(viewportEl.querySelectorAll('.diagram-node').length).toBe(3);
  });

  it('el pie y la etiqueta de la figura llegan al código insertado', () => {
    setup();
    find('seed-block').click();

    find('caption').value = 'Arquitectura';
    find('caption').dispatchEvent(new Event('input'));
    find('label').value = 'fig:arq';
    find('label').dispatchEvent(new Event('input'));
    find('insert').click();

    const inserted = dispatched.changes.at(-1).insert;
    expect(inserted).toContain('caption: [Arquitectura]');
    // En la MISMA línea que el cierre del `#figure`: con un salto en medio,
    // Typst toma la etiqueta como del párrafo siguiente y `@fig:arq` deja de
    // resolver. Un espacio sí vale (comprobado compilando).
    expect(inserted).toContain(') <fig:arq>');
  });

  it('insertar sin ningún nodo no hace nada (botón inerte, no un documento vacío)', () => {
    setup();

    find('insert').click();

    expect(dispatched).toBeNull();
  });

  it('insertar con nodos genera código CeTZ y cierra el panel', () => {
    setup();
    find('seed-block').click();

    find('insert').click();

    expect(dispatched).not.toBeNull();
    expect(panelEl.classList.contains('hidden')).toBe(true);
  });

  it('reabrir un diagrama existente y pulsar Insertar SUSTITUYE su bloque, no lo duplica (RF-31.3)', () => {
    // Regresión encontrada en la revisión /code-simplify de v0.6.0: antes,
    // "Insertar" siempre escribía en la posición actual del cursor, así que
    // reeditar un diagrama ya insertado dejaba el original intacto y añadía
    // una copia nueva al lado en vez de sustituirlo.
    const importText = '#import "@preview/cetz:0.5.2"\n\n';
    let seedDiagram = addNode(createEmptyDiagram(), { label: 'Único' });
    const originalCode = diagramToCetzCode(seedDiagram);
    const docText = importText + originalCode + '\nTexto después.\n';
    // Cursor en medio del bloque, no al final — si el bug reapareciera,
    // "Insertar" escribiría aquí en vez de sustituir el bloque completo.
    const midCursor = importText.length + Math.floor(originalCode.length / 2);

    viewMock.state = EditorState.create({ doc: docText, selection: { anchor: midCursor } });

    const editor = createDiagramEditor({ panelEl, getView: () => viewMock });
    editor.openNear(document.createElement('button'));

    find('insert').click();

    expect(dispatched).not.toBeNull();
    expect(dispatched.changes).toHaveLength(1);
    const [change] = dispatched.changes;
    expect(change.from).toBe(importText.length);
    expect(change.to).toBe(importText.length + originalCode.length);
    // El texto que sigue al bloque (fuera del rango sustituido) sobrevive.
    expect(docText.slice(change.to)).toBe('\nTexto después.\n');
  });
});
