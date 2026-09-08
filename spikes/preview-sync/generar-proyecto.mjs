// Spike S-2 — Genera un proyecto multi-fichero a escala de tesis para medir.
// No vive en testfiles/: es material de medición, se crea en un temporal.
import { mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [, , dest, capitulosArg, mbImagenesArg] = process.argv;
const capitulos = Number(capitulosArg ?? 20);
const mbImagenes = Number(mbImagenesArg ?? 0);
const root = resolve(dest);

mkdirSync(join(root, 'chapters'), { recursive: true });
mkdirSync(join(root, 'images'), { recursive: true });

const parrafo = 'Este es un párrafo de relleno con longitud realista para que la composición cueste lo que cuesta en un documento académico de verdad, con justificación y saltos de línea reales. ';

for (let c = 1; c <= capitulos; c++) {
  let texto = `= Capítulo ${c}\n\n`;
  for (let s = 1; s <= 6; s++) {
    texto += `== Sección ${c}.${s}\n\n`;
    for (let p = 0; p < 5; p++) texto += parrafo.repeat(4) + '\n\n';
  }
  writeFileSync(join(root, 'chapters', `${String(c).padStart(2, '0')}.typ`), texto);
}

// Imágenes: bytes opacos con cabecera PNG mínima no hace falta, no se compilan;
// solo pesan para medir el coste de replicar el árbol.
const porImagen = 512 * 1024;
const n = Math.round((mbImagenes * 1024 * 1024) / porImagen);
for (let i = 0; i < n; i++) writeFileSync(join(root, 'images', `img-${i}.bin`), Buffer.alloc(porImagen, i % 256));

const includes = Array.from({ length: capitulos }, (_, i) => `#include "chapters/${String(i + 1).padStart(2, '0')}.typ"`).join('\n');
writeFileSync(join(root, 'main.typ'), `#set page(paper: "a4", margin: 2.5cm)\n#set par(justify: true)\n#set heading(numbering: "1.1")\n\n${includes}\n`);
console.log(`generado: ${root} (${capitulos} capítulos, ${mbImagenes} MB de binarios)`);
