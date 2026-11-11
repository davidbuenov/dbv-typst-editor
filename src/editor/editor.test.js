// =============================================================================
// DBV Typst Editor — Tests del editor: números de línea optativos (RF-63.2)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTypstLanguageSupport,
  createEditor,
  formatCursorStatus,
  shouldClosePanelsOnEscape,
  typstTokenHighlightStyle,
} from './editor.js';
import { reloadPrefsForTests, setPref } from '../app/prefs.js';

describe('números de línea optativos (RF-63.2)', () => {
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

  const hasLineNumbers = () => Boolean(editor.getView().dom.querySelector('.cm-lineNumbers'));

  it('se muestran por defecto (no cambia el comportamiento de la 0.9.0)', () => {
    editor = createEditor(host);
    editor.setDocument('= Título\nHola', '/p/main.typ');

    expect(hasLineNumbers()).toBe(true);
  });

  it('se respeta la preferencia ya guardada al crear el editor', () => {
    setPref('showLineNumbers', false);

    editor = createEditor(host);
    editor.setDocument('= Título', '/p/main.typ');

    expect(hasLineNumbers()).toBe(false);
  });

  it('se alternan en caliente desde el menú Preferencias, sin perder el cursor', () => {
    editor = createEditor(host);
    editor.setDocument('= Título\nHola mundo', '/p/main.typ');
    const view = editor.getView();
    view.dispatch({ selection: { anchor: 12 } }); // cursor dentro de "Hola mundo"

    setPref('showLineNumbers', false);
    expect(hasLineNumbers()).toBe(false);
    expect(view.state.selection.main.head).toBe(12);

    setPref('showLineNumbers', true);
    expect(hasLineNumbers()).toBe(true);
    expect(view.state.selection.main.head).toBe(12);
  });

  it('un editor destruido no reacciona a cambios de preferencia posteriores', () => {
    editor = createEditor(host);
    editor.setDocument('= Título', '/p/main.typ');
    editor.destroy();

    // No debe lanzar ni intentar despachar sobre una vista ya destruida.
    expect(() => setPref('showLineNumbers', false)).not.toThrow();
    editor = null; // ya destruido: que afterEach no vuelva a llamar destroy().
  });
});

describe('latencia al teclear y soporte Typst sin linter duplicado (RF-121)', () => {
  let host;
  let editor;

  beforeEach(() => {
    vi.useFakeTimers();
    Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
    Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
    localStorage.clear();
    reloadPrefsForTests();
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    vi.useRealTimers();
    editor?.destroy();
    host.remove();
  });

  it('debouncea lspClient.changeDocument y flush() envía de inmediato antes de consultar o formatear', () => {
    const lspClient = {
      isActive: () => true,
      openDocument: vi.fn(),
      changeDocument: vi.fn(),
      closeDocument: vi.fn(),
      formatDocument: vi.fn(),
      getCompletions: vi.fn(),
      getHover: vi.fn(),
      getSignatureHelp: vi.fn(),
    };
    const onModified = vi.fn();
    editor = createEditor(host, { lspClient, lspDebounceMs: 180, onModified });
    editor.setDocument('Hola', '/p/main.typ');

    const view = editor.getView();
    view.dispatch({ changes: { from: 4, insert: ' a' } });
    view.dispatch({ changes: { from: 6, insert: 'b' } });
    view.dispatch({ changes: { from: 7, insert: 'c' } });

    expect(onModified).toHaveBeenCalledTimes(3);
    expect(lspClient.changeDocument).not.toHaveBeenCalled();

    vi.advanceTimersByTime(179);
    expect(lspClient.changeDocument).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(lspClient.changeDocument).toHaveBeenCalledTimes(1);
    expect(lspClient.changeDocument).toHaveBeenCalledWith('Hola abc');

    view.dispatch({ changes: { from: 8, insert: '!' } });
    expect(lspClient.changeDocument).toHaveBeenCalledTimes(1);
    editor.formatDocument();
    expect(lspClient.changeDocument).toHaveBeenCalledTimes(2);
    expect(lspClient.changeDocument).toHaveBeenLastCalledWith('Hola abc!');
    expect(lspClient.formatDocument).toHaveBeenCalledTimes(1);
  });

  it('buildTypstLanguageSupport mantiene el nombre typst sin arrastrar linter Lezer redundante', () => {
    const support = buildTypstLanguageSupport();
    expect(support.language.name).toBe('typst');
    const ruleColors = typstTokenHighlightStyle.specs.map((spec) => spec.color).filter(Boolean);
    expect(ruleColors.every((color) => color.startsWith('var(--'))).toBe(true);
  });

  it('adapta el tema interno oscuro/claro según isDarkTheme para los 10 temas (RF-122)', () => {
    editor = createEditor(host, { theme: 'nord' });
    editor.setDocument('= Título', '/p/main.typ');
    expect(editor.getView().state.facet(editor.getView().constructor.darkTheme)).toBe(true);

    editor.setTheme('catppuccin-latte');
    expect(editor.getView().state.facet(editor.getView().constructor.darkTheme)).toBe(false);
  });

  it('números relativos se recalculan al mover el cursor entre líneas (RF-120)', () => {
    setPref('showLineNumbers', true);
    setPref('relativeLineNumbers', true);
    editor = createEditor(host);
    editor.setDocument('uno\ndos\ntres\ncuatro', '/p/main.typ');
    const view = editor.getView();

    const visibleGutterNumbers = () =>
      [...view.dom.querySelectorAll('.cm-lineNumbers .cm-gutterElement')]
        .filter((el) => el.style.visibility !== 'hidden')
        .map((el) => el.textContent.trim())
        .filter((t) => /^\d+$/.test(t));

    expect(visibleGutterNumbers()).toEqual(['1', '1', '2', '3']);

    // Mover el cursor a la línea 3 ("tres")
    const line3 = view.state.doc.line(3);
    view.dispatch({ selection: { anchor: line3.from + 1 } });
    expect(visibleGutterNumbers()).toEqual(['2', '1', '3', '1']);
  });

  it('formatCursorStatus formatea línea, columna y caracteres seleccionados (RF-120)', () => {
    editor = createEditor(host);
    editor.setDocument('hola\nmundo', '/p/main.typ');
    const view = editor.getView();
    const tr = (k) => (k === 'statusbar.cursor' ? 'Ln {line}, Col {col}' : '({chars} sel)');

    expect(formatCursorStatus(view.state, tr)).toBe('Ln 1, Col 1');

    view.dispatch({ selection: { anchor: 5, head: 10 } });
    expect(formatCursorStatus(view.state, tr)).toBe('Ln 2, Col 6 (5 sel)');
  });

  it('modo Vim opcional carga @replit/codemirror-vim bajo demanda y coordina Escape (RF-120b)', async () => {
    const modes = [];
    editor = createEditor(host, { onVimModeChange: (m) => modes.push(m) });
    editor.setDocument('Hola mundo', '/p/main.typ');
    const view = editor.getView();

    expect(editor.isVimActive()).toBe(false);
    expect(shouldClosePanelsOnEscape({ target: view.contentDOM, defaultPrevented: false }, view)).toBe(true);

    setPref('vimMode', true);
    await vi.waitFor(() => expect(editor.isVimActive()).toBe(true));
    expect(modes).toContain('NORMAL');

    const { Vim, getCM } = await import('@replit/codemirror-vim');
    const cm = getCM(view);
    Vim.handleKey(cm, 'i', 'user');
    expect(modes.at(-1)).toBe('INSERT');
    expect(shouldClosePanelsOnEscape({ target: view.contentDOM, defaultPrevented: false }, view)).toBe(false);

    Vim.handleKey(cm, '<Esc>', 'user');
    expect(modes.at(-1)).toBe('NORMAL');
    expect(shouldClosePanelsOnEscape({ target: view.contentDOM, defaultPrevented: false }, view)).toBe(true);
    expect(shouldClosePanelsOnEscape({ target: document.body, defaultPrevented: false }, view)).toBe(true);

    setPref('vimMode', false);
    expect(editor.isVimActive()).toBe(false);
    expect(modes.at(-1)).toBeNull();
  });

  it('setSnippetKeybindings dispara la expansión de snippets con $TM_SELECTED_TEXT (RF-119b)', () => {
    editor = createEditor(host);
    editor.setDocument('texto clave', '/p/main.typ');
    const view = editor.getView();
    view.dispatch({ selection: { anchor: 6, head: 11 } });

    editor.setSnippetKeybindings([
      {
        key: 'Ctrl-Alt-h',
        canonical: 'Ctrl-Alt-h',
        snippet: { name: 'Resaltar', prefix: 'res', body: '#highlight[$TM_SELECTED_TEXT]$0', origin: 'project' },
      },
    ]);

    view.contentDOM.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, altKey: true, bubbles: true, cancelable: true }),
    );
    expect(view.state.doc.toString()).toBe('texto #highlight[clave]');
  });
});
