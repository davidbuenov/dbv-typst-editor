// =============================================================================
// DBV Typst Editor — Tests del renderizador de Markdown seguro
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { classifyLink, parseBlocks, parseInline, renderMarkdown } from './markdown.js';

function render(markdown, options) {
  const host = document.createElement('div');
  host.append(renderMarkdown(markdown, options));
  return host;
}

describe('seguridad (R-A4)', () => {
  const payloads = [
    '<img src=x onerror="window.__pwned=1">',
    '<script>window.__pwned=1</script>',
    '[clic](javascript:window.__pwned=1)',
    '<a href="javascript:alert(1)">x</a>',
    '```\n</code><img src=x onerror=alert(1)>\n```',
    '| <svg onload=alert(1)> | b |\n| --- | --- |\n| c | d |',
  ];
  for (const payload of payloads) {
    it(`no crea elementos activos con ${JSON.stringify(payload).slice(0, 40)}`, () => {
      const host = render(payload);
      expect(host.querySelector('img, script, svg, iframe, [onerror], [onload]')).toBeNull();
      for (const link of host.querySelectorAll('a')) expect(link.getAttribute('href')).toBe('#');
      expect(window.__pwned).toBeUndefined();
    });
  }

  it('un enlace con esquema no permitido queda como texto', () => {
    const host = render('[clic](javascript:alert(1)) y [archivo](file:///etc/passwd)');
    expect(host.querySelector('a')).toBeNull();
    expect(host.textContent).toContain('clic');
  });

  it('classifyLink solo admite typst: y http(s):', () => {
    expect(classifyLink('typst:reference/model/table')).toBe('doc');
    expect(classifyLink('https://typst.app')).toBe('external');
    expect(classifyLink('javascript:x')).toBeNull();
    expect(classifyLink('data:text/html,x')).toBeNull();
  });
});

describe('bloques', () => {
  it('reconoce encabezados con ancla, código, listas, tablas y citas', () => {
    const blocks = parseBlocks('# table {#summary}\n\nTexto *uno*.\n\n```typst\n#table()\n```\n\n- a\n  - b\n- c\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n> nota');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'code', 'list', 'table', 'quote']);
    expect(blocks[0]).toMatchObject({ level: 1, text: 'table', anchor: 'summary' });
    expect(blocks[2]).toMatchObject({ lang: 'typst', text: '#table()' });
    expect(blocks[3].items[0].children[0].type).toBe('list');
    expect(blocks[4]).toMatchObject({ header: ['A', 'B'], rows: [['1', '2']] });
  });

  it('un bloque de código sin cerrar llega hasta el final sin perder texto', () => {
    const blocks = parseBlocks('```typst\n#let x = 1');
    expect(blocks).toEqual([{ type: 'code', lang: 'typst', text: '#let x = 1' }]);
  });
});

describe('en línea', () => {
  it('trocea código, negrita, cursiva y enlaces anidados', () => {
    const segments = parseInline('Usa `table` con **cabecera *fija*** y [docs](typst:guides/tables).');
    expect(segments.map((s) => s.type)).toEqual(['text', 'code', 'text', 'strong', 'text', 'link', 'text']);
    expect(segments[3].children.map((s) => s.type)).toEqual(['text', 'em']);
  });

  it('no confunde guiones bajos dentro de palabras con cursiva', () => {
    expect(parseInline('snake_case_name').map((s) => s.type)).toEqual(['text']);
  });
});

describe('render', () => {
  it('los enlaces llaman al callback correspondiente', () => {
    const onDocLink = vi.fn();
    const onExternalLink = vi.fn();
    const host = render('[t](typst:reference/model/table#x) [w](https://typst.app)', { onDocLink, onExternalLink });
    const [doc, ext] = host.querySelectorAll('a');
    doc.click();
    ext.click();
    expect(onDocLink).toHaveBeenCalledWith('reference/model/table#x');
    expect(onExternalLink).toHaveBeenCalledWith('https://typst.app');
  });

  it('añade las acciones de cada bloque de código', () => {
    const host = render('```typst\n#x\n```', {
      codeActions: (code, lang) => {
        const button = document.createElement('button');
        button.textContent = `${lang}:${code}`;
        return [button];
      },
    });
    expect(host.querySelector('.md-codeblock__actions button').textContent).toBe('typst:#x');
  });

  it('el encabezado conserva su ancla para navegar', () => {
    expect(render('## Parameters {#parameters}').querySelector('[data-anchor="parameters"]').textContent).toBe('Parameters');
  });
});
