// =============================================================================
// DBV Typst Editor — Test del asistente de tableros Kanban (RF-50)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { createKanbanEditor } from './kanbanEditor.js';

const PANEL_HTML = `
  <h2 class="floating-panel__title"></h2>
  <div class="diagram-editor__toolbar">
    <input data-kanban="column-name" type="text" />
    <button data-kanban="add-column" type="button"></button>
  </div>
  <div class="kanban-editor__columns" data-kanban="columns"></div>
  <span class="diagram-editor__hint" data-kanban="hint"></span>
  <button data-kanban="insert" type="button"></button>
`;

describe('createKanbanEditor', () => {
  let panelEl;
  let dispatched;
  let viewMock;

  const find = (name) => panelEl.querySelector(`[data-kanban="${name}"]`);
  const columnEl = (index) => find('columns').querySelector(`[data-kanban-column="${index}"]`);
  const field = (columnIndex, name) => columnEl(columnIndex).querySelector(`[data-kanban-field="${name}"]`);

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
    const editor = createKanbanEditor({ panelEl, getView: () => viewMock });
    editor.openNear(document.createElement('button'));
    return editor;
  }

  function addColumn(name) {
    find('column-name').value = name;
    find('add-column').click();
  }

  function addCard(columnIndex, { name, assignee = '', hardness = '', priority = '' }) {
    field(columnIndex, 'name').value = name;
    field(columnIndex, 'assignee').value = assignee;
    field(columnIndex, 'hardness').value = hardness;
    field(columnIndex, 'priority').value = priority;
    field(columnIndex, 'add-card').click();
  }

  it('añadir una columna la pinta y vacía el formulario', () => {
    setup();
    addColumn('Backlog');

    expect(find('columns').children.length).toBe(1);
    expect(find('columns').textContent).toContain('Backlog');
    expect(find('column-name').value).toBe('');
  });

  it('una columna sin nombre no se añade', () => {
    setup();
    addColumn('   ');
    expect(find('columns').children.length).toBe(0);
  });

  it('añadir una tarjeta a una columna la pinta y vacía su formulario', () => {
    setup();
    addColumn('Backlog');
    addCard(0, { name: 'Tarea 1', assignee: 'David' });

    expect(columnEl(0).querySelectorAll('.sequence-editor__row').length).toBe(1);
    expect(columnEl(0).textContent).toContain('Tarea 1');
    expect(columnEl(0).textContent).toContain('David');
    expect(field(0, 'name').value).toBe('');
  });

  it('una tarjeta sin nombre no se añade, y avisa', () => {
    setup();
    addColumn('Backlog');
    addCard(0, { name: '   ' });
    expect(columnEl(0).querySelectorAll('.sequence-editor__row').length).toBe(0);
    expect(find('hint').textContent).not.toBe('');
  });

  it('quitar una tarjeta la retira de su columna', () => {
    setup();
    addColumn('Backlog');
    addCard(0, { name: 'Tarea 1' });
    columnEl(0).querySelector('.sequence-editor__list .sequence-editor__remove').click();
    expect(columnEl(0).querySelectorAll('.sequence-editor__row').length).toBe(0);
  });

  it('quitar una columna la retira del tablero', () => {
    setup();
    addColumn('Backlog');
    addColumn('Hecho');
    columnEl(0).querySelector('.kanban-editor__column-header .sequence-editor__remove').click();
    expect(find('columns').children.length).toBe(1);
    expect(find('columns').textContent).toContain('Hecho');
  });

  it('Insertar sin ninguna columna no hace nada', () => {
    setup();
    find('insert').click();
    expect(dispatched).toBeNull();
  });

  it('Insertar con una columna y una tarjeta escribe el bloque kanban y el import', () => {
    setup();
    addColumn('Backlog');
    addCard(0, { name: 'Tarea 1', hardness: '3', priority: 'alta' });
    find('insert').click();

    const inserted = dispatched.changes.map((change) => change.insert).join('');
    expect(inserted).toContain('#import "@preview/kantan:0.1.0": *');
    expect(inserted).toContain('#kanban(');
    expect(inserted).toContain('font: "Libertinus Serif"');
    expect(inserted).toContain('"Backlog", color: red');
    expect(inserted).toContain('kanban-item(3, "alta", stroke: rgb("#999999"))[Tarea 1]');
  });

  it('reabrir el asistente parte de cero', () => {
    const editor = setup();
    addColumn('Backlog');
    addCard(0, { name: 'Tarea 1' });

    editor.openNear(document.createElement('button'));

    expect(find('columns').children.length).toBe(0);
  });
});
