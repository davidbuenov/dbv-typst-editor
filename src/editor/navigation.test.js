// =============================================================================
// DBV Typst Editor — Tests de ir a la definición y buscar referencias (RF-77)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import captured from './__fixtures__/tinymist-0.15.8.json';
import { normalizeLocations } from './lspClient.js';
import { createNavigation, groupLocations, symbolAt } from './navigation.js';
import { createEditor } from './editor.js';
import { reloadPrefsForTests } from '../app/prefs.js';

const ROOT = 'D:/libro';
const fixtures = JSON.parse(JSON.stringify(captured).split('file:///ROOT').join(`file:///${ROOT}`));
const MAIN = `${ROOT}/main.typ`;
const UNO = `${ROOT}/cap/uno.typ`;

describe('respuestas de Tinymist normalizadas', () => {
  it('LocationLink de una etiqueta apunta al otro fichero', () => {
    expect(normalizeLocations(fixtures.definitionLabel.result)).toEqual([
      { path: UNO, range: { start: { line: 1, character: 33 }, end: { line: 1, character: 43 } } },
    ]);
  });

  it('una función interna no tiene destino', () => {
    expect(normalizeLocations(fixtures.definitionBuiltin.result)).toEqual([]);
  });

  it('las referencias de una etiqueta salen de los dos ficheros, agrupadas', () => {
    const locations = normalizeLocations(fixtures.referencesLabel.result);
    const files = { [MAIN]: fixtures.files['main.typ'], [UNO]: fixtures.files['cap/uno.typ'] };
    const groups = groupLocations(locations, ROOT, (path) => files[path]);
    expect(groups.map((group) => group.relative)).toEqual(['cap/uno.typ', 'main.typ']);
    const firstInMain = groups[1].items[0];
    expect(firstInMain.line).toBe(3);
    expect(firstInMain.text.slice(firstInMain.from, firstInMain.to)).toBe('fig-gato');
  });

  it('symbolAt distingue etiquetas de identificadores', () => {
    const state = EditorState.create({ doc: 'Ver @fig-gato y #saluda("Ana").' });
    expect(symbolAt(state, 6)).toEqual({ text: '@fig-gato', isLabel: true });
    expect(symbolAt(state, 19)).toEqual({ text: 'saluda', isLabel: false });
  });
});

describe('navegación (RF-77.1, RF-77.3)', () => {
  let workspace;
  let lsp;
  let notify;
  let navigation;
  let view;

  beforeEach(() => {
    view = new EditorView({ state: EditorState.create({ doc: fixtures.files['main.typ'] }) });
    lsp = {
      isActive: () => true,
      getStatus: () => 'ready',
      getDefinition: vi.fn(async () => []),
      getReferences: vi.fn(async () => []),
    };
    workspace = {
      getDocumentPath: () => MAIN,
      getRoot: () => ROOT,
      getEditorView: () => view,
      getTabContent: (path) => (path === MAIN ? fixtures.files['main.typ'] : null),
      hasEngineErrors: () => false,
      openDocument: vi.fn(async (path) => {
        view.setState(EditorState.create({ doc: path === UNO ? fixtures.files['cap/uno.typ'] : 'paquete\n#let canvas = 1' }));
        return true;
      }),
    };
    notify = vi.fn();
    navigation = createNavigation({
      lspClient: lsp,
      workspace,
      readFile: async () => ({ ok: true, value: { content: fixtures.files['cap/uno.typ'] } }),
      notify,
      t: (key) => key,
    });
  });

  afterEach(() => view.destroy());

  const cursorAt = (line, character) => {
    const pos = view.state.doc.line(line + 1).from + character;
    view.dispatch({ selection: { anchor: pos } });
  };

  it('F12 sobre una etiqueta abre el capítulo y selecciona la etiqueta', async () => {
    cursorAt(2, 6);
    lsp.getDefinition.mockResolvedValue(normalizeLocations(fixtures.definitionLabel.result));
    expect(await navigation.goToDefinition(view)).toBe(true);
    expect(workspace.openDocument).toHaveBeenCalledWith(UNO, { readOnly: false });
    const { from, to } = view.state.selection.main;
    expect(view.state.sliceDoc(from, to)).toBe('<fig-gato>');
  });

  it('un destino fuera del proyecto (un paquete) se abre en solo lectura y se avisa', async () => {
    const pkg = 'C:/Users/x/AppData/Local/typst/packages/preview/cetz/0.4.2/src/canvas.typ';
    lsp.getDefinition.mockResolvedValue([{ path: pkg, range: { start: { line: 1, character: 5 }, end: { line: 1, character: 11 } } }]);
    await navigation.goToDefinition(view);
    expect(workspace.openDocument).toHaveBeenCalledWith(pkg, { readOnly: true });
    expect(notify).toHaveBeenCalledWith('nav.readOnlyPackage');
  });

  it('sin destino sobre una función interna lo explica; sobre una etiqueta con errores, pide compilar (R-L2)', async () => {
    cursorAt(3, 2);
    await navigation.goToDefinition(view);
    expect(notify).toHaveBeenLastCalledWith('nav.builtin', 'error');

    cursorAt(2, 6);
    workspace.hasEngineErrors = () => true;
    await navigation.goToDefinition(view);
    expect(notify).toHaveBeenLastCalledWith('nav.labelNeedsCompile', 'error');
  });

  it('con Tinymist apagado o arrancando dice el motivo y no pregunta', async () => {
    lsp.getStatus = () => 'starting';
    lsp.isActive = () => false;
    await navigation.goToDefinition(view);
    expect(notify).toHaveBeenCalledWith('nav.lspStarting', 'error');
    expect(lsp.getDefinition).not.toHaveBeenCalled();
  });

  it('Mayús+F12 enseña las referencias de los dos ficheros con su título', async () => {
    cursorAt(2, 6);
    lsp.getReferences.mockResolvedValue(normalizeLocations(fixtures.referencesLabel.result));
    const show = vi.fn();
    navigation.setReferencesView(show);
    await navigation.findReferences(view);
    const [{ title, groups }] = show.mock.calls[0];
    expect(title).toBe('nav.referencesOf');
    expect(groups.map((group) => group.path)).toEqual([UNO, MAIN]);
  });
});

describe('clics en el editor (RF-77.2)', () => {
  let host;
  let editor;

  beforeEach(() => {
    Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
    Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
    localStorage.clear();
    reloadPrefsForTests();
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    editor?.destroy();
    host.remove();
  });

  it('Alt+clic añade un cursor; Ctrl+clic ya no (va a la definición)', () => {
    editor = createEditor(host, { onGoToDefinition: vi.fn() });
    const adds = editor.getView().state.facet(EditorView.clickAddsSelectionRange);
    expect(adds.some((fn) => fn({ altKey: true, ctrlKey: false, metaKey: false }))).toBe(true);
    expect(adds.some((fn) => fn({ altKey: false, ctrlKey: true, metaKey: false }))).toBe(false);
  });

  it('Ctrl+clic pone el cursor en ese punto y pide la definición', () => {
    const onGoToDefinition = vi.fn();
    editor = createEditor(host, { onGoToDefinition });
    editor.setDocument('#saluda("Ana")', '/p/main.typ');
    const view = editor.getView();
    view.posAtCoords = () => 3;
    view.contentDOM.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, ctrlKey: true, clientX: 1, clientY: 1 }));
    expect(onGoToDefinition).toHaveBeenCalledWith(view);
    expect(view.state.selection.main.head).toBe(3);
  });
});
