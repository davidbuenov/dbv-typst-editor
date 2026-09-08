// Spike S-2 · Preguntas 3, 4, 5 y 6 — La tabla de anclas.
//
// Inyecta anclas `#metadata(...)<dbv-sync>` entre bloques de los capítulos de un
// proyecto y mide: cuánto encarecen la compilación, cuánto cuesta extraerlas con
// `eval`, y si la tabla resultante permite el camino inverso (página+y → fichero+línea).
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const TYPST = resolve('src-tauri/binaries/typst-x86_64-pc-windows-msvc.exe');
const [, , projectDir, runsArg] = process.argv;
const root = resolve(projectDir);
const runs = Number(runsArg ?? 5);

const ms = (fn) => { const t = process.hrtime.bigint(); const r = fn(); return [Number(process.hrtime.bigint() - t) / 1e6, r]; };
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Inyecta un ancla antes de cada bloque (separado por línea en blanco).
 *  Entre bloques es donde el spike comprobó que el SVG sale byte-idéntico. */
function anclar(texto, fichero) {
  const lineas = texto.split('\n');
  const salida = [];
  let enBlanco = true;
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    if (enBlanco && linea.trim() !== '') {
      salida.push(`#metadata((f: "${fichero}", l: ${i + 1}))<dbv-sync>`);
    }
    salida.push(linea);
    enBlanco = linea.trim() === '';
  }
  return salida.join('\n');
}

const prepara = (conAnclas) => {
  const dest = mkdtempSync(join(tmpdir(), 'dbv-anclas-'));
  rmSync(dest, { recursive: true, force: true });
  cpSync(root, dest, { recursive: true });
  let n = 0;
  if (conAnclas) {
    for (const f of readdirSync(join(dest, 'chapters'))) {
      const rel = `chapters/${f}`;
      const texto = readFileSync(join(dest, rel), 'utf8');
      const anclado = anclar(texto, rel);
      n += (anclado.match(/<dbv-sync>/g) ?? []).length;
      writeFileSync(join(dest, rel), anclado);
    }
  }
  return [dest, n];
};

const compile = (dir) => { const out = mkdtempSync(join(tmpdir(), 'dbv-o-')); execFileSync(TYPST, ['compile', '--format', 'svg', '--root', dir, join(dir, 'main.typ'), join(out, 'p-{p}.svg')], { encoding: 'utf8' }); rmSync(out, { recursive: true, force: true }); };
const QUERY = 'query(<dbv-sync>).map(a => (f: a.value.f, l: a.value.l, p: a.location().page(), y: a.location().position().y))';
const anclasDe = (dir) => JSON.parse(execFileSync(TYPST, ['eval', QUERY, '--root', dir, '--in', join(dir, 'main.typ'), '--format', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

for (const conAnclas of [false, true]) {
  const [dir, n] = prepara(conAnclas);
  const comp = [], ev = [];
  let tabla = [];
  for (let i = 0; i < runs; i++) {
    comp.push(ms(() => compile(dir))[0]);
    const [t, r] = ms(() => anclasDe(dir));
    ev.push(t); tabla = r;
  }
  console.log(`── ${conAnclas ? `CON ${n} anclas` : 'SIN anclas (referencia)'} ──`);
  console.log(`  compilar el documento : ${median(comp).toFixed(0)} ms`);
  console.log(`  eval + query anclas   : ${median(ev).toFixed(0)} ms  (${tabla.length} anclas devueltas)`);
  if (conAnclas) {
    globalThis.__tabla = tabla;
    console.log(`  coste por ancla       : ${((median(comp) - globalThis.__base) / n).toFixed(3)} ms`);
  } else globalThis.__base = median(comp);
  rmSync(dir, { recursive: true, force: true });
  console.log();
}

// ── Pregunta 6: ¿el camino inverso acierta? ──
const tabla = globalThis.__tabla;
const pt = (s) => parseFloat(String(s).replace('pt', ''));
const anclaEn = (pagina, y) => {
  const cands = tabla.filter((a) => a.p < pagina || (a.p === pagina && pt(a.y) <= y));
  return cands.length ? cands[cands.length - 1] : null;
};
console.log('── Camino inverso: clic (página, y) → ancla anterior más cercana ──');
for (const [p, y] of [[1, 100], [5, 300], [50, 400], [120, 50], [202, 700]]) {
  const a = anclaEn(p, y);
  console.log(`  clic en pág ${String(p).padStart(3)}, y=${String(y).padStart(3)}pt → ${a ? `${a.f}:${a.l}  (ancla en pág ${a.p}, y=${a.y})` : 'sin ancla'}`);
}
const fuera = tabla.filter((a, i) => i > 0 && (a.p < tabla[i - 1].p || (a.p === tabla[i - 1].p && pt(a.y) < pt(tabla[i - 1].y))));
console.log(`\n  anclas devueltas fuera de orden de página/y: ${fuera.length} de ${tabla.length}`);
