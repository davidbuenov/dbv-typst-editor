// =============================================================================
// DBV Typst Editor — Cada comando de ventana usado tiene su permiso ACL
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El bug real que motiva este test (encontrado por el usuario probando
// v0.10.0): `appWindow.destroy()` (RF-64.6, cierre de ventana protegido)
// llamaba a un comando de Tauri sin que `capabilities/main.json` declarase
// `core:window:allow-destroy` — "Promesa rechazada: Command
// plugin:window|destroy not allowed by ACL". Vitest no puede probar Tauri
// real, pero SÍ puede comprobar, por texto, que todo método de `appWindow`
// que el frontend invoca tiene su permiso declarado — así una llamada nueva
// sin su permiso se detecta aquí, no en la ventana real de otra persona.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Métodos de `Window` de Tauri que exigen `core:window:allow-<kebab>` (no eventos como `onCloseRequested`, que no invocan ningún comando). */
const WINDOW_COMMANDS = ['destroy', 'close', 'setAlwaysOnTop', 'isAlwaysOnTop'];

const toKebab = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** Todo `.js` bajo `src/`, sin tests, leído como texto. */
function readAllSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) readAllSourceFiles(full, out);
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      out.push(readFileSync(full, 'utf8'));
    }
  }
  return out;
}

describe('permisos ACL de los comandos de ventana (Tauri)', () => {
  it('todo método de appWindow/getCurrentWindow() usado tiene su core:window:allow-* declarado', () => {
    const sources = readAllSourceFiles(join(process.cwd(), 'src')).join('\n');
    const capabilities = JSON.parse(
      readFileSync(join(process.cwd(), 'src-tauri/capabilities/main.json'), 'utf8')
    );
    const declared = new Set(capabilities.permissions);

    const usedMethods = WINDOW_COMMANDS.filter((method) =>
      new RegExp(`appWindow\\.${method}\\(`).test(sources)
    );

    // Si esto falla porque no se usa NINGÚN método de ventana, es que
    // `WINDOW_COMMANDS` se quedó corta o el código cambió de forma — no que
    // el test sobre. Doble comprobación de que el propio test ve algo real.
    expect(usedMethods.length).toBeGreaterThan(0);

    const missing = usedMethods
      .map((method) => `core:window:allow-${toKebab(method)}`)
      .filter((permission) => !declared.has(permission));

    expect(missing).toEqual([]);
  });
});
