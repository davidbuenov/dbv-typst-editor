// =============================================================================
// DBV Typst Editor — Conversión de la documentación de Typst a Markdown (RF-96)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Lógica pura del conversor (la usa `typst-docs.mjs` y la prueban los tests):
// recibe el `<main>` de una página del sitio que genera `cargo docit compile` y
// devuelve Markdown. El sitio no lleva tablas de datos ni HTML arbitrario: son
// encabezados, párrafos, listas, bloques de código y las «píldoras» de tipos.
//
// Los enlaces internos se reescriben como `typst:ruta#ancla`, que el visor de
// la Ayuda (RF-96.6) sabe seguir; los externos se conservan.

/** Nodos que no aportan texto: iconos, botones, tooltips, imágenes de ejemplo. */
const DROP = 'svg, button, img, script, style, .tooltip-context, .sources-link, .breadcrumbs, .preview, .copy, .page-end-buttons';

/** Ruta interna del sitio (`/reference/model/table/#x`) → `typst:reference/model/table#x`. */
export function rewriteHref(href, pagePath = '') {
  let result = href ?? '';
  if (result.startsWith('/')) {
    const [path, anchor] = result.split('#');
    const clean = path.replace(/^\/+|\/+$/g, '');
    result = `typst:${clean}${anchor ? `#${anchor}` : ''}`;
  } else if (result.startsWith('#')) {
    result = `typst:${pagePath}#${result.slice(1)}`;
  }
  return result;
}

const collapse = (text) => text.replace(/\s+/g, ' ');

function inline(node, pagePath = '') {
  let out = '';
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      out += collapse(child.textContent);
      continue;
    }
    if (child.nodeType !== 1) continue;
    const tag = child.tagName.toLowerCase();
    if (tag === 'code') out += `\`${child.textContent.replace(/`/g, 'ˋ')}\``;
    else if (tag === 'strong' || tag === 'b') out += `**${inline(child, pagePath).trim()}**`;
    else if (tag === 'em' || tag === 'i') out += `*${inline(child, pagePath).trim()}*`;
    else if (tag === 'br') out += ' ';
    else if (tag === 'a') {
      const text = inline(child, pagePath).trim();
      const href = rewriteHref(child.getAttribute('href'), pagePath);
      out += child.classList.contains('pill') || !href ? text : `[${text}](${href})`;
    } else out += inline(child, pagePath);
  }
  return out;
}

/** Texto de la línea de tipos: «auto | int | array», «Settable», «Default: `()`». */
function describeExtra(extra) {
  const pills = [...extra.querySelectorAll('.pill')].map((pill) => pill.textContent.trim());
  const parts = [];
  if (pills.length) parts.push(pills.join(' | '));
  for (const small of extra.matches('small') ? [extra] : extra.querySelectorAll('small')) {
    const text = collapse(inline(small)).trim();
    if (text && text !== 'or') parts.push(text);
  }
  return parts;
}

/** Firma `table(columns: auto | int, ..) → content` en una sola línea de código. */
function signature(node) {
  const name = node.querySelector('.typ-func')?.textContent.trim() ?? '';
  const params = [...node.querySelectorAll('.overview-param')].map((param) => {
    const pills = [...param.querySelectorAll('.pill')].map((pill) => pill.textContent.trim());
    for (const pill of param.querySelectorAll('.pill')) pill.remove();
    const label = collapse(param.textContent).replace(/[,:]\s*$/, '').replace(/:\s*$/, '').trim();
    return `${label}${label && pills.length ? ': ' : ''}${pills.join(' | ')}`;
  });
  const tail = [...node.childNodes].filter((child) => child.nodeType === 1 && child.matches('.pill'));
  const returns = tail.map((pill) => pill.textContent.trim()).join(' | ');
  const lines = ['```typc', `${name}(`, ...params.map((p) => `  ${p},`), `)${returns ? ` -> ${returns}` : ''}`, '```'];
  return lines.join('\n');
}

function heading(node, level) {
  // El nombre va en el primer `code` o en el texto directo; la línea de tipos
  // («auto or int», Settable, Default) va en `.additional-info` y `.default`.
  const clone = node.cloneNode(true);
  const extras = [...clone.querySelectorAll('.additional-info, small')].filter(
    (extra) => !extra.parentElement?.closest('.additional-info, small'),
  );
  const types = extras.flatMap(describeExtra).filter(Boolean);
  for (const extra of extras) extra.remove();
  const title = collapse(inline(clone)).trim().replace(/`/g, '');
  const anchor = node.getAttribute('id');
  const lines = [`${'#'.repeat(level)} ${title}${anchor ? ` {#${anchor}}` : ''}`];
  if (types.length) lines.push('', types.join(' · '));
  return lines.join('\n');
}

function block(node, depth = 0) {
  const parts = [];
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      const text = collapse(child.textContent).trim();
      if (text) parts.push(text);
      continue;
    }
    if (child.nodeType !== 1) continue;
    const tag = child.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) parts.push(heading(child, Number(tag[1])));
    else if (child.classList.contains('code-definition')) parts.push(signature(child));
    else if (tag === 'p') {
      const text = inline(child).trim();
      if (text) parts.push(text);
    } else if (tag === 'pre') {
      const code = child.querySelector('code') ?? child;
      const lang = code.getAttribute?.('data-lang') ?? '';
      parts.push(`\`\`\`${lang === 'typ' || lang === 'typc' ? 'typst' : lang}\n${code.textContent.replace(/\n+$/, '')}\n\`\`\``);
    } else if (tag === 'ul' || tag === 'ol') {
      const items = [...child.children].filter((li) => li.tagName.toLowerCase() === 'li');
      parts.push(items.map((li, index) => {
        const marker = tag === 'ol' ? `${index + 1}.` : '-';
        const nested = [...li.children].filter((c) => ['ul', 'ol'].includes(c.tagName.toLowerCase()));
        const own = li.cloneNode(true);
        for (const list of own.querySelectorAll(':scope > ul, :scope > ol')) list.remove();
        const sub = nested.map((list) => block({ childNodes: [list] }, depth + 1).replace(/^/gm, '  ')).join('\n');
        return `${marker} ${inline(own).trim()}${sub ? `\n${sub}` : ''}`;
      }).join('\n'));
    } else if (tag === 'blockquote') {
      parts.push(block(child, depth).replace(/^/gm, '> '));
    } else if (tag === 'table') {
      const rows = [...child.querySelectorAll('tr')].map((tr) => [...tr.children].map((cell) => inline(cell).trim().replace(/\|/g, '\\|')));
      if (rows.length) {
        const width = Math.max(...rows.map((row) => row.length));
        const line = (row) => `| ${[...row, ...Array(width - row.length).fill('')].join(' | ')} |`;
        parts.push([line(rows[0]), `|${' --- |'.repeat(width)}`, ...rows.slice(1).map(line)].join('\n'));
      }
    } else {
      const inner = block(child, depth);
      if (inner) parts.push(inner);
    }
  }
  return parts.join('\n\n');
}

/**
 * `<main>` de una página → `{ title, markdown }`. Los anclajes de la propia
 * página (`#definitions-cell`) se completan con su ruta.
 * @param {Element} main
 * @param {string} [path] p. ej. `reference/model/table`
 */
export function convertMain(main, path = '') {
  for (const node of main.querySelectorAll(DROP)) node.remove();
  const h1 = main.querySelector('h1');
  let title = '';
  if (h1) {
    const clone = h1.cloneNode(true);
    for (const extra of clone.querySelectorAll('small, .additional-info')) extra.remove();
    title = collapse(clone.textContent).trim();
  }
  const markdown = block(main)
    .replace(/\n{3,}/g, '\n\n')
    .replaceAll('(typst:#', `(typst:${path}#`)
    .trim();
  return { title, markdown };
}

/**
 * ¿Entra la página en el paquete? Fuera: los registros de cambios anteriores a
 * la serie de la versión (ruido para la búsqueda) y la portada.
 * @param {string} path p. ej. `reference/model/table`
 * @param {string} version p. ej. `0.15.1`
 */
export function keepPage(path, version) {
  const [major, minor] = version.split('.');
  const series = `changelog/${major}.${minor}.`;
  let keep = path !== '' && !path.startsWith('assets');
  if (path.startsWith('changelog')) keep = path.startsWith(series);
  return keep;
}
