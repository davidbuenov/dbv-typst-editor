// =============================================================================
// DBV Typst Editor — Verificación del sidecar Typst contra el binario real
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Mitiga el riesgo R-05 del plan: todo lo que documenta
// TYPST_ECOSYSTEM_RESEARCH.md se dedujo de documentación oficial y manpages,
// NO de ejecutar el binario. Este script comprueba, contra el binario
// vendorizado, cada subcomando del que depende la arquitectura antes de
// construir código encima.
//
// Uso: node scripts/verify-typst-sidecar.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DOC = `= Introducción
Texto de la introducción.

== Objetivos
Lista de objetivos del documento.

#pagebreak()

= Metodología
Segunda página, para comprobar la exportación multipágina.
`;

const TEMPLATE_MANIFEST = `[package]
name = "dbv-verify-template"
version = "0.1.0"
entrypoint = "main.typ"
authors = ["DBV"]
license = "MIT"
description = "Plantilla mínima usada solo por el script de verificación"
categories = ["report"]

[template]
path = "template"
entrypoint = "main.typ"
thumbnail = "thumbnail.png"
`;

const results = [];

function record(id, description, passed, detail) {
  results.push({ id, description, passed, detail });
  const mark = passed ? '✓' : '✗';
  console.log(`${mark} ${id} — ${description}`);
  if (detail) console.log(`    ${detail.replace(/\n/g, '\n    ')}`);
}

/** Localiza el sidecar vendorizado para el host actual. */
function resolveSidecar() {
  const output = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
  const triple = output.match(/^host:\s*(.+)$/m)[1].trim();
  const extension = triple.includes('windows') ? '.exe' : '';
  const path = join(ROOT, 'src-tauri', 'binaries', `typst-${triple}${extension}`);
  if (!existsSync(path)) {
    throw new Error(`Sidecar no encontrado en ${path}. Ejecuta antes: npm run vendor:typst`);
  }
  return path;
}

function main() {
  const typst = resolveSidecar();
  const work = mkdtempSync(join(tmpdir(), 'dbv-typst-verify-'));

  try {
    const docPath = join(work, 'main.typ');
    writeFileSync(docPath, DOC, 'utf8');

    // ─── V-01: versión ──────────────────────────────────────────────────────
    const version = execFileSync(typst, ['--version'], { encoding: 'utf8' }).trim();
    record('V-01', '`typst --version` responde', version.startsWith('typst'), version);

    // ─── V-02: compilación a PDF por stdout (RF-10, ARCHITECTURE.md §7.2) ───
    const pdf = execFileSync(typst, ['compile', 'main.typ', '-'], {
      cwd: work,
      maxBuffer: 64 * 1024 * 1024,
    });
    const isPdf = pdf.subarray(0, 5).toString('latin1') === '%PDF-';
    record(
      'V-02',
      '`typst compile main.typ -` escribe el PDF a stdout (sin fichero temporal)',
      isPdf,
      `${(pdf.length / 1024).toFixed(1)} kB, cabecera: ${pdf.subarray(0, 8).toString('latin1').trim()}`
    );

    // ─── V-03: SVG multipágina con marcador {0p} (preview, §7.3) ────────────
    const svgDir = join(work, 'svg');
    mkdirSync(svgDir, { recursive: true });
    execFileSync(typst, ['compile', 'main.typ', 'svg/page-{0p}.svg', '--format', 'svg'], { cwd: work });
    const svgFiles = readdirSync(svgDir).filter((f) => f.endsWith('.svg')).sort();
    record(
      'V-03',
      '`typst compile --format svg` con marcador {0p} genera un fichero por página',
      svgFiles.length === 2,
      `${svgFiles.length} ficheros: ${svgFiles.join(', ')}`
    );

    // ─── V-04: rango de páginas (--pages, export PNG/SVG parcial) ───────────
    const pageDir = join(work, 'onepage');
    mkdirSync(pageDir, { recursive: true });
    execFileSync(typst, ['compile', 'main.typ', 'onepage/p-{0p}.svg', '--format', 'svg', '--pages', '2'], {
      cwd: work,
    });
    const oneFiles = readdirSync(pageDir).filter((f) => f.endsWith('.svg'));
    record('V-04', '`--pages` exporta solo el rango pedido', oneFiles.length === 1, `${oneFiles.join(', ')}`);

    // ─── V-05: query de encabezados (outline, §7.8) ─────────────────────────
    // Responde además el spike pendiente: ¿trae posición/página utilizable?
    const queryRaw = execFileSync(typst, ['query', 'main.typ', 'heading', '--pretty'], {
      cwd: work,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    const headings = JSON.parse(queryRaw);
    const first = headings[0] ?? {};
    const fields = Object.keys(first).join(', ');
    record(
      'V-05',
      '`typst query` funciona pero está DEPRECADO en 0.15.1 (el CLI recomienda `eval`)',
      Array.isArray(headings) && headings.length === 3,
      `${headings.length} encabezados · campos: ${fields}\n` +
        'Nota: `body` es un objeto {func, text} anidado, no una cadena plana.'
    );

    // ─── V-06: SPIKE outline resuelto (posición de cada encabezado) ────────
    // HALLAZGO (Slice 2): `query --field location` devuelve [] y sugiere usar
    // `typst eval`. Es `eval` —no `query`— quien da página y coordenada, que
    // es exactamente lo que necesita la navegación clic→posición del outline.
    const evalExpr =
      'query(heading).map(h => (nivel: h.level, texto: h.body, pagina: h.location().page(), y: h.location().position().y))';
    const outlineRaw = execFileSync(
      typst,
      ['eval', evalExpr, '--in', 'main.typ', '--format', 'json'],
      { cwd: work, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
    );
    const outline = JSON.parse(outlineRaw);
    const hasPositions = outline.every((h) => typeof h.pagina === 'number' && typeof h.y === 'string');
    record(
      'V-06',
      'SPIKE outline: `typst eval` expone página y posición de cada encabezado',
      outline.length === 3 && hasPositions,
      outline.map((h) => `n${h.nivel} p.${h.pagina} y=${h.y}`).join(' · ')
    );

    // ─── V-07: init desde plantilla propia vía namespace @local ────────────
    // HALLAZGO (Slice 2): `typst init` NO acepta una ruta de fichero
    // ("package specification must start with '@'"). Las plantillas locales
    // se sirven como paquetes del namespace @local desde un directorio propio
    // indicado con --package-path, sin tocar los datos del usuario.
    const pkgRoot = join(work, 'paquetes');
    const pkgDir = join(pkgRoot, 'local', 'dbv-verify-template', '0.1.0');
    mkdirSync(join(pkgDir, 'template'), { recursive: true });
    writeFileSync(join(pkgDir, 'typst.toml'), TEMPLATE_MANIFEST, 'utf8');
    writeFileSync(join(pkgDir, 'template', 'main.typ'), '= {{titulo}}\nContenido.\n', 'utf8');
    writeFileSync(join(pkgDir, 'thumbnail.png'), '', 'utf8');

    execFileSync(
      typst,
      ['init', '--package-path', pkgRoot, '@local/dbv-verify-template:0.1.0', 'proyecto-nuevo'],
      { cwd: work, encoding: 'utf8' }
    );
    const scaffolded = join(work, 'proyecto-nuevo', 'main.typ');
    const scaffoldedOk = existsSync(scaffolded);
    const keepsTokens = scaffoldedOk && readFileSync(scaffolded, 'utf8').includes('{{titulo}}');
    record(
      'V-07',
      '`typst init --package-path <dir> @local/<n>:<v>` hace scaffolding desde una plantilla propia',
      scaffoldedOk,
      scaffoldedOk ? `creado ${scaffolded}` : 'no se creó el proyecto'
    );
    record(
      'V-08',
      'Confirmado: `typst init` NO sustituye variables (el asistente DBV debe post-procesar)',
      keepsTokens,
      keepsTokens ? 'el token {{titulo}} llega intacto al proyecto generado' : 'el token fue alterado'
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones superadas`);
  if (failed.length > 0) {
    console.error(`Fallaron: ${failed.map((r) => r.id).join(', ')}`);
    process.exit(1);
  }
}

main();
