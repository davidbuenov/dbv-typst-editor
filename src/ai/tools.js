// =============================================================================
// DBV Typst Editor — Herramientas del asistente (RF-94.1)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Lo que un modelo directo puede hacer: listar, leer y buscar en el proyecto,
// ver diagnósticos y esquema, consultar la documentación de Typst y PROPONER
// cambios. Todas trabajan con rutas relativas al proyecto y las validan
// (RNF-IA.3); ninguna escribe en disco, accede a la red ni ejecuta programas
// (RNF-IA.7). Leer usa el contenido del editor si el fichero está abierto.
//
// `propose_changes` acumula en la propuesta de la respuesta y la COMPILA en
// memoria: si introduce errores nuevos, se lo dice al modelo para que los
// corrija, como mucho `MAX_FIX_ATTEMPTS` veces (RF-94.3).

import { isSafeRelativePath } from '../app/entrypoint.js';
import { applyChange, normalizePath } from './proposal.js';

/** Reintentos de corrección tras una propuesta que no compila (ADR-V0130-002). */
export const MAX_FIX_ATTEMPTS = 2;
/** Tope de lo que devuelve una lectura (caracteres). */
const READ_LIMIT = 24000;
const LIST_LIMIT = 400;

const object = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

/**
 * Errores nuevos de una comprobación respecto a la línea base (mismo fichero,
 * línea y mensaje no cuentan dos veces).
 */
export function newErrors(baseline, checked) {
  const key = (d) => `${d.file}|${d.message}`;
  const known = new Map();
  for (const d of baseline.filter((x) => x.level === 'error')) known.set(key(d), (known.get(key(d)) ?? 0) + 1);
  const fresh = [];
  for (const d of checked.filter((x) => x.level === 'error')) {
    const count = known.get(key(d)) ?? 0;
    if (count > 0) known.set(key(d), count - 1);
    else fresh.push(d);
  }
  return fresh;
}

/** Resumen de una comprobación para el modelo y para la revisión. */
export function describeCheck(baseline, checked) {
  const fresh = newErrors(baseline, checked);
  const fixed = baseline.filter((d) => d.level === 'error').length - (checked.filter((d) => d.level === 'error').length - fresh.length);
  return { fresh, fixed: Math.max(0, fixed), errors: checked.filter((d) => d.level === 'error').length };
}

/**
 * @param {object} deps
 * @param {() => string} deps.getRoot
 * @param {(root: string, relative: string) => string} deps.join
 * @param {(relative: string) => Promise<string|null>} deps.readText Contenido (editor o disco), o `null` si no existe.
 * @param {() => Promise<string[]>} deps.listFiles Rutas relativas.
 * @param {(query: string, regex: boolean) => Promise<Array<{relative: string, line: number, text: string}>>} deps.search
 * @param {() => Promise<Array>} deps.diagnostics Problemas actuales.
 * @param {() => Array<{level: number, text: string}>} deps.outline
 * @param {(query: string) => Promise<Array>} deps.docsSearch
 * @param {(path: string) => Promise<string|null>} deps.docsPage
 * @param {(proposal: object) => Promise<Array|null>} deps.checkProposal Diagnósticos con la propuesta; `null` si no se puede comprobar.
 * @param {() => object} deps.getProposal Propuesta de la respuesta en curso.
 * @param {(path: string) => boolean} [deps.allowPath] Si existe, solo se pueden proponer cambios en las rutas que admite (documento suelto, RF-106.7).
 */
export function createTools(deps) {
  let fixAttempts = 0;
  const safe = (path) => {
    const relative = normalizePath(path);
    if (!isSafeRelativePath(relative)) throw new Error(`path outside the project: ${path}`);
    return relative;
  };

  return [
    {
      name: 'list_files',
      description: 'List the files of the open Typst project (relative paths).',
      parameters: object({}),
      label: () => 'Listando ficheros del proyecto',
      run: async () => {
        const files = await deps.listFiles();
        const shown = files.slice(0, LIST_LIMIT);
        return `${shown.join('\n')}${files.length > shown.length ? `\n… (${files.length - shown.length} more)` : ''}`;
      },
    },
    {
      name: 'read_file',
      description: 'Read a text file of the project (with unsaved editor changes). Optional 1-based line range.',
      parameters: object({ path: { type: 'string' }, start_line: { type: 'integer' }, end_line: { type: 'integer' } }, ['path']),
      label: (args) => `Leyendo ${args.path ?? ''}`,
      run: async ({ path, start_line: start, end_line: end }) => {
        const relative = safe(path);
        const content = await deps.readText(relative);
        if (content === null) return `error: ${relative} does not exist`;
        let text = content;
        if (start || end) {
          const lines = content.split('\n');
          text = lines.slice(Math.max(0, (start ?? 1) - 1), end ?? lines.length).join('\n');
        }
        return text.length > READ_LIMIT ? `${text.slice(0, READ_LIMIT)}\n… (truncated: ${text.length} characters; read a line range)` : text;
      },
    },
    {
      name: 'search_project',
      description: 'Search text in all project files. Returns file:line: text.',
      parameters: object({ query: { type: 'string' }, regex: { type: 'boolean' } }, ['query']),
      label: (args) => `Buscando «${args.query ?? ''}»`,
      run: async ({ query, regex = false }) => {
        const hits = await deps.search(String(query ?? ''), Boolean(regex));
        if (!hits.length) return 'no matches';
        return hits.slice(0, 60).map((hit) => `${hit.relative}:${hit.line}: ${hit.text.trim()}`).join('\n');
      },
    },
    {
      name: 'get_diagnostics',
      description: 'Current compiler errors and warnings of the project.',
      parameters: object({}),
      label: () => 'Consultando los problemas de la compilación',
      run: async () => {
        const list = await deps.diagnostics();
        return list.length ? list.map((d) => `${d.level} ${d.file ?? ''}:${d.line ?? ''}: ${d.message}${d.hints?.length ? ` (hint: ${d.hints.join('; ')})` : ''}`).join('\n') : 'no problems';
      },
    },
    {
      name: 'get_outline',
      description: 'Headings of the compiled document (outline).',
      parameters: object({}),
      label: () => 'Leyendo el esquema',
      run: async () => {
        const outline = deps.outline();
        return outline.length ? outline.map((h) => `${'  '.repeat(Math.max(0, h.level - 1))}- ${h.text} (page ${h.page ?? '?'})`).join('\n') : 'no headings';
      },
    },
    {
      name: 'search_typst_docs',
      description: 'Search the official Typst documentation of the exact compiler version. Use English Typst terms (table, figure, caption, heading…).',
      parameters: object({ query: { type: 'string' } }, ['query']),
      label: (args) => `Consultando la documentación: ${args.query ?? ''}`,
      run: async ({ query }) => {
        const hits = await deps.docsSearch(String(query ?? ''));
        if (!hits.length) return 'no results';
        return hits
          .slice(0, 4)
          .map((hit) => `### ${hit.title} › ${hit.heading} (page: ${hit.path}${hit.anchor ? `#${hit.anchor}` : ''})\n${hit.snippet.slice(0, 1400)}`)
          .join('\n\n');
      },
    },
    {
      name: 'read_typst_docs',
      description: 'Read a full page of the Typst documentation, e.g. "reference/model/table".',
      parameters: object({ path: { type: 'string' } }, ['path']),
      label: (args) => `Leyendo la documentación: ${args.path ?? ''}`,
      run: async ({ path }) => {
        const page = await deps.docsPage(String(path ?? '').split('#')[0]);
        if (page === null) return `error: no documentation page ${path}`;
        return page.length > READ_LIMIT ? `${page.slice(0, READ_LIMIT)}\n… (truncated)` : page;
      },
    },
    {
      name: 'propose_changes',
      description:
        'Propose file changes for the user to review (nothing is written until accepted). Actions: "edit" (exact `search` text → `replace`), "create" (new file with `content`), "replace_all" (whole `content`), "delete", "rename" (`new_path`). DBV compiles the proposal and reports new errors.',
      parameters: object(
        {
          summary: { type: 'string', description: 'One sentence describing the change for the user.' },
          changes: {
            type: 'array',
            items: object(
              {
                path: { type: 'string' },
                action: { type: 'string', enum: ['edit', 'create', 'replace_all', 'delete', 'rename'] },
                search: { type: 'string' },
                replace: { type: 'string' },
                content: { type: 'string' },
                new_path: { type: 'string' },
              },
              ['path', 'action'],
            ),
          },
        },
        ['changes'],
      ),
      // `changes` lo escribe el modelo: un modelo pequeño puede mandar un objeto o un texto.
      label: (args) => `Preparando cambios en ${(Array.isArray(args.changes) ? args.changes : []).map((c) => c?.path).filter(Boolean).join(', ') || 'el proyecto'}`,
      run: async ({ changes = [], summary = '' }) => {
        const proposal = deps.getProposal();
        if (summary) proposal.summary = summary;
        const report = [];
        // Un modelo pequeño manda a veces un solo cambio como objeto en vez de lista.
        const received = Array.isArray(changes) ? changes : changes && typeof changes === 'object' ? [changes] : [];
        if (!received.length) {
          return 'error: no changes were received, so NOTHING was proposed. Call propose_changes again with `changes` as a non-empty array of {path, action, search, replace}. Do not tell the user a proposal was made.';
        }
        for (const change of received) {
          if (deps.allowPath && !deps.allowPath(change?.path)) {
            report.push(`error: ${change?.path}: this is a single loose document, not a project: only its own file can be read or changed`);
            continue;
          }
          const result = await applyChange(proposal, { ...change, newPath: change?.new_path ?? change?.newPath }, (path) => deps.readText(path));
          report.push(result.ok ? `ok: ${change.action} ${change.path}` : `error: ${change?.path}: ${result.message}`);
        }
        if (!proposal.files.size) {
          report.push('NOTHING was proposed: no change modified any file (the edit may be empty or identical to the current text). Tell the user the proposal is empty or retry with a correct edit.');
        }
        const checked = proposal.files.size ? await deps.checkProposal(proposal) : null;
        if (checked) {
          const { fresh, fixed } = checked;
          if (fresh.length) {
            fixAttempts += 1;
            const list = fresh.slice(0, 10).map((d) => `- ${d.file ?? ''}:${d.line ?? ''}: ${d.message}`).join('\n');
            report.push(
              fixAttempts <= MAX_FIX_ATTEMPTS
                ? `The proposal compiles with ${fresh.length} NEW error(s). Fix them with another propose_changes call (consult search_typst_docs if needed):\n${list}`
                : `The proposal still has ${fresh.length} new error(s):\n${list}\nDo not try again; explain the problem to the user.`,
            );
          } else report.push(`The proposal compiles without new errors${fixed ? ` and fixes ${fixed} existing error(s)` : ''}. The user will review it.`);
        } else if (proposal.files.size) report.push('The proposal could not be compiled to check it; the user will review it.');
        return report.join('\n');
      },
    },
  ];
}
