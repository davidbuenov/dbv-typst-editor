// =============================================================================
// DBV Typst Editor — Test del asistente de diagramas de secuencia (RF-48)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Mismo criterio que `diagramEditor.test.js`/`equationEditor.test.js`: el
// panel se monta con el MISMO marcado que `index.html`.

import { beforeEach, describe, expect, it } from 'vitest';
import { createSequenceEditor } from './sequenceEditor.js';

const PANEL_HTML = `
  <h2 class="floating-panel__title"></h2>
  <div class="diagram-editor__toolbar">
    <input data-sequence="participant-name" type="text" />
    <button data-sequence="add-participant" type="button"></button>
  </div>
  <div class="sequence-editor__list" data-sequence="participants"></div>
  <div class="diagram-editor__toolbar">
    <select data-sequence="message-from"></select>
    <select data-sequence="message-to"></select>
    <input data-sequence="message-comment" type="text" />
    <input data-sequence="message-dashed" type="checkbox" />
    <button data-sequence="add-message" type="button"></button>
  </div>
  <div class="sequence-editor__list" data-sequence="messages"></div>
  <span class="diagram-editor__hint" data-sequence="hint"></span>
  <button data-sequence="insert" type="button"></button>
`;

describe('createSequenceEditor', () => {
  let panelEl;
  let dispatched;
  let viewMock;

  const find = (name) => panelEl.querySelector(`[data-sequence="${name}"]`);

  beforeEach(() => {
    panelEl = document.createElement('div');
    panelEl.setAttribute('role', 'dialog');
    panelEl.innerHTML = PANEL_HTML;
    document.body.replaceChildren(panelEl);

    dispatched = null;
    viewMock = {
      state: { doc: { toString: () => '= Documento\n' }, selection: { main: { from: 12, to: 12 } } },
      dispatch: (spec) => {
        dispatched = spec;
      },
      focus: () => {},
    };
  });

  function setup() {
    const editor = createSequenceEditor({ panelEl, getView: () => viewMock });
    editor.openNear(document.createElement('button'));
    return editor;
  }

  function addParticipant(name) {
    find('participant-name').value = name;
    find('add-participant').click();
  }

  it('añadir un participante lo lista y lo ofrece en los selects de mensaje', () => {
    setup();
    addParticipant('Alice');

    expect(find('participants').children.length).toBe(1);
    expect([...find('message-from').options].map((o) => o.value)).toEqual(['Alice']);
    expect([...find('message-to').options].map((o) => o.value)).toEqual(['Alice']);
  });

  it('quitar un participante lo retira de la lista y de los selects', () => {
    setup();
    addParticipant('Alice');
    find('participants').querySelector('.sequence-editor__remove').click();

    expect(find('participants').children.length).toBe(0);
    expect(find('message-from').options.length).toBe(0);
  });

  it('con menos de dos participantes, añadir un mensaje solo avisa', () => {
    setup();
    addParticipant('Alice');
    find('add-message').click();

    expect(find('messages').children.length).toBe(0);
    expect(find('hint').textContent).not.toBe('');
  });

  it('añade un mensaje entre dos participantes y lo lista', () => {
    setup();
    addParticipant('Alice');
    addParticipant('Bob');
    find('message-from').value = 'Alice';
    find('message-to').value = 'Bob';
    find('message-comment').value = 'hola';
    find('add-message').click();

    expect(find('messages').children.length).toBe(1);
    expect(find('messages').textContent).toContain('Alice');
    expect(find('messages').textContent).toContain('Bob');
    expect(find('messages').textContent).toContain('hola');
    // El campo de comentario se vacía tras insertar, listo para el siguiente.
    expect(find('message-comment').value).toBe('');
  });

  it('Insertar con menos de dos participantes no hace nada', () => {
    setup();
    addParticipant('Alice');
    find('insert').click();

    expect(dispatched).toBeNull();
  });

  it('Insertar con dos participantes y un mensaje escribe el bloque chronos y el import', () => {
    setup();
    addParticipant('Alice');
    addParticipant('Bob');
    find('message-from').value = 'Alice';
    find('message-to').value = 'Bob';
    find('message-comment').value = 'hola';
    find('add-message').click();

    find('insert').click();

    const inserted = dispatched.changes.map((change) => change.insert).join('');
    expect(inserted).toContain('#import "@preview/chronos:0.3.0"');
    expect(inserted).toContain('#chronos.diagram({');
    expect(inserted).toContain('_par("Alice")');
    expect(inserted).toContain('_seq("Alice", "Bob", comment: "hola")');
  });

  it('reabrir el asistente parte de cero, sin arrastrar el diagrama anterior', () => {
    const editor = setup();
    addParticipant('Alice');
    addParticipant('Bob');

    editor.openNear(document.createElement('button'));

    expect(find('participants').children.length).toBe(0);
  });
});
