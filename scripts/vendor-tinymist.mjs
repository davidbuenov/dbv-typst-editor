// =============================================================================
// DBV Typst Editor — Vendorizado del Language Server oficial de Typst (Tinymist)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Descarga la release oficial FIJADA de Tinymist y coloca el binario en
// `src-tauri/binaries/tinymist-<target-triple>[.exe]`, que es la convención de
// sidecar de Tauri. El binario nunca se commitea: este script se ejecuta
// en local y en CI antes de `tauri build`.
//
// Uso: node scripts/vendor-tinymist.mjs [--force] [--target <triple>]

import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TINYMIST_VERSION = '0.15.8';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src-tauri', 'binaries');

const TARGETS = {
  'x86_64-pc-windows-msvc': { asset: 'tinymist-x86_64-pc-windows-msvc.zip', binary: 'tinymist.exe' },
  'x86_64-unknown-linux-gnu': { asset: 'tinymist-x86_64-unknown-linux-musl.tar.gz', binary: 'tinymist' },
  'aarch64-unknown-linux-gnu': { asset: 'tinymist-aarch64-unknown-linux-musl.tar.gz', binary: 'tinymist' },
  'aarch64-apple-darwin': { asset: 'tinymist-aarch64-apple-darwin.tar.gz', binary: 'tinymist' },
  'x86_64-apple-darwin': { asset: 'tinymist-x86_64-apple-darwin.tar.gz', binary: 'tinymist' },
};

function hostTargetTriple() {
  const output = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
  const match = output.match(/^host:\s*(.+)$/m);
  if (!match) {
    throw new Error('No se pudo determinar el target triple del host desde `rustc -vV`');
  }
  return match[1].trim();
}

function extract(archiveName, workDir) {
  if (archiveName.endsWith('.tar.gz') || archiveName.endsWith('.tar.xz')) {
    execFileSync('tar', ['-xzf', archiveName], { cwd: workDir, stdio: 'inherit' });
    return;
  }

  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Expand-Archive -LiteralPath '${archiveName}' -DestinationPath '.' -Force`,
      ],
      { cwd: workDir, stdio: 'inherit' }
    );
    return;
  }

  execFileSync('unzip', ['-q', archiveName], { cwd: workDir, stdio: 'inherit' });
}

async function download(url, destPath) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Descarga fallida (${response.status} ${response.statusText}): ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(destPath, buffer);
  return buffer.length;
}

function requestedTriple() {
  const index = process.argv.indexOf('--target');
  if (index !== -1) {
    const value = process.argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error('--target necesita un target triple, p. ej. --target aarch64-apple-darwin');
    }
    return value;
  }
  return hostTargetTriple();
}

function findBinary(dir, binaryName) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findBinary(fullPath, binaryName);
      if (found) return found;
    } else if (entry.name === binaryName) {
      return fullPath;
    }
  }
  return null;
}

async function main() {
  const force = process.argv.includes('--force');
  const triple = requestedTriple();
  const target = TARGETS[triple];

  if (!target) {
    throw new Error(
      `Target no soportado: ${triple}. Añádelo al mapa TARGETS de este script con el asset oficial correspondiente.`
    );
  }

  const extension = triple.includes('windows') ? '.exe' : '';
  const finalPath = join(OUT_DIR, `tinymist-${triple}${extension}`);

  if (existsSync(finalPath) && !force) {
    console.log(`Sidecar tinymist ya presente: ${finalPath}`);
    console.log('Usa --force para volver a descargarlo.');
    return;
  }

  const url = `https://github.com/Myriad-Dreamin/tinymist/releases/download/v${TINYMIST_VERSION}/${target.asset}`;
  const workDir = mkdtempSync(join(tmpdir(), 'dbv-tinymist-vendor-'));

  try {
    console.log(`Descargando Tinymist v${TINYMIST_VERSION} para ${triple}...`);
    const archivePath = join(workDir, target.asset);
    const bytes = await download(url, archivePath);
    console.log(`  ${(bytes / 1024 / 1024).toFixed(1)} MB descargados`);

    extract(target.asset, workDir);

    const extractedBinary = findBinary(workDir, target.binary);
    if (!extractedBinary || !existsSync(extractedBinary)) {
      throw new Error(`No se encontró el binario esperado tras extraer: ${target.binary}`);
    }

    mkdirSync(OUT_DIR, { recursive: true });
    copyFileSync(extractedBinary, finalPath);
    if (!extension) chmodSync(finalPath, 0o755);

    const version = execFileSync(finalPath, ['--version'], { encoding: 'utf8' }).trim();
    console.log(`Sidecar instalado: ${finalPath}`);
    console.log(`  Verificación: ${version}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`\n[vendor-tinymist] ${error.message}`);
  process.exit(1);
});
