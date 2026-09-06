// Por qué desaparecen las figuras: se compara el bloque LaTeX con su
// resultado, sin volcar el texto del artículo (solo estructura y comandos).
import { readFileSync } from 'node:fs';

const [, , texPath, typPath] = process.argv;
const tex = readFileSync(texPath, 'utf8');
const typ = readFileSync(typPath, 'utf8');

const n = (t, re) => (t.match(re) ?? []).length;

console.log('── LADO LATEX ──');
console.log('  \\begin{figure}      :', n(tex, /\\begin\{figure\}/g));
console.log('  \\begin{figure\\*}    :', n(tex, /\\begin\{figure\*\}/g));
console.log('  \\includegraphics    :', n(tex, /\\includegraphics/g));
console.log('  \\subfloat           :', n(tex, /\\subfloat/g));
console.log('  \\caption            :', n(tex, /\\caption\{/g));
console.log('  \\cite variantes     :', n(tex, /\\cite[pt]?\{/g));

console.log('\n── LADO TYPST ──');
console.log('  #figure(            :', n(typ, /#figure\(/g));
console.log('  image(              :', n(typ, /image\(/g));
console.log('  #cite(              :', n(typ, /#cite\(/g));

// ¿Dónde acabaron los includegraphics? Se busca el nombre del fichero suelto.
console.log('\n── RASTRO DE CADA FIGURA EN LA SALIDA ──');
for (const m of tex.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)) {
  const path = m[1];
  const base = path.split('/').pop();
  const present = typ.includes(base);
  console.log(`  ${present ? '✓ aparece' : '✗ PERDIDA '}  ${path}`);
}

// Contexto: primer bloque figure del LaTeX, solo comandos (sin texto).
const fig = tex.match(/\\begin\{figure\}[\s\S]{0,400}/);
if (fig) {
  console.log('\n── ESTRUCTURA del primer \\begin{figure} (solo comandos) ──');
  const cmds = [...fig[0].matchAll(/\\[a-zA-Z]+/g)].map((m) => m[0]);
  console.log('  ', [...new Set(cmds)].join(' '));
}
