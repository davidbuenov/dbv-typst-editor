// =============================================================================
// DBV Typst Editor — Tests del árbol de proyecto: explorador completo (RF-69)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Selección múltiple, filas editables en línea, menú contextual completo,
// teclado y un refresco que conserva las carpetas abiertas. El árbol solo
// maneja DOM: las operaciones de disco llegan a los callbacks.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const listDirectory = vi.fn();

vi.mock('../services/backend.js', () => ({
  listDirectory: (...args) => listDirectory(...args),
  revealInFileManager: vi.fn(),
}));

const { createProjectTree } = await import('./projectTree.js');

const ROOT = 'D:/libro';
const file = (path, extra = {}) => ({
  name: path.split('/').pop(),
  path: `${ROOT}/${path}`,
  isDir: false,
  isTypst: path.endsWith('.typ'),
  isEditable: true,
  ...extra,
});
const dir = (path) => ({ ...file(path), isDir: true, isTypst: false, isEditable: false });

/** Contenido del disco simulado, por carpeta. */
let disk;
const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
/** El refresco agrupa llamadas durante 150 ms. */
const afterRefresh = () => wait(200);
const rowOf = (container, name) => container.querySelector(`.tree-row[data-name="${name}"]`);
const click = (el, init = {}) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
const key = (el, keyName) => el.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true }));
const menuActions = () => [...document.querySelectorAll('.tree-context-menu .menu-item')].map((item) => item.dataset.action);
const openMenu = (container, name) =>
  rowOf(container, name).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

describe('explorador de archivos (RF-69)', () => {
  let container;
  let onOpenFile;
  let onCommitName;
  let onAction;
  let tree;

  beforeEach(async () => {
    document.body.innerHTML = '<div id="tree"></div>';
    container = document.getElementById('tree');
    disk = {
      [ROOT]: [dir('capitulos'), file('main.typ'), file('refs.bib', { isTypst: false })],
      [`${ROOT}/capitulos`]: [file('capitulos/cap1.typ'), file('capitulos/cap2.typ')],
    };
    listDirectory.mockReset().mockImplementation(async (path) => ({ ok: true, value: disk[path] ?? [] }));
    onOpenFile = vi.fn();
    onCommitName = vi.fn(async ({ dirPath, name }) => ({ ok: true, path: `${dirPath}/${name}` }));
    onAction = vi.fn();
    tree = createProjectTree(container, { onOpenFile, onSetEntrypoint: vi.fn(), onCommitName, onAction, onMove: vi.fn() });
    await tree.setRoot(ROOT);
    await wait();
  });

  it('un clic selecciona y abre; Ctrl+clic añade sin abrir; Mayús+clic selecciona un rango', () => {
    click(rowOf(container, 'main.typ'));
    expect(onOpenFile).toHaveBeenCalledWith(`${ROOT}/main.typ`);
    expect(tree.getSelection().map((entry) => entry.name)).toEqual(['main.typ']);

    click(rowOf(container, 'refs.bib'), { ctrlKey: true });
    expect(onOpenFile).toHaveBeenCalledTimes(1);
    expect(tree.getSelection().map((entry) => entry.name)).toEqual(['main.typ', 'refs.bib']);

    click(rowOf(container, 'capitulos'));
    click(rowOf(container, 'refs.bib'), { shiftKey: true });
    expect(tree.getSelection().map((entry) => entry.name)).toEqual(['capitulos', 'main.typ', 'refs.bib']);
  });

  it('la carpeta de destino de la cabecera es la seleccionada, la del fichero seleccionado o la raíz', async () => {
    expect(tree.getTargetDir()).toBe(ROOT);
    click(rowOf(container, 'capitulos'));
    await wait();
    expect(tree.getTargetDir()).toBe(`${ROOT}/capitulos`);
    click(rowOf(container, 'cap1.typ'));
    expect(tree.getTargetDir()).toBe(`${ROOT}/capitulos`);
  });

  it('refrescar conserva las carpetas abiertas y la selección', async () => {
    click(rowOf(container, 'capitulos'));
    await wait();
    click(rowOf(container, 'cap2.typ'));
    disk[`${ROOT}/capitulos`].push(file('capitulos/cap3.typ'));

    await tree.refresh();
    await wait();

    expect(rowOf(container, 'cap3.typ')).not.toBeNull();
    expect(rowOf(container, 'cap3.typ').closest('.tree-children').classList.contains('hidden')).toBe(false);
    expect(rowOf(container, 'cap2.typ').classList.contains('is-selected')).toBe(true);
  });

  it('varios refrescos seguidos se agrupan en una sola lectura', async () => {
    listDirectory.mockClear();
    tree.refresh();
    tree.refresh();
    await tree.refresh();
    expect(listDirectory.mock.calls.filter(([path]) => path === ROOT)).toHaveLength(1);
  });

  it('crear en línea: Intro confirma y la fila nueva queda seleccionada', async () => {
    disk[ROOT].push(file('nuevo.typ'));
    await tree.startCreate('file', ROOT);
    const input = container.querySelector('.tree-edit__input');
    expect(input).not.toBeNull();

    input.value = 'nuevo.typ';
    key(input, 'Enter');
    await afterRefresh();

    expect(onCommitName).toHaveBeenCalledWith({ mode: 'create-file', dirPath: ROOT, name: 'nuevo.typ' });
    expect(container.querySelector('.tree-edit__input')).toBeNull();
    expect(rowOf(container, 'nuevo.typ').classList.contains('is-selected')).toBe(true);
  });

  it('crear en línea: un error del backend se muestra junto al campo, que sigue abierto', async () => {
    onCommitName.mockResolvedValueOnce({ ok: false, message: 'Ya existe «main.typ» en esa carpeta.' });
    await tree.startCreate('file', ROOT);
    const input = container.querySelector('.tree-edit__input');
    input.value = 'main.typ';
    key(input, 'Enter');
    await wait();

    expect(container.querySelector('.tree-edit__error').textContent).toContain('Ya existe');
    expect(container.querySelector('.tree-edit__input')).not.toBeNull();
  });

  it('crear en línea: Escape cancela sin llamar al backend', async () => {
    await tree.startCreate('dir', ROOT);
    const input = container.querySelector('.tree-edit__input');
    input.value = 'algo';
    key(input, 'Escape');
    expect(onCommitName).not.toHaveBeenCalled();
    expect(container.querySelector('.tree-edit__input')).toBeNull();
  });

  it('crear dentro de una subcarpeta la abre primero', async () => {
    await tree.startCreate('file', `${ROOT}/capitulos`);
    const input = container.querySelector('.tree-edit__input');
    expect(input.closest('.tree-children')).not.toBeNull();
    expect(rowOf(container, 'cap1.typ')).not.toBeNull();
  });

  it('F2 renombra en línea con el nombre sin extensión seleccionado', () => {
    const row = rowOf(container, 'main.typ');
    key(row, 'F2');
    const input = row.querySelector('.tree-edit__input');
    expect(input.value).toBe('main.typ');
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 4]);

    input.value = 'libro.typ';
    key(input, 'Enter');
    expect(onCommitName).toHaveBeenCalledWith(expect.objectContaining({ mode: 'rename', name: 'libro.typ', dirPath: ROOT }));
  });

  it('confirmar el mismo nombre no llama al backend', () => {
    const row = rowOf(container, 'main.typ');
    key(row, 'F2');
    key(row.querySelector('.tree-edit__input'), 'Enter');
    expect(onCommitName).not.toHaveBeenCalled();
  });

  it('Supr pide eliminar la selección', () => {
    click(rowOf(container, 'main.typ'));
    click(rowOf(container, 'refs.bib'), { ctrlKey: true });
    key(rowOf(container, 'refs.bib'), 'Delete');
    const [action, context] = onAction.mock.calls[0];
    expect(action).toBe('delete');
    expect(context.entries.map((entry) => entry.name)).toEqual(['main.typ', 'refs.bib']);
  });

  it('el menú de un fichero ofrece el explorador completo', () => {
    openMenu(container, 'refs.bib');
    expect(menuActions()).toEqual([
      'newFile',
      'newFolder',
      'rename',
      'duplicate',
      'delete',
      'copyPath',
      'copyRelativePath',
      'reveal',
    ]);
    expect(document.querySelectorAll('.tree-context-menu .menu-separator').length).toBeGreaterThan(0);
  });

  it('con varios seleccionados, el menú solo ofrece lo que vale para todos', () => {
    click(rowOf(container, 'main.typ'));
    click(rowOf(container, 'refs.bib'), { ctrlKey: true });
    openMenu(container, 'refs.bib');
    expect(menuActions()).toEqual(['delete', 'copyPath', 'copyRelativePath']);
  });

  it('el botón derecho sobre algo no seleccionado lo convierte en la selección', () => {
    click(rowOf(container, 'main.typ'));
    openMenu(container, 'refs.bib');
    document.querySelector('.tree-context-menu [data-action="duplicate"]').click();
    expect(onAction).toHaveBeenCalledWith('duplicate', expect.objectContaining({ entries: [expect.objectContaining({ name: 'refs.bib' })] }));
  });

  it('"Nuevo fichero…" del menú de una carpeta crea dentro de ella', async () => {
    openMenu(container, 'capitulos');
    document.querySelector('.tree-context-menu [data-action="newFile"]').click();
    await wait();
    const input = container.querySelector('.tree-edit__input');
    input.value = 'cap3.typ';
    key(input, 'Enter');
    expect(onCommitName).toHaveBeenCalledWith({ mode: 'create-file', dirPath: `${ROOT}/capitulos`, name: 'cap3.typ' });
  });

  it('un refresco durante una edición espera a que termine para no borrar el campo', async () => {
    await tree.startCreate('file', ROOT);
    tree.refresh();
    await afterRefresh();
    expect(container.querySelector('.tree-edit__input')).not.toBeNull();
  });
});

describe('opciones del menú que dependen de la versión (RF-71, RF-73)', () => {
  it('"Nuevo capítulo…" e "Historial local…" solo aparecen si están activadas', async () => {
    document.body.innerHTML = '<div id="tree"></div>';
    const container = document.getElementById('tree');
    disk = { [ROOT]: [dir('capitulos'), file('main.typ')] };
    listDirectory.mockReset().mockImplementation(async (path) => ({ ok: true, value: disk[path] ?? [] }));
    const tree = createProjectTree(container, {
      onCommitName: vi.fn(),
      onAction: vi.fn(),
      features: { chapter: true, history: true },
    });
    await tree.setRoot(ROOT);
    await wait();

    openMenu(container, 'capitulos');
    expect(menuActions()).toContain('newChapter');
    expect(menuActions()).not.toContain('history');

    openMenu(container, 'main.typ');
    expect(menuActions()).toContain('history');
  });
});
