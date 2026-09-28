// =============================================================================
// DBV Typst Editor — Tests del editor y el LSP con varios documentos (RF-79)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { undo } from '@codemirror/commands';
import * as backend from '../services/backend.js';
import { createEditor } from './editor.js';
import { createLspClient } from './lspClient.js';
import { reloadPrefsForTests, setPref } from '../app/prefs.js';

const A = '/p/main.typ';
const B = '/p/cap/uno.typ';

describe('editor con varias pestañas (RF-79, R-T2)', () => {
  let host;
  let editor;

  beforeEach(() => {
    Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
    Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
    localStorage.clear();
    reloadPrefsForTests();
    host = document.createElement('div');
    document.body.append(host);
    editor = createEditor(host);
  });

  afterEach(() => {
    editor?.destroy();
    host.remove();
  });

  const view = () => editor.getView();
  const type = (text) => view().dispatch({ changes: { from: view().state.doc.length, insert: text }, userEvent: 'input.type' });

  it('volver a una pestaña conserva su texto, su cursor y su historial de deshacer', () => {
    editor.setDocument('= Uno', A);
    type(' editado');
    view().dispatch({ selection: { anchor: 3 } });
    const savedA = editor.snapshot();

    editor.setDocument('= Dos', B);
    type(' también');
    expect(editor.getContent()).toBe('= Dos también');

    const savedB = editor.snapshot();
    editor.activate(A, savedA);
    expect(editor.getPath()).toBe(A);
    expect(editor.getContent()).toBe('= Uno editado');
    expect(view().state.selection.main.head).toBe(3);
    undo(view());
    expect(editor.getContent()).toBe('= Uno');

    editor.activate(B, savedB);
    expect(editor.getContent()).toBe('= Dos también');
  });

  it('abrir otro documento empieza con el historial vacío: deshacer no llega al anterior', () => {
    editor.setDocument('= Uno', A);
    type(' editado');
    editor.setDocument('= Dos', B);
    expect(undo(view())).toBe(false);
    expect(editor.getContent()).toBe('= Dos');
  });

  it('cambiar el tema o los números de línea con una pestaña de fondo se aplica al volver a ella', () => {
    editor.setDocument('= Uno', A);
    const savedA = editor.snapshot();
    editor.setDocument('= Dos', B);
    setPref('showLineNumbers', false);
    editor.setTheme('light');
    const darkBefore = view().state.facet(view().constructor.darkTheme);

    editor.activate(A, savedA);

    expect(view().dom.querySelector('.cm-lineNumbers')).toBeNull();
    expect(view().state.facet(view().constructor.darkTheme)).toBe(darkBefore);
  });

  it('la solo lectura es de cada pestaña', () => {
    editor.setDocument('= Paquete', A);
    const saved = editor.snapshot();
    editor.activate(A, saved, { readOnly: true });
    expect(view().state.readOnly).toBe(true);
    editor.setDocument('= Mío', B);
    expect(view().state.readOnly).toBe(false);
  });
});

describe('cliente LSP con varios documentos (R-L5)', () => {
  let sent;
  let client;

  beforeEach(async () => {
    sent = [];
    vi.spyOn(backend, 'on').mockResolvedValue(() => {});
    vi.spyOn(backend, 'tinymistStart').mockResolvedValue({ ok: true, value: null });
    vi.spyOn(backend, 'tinymistSendNotification').mockImplementation(async (method, params) => {
      sent.push([method, params.textDocument.uri, params.textDocument.version]);
      return { ok: true, value: null };
    });
    client = createLspClient();
    await client.start('/p');
  });

  it('abre cada pestaña una vez y al volver a una sin cambios no reenvía nada', async () => {
    await client.openDocument(A, '= Uno');
    await client.openDocument(B, '= Dos');
    await client.openDocument(A, '= Uno');
    expect(sent).toEqual([
      ['textDocument/didOpen', 'file:///p/main.typ', 1],
      ['textDocument/didOpen', 'file:///p/cap/uno.typ', 1],
    ]);
    expect(client.getCurrentUri()).toBe('file:///p/main.typ');
  });

  it('escribir manda didChange solo del documento activo, con su propia versión', async () => {
    await client.openDocument(A, '= Uno');
    await client.openDocument(B, '= Dos');
    await client.changeDocument('= Dos!');
    expect(sent.at(-1)).toEqual(['textDocument/didChange', 'file:///p/cap/uno.typ', 2]);
  });

  it('una pestaña de fondo editada (RF-70) se actualiza en Tinymist sin activarla', async () => {
    await client.openDocument(A, '= Uno');
    await client.openDocument(B, '= Dos');
    await client.updateDocument(A, '= Uno movido');
    expect(sent.at(-1)).toEqual(['textDocument/didChange', 'file:///p/main.typ', 2]);
    expect(client.getCurrentUri()).toBe('file:///p/cap/uno.typ');
  });

  it('cerrar la pestaña manda didClose, y reabrirla vuelve a abrirla', async () => {
    await client.openDocument(A, '= Uno');
    await client.closeDocument(A);
    expect(sent.at(-1)).toEqual(['textDocument/didClose', 'file:///p/main.typ', undefined]);
    expect(client.getCurrentUri()).toBe(null);
    await client.openDocument(A, '= Uno');
    expect(sent.at(-1)[0]).toBe('textDocument/didOpen');
  });

  it('renombrar cierra la URI vieja y abre la nueva', async () => {
    await client.openDocument(A, '= Uno');
    await client.renameDocument(A, '/p/libro.typ', '= Uno');
    expect(sent.slice(-2).map(([method, uri]) => [method, uri])).toEqual([
      ['textDocument/didClose', 'file:///p/main.typ'],
      ['textDocument/didOpen', 'file:///p/libro.typ'],
    ]);
  });
});
