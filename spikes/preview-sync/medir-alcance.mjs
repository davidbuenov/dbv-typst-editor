// Spike S-2 · Pregunta 5 — ¿Cuánto cuesta pasar de compilar el fichero abierto a
// compilar el documento completo? Es el número que decide si el modo automático
// sigue siendo viable o si el modo manual pasa a ser obligatorio en documentos
// grandes.
//
// Uso: node medir-alcance.mjs <carpeta-proyecto> <capitulo-relativo> [repeticiones]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const TYPST = resolve('src-tauri/binaries/typst-x86_64-pc-windows-msvc.exe');
const [, , projectDir, capituloRel, runsArg] = process.argv;
const root = resolve(projectDir);
const runs = Number(runsArg ?? 7);

const ms = (fn) => { const t = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - t) / 1e6; };
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const bench = (label, file) => {
  const times = [];
  let pages = 0;
  for (let i = 0; i < runs; i++) {
    const out = mkdtempSync(join(tmpdir(), 'dbv-bench-'));
    try {
      times.push(ms(() => execFileSync(TYPST,
        ['compile', '--format', 'svg', '--root', root, join(root, file), join(out, 'p-{p}.svg')],
        { encoding: 'utf8', stdio: 'pipe' })));
      pages = readdirSync(out).length;
    } catch (error) {
      // No es un fallo de la medición: que un capítulo NO compile suelto es uno
      // de los resultados que este spike busca documentar.
      const primera = String(error.stderr ?? '').split('\n')[0];
      console.log('  ' + label.padEnd(38) + '   NO COMPILA  ·  ' + primera);
      rmSync(out, { recursive: true, force: true });
      return null;
    }
    rmSync(out, { recursive: true, force: true });
  }
  const m = median(times);
  console.log('  ' + label.padEnd(38) + m.toFixed(0).padStart(5) + ' ms   '
    + String(pages).padStart(3) + ' pag   ' + (m / pages).toFixed(1).padStart(5) + ' ms/pag');
  return m;
};

console.log('Proyecto: ' + root + '  (mediana de ' + runs + ')\n');
console.log('-- Coste de compilacion por alcance --');
const cap = bench('un capitulo (comportamiento actual)', capituloRel);
const doc = bench('el documento completo', 'main.typ');

console.log('\n-- Lectura --');
if (cap !== null && doc !== null) {
  console.log('  sobrecoste del documento completo : +' + (doc - cap).toFixed(0)
    + ' ms  (x' + (doc / cap).toFixed(2) + ')');
} else {
  console.log('  el capitulo no compila suelto: el alcance actual no es solo mas lento, es INCORRECTO.');
}
if (doc !== null) {
  console.log('  pausa de tecleo actual (DEBOUNCE_MS de preview.js): 350 ms');
  console.log('  ' + (doc > 350 ? '[!]' : '[ok]') + ' la compilacion completa '
    + (doc > 350 ? 'SUPERA' : 'cabe en') + ' la pausa de tecleo');
}
