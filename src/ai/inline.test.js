// =============================================================================
// DBV Typst Editor — Tests de la IA en línea (RF-95)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';
import { createInlineAi, inlineField, inlinePrompt, inlineUserMessage, paragraphAt, stripFence } from './inline.js';

describe('funciones puras', () => {
  it('el párrafo del cursor va entre líneas en blanco', () => {
    const text = 'Uno.\n\nDos dos.\nTres.\n\nCuatro.';
    const range = paragraphAt(text, text.indexOf('dos'));
    expect(text.slice(range.from, range.to)).toBe('Dos dos.\nTres.');
  });

  it('quita el envoltorio de código que añaden algunos modelos', () => {
    expect(stripFence('```typst\n*Hola* @cita\n```')).toBe('*Hola* @cita');
    expect(stripFence('\nTexto\n')).toBe('Texto');
  });

  it('las instrucciones piden conservar el marcado de Typst (RF-95.4)', () => {
    const prompt = inlinePrompt({ explain: false, typstVersion: '0.15.1' });
    for (const mark of ['PRESERVE all Typst markup', '#', '$', '<', '@', 'NOT LaTeX', 'ONLY']) expect(prompt).toContain(mark);
    expect(inlinePrompt({ explain: true, typstVersion: '0.15.1' })).toContain('explanation');
  });

  it('el mensaje lleva la tarea, el fragmento y el contexto', () => {
    const message = inlineUserMessage({ instruction: 'Traduce', fragment: 'Según @smith, $x^2$', before: 'Antes', after: 'Después', path: 'cap.typ' });
    expect(message).toContain('FRAGMENT:\nSegún @smith, $x^2$');
    expect(message).toContain('Antes');
    expect(message).toContain('cap.typ');
  });
});

describe('diferencia en línea en el editor', () => {
  function setup(answer) {
    const parent = document.createElement('div');
    document.body.append(parent);
    const doc = 'Uno.\n\nSegún @smith, la ecuación $x^2$ es *clave*.\n\nFin.';
    const view = new EditorView({ state: EditorState.create({ doc }), parent });
    const from = doc.indexOf('Según');
    view.dispatch({ selection: { anchor: from, head: from + 'Según @smith, la ecuación $x^2$ es *clave*.'.length } });
    const complete = vi.fn(async (messages, onText) => {
      onText(answer);
      return answer;
    });
    const inline = createInlineAi({ getView: () => view, getPath: () => 'cap.md', complete, typstVersion: () => '0.15.1', notify: vi.fn() });
    return { view, inline, complete };
  }

  it('propone sin tocar el texto y aceptar lo cambia en una sola edición deshacible', async () => {
    const { view, inline, complete } = setup('According to @smith, the equation $x^2$ is *key*.');
    await inline.run('translate');
    expect(complete).toHaveBeenCalled();
    expect(view.state.doc.toString()).toContain('Según @smith');
    const proposal = view.state.field(inlineField);
    expect(proposal.text).toContain('According to @smith');
    proposal.actions.find((a) => a.primary).run();
    expect(view.state.doc.toString()).toBe('Uno.\n\nAccording to @smith, the equation $x^2$ is *key*.\n\nFin.');
    expect(view.state.field(inlineField)).toBeNull();
  });

  it('rechazar no cambia nada', async () => {
    const { view, inline } = setup('Otra cosa.');
    await inline.run('improve');
    const before = view.state.doc.toString();
    view.state.field(inlineField).actions.find((a) => a.label && !a.primary).run();
    expect(view.state.doc.toString()).toBe(before);
    expect(view.state.field(inlineField)).toBeNull();
  });
});
