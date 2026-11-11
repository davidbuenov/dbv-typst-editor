// =============================================================================
// DBV Typst Editor — Tests de atajos y menú contextual para snippets (RF-119)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { parseSnippetFile, createSnippetStore } from './model.js';
import { createSnippetLoader, isProjectKeybindingsFile } from './loader.js';
import {
  contextMenuSnippets,
  normalizeKeybinding,
  parseKeybindingsFile,
  resolveSnippetKeybindings,
} from './keybindings.js';

describe('keybindings y contextMenu de snippets (RF-119a)', () => {
  it('parseSnippetFile conserva las propiedades opcionales key y contextMenu', () => {
    const { snippets, errors } = parseSnippetFile(
      `{
        // comentario JSONC
        "Nota": {
          "prefix": "nota",
          "body": "#footnote[\${1:$TM_SELECTED_TEXT}]",
          "key": "Ctrl+Alt+N",
          "contextMenu": true,
        },
        "Plain": { "prefix": "pl", "body": "hola" },
      }`,
      'project',
    );
    expect(errors).toEqual([]);
    expect(snippets[0].key).toBe('Ctrl+Alt+N');
    expect(snippets[0].contextMenu).toBe(true);
    expect(snippets[1].key).toBeUndefined();
    expect(snippets[1].contextMenu).toBeUndefined();
  });

  it('normalizeKeybinding unifica notación VS Code y CodeMirror', () => {
    expect(normalizeKeybinding('ctrl+alt+N', false)).toMatchObject({ canonical: 'Ctrl-Alt-n' });
    expect(normalizeKeybinding('Mod-b', false)).toMatchObject({ canonical: 'Ctrl-b' });
    expect(normalizeKeybinding('Mod-b', true)).toMatchObject({ canonical: 'Cmd-b' });
    expect(normalizeKeybinding('Ctrl+Shift+ArrowUp', false)).toMatchObject({ canonical: 'Ctrl-Shift-ArrowUp' });
    expect(normalizeKeybinding('ctrl+k ctrl+s', false)).toBeNull();
  });

  it('parseKeybindingsFile soporta JSONC de VS Code y omite comandos ajenos', () => {
    const parsed = parseKeybindingsFile(
      `[
        // insertar snippet por nombre
        { "key": "ctrl+alt+f", "command": "editor.action.insertSnippet", "args": { "name": "Figura" } },
        { "key": "ctrl+alt+g", "command": "workbench.action.files.save" },
        { "key": "ctrl+alt+m", "snippet": "Marco", },
      ]`,
      'global',
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.entries[0]).toMatchObject({ key: 'ctrl+alt+f', snippetName: 'Figura' });
    expect(parsed.entries[1]).toMatchObject({ key: 'ctrl+alt+m', snippetName: 'Marco' });
  });

  it('APP_SHORTCUTS siempre gana ante colisiones y keybindings.json de proyecto gana a inline/global', () => {
    const snippets = [
      { name: 'NegritaMía', prefix: 'neg', body: '*$1*', origin: 'project', key: 'ctrl+b', contextMenu: true },
      { name: 'NotaGlobal', prefix: 'ng', body: '#footnote[$1]', origin: 'global', key: 'ctrl+alt+j' },
      { name: 'NotaProj', prefix: 'np', body: '#block[$1]', origin: 'project', key: 'ctrl+alt+j' },
      { name: 'Teorema', prefix: 'thm', body: '#thm[$1]', origin: 'project', contextMenu: true },
    ];
    const { bindings, conflicts } = resolveSnippetKeybindings({
      snippets,
      projectBindings: [{ key: 'ctrl+alt+m', snippetName: 'Teorema', origin: 'project' }],
      isMac: false,
    });

    expect(bindings.map((b) => [b.canonical, b.snippet.name])).toEqual([
      ['Ctrl-Alt-m', 'Teorema'],
      ['Ctrl-Alt-j', 'NotaProj'],
    ]);
    expect(conflicts.some((c) => c.type === 'app' && c.key === 'Ctrl-b')).toBe(true);
    expect(conflicts.some((c) => c.type === 'duplicate' && c.key === 'Ctrl-Alt-j' && c.winner === 'NotaProj')).toBe(true);
    expect(contextMenuSnippets(snippets).map((s) => s.name)).toEqual(['NegritaMía', 'Teorema']);
  });

  it('createSnippetLoader carga keybindings.json, avisa colisiones sin bloquear y recarga al cambiar', async () => {
    const files = {
      'C:/cfg/snippets/typst.json': '{"G": {"prefix": "g", "body": "g()", "key": "ctrl+b"}}',
      'C:/cfg/keybindings.json': '[{"key": "ctrl+alt+g", "command": "editor.action.insertSnippet", "args": {"name": "G"}}]',
      'D:/libro/.vscode/libro.code-snippets': '{"P": {"prefix": "p", "body": "p()", "contextMenu": true}}',
      'D:/libro/.vscode/keybindings.json': '[{"key": "ctrl+alt+p", "snippet": "P"}]',
    };
    const store = createSnippetStore();
    const notify = vi.fn();
    const loader = createSnippetLoader({
      store,
      notify,
      t: (k) => (k === 'snippets.keyConflictApp' ? 'CONFLICT:{key}:{action}' : k),
      backend: {
        readFile: async (path) => (path in files ? { ok: true, value: { content: files[path] } } : { ok: false, error: { message: 'missing' } }),
        snippetsGlobalPath: async () => ({ ok: true, value: 'C:/cfg/snippets/typst.json' }),
        snippetsProjectFiles: async () => ({ ok: true, value: ['D:/libro/.vscode/libro.code-snippets'] }),
        snippetsKeybindingsPaths: async (root) => ({
          ok: true,
          value: {
            global: 'C:/cfg/keybindings.json',
            project: root ? `${root}/.vscode/keybindings.json` : null,
          },
        }),
      },
    });

    await loader.loadGlobal();
    await loader.loadProject('D:/libro');

    expect(loader.getKeybindings().map((b) => [b.canonical, b.snippet.name])).toEqual([
      ['Ctrl-Alt-p', 'P'],
      ['Ctrl-Alt-g', 'G'],
    ]);
    expect(loader.getContextSnippets().map((s) => s.name)).toEqual(['P']);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('CONFLICT:Ctrl-b:'), 'warning');

    expect(isProjectKeybindingsFile('D:\\libro\\.vscode\\keybindings.json')).toBe(true);
    expect(await loader.handleChanged('D:/libro/.vscode/keybindings.json', '{ roto')).toBe(true);
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('snippets.jsonError'), 'error');
  });
});
