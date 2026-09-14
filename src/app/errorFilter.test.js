// =============================================================================
// DBV Typst Editor — Test del filtro de avisos benignos (RF-40)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// `isBenignResizeObserverNotice` vive DENTRO del <script> inline de
// index.html, a propósito (ver el comentario de la cabecera del fichero: debe
// registrarse antes que cualquier script diferido, sin depender de que un
// módulo ES cargue). Para no duplicar la lógica en un módulo aparte solo por
// poder testearla, este test lee el HTML real y extrae la función tal cual,
// así que un cambio de redacción que rompa el filtro rompe este test, no un
// duplicado que podría desincronizarse en silencio.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// `process.cwd()` en vez de `import.meta.url`: la config de Vitest de este
// proyecto (`vitest.config.js`) fija la raíz del proyecto como raíz de
// ejecución, y `import.meta.url` bajo el transform de Vite no siempre resuelve
// a un `file://` válido para `fileURLToPath`.
const indexHtmlPath = join(process.cwd(), 'src', 'index.html');
const html = readFileSync(indexHtmlPath, 'utf-8');

/** Extrae `function isBenignResizeObserverNotice(...) { ... }` del HTML real. */
function extractFilter() {
  const match = html.match(/function isBenignResizeObserverNotice\(message\) \{[\s\S]*?\n {6}\}/);
  if (!match) throw new Error('No se encontró isBenignResizeObserverNotice en index.html');
  // eslint-disable-next-line no-new-func -- se evalúa el código REAL del HTML, no una copia.
  return new Function(`${match[0]}\nreturn isBenignResizeObserverNotice;`)();
}

describe('isBenignResizeObserverNotice (RF-40)', () => {
  const isBenignResizeObserverNotice = extractFilter();

  it('reconoce el aviso benigno de ResizeObserver de Chromium', () => {
    expect(
      isBenignResizeObserverNotice('ResizeObserver loop completed with undelivered notifications.'),
    ).toBe(true);
  });

  it('no confunde un error real con el aviso benigno', () => {
    expect(isBenignResizeObserverNotice('TypeError: r.href.startsWith is not a function')).toBe(false);
  });

  it('tolera valores que no son cadena sin lanzar', () => {
    expect(isBenignResizeObserverNotice(undefined)).toBe(false);
    expect(isBenignResizeObserverNotice(null)).toBe(false);
  });
});
