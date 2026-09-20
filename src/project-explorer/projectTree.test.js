// =============================================================================
// DBV Typst Editor — Tests del árbol de proyecto: documento principal
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El documento principal se marca en el árbol con una etiqueta y se elige con
// el botón derecho. Sin `main.typ`, la heurística escoge el primer `.typ`
// alfabético, que en un libro real (`z6-IPbook`) era `CexsTasks.typ` y no el
// libro `IP.typ`: por eso el usuario necesita verlo y poder cambiarlo.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const listDirectory = vi.fn();
const revealInFileManager = vi.fn();

vi.mock('../services/backend.js', () => ({
  listDirectory: (...args) => listDirectory(...args),
  revealInFileManager: (...args) => revealInFileManager(...args),
}));

const { createProjectTree } = await import('./projectTree.js');

/** Ruta de Windows `D:\p\<name>`, armada con el carácter real para no depender de escapes. */
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
const rowOf = (container, name) => container.querySelector(`.tree-row[data-name="${name}"]`);

describe('documento principal en el árbol', () => {
  let container;
  let onSetEntrypoint;
  let tree;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="tree"></div>';
    container = document.getElementById('tree');
    listDirectory.mockReset().mockResolvedValue({
      ok: true,
      value: [entry('CexsTasks.typ'), entry('IP.typ'), entry('IP.bib', { isTypst: false }), entry('figs', { isDir: true })],
    });
    revealInFileManager.mockReset();
    onSetEntrypoint = vi.fn();
    tree = createProjectTree(container, { onOpenFile: vi.fn(), onSetEntrypoint });
    tree.setEntrypointPath(win('CexsTasks.typ'));
    await tree.setRoot(win());
    await settle();
  });

  it('etiqueta solo el fichero principal', () => {
    expect(rowOf(container, 'CexsTasks.typ').querySelector('.tree-row__badge')).not.toBeNull();
    expect(rowOf(container, 'IP.typ').querySelector('.tree-row__badge')).toBeNull();
    expect(container.querySelectorAll('.tree-row__badge')).toHaveLength(1);
  });

  it('cambiar el principal mueve la etiqueta y anula la anterior', () => {
    tree.setEntrypointPath(win('IP.typ'));

    expect(rowOf(container, 'CexsTasks.typ').querySelector('.tree-row__badge')).toBeNull();
    expect(rowOf(container, 'IP.typ').querySelector('.tree-row__badge')).not.toBeNull();
    expect(container.querySelectorAll('.tree-row__badge')).toHaveLength(1);
  });

  it('compara rutas sin depender del separador', () => {
    tree.setEntrypointPath('D:/p/IP.typ');

    expect(rowOf(container, 'IP.typ').querySelector('.tree-row__badge')).not.toBeNull();
  });

  it('el botón derecho sobre un .typ ofrece marcarlo como principal', () => {
    rowOf(container, 'IP.typ').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    const items = [...document.querySelectorAll('.tree-context-menu .menu-item')];
    expect(items).toHaveLength(2);

    items[0].click();
    expect(onSetEntrypoint).toHaveBeenCalledWith(win('IP.typ'));
    expect(document.querySelector('.tree-context-menu')).toBeNull();
  });

  it('no ofrece marcar como principal lo que ya lo es, ni lo que no es .typ', () => {
    rowOf(container, 'CexsTasks.typ').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(document.querySelectorAll('.tree-context-menu .menu-item')).toHaveLength(1);

    rowOf(container, 'IP.bib').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(document.querySelectorAll('.tree-context-menu .menu-item')).toHaveLength(1);

    rowOf(container, 'figs').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(document.querySelectorAll('.tree-context-menu .menu-item')).toHaveLength(1);
  });

  it('"Mostrar en el explorador" sigue disponible con el botón derecho', () => {
    rowOf(container, 'IP.bib').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    document.querySelector('.tree-context-menu .menu-item').click();

    expect(revealInFileManager).toHaveBeenCalledWith(win('IP.bib'));
  });

  it('Escape cierra el menú', () => {
    rowOf(container, 'IP.typ').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(document.querySelector('.tree-context-menu')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(document.querySelector('.tree-context-menu')).toBeNull();
  });
});

describe('"Abrir como texto" (RF-60.6)', () => {
  let container;
  let onOpenFile;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="tree"></div>';
    container = document.getElementById('tree');
    listDirectory.mockReset().mockResolvedValue({
      ok: true,
      value: [entry('main.typ'), entry('sim.cpp'), entry('datos.zzz', { isEditable: false }), entry('logo.png', { isEditable: false })],
    });
    onOpenFile = vi.fn();
    const tree = createProjectTree(container, { onOpenFile, onSetEntrypoint: vi.fn() });
    await tree.setRoot(win());
    await settle();
  });

  const menuLabels = (name) => {
    rowOf(container, name).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    return [...document.querySelectorAll('.tree-context-menu .menu-item')];
  };

  it('un fichero que no se reconoce como texto lo ofrece y lo abre', () => {
    const items = menuLabels('datos.zzz');

    expect(items).toHaveLength(2);
    items[0].click();
    expect(onOpenFile).toHaveBeenCalledWith(win('datos.zzz'));
  });

  it('un fichero que ya es editable (código, texto) no lo ofrece: se abre con un clic', () => {
    expect(menuLabels('sim.cpp')).toHaveLength(1);
  });
});
