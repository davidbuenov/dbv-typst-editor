#!/usr/bin/env node
// =============================================================================
// DBV Typst Editor — Verificación del catálogo de plantillas
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Criterio de aceptación de los Slices 7 y 8: "cada plantilla compila sin
// errores y su formulario genera un documento coherente". Esto lo comprueba de
// verdad, contra el binario real y con el mismo mecanismo que usa la aplicación
// (`typst init --package-path`), en vez de dejarlo en una prueba manual:
//
//   1. `typst init` la plantilla en un directorio temporal;
//   2. sustituye los marcadores `{{...}}` con valores de ejemplo, igual que
//      hace `templates.rs`;
//   3. comprueba que no queda ningún marcador sin sustituir;
//   4. compila el resultado a PDF y verifica que el PDF tiene contenido.
//
// Sin dependencias externas: solo Node y el sidecar ya vendorizado.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES_DIR = join(ROOT, 'templates');
const NAMESPACE_DIR = join(TEMPLATES_DIR, 'local');

/** Valores de ejemplo del formulario, con acentos para no dar por bueno ASCII. */
const SAMPLE_VALUES = {
  proyecto: 'Proyecto de prueba',
  titulo: 'Análisis de la señal en régimen estacionario',
  subtitulo: 'Un estudio comparativo',
  autor: 'David Bueno Vallejo',
  tutor: 'Dra. Ana Martínez',
  institucion: 'Universidad de Málaga',
  titulacion: 'Grado en Ingeniería Informática',
  curso: '2025/2026',
  departamento: 'Lenguajes y Ciencias de la Computación',
  resumen: 'Resumen breve del trabajo, en un único párrafo.',
  palabrasClave: 'typst, composición, tipografía',
  correo: 'ejemplo@uma.es',
  telefono: '+34 600 000 000',
  web: 'https://github.com/davidbuenov',
  revista: 'Revista de Ingeniería Aplicada',
};

function sidecarPath() {
  const dir = join(ROOT, 'src-tauri', 'binaries');
  if (!existsSync(dir)) return null;
  const candidate = readdirSync(dir).find((name) => name.startsWith('typst-'));
  return candidate ? join(dir, candidate) : null;
}

/** Sustituye `{{clave}}`, con la misma semántica que `templates.rs`. */
function substitute(source, values) {
  let result = source;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

function walkFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...walkFiles(path));
    else found.push(path);
  }
  return found;
}

/** Última versión (orden lexicográfico) de una plantilla, como en `templates.rs`. */
function latestVersion(templateDir) {
  const versions = readdirSync(templateDir)
    .filter((name) => statSync(join(templateDir, name)).isDirectory())
    .sort();
  return versions.at(-1) ?? null;
}

const results = [];
const record = (ok, message) => {
  results.push({ ok, message });
  console.log(`${ok ? '  OK  ' : ' FALLO'}  ${message}`);
};

function verifyTemplate(typst, name, version) {
  const workdir = mkdtempSync(join(tmpdir(), 'dbv-tpl-'));
  const target = join(workdir, 'proyecto');
  try {
    execFileSync(
      typst,
      ['init', '--package-path', TEMPLATES_DIR, `@local/${name}:${version}`, target],
      { stdio: 'pipe' }
    );
    record(true, `${name}:${version} — typst init crea el proyecto`);

    const files = walkFiles(target);
    const entrypoint = join(target, 'main.typ');
    record(existsSync(entrypoint), `${name}:${version} — el proyecto tiene main.typ`);

    for (const file of files) {
      if (!/\.(typ|bib|toml)$/i.test(file)) continue;
      writeFileSync(file, substitute(readFileSync(file, 'utf8'), SAMPLE_VALUES));
    }

    const leftovers = files
      .filter((file) => /\.(typ|bib|toml)$/i.test(file))
      .filter((file) => /\{\{[a-zA-Z_][\w]*\}\}/.test(readFileSync(file, 'utf8')));
    record(
      leftovers.length === 0,
      leftovers.length === 0
        ? `${name}:${version} — no quedan marcadores sin sustituir`
        : `${name}:${version} — marcadores huérfanos en ${leftovers.join(', ')}`
    );

    const pdf = join(workdir, 'salida.pdf');
    execFileSync(typst, ['compile', '--root', target, entrypoint, pdf], { stdio: 'pipe' });
    const size = statSync(pdf).size;
    record(size > 1000, `${name}:${version} — compila a PDF (${size} bytes)`);
  } catch (error) {
    const detail = error.stderr ? error.stderr.toString().trim().split('\n')[0] : error.message;
    record(false, `${name}:${version} — ${detail}`);
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

function main() {
  console.log('Verificación del catálogo de plantillas (contra el binario real)\n');

  const typst = sidecarPath();
  if (!typst) {
    console.error('No se encuentra el sidecar. Ejecuta antes: npm run vendor:typst');
    process.exit(1);
  }
  if (!existsSync(NAMESPACE_DIR)) {
    console.error(`No se encuentra el catálogo en ${NAMESPACE_DIR}`);
    process.exit(1);
  }

  const templates = readdirSync(NAMESPACE_DIR).filter((name) =>
    statSync(join(NAMESPACE_DIR, name)).isDirectory()
  );
  if (templates.length === 0) {
    console.error('El catálogo está vacío.');
    process.exit(1);
  }

  for (const name of templates) {
    const version = latestVersion(join(NAMESPACE_DIR, name));
    if (!version) {
      record(false, `${name} — no tiene ninguna carpeta de versión`);
      continue;
    }
    verifyTemplate(typst, name, version);
  }

  const failed = results.filter((entry) => !entry.ok).length;
  console.log(`\n${results.length - failed}/${results.length} comprobaciones en verde`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
