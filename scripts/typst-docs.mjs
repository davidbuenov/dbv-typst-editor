// =============================================================================
// DBV Typst Editor — Genera la documentación de Typst offline (RF-96)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Script de MANTENIMIENTO: se ejecuta una vez por versión de Typst, cuando se
// sube el sidecar (ADR-V0130-002). Su salida, `src-tauri/resources/
// typst-docs.json.gz`, se versiona y se empaqueta; un test de Rust falla si su
// versión no es la del compilador vendorizado.
//
//   npm run docs:typst                       → clona Typst en la etiqueta de la
//                                              versión vendorizada, compila la
//                                              documentación (cargo docit) y la
//                                              convierte (≈4 min la primera vez)
//   npm run docs:typst -- --site <carpeta>   → convierte un sitio ya compilado
//
// La documentación de Typst es Apache-2.0: el paquete lleva su aviso.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { JSDOM } from 'jsdom';
import { convertMain, keepPage } from './typstDocsConvert.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const OUTPUT = join(ROOT, 'src-tauri', 'resources', 'typst-docs.json.gz');

function vendoredVersion() {
  const source = readFileSync(join(ROOT, 'scripts', 'vendor-typst.mjs'), 'utf8');
  const match = source.match(/TYPST_VERSION\s*=\s*'([^']+)'/);
  if (!match) throw new Error('No encuentro TYPST_VERSION en scripts/vendor-typst.mjs');
  return match[1];
}

function buildSite(version) {
  const checkout = join(tmpdir(), `dbv-typst-docs-${version}`);
  if (!existsSync(checkout)) {
    console.log(`Clonando Typst v${version}…`);
    execFileSync('git', ['clone', '--depth', '1', '--branch', `v${version}`, 'https://github.com/typst/typst.git', checkout], { stdio: 'inherit' });
  }
  console.log('Compilando la documentación (cargo docit compile)…');
  execFileSync('cargo', ['docit', 'compile'], { cwd: checkout, stdio: 'inherit' });
  return join(checkout, 'docs', 'dist', 'site');
}

function htmlFiles(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...htmlFiles(full));
    else if (name === 'index.html') found.push(full);
  }
  return found;
}

function main() {
  const version = vendoredVersion();
  const siteArg = process.argv.indexOf('--site');
  const site = siteArg > 0 ? process.argv[siteArg + 1] : buildSite(version);
  const pages = [];
  for (const file of htmlFiles(site).sort()) {
    const path = relative(site, file).split(sep).slice(0, -1).join('/');
    if (!keepPage(path, version)) continue;
    const dom = new JSDOM(readFileSync(file, 'utf8'));
    const mainEl = dom.window.document.querySelector('main');
    if (!mainEl) continue;
    const { title, markdown } = convertMain(mainEl, path);
    if (markdown) pages.push({ path, title: title || path, markdown });
  }
  const bundle = {
    typstVersion: version,
    license: 'Typst documentation © Typst contributors, Apache-2.0 (https://github.com/typst/typst)',
    pages,
  };
  mkdirSync(join(ROOT, 'src-tauri', 'resources'), { recursive: true });
  const json = JSON.stringify(bundle);
  const compressed = gzipSync(json, { level: 9 });
  writeFileSync(OUTPUT, compressed);
  console.log(`${pages.length} páginas · ${(json.length / 1e6).toFixed(2)} MB de Markdown · ${(compressed.length / 1e6).toFixed(2)} MB comprimido → ${OUTPUT}`);
}

main();
