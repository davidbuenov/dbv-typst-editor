// =============================================================================
// DBV Typst Editor — Atajos de teclado y menú contextual para snippets (RF-119)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { parse, printParseErrorCode } from 'jsonc-parser';
import { APP_SHORTCUTS } from '../editor/shortcuts.js';

const SPECIAL_KEYS = {
  up: 'ArrowUp',
  arrowup: 'ArrowUp',
  down: 'ArrowDown',
  arrowdown: 'ArrowDown',
  left: 'ArrowLeft',
  arrowleft: 'ArrowLeft',
  right: 'ArrowRight',
  arrowright: 'ArrowRight',
  esc: 'Escape',
  escape: 'Escape',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  space: 'Space',
  spacebar: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pgup: 'PageUp',
  pagedown: 'PageDown',
  pgdn: 'PageDown',
  insert: 'Insert',
};

const MODIFIER_ORDER = ['Ctrl', 'Cmd', 'Alt', 'Shift'];

function detectMacPlatform() {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform ?? '');
}

function lineOf(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

/**
 * Normaliza una combinación en notación VS Code o CodeMirror (`ctrl+alt+s`,
 * `Mod-Shift-1`, etc.) a forma canónica (`Ctrl-Alt-s`, `Cmd-Shift-1`).
 * Devuelve `null` si está vacía o no contiene una tecla base válida.
 */
export function normalizeKeybinding(raw, isMac = detectMacPlatform()) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Soporta la primera combinación si hubiera secuencia tipo "ctrl+k ctrl+s" -> ignoramos secuencias multi-tecla por seguridad.
  if (/\s/.test(trimmed)) return null;

  const mods = new Set();
  let rest = trimmed;
  const modPattern = /^(ctrl|control|cmd|command|meta|super|win|mod|alt|option|opt|shift)[+-](.+)$/i;
  while (true) {
    const match = rest.match(modPattern);
    if (!match) break;
    const mod = match[1].toLowerCase();
    rest = match[2];
    if (mod === 'mod') mods.add(isMac ? 'Cmd' : 'Ctrl');
    else if (mod === 'ctrl' || mod === 'control') mods.add('Ctrl');
    else if (mod === 'cmd' || mod === 'command' || mod === 'meta' || mod === 'super' || mod === 'win') mods.add('Cmd');
    else if (mod === 'alt' || mod === 'option' || mod === 'opt') mods.add('Alt');
    else if (mod === 'shift') mods.add('Shift');
  }

  const keyRaw = rest.trim();
  if (!keyRaw) return null;
  const lower = keyRaw.toLowerCase();
  let keyName = SPECIAL_KEYS[lower];
  if (!keyName) {
    if (/^f([1-9]|1[0-2])$/.test(lower)) keyName = lower.toUpperCase();
    else if (/^[a-z]$/.test(lower)) keyName = lower;
    else if (keyRaw.length === 1) keyName = keyRaw;
    else return null;
  }

  const orderedMods = MODIFIER_ORDER.filter((m) => mods.has(m));
  const canonical = [...orderedMods, keyName].join('-');
  return {
    canonical,
    cmKey: canonical,
    raw: trimmed,
  };
}

/**
 * Lee un `keybindings.json` (JSONC al estilo VS Code). Nunca lanza.
 * @param {string} text
 * @param {'project' | 'global'} origin
 */
export function parseKeybindingsFile(text, origin) {
  const parseErrors = [];
  const data = parse(text, parseErrors, { allowTrailingComma: true, disallowComments: false });
  const errors = parseErrors.map((error) => ({ line: lineOf(text, error.offset), message: printParseErrorCode(error.error) }));
  const entries = [];
  const warnings = [];

  if (errors.length === 0) {
    if (!Array.isArray(data)) {
      if (data !== undefined && data !== null) warnings.push('rootNotArray');
      return { entries, errors, warnings };
    }
    for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      const key = typeof item.key === 'string' ? item.key.trim() : '';
      if (!key) continue;

      let snippetName = typeof item.snippet === 'string' ? item.snippet.trim() : '';
      let inlineBody = null;
      const command = typeof item.command === 'string' ? item.command.trim() : '';

      if (!snippetName) {
        if (command === 'editor.action.insertSnippet') {
          if (typeof item.args?.name === 'string' && item.args.name.trim()) {
            snippetName = item.args.name.trim();
          } else if (typeof item.args?.snippet === 'string') {
            inlineBody = item.args.snippet;
          }
        } else if (command.startsWith('snippet:')) {
          snippetName = command.slice('snippet:'.length).trim();
        } else {
          // Otros comandos ajenos (VS Code) se omiten sin ruido.
          continue;
        }
      }

      if (!snippetName && inlineBody === null) {
        warnings.push(key);
        continue;
      }
      entries.push({ key, snippetName, inlineBody, origin });
    }
  }
  return { entries, errors, warnings };
}

function buildReservedAppKeys(appShortcuts, isMac) {
  const reserved = new Map();
  for (const sc of appShortcuts) {
    const raw = isMac && sc.mac ? sc.mac : sc.key;
    if (!raw) continue;
    const norm = normalizeKeybinding(raw, isMac);
    if (!norm) continue;
    reserved.set(norm.canonical, sc.label);
  }
  return reserved;
}

function findTargetSnippet(snippets, nameOrPrefix) {
  const needle = nameOrPrefix.trim();
  const needleLower = needle.toLowerCase();
  return (
    snippets.find((s) => s.name === needle || s.prefix === needle)
    ?? snippets.find((s) => s.name.toLowerCase() === needleLower || s.prefix.toLowerCase() === needleLower)
    ?? null
  );
}

/**
 * Resuelve atajos activos de snippets respetando:
 * `APP_SHORTCUTS` siempre gana > `.vscode/keybindings.json` > `"key"` de proyecto >
 * `keybindings.json` global > `"key"` global.
 */
export function resolveSnippetKeybindings({
  snippets = [],
  globalBindings = [],
  projectBindings = [],
  appShortcuts = APP_SHORTCUTS,
  isMac = detectMacPlatform(),
} = {}) {
  const reserved = buildReservedAppKeys(appShortcuts, isMac);
  const candidates = [];

  for (const b of projectBindings) candidates.push({ ...b, source: 'project-keybindings' });
  for (const s of snippets) {
    if (s.origin === 'project' && s.key) {
      candidates.push({ key: s.key, snippet: s, snippetName: s.name, origin: 'project', source: 'project-snippet' });
    }
  }
  for (const b of globalBindings) candidates.push({ ...b, source: 'global-keybindings' });
  for (const s of snippets) {
    if (s.origin === 'global' && s.key) {
      candidates.push({ key: s.key, snippet: s, snippetName: s.name, origin: 'global', source: 'global-snippet' });
    }
  }

  const seenByKey = new Map();
  const bindings = [];
  const conflicts = [];

  for (const candidate of candidates) {
    const norm = normalizeKeybinding(candidate.key, isMac);
    if (!norm) continue;

    const target = candidate.snippet
      ?? (candidate.snippetName ? findTargetSnippet(snippets, candidate.snippetName) : null)
      ?? (typeof candidate.inlineBody === 'string'
        ? {
            name: candidate.snippetName || candidate.key,
            prefix: '',
            body: candidate.inlineBody,
            description: candidate.inlineBody,
            origin: candidate.origin,
          }
        : null);

    if (!target) continue;

    const appLabel = reserved.get(norm.canonical);
    if (appLabel) {
      conflicts.push({
        type: 'app',
        key: norm.canonical,
        rawKey: candidate.key,
        appLabel,
        snippetName: target.name || target.prefix,
      });
      continue;
    }

    const existing = seenByKey.get(norm.canonical);
    if (existing) {
      conflicts.push({
        type: 'duplicate',
        key: norm.canonical,
        rawKey: candidate.key,
        winner: existing.snippet.name || existing.snippet.prefix,
        dropped: target.name || target.prefix,
      });
      continue;
    }

    const resolved = {
      key: norm.cmKey,
      canonical: norm.canonical,
      rawKey: candidate.key,
      snippet: target,
      source: candidate.source,
    };
    seenByKey.set(norm.canonical, resolved);
    bindings.push(resolved);
  }

  return { bindings, conflicts };
}

/** Snippets marcados con `"contextMenu": true`, primero los de proyecto. */
export function contextMenuSnippets(snippets = []) {
  const seen = new Set();
  const list = [];
  for (const item of snippets) {
    if (!item?.contextMenu) continue;
    const dedupeKey = `${item.name}\u0000${item.body}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    list.push(item);
  }
  return list;
}

