#!/usr/bin/env node
// =============================================================================
// DBV Typst Editor — Verificación de layout en un motor real
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Existe por un fallo real, y de una familia que ninguna otra verificación de
// este proyecto puede coger: `base.css` arrastraba desde el Slice 1 un
// `.app-body { display: grid; place-items: center }` del andamiaje del "Hola
// mundo". `layout.css` ya pisaba `display`, así que la regla parecía muerta —
// pero `place-items` NO estaba pisado, y el día que Chromium implementó
// `justify-items`/`justify-self` para cajas de bloque dejó de ser inerte: pasó
// a encoger al contenido y centrar TODO hijo de `.app-body`, dejando la mitad
// de la ventana vacía a los lados. Ni los tests de Vitest (jsdom no calcula
// layout), ni `verify:frontend` (no monta cajas), ni `vite build` lo veían.
//
// La comprobación es deliberadamente geométrica y sin datos: se abre
// `layout-probe.html` —el esqueleto real del shell con las hojas de estilo
// reales— en Edge/Chrome headless (el mismo motor que WebView2) y se
// comprueba que cada caja ocupa el ancho que le toca, en las 7 combinaciones
// de paneles de §7.9.
//
// Sin dependencias nuevas: usa el navegador ya instalado en el sistema. Si no
// hay ninguno (una máquina de CI pelada), la comprobación se OMITE en vez de
// fallar — no tiene sentido bloquear el pipeline por no encontrar un binario
// que este proyecto no vendoriza.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROBE = join(ROOT, 'scripts', 'layout-probe.html');

/** Rutas habituales del motor de WebView2 (Edge) y su primo Chrome. */
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function findBrowser() {
  return CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

console.log('Verificación de layout en un motor real\n');

const browser = findBrowser();
if (!browser) {
  console.log('  OMITIDA  no se ha encontrado Edge ni Chrome en el sistema');
  console.log('           (define CHROME_PATH para ejecutarla)\n');
  process.exit(0);
}

const profile = mkdtempSync(join(tmpdir(), 'dbv-layout-'));
let dom = '';
try {
  dom = execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--user-data-dir=${profile}`,
      '--window-size=1366,768',
      '--virtual-time-budget=4000',
      '--dump-dom',
      `file://${PROBE.replaceAll('\\', '/')}`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60_000 }
  );
} catch (error) {
  console.error(`  FALLO  no se ha podido ejecutar el navegador — ${error.message}\n`);
  process.exit(1);
} finally {
  rmSync(profile, { recursive: true, force: true });
}

const match = dom.match(/DBV_LAYOUT_JSON(.*?)DBV_LAYOUT_END/s);
if (!match) {
  console.error('  FALLO  la sonda no ha devuelto resultados (¿ha reventado su script?)\n');
  process.exit(1);
}

const checks = JSON.parse(match[1]);
for (const { name, ok, detail } of checks) {
  console.log(`${ok ? '  OK  ' : ' FALLO'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const passed = checks.filter((entry) => entry.ok).length;
console.log(`\n${passed}/${checks.length} comprobaciones en verde`);
process.exit(passed === checks.length ? 0 : 1);
