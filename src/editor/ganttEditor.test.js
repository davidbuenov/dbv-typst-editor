// =============================================================================
// DBV Typst Editor — Test del asistente de diagramas de Gantt (RF-49)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { createGanttEditor } from './ganttEditor.js';

const PANEL_HTML = `
  <h2 class="floating-panel__title"></h2>
  <div class="diagram-editor__toolbar">
    <input data-gantt="task-name" type="text" />
    <input data-gantt="task-start" type="date" />
    <input data-gantt="task-end" type="date" />
    <button data-gantt="add-task" type="button"></button>
  </div>
  <div class="sequence-editor__list" data-gantt="tasks"></div>
  <span class="diagram-editor__hint" data-gantt="hint"></span>
  <button data-gantt="insert" type="button"></button>
`;

describe('createGanttEditor', () => {
  let panelEl;
  let dispatched;
  let viewMock;

  const find = (name) => panelEl.querySelector(`[data-gantt="${name}"]`);

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
    const editor = createGanttEditor({ panelEl, getView: () => viewMock });
    editor.openNear(document.createElement('button'));
    return editor;
  }

  function addTask(name, start, end) {
    find('task-name').value = name;
    find('task-start').value = start;
    find('task-end').value = end;
    find('add-task').click();
  }

  it('añadir una tarea la lista y vacía el formulario', () => {
    setup();
    addTask('Investigación', '2026-01-05', '2026-01-20');

    expect(find('tasks').children.length).toBe(1);
    expect(find('tasks').textContent).toContain('Investigación');
    expect(find('task-name').value).toBe('');
  });

  it('sin nombre o sin las dos fechas no añade nada, y avisa', () => {
    setup();
    addTask('', '2026-01-05', '2026-01-20');
    expect(find('tasks').children.length).toBe(0);
    expect(find('hint').textContent).not.toBe('');
  });

  it('una fecha de fin anterior a la de inicio no añade la tarea', () => {
    setup();
    addTask('Tarea', '2026-02-01', '2026-01-01');
    expect(find('tasks').children.length).toBe(0);
  });

  it('quitar una tarea la retira de la lista', () => {
    setup();
    addTask('Investigación', '2026-01-05', '2026-01-20');
    find('tasks').querySelector('.sequence-editor__remove').click();
    expect(find('tasks').children.length).toBe(0);
  });

  it('Insertar sin ninguna tarea no hace nada', () => {
    setup();
    find('insert').click();
    expect(dispatched).toBeNull();
  });

  it('Insertar con una tarea escribe el bloque gantt y el import', () => {
    setup();
    addTask('Investigación', '2026-01-05', '2026-01-20');
    find('insert').click();

    const inserted = dispatched.changes.map((change) => change.insert).join('');
    expect(inserted).toContain('#import "@preview/gantty:0.5.1": gantt');
    expect(inserted).toContain('#gantt((');
    expect(inserted).toContain('name: "Investigación"');
    expect(inserted).toContain('start: "2026-01-05", end: "2026-01-20"');
  });

  it('reabrir el asistente parte de cero', () => {
    const editor = setup();
    addTask('Investigación', '2026-01-05', '2026-01-20');

    editor.openNear(document.createElement('button'));

    expect(find('tasks').children.length).toBe(0);
  });
});
