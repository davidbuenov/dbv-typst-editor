// =============================================================================
// DBV Typst Editor — Tests de la edición en varios ficheros (RF-77.4, RF-78.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyOffsetEdits,
  createMultiFileEdit,
  describeChanges,
  normalizeWorkspaceEdit,
  offsetAt,
  toOffsetEdits,
} from './multiFileEdit.js';
import captured from '../editor/__fixtures__/tinymist-0.15.8.json';

const ROOT = 'D:/libro';
// Respuestas capturadas de Tinymist 0.15.8 (scratchpad/capture.mjs), con la
// raíz del proyecto de prueba sustituida por la de estos tests.
const fixtures = JSON.parse(JSON.stringify(captured).split('file:///ROOT').join(`file:///${ROOT}`));
const MAIN = `${ROOT}/main.typ`;
const UNO = `${ROOT}/cap/uno.typ`;

describe('posiciones y ediciones (UTF-16)', () => {
  it('offsetAt cuenta en unidades UTF-16: acentos y emoji no se corrompen', () => {
    const text = 'á😀b\nñc';
    expect(offsetAt(text, { line: 0, character: 3 })).toBe(3);
    expect(text[offsetAt(text, { line: 0, character: 3 })]).toBe('b');
    expect(offsetAt(text, { line: 1, character: 1 })).toBe(6);
    expect(offsetAt(text, { line: 1, character: 9 })).toBe(-1);
    expect(offsetAt(text, { line: 5, character: 0 })).toBe(-1);
  });

  it('toOffsetEdits ordena, rechaza solapes y posiciones que no existen', () => {
    const range = (a, b) => ({ start: { line: 0, character: a }, end: { line: 0, character: b } });
    expect(toOffsetEdits('abcdef', [{ range: range(4, 5), newText: 'X' }, { range: range(0, 1), newText: 'Y' }])).toEqual([
      { from: 0, to: 1, insert: 'Y' },
      { from: 4, to: 5, insert: 'X' },
    ]);
    expect(toOffsetEdits('abcdef', [{ range: range(0, 3), newText: '' }, { range: range(2, 4), newText: '' }])).toBe(null);
    expect(toOffsetEdits('abc', [{ range: range(0, 9), newText: '' }])).toBe(null);
    expect(applyOffsetEdits('á😀b', [{ from: 1, to: 3, insert: '🙂' }])).toBe('á🙂b');
  });
});

describe('normalizeWorkspaceEdit con respuestas reales de Tinymist', () => {
  it('renombrar un #let: `changes` en un fichero, sin confirmación', () => {
    const edit = normalizeWorkspaceEdit(fixtures.renameLet.result);
    expect(edit.needsConfirmation).toBe(false);
    expect(edit.fileOperations).toEqual([]);
    expect(edit.files).toHaveLength(1);
    expect(edit.files[0].path).toBe(MAIN);
    expect(edit.files[0].edits.map((e) => e.newText)).toEqual(['saludo', 'saludo']);
  });

  it('renombrar una etiqueta: `documentChanges` en dos ficheros con `needsConfirmation` (R-L3)', () => {
    const edit = normalizeWorkspaceEdit(fixtures.renameLabel.result);
    expect(edit.needsConfirmation).toBe(true);
    expect(edit.files.map((file) => file.path).sort()).toEqual([UNO, MAIN].sort());
  });

  it('renombrar la ruta de un #include trae una operación de fichero aparte (R-L4)', () => {
    const edit = normalizeWorkspaceEdit(fixtures.renameInclude.result);
    expect(edit.fileOperations).toEqual([{ kind: 'rename', oldPath: UNO, newPath: `${ROOT}/cap/primero.typ` }]);
  });
});

describe('aplicar y deshacer (R-E1)', () => {
  let disk;
  let tabs;
  let backend;
  let workspace;
  let dialog;
  let notify;
  let editor;

  beforeEach(() => {
    disk = { [MAIN]: fixtures.files['main.typ'], [UNO]: fixtures.files['cap/uno.typ'], [`${ROOT}/otro.typ`]: 'Usa #saluda aquí' };
    tabs = {};
    const hash = (text) => `h:${text}`;
    backend = {
      readFile: vi.fn(async (path) => ({ ok: true, value: { content: disk[path], contentHash: hash(disk[path]) } })),
      fileFingerprint: vi.fn(async (path) => ({ ok: true, value: { missing: false, contentHash: hash(disk[path]) } })),
      writeFile: vi.fn(async (path, content) => {
        disk[path] = content;
        return { ok: true, value: { contentHash: hash(content) } };
      }),
    };
    workspace = {
      getRoot: () => ROOT,
      getTabContent: (path) => tabs[path] ?? null,
      applyBufferEdits: vi.fn((edits, path) => {
        tabs[path] = applyOffsetEdits(tabs[path], edits);
      }),
    };
    dialog = { ask: vi.fn(async () => 'apply') };
    notify = vi.fn();
    editor = createMultiFileEdit({ workspace, backend, dialog, notify });
  });

  const renameLabel = () => normalizeWorkspaceEdit(fixtures.renameLabel.result).files;

  it('un fichero cerrado se escribe; uno abierto, con o sin cambios, se edita en el editor y no en disco', async () => {
    tabs[MAIN] = `${fixtures.files['main.typ']}// sin guardar\n`;
    const result = await editor.apply(renameLabel(), { reason: 'rename' });

    expect(result.failure).toBe(null);
    expect(result.files).toBe(2);
    expect(backend.writeFile).toHaveBeenCalledTimes(1);
    expect(backend.writeFile).toHaveBeenCalledWith(UNO, expect.stringContaining('<fig-felino>'), 'rename');
    expect(disk[MAIN]).toBe(fixtures.files['main.typ']);
    expect(tabs[MAIN]).toContain('Ver @fig-felino');
    expect(tabs[MAIN]).toContain('// sin guardar');
  });

  it('con confirmación enseña la lista antes y Cancelar no aplica nada', async () => {
    dialog.ask.mockResolvedValueOnce('cancel');
    const result = await editor.apply(renameLabel(), { reason: 'rename', confirm: true });
    expect(result).toBe(null);
    expect(dialog.ask.mock.calls[0][0].text).toMatch(/cap\/uno\.typ:2 — .*<fig-gato> → .*<fig-felino>/);
    expect(backend.writeFile).not.toHaveBeenCalled();
  });

  it('si un fichero cerrado cambió mientras se revisaba, no se aplica nada', async () => {
    tabs[MAIN] = fixtures.files['main.typ'];
    dialog.ask.mockImplementationOnce(async () => {
      disk[UNO] = 'otro programa lo cambió';
      return 'apply';
    });
    const result = await editor.apply(renameLabel(), { reason: 'rename', confirm: true });
    expect(result).toBe(null);
    expect(backend.writeFile).not.toHaveBeenCalled();
    expect(workspace.applyBufferEdits).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('cap/uno.typ'), 'error');
  });

  it('un fallo a medias se informa y Deshacer devuelve lo aplicado', async () => {
    const files = [
      { path: MAIN, edits: [{ range: { start: { line: 0, character: 5 }, end: { line: 0, character: 11 } }, newText: 'saludo' }] },
      { path: `${ROOT}/otro.typ`, edits: [{ range: { start: { line: 0, character: 5 }, end: { line: 0, character: 11 } }, newText: 'saludo' }] },
    ];
    backend.writeFile.mockImplementationOnce(async (path, content) => {
      disk[path] = content;
      return { ok: true, value: { contentHash: `h:${content}` } };
    });
    backend.writeFile.mockImplementationOnce(async () => ({ ok: false, error: { message: 'disco lleno' } }));

    const result = await editor.apply(files, { reason: 'replace' });
    expect(result.failure.message).toBe('disco lleno');
    expect(result.journal.map((file) => file.path)).toEqual([MAIN]);
    expect(disk[MAIN]).toContain('#let saludo(');

    editor.report(result, 'replace');
    expect(notify.mock.calls.at(-1)[1]).toBe('error');
    expect(await editor.undo(result.journal, 'replace')).toBe(true);
    expect(disk[MAIN]).toBe(fixtures.files['main.typ']);
  });

  it('Deshacer es todo o nada: si algo cambió desde entonces, no toca ninguno', async () => {
    tabs[MAIN] = fixtures.files['main.typ'];
    const result = await editor.apply(renameLabel(), { reason: 'rename' });
    tabs[MAIN] += 'otra edición';
    backend.writeFile.mockClear();

    expect(await editor.undo(result.journal, 'rename')).toBe(false);
    expect(backend.writeFile).not.toHaveBeenCalled();
    expect(disk[UNO]).toContain('<fig-felino>');
  });

  it('describeChanges da una línea por línea tocada: fichero, número, antes y después', () => {
    const text = describeChanges([
      { relative: 'main.typ', before: 'a\nVer @x y @x.\nz', edits: [{ from: 7, to: 8, insert: 'y' }, { from: 12, to: 13, insert: 'y' }] },
    ]);
    expect(text).toBe('main.typ:2 — Ver @x y @x. → Ver @y y @y.');
  });
});
