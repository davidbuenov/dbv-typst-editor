// =============================================================================
// DBV Typst Editor — Asistente de diagramas de secuencia (RF-48)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cableado DOM sobre `sequenceModel.js` (puro) — mismo reparto que
// `diagramEditor.js`/`equationEditor.js`. A diferencia de esos dos, aquí no
// hace falta ni lienzo ni vista previa en vivo: un diagrama de secuencia se
// describe bien con dos listas (participantes, mensajes en orden) — un
// asistente con formulario, tal como dejó abierto `implementation_plan.md`
// para RF-48 ("modo dedicado más simple, dado que un diagrama de secuencia
// es estructuralmente distinto de un lienzo de nodos/flechas libre").

import { t } from '../i18n/i18n.js';
import { registerPanel } from '../panels/registerPanel.js';
import {
  addMessage,
  addParticipant,
  chronosImportLine,
  createEmptySequence,
  hasChronosImport,
  removeMessage,
  removeParticipant,
  sequenceToChronosCode,
} from './sequenceModel.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 */
export function createSequenceEditor({ panelEl, getView }) {
  const find = (name) => panelEl.querySelector(`[data-sequence="${name}"]`);

  const nameInput = find('participant-name');
  const addParticipantEl = find('add-participant');
  const participantsListEl = find('participants');
  const fromSelect = find('message-from');
  const toSelect = find('message-to');
  const commentInput = find('message-comment');
  const dashedInput = find('message-dashed');
  const addMessageEl = find('add-message');
  const messagesListEl = find('messages');
  const hintEl = find('hint');
  const insertEl = find('insert');

  let sequence = createEmptySequence();

  function setHint(key) {
    hintEl.textContent = t(key);
  }

  function buildRow(label, onRemove) {
    const row = document.createElement('div');
    row.className = 'sequence-editor__row';
    const text = document.createElement('span');
    text.className = 'sequence-editor__row-text';
    text.textContent = label;
    row.append(text);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'sequence-editor__remove';
    removeButton.setAttribute('aria-label', t('sequence.remove'));
    removeButton.textContent = '✕';
    removeButton.addEventListener('click', onRemove);
    row.append(removeButton);
    return row;
  }

  function renderParticipants() {
    participantsListEl.replaceChildren(
      ...sequence.participants.map((name) =>
        buildRow(name, () => {
          sequence = removeParticipant(sequence, name);
          renderAll();
        }),
      ),
    );

    for (const select of [fromSelect, toSelect]) {
      const current = select.value;
      select.replaceChildren(
        ...sequence.participants.map((name) => {
          const option = document.createElement('option');
          option.value = name;
          option.textContent = name;
          return option;
        }),
      );
      if (sequence.participants.includes(current)) select.value = current;
    }
  }

  function renderMessages() {
    messagesListEl.replaceChildren(
      ...sequence.messages.map((message, index) => {
        const arrow = message.dashed ? '⇢' : '→';
        const label = `${message.from} ${arrow} ${message.to}${message.comment ? `: ${message.comment}` : ''}`;
        return buildRow(label, () => {
          sequence = removeMessage(sequence, index);
          renderMessages();
        });
      }),
    );
  }

  function renderAll() {
    renderParticipants();
    renderMessages();
  }

  function addParticipantFromInput() {
    sequence = addParticipant(sequence, nameInput.value);
    nameInput.value = '';
    nameInput.focus();
    renderAll();
  }

  addParticipantEl?.addEventListener('click', addParticipantFromInput);
  nameInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addParticipantFromInput();
  });

  addMessageEl?.addEventListener('click', () => {
    if (sequence.participants.length < 2) {
      setHint('sequence.needParticipants');
      return;
    }
    sequence = addMessage(sequence, fromSelect.value, toSelect.value, commentInput.value, dashedInput.checked);
    commentInput.value = '';
    dashedInput.checked = false;
    renderMessages();
  });

  insertEl?.addEventListener('click', () => {
    const view = getView();
    const code = sequenceToChronosCode(sequence);
    if (!view || !code) {
      setHint('sequence.needTwoParticipants');
      return;
    }

    const docText = view.state.doc.toString();
    const needsImport = !hasChronosImport(docText);
    const importText = needsImport ? `${chronosImportLine()}\n\n` : '';

    const { from, to } = view.state.selection.main;
    const insertion = (from === 0 ? '' : docText[from - 1] === '\n' ? '\n' : '\n\n') + code + '\n';
    const changes = [];
    let offsetChars = 0;
    if (importText) {
      changes.push({ from: 0, to: 0, insert: importText });
      offsetChars = importText.length;
    }
    changes.push({ from, to, insert: insertion });
    view.dispatch({ changes, selection: { anchor: from + offsetChars + insertion.length } });
    view.focus();
    panel.close();
  });

  const panel = registerPanel(panelEl, { closeOnOutsideClick: false });

  return {
    openNear(triggerEl) {
      sequence = createEmptySequence();
      nameInput.value = '';
      commentInput.value = '';
      dashedInput.checked = false;
      renderAll();
      setHint('sequence.hintDefault');

      const rect = triggerEl.getBoundingClientRect();
      panelEl.style.top = `${rect.bottom + 6}px`;
      panelEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 420, rect.left))}px`;
      panelEl.style.right = 'auto';
      panelEl.style.transform = 'none';
      panel.open();
      nameInput.focus();
    },
    close: panel.close,
  };
}
