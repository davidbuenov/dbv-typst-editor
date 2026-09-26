// =============================================================================
// DBV Typst Editor — Tests del panel del historial local (RF-73)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = { historyList: vi.fn(), historyRead: vi.fn(), readFile: vi.fn() };
vi.mock('../services/backend.js', () =>
  Object.fromEntries(Object.keys(backend).map((name) => [name, (...args) => backend[name](...args)])),
);

const { createHistoryPanel, describeVersion } = await import('./historyPanel.js');
const { createDiffModal } = await import('../editor/diffModal.js');

const PATH = 'D:/libro/cap1.typ';
const wait = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  document.body.innerHTML = `
    <div id="h" class="hidden"><p id="f"></p><ul id="l"></ul><button id="c"></button></div>
    <div id="diff" class="hidden">
      <h2 class="modal__title">Diferencias</h2>
      <h3 class="diff-pane__title">Local</h3><pre id="dl"></pre>
      <h3 class="diff-pane__title">Disco</h3><pre id="dd"></pre>
      <button id="dc">Cancelar</button><button id="dr">Recargar</button><button id="dk">Conservar</button>
    </div>`;
  const $ = (id) => document.getElementById(id);
  const diffModal = createDiffModal({
    dialogEl: $('diff'),
    localEl: $('dl'),
    diskEl: $('dd'),
    keepMineBtn: $('dk'),
    reloadDiskBtn: $('dr'),
    cancelBtn: $('dc'),
  });
  const workspace = {
    getDocumentPath: vi.fn(() => PATH),
    getContent: vi.fn(() => 'contenido actual'),
    restoreVersion: vi.fn(async () => true),
  };
  const notify = vi.fn();
  const panel = createHistoryPanel({ dialogEl: $('h'), fileEl: $('f'), listEl: $('l'), closeEl: $('c'), diffModal, workspace, notify });
  return { panel, workspace, notify, $ };
}

beforeEach(() => {
  for (const mock of Object.values(backend)) mock.mockReset();
});

describe('describeVersion', () => {
  it('dice cuándo, por qué y cuánto ocupa', () => {
    const text = describeVersion({ id: Date.UTC(2026, 8, 26, 10, 0), reason: 'auto', size: 2048 }, 'es-ES');
    expect(text.when).toContain('2026');
    expect(text.reason).not.toBe('');
    expect(text.size).toBe('2.0 KB');
  });
});

describe('panel del historial (RF-73.5)', () => {
  it('lista las versiones, de la más reciente a la más antigua', async () => {
    const { panel, $ } = setup();
    backend.historyList.mockResolvedValue({ ok: true, value: [{ id: 2000, reason: 'save', size: 5 }, { id: 1000, reason: 'auto', size: 4 }] });
    await panel.open(PATH);
    expect($('h').classList.contains('hidden')).toBe(false);
    expect($('l').querySelectorAll('.history-list__item')).toHaveLength(2);
    expect($('f').textContent).toBe(PATH);
  });

  it('sin versiones lo dice', async () => {
    const { panel, $ } = setup();
    backend.historyList.mockResolvedValue({ ok: true, value: [] });
    await panel.open(PATH);
    expect($('l').querySelector('.history-list__empty')).not.toBeNull();
  });

  it('Restaurar pone la versión en el editor y no escribe en disco', async () => {
    const { panel, workspace, $ } = setup();
    backend.historyList.mockResolvedValue({ ok: true, value: [{ id: 1000, reason: 'reload', size: 4 }] });
    backend.historyRead.mockResolvedValue({ ok: true, value: 'versión antigua' });
    await panel.open(PATH);

    const [, restore] = $('l').querySelectorAll('button');
    restore.click();
    await wait();

    expect(workspace.restoreVersion).toHaveBeenCalledWith(PATH, 'versión antigua');
    expect($('h').classList.contains('hidden')).toBe(true);
  });

  it('Comparar usa el modal de diferencias con sus propias etiquetas y las devuelve al cerrar', async () => {
    const { panel, workspace, $ } = setup();
    backend.historyList.mockResolvedValue({ ok: true, value: [{ id: 1000, reason: 'save', size: 4 }] });
    backend.historyRead.mockResolvedValue({ ok: true, value: 'versión antigua' });
    await panel.open(PATH);

    const [compare] = $('l').querySelectorAll('button');
    compare.click();
    await wait();

    expect($('diff').classList.contains('hidden')).toBe(false);
    expect($('dl').textContent).toBe('contenido actual');
    expect($('dd').textContent).toBe('versión antigua');
    expect($('dr').textContent).not.toBe('Recargar');

    $('dr').click();
    await wait();
    expect(workspace.restoreVersion).toHaveBeenCalledWith(PATH, 'versión antigua');
    expect($('dr').textContent).toBe('Recargar');
    expect(document.querySelector('#diff .modal__title').textContent).toBe('Diferencias');
  });

  it('un fichero que no está abierto se compara con su contenido en disco', async () => {
    const { panel, workspace, $ } = setup();
    workspace.getDocumentPath.mockReturnValue('D:/libro/main.typ');
    backend.historyList.mockResolvedValue({ ok: true, value: [{ id: 1000, reason: 'save', size: 4 }] });
    backend.historyRead.mockResolvedValue({ ok: true, value: 'antigua' });
    backend.readFile.mockResolvedValue({ ok: true, value: { content: 'en disco' } });
    await panel.open(PATH);
    $('l').querySelector('button').click();
    await wait();
    expect($('dl').textContent).toBe('en disco');
  });
});
