// =============================================================================
// DBV Typst Editor — Tests del asistente "Nueva entrada bibliográfica"
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { BIB_ENTRY_TYPES, serializeBibEntry, suggestBibKey, validateBibFields } from './bibEntryForm.js';

describe('suggestBibKey', () => {
  it('usa el apellido en formato "Apellido, Nombre" y el año', () => {
    expect(suggestBibKey('Bueno Vallejo, David', '2026')).toBe('buenovallejo2026');
  });

  it('usa la última palabra si el autor viene como "Nombre Apellido"', () => {
    expect(suggestBibKey('David Bueno', '2026')).toBe('bueno2026');
  });

  it('quita acentos y símbolos', () => {
    expect(suggestBibKey('José Martínez', '2025')).toBe('martinez2025');
  });

  it('usa solo el primer autor de una lista "and"', () => {
    expect(suggestBibKey('Bueno, David and Martínez, Ana', '2026')).toBe('bueno2026');
  });

  it('cae a "ref" si no hay autor', () => {
    expect(suggestBibKey('', '2026')).toBe('ref2026');
  });

  it('funciona sin año', () => {
    expect(suggestBibKey('Bueno, David', '')).toBe('bueno');
  });
});

describe('serializeBibEntry', () => {
  it('genera una entrada @article completa', () => {
    const result = serializeBibEntry('article', 'bueno2026', {
      author: 'Bueno, David',
      title: 'Un artículo de ejemplo',
      journal: 'Revista de Ejemplo',
      year: '2026',
      volume: '12',
      pages: '1--15',
    });
    expect(result).toBe(
      '@article{bueno2026,\n' +
        '  author = {Bueno, David},\n' +
        '  title = {Un artículo de ejemplo},\n' +
        '  journal = {Revista de Ejemplo},\n' +
        '  year = {2026},\n' +
        '  volume = {12},\n' +
        '  pages = {1--15}\n' +
        '}\n'
    );
  });

  it('omite los campos opcionales vacíos en vez de escribirlos vacíos', () => {
    const result = serializeBibEntry('article', 'bueno2026', {
      author: 'Bueno, David',
      title: 'Título',
      journal: 'Revista',
      year: '2026',
      volume: '',
      pages: '   ',
    });
    expect(result).not.toContain('volume');
    expect(result).not.toContain('pages');
  });

  it('lanza para un tipo desconocido en vez de generar BibTeX inválido en silencio', () => {
    expect(() => serializeBibEntry('inventado', 'x', {})).toThrow();
  });

  it('cada tipo de BIB_ENTRY_TYPES serializa sin lanzar con todos los campos rellenos', () => {
    for (const type of BIB_ENTRY_TYPES) {
      const values = Object.fromEntries(type.fields.map((field) => [field.key, 'valor']));
      expect(() => serializeBibEntry(type.id, 'clave2026', values)).not.toThrow();
    }
  });
});

describe('validateBibFields', () => {
  it('señala los campos obligatorios vacíos', () => {
    expect(validateBibFields('book', { author: 'Bueno, David' })).toEqual(
      expect.arrayContaining(['title', 'publisher', 'year'])
    );
  });

  it('no señala nada si los obligatorios están rellenos (los opcionales no cuentan)', () => {
    expect(
      validateBibFields('article', {
        author: 'Bueno, David',
        title: 'Título',
        journal: 'Revista',
        year: '2026',
      })
    ).toEqual([]);
  });

  it('"misc" no exige autor, a diferencia del resto de tipos', () => {
    expect(validateBibFields('misc', { title: 'Página web de ejemplo' })).toEqual([]);
  });
});
