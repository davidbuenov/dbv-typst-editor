// =============================================================================
// DBV Typst Editor — Tests del panel «Buscar» (RF-78)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectSearch, isSearchProjectShortcut, replacementEdits, SEARCH_DEBOUNCE_MS, toGroups } from './projectSearch.js';
import { createResultsView } from './resultsView.js';
import { applyOffsetEdits, createMultiFileEdit } from '../app/multiFileEdit.js';

const ROOT = 'D:/libro';
const MAIN = `${ROOT}/main.typ`;
const CAP = `${ROOT}/cap.typ`;

/** Coincidencia como las devuelve `search.rs`. */
const match = (line, start, end, preview, replacement) => ({
  start: { line, character: start },
  end: { line, character: end },
  preview,
  previewStart: start,
  previewEnd: end,
  replacement,
});

describe('funciones puras', () => {
  it('toGroups y replacementEdits convierten el resultado del backend', () => {
    const result = { files: [{ path: MAIN, relative: 'main.typ', matches: [match(0, 4, 8, 'Ver gato y gato', 'lince'), match(0, 11, 15, 'Ver gato y gato', 'lince')] }] };
    expect(toGroups(result)[0].items[0]).toMatchObject({ line: 1, from: 4, to: 8, replacement: 'lince' });
    expect(replacementEdits(result)[0].edits).toHaveLength(2);
    expect(replacementEdits(result, { onlyPath: MAIN, onlyStart: { line: 0, character: 11 } })[0].edits).toEqual([
      { range: { start: { line: 0, character: 11 }, end: { line: 0, character: 15 } }, newText: 'lince' },
    ]);
    expect(replacementEdits(result, { onlyPath: CAP })).toEqual([]);
  });

  it('Ctrl+Mayús+F y Cmd+Mayús+F abren la búsqueda en el proyecto', () => {
    const key = (init) => ({ key: 'F', ctrlKey: false, metaKey: false, shiftKey: true, altKey: false, ...init });
    expect(isSearchProjectShortcut(key({ ctrlKey: true }))).toBe(true);
    expect(isSearchProjectShortcut(key({ metaKey: true }))).toBe(true);
    expect(isSearchProjectShortcut(key({ ctrlKey: true, shiftKey: false }))).toBe(false);
  });
});

describe('panel «Buscar» (RF-78)', () => {
  let elements;
  let searchProject;
  let tabs;
  let disk;
  let search;
  let notify;
  let multiFileEdit;
  let opened;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
    const make = (tag, type) => {
      const node = document.createElement(tag);
      if (type) node.type = type;
      document.body.append(node);
      return node;
    };
    elements = {
      query: make('input'),
      replace: make('input'),
      include: make('input'),
      exclude: make('input'),
      caseSensitive: make('button'),
      wholeWord: make('button'),
      regex: make('button'),
      replaceAll: make('button'),
      error: make('p'),
      status: make('p'),
    };
    const results = make('div');
    // Pestaña abierta con cambios sin guardar y un fichero cerrado.
    tabs = { [MAIN]: 'Ver gato sin guardar' };
    disk = { [MAIN]: 'Ver gato', [CAP]: 'Otro gato' };
    const workspace = {
      getRoot: () => ROOT,
      getOpenTexts: () => Object.entries(tabs).map(([path, content]) => ({ path, content })),
      getTabContent: (path) => tabs[path] ?? null,
      applyBufferEdits: vi.fn((edits, path) => {
        tabs[path] = applyOffsetEdits(tabs[path], edits);
      }),
    };
    // Buscador de juguete con el mismo contrato que `search.rs`: literal, por líneas.
    searchProject = vi.fn(async (root, query, options, { replacement, openDocuments }) => {
      if (options.regex && query.includes('(?<=')) return { ok: false, error: { message: 'look-around no soportado' } };
      const texts = { ...disk, ...Object.fromEntries(openDocuments.map((doc) => [doc.path, doc.content])) };
      const files = [];
      for (const [path, content] of Object.entries(texts)) {
        const matches = [];
        let index = content.indexOf(query);
        while (index >= 0) {
          matches.push(match(0, index, index + query.length, content, replacement ?? undefined));
          index = content.indexOf(query, index + 1);
        }
        if (matches.length) files.push({ path, relative: path.slice(ROOT.length + 1), matches });
      }
      return { ok: true, value: { files, total: files.reduce((n, f) => n + f.matches.length, 0), truncated: false, cancelled: false } };
    });
    notify = vi.fn();
    const backend = {
      readFile: async (path) => ({ ok: true, value: { content: disk[path], contentHash: `h:${disk[path]}` } }),
      fileFingerprint: async (path) => ({ ok: true, value: { missing: false, contentHash: `h:${disk[path]}` } }),
      writeFile: vi.fn(async (path, content) => {
        disk[path] = content;
        return { ok: true, value: { contentHash: `h:${content}` } };
      }),
    };
    multiFileEdit = createMultiFileEdit({ workspace, backend, dialog: { ask: vi.fn() }, notify });
    opened = vi.fn();
    search = createProjectSearch({
      elements,
      workspace,
      searchProject,
      multiFileEdit,
      resultsView: createResultsView({ containerEl: results, onOpen: (path, item) => opened(path, item) }),
      openAt: opened,
      getPref: () => false,
      t: (key) => key,
    });
    elements.results = results;
    elements.backend = backend;
  });

  afterEach(() => vi.useRealTimers());

  const type = (input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const settle = async () => {
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 1);
  };

  it('espera 250 ms tras escribir y busca también en el contenido sin guardar de las pestañas', async () => {
    type(elements.query, 'g');
    type(elements.query, 'gato');
    expect(searchProject).not.toHaveBeenCalled();
    await settle();
    expect(searchProject).toHaveBeenCalledTimes(1);
    expect(searchProject.mock.calls[0][3].openDocuments).toEqual([{ path: MAIN, content: 'Ver gato sin guardar' }]);
    expect(elements.status.textContent).toBe('search.summary');
    expect(elements.results.querySelectorAll('.search-group')).toHaveLength(2);
  });

  it('una respuesta que llega tarde (superada por otra búsqueda) se descarta', async () => {
    let finishFirst;
    searchProject.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)));
    type(elements.query, 'gato');
    await settle();
    type(elements.query, 'otro');
    await settle();
    finishFirst({ ok: true, value: { files: [{ path: MAIN, relative: 'main.typ', matches: [match(0, 0, 1, 'x')] }], total: 1, truncated: false, cancelled: false } });
    await vi.runAllTimersAsync();
    const names = [...elements.results.querySelectorAll('.search-group__name')].map((node) => node.textContent);
    expect(names).toEqual([]);
  });

  it('una expresión regular no válida se avisa en el campo, sin resultados (RF-78.6)', async () => {
    elements.regex.click();
    expect(elements.regex.getAttribute('aria-pressed')).toBe('true');
    type(elements.query, '(?<=a)b');
    await settle();
    expect(elements.error.textContent).toBe('look-around no soportado');
    expect(elements.query.getAttribute('aria-invalid')).toBe('true');
  });

  it('reemplazar todo edita la pestaña con cambios en el editor, el cerrado en disco, y Deshacer lo devuelve', async () => {
    type(elements.query, 'gato');
    type(elements.replace, 'lince');
    await settle();
    expect(elements.replaceAll.disabled).toBe(false);

    const replacing = search.replace();
    await vi.runAllTimersAsync();
    await replacing;

    expect(tabs[MAIN]).toBe('Ver lince sin guardar');
    expect(disk[MAIN]).toBe('Ver gato');
    expect(disk[CAP]).toBe('Otro lince');
    expect(elements.backend.writeFile).toHaveBeenCalledWith(CAP, 'Otro lince', 'replace');

    const [, , , actions] = notify.mock.calls.at(-1);
    await actions[1].run();
    expect(tabs[MAIN]).toBe('Ver gato sin guardar');
    expect(disk[CAP]).toBe('Otro gato');
  });

  it('un clic en un resultado lo abre en su pestaña', async () => {
    type(elements.query, 'gato');
    await settle();
    elements.results.querySelector('.search-hit').click();
    expect(opened).toHaveBeenCalledWith(MAIN, expect.objectContaining({ line: 1 }));
  });
});
