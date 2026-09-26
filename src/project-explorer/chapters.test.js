// =============================================================================
// DBV Typst Editor — Tests de «Nuevo capítulo…» (RF-71)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const backend = { chapterCreate: vi.fn(), chapterFolder: vi.fn(), chapterLink: vi.fn(), readFile: vi.fn() };
vi.mock('../services/backend.js', () =>
  Object.fromEntries(Object.keys(backend).map((name) => [name, (...args) => backend[name](...args)])),
);

const { createChapterDialog, createChapterFlow, slugifyTitle } = await import('./chapters.js');

describe('slugifyTitle (RF-71.2)', () => {
  it('minúsculas, sin acentos ni espacios, con .typ', () => {
    expect(slugifyTitle('Introducción a la Programación')).toBe('introduccion-a-la-programacion.typ');
    expect(slugifyTitle('  Capítulo 3: ¿Punteros?  ')).toBe('capitulo-3-punteros.typ');
    expect(slugifyTitle('Ñandú & Cía.')).toBe('nandu-cia.typ');
  });

  it('sin nada aprovechable, un nombre por defecto', () => {
    expect(slugifyTitle('¿¡!?')).toBe('capitulo.typ');
    expect(slugifyTitle('')).toBe('capitulo.typ');
  });
});

function dialogDom() {
  document.body.innerHTML = `
    <div id="d" class="hidden"><form id="f">
      <input id="h" /><input id="file" /><input id="folder" />
      <p id="e" class="hidden"></p><button id="c" type="button"></button>
    </form></div>`;
  const $ = (id) => document.getElementById(id);
  return {
    dialogEl: $('d'),
    formEl: $('f'),
    headingEl: $('h'),
    fileEl: $('file'),
    folderEl: $('folder'),
    errorEl: $('e'),
    cancelEl: $('c'),
  };
}

const type = (input, value) => {
  input.value = value;
  input.dispatchEvent(new Event('input'));
};
const submit = (form) => form.dispatchEvent(new Event('submit', { cancelable: true }));
const wait = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('diálogo del capítulo', () => {
  it('deriva el fichero del título hasta que se toca a mano', () => {
    const elements = dialogDom();
    createChapterDialog(elements).open({ folder: 'capitulos', submit: vi.fn() });
    expect(elements.folderEl.value).toBe('capitulos');

    type(elements.headingEl, 'Memoria dinámica');
    expect(elements.fileEl.value).toBe('memoria-dinamica.typ');

    type(elements.fileEl, 'cap5.typ');
    type(elements.headingEl, 'Otro título');
    expect(elements.fileEl.value).toBe('cap5.typ');
  });

  it('sin título no envía; con título envía los valores y un error del backend se muestra sin cerrar', async () => {
    const elements = dialogDom();
    const onSubmit = vi.fn().mockResolvedValueOnce('Ya existe «cap5.typ» en esa carpeta.').mockResolvedValueOnce(null);
    const done = createChapterDialog(elements).open({ folder: '/capitulos/', submit: onSubmit });

    submit(elements.formEl);
    await wait();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(elements.errorEl.classList.contains('hidden')).toBe(false);

    type(elements.headingEl, 'Punteros');
    type(elements.fileEl, 'cap5');
    submit(elements.formEl);
    await wait();
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Punteros', fileName: 'cap5.typ', folder: 'capitulos' });
    expect(elements.errorEl.textContent).toContain('Ya existe');
    expect(elements.dialogEl.classList.contains('hidden')).toBe(false);

    submit(elements.formEl);
    await done;
    expect(elements.dialogEl.classList.contains('hidden')).toBe(true);
  });
});

describe('flujo del capítulo', () => {
  const ROOT = 'D:/libro';
  let tree;
  let workspace;
  let notify;
  let values;
  const dialog = { open: vi.fn(async ({ submit: run }) => run(values)) };

  beforeEach(() => {
    for (const mock of Object.values(backend)) mock.mockReset();
    dialog.open.mockClear();
    values = { title: 'Punteros', fileName: 'punteros.typ', folder: 'capitulos' };
    tree = { getRoot: () => ROOT, refresh: vi.fn(async () => true), revealPath: vi.fn(async () => {}) };
    workspace = {
      getEntrypoint: vi.fn(() => 'main.typ'),
      getOpenDocumentSnapshot: vi.fn(() => null),
      isDirty: vi.fn(() => false),
      applyBufferEdits: vi.fn(),
      save: vi.fn(async () => true),
      openDocument: vi.fn(async () => true),
    };
    notify = vi.fn();
    backend.readFile.mockResolvedValue({ ok: true, value: { content: '#include "capitulos/uno.typ"' } });
    backend.chapterFolder.mockResolvedValue({ ok: true, value: 'capitulos' });
    backend.chapterCreate.mockResolvedValue({ ok: true, value: `${ROOT}/capitulos/punteros.typ` });
  });

  it('con el principal cerrado: propone la carpeta de los capítulos, crea, enlaza en disco y abre el capítulo', async () => {
    backend.chapterLink.mockResolvedValue({ ok: true, value: { edit: null, includeValue: 'capitulos/punteros.typ' } });
    await createChapterFlow({ tree, workspace, dialog, notify }).newChapter();

    expect(dialog.open).toHaveBeenCalledWith(expect.objectContaining({ folder: 'capitulos' }));
    expect(backend.chapterCreate).toHaveBeenCalledWith(ROOT, 'capitulos', 'punteros.typ', 'Punteros');
    expect(backend.chapterLink).toHaveBeenCalledWith(ROOT, `${ROOT}/main.typ`, null, `${ROOT}/capitulos/punteros.typ`);
    expect(workspace.openDocument).toHaveBeenCalledWith(`${ROOT}/capitulos/punteros.typ`);
  });

  it('desde el menú de una carpeta, esa carpeta manda', async () => {
    backend.chapterLink.mockResolvedValue({ ok: true, value: { edit: null } });
    await createChapterFlow({ tree, workspace, dialog, notify }).newChapter({ dirPath: `${ROOT}/anexos` });
    expect(dialog.open).toHaveBeenCalledWith(expect.objectContaining({ folder: 'anexos' }));
    expect(backend.chapterFolder).not.toHaveBeenCalled();
  });

  it('con el principal abierto y limpio: edita el editor, guarda y abre el capítulo', async () => {
    workspace.getOpenDocumentSnapshot.mockReturnValue({ path: `${ROOT}/main.typ`, content: 'abierto' });
    const edit = { from: 7, to: 7, insert: '#include "capitulos/punteros.typ"\n' };
    backend.chapterLink.mockResolvedValue({ ok: true, value: { edit } });

    await createChapterFlow({ tree, workspace, dialog, notify }).newChapter();

    expect(backend.chapterLink).toHaveBeenCalledWith(ROOT, `${ROOT}/main.typ`, 'abierto', expect.any(String));
    expect(workspace.applyBufferEdits).toHaveBeenCalledWith([edit]);
    expect(workspace.save).toHaveBeenCalled();
    expect(workspace.openDocument).toHaveBeenCalled();
  });

  it('con el principal abierto y con cambios del usuario: no guarda por él ni abre el capítulo encima', async () => {
    workspace.getOpenDocumentSnapshot.mockReturnValue({ path: `${ROOT}/main.typ`, content: 'con cambios' });
    workspace.isDirty.mockReturnValue(true);
    backend.chapterLink.mockResolvedValue({ ok: true, value: { edit: { from: 0, to: 0, insert: 'x' } } });

    await createChapterFlow({ tree, workspace, dialog, notify }).newChapter();

    expect(workspace.applyBufferEdits).toHaveBeenCalled();
    expect(workspace.save).not.toHaveBeenCalled();
    expect(workspace.openDocument).not.toHaveBeenCalled();
    expect(tree.revealPath).toHaveBeenCalledWith(`${ROOT}/capitulos/punteros.typ`);
  });

  it('sin documento principal: crea, avisa de que no se ha enlazado y abre el capítulo', async () => {
    workspace.getEntrypoint.mockReturnValue(null);
    await createChapterFlow({ tree, workspace, dialog, notify }).newChapter();
    expect(backend.chapterLink).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(workspace.openDocument).toHaveBeenCalled();
  });

  it('un error al crear vuelve al diálogo como mensaje', async () => {
    backend.chapterCreate.mockResolvedValue({ ok: false, error: { message: 'Ya existe «punteros.typ» en esa carpeta.' } });
    let returned;
    dialog.open.mockImplementationOnce(async ({ submit: run }) => {
      returned = await run(values);
    });
    await createChapterFlow({ tree, workspace, dialog, notify }).newChapter();
    expect(returned).toContain('Ya existe');
    expect(backend.chapterLink).not.toHaveBeenCalled();
  });
});
