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
/** Lecturas de documentación de paquetes por turno (RNF-IA.9: un modelo no encadena descargas). */
export const MAX_PACKAGE_READS = 4;
/** Tope de lo que devuelve una lectura (caracteres). */
const READ_LIMIT = 24000;
const LIST_LIMIT = 400;

/** `@preview/nombre:1.2.3` en un texto Typst. */
const PACKAGE_ID = /@preview\/[A-Za-z0-9_-]+:\d+\.\d+\.\d+/g;

/** Identificadores de paquete que `text` tiene y `base` no (los que la IA acaba de escribir). */
export function newPackageIds(text, base = '') {
  const known = new Set(base.match(PACKAGE_ID) ?? []);
  return [...new Set(text.match(PACKAGE_ID) ?? [])].filter((id) => !known.has(id));
}

/** Aviso para el modelo sobre un identificador de paquete que no encaja con el catálogo, o `null` si está bien. */
export function describePackageCheck(check) {
  const unversioned = check.id.split(':')[0];
  const warnings = {
    unknownPackage: `${check.id}: no such package exists in Typst Universe. Never invent a package; call search_universe.`,
    unknownVersion: `${check.id}: that version does not exist. Use ${unversioned}:${check.latest} (the latest version this editor's compiler supports); never write a version from memory.`,
    outdated: `${check.id}: an outdated version. Use ${unversioned}:${check.latest}, the latest one this editor's compiler supports.`,
    needsNewerCompiler: `${check.id}: needs Typst ${check.compiler} or newer and this editor's compiler is older. Use ${unversioned}:${check.latest}.`,
    unavailable: `${check.id}: no version of this package works with this editor's compiler (it needs Typst ${check.compiler} or newer). Choose another package.`,
  };
  return warnings[check.status] ?? null;
}

/** Lo que la herramienta `search_universe` le cuenta al modelo: pocos resultados, cada uno con su identificador completo. */
export function formatUniverseResult(result, query) {
  if (result.status === 'noCatalog') {
    return 'The Typst Universe catalog is not available yet (it has not been downloaded). Tell the user to open the Typst Universe gallery once to download it; meanwhile do NOT guess package names or versions.';
  }
  if (!result.hits.length) {
    const unfit = (result.unavailable ?? []).map((u) => `${u.name} exists but needs Typst ${u.compiler} or newer`).join('; ');
    return `no results for "${query}"${unfit ? ` (${unfit})` : ''}. Do not invent a package: say that none was found.`;
  }
  const lines = result.hits.map((hit, index) => {
    const newer = hit.newerIncompatible ? ` (a newer ${hit.newerIncompatible.version} exists but needs Typst ${hit.newerIncompatible.compiler}, which this editor does not have)` : '';
    const tags = hit.categories?.length ? ` [${hit.categories.join(', ')}]` : '';
    return `${index + 1}. ${hit.id} — ${hit.kind}${tags} — ${hit.description} (${hit.license || 'license n/a'}${hit.updated ? `, ${hit.updated}` : ''})${newer}`;
  });
  return [
    'Typst Universe results. Use ONLY these exact identifiers, with their version; never write a package or a version from memory.',
    '"package" = a library you #import. "template" = a package that ships a document template: to apply it to an existing document, import it like any package and use it as the example in its documentation shows.',
    ...lines,
  ].join('\n');
}

/** Estilos que se enseñan sin consulta: los habituales de cada disciplina (`bibliography` de la documentación de Typst). */
const COMMON_STYLES = ['ieee', 'apa', 'chicago-author-date', 'chicago-notes', 'mla', 'harvard-cite-them-right', 'american-physics-society', 'vancouver', 'american-chemical-society'];

/** «1», «2-3», «1,3» → [1], [2, 3], [1, 3]. Lo que no se entiende se ignora; vacío = la primera. */
export function parsePageSpec(text) {
  const pages = [];
  for (const part of String(text ?? '1').split(',')) {
    const range = part.trim().match(/^(\d{1,4})(?:\s*-\s*(\d{1,4}))?$/);
    if (!range) continue;
    const first = Number(range[1]);
    const last = Number(range[2] ?? range[1]);
    for (let page = first; page <= Math.min(last, first + 5); page += 1) pages.push(page);
  }
  return pages.length ? pages : [1];
}

/** Lo que `list_bibliography` le cuenta al modelo: las claves que existen, cortas, y la orden de no inventar ninguna. */
export function formatBibliography(result, query = '') {
  if (!result.files.length) {
    return 'The project has no bibliography file (.bib or Hayagriva .yml). Do NOT invent references. Ask the user for the reference data, then propose creating a .bib file with exactly those entries.';
  }
  if (!result.references.length) {
    return `no references match "${query}" (${result.files.join(', ')} have none). Do not invent one: say it is not in the bibliography and, if the user gave you its data, propose adding an entry to the .bib file.`;
  }
  const lines = result.references.map((ref) => {
    const who = ref.authors.length ? `${ref.authors.join('; ')}${ref.etAl ? ' et al.' : ''}` : 'no author';
    const title = ref.title && ref.title.length > 90 ? `${ref.title.slice(0, 90)}…` : ref.title ?? 'no title';
    return `@${ref.key} — ${who} (${ref.year ?? 'n.d.'}). ${title} [${ref.entryType}]`;
  });
  const more = result.total > result.references.length ? ` (${result.references.length} of ${result.total} shown; pass \`query\` to filter by key, author, title or year)` : '';
  return [`Bibliography of the project (${result.files.join(', ')})${more}. Cite ONLY these keys with @key; never invent a reference, an author or a year.`, ...lines].join('\n');
}

/** Lo que `citation_styles` le cuenta al modelo: nombres válidos para `bibliography(style: …)`. */
export function formatCitationStyles(styles, query = '') {
  if (!styles.length) return 'error: the list of citation styles is not available. Use "ieee" or "apa", which every Typst version includes, and tell the user.';
  const needle = query.trim().toLowerCase();
  const chosen = needle
    ? styles.filter((s) => s.name.toLowerCase().includes(needle) || s.details.toLowerCase().includes(needle))
    : styles.filter((s) => COMMON_STYLES.includes(s.name));
  if (!chosen.length) return `no built-in style matches "${query}". There are ${styles.length} built-in styles; try another word (e.g. "ieee", "apa", "chicago", "nature").`;
  const lines = chosen.slice(0, 15).map((s) => `"${s.name}" — ${s.details}`);
  const note = needle ? '' : ` There are ${styles.length} built-in styles in total; pass \`query\` to search them.`;
  return [`Built-in citation styles (use them as bibliography(style: "name")).${note}`, ...lines, ...(chosen.length > 15 ? [`… ${chosen.length - 15} more; narrow the query`] : [])].join('\n');
}

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
 * @param {(query: string, kind: string) => Promise<object>} [deps.universeSearch] Búsqueda en el catálogo de Typst Universe (RF-108); si falta, la herramienta no se ofrece.
 * @param {(ids: string[]) => Promise<Array<{id: string, status: string, latest: string|null, compiler: string|null}>>} [deps.universeCheck] Comprueba los identificadores de paquete de una propuesta.
 * @param {Set<string>} [deps.universeSeen] Identificadores que la búsqueda ya devolvió en esta conversación.
 * @param {(query: string) => Promise<{references: Array, total: number, files: string[]}>} [deps.bibliography] Referencias del proyecto (RF-115); si falta, la herramienta no se ofrece.
 * @param {() => Promise<Array<{name: string, details: string}>>} [deps.citationStyles] Estilos de cita incluidos en Typst (RF-115.2).
 * @param {(options: {pages: number[], proposal: boolean}) => Promise<{pages: Array, totalPages: number|null}>} [deps.renderPages] Renderiza páginas a PNG (RF-114); si falta (modelo sin imágenes), la herramienta no se ofrece.
 * @param {(id: string) => Promise<string>} [deps.universeDocs] README, manifiesto y plantilla de un paquete (RF-108.3); si falta, la herramienta no se ofrece.
 */
export function createTools(deps) {
  let fixAttempts = 0;
  const seen = deps.universeSeen ?? new Set();
  /**
   * Avisos sobre los `@preview/…` que la propuesta ESTRENA (RF-108.4): un paquete o una versión que no
   * existen, o una que no es la que el compilador admite. Sin catálogo descargado no se dice nada.
   */
  const packageWarnings = async (proposal) => {
    if (!deps.universeCheck) return [];
    const ids = [...proposal.files.values()].flatMap((file) => (file.kind === 'delete' ? [] : newPackageIds(file.proposed ?? '', file.base ?? '')));
    if (!ids.length) return [];
    const checks = await deps.universeCheck([...new Set(ids)]);
    const warnings = checks.map(describePackageCheck).filter(Boolean);
    return warnings.length ? [`WARNING about packages (fix them in another propose_changes call):\n${warnings.map((w) => `- ${w}`).join('\n')}`] : [];
  };
  const safe = (path) => {
    const relative = normalizePath(path);
    if (!isSafeRelativePath(relative)) throw new Error(`path outside the project: ${path}`);
    return relative;
  };

  const bibliographyTools = [
    ...(deps.bibliography
      ? [
          {
            name: 'list_bibliography',
            description: 'List the project bibliography (key, authors, year, title); optional `query`. Cite ONLY these keys.',
            parameters: object({ query: { type: 'string' } }),
            label: (args) => `Consultando la bibliografía${args.query ? `: ${args.query}` : ''}`,
            run: async ({ query = '' }) => formatBibliography(await deps.bibliography(String(query ?? '')), String(query ?? '')),
          },
        ]
      : []),
    ...(deps.citationStyles
      ? [
          {
            name: 'citation_styles',
            description: 'Built-in citation styles for bibliography(style: "name"); optional `query`.',
            parameters: object({ query: { type: 'string' } }),
            label: (args) => `Consultando los estilos de cita${args.query ? `: ${args.query}` : ''}`,
            run: async ({ query = '' }) => formatCitationStyles(await deps.citationStyles(), String(query ?? '')),
          },
        ]
      : []),
  ];

  const renderTool = deps.renderPages
    ? [
        {
          name: 'render_page',
          description: 'See the rendered page(s) as an image (max 3). `pages`: "1", "2-3" or "1,3". `proposal: true` renders the project WITH your pending proposal applied, to check it before the user does.',
          parameters: object({ pages: { type: 'string' }, proposal: { type: 'boolean' } }),
          label: (args) => `Mirando la página ${args.pages ?? '1'}${args.proposal ? ' de la propuesta' : ''}`,
          run: async ({ pages = '1', proposal: withProposal = false }) => {
            if (withProposal && !deps.getProposal().files.size) return 'error: there is no proposal yet. Call propose_changes first, or render the current project with `proposal: false`.';
            const rendered = await deps.renderPages({ pages: parsePageSpec(pages), proposal: Boolean(withProposal) });
            const shown = rendered.pages.map((p) => p.page).join(', ');
            const size = rendered.pages[0] ? ` (${rendered.pages[0].width}×${rendered.pages[0].height} px)` : '';
            return {
              text: `Rendered page(s) ${shown}${rendered.totalPages ? ` of ${rendered.totalPages}` : ''}${size}${withProposal ? ', with your proposal applied' : ''}. The image(s) follow in the next message; judge the layout from them.`,
              images: rendered.pages.map((p) => ({ mime: p.mime, base64: p.base64 })),
            };
          },
        },
      ]
    : [];

  let packageReads = 0;
  const packageDocsTool = deps.universeDocs
    ? [
        {
          name: 'read_package_docs',
          description: 'Read the README and template example of a Universe package (identifier from search_universe).',
          parameters: object({ id: { type: 'string' } }, ['id']),
          label: (args) => `Leyendo la documentación del paquete ${args.id ?? ''}`,
          run: async ({ id }) => {
            const wanted = String(id ?? '').trim();
            if (packageReads >= MAX_PACKAGE_READS) return `error: at most ${MAX_PACKAGE_READS} package documentation reads per request; answer with what you already have.`;
            // Un identificador inventado no llega a la red: se comprueba contra el catálogo antes (RNF-IA.9.1).
            const [verdict] = deps.universeCheck ? await deps.universeCheck([wanted]) : [];
            if (!verdict) return 'error: the Typst Universe catalog is not available, so this identifier cannot be verified. Tell the user to open the Typst Universe gallery once; do not guess.';
            if (!['ok', 'outdated', 'needsNewerCompiler'].includes(verdict.status)) return `error: ${describePackageCheck(verdict) ?? `${wanted} is not a valid package identifier`}`;
            packageReads += 1;
            try {
              return await deps.universeDocs(wanted);
            } catch (error) {
              return `error: ${error?.message ?? error}`;
            }
          },
        },
      ]
    : [];

  const universeTools = deps.universeSearch
    ? [
        {
          name: 'search_universe',
          description:
            'Search Typst Universe for packages and document templates (max 8 results, each with its exact @preview/name:version). Use English keywords. Never write a package or version this tool did not return.',
          parameters: object({ query: { type: 'string' }, kind: { type: 'string', enum: ['any', 'package', 'template'] } }, ['query']),
          label: (args) => `Consultando Typst Universe: ${args.query ?? ''}`,
          run: async ({ query, kind = 'any' }) => {
            const result = await deps.universeSearch(String(query ?? ''), ['package', 'template'].includes(kind) ? kind : 'any');
            for (const hit of result?.hits ?? []) seen.add(hit.id);
            return formatUniverseResult(result ?? { status: 'noCatalog', hits: [] }, query);
          },
        },
      ]
    : [];

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
        report.push(...(await packageWarnings(proposal)));
        const checked = proposal.files.size ? await deps.checkProposal(proposal) : null;
        if (checked?.missing?.length) {
          // No es un error del modelo: se le dice qué pasa y que NO quite el import (RF-109.1).
          const list = checked.missing.join(', ');
          report.push(
            `The proposal could not be fully checked: ${list} ${checked.missing.length === 1 ? 'is' : 'are'} not installed yet. Do NOT remove the import and do not try to "fix" it: the compiler stops at the first missing package, so other errors may still be hidden. The user will be asked to approve the download when they review the proposal.`,
          );
          if (checked.fresh.length) report.push(`Errors already visible:\n${checked.fresh.slice(0, 10).map((d) => `- ${d.file ?? ''}:${d.line ?? ''}: ${d.message}`).join('\n')}`);
        } else if (checked) {
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
    ...universeTools,
    ...packageDocsTool,
    ...bibliographyTools,
    ...renderTool,
  ];
}
