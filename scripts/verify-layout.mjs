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

/**
 * Lanza la sonda en un navegador concreto y devuelve el DOM que escupa.
 *
 * Devuelve cadena vacía si ese navegador no sirve aquí, en vez de lanzar: eso es
 * lo que permite seguir probando con el siguiente candidato.
 */
function dumpDom(browser) {
  const profile = mkdtempSync(join(tmpdir(), 'dbv-layout-'));
  try {
    return execFileSync(
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
  } catch {
    return '';
  } finally {
    // En Windows el proceso del navegador todavía mantiene abiertos ficheros del
    // perfil cuando volvemos aquí, y el borrado revienta con ENOTEMPTY: la
    // comprobación moría en la limpieza, no por el layout. Se reintenta un poco
    // y, si aun así no se puede, se deja el temporal en paz — es basura en
    // %TEMP%, no un motivo para tumbar la verificación.
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      /* perfil temporal huérfano: irrelevante para lo que se está verificando */
    }
  }
}

console.log('Verificación de layout en un motor real\n');

// Se prueban los candidatos hasta dar con uno que RESPONDA, no con el primero
// que exista. La diferencia no es teórica: en la máquina de desarrollo estaban
// instalados Edge y Chrome, se elegía Edge por ir antes en la lista, y su
// `--dump-dom` devuelve stdout vacío (también con una página trivial, así que no
// es cosa de esta sonda). Resultado: la única comprobación de geometría del
// proyecto se omitía en silencio teniendo al lado un Chrome que funciona.
const instalados = CANDIDATES.filter((candidate) => existsSync(candidate));
if (instalados.length === 0) {
  console.log('  OMITIDA  no se ha encontrado Edge ni Chrome en el sistema');
  console.log('           (define CHROME_PATH para ejecutarla)\n');
  process.exit(0);
}

let dom = '';
let usado = null;
for (const candidato of instalados) {
  dom = dumpDom(candidato);
  if (dom.trim() !== '') {
    usado = candidato;
    break;
  }
}

if (usado === null) {
  console.log('  OMITIDA  ningún navegador instalado ha devuelto un DOM con --dump-dom');
  console.log(`           (probados: ${instalados.length}; define CHROME_PATH para otro)\n`);
  process.exit(0);
}

console.log(`  motor: ${usado}\n`);

// Un navegador que sale con código 0 y NO escribe nada en stdout no ha llegado
// a ejecutar la sonda: es el propio `--dump-dom` el que no funciona en esa
// máquina (pasa con Edge headless bajo ciertas políticas de empresa, y también
// con una página trivial, así que no tiene nada que ver con esta sonda). Eso no
// es un fallo de layout, y contarlo como tal manda a buscar un bug inexistente
// en la sonda: se OMITE, por el mismo motivo que cuando no hay navegador.
if (dom.trim() === '') {
  console.log('  OMITIDA  el navegador no ha devuelto ningún DOM con --dump-dom');
  console.log('           (motor no utilizable aquí; define CHROME_PATH para probar otro)');
  console.log();
  process.exit(0);
}

const match = dom.match(/DBV_LAYOUT_JSON(.*?)DBV_LAYOUT_END/s);
if (!match) {
  console.error('  FALLO  la sonda ha devuelto un DOM sin resultados (¿ha reventado su script?)\n');
  process.exit(1);
}

const checks = JSON.parse(match[1]);
for (const { name, ok, detail } of checks) {
  console.log(`${ok ? '  OK  ' : ' FALLO'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const passed = checks.filter((entry) => entry.ok).length;
console.log(`\n${passed}/${checks.length} comprobaciones en verde`);
process.exit(passed === checks.length ? 0 : 1);
