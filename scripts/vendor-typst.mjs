// =============================================================================
// DBV Typst Editor — Vendorizado del CLI oficial de Typst como sidecar de Tauri
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Descarga la release oficial FIJADA de Typst y coloca el binario en
// `src-tauri/binaries/typst-<target-triple>[.exe]`, que es la convención de
// sidecar de Tauri (ARCHITECTURE.md §7.2). El binario nunca se commitea: este
// script se ejecuta en local y en CI antes de `tauri build`.
//
// Uso: node scripts/vendor-typst.mjs [--force] [--target <triple>]
//
// `--target` existe para el build universal de macOS: el runner de CI es Apple
// Silicon, pero `--target universal-apple-darwin` exige un sidecar universal, y
// Typst publica un binario por arquitectura. El workflow vendoriza los dos
// explícitamente y los funde con `lipo` (ver `.github/workflows/release-macos.yml`).
// Sin este flag solo se podría vendorizar el del host, y el build de macOS
// fallaría al no encontrar `typst-universal-apple-darwin`.

import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Versión fijada ──────────────────────────────────────────────────────────
// Se actualiza de forma explícita y probada, nunca automáticamente: el
// compilador es parte del producto (ARCHITECTURE.md §6, riesgo de estabilidad
// de flags/salida del CLI entre versiones).
const TYPST_VERSION = '0.15.1';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src-tauri', 'binaries');

// Mapa target-triple de Rust → asset oficial de la release.
//
// Nota no obvia: para Linux, Typst publica un binario **musl** estático, no
// gnu. Se descarga el musl y se nombra con el triple `-gnu` porque ese es el
// triple con el que Tauri compila la app en Linux y el nombre que buscará al
// empaquetar; un binario musl estático funciona igual sobre glibc.
const TARGETS = {
  'x86_64-pc-windows-msvc': { asset: 'typst-x86_64-pc-windows-msvc.zip', binary: 'typst.exe' },
  'x86_64-unknown-linux-gnu': { asset: 'typst-x86_64-unknown-linux-musl.tar.xz', binary: 'typst' },
  'aarch64-unknown-linux-gnu': { asset: 'typst-aarch64-unknown-linux-musl.tar.xz', binary: 'typst' },
  'aarch64-apple-darwin': { asset: 'typst-aarch64-apple-darwin.tar.xz', binary: 'typst' },
  'x86_64-apple-darwin': { asset: 'typst-x86_64-apple-darwin.tar.xz', binary: 'typst' },
};

/** @returns {string} Target triple del host, según el propio rustc. */
function hostTargetTriple() {
  const output = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
  const match = output.match(/^host:\s*(.+)$/m);
  if (!match) {
    throw new Error('No se pudo determinar el target triple del host desde `rustc -vV`');
  }
  return match[1].trim();
}

/**
 * Extrae el archivo descargado sin dependencias npm.
 *
 * Dos caminos, porque no hay una sola herramienta fiable para ambos formatos:
 *   · `.tar.xz` → `tar`, presente de serie en Windows 10+, Linux y macOS.
 *   · `.zip`    → PowerShell `Expand-Archive` en Windows (el `tar` de GNU que
 *                 trae Git Bash NO lee zip; solo bsdtar lo hace), `unzip` en
 *                 el resto.
 *
 * Además se pasa el nombre RELATIVO con `cwd` en lugar de rutas absolutas: el
 * `tar` de GNU interpreta `C:\...` como `host:ruta` de una copia remota y
 * falla con "Cannot connect to C".
 */
function extract(archiveName, workDir) {
  if (!archiveName.endsWith('.zip')) {
    execFileSync('tar', ['-xf', archiveName], { cwd: workDir, stdio: 'inherit' });
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

/** Triple pedido por `--target <triple>`, o el del host si no se pide ninguno. */
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
  const finalPath = join(OUT_DIR, `typst-${triple}${extension}`);

  if (existsSync(finalPath) && !force) {
    console.log(`Sidecar ya presente: ${finalPath}`);
    console.log('Usa --force para volver a descargarlo.');
    return;
  }

  const url = `https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/${target.asset}`;
  const workDir = mkdtempSync(join(tmpdir(), 'dbv-typst-vendor-'));

  try {
    console.log(`Descargando Typst v${TYPST_VERSION} para ${triple}...`);
    const archivePath = join(workDir, target.asset);
    const bytes = await download(url, archivePath);
    console.log(`  ${(bytes / 1024 / 1024).toFixed(1)} MB descargados`);

    extract(target.asset, workDir);

    // El archivo contiene un directorio con el nombre del asset (sin extensión).
    const innerDir = target.asset.replace(/\.(zip|tar\.xz)$/, '');
    const extractedBinary = join(workDir, innerDir, target.binary);
    if (!existsSync(extractedBinary)) {
      throw new Error(`No se encontró el binario esperado tras extraer: ${extractedBinary}`);
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
  console.error(`\n[vendor-typst] ${error.message}`);
  process.exit(1);
});
