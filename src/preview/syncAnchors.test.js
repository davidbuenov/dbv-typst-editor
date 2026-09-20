// =============================================================================
// DBV Typst Editor — Tests de la búsqueda de anclas (RF-16)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';

import { anchorAtPoint, anchorForLine, anchorSpan } from './syncAnchors.js';

const a = (file, line, page, xPt, yPt) => ({ file, line, page, xPt, yPt });

/** Documento de una columna: `x` constante, `y` creciente. */
const UNA_COLUMNA = [
  a('main.typ', 1, 1, 56.7, 56.7),
  a('chapters/01.typ', 1, 1, 56.7, 200),
  a('chapters/01.typ', 12, 1, 56.7, 400),
  a('chapters/01.typ', 30, 2, 56.7, 80),
  a('chapters/02.typ', 1, 2, 56.7, 500),
];

describe('anchorAtPoint (render → editor)', () => {
  it('devuelve el ancla anterior más cercana', () => {
    const found = anchorAtPoint(UNA_COLUMNA, { page: 1, xPt: 56.7, yPt: 420 });
    expect(found).toMatchObject({ file: 'chapters/01.typ', line: 12 });
  });

  it('cruza correctamente el límite de página', () => {
    // Un clic arriba de la página 2 cae en el bloque que empieza en esa página,
    // no en el último de la página 1.
    const found = anchorAtPoint(UNA_COLUMNA, { page: 2, xPt: 56.7, yPt: 100 });
    expect(found).toMatchObject({ file: 'chapters/01.typ', line: 30 });
  });

  it('un clic antes de la primera ancla cae a la más cercana', () => {
    // Es el caso del flotante: se dibuja por encima de todo lo anclado.
    const found = anchorAtPoint(UNA_COLUMNA, { page: 1, xPt: 56.7, yPt: 10 });
    expect(found).toMatchObject({ file: 'main.typ', line: 1 });
  });

  it('con la tabla vacía no inventa nada', () => {
    expect(anchorAtPoint([], { page: 1, xPt: 0, yPt: 0 })).toBeNull();
    expect(anchorAtPoint(null, { page: 1, xPt: 0, yPt: 0 })).toBeNull();
  });

  describe('documentos a dos columnas', () => {
    // Medido en el Spike S-2: la segunda columna tiene una `y` MENOR que la
    // primera, así que ordenar por (página, y) desordenaría la tabla.
    const DOS_COLUMNAS = [
      a('cap.typ', 1, 1, 56.7, 56.7),
      a('cap.typ', 10, 1, 56.7, 374.2),
      a('cap.typ', 20, 1, 215.9, 177.8),
      a('cap.typ', 30, 1, 215.9, 457.3),
    ];

    it('un clic en la segunda columna no cae en la primera', () => {
      const found = anchorAtPoint(DOS_COLUMNAS, { page: 1, xPt: 215.9, yPt: 200 });
      expect(found).toMatchObject({ line: 20 });
    });

    it('un clic bajo en la primera columna se queda en la primera', () => {
      const found = anchorAtPoint(DOS_COLUMNAS, { page: 1, xPt: 56.7, yPt: 400 });
      expect(found).toMatchObject({ line: 10 });
    });

    it('la segunda columna resuelve a su último bloque', () => {
      const found = anchorAtPoint(DOS_COLUMNAS, { page: 1, xPt: 215.9, yPt: 600 });
      expect(found).toMatchObject({ line: 30 });
    });
  });
});

describe('anchorForLine (editor → render)', () => {
  it('encuentra el bloque que contiene la línea', () => {
    const found = anchorForLine(UNA_COLUMNA, 'chapters/01.typ', 20);
    expect(found).toMatchObject({ line: 12, page: 1, yPt: 400 });
  });

  it('una línea exacta de ancla devuelve esa ancla', () => {
    expect(anchorForLine(UNA_COLUMNA, 'chapters/01.typ', 12)).toMatchObject({ line: 12 });
  });

  it('una línea anterior al primer bloque cae al primero del fichero', () => {
    expect(anchorForLine(UNA_COLUMNA, 'chapters/01.typ', 0)).toMatchObject({ line: 1 });
  });

  it('no salta a otro fichero aunque esté más cerca en número de línea', () => {
    const found = anchorForLine(UNA_COLUMNA, 'chapters/02.typ', 999);
    expect(found).toMatchObject({ file: 'chapters/02.typ', line: 1 });
  });

  it('un fichero sin anclas no devuelve nada', () => {
    // `estilo.typ` no recibe anclas: su contenido está en modo código.
    expect(anchorForLine(UNA_COLUMNA, 'estilo.typ', 5)).toBeNull();
  });

  it('normaliza separadores de Windows y la barra inicial', () => {
    expect(anchorForLine(UNA_COLUMNA, 'chapters\\01.typ', 20)).toMatchObject({ line: 12 });
    expect(anchorForLine(UNA_COLUMNA, '/chapters/01.typ', 20)).toMatchObject({ line: 12 });
  });

  it('con la tabla vacía no inventa nada', () => {
    expect(anchorForLine([], 'main.typ', 1)).toBeNull();
  });
});

describe('anchorSpan', () => {
  const table = [
    { file: 'a.typ', line: 1, page: 1, xPt: 56, yPt: 100 },
    { file: 'a.typ', line: 5, page: 1, xPt: 56, yPt: 180 },
    { file: 'a.typ', line: 9, page: 2, xPt: 56, yPt: 90 },
    { file: 'a.typ', line: 12, page: 2, xPt: 300, yPt: 60 },
  ];

  it('el bloque llega hasta la ancla siguiente de la misma página y columna', () => {
    expect(anchorSpan(table, table[0])).toBe(80);
  });

  it('el último bloque de una página usa el alto por defecto', () => {
    expect(anchorSpan(table, table[1])).toBe(60);
  });

  it('si la siguiente está en otra columna no se usa su altura', () => {
    // La segunda columna tiene una y MENOR: restarla daría un alto negativo.
    expect(anchorSpan(table, table[2])).toBe(60);
  });

  it('el último de la tabla, o un ancla que no está en ella, usa el alto por defecto', () => {
    expect(anchorSpan(table, table[3])).toBe(60);
    expect(anchorSpan(table, { page: 1, xPt: 0, yPt: 0 })).toBe(60);
    expect(anchorSpan(null, table[0])).toBe(60);
  });
});
