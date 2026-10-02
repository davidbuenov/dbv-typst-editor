// =============================================================================
// DBV Typst Editor — Tests de aplicar propuestas y del cliente del modelo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { createProposalApplier, fullReplace } from './applyProposal.js';
import { createModelClient, reduceEvent, toBackendMessages } from './modelClient.js';
import { applyChange, createProposal } from './proposal.js';
import { applyOffsetEdits, toOffsetEdits } from '../app/multiFileEdit.js';

function setup(disk) {
  const ok = (value) => ({ ok: true, value });
  const backend = {
    fsCreateDir: vi.fn(async (root, dir, name) => ok(`${dir}/${name}`)),
    fsCreateFile: vi.fn(async (root, dir, name) => {
      disk[`${dir}/${name}`.replace('D:/p/', '')] = '';
      return ok(`${dir}/${name}`);
    }),
    writeFile: vi.fn(async (path, content) => {
      disk[path.replace('D:/p/', '')] = content;
      return ok({ contentHash: 'h' });
    }),
    fsTrash: vi.fn(async (root, paths) => {
      for (const path of paths) delete disk[path.replace('D:/p/', '')];
      return ok(null);
    }),
    fsRename: vi.fn(async () => ok({ from: 'a', to: 'b' })),
    fsMove: vi.fn(async () => ok([{ from: 'a', to: 'b' }])),
  };
  // Doble de `multiFileEdit`: aplica las ediciones LSP sobre el «disco».
  const multiFileEdit = {
    apply: vi.fn(async (files) => {
      const journal = files.map((file) => {
        const relative = file.path.replace('D:/p/', '');
        const before = disk[relative];
        disk[relative] = applyOffsetEdits(before, toOffsetEdits(before, file.edits));
        return { relative, before, after: disk[relative] };
      });
      return { journal, failure: null, total: files.length, files: files.length };
    }),
    undo: vi.fn(async (journal) => {
      for (const entry of journal) disk[entry.relative] = entry.before;
      return true;
    }),
  };
  const applier = createProposalApplier({
    getRoot: () => 'D:/p',
    join: (root, rel) => `${root}/${rel}`,
    readText: async (path) => disk[path] ?? null,
    multiFileEdit,
    backend,
  });
  return { applier, backend, multiFileEdit };
}

describe('createProposalApplier', () => {
  it('modifica, crea en carpeta nueva y elimina; Deshacer lo revierte', async () => {
    const disk = { 'main.typ': '= Hola\nUno.\n', 'viejo.typ': 'adiós' };
    const proposal = createProposal();
    const read = async (path) => disk[path] ?? null;
    await applyChange(proposal, { path: 'main.typ', action: 'edit', search: 'Uno.', replace: 'Uno bis.' }, read);
    await applyChange(proposal, { path: 'caps/nuevo.typ', action: 'create', content: '= Nuevo\n' }, read);
    await applyChange(proposal, { path: 'viejo.typ', action: 'delete' }, read);
    const { applier, backend } = setup(disk);

    const { report, undo } = await applier.apply(proposal);
    expect(report).toMatchObject({ modified: ['main.typ'], created: ['caps/nuevo.typ'], deleted: ['viejo.typ'], conflicts: [], failed: [] });
    expect(disk['main.typ']).toBe('= Hola\nUno bis.\n');
    expect(disk['caps/nuevo.typ']).toBe('= Nuevo\n');
    expect(disk['viejo.typ']).toBeUndefined();
    expect(backend.fsCreateDir).toHaveBeenCalledWith('D:/p', 'D:/p', 'caps');

    await undo();
    expect(disk['main.typ']).toBe('= Hola\nUno.\n');
    expect(disk['caps/nuevo.typ']).toBeUndefined();
    expect(disk['viejo.typ']).toBe('adiós');
  });

  it('si el usuario editó el fichero, solo aplica lo que casa e informa del conflicto (RF-93.5)', async () => {
    const disk = { 'main.typ': 'A\nB\nC\n' };
    const proposal = createProposal();
    const read = async (path) => disk[path] ?? null;
    await applyChange(proposal, { path: 'main.typ', action: 'replace_all', content: 'A1\nB\nC1\n' }, read);
    disk['main.typ'] = 'A\nB\nC editado\n';
    const { applier } = setup(disk);
    const { report } = await applier.apply(proposal);
    expect(report.conflicts).toEqual([{ path: 'main.typ', count: 1 }]);
    expect(disk['main.typ']).toBe('A1\nB\nC editado\n');
  });

  it('un fichero con todos sus trozos rechazados no se toca', async () => {
    const disk = { 'main.typ': 'A\n' };
    const proposal = createProposal();
    await applyChange(proposal, { path: 'main.typ', action: 'replace_all', content: 'B\n' }, async (p) => disk[p] ?? null);
    proposal.files.get('main.typ').accepted.clear();
    const { applier, multiFileEdit } = setup(disk);
    const { report } = await applier.apply(proposal);
    expect(report.modified).toEqual([]);
    expect(multiFileEdit.apply).not.toHaveBeenCalled();
  });

  it('fullReplace cubre el texto entero', () => {
    const before = 'uno\ndos\n';
    expect(applyOffsetEdits(before, toOffsetEdits(before, fullReplace(before, 'tres')))).toBe('tres');
  });
});

describe('cliente del modelo', () => {
  it('acumula texto, herramientas, uso y fin', () => {
    const chunks = [];
    const state = { text: '', toolCalls: [], usage: null, done: null, error: null, onText: (t) => chunks.push(t) };
    for (const payload of [
      { type: 'text', text: 'Ho' },
      { type: 'text', text: 'la' },
      { type: 'toolCall', id: '1', name: 'read_file', arguments: '{}' },
      { type: 'usage', input: 3, output: 4 },
      { type: 'done', stopReason: 'toolCalls' },
    ]) reduceEvent(state, payload);
    expect(state).toMatchObject({ text: 'Hola', toolCalls: [{ id: '1', name: 'read_file', arguments: '{}' }], usage: { input: 3, output: 4 }, done: { stopReason: 'toolCalls' } });
    expect(chunks).toEqual(['Ho', 'la']);
  });

  it('solo pasa al backend los roles del modelo', () => {
    expect(toBackendMessages([{ role: 'error', content: 'x' }, { role: 'tool', content: 'r', toolCallId: '1' }])).toEqual([
      { role: 'tool', content: 'r', images: [], toolCalls: [], toolCallId: '1' },
    ]);
  });

  it('Detener libera la petición aunque el backend no emita nada', async () => {
    const client = createModelClient({ aiChat: async () => ({ ok: true }), aiCancel: vi.fn(), on: async () => () => {} });
    let stop = null;
    const pending = client.call('c1', { messages: [], tools: [] }, { register: (fn) => (stop = fn) });
    await vi.waitFor(() => expect(stop).not.toBeNull());
    stop();
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
  });

  it('resuelve con los eventos de su petición y rechaza con el tipo de error', async () => {
    let handler;
    const on = async (event, fn) => {
      handler = fn;
      return () => {};
    };
    const aiChat = vi.fn(async (requestId) => {
      queueMicrotask(() => {
        handler({ requestId: 'otra', type: 'text', text: 'no' });
        handler({ requestId, type: 'text', text: 'sí' });
        handler({ requestId, type: 'done', stopReason: 'stop' });
      });
      return { ok: true };
    });
    const client = createModelClient({ aiChat, aiCancel: vi.fn(), on });
    await expect(client.call('c1', { messages: [], tools: [] })).resolves.toMatchObject({ text: 'sí', stopReason: 'stop' });
    const failing = createModelClient({ aiChat: async () => ({ ok: false, error: { kind: 'auth', message: 'clave' } }), aiCancel: vi.fn(), on });
    await expect(failing.call('c1', { messages: [], tools: [] })).rejects.toMatchObject({ kind: 'auth' });
  });
});
