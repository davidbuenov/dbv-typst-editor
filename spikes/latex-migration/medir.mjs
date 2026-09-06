// Medición estructural sin volcar contenido: solo nombres de comando y conteos.
import { readFileSync } from 'node:fs';

const [, , texPath, typPath] = process.argv;
const tex = readFileSync(texPath, 'utf8');
const typ = readFileSync(typPath, 'utf8');

const count = (text, re) => (text.match(re) ?? []).length;

// Restos de LaTeX en la salida, agrupados por comando.
const leftovers = {};
for (const m of typ.matchAll(/\\([a-zA-Z]+)/g)) {
  leftovers[m[1]] = (leftovers[m[1]] ?? 0) + 1;
}
const top = Object.entries(leftovers).sort((a, b) => b[1] - a[1]);
const total = top.reduce((sum, [, n]) => sum + n, 0);

console.log(`── RESTOS LATEX EN LA SALIDA: ${total} ──`);
for (const [cmd, n] of top.slice(0, 14)) console.log(`  ${String(n).padStart(4)}  \\${cmd}`);

console.log(`\n── ORIGEN (LaTeX) ──`);
console.log(`  \\section / \\subsection : ${count(tex, /\\(sub)?section\*?\{/g)}`);
console.log(`  entornos table/longtable: ${count(tex, /\\begin\{(table|longtable|sidewaystable)\}/g)}`);
console.log(`  entornos figure         : ${count(tex, /\\begin\{figure\*?\}/g)}`);
console.log(`  \\includegraphics        : ${count(tex, /\\includegraphics/g)}`);
console.log(`  citas (cite/citep/citet): ${count(tex, /\\cite[pt]?\{/g)}`);
console.log(`  \\ref / \\autoref         : ${count(tex, /\\(auto)?ref\{/g)}`);
console.log(`  ecuaciones ($$ / equation/align): ${count(tex, /\\begin\{(equation|align)\*?\}/g)}`);
console.log(`  comandos propios (\\newcommand): ${count(tex, /\\newcommand/g)}`);
