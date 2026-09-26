// =============================================================================
// DBV Typst Editor — Tests de la actualización de referencias (RF-70, frontend)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = { refsApply: vi.fn(), refsPlan: vi.fn(), fsRevertMoves: vi.fn() };
vi.mock('../services/backend.js', () =>
  Object.fromEntries(Object.keys(backend).map((name) => [name, (...args) => backend[name](...args)])),
);
const prefs = { askBeforeUpdatingRefs: false };
vi.mock('../app/prefs.js', () => ({ getPref: (name) => prefs[name] }));

const { createReferenceUpdater, formatReport } = await import('./referenceUpdates.js');

const ROOT = 'D:/libro';
const moved = [{ from: `${ROOT}/cap1.typ`, to: `${ROOT}/capitulos/cap1.typ` }];
const report = {
  files: [
    { path: `${ROOT}/main.typ`, relative: 'main.typ', changes: [{ line: 3, oldValue: 'cap1.typ', newValue: 'capitulos/cap1.typ' }] },
    { path: `${ROOT}/capitulos/cap1.typ`, relative: 'capitulos/cap1.typ', changes: [{ line: 1, oldValue: 'img/a.png', newValue: '../img/a.png' }] },
  ],
  openDocumentEdits: [{ from: 10, to: 20, insert: '"capitulos/cap1.typ"' }],
  total: 2,
  failed: [],
};

function setup() {
  const tree = { getRoot: () => ROOT, refresh: vi.fn(async () => true) };
  const workspace = {
    getOpenDocumentSnapshot: vi.fn(() => ({ path: `${ROOT}/main.typ`, content: 'sin guardar' })),
    applyBufferEdits: vi.fn(),
    applyPathMoves: vi.fn(async () => {}),
    runOwnOperation: vi.fn((paths, operation) => operation()),
  };
  const dialog = { ask: vi.fn() };
  const notify = vi.fn();
  return { tree, workspace, dialog, notify, updater: createReferenceUpdater({ tree, workspace, dialog, notify }) };
}

beforeEach(() => {
  for (const mock of Object.values(backend)) mock.mockReset();
  prefs.askBeforeUpdatingRefs = false;
});

describe('formatReport', () => {
  it('una línea por ruta reescrita, con fichero, línea, antes y después', () => {
    expect(formatReport(report)).toBe('main.typ:3 — cap1.typ → capitulos/cap1.typ\ncapitulos/cap1.typ:1 — img/a.png → ../img/a.png');
  });
});

describe('afterMove (RF-70)', () => {
  it('actualiza sin preguntar por defecto, aplica las ediciones del abierto y avisa con Ver cambios y Deshacer', async () => {
    const { updater, workspace, notify, dialog } = setup();
    backend.refsApply.mockResolvedValue({ ok: true, value: report });

    await updater.afterMove(moved);

    expect(backend.refsApply).toHaveBeenCalledWith(ROOT, moved, { path: `${ROOT}/main.typ`, content: 'sin guardar' });
    expect(workspace.applyBufferEdits).toHaveBeenCalledWith(report.openDocumentEdits);
    expect(dialog.ask).not.toHaveBeenCalled();
    const [, , , actions] = notify.mock.calls[0];
    expect(actions.map((action) => action.label)).toHaveLength(2);
  });

  it('sin referencias que cambiar no avisa de nada', async () => {
    const { updater, notify } = setup();
    backend.refsApply.mockResolvedValue({ ok: true, value: { files: [], openDocumentEdits: [], total: 0, failed: [] } });
    await updater.afterMove(moved);
    expect(notify).not.toHaveBeenCalled();
  });

  it('con «Preguntar antes», «Mover sin actualizar» no escribe nada', async () => {
    prefs.askBeforeUpdatingRefs = true;
    const { updater, dialog } = setup();
    backend.refsPlan.mockResolvedValue({ ok: true, value: report });
    dialog.ask.mockResolvedValue('skip');

    await updater.afterMove(moved);

    expect(dialog.ask).toHaveBeenCalledTimes(1);
    expect(backend.refsApply).not.toHaveBeenCalled();
  });

  it('con «Preguntar antes», «Actualizar» aplica', async () => {
    prefs.askBeforeUpdatingRefs = true;
    const { updater, dialog } = setup();
    backend.refsPlan.mockResolvedValue({ ok: true, value: report });
    backend.refsApply.mockResolvedValue({ ok: true, value: report });
    dialog.ask.mockResolvedValue('apply');
    await updater.afterMove(moved);
    expect(backend.refsApply).toHaveBeenCalled();
  });

  it('Deshacer devuelve los ficheros a su sitio, actualiza el estado y reescribe en sentido inverso', async () => {
    const { updater, workspace, notify } = setup();
    backend.refsApply.mockResolvedValue({ ok: true, value: report });
    await updater.afterMove(moved);
    const reverted = [{ from: moved[0].to, to: moved[0].from }];
    backend.fsRevertMoves.mockResolvedValue({ ok: true, value: reverted });

    const [, , , actions] = notify.mock.calls[0];
    await actions[1].run();

    expect(backend.fsRevertMoves).toHaveBeenCalledWith(ROOT, moved);
    expect(workspace.applyPathMoves).toHaveBeenCalledWith(reverted);
    expect(backend.refsApply).toHaveBeenLastCalledWith(ROOT, reverted, expect.anything());
  });

  it('si no se puede deshacer, lo dice y no toca el estado', async () => {
    const { updater, workspace, notify } = setup();
    backend.refsApply.mockResolvedValue({ ok: true, value: report });
    await updater.afterMove(moved);
    backend.fsRevertMoves.mockResolvedValue({ ok: false, error: { kind: 'denied', message: 'ocupado' } });

    await notify.mock.calls[0][3][1].run();

    expect(workspace.applyPathMoves).not.toHaveBeenCalled();
    expect(notify).toHaveBeenLastCalledWith(expect.stringContaining('ocupado'), 'error');
  });
});
