// =============================================================================
// DBV Typst Editor — Importar snippets de Sublime Text (RF-112)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// DBV NO «importa» los snippets de VS Code: lee su formato directamente (`model.js`). Los de Sublime
// son otro formato, un XML por snippet (`.sublime-snippet`), así que hace falta un conversor, no un
// lector nuevo. La sintaxis del cuerpo es casi la misma (`$1`, `${1:texto}`, `$0`, `\$`); lo que
// cambia es `$SELECTION` (en VS Code, `$TM_SELECTED_TEXT`).
//
//   Sublime                     DBV (formato de VS Code, `.code-snippets`)
//   `<tabTrigger>`              `prefix`
//   `<content>` (CDATA)         `body` (una línea por elemento)
//   `<description>`             `description` (si falta, el nombre del fichero)
//   `<scope>`                   `scope`: se importa si no hay ámbito o es de Typst; los demás se omiten y se listan
//   `$SELECTION`                `$TM_SELECTED_TEXT`
//
// Un snippet sin `tabTrigger`, o con una variable que DBV no admite, se OMITE con su motivo y no
// rompe el resto (RF-112.2). Puro y sin red; el XML se lee con `DOMParser`, que no resuelve entidades
// externas, y aun así se rechaza todo lo que declare entidades o un DOCTYPE (RF-112.5).

import { addSnippetToText } from './saveSelection.js';

/** Variables que `resolveVariables` (`model.js`) sabe sustituir. */
export const SUPPORTED_VARIABLES = ['TM_SELECTED_TEXT', 'TM_FILENAME', 'TM_FILENAME_BASE', 'CURRENT_YEAR', 'CURRENT_MONTH', 'CURRENT_DATE'];

/** Un fichero más grande que esto no es un snippet (el límite también lo aplica el backend al leerlo). */
export const MAX_SNIPPET_BYTES = 1_048_576;
/** Ficheros como mucho por importación. */
export const MAX_SNIPPET_FILES = 500;

/** El nombre del snippet a partir del fichero: `Mi snippet.sublime-snippet` → `Mi snippet`. */
export function nameFromFile(fileName) {
  return String(fileName ?? '').replace(/^.*[\\/]/, '').replace(/\.sublime-snippet$/i, '').trim() || 'snippet';
}

/** ¿El ámbito de Sublime aplica a Typst? Sin ámbito, sí (como en `model.js`). */
export function scopeApplies(scope) {
  const tokens = String(scope ?? '').split(/[\s,]+/).filter(Boolean);
  return tokens.length === 0 || tokens.some((token) => token.toLowerCase().includes('typst'));
}

/**
 * Convierte el cuerpo de un snippet de Sublime a la sintaxis de VS Code que lee DBV.
 * Respeta los escapes (`\$`, `\\`) y recorre también los marcadores anidados (`${1:$SELECTION}`).
 * @returns {{body: string, variables: string[]}} `variables`: las que usa y DBV no admite.
 */
export function convertBody(content) {
  // Sublime ignora un salto de línea inicial y otro final alrededor del CDATA.
  const text = String(content ?? '').replace(/^\r?\n/, '').replace(/\r?\n$/, '').replace(/\r\n/g, '\n');
  const unsupported = new Set();
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '\\' && i + 1 < text.length) {
      out += char + text[i + 1];
      i += 1;
    } else if (char === '$') {
      const braced = text[i + 1] === '{';
      const start = i + (braced ? 2 : 1);
      const name = text.slice(start).match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
      if (!name) {
        out += char;
        continue;
      }
      const mapped = name === 'SELECTION' ? 'TM_SELECTED_TEXT' : name;
      if (!SUPPORTED_VARIABLES.includes(mapped)) unsupported.add(name);
      out += `${braced ? '${' : '$'}${mapped}`;
      i = start + name.length - 1;
    } else out += char;
  }
  return { body: out, variables: [...unsupported] };
}

/** El texto de un elemento hijo directo de `<snippet>`, o `''`. */
function childText(root, tag) {
  const node = [...root.children].find((child) => child.tagName === tag);
  return node ? node.textContent : '';
}

/**
 * Lee un `.sublime-snippet` y lo convierte.
 * @param {{name: string, content: string}} source
 * @returns {{ok: true, entry: {name: string, prefix: string, body: string, description: string}, warnings: string[]}
 *          | {ok: false, reason: 'tooBig'|'unsafeXml'|'notXml'|'notSnippet'|'noTrigger'|'noContent'|'scope'|'variables', detail?: string}}
 */
export function convertSublimeSnippet({ name, content }) {
  const text = String(content ?? '');
  if (text.length > MAX_SNIPPET_BYTES) return { ok: false, reason: 'tooBig' };
  // Entidades externas (XXE) y «bombas» de expansión: ni se intenta leerlas.
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) return { ok: false, reason: 'unsafeXml' };
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) return { ok: false, reason: 'notXml' };
  const root = doc.documentElement;
  if (!root || root.tagName !== 'snippet') return { ok: false, reason: 'notSnippet' };

  const prefix = childText(root, 'tabTrigger').trim();
  if (!prefix) return { ok: false, reason: 'noTrigger' };
  const scope = childText(root, 'scope').trim();
  if (!scopeApplies(scope)) return { ok: false, reason: 'scope', detail: scope };
  const raw = childText(root, 'content');
  if (!raw.trim()) return { ok: false, reason: 'noContent' };
  const { body, variables } = convertBody(raw);
  if (variables.length) return { ok: false, reason: 'variables', detail: variables.map((v) => `$${v}`).join(', ') };

  const base = nameFromFile(name);
  const description = childText(root, 'description').trim();
  const warnings = /\$\{\d+\/[^}]*\/[^}]*\}/.test(body) ? ['transform'] : [];
  return { ok: true, entry: { name: base, prefix, body, description: description || base }, warnings };
}

/**
 * Convierte un lote de ficheros.
 * @param {Array<{name: string, content?: string|null, error?: string|null}>} sources
 * @returns {{entries: Array<object>, skipped: Array<{name: string, reason: string, detail?: string}>, warnings: Array<{name: string, warning: string}>}}
 */
export function convertBatch(sources) {
  const entries = [];
  const skipped = [];
  const warnings = [];
  const taken = new Set();
  for (const source of sources) {
    if (source.error || source.content == null) {
      skipped.push({ name: source.name, reason: source.error ?? 'unreadable' });
      continue;
    }
    const converted = convertSublimeSnippet({ name: source.name, content: source.content });
    if (!converted.ok) {
      skipped.push({ name: source.name, reason: converted.reason, ...(converted.detail ? { detail: converted.detail } : {}) });
      continue;
    }
    let { name } = converted.entry;
    for (let n = 2; taken.has(name); n += 1) name = `${converted.entry.name} ${n}`;
    taken.add(name);
    entries.push({ ...converted.entry, name });
    for (const warning of converted.warnings) warnings.push({ name, warning });
  }
  // Un prefijo repetido en el propio lote se avisa (no se omite): el usuario decide cuál queda.
  const seen = new Map();
  for (const entry of entries) {
    if (seen.has(entry.prefix)) warnings.push({ name: entry.name, warning: 'repeatedPrefix', detail: entry.prefix });
    else seen.set(entry.prefix, entry.name);
  }
  return { entries, skipped, warnings };
}

/** Cabecera del fichero generado: dice de dónde viene y que se puede editar. */
const HEADER = '  // Snippets importados de Sublime Text por DBV Typst Editor (formato de VS Code). Puedes editarlos.\n';

/** Un fichero `.code-snippets` nuevo con las entradas. `scope: "typst"` para que en VS Code solo apliquen a Typst. */
export function buildSnippetFile(entries) {
  const lines = entries.map((entry) => {
    const value = { prefix: entry.prefix, body: entry.body.split('\n'), description: entry.description, scope: 'typst' };
    const json = JSON.stringify(value, null, 2).replace(/\n/g, '\n  ');
    return `  ${JSON.stringify(entry.name)}: ${json}`;
  });
  return `{\n${HEADER}${lines.join(',\n')}\n}\n`;
}

/**
 * Añade las entradas a un fichero que ya existe, conservando sus comentarios y su formato.
 * @returns {{ok: true, text: string} | {ok: false, reason: 'invalid'}}
 */
export function mergeIntoFile(existingText, entries) {
  let text = existingText;
  for (const entry of entries) {
    const added = addSnippetToText(text, { name: entry.name, prefix: entry.prefix, description: entry.description, body: entry.body.split('\n'), scope: 'typst' });
    if (!added.ok) return { ok: false, reason: 'invalid' };
    text = added.text;
  }
  return { ok: true, text };
}

/** Prefijos de `entries` que ya existen en `existing` (los snippets que ya cargó DBV de ese fichero). */
export function repeatedWithExisting(entries, existing) {
  const known = new Set(existing.map((snippet) => snippet.prefix));
  return entries.filter((entry) => known.has(entry.prefix)).map((entry) => entry.prefix);
}
