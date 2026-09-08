// Spike S-2 · Preguntas 1 y 5 — Coste de la raíz sombra y del documento completo.
//
// Mide contra el binario vendorizado, sobre un proyecto multi-fichero, las tres
// piezas que deciden si la vista previa puede pasar a compilar el documento raíz
// manteniendo visibles los cambios sin guardar del capítulo que se edita:
//   · construir el árbol sombra (copia vs enlace duro para lo que no es .typ)
//   · compilar el documento completo
//   · la pasada extra de `eval` que produce la tabla de anclas
import { cpSync, mkdtempSync, writeFileSync, readFileSync, rmSync, statSync,
         readdirSync, mkdirSync, linkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, relative } from 'node:path';

const TYPST = resolve('src-tauri/binaries/typst-x86_64-pc-windows-msvc.exe');
const [, , projectDir, dirtyRel, runsArg] = process.argv;
const root = resolve(projectDir);
const runs = Number(runsArg ?? 5);

const ms = (fn) => { const t = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - t) / 1e6; };
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const entries = () => readdirSync(root, { withFileTypes: true, recursive: true })
  .filter((e) => e.isFile())
  .map((e) => relative(root, join(e.parentPath ?? e.path, e.name)));

const files = entries();
const bytes = files.reduce((n, f) => n + statSync(join(root, f)).size, 0);
const typFiles = files.filter((f) => f.endsWith('.typ'));

/** Copia entera: simple, cuesta lo que pesa el proyecto. */
const shadowCopy = (dest, dirty) => {
  cpSync(root, dest, { recursive: true });
  writeFileSync(join(dest, dirtyRel), dirty);
};

/** Enlace duro para todo lo que no es `.typ`; copia solo el texto. Las imágenes
 *  y fuentes pesadas no se duplican, y el usuario nunca las ve modificadas
 *  porque nadie escribe sobre ellas. */
const shadowLink = (dest, dirty) => {
  for (const f of files) {
    const target = join(dest, f);
    mkdirSync(dirname(target), { recursive: true });
    if (f.endsWith('.typ') || f.endsWith('.bib')) writeFileSync(target, readFileSync(join(root, f)));
    else linkSync(join(root, f), target);
  }
  writeFileSync(join(dest, dirtyRel), dirty);
};

const compile = (dir) => execFileSync(TYPST,
  ['compile', '--format', 'svg', '--root', dir, join(dir, 'main.typ'), join(dir, 'p-{p}.svg')],
  { encoding: 'utf8' });

const ANCLAS = 'query(<dbv-sync>).map(a => (d: a.value, p: a.location().page(), y: a.location().position().y))';
const evalAnclas = (dir, file) => execFileSync(TYPST,
  ['eval', ANCLAS, '--root', dir, '--in', join(dir, file), '--format', 'json'], { encoding: 'utf8' });

const dirty = readFileSync(join(root, dirtyRel), 'utf8') + '\n\nPÁRRAFO SIN GUARDAR DEL SPIKE.\n';

console.log(`Proyecto: ${root}`);
console.log(`  ${files.length} ficheros (${typFiles.length} .typ), ${(bytes / 1048576).toFixed(1)} MB\n`);

const results = {};
for (const [name, build] of [['copia', shadowCopy], ['enlace duro', shadowLink]]) {
  const b = [], c = [];
  for (let i = 0; i < runs; i++) {
    const shadow = mkdtempSync(join(tmpdir(), 'dbv-shadow-'));
    rmSync(shadow, { recursive: true, force: true });   // cpSync crea el destino
    b.push(ms(() => build(shadow, dirty)));
    c.push(ms(() => compile(shadow)));
    rmSync(shadow, { recursive: true, force: true });
  }
  results[name] = [median(b), median(c)];
  console.log(`── Raíz sombra por ${name} (mediana de ${runs}) ──`);
  console.log(`  construir el árbol   : ${median(b).toFixed(1)} ms`);
  console.log(`  compilar el documento: ${median(c).toFixed(1)} ms`);
  console.log(`  TOTAL por pausa      : ${(median(b) + median(c)).toFixed(1)} ms\n`);
}

// Pasada extra de anclas, sobre el proyecto real (sin sombra: mide el eval en sí).
const anclasMs = [];
for (let i = 0; i < runs; i++) anclasMs.push(ms(() => evalAnclas(root, 'main.typ')));
console.log(`── Pasada extra de anclas (eval + query) ──`);
console.log(`  eval sobre el documento completo: ${median(anclasMs).toFixed(1)} ms`);
console.log(`  (mide el coste de la segunda composición; con 0 anclas presentes)`);
