// =============================================================================
// DBV Typst Editor — Generador del icono base (placeholder)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Genera `src-tauri/icons/base.png` (512x512) sin dependencias externas: un
// cuadrado con el acento de la marca y una "T" de Typst. Es un PLACEHOLDER
// para que `tauri build` tenga iconos válidos desde el Slice 1; se sustituirá
// por el icono definitivo antes de la primera release.
//
// Uso: node scripts/generate-base-icon.mjs
//      npx tauri icon src-tauri/icons/base.png   (deriva el resto de tamaños)

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 512;
const BG = [13, 17, 23]; // --bg-primary (tema oscuro)
const FG = [88, 166, 255]; // --accent

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** ¿Pertenece el píxel al glifo "T"? Barra superior + asta central. */
function isGlyph(x, y) {
  const barTop = SIZE * 0.28;
  const barBottom = SIZE * 0.38;
  const barLeft = SIZE * 0.22;
  const barRight = SIZE * 0.78;
  const stemLeft = SIZE * 0.44;
  const stemRight = SIZE * 0.56;
  const stemBottom = SIZE * 0.76;

  const inBar = y >= barTop && y < barBottom && x >= barLeft && x < barRight;
  const inStem = y >= barTop && y < stemBottom && x >= stemLeft && x < stemRight;
  return inBar || inStem;
}

function buildPng() {
  const raw = Buffer.alloc((SIZE * 3 + 1) * SIZE);
  let offset = 0;
  for (let y = 0; y < SIZE; y += 1) {
    raw[offset] = 0; // filtro "None" para esta scanline
    offset += 1;
    for (let x = 0; x < SIZE; x += 1) {
      const [r, g, b] = isGlyph(x, y) ? FG : BG;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // profundidad de bits
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compresión
  ihdr[11] = 0; // filtro
  ihdr[12] = 0; // entrelazado

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src-tauri/icons/base.png');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buildPng());
console.log(`Icono base generado: ${outPath}`);
