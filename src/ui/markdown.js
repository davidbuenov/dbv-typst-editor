// =============================================================================
// DBV Typst Editor — Renderizador de Markdown seguro (RF-92, RF-96.6)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Pinta Markdown que viene de FUERA de la aplicación: respuestas de un modelo
// de IA y la documentación de Typst. Con `withGlobalTauri`, un `<img onerror>`
// colado en el DOM podría invocar comandos del backend (R-A4), así que aquí no
// hay `innerHTML`: se construyen nodos y todo texto entra por `textContent`.
// El HTML que traiga el texto se ve tal cual, como texto.
//
// Subconjunto suficiente para los dos usos: encabezados (con `{#ancla}`),
// párrafos, listas anidadas, citas, tablas, bloques de código con lenguaje,
// regla horizontal y, en línea, código, negrita, cursiva y enlaces. Los enlaces
// solo se siguen si son `typst:` (documentación) o `http(s):`, y siempre a
// través de los callbacks: nunca un `href` navegable.

/**
 * @typedef {object} RenderOptions
 * @property {(target: string) => void} [onDocLink] Enlace `typst:ruta#ancla`.
 * @property {(url: string) => void} [onExternalLink] Enlace `http(s):`.
 * @property {(code: string, lang: string) => HTMLElement[]} [codeActions] Botones bajo cada bloque de código.
 */

const HEADING = /^(#{1,6})\s+(.*?)\s*(?:\{#([\w-]+)\})?\s*$/;
const FENCE = /^(\s*)(```+|~~~+)\s*([\w+-]*)\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** ¿A dónde lleva un enlace? `null` si el esquema no está permitido. */
export function classifyLink(url) {
  const value = String(url ?? '').trim();
  let kind = null;
  if (value.startsWith('typst:')) kind = 'doc';
  else if (/^https?:\/\//i.test(value)) kind = 'external';
  return kind;
}

/**
 * Trocea el texto en línea en segmentos: texto, código, negrita, cursiva y
 * enlaces. Puro, para probarlo sin DOM.
 * @returns {Array<{type: 'text'|'code'|'strong'|'em'|'link', text: string, url?: string, children?: any[]}>}
 */
export function parseInline(text) {
  const out = [];
  let rest = String(text ?? '');
  const pattern = /(`+)([\s\S]*?)\1|\*\*((?:[^*]|\*[^*]+\*)+)\*\*|__([^_]+?)__|\*([^*\s][^*]*?)\*|(?<![\w])_([^_\s][^_]*?)_(?![\w])|\[([^\]]+)\]\(([^)\s]+)\)/;
  while (rest.length) {
    const match = rest.match(pattern);
    if (!match) {
      out.push({ type: 'text', text: rest });
      break;
    }
    if (match.index > 0) out.push({ type: 'text', text: rest.slice(0, match.index) });
    if (match[1]) out.push({ type: 'code', text: match[2] });
    else if (match[3] ?? match[4]) out.push({ type: 'strong', text: '', children: parseInline(match[3] ?? match[4]) });
    else if (match[5] ?? match[6]) out.push({ type: 'em', text: '', children: parseInline(match[5] ?? match[6]) });
    else out.push({ type: 'link', text: match[7], url: match[8] });
    rest = rest.slice(match.index + match[0].length);
  }
  return out;
}

function appendInline(parent, text, options) {
  appendSegments(parent, parseInline(text), options);
}

function appendSegments(parent, segments, options) {
  for (const segment of segments) {
    if (segment.type === 'text') parent.append(document.createTextNode(segment.text));
    else if (segment.type === 'code') parent.append(el('code', 'md-code', segment.text));
    else if (segment.type === 'strong' || segment.type === 'em') {
      const node = el(segment.type);
      appendSegments(node, segment.children, options);
      parent.append(node);
    } else appendLink(parent, segment, options);
  }
}

function appendLink(parent, segment, options) {
  const kind = classifyLink(segment.url);
  const handler = kind === 'doc' ? options.onDocLink : kind === 'external' ? options.onExternalLink : null;
  if (!handler) {
    parent.append(document.createTextNode(segment.text));
    return;
  }
  const link = el('a', `md-link md-link--${kind}`);
  link.href = '#';
  link.title = segment.url;
  appendInline(link, segment.text, options);
  link.addEventListener('click', (event) => {
    event.preventDefault();
    handler(kind === 'doc' ? segment.url.slice('typst:'.length) : segment.url);
  });
  parent.append(link);
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

/**
 * Markdown → bloques. Puro, para probarlo sin DOM.
 * @returns {Array<object>}
 */
export function parseBlocks(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const fence = line.match(FENCE);
    if (fence) {
      const close = fence[2];
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(close)) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ type: 'code', lang: fence[3] || '', text: code.join('\n') });
      index += 1;
      continue;
    }
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2], anchor: heading[3] ?? null });
      index += 1;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }
    if (line.includes('|') && TABLE_RULE.test(lines[index + 1] ?? '')) {
      const header = splitRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    if (line.trimStart().startsWith('>')) {
      const quoted = [];
      while (index < lines.length && lines[index].trimStart().startsWith('>')) {
        quoted.push(lines[index].trimStart().replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', children: parseBlocks(quoted.join('\n')) });
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const items = [];
      const baseIndent = line.match(LIST_ITEM)[1].length;
      const ordered = /\d/.test(line.match(LIST_ITEM)[2]);
      while (index < lines.length) {
        const current = lines[index];
        const item = current.match(LIST_ITEM);
        if (item && item[1].length === baseIndent) {
          items.push({ text: item[3], sub: [] });
          index += 1;
        } else if (current.trim() && items.length && (current.match(/^\s*/)[0].length > baseIndent)) {
          items.at(-1).sub.push(current.slice(baseIndent + 2));
          index += 1;
        } else break;
      }
      blocks.push({
        type: 'list',
        ordered,
        items: items.map((item) => ({ text: item.text, children: item.sub.length ? parseBlocks(item.sub.join('\n')) : [] })),
      });
      continue;
    }
    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !HEADING.test(lines[index]) &&
      !FENCE.test(lines[index]) &&
      !LIST_ITEM.test(lines[index]) &&
      !lines[index].trimStart().startsWith('>')
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}

function renderBlocks(blocks, parent, options) {
  for (const block of blocks) {
    if (block.type === 'heading') {
      const node = el(`h${Math.min(6, block.level + 1)}`, 'md-heading');
      if (block.anchor) node.dataset.anchor = block.anchor;
      appendInline(node, block.text, options);
      parent.append(node);
    } else if (block.type === 'paragraph') {
      const node = el('p', 'md-paragraph');
      appendInline(node, block.text, options);
      parent.append(node);
    } else if (block.type === 'code') {
      const wrap = el('div', 'md-codeblock');
      const pre = el('pre');
      const code = el('code', block.lang ? `language-${block.lang.replace(/[^\w-]/g, '')}` : '', block.text);
      pre.append(code);
      wrap.append(pre);
      const actions = options.codeActions?.(block.text, block.lang) ?? [];
      if (actions.length) {
        const bar = el('div', 'md-codeblock__actions');
        bar.append(...actions);
        wrap.append(bar);
      }
      parent.append(wrap);
    } else if (block.type === 'list') {
      const list = el(block.ordered ? 'ol' : 'ul', 'md-list');
      for (const item of block.items) {
        const li = el('li');
        appendInline(li, item.text, options);
        renderBlocks(item.children, li, options);
        list.append(li);
      }
      parent.append(list);
    } else if (block.type === 'quote') {
      const quote = el('blockquote', 'md-quote');
      renderBlocks(block.children, quote, options);
      parent.append(quote);
    } else if (block.type === 'table') {
      const scroller = el('div', 'md-table-wrap');
      const table = el('table', 'md-table');
      const head = el('tr');
      for (const cell of block.header) {
        const th = el('th');
        appendInline(th, cell, options);
        head.append(th);
      }
      const thead = el('thead');
      thead.append(head);
      const tbody = el('tbody');
      for (const row of block.rows) {
        const tr = el('tr');
        for (const cell of row) {
          const td = el('td');
          appendInline(td, cell, options);
          tr.append(td);
        }
        tbody.append(tr);
      }
      table.append(thead, tbody);
      scroller.append(table);
      parent.append(scroller);
    } else if (block.type === 'rule') {
      parent.append(el('hr', 'md-rule'));
    }
  }
}

/**
 * Markdown → fragmento DOM seguro.
 * @param {string} markdown
 * @param {RenderOptions} [options]
 * @returns {DocumentFragment}
 */
export function renderMarkdown(markdown, options = {}) {
  const fragment = document.createDocumentFragment();
  renderBlocks(parseBlocks(markdown), fragment, options);
  return fragment;
}
