// =============================================================================
// DBV Typst Editor — Tests del asistente de diagramas CeTZ
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { EditorState } from '@codemirror/state';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCetzAssistant } from './cetzAssistant.js';

describe('createCetzAssistant', () => {
  let panelEl;
  let dispatchedSpec = null;
  let viewMock;

  beforeEach(() => {
    panelEl = document.createElement('div');
    panelEl.className = 'floating-panel--cetz hidden';
    panelEl.innerHTML = `
      <div class="cetz-dialog__grid">
        <button type="button" data-cetz-type="flowchart">Flujo</button>
        <button type="button" data-cetz-type="block">Bloques</button>
        <button type="button" data-cetz-type="plot">Gráfica</button>
        <button type="button" data-cetz-type="canvas">Lienzo</button>
      </div>
    `;
    document.body.appendChild(panelEl);

    dispatchedSpec = null;
    const state = EditorState.create({ doc: '= Documento\n' });
    viewMock = {
      state,
      dispatch: (spec) => {
        dispatchedSpec = spec;
      },
      focus: () => {},
    };
  });

  it('al pulsar una opción de diagrama, calcula la transacción y cierra el panel', () => {
    const assistant = createCetzAssistant({
      panelEl,
      getView: () => viewMock,
    });

    const trigger = document.createElement('button');
    document.body.appendChild(trigger);

    assistant.openNear(trigger);
    expect(panelEl.classList.contains('hidden')).toBe(false);

    const blockBtn = panelEl.querySelector('[data-cetz-type="block"]');
    blockBtn.click();

    expect(dispatchedSpec).toBeTruthy();
    expect(panelEl.classList.contains('hidden')).toBe(true);
  });
});
