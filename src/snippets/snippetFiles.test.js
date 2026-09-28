// =============================================================================
// DBV Typst Editor — Tests de los ficheros de snippets y «Guardar selección» (RF-81)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { addSnippetToText, createSnippetDialog, selectionToBody } from './saveSelection.js';
import { createSnippetLoader, isProjectSnippetFile } from './loader.js';
import { createSnippetStore, parseSnippetFile } from './model.js';
import { createSnippetCompletionSource } from './completion.js';
import { CompletionContext } from '@codemirror/autocomplete';
import { detectLanguage } from '../editor/languageSupport.js';

const WITH_COMMENTS = `{
  // Mis snippets de Typst
  "Nota": {
    "prefix": "nota", // la uso mucho
    "body": "#footnote[$1]",
  },
}
`;

describe('«Guardar selección como snippet» (RF-81.7, R-N1, R-N2)', () => {
  it('añade la entrada sin tocar los comentarios ni lo demás', () => {
    const added = addSnippetToText(WITH_COMMENTS, { name: 'Firma', prefix: 'firma', description: 'Mi firma', body: 'Un saludo' });
    expect(added.ok).toBe(true);
    expect(added.text).toContain('// Mis snippets de Typst');
    expect(added.text).toContain('"prefix": "nota", // la uso mucho');
    const { snippets, errors } = parseSnippetFile(added.text, 'project');
    expect(errors).toEqual([]);
    expect(snippets.map((item) => item.prefix)).toEqual(['nota', 'firma']);
  });

  it('un nombre repetido se numera; un fichero con errores no se toca', () => {
    const once = addSnippetToText(WITH_COMMENTS, { name: 'Nota', prefix: 'n2', description: '', body: 'x' });
    expect(once.name).toBe('Nota 2');
    expect(addSnippetToText('{ roto', { name: 'A', prefix: 'a', description: '', body: 'x' })).toEqual({ ok: false, reason: 'invalid' });
    expect(addSnippetToText('', { name: 'A', prefix: 'a', description: '', body: 'x' }).ok).toBe(true);
  });

  it('guardar una selección con $ y llaves y escribir su prefijo la inserta tal cual', () => {
    const selected = '#let precio = $5 + {x}\n#precio \\ fin';
    const added = addSnippetToText('{}', { name: 'Precio', prefix: 'precio', description: '', body: selectionToBody(selected) });
    const store = createSnippetStore();
    store.load('g.json', added.text, 'global');
    const source = createSnippetCompletionSource(() => store.all());
    const view = new EditorView({ state: EditorState.create({ doc: 'precio' }) });
    const result = source(new CompletionContext(view.state, 6, false));
    const option = result.options[0];
    option.apply(view, option, result.from, 6);
    expect(view.state.doc.toString()).toBe(selected);
    view.destroy();
  });
});

describe('carga y recarga (RF-81.2, RF-81.5, RF-81.6)', () => {
  let files;
  let store;
  let notify;
  let loader;

  beforeEach(() => {
    files = {
      'C:/cfg/snippets/typst.json': '{"G": {"prefix": "g", "body": "global"}}',
      'D:/libro/.vscode/libro.code-snippets': '{"P": {"prefix": "p", "body": "proyecto"}}',
    };
    store = createSnippetStore();
    notify = vi.fn();
    loader = createSnippetLoader({
      store,
      notify,
      t: (key) => key,
      backend: {
        readFile: async (path) => (path in files ? { ok: true, value: { content: files[path] } } : { ok: false, error: { message: 'no existe' } }),
        snippetsGlobalPath: async () => ({ ok: true, value: 'C:/cfg/snippets/typst.json' }),
        snippetsProjectFiles: async () => ({ ok: true, value: ['D:/libro/.vscode/libro.code-snippets'] }),
      },
    });
  });

  it('carga los globales y los del proyecto, con los del proyecto primero', async () => {
    await loader.loadGlobal();
    await loader.loadProject('D:/libro');
    expect(store.all().map((item) => item.body)).toEqual(['proyecto', 'global']);
  });

  it('al guardar o cambiar por fuera se recarga; si se rompe avisa con la línea y conserva los anteriores', async () => {
    await loader.loadGlobal();
    await loader.loadProject('D:/libro');
    expect(await loader.handleChanged('D:/libro/.vscode/libro.code-snippets', '{"P": {"prefix": "p", "body": "nuevo"}}')).toBe(true);
    expect(store.all()[0].body).toBe('nuevo');

    await loader.handleChanged('D:/libro/.vscode/libro.code-snippets', '{\n  "P": \n}');
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('snippets.jsonError'), 'error');
    expect(store.all()[0].body).toBe('nuevo');

    expect(await loader.handleChanged('D:/libro/main.typ')).toBe(false);
  });

  it('un fichero borrado deja de aportar snippets, sin avisos', async () => {
    await loader.loadGlobal();
    delete files['C:/cfg/snippets/typst.json'];
    await loader.handleChanged('C:/cfg/snippets/typst.json');
    expect(store.all()).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('reconoce los ficheros de snippets del proyecto y `.code-snippets` se edita como JSON', () => {
    expect(isProjectSnippetFile('D:\\libro\\.vscode\\typst.code-snippets')).toBe(true);
    expect(isProjectSnippetFile('D:/libro/typst.code-snippets')).toBe(false);
    expect(detectLanguage('D:/libro/.vscode/typst.code-snippets').name).toBe('JSON');
  });
});

describe('diálogo de «Guardar selección»', () => {
  let elements;
  let dialog;

  beforeEach(() => {
    document.body.replaceChildren();
    const make = (tag) => document.body.appendChild(document.createElement(tag));
    elements = { dialog: make('div'), form: make('form'), name: make('input'), prefix: make('input'), description: make('input'), destination: make('select'), error: make('p'), cancel: make('button') };
    for (const value of ['project', 'global']) {
      const option = document.createElement('option');
      option.value = value;
      elements.destination.append(option);
    }
    dialog = createSnippetDialog({ elements, t: (key) => key });
  });

  afterEach(() => document.body.replaceChildren());

  it('pide nombre y prefijo; sin proyecto el destino es global', async () => {
    const answer = dialog.open({ hasProject: false });
    expect(elements.destination.value).toBe('global');
    elements.form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(elements.error.textContent).toBe('snippets.needsNameAndPrefix');
    elements.name.value = 'Firma';
    elements.prefix.value = 'firma';
    elements.form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(await answer).toEqual({ name: 'Firma', prefix: 'firma', description: 'Firma', destination: 'global' });
  });

  it('Cancelar resuelve con null', async () => {
    const answer = dialog.open({ hasProject: true });
    expect(elements.destination.value).toBe('project');
    elements.cancel.click();
    expect(await answer).toBe(null);
  });
});
