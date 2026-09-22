// =============================================================================
// DBV Typst Editor — Tests del resaltado de BibTeX (RF-62)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { StringStream } from '@codemirror/language';
import { describe, expect, it } from 'vitest';
import { bibtexLanguageDescription, bibtexStreamParser } from './bibtexLanguage.js';

/**
 * Tokeniza un texto de varias líneas con el `StreamParser` de BibTeX,
 * arrastrando el mismo `state` de una línea a la siguiente — igual que hace
 * CodeMirror al recorrer el documento real. Sirve para comprobar un valor
 * multilínea sin montar un editor completo.
 * @param {string} text
 * @returns {Array<{text: string, tag: string|null}>}
 */
function tokenize(text) {
  const parser = bibtexStreamParser();
  const state = parser.startState(2);
  const tokens = [];
  for (const line of text.split('\n')) {
    const stream = new StringStream(line, 4, 2);
    while (!stream.eol()) {
      stream.start = stream.pos;
      const tag = parser.token(stream, state);
      if (stream.pos === stream.start) stream.next(); // a salvo de un token vacío
      tokens.push({ text: stream.current(), tag });
    }
  }
  return tokens;
}

describe('bibtexStreamParser', () => {
  it('reconoce el tipo de entrada, la clave de cita y los campos de un @book', () => {
    const tokens = tokenize('@book{savitch2023,\n  author = {Savitch, Walter},\n  year = {2023}\n}');

    expect(tokens.find((t) => t.text === '@book')?.tag).toBe('keyword');
    expect(tokens.find((t) => t.text === 'savitch2023')?.tag).toBe('atom');
    expect(tokens.find((t) => t.text === 'author')?.tag).toBe('propertyName');
    const stringTokens = tokens.filter((t) => t.tag === 'string').map((t) => t.text);
    expect(stringTokens.some((text) => text.includes('Savitch, Walter'))).toBe(true);
    expect(stringTokens.some((text) => text.includes('2023'))).toBe(true);
    // La coma que separa la clave de cita del primer campo, y las que separan
    // campos entre sí, no llevan color (no son parte de ningún valor).
    expect(tokens.filter((t) => t.text === ',').every((t) => t.tag === null)).toBe(true);
  });

  it('un valor con llaves anidadas y repartido en varias líneas se colorea entero como cadena', () => {
    // El caso real que motivó el requisito: `IP.bib` del usuario, con un
    // valor cuya llave interna (`{C++}`) cae en la línea siguiente a la de
    // apertura del valor.
    const tokens = tokenize(
      '@book{deitel2016,\n  title = {Problem Solving with\n{C++}. Best choice}\n}'
    );

    expect(tokens.find((t) => t.text === 'title')?.tag).toBe('propertyName');

    // Todo lo que hay entre la llave de apertura del valor y su cierre real
    // sale con tag 'string' — incluida la llave interna `{C++}`, que NO se
    // cuela como un token de otro tipo (keyword, propertyName…).
    const stringTokens = tokens.filter((t) => t.tag === 'string');
    const joined = stringTokens.map((t) => t.text).join('');
    expect(joined).toContain('Problem Solving with');
    expect(joined).toContain('{C++}');
    expect(joined).toContain('Best choice');
    expect(joined.endsWith('}')).toBe(true); // se lleva el cierre del valor.

    // Tras el valor, la entrada se cierra con normalidad: el `}` final de la
    // ÚLTIMA línea (el de la entrada, no el del valor) no lleva tag.
    expect(tokens.at(-1)).toEqual({ text: '}', tag: null });
  });

  it('reconoce comentarios de línea con % y %% (convención de BibDesk)', () => {
    const tokens = tokenize('%% Creado con BibDesk\n% otra nota\n@misc{x, note = {y}}');

    expect(tokens.find((t) => t.text.startsWith('%%'))?.tag).toBe('comment');
    expect(tokens.find((t) => t.text.startsWith('% otra'))?.tag).toBe('comment');
    expect(tokens.find((t) => t.text === '@misc')?.tag).toBe('keyword');
  });

  it('un valor numérico sin llaves ni comillas se marca como número', () => {
    const tokens = tokenize('@book{x, year = 2023}');

    expect(tokens.find((t) => t.text === '2023')?.tag).toBe('number');
  });

  it('tokeniza un fichero de 5.000 entradas en un tiempo acotado (R-B1)', () => {
    const entries = Array.from(
      { length: 5000 },
      (_, i) => `@book{ref${i},\n  author = {Autor, Nombre ${i}},\n  title = {Título con {énfasis} y llaves},\n  year = {${2000 + (i % 25)}}\n}`
    ).join('\n');

    const start = Date.now();
    const tokens = tokenize(entries);
    const elapsedMs = Date.now() - start;

    expect(tokens.length).toBeGreaterThan(5000 * 4);
    expect(elapsedMs).toBeLessThan(2000);
  });
});

describe('bibtexLanguageDescription', () => {
  it('se anuncia como BibTeX y carga sin red (va empaquetado)', async () => {
    expect(bibtexLanguageDescription.name).toBe('BibTeX');

    const support = await bibtexLanguageDescription.load();

    expect(support.language.name).toBe('bibtex');
  });
});
