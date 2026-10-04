// =============================================================================
// DBV Typst Editor — Test del manifiesto MSIX (alias de ejecución del servidor MCP)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El alias `dbv-typst-editor.exe` (RF-113, ADR-V0140-003) lo genera `tauri-windows-bundle` a partir de
// `bundle.config.json`. Dos errores reales de la 0.14.0 que este test impide: un comentario con `--mcp` en la plantilla
// (en XML `--` es ilegal dentro de un comentario y el empaquetado fallaba) y un segundo bloque `<Extensions>` escrito a
// mano, que el manifiesto no admite (la herramienta ya genera el suyo).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(join(process.cwd(), 'src-tauri', 'gen', 'windows', path), 'utf8');

describe('manifiesto MSIX', () => {
  const template = read('AppxManifest.xml.template');

  it('ningún comentario XML contiene «--» (el analizador del empaquetado lo rechaza)', () => {
    for (const comment of template.match(/<!--[\s\S]*?-->/g) ?? []) {
      expect(comment.slice(4, -3), comment).not.toContain('--');
    }
  });

  it('la plantilla no escribe su propio <Extensions>: lo genera la herramienta con {{EXTENSIONS}}', () => {
    expect(template).toContain('{{EXTENSIONS}}');
    expect(template).not.toMatch(/<Extensions[\s>]/);
  });

  it('el alias de ejecución se declara en la configuración del empaquetado', () => {
    const config = JSON.parse(read('bundle.config.json'));
    expect(config.extensions.appExecutionAliases).toEqual([{ alias: 'dbv-typst-editor' }]);
  });
});
