// =============================================================================
// DBV Typst Editor — Tests de las operaciones de ficheros del árbol (RF-69)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = {
  fsCreateFile: vi.fn(),
  fsCreateDir: vi.fn(),
  fsRename: vi.fn(),
  fsMove: vi.fn(),
  fsDuplicate: vi.fn(),
  fsCopyInto: vi.fn(),
  fsTrash: vi.fn(),
  fsDeletePermanently: vi.fn(),
  listDirectory: vi.fn(),
};
vi.mock('../services/backend.js', () =>
  Object.fromEntries(Object.keys(backend).map((name) => [name, (...args) => backend[name](...args)])),
);
const prefs = { showHiddenFiles: false };
vi.mock('../app/prefs.js', () => ({ getPref: (name) => prefs[name] }));

const { createFileOperations, describeDeletion } = await import('./fileOperations.js');

const ROOT = 'D:/libro';
const ok = (value) => ({ ok: true, value });
const fail = (kind, message = 'fallo') => ({ ok: false, error: { kind, message } });

function setup() {
  const tree = {
    getRoot: () => ROOT,
    refresh: vi.fn(async () => true),
    revealPath: vi.fn(async () => {}),
  };
  const workspace = {
    openDocument: vi.fn(async () => true),
    applyPathMoves: vi.fn(async () => {}),
    handleDeletedPaths: vi.fn(async () => {}),
    runOwnOperation: vi.fn((paths, operation) => operation()),
    getDocumentPath: vi.fn(() => null),
    isDirty: vi.fn(() => false),
  };
  const dialog = { ask: vi.fn() };
  const notify = vi.fn();
  const afterMove = vi.fn(async () => {});
  const ops = createFileOperations({ tree, workspace, dialog, notify, afterMove });
  return { tree, workspace, dialog, notify, afterMove, ops };
}

beforeEach(() => {
  for (const mock of Object.values(backend)) mock.mockReset();
  prefs.showHiddenFiles = false;
});

describe('describeDeletion', () => {
  it('lista los nombres y resume a partir del séptimo', () => {
    const text = describeDeletion(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(text.split('\n')).toHaveLength(7);
    expect(text).toContain('• a');
    expect(text).not.toContain('• g');
  });
});

describe('crear y renombrar (onCommitName)', () => {
  it('crear un fichero editable lo abre en el editor', async () => {
    const { ops, workspace } = setup();
    backend.fsCreateFile.mockResolvedValue(ok(`${ROOT}/cap3.typ`));
    backend.listDirectory.mockResolvedValue(ok([{ path: `${ROOT}/cap3.typ`, isEditable: true }]));

    const result = await ops.commitName({ mode: 'create-file', dirPath: ROOT, name: 'cap3.typ' });

    expect(result).toEqual({ ok: true, path: `${ROOT}/cap3.typ` });
    expect(workspace.openDocument).toHaveBeenCalledWith(`${ROOT}/cap3.typ`);
  });

  it('crear algo que el editor no abre (una imagen) no intenta abrirlo', async () => {
    const { ops, workspace } = setup();
    backend.fsCreateFile.mockResolvedValue(ok(`${ROOT}/logo.png`));
    backend.listDirectory.mockResolvedValue(ok([{ path: `${ROOT}/logo.png`, isEditable: false }]));
    await ops.commitName({ mode: 'create-file', dirPath: ROOT, name: 'logo.png' });
    expect(workspace.openDocument).not.toHaveBeenCalled();
  });

  it('el error del backend vuelve al árbol como mensaje', async () => {
    const { ops } = setup();
    backend.fsCreateDir.mockResolvedValue(fail('denied', '«CON» es un nombre reservado en Windows.'));
    const result = await ops.commitName({ mode: 'create-dir', dirPath: ROOT, name: 'CON' });
    expect(result).toEqual({ ok: false, message: '«CON» es un nombre reservado en Windows.' });
  });

  it('crear un dotfile con los ocultos filtrados avisa de que no se verá', async () => {
    const { ops, notify } = setup();
    backend.fsCreateFile.mockResolvedValue(ok(`${ROOT}/.gitignore`));
    backend.listDirectory.mockResolvedValue(ok([]));
    await ops.commitName({ mode: 'create-file', dirPath: ROOT, name: '.gitignore' });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('renombrar es una operación propia y actualiza el estado y luego las referencias', async () => {
    const { ops, workspace, afterMove } = setup();
    const moved = { from: `${ROOT}/main.typ`, to: `${ROOT}/libro.typ` };
    backend.fsRename.mockResolvedValue(ok(moved));

    const result = await ops.commitName({ mode: 'rename', dirPath: ROOT, entry: { path: moved.from }, name: 'libro.typ' });

    expect(result).toEqual({ ok: true, path: moved.to });
    expect(workspace.runOwnOperation).toHaveBeenCalledWith([moved.from], expect.any(Function));
    expect(workspace.applyPathMoves).toHaveBeenCalledWith([moved]);
    expect(afterMove).toHaveBeenCalledWith([moved]);
  });
});

describe('mover', () => {
  it('mueve, actualiza el estado y selecciona lo movido', async () => {
    const { ops, workspace, tree } = setup();
    const moved = [{ from: `${ROOT}/a.typ`, to: `${ROOT}/cap/a.typ` }];
    backend.fsMove.mockResolvedValue(ok(moved));
    await ops.move([`${ROOT}/a.typ`], `${ROOT}/cap`);
    expect(workspace.applyPathMoves).toHaveBeenCalledWith(moved);
    expect(tree.revealPath).toHaveBeenCalledWith(`${ROOT}/cap/a.typ`);
  });

  it('un rechazo del backend se avisa y no toca el estado', async () => {
    const { ops, workspace, notify } = setup();
    backend.fsMove.mockResolvedValue(fail('denied', 'Ya existe «a.typ» en esa carpeta.'));
    await ops.move([`${ROOT}/a.typ`], `${ROOT}/cap`);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Ya existe'), 'error');
    expect(workspace.applyPathMoves).not.toHaveBeenCalled();
  });
});

describe('eliminar (RF-69.7)', () => {
  const entries = [{ name: 'viejo.typ', path: `${ROOT}/viejo.typ` }];

  it('cancelar no borra nada', async () => {
    const { ops, dialog } = setup();
    dialog.ask.mockResolvedValue('cancel');
    await ops.handleAction('delete', { entries });
    expect(backend.fsTrash).not.toHaveBeenCalled();
  });

  it('confirmar manda a la papelera y actualiza el estado', async () => {
    const { ops, dialog, workspace } = setup();
    dialog.ask.mockResolvedValue('trash');
    backend.fsTrash.mockResolvedValue(ok(null));
    await ops.handleAction('delete', { entries });
    expect(backend.fsTrash).toHaveBeenCalledWith(ROOT, [`${ROOT}/viejo.typ`]);
    expect(workspace.handleDeletedPaths).toHaveBeenCalledWith([`${ROOT}/viejo.typ`]);
    expect(backend.fsDeletePermanently).not.toHaveBeenCalled();
  });

  it('sin papelera, pide una segunda confirmación antes de borrar para siempre', async () => {
    const { ops, dialog } = setup();
    dialog.ask.mockResolvedValueOnce('trash').mockResolvedValueOnce('cancel');
    backend.fsTrash.mockResolvedValue(fail('trashUnavailable'));
    await ops.handleAction('delete', { entries });
    expect(dialog.ask).toHaveBeenCalledTimes(2);
    expect(backend.fsDeletePermanently).not.toHaveBeenCalled();

    dialog.ask.mockResolvedValueOnce('trash').mockResolvedValueOnce('delete');
    backend.fsDeletePermanently.mockResolvedValue(ok(null));
    await ops.handleAction('delete', { entries });
    expect(backend.fsDeletePermanently).toHaveBeenCalledWith(ROOT, [`${ROOT}/viejo.typ`]);
  });

  it('avisa de forma distinta si se elimina el documento abierto con cambios sin guardar', async () => {
    const { ops, dialog, workspace } = setup();
    workspace.getDocumentPath.mockReturnValue(`${ROOT}/cap/uno.typ`);
    workspace.isDirty.mockReturnValue(true);
    dialog.ask.mockResolvedValue('cancel');
    await ops.handleAction('delete', { entries: [{ name: 'cap', path: `${ROOT}/cap` }] });
    expect(dialog.ask).toHaveBeenCalledWith(expect.objectContaining({ textKey: 'tree.deleteTextDirty' }));
  });
});

describe('copiar rutas', () => {
  it('copia la ruta relativa al proyecto de cada elemento', async () => {
    const { ops } = setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await ops.handleAction('copyRelativePath', {
      entries: [{ path: `${ROOT}/cap/uno.typ` }, { path: `${ROOT}/main.typ` }],
    });
    expect(writeText).toHaveBeenCalledWith('cap/uno.typ\nmain.typ');
  });
});
