// =============================================================================
// DBV Typst Editor — Snippets de usuario: modelo (RF-81)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Formato de VS Code: `{ "nombre": { prefix, body, description, scope } }`, en
// JSONC (comentarios y comas finales), para poder reutilizar snippets copiados
// de VS Code o de internet. Se leen con `jsonc-parser` (el de VS Code, MIT): un
// `JSON.parse` fallaría con los comentarios (R-N1).
//
// Dos niveles (RF-81.2): globales (configuración de la app) y del proyecto
// (`.vscode/*.code-snippets`, como VS Code). Si un fichero se rompe, se siguen
// usando sus snippets válidos anteriores (RF-81.6): el autocompletado nunca se
// queda sin nada por un error de sintaxis.

import { parse, printParseErrorCode } from 'jsonc-parser';

/**
 * @typedef {object} Snippet
 * @property {string} prefix
 * @property {string} body Cuerpo en sintaxis de snippets de VS Code/LSP.
 * @property {string} description
 * @property {string} name
 * @property {'project' | 'global'} origin
 */

/** Línea (desde 1) de un desplazamiento en `text`. */
function lineOf(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

/** ¿El snippet aplica a Typst? Sin `scope`, sí (RF-81.2). */
function appliesToTypst(scope) {
  if (scope === undefined || scope === null || scope === '') return true;
  return String(scope)
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .includes('typst');
}

/**
 * Lee un fichero de snippets. Nunca lanza: devuelve los snippets válidos, los
 * errores de sintaxis (con su línea) y los avisos de entradas ignoradas.
 * @param {string} text
 * @param {'project' | 'global'} origin
 * @returns {{snippets: Snippet[], errors: Array<{line: number, message: string}>, warnings: string[]}}
 */
export function parseSnippetFile(text, origin) {
  const parseErrors = [];
  const data = parse(text, parseErrors, { allowTrailingComma: true, disallowComments: false });
  const errors = parseErrors.map((error) => ({ line: lineOf(text, error.offset), message: printParseErrorCode(error.error) }));
  const snippets = [];
  const warnings = [];
  if (errors.length === 0 && data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [name, entry] of Object.entries(data)) {
      if (!entry || typeof entry !== 'object') continue;
      const prefixes = Array.isArray(entry.prefix) ? entry.prefix : [entry.prefix];
      const body = Array.isArray(entry.body) ? entry.body.join('\n') : entry.body;
      if (!prefixes.some((prefix) => typeof prefix === 'string' && prefix) || typeof body !== 'string') {
        warnings.push(name);
        continue;
      }
      if (!appliesToTypst(entry.scope)) continue;
      for (const prefix of prefixes) {
        if (typeof prefix !== 'string' || !prefix) continue;
        snippets.push({ prefix, body, description: typeof entry.description === 'string' ? entry.description : name, name, origin });
      }
    }
  }
  return { snippets, errors, warnings };
}

/** Escapa un valor para meterlo literal en un cuerpo de snippet. */
export function escapeSnippetText(text) {
  return text.replace(/[\\$}]/g, (char) => `\\${char}`);
}

/**
 * Sustituye las variables admitidas (RF-81.3). Las demás se quedan como
 * están: `lspSnippetToCodeMirror` las cambia por su valor por defecto o vacío.
 * @param {string} body
 * @param {{selectedText?: string, fileName?: string, date?: Date}} context
 */
export function resolveVariables(body, { selectedText = '', fileName = '', date = new Date() } = {}) {
  const pad = (value) => String(value).padStart(2, '0');
  const values = {
    TM_SELECTED_TEXT: selectedText,
    TM_FILENAME: fileName,
    TM_FILENAME_BASE: fileName.replace(/\.[^.]*$/, ''),
    CURRENT_YEAR: String(date.getFullYear()),
    CURRENT_MONTH: pad(date.getMonth() + 1),
    CURRENT_DATE: pad(date.getDate()),
  };
  const known = Object.keys(values).join('|');
  const pattern = new RegExp(`\\$(?:\\{(${known})(?::[^}]*)?\\}|(${known})(?![A-Za-z0-9_]))`, 'g');
  return body.replace(pattern, (_, braced, bare) => escapeSnippetText(values[braced ?? bare]));
}

/**
 * Conjunto de snippets vigente, por fichero de origen. Si un fichero se rompe
 * al recargarlo, se conservan sus snippets anteriores (RF-81.6).
 */
export function createSnippetStore() {
  /** @type {Map<string, {origin: 'project'|'global', snippets: Snippet[]}>} */
  const files = new Map();

  return {
    /**
     * Carga (o recarga) un fichero. Devuelve los errores y avisos para
     * enseñárselos al usuario; con errores, el conjunto de ese fichero no cambia.
     * @param {string} path
     * @param {string} text
     * @param {'project' | 'global'} origin
     */
    load(path, text, origin) {
      const result = parseSnippetFile(text, origin);
      if (result.errors.length === 0) files.set(path, { origin, snippets: result.snippets });
      return result;
    },
    /** El fichero ya no existe (o se cerró el proyecto). */
    remove(path) {
      files.delete(path);
    },
    /** Quita todos los de un origen (al cambiar de proyecto). */
    clear(origin) {
      for (const [path, file] of files) if (file.origin === origin) files.delete(path);
    },
    /** Todos los snippets: primero los del proyecto, luego los globales (RF-81.2). */
    all() {
      const list = [...files.values()];
      return [...list.filter((file) => file.origin === 'project'), ...list.filter((file) => file.origin === 'global')].flatMap((file) => file.snippets);
    },
  };
}

/** El conjunto que usa el autocompletado del editor. */
export const snippetStore = createSnippetStore();
