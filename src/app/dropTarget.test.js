// =============================================================================
// DBV Typst Editor — Tests del destino de un soltado de ficheros (RF-18)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';

import { decideImageDrop, pathsWithExtension } from './dropTarget.js';

const EDITOR = { left: 100, right: 500, top: 50, bottom: 400 };

describe('decideImageDrop', () => {
  it('copia e inserta cuando la imagen cae dentro del editor', () => {
    expect(decideImageDrop({ x: 300, y: 200 }, EDITOR, 1)).toEqual({ copy: true, insert: true });
  });

  it('copia pero NO inserta cuando cae fuera del editor', () => {
    // El caso que antes no hacía nada y en silencio: soltar sobre el explorador
    // de proyecto, a la izquierda del editor.
    expect(decideImageDrop({ x: 40, y: 200 }, EDITOR, 1)).toEqual({ copy: true, insert: false });
  });

  it('copia aunque no haya editor al que apuntar', () => {
    expect(decideImageDrop({ x: 300, y: 200 }, null, 1)).toEqual({ copy: true, insert: false });
  });

  it('convierte los píxeles físicos a lógicos antes de comparar', () => {
    // A 200% de escalado, un soltado en el centro del editor llega como el
    // doble de coordenada. Sin dividir por el ratio caería siempre fuera.
    expect(decideImageDrop({ x: 600, y: 400 }, EDITOR, 2).insert).toBe(true);
    expect(decideImageDrop({ x: 600, y: 400 }, EDITOR, 1).insert).toBe(false);
  });

  it('trata un devicePixelRatio ausente o cero como 1', () => {
    expect(decideImageDrop({ x: 300, y: 200 }, EDITOR, 0).insert).toBe(true);
    expect(decideImageDrop({ x: 300, y: 200 }, EDITOR, undefined).insert).toBe(true);
  });

  it('acepta los bordes exactos del editor', () => {
    expect(decideImageDrop({ x: 100, y: 50 }, EDITOR, 1).insert).toBe(true);
    expect(decideImageDrop({ x: 500, y: 400 }, EDITOR, 1).insert).toBe(true);
  });
});

describe('pathsWithExtension', () => {
  const IMAGES = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];

  it('conserva el orden del soltado y filtra por extensión', () => {
    const paths = ['/tmp/notas.txt', '/tmp/foto.png', '/tmp/logo.svg'];
    expect(pathsWithExtension(paths, IMAGES)).toEqual(['/tmp/foto.png', '/tmp/logo.svg']);
  });

  it('no distingue mayúsculas', () => {
    expect(pathsWithExtension(['/tmp/FOTO.PNG'], IMAGES)).toEqual(['/tmp/FOTO.PNG']);
  });

  it('descarta lo que Typst no sabe incrustar', () => {
    // `.bmp` pasaba el filtro del frontend antes de RF-18, pero Rust lo rechaza.
    expect(pathsWithExtension(['/tmp/mapa.bmp'], IMAGES)).toEqual([]);
  });

  it('descarta una ruta sin extensión', () => {
    expect(pathsWithExtension(['/tmp/README'], IMAGES)).toEqual([]);
  });

  it('con la lista de extensiones vacía no acepta nada', () => {
    // Es el estado mientras Rust no ha respondido todavía: preferimos no copiar
    // nada a copiar con una lista adivinada.
    expect(pathsWithExtension(['/tmp/foto.png'], [])).toEqual([]);
  });
});
