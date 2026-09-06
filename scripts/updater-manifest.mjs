#!/usr/bin/env node
// =============================================================================
// DBV Typst Editor — Manifiesto de actualización (latest.json) para el build local
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Existe por una asimetría real de este proyecto (NATIVE_APPS_RELEASE_CI.md §7):
// Linux y macOS se compilan en CI, donde `tauri-action` generaría el
// `latest.json` solo; pero Windows —la ÚNICA plataforma con auto-actualización,
// porque es donde vive la clave de firma— se compila y firma a mano en la
// máquina del mantenedor, y ahí `tauri build` produce el artefacto y su `.sig`
// pero NO el manifiesto que el actualizador consulta.
//
// Este script lo compone a partir de lo que el build acaba de dejar en disco:
// nada de escribirlo a mano, que es justo donde se cuela una firma pegada a
// medias o una URL con la versión anterior.
//
// Uso, después de `npm run build` con las variables TAURI_SIGNING_* puestas:
//   node scripts/updater-manifest.mjs [--notes "Texto de la versión"]
//
// Deja `latest.json` en la raíz del proyecto, listo para subirlo a la Release
// JUNTO al instalador (`-setup.exe`) y su `.sig`.
//
// CORRECCIÓN (2026-09-06, primer build de Windows real de todo el proyecto):
// esta cabecera y el código de más abajo asumían que `createUpdaterArtifacts`
// envuelve el instalador en un `.nsis.zip` con su propio `.sig` — cierto solo
// en el modo `v1Compatible`, ya no en el por defecto de Tauri v2 (CLI 2.11.x),
// que firma directamente el `-setup.exe` sin envolverlo en zip. Nunca se había
// detectado porque ningún build de Windows había llegado a ejecutarse antes de
// hoy — el mismo patrón que el bug de CI del `/ship` anterior (código que solo
// se prueba de verdad la primera vez que se ejecuta contra el sistema real).

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE_DIR = join(ROOT, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const REPO = 'davidbuenov/dbv-typst-editor';

const { version } = JSON.parse(readFileSync(join(ROOT, 'src-tauri', 'tauri.conf.json'), 'utf8'));

function fail(message, hint = '') {
  console.error(`\n  FALLO  ${message}`);
  if (hint) console.error(`         ${hint}`);
  process.exit(1);
}

if (!existsSync(BUNDLE_DIR)) {
  fail(
    `No existe ${BUNDLE_DIR}`,
    'Compila primero el instalador: npm run build (con las variables TAURI_SIGNING_* definidas).'
  );
}

// El artefacto de actualización es el propio `-setup.exe` (ver corrección de
// cabecera): se filtra por la versión actual porque `target/release/bundle/`
// no se limpia entre builds y puede arrastrar instaladores de versiones
// anteriores con el mismo sufijo `.exe.sig`.
const entries = readdirSync(BUNDLE_DIR);
const versionTag = `_${version}_`;
const archive = entries.find((name) => name.endsWith('-setup.exe') && name.includes(versionTag));
const signature = entries.find((name) => name.endsWith('-setup.exe.sig') && name.includes(versionTag));

if (!archive || !signature) {
  fail(
    `No se ha encontrado el artefacto de actualización de la versión ${version} (-setup.exe + .sig)`,
    'Comprueba que `createUpdaterArtifacts` sigue en true y que el build tenía la clave de firma.'
  );
}

// Un `.sig` es una línea; cualquier salto sobrante rompe la verificación.
const signatureContent = readFileSync(join(BUNDLE_DIR, signature), 'utf8').trim();
if (!signatureContent) fail(`El fichero de firma ${signature} está vacío.`);

const manifest = {
  version,
  notes: process.argv.includes('--notes') ? process.argv[process.argv.indexOf('--notes') + 1] : `DBV Typst Editor ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    // Solo Windows: es la única plataforma firmada (ver cabecera). Linux y
    // macOS se instalan a mano; si algún día se firman también, se añaden aquí
    // sus claves `linux-x86_64` / `darwin-universal`.
    'windows-x86_64': {
      signature: signatureContent,
      url: `https://github.com/${REPO}/releases/download/v${version}/${encodeURIComponent(archive)}`,
    },
  },
};

const outPath = join(ROOT, 'latest.json');
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`\nManifiesto de actualización para v${version}\n`);
console.log(`  Artefacto  ${archive}`);
console.log(`  Firma      ${signature} (${signatureContent.length} caracteres)`);
console.log(`  Escrito    ${outPath}\n`);
console.log('  Súbelo a la Release de GitHub junto al instalador (-setup.exe) y su .sig.');
console.log('  El actualizador lo busca en releases/latest/download/latest.json\n');
