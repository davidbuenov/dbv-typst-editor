// =============================================================================
// DBV Typst Editor — Tests de renombrar símbolo y acciones de código (RF-77.4-5)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import captured from './__fixtures__/tinymist-0.15.8.json';
import { createRefactor, isPathRename, resolveIncludePath } from './refactor.js';

const ROOT = 'D:/libro';
const fixtures = JSON.parse(JSON.stringify(captured).split('file:///ROOT').join(`file:///${ROOT}`));
const MAIN = `${ROOT}/main.typ`;
const UNO = `${ROOT}/cap/uno.typ`;

describe('rutas de #include (R-L4)', () => {
  it('reconoce el renombrado de una ruta y resuelve el fichero como Typst', () => {
    expect(isPathRename('"cap/uno.typ"')).toBe(true);
    expect(isPathRename('saluda')).toBe(false);
    expect(isPathRename('fig.a')).toBe(false);
    expect(resolveIncludePath(MAIN, ROOT, 'cap/uno.typ')).toBe(UNO);
    expect(resolveIncludePath(`${ROOT}/cap/dos.typ`, ROOT, '../img/a.typ')).toBe(`${ROOT}/img/a.typ`);
    expect(resolveIncludePath(`${ROOT}/cap/dos.typ`, ROOT, '/cap/uno.typ')).toBe(UNO);
    expect(resolveIncludePath('D:\\libro\\main.typ', 'D:\\libro', 'cap/uno.typ')).toBe(UNO);
  });
});

describe('renombrar y acciones de código con respuestas reales de Tinymist', () => {
  let view;
  let lsp;
  let multiFileEdit;
  let renameFile;
  let notify;
  let workspace;
  let askName;
  let pick;
  let refactor;

  beforeEach(() => {
    view = new EditorView({ state: EditorState.create({ doc: fixtures.files['main.typ'] }) });
    const byMethod = {};
    lsp = {
      requestAt: vi.fn(async (method) => byMethod[method] ?? null),
      getCodeActions: vi.fn(async () => fixtures.codeActionHeading.result),
      responses: byMethod,
    };
    multiFileEdit = { apply: vi.fn(async () => ({ journal: [], failure: null, total: 2, files: 1 })), report: vi.fn() };
    renameFile = vi.fn();
    notify = vi.fn();
    workspace = { getDocumentPath: () => MAIN, getRoot: () => ROOT, hasEngineErrors: () => false };
    askName = vi.fn(async () => 'saludo');
    pick = vi.fn(async () => 0);
    refactor = createRefactor({
      lspClient: lsp,
      workspace,
      multiFileEdit,
      navigation: { unavailableReason: () => null },
      renameFile,
      notify,
      t: (key) => key,
      ui: { askName, pick },
    });
  });

  afterEach(() => view.destroy());

  const cursorAt = (line, character) => view.dispatch({ selection: { anchor: view.state.doc.line(line + 1).from + character } });

  it('renombrar un #let: pide el nombre y aplica sin vista previa', async () => {
    cursorAt(2, 18);
    lsp.responses['textDocument/prepareRename'] = fixtures.prepareRenameLet.result;
    lsp.responses['textDocument/rename'] = fixtures.renameLet.result;
    expect(await refactor.renameSymbol(view)).toBe(true);
    expect(askName).toHaveBeenCalledWith(view, expect.any(Number), 'saluda', 'refactor.newName');
    const [files, options] = multiFileEdit.apply.mock.calls[0];
    expect(files.map((file) => file.path)).toEqual([MAIN]);
    expect(options).toEqual({ reason: 'rename', confirm: false });
    expect(multiFileEdit.report).toHaveBeenCalled();
  });

  it('renombrar una etiqueta: pide confirmación con la lista (R-L3)', async () => {
    cursorAt(2, 6);
    askName.mockResolvedValue('fig-felino');
    lsp.responses['textDocument/prepareRename'] = fixtures.prepareRenameLabel.result;
    lsp.responses['textDocument/rename'] = fixtures.renameLabel.result;
    await refactor.renameSymbol(view);
    const [files, options] = multiFileEdit.apply.mock.calls[0];
    expect(files).toHaveLength(2);
    expect(options.confirm).toBe(true);
  });

  it('F2 sobre la ruta de un #include se desvía al renombrado del árbol, sin pedir el rename a Tinymist (R-L4)', async () => {
    cursorAt(1, 12);
    lsp.responses['textDocument/prepareRename'] = fixtures.prepareRenameInclude.result;
    expect(await refactor.renameSymbol(view)).toBe(false);
    expect(renameFile).toHaveBeenCalledWith(UNO);
    expect(lsp.requestAt).not.toHaveBeenCalledWith('textDocument/rename', expect.anything(), expect.anything(), expect.anything());
    expect(multiFileEdit.apply).not.toHaveBeenCalled();
  });

  it('sin nada que renombrar lo dice; sobre una etiqueta con errores, pide compilar (R-L2)', async () => {
    cursorAt(3, 2);
    await refactor.renameSymbol(view);
    expect(notify).toHaveBeenLastCalledWith('refactor.cannotRename', 'error');

    cursorAt(2, 6);
    workspace.hasEngineErrors = () => true;
    await refactor.renameSymbol(view);
    expect(notify).toHaveBeenLastCalledWith('nav.labelNeedsCompile', 'error');
  });

  it('si el documento cambia mientras Tinymist calcula, no se aplica nada (R-L5)', async () => {
    cursorAt(2, 18);
    lsp.responses['textDocument/prepareRename'] = fixtures.prepareRenameLet.result;
    lsp.requestAt.mockImplementation(async (method) => {
      if (method !== 'textDocument/rename') return lsp.responses[method] ?? null;
      view.dispatch({ changes: { from: 0, insert: 'x' } });
      return fixtures.renameLet.result;
    });
    expect(await refactor.renameSymbol(view)).toBe(false);
    expect(notify).toHaveBeenCalledWith('refactor.stale', 'error');
    expect(multiFileEdit.apply).not.toHaveBeenCalled();
  });

  it('Ctrl+. lista las acciones reales y aplica la elegida sin aviso de «N cambios»', async () => {
    cursorAt(4, 0);
    expect(await refactor.codeActions(view)).toBe(true);
    expect(pick).toHaveBeenCalledWith(view, [expect.objectContaining({ title: 'Increase depth of heading' })]);
    const [files] = multiFileEdit.apply.mock.calls[0];
    expect(files[0].edits[0].newText).toBe('==');
    expect(multiFileEdit.report).not.toHaveBeenCalled();
  });

  it('sin acciones en ese punto lo dice', async () => {
    lsp.getCodeActions.mockResolvedValue([]);
    expect(await refactor.codeActions(view)).toBe(false);
    expect(notify).toHaveBeenCalledWith('refactor.noActions');
  });
});
