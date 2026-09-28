// =============================================================================
// DBV Typst Editor — Tests del registro único de atajos (RF-80)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, historyKeymap, indentWithTab, toggleBlockComment, toggleComment } from '@codemirror/commands';
import { foldKeymap } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { runScopeHandlers } from '@codemirror/view';
import { typst_lezer } from 'codemirror-lang-typst/lezer';
import {
  APP_SHORTCUTS,
  BASIC_NAVIGATION,
  BUILTIN_SHORTCUTS,
  comboFor,
  formatCombo,
  normalizeCombo,
  SHORTCUT_SCOPES,
  shortcutHelpGroups,
  shortcutKey,
} from './shortcuts.js';
import { createEditor } from './editor.js';
import { reloadPrefsForTests } from '../app/prefs.js';

const CODEMIRROR_KEYMAPS = {
  defaultKeymap,
  historyKeymap,
  searchKeymap,
  foldKeymap,
  completionKeymap,
  closeBracketsKeymap,
  indentWithTab: [indentWithTab],
};
const PLATFORMS = [
  { name: 'Windows/Linux', isMac: false, field: 'win' },
  { name: 'macOS', isMac: true, field: 'mac' },
];

/** Combinaciones normalizadas de un binding de CodeMirror en una plataforma (con su variante `shift`). */
function bindingCombos(binding, { isMac, field }) {
  const raw = binding[field] ?? (isMac ? binding.mac : undefined) ?? binding.key;
  const combos = [];
  if (raw) {
    combos.push(normalizeCombo(raw, isMac));
    if (binding.shift) combos.push(normalizeCombo(`Shift-${raw}`, isMac));
  }
  return combos;
}

/** Combinaciones documentadas en una plataforma: registro propio y atajos de CodeMirror descritos. */
function documentedCombos(isMac) {
  const combos = new Set();
  for (const shortcut of [...APP_SHORTCUTS, ...BUILTIN_SHORTCUTS]) {
    const combo = comboFor(shortcut, isMac);
    if (!combo) continue;
    combos.add(normalizeCombo(combo, isMac));
    if (shortcut.shift) combos.add(normalizeCombo(`Shift-${combo}`, isMac));
  }
  return combos;
}

describe('registro único de atajos (RF-80)', () => {
  for (const platform of PLATFORMS) {
    it(`todo atajo de CodeMirror está descrito o es navegación básica (${platform.name})`, () => {
      const documented = documentedCombos(platform.isMac);
      const missing = [];
      for (const [name, map] of Object.entries(CODEMIRROR_KEYMAPS)) {
        for (const binding of map) {
          for (const combo of bindingCombos(binding, platform)) {
            if (!documented.has(combo) && !BASIC_NAVIGATION.has(combo)) missing.push(`${name}: ${combo}`);
          }
        }
      }
      expect(missing).toEqual([]);
    });

    it(`no hay dos atajos propios con la misma combinación en el mismo ámbito (${platform.name})`, () => {
      const seen = new Map();
      const duplicated = [];
      for (const shortcut of APP_SHORTCUTS.filter((item) => item.key)) {
        const id = `${shortcut.scope}:${normalizeCombo(comboFor(shortcut, platform.isMac), platform.isMac)}`;
        if (seen.has(id)) duplicated.push(`${seen.get(id)} / ${shortcut.id} → ${id}`);
        seen.set(id, shortcut.id);
      }
      expect(duplicated).toEqual([]);
    });

    it(`un atajo propio del editor solo tapa uno de CodeMirror si lo declara (${platform.name})`, () => {
      const builtin = new Set();
      for (const map of Object.values(CODEMIRROR_KEYMAPS)) {
        for (const binding of map) for (const combo of bindingCombos(binding, platform)) builtin.add(combo);
      }
      const clashes = APP_SHORTCUTS.filter((item) => item.scope === 'editor' && item.key && !item.overridesBuiltin)
        .map((item) => ({ id: item.id, combo: normalizeCombo(comboFor(item, platform.isMac), platform.isMac) }))
        .filter(({ combo }) => builtin.has(combo));
      expect(clashes).toEqual([]);
    });
  }

  it('cada atajo tiene ámbito conocido, combinación o texto, y descripción en los dos idiomas', () => {
    const scopes = new Set(SHORTCUT_SCOPES.map((scope) => scope.id));
    for (const shortcut of [...APP_SHORTCUTS, ...BUILTIN_SHORTCUTS]) {
      const name = shortcut.id ?? shortcut.key;
      if (shortcut.id) expect(scopes.has(shortcut.scope), `${name}: ámbito`).toBe(true);
      expect(Boolean(shortcut.key || shortcut.mac || shortcut.display), `${name}: sin combinación`).toBe(true);
      expect(shortcut.label.es?.trim(), `${name}: sin español`).toBeTruthy();
      expect(shortcut.label.en?.trim(), `${name}: sin inglés`).toBeTruthy();
      if (shortcut.display) expect(shortcut.display.es && shortcut.display.en, `${name}: display`).toBeTruthy();
      if (shortcut.shift) expect(shortcut.shift.es && shortcut.shift.en, `${name}: shift`).toBeTruthy();
    }
  });

  it('todo atajo registrado aparece en la ayuda, en los dos idiomas y en las dos plataformas', () => {
    for (const lang of ['es', 'en']) {
      for (const { isMac } of PLATFORMS) {
        const texts = shortcutHelpGroups(lang, isMac).flatMap((group) => group.rows.map(([, text]) => text));
        for (const shortcut of APP_SHORTCUTS) expect(texts, `${shortcut.id} (${lang})`).toContain(shortcut.label[lang]);
        for (const shortcut of BUILTIN_SHORTCUTS) expect(texts).toContain(shortcut.label[lang]);
      }
    }
  });

  it('«ampliar selección» usa una combinación libre en todos los keymaps (RF-80.3)', () => {
    for (const platform of PLATFORMS) {
      const combo = normalizeCombo(comboFor(shortcutKey('expandSelection'), platform.isMac), platform.isMac);
      for (const map of Object.values(CODEMIRROR_KEYMAPS)) {
        for (const binding of map) expect(bindingCombos(binding, platform), platform.name).not.toContain(combo);
      }
    }
  });

  it('formatea las combinaciones para cada idioma y plataforma', () => {
    expect(formatCombo('Shift-Mod-k', 'es', false)).toBe('Ctrl + Mayús + K');
    expect(formatCombo('Shift-Mod-k', 'en', false)).toBe('Ctrl + Shift + K');
    expect(formatCombo('Shift-Mod-k', 'es', true)).toBe('⇧⌘K');
    expect(formatCombo('Alt-ArrowUp', 'es', false)).toBe('Alt + ↑');
    expect(formatCombo('Delete', 'es', false)).toBe('Supr');
    expect(formatCombo('Mod-Alt-\\', 'en', false)).toBe('Ctrl + Alt + \\');
    expect(formatCombo('Mod--', 'en', false)).toBe('Ctrl + -');
  });
});

describe('atajos en un editor real', () => {
  let host;
  let editor;

  beforeEach(() => {
    Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
    Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
    localStorage.clear();
    reloadPrefsForTests();
    host = document.createElement('div');
    document.body.append(host);
    editor = createEditor(host);
  });

  afterEach(() => {
    editor?.destroy();
    host.remove();
  });

  const press = (init) =>
    runScopeHandlers(editor.getView(), new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }), 'editor');

  it('Ctrl+I sigue siendo cursiva', () => {
    editor.setDocument('hola', '/p/main.typ');
    editor.getView().dispatch({ selection: { anchor: 0, head: 4 } });
    expect(press({ key: 'i', ctrlKey: true })).toBe(true);
    expect(editor.getContent()).toBe('_hola_');
  });

  it('Ctrl+Mayús+↑ amplía la selección al elemento que la contiene', () => {
    editor.setDocument('#box(width: 1cm)[hola]', '/p/main.typ');
    const view = editor.getView();
    view.dispatch({ selection: { anchor: 18 } });
    expect(press({ key: 'ArrowUp', ctrlKey: true, shiftKey: true })).toBe(true);
    const { from, to } = view.state.selection.main;
    expect(to - from).toBeGreaterThan(0);
  });
});

describe('comentarios en Typst (RF-80.4)', () => {
  const typstState = (doc) => EditorState.create({ doc, extensions: [typst_lezer()] });
  const run = (command, doc, selection) => {
    let state = typstState(doc).update({ selection }).state;
    command({ state, dispatch: (tr) => (state = tr.state) });
    return state.doc.toString();
  };

  it('Ctrl+/ comenta la línea con //', () => {
    expect(run(toggleComment, '= Título\nHola', { anchor: 10 })).toBe('= Título\n// Hola');
  });

  it('Mayús+Alt+A envuelve la selección con /* */', () => {
    expect(run(toggleBlockComment, 'Hola mundo', { anchor: 0, head: 4 })).toBe('/* Hola */ mundo');
  });
});
