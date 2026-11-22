// =============================================================================
// DBV Typst Editor — Test de la versión mostrada en la web del proyecto (GitHub Pages)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
// La insignia `.badge-version` del hero de docs/index.html y docs/en/index.html es un literal (la web es HTML
// estático, como en dbv-md-reader). Este test falla si en un release se sube la versión en tauri.conf.json y se
// olvida la web. También vigila que la versión de los manuales PDF (`docs/manual/*.typ`) sea la misma.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(join(process.cwd(), ...path.split('/')), 'utf8');
const { version } = JSON.parse(read('src-tauri/tauri.conf.json'));

describe('web del proyecto · insignia de versión', () => {
  for (const page of ['docs/index.html', 'docs/en/index.html']) {
    it(`${page} muestra v${version}`, () => {
      const match = read(page).match(/<span class="badge-version">v([^<]+)<\/span>/);
      expect(match, 'falta la insignia .badge-version').not.toBeNull();
      expect(match[1]).toBe(version);
    });
  }

  it('la insignia tiene su estilo en docs/styles.css', () => {
    expect(read('docs/styles.css')).toContain('.badge-version');
  });
});

describe('manuales PDF · versión', () => {
  for (const source of ['docs/manual/common.typ', 'docs/manual/manual-es.typ', 'docs/manual/manual-en.typ']) {
    it(`${source} declara v${version}`, () => {
      expect(read(source)).toContain(`version: "v${version}"`);
    });
  }
});
