// =============================================================================
// DBV Typst Editor — Asistente de diagramas de Gantt (RF-49)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cableado DOM sobre `ganttModel.js` (puro) — mismo reparto que
// `sequenceEditor.js`. Una lista de tareas (nombre + fecha de inicio + fecha
// de fin, con `<input type="date">` nativo) es toda la superficie que hace
// falta; ni lienzo ni vista previa en vivo, mismo criterio de alcance que
// RF-48.

import { t } from '../i18n/i18n.js';
import { positionPanelNear, registerPanel } from '../panels/registerPanel.js';
import {
  addTask,
  createEmptyGanttChart,
  ganttChartToCode,
  ganttyImportLine,
  hasGanttyImport,
  removeTask,
} from './ganttModel.js';
import { insertGeneratedCode } from './insertGeneratedCode.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 */
export function createGanttEditor({ panelEl, getView }) {
  const find = (name) => panelEl.querySelector(`[data-gantt="${name}"]`);

  const nameInput = find('task-name');
  const startInput = find('task-start');
  const endInput = find('task-end');
  const addTaskEl = find('add-task');
  const tasksListEl = find('tasks');
  const hintEl = find('hint');
  const insertEl = find('insert');

  let chart = createEmptyGanttChart();

  function setHint(key) {
    hintEl.textContent = t(key);
  }

  function renderTasks() {
    tasksListEl.replaceChildren(
      ...chart.tasks.map((task, index) => {
        const row = document.createElement('div');
        row.className = 'sequence-editor__row';
        const text = document.createElement('span');
        text.className = 'sequence-editor__row-text';
        text.textContent = `${task.name} — ${task.start} → ${task.end}`;
        row.append(text);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'sequence-editor__remove';
        removeButton.setAttribute('aria-label', t('sequence.remove'));
        removeButton.textContent = '✕';
        removeButton.addEventListener('click', () => {
          chart = removeTask(chart, index);
          renderTasks();
        });
        row.append(removeButton);
        return row;
      }),
    );
  }

  addTaskEl?.addEventListener('click', () => {
    if (startInput.value && endInput.value && startInput.value > endInput.value) {
      setHint('gantt.badRange');
      return;
    }
    const before = chart.tasks.length;
    chart = addTask(chart, nameInput.value, startInput.value, endInput.value);
    if (chart.tasks.length === before) {
      setHint('gantt.needFields');
      return;
    }
    nameInput.value = '';
    startInput.value = '';
    endInput.value = '';
    nameInput.focus();
    renderTasks();
    setHint('gantt.hintDefault');
  });

  insertEl?.addEventListener('click', () => {
    const view = getView();
    const code = ganttChartToCode(chart);
    if (!view || !code) {
      setHint('gantt.needOneTask');
      return;
    }

    const needsImport = !hasGanttyImport(view.state.doc.toString());
    const importText = needsImport ? `${ganttyImportLine()}\n\n` : '';

    insertGeneratedCode(view, { code, importText });
    panel.close();
  });

  const panel = registerPanel(panelEl, { closeOnOutsideClick: false });

  return {
    openNear(triggerEl) {
      chart = createEmptyGanttChart();
      nameInput.value = '';
      startInput.value = '';
      endInput.value = '';
      renderTasks();
      setHint('gantt.hintDefault');

      positionPanelNear(panelEl, triggerEl);
      panel.open();
      nameInput.focus();
    },
    close: panel.close,
  };
}
