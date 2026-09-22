// =============================================================================
// DBV Typst Editor — Tests del filtro de ficheros ocultos (RF-63.1)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reloadPrefsForTests, setPref } from '../app/prefs.js';

const listDirectory = vi.fn();
const revealInFileManager = vi.fn();

vi.mock('../services/backend.js', () => ({
  listDirectory: (...args) => listDirectory(...args),
  revealInFileManager: (...args) => revealInFileManager(...args),
}));

const { createProjectTree } = await import('./projectTree.js');

const win = (name = '') => ['D:', 'p', name].filter(Boolean).join(String.fromCharCode(92));

const entry = (name, extra = {}) => ({
  name,
  path: win(name),
  isDir: false,
  isTypst: name.endsWith('.typ'),
  isEditable: true,
  ...extra,
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const isHidden = (container, name) =>
  container.querySelector(`.tree-row[data-name="${name}"]`)?.closest('.tree-item')?.classList.contains('tree-item--dotfile-hidden');

describe('filtro de ficheros ocultos (RF-63.1)', () => {
  let container;

  beforeEach(() => {
    localStorage.clear();
    reloadPrefsForTests();
    document.body.innerHTML = '<div id="tree"></div>';
    container = document.getElementById('tree');
    listDirectory.mockReset().mockResolvedValue({
      ok: true,
      value: [
        entry('main.typ'),
        entry('.gitignore'),
        entry('.claude', { isDir: true, isTypst: false, isEditable: false }),
      ],
    });
    revealInFileManager.mockReset();
  });

  it('un dotfile no se lista por defecto', async () => {
    const tree = createProjectTree(container, { onOpenFile: vi.fn(), onSetEntrypoint: vi.fn() });
    await tree.setRoot(win());
    await settle();

    expect(isHidden(container, '.gitignore')).toBe(true);
    expect(isHidden(container, '.claude')).toBe(true);
    expect(isHidden(container, 'main.typ')).toBe(false);
  });

  it('"Mostrar ficheros ocultos" los muestra, sin volver a listar desde disco', async () => {
    const tree = createProjectTree(container, { onOpenFile: vi.fn(), onSetEntrypoint: vi.fn() });
    await tree.setRoot(win());
    await settle();
    listDirectory.mockClear();

    setPref('showHiddenFiles', true);

    expect(isHidden(container, '.gitignore')).toBe(false);
    expect(isHidden(container, '.claude')).toBe(false);
    expect(listDirectory).not.toHaveBeenCalled();
  });

  it('nunca oculta el fichero que está abierto en el editor, aunque sea un dotfile', async () => {
    listDirectory.mockResolvedValue({ ok: true, value: [entry('.env'), entry('main.typ')] });
    const tree = createProjectTree(container, { onOpenFile: vi.fn(), onSetEntrypoint: vi.fn() });
    await tree.setRoot(win());
    await settle();

    expect(isHidden(container, '.env')).toBe(true);

    tree.setActivePath(win('.env'));

    expect(isHidden(container, '.env')).toBe(false);
  });

  it('nunca oculta el documento principal, ni la carpeta oculta que lo contiene', async () => {
    listDirectory.mockResolvedValueOnce({
      ok: true,
      value: [entry('.trabajo', { isDir: true, isTypst: false, isEditable: false }), entry('main.typ')],
    });
    const tree = createProjectTree(container, { onOpenFile: vi.fn(), onSetEntrypoint: vi.fn() });
    tree.setEntrypointPath(win('.trabajo') + String.fromCharCode(92) + 'tesis.typ');
    await tree.setRoot(win());
    await settle();

    // La carpeta `.trabajo` contiene al principal: se sigue viendo para poder
    // llegar hasta él, aunque su nombre empiece por punto.
    expect(isHidden(container, '.trabajo')).toBe(false);
  });
});
