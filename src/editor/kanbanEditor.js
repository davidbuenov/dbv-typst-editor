// =============================================================================
// DBV Typst Editor — Asistente de tableros Kanban (RF-50)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cableado DOM sobre `kanbanModel.js` (puro) — mismo reparto que
// `sequenceEditor.js`/`ganttEditor.js`. A diferencia de esos dos, la lista es
// de DOS niveles (columnas, y dentro de cada una sus tarjetas), así que cada
// columna se renderiza con su propio mini-formulario de tarjeta en vez de un
// único formulario global — el resto del criterio es el mismo: sin lienzo ni
// vista previa en vivo (RF-50 no la necesita, `ADR-DECISION-004`/`006`).

import { t } from '../i18n/i18n.js';
import { positionPanelNear, registerPanel } from '../panels/registerPanel.js';
import {
  addCard,
  addColumn,
  boardToKantanCode,
  createEmptyBoard,
  hasKantanImport,
  kantanImportLine,
  removeCard,
  removeColumn,
} from './kanbanModel.js';
import { insertGeneratedCode } from './insertGeneratedCode.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 */
export function createKanbanEditor({ panelEl, getView }) {
  const find = (name) => panelEl.querySelector(`[data-kanban="${name}"]`);

  const columnNameInput = find('column-name');
  const addColumnEl = find('add-column');
  const columnsEl = find('columns');
  const hintEl = find('hint');
  const insertEl = find('insert');

  let board = createEmptyBoard();

  function setHint(key) {
    hintEl.textContent = t(key);
  }

  function buildRemoveButton(onRemove) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sequence-editor__remove';
    button.setAttribute('aria-label', t('sequence.remove'));
    button.textContent = '✕';
    button.addEventListener('click', onRemove);
    return button;
  }

  function buildCardRow(card, columnIndex, cardIndex) {
    const row = document.createElement('div');
    row.className = 'sequence-editor__row';
    const text = document.createElement('span');
    text.className = 'sequence-editor__row-text';
    text.textContent = card.assignee ? `${card.name} — ${card.assignee}` : card.name;
    row.append(text);
    row.append(
      buildRemoveButton(() => {
        board = removeCard(board, columnIndex, cardIndex);
        renderColumns();
      }),
    );
    return row;
  }

  function buildCardForm(columnIndex) {
    const form = document.createElement('div');
    form.className = 'kanban-editor__card-form';

    // `data-kanban-field` es un atributo estable para tests/automatización —
    // el formulario se genera en JS (una columna dinámica no puede tener sus
    // campos ya en el HTML estático), así que no hay ningún `id` fijo al que
    // engancharse como sí lo hay en el resto de asistentes de esta versión.
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'diagram-editor__input diagram-editor__input--grow';
    nameInput.placeholder = t('kanban.cardPlaceholder');
    nameInput.dataset.kanbanField = 'name';

    const assigneeInput = document.createElement('input');
    assigneeInput.type = 'text';
    assigneeInput.className = 'diagram-editor__input';
    assigneeInput.placeholder = t('kanban.assigneePlaceholder');
    assigneeInput.dataset.kanbanField = 'assignee';

    const hardnessInput = document.createElement('input');
    hardnessInput.type = 'text';
    hardnessInput.className = 'diagram-editor__input kanban-editor__narrow-input';
    hardnessInput.placeholder = t('kanban.hardnessPlaceholder');
    hardnessInput.dataset.kanbanField = 'hardness';

    const priorityInput = document.createElement('input');
    priorityInput.type = 'text';
    priorityInput.className = 'diagram-editor__input kanban-editor__narrow-input';
    priorityInput.placeholder = t('kanban.priorityPlaceholder');
    priorityInput.dataset.kanbanField = 'priority';

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'button button--compact button--ghost';
    addButton.textContent = t('sequence.add');
    addButton.dataset.kanbanField = 'add-card';

    function addCardFromForm() {
      const before = board.columns[columnIndex].cards.length;
      board = addCard(board, columnIndex, {
        name: nameInput.value,
        assignee: assigneeInput.value,
        hardness: hardnessInput.value,
        priority: priorityInput.value,
      });
      if (board.columns[columnIndex].cards.length === before) {
        setHint('kanban.needCardName');
        return;
      }
      nameInput.value = '';
      assigneeInput.value = '';
      hardnessInput.value = '';
      priorityInput.value = '';
      nameInput.focus();
      renderColumns();
      setHint('kanban.hintDefault');
    }

    addButton.addEventListener('click', addCardFromForm);
    nameInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      addCardFromForm();
    });

    form.append(nameInput, assigneeInput, hardnessInput, priorityInput, addButton);
    return form;
  }

  function buildColumn(column, columnIndex) {
    const wrapper = document.createElement('div');
    wrapper.className = 'kanban-editor__column';
    wrapper.dataset.kanbanColumn = String(columnIndex);

    const header = document.createElement('div');
    header.className = 'kanban-editor__column-header';
    const title = document.createElement('strong');
    title.textContent = column.name;
    header.append(title);
    header.append(
      buildRemoveButton(() => {
        board = removeColumn(board, columnIndex);
        renderColumns();
      }),
    );
    wrapper.append(header);

    const cardList = document.createElement('div');
    cardList.className = 'sequence-editor__list';
    cardList.append(...column.cards.map((card, cardIndex) => buildCardRow(card, columnIndex, cardIndex)));
    wrapper.append(cardList);

    wrapper.append(buildCardForm(columnIndex));
    return wrapper;
  }

  function renderColumns() {
    columnsEl.replaceChildren(...board.columns.map((column, index) => buildColumn(column, index)));
  }

  function addColumnFromInput() {
    board = addColumn(board, columnNameInput.value);
    columnNameInput.value = '';
    columnNameInput.focus();
    renderColumns();
  }

  addColumnEl?.addEventListener('click', addColumnFromInput);
  columnNameInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addColumnFromInput();
  });

  insertEl?.addEventListener('click', () => {
    const view = getView();
    const code = boardToKantanCode(board);
    if (!view || !code) {
      setHint('kanban.needOneColumn');
      return;
    }

    const needsImport = !hasKantanImport(view.state.doc.toString());
    const importText = needsImport ? `${kantanImportLine()}\n\n` : '';

    insertGeneratedCode(view, { code, importText });
    panel.close();
  });

  const panel = registerPanel(panelEl, { closeOnOutsideClick: false });

  return {
    openNear(triggerEl) {
      board = createEmptyBoard();
      columnNameInput.value = '';
      renderColumns();
      setHint('kanban.hintDefault');

      positionPanelNear(panelEl, triggerEl, { width: 640 });
      panel.open();
      columnNameInput.focus();
    },
    close: panel.close,
  };
}
