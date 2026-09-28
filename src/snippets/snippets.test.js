// =============================================================================
// DBV Typst Editor — Tests de los snippets de usuario (RF-81)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CompletionContext, nextSnippetField } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { createSnippetStore, escapeSnippetText, parseSnippetFile, resolveVariables } from './model.js';
import { createSnippetCompletionSource, previewBody } from './completion.js';

// Tal cual se escribe en VS Code: comentarios, comas finales, `body` en lista.
const VSCODE_FILE = `{
  // Figura con imagen, pie y etiqueta
  "Figura": {
    "prefix": ["fig", "figura"],
    "body": [
      "#figure(",
      "  image(\\"\${1:ruta}\\"),",
      "  caption: [\${2:pie}],",
      ") <\${3:etiqueta}>",
    ],
    "description": "Figura con imagen",
  },
  /* Solo para Markdown: no aplica a Typst */
  "Enlace md": { "prefix": "lnk", "body": "[$1]($2)", "scope": "markdown" },
  "Nota": { "prefix": "nota", "body": "#footnote[$1]", "scope": "typst, markdown" },
  "Roto": { "prefix": "roto" },
}`;

describe('lectura de ficheros de snippets (RF-81.1, RF-81.6)', () => {
  it('lee JSONC con comentarios y comas finales; body como lista; prefijo múltiple; scope', () => {
    const { snippets, errors, warnings } = parseSnippetFile(VSCODE_FILE, 'global');
    expect(errors).toEqual([]);
    expect(snippets.map((item) => item.prefix)).toEqual(['fig', 'figura', 'nota']);
    expect(snippets[0].body).toBe('#figure(\n  image("${1:ruta}"),\n  caption: [${2:pie}],\n) <${3:etiqueta}>');
    expect(snippets[0].description).toBe('Figura con imagen');
    expect(warnings).toEqual(['Roto']);
  });

  it('un JSON roto devuelve el error con su línea y no lee nada', () => {
    const { snippets, errors } = parseSnippetFile('{\n  "a": { "prefix": "a", "body": "x" }\n  "b": 1\n}', 'global');
    expect(snippets).toEqual([]);
    expect(errors[0].line).toBe(3);
  });
});

describe('variables y escape (RF-81.3, R-N2)', () => {
  it('sustituye las variables admitidas y escapa su valor', () => {
    const date = new Date(2026, 8, 5);
    const body = '$TM_FILENAME_BASE ${CURRENT_YEAR}-$CURRENT_MONTH-${CURRENT_DATE:x} [$TM_SELECTED_TEXT] $OTRA';
    expect(resolveVariables(body, { fileName: 'cap1.typ', selectedText: 'precio $5}', date })).toBe(
      'cap1 2026-09-05 [precio \\$5\\}] $OTRA'
    );
  });

  it('escapeSnippetText protege $, } y la barra invertida', () => {
    expect(escapeSnippetText('a $x} \\ b')).toBe('a \\$x\\} \\\\ b');
  });
});

describe('conjunto de snippets (RF-81.2, RF-81.6)', () => {
  it('ofrece primero los del proyecto y conserva los anteriores si un fichero se rompe', () => {
    const store = createSnippetStore();
    store.load('global.json', '{"A": {"prefix": "x", "body": "global"}}', 'global');
    store.load('.vscode/p.code-snippets', '{"A": {"prefix": "x", "body": "proyecto"}}', 'project');
    expect(store.all().map((item) => item.body)).toEqual(['proyecto', 'global']);

    const broken = store.load('global.json', '{ roto', 'global');
    expect(broken.errors.length).toBeGreaterThan(0);
    expect(store.all().map((item) => item.body)).toEqual(['proyecto', 'global']);

    store.clear('project');
    expect(store.all().map((item) => item.body)).toEqual(['global']);
  });
});

describe('en el autocompletado (RF-81.3)', () => {
  let view;

  beforeEach(() => {
    Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
    Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  });

  afterEach(() => view?.destroy());

  it('un snippet copiado de VS Code se inserta con sus campos y Tab salta entre ellos', () => {
    const snippets = parseSnippetFile(VSCODE_FILE, 'project').snippets;
    const source = createSnippetCompletionSource(() => snippets, () => '/p/main.typ');
    view = new EditorView({ state: EditorState.create({ doc: 'Texto fig' }), parent: document.body });
    view.dispatch({ selection: { anchor: 9 } });

    const result = source(new CompletionContext(view.state, 9, false));
    expect(result.from).toBe(6);
    const option = result.options.find((item) => item.label === 'fig');
    expect(option.type).toBe('snippet');
    expect(option.info).toContain('image("ruta")');

    option.apply(view, option, result.from, 9);
    expect(view.state.doc.toString()).toBe('Texto #figure(\n  image("ruta"),\n  caption: [pie],\n) <etiqueta>');
    const selected = () => view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to);
    expect(selected()).toBe('ruta');
    nextSnippetField(view);
    expect(selected()).toBe('pie');
    nextSnippetField(view);
    expect(selected()).toBe('etiqueta');
  });

  it('sin nada escrito no molesta; con Ctrl+Espacio sí ofrece', () => {
    const source = createSnippetCompletionSource(() => parseSnippetFile(VSCODE_FILE, 'global').snippets);
    const state = EditorState.create({ doc: 'Hola ' });
    expect(source(new CompletionContext(state, 5, false))).toBe(null);
    expect(source(new CompletionContext(state, 5, true)).options.length).toBe(3);
  });

  it('previewBody quita las marcas de campos', () => {
    expect(previewBody('#link("${1:url}")[$2]')).toBe('#link("url")[]');
  });
});
