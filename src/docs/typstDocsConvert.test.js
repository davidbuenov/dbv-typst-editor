// =============================================================================
// DBV Typst Editor — Tests del conversor de la documentación de Typst (RF-96)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { convertMain, keepPage, rewriteHref } from '../../scripts/typstDocsConvert.mjs';

function main(html) {
  const host = document.createElement('main');
  host.innerHTML = html;
  return host;
}

describe('rewriteHref', () => {
  it('convierte rutas internas y anclas a typst:', () => {
    expect(rewriteHref('/reference/model/table/#parameters-columns')).toBe('typst:reference/model/table#parameters-columns');
    expect(rewriteHref('/guides/tables/')).toBe('typst:guides/tables');
    expect(rewriteHref('#definitions-cell', 'reference/model/table')).toBe('typst:reference/model/table#definitions-cell');
    expect(rewriteHref('https://typst.app')).toBe('https://typst.app');
  });
});

describe('convertMain', () => {
  it('quita iconos, tooltips y previsualizaciones y conserva el texto', () => {
    const { title, markdown } = convertMain(
      main(
        '<ul class="breadcrumbs"><li>Docs</li></ul>' +
          '<h1 id="summary"><code>table</code><small>Element<div class="tooltip-context">Ayuda</div></small><a class="sources-link" href="x"><svg></svg></a></h1>' +
          '<p>A <strong>table</strong> of <a href="/reference/model/figure/">figures</a>.</p>' +
          '<div class="previewed-code"><pre><button class="copy">c</button><code data-lang="typ">#table(\n  columns: 2,\n)\n</code></pre><div class="preview"><img src="x.png"></div></div>',
      ),
      'reference/model/table',
    );
    expect(title).toBe('table');
    expect(markdown).toContain('# table {#summary}');
    expect(markdown).toContain('A **table** of [figures](typst:reference/model/figure).');
    expect(markdown).toContain('```typst\n#table(\n  columns: 2,\n)\n```');
    expect(markdown).not.toContain('Ayuda');
    expect(markdown).not.toContain('Docs');
  });

  it('pinta la línea de tipos de un parámetro sin duplicarla', () => {
    const { markdown } = convertMain(
      main(
        '<h3 id="parameters-columns"><code>columns</code><div class="additional-info"><div><a class="pill" href="/a/">auto</a> <small>or</small> <a class="pill" href="/b/">int</a></div><small class="mod">Settable</small></div><small class="default">Default: <code>()</code></small></h3>',
      ),
    );
    expect(markdown).toBe('### columns {#parameters-columns}\n\nauto | int · Settable · Default: `()`');
  });

  it('convierte la firma en un bloque de código', () => {
    const { markdown } = convertMain(
      main(
        '<div class="code code-definition"><span class="typ-func">table</span>(<div class="arguments"><span class="overview-param"><a href="#parameters-columns">columns</a>: <a class="pill">auto</a><a class="pill">int</a>,</span></div>) → <a class="pill">content</a></div>',
      ),
    );
    expect(markdown).toBe('```typc\ntable(\n  columns: auto | int,\n) -> content\n```');
  });

  it('convierte listas anidadas y tablas', () => {
    const { markdown } = convertMain(
      main('<ul><li>uno<ul><li>dos</li></ul></li></ul><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2|3</td></tr></table>'),
    );
    expect(markdown).toContain('- uno\n  - dos');
    expect(markdown).toContain('| A | B |\n| --- | --- |\n| 1 | 2\\|3 |');
  });
});

describe('keepPage', () => {
  it('deja fuera la portada y los registros de cambios de otras series', () => {
    expect(keepPage('', '0.15.1')).toBe(false);
    expect(keepPage('changelog/0.14.2', '0.15.1')).toBe(false);
    expect(keepPage('changelog/0.15.0', '0.15.1')).toBe(true);
    expect(keepPage('reference/model/table', '0.15.1')).toBe(true);
  });
});
