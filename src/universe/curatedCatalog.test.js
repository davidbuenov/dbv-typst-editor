// =============================================================================
// DBV Typst Editor — Tests del catálogo curado y del filtro de Universe (RF-34)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { filterUniverseIndexEntries, isCuratedPackageName, universeIndexEntryToCard } from './curatedCatalog.js';

describe('isCuratedPackageName', () => {
  it('reconoce un paquete de la whitelist curada', () => {
    expect(isCuratedPackageName('cetz')).toBe(true);
    expect(isCuratedPackageName('modern-cv')).toBe(true);
  });

  it('no marca como curado un paquete fuera de la lista', () => {
    expect(isCuratedPackageName('a2c-nums')).toBe(false);
  });
});

describe('universeIndexEntryToCard', () => {
  it('adapta una entrada cruda del índice a la forma de tarjeta', () => {
    const card = universeIndexEntryToCard({
      name: 'a2c-nums',
      version: '0.0.1',
      description: 'Convert a number to Chinese',
      authors: ['Zhuo Nengwen'],
      license: 'MIT',
    });
    expect(card.spec).toBe('@preview/a2c-nums:0.0.1');
    expect(card.license).toBe('MIT');
    expect(card.verified).toBe(false);
  });

  it('marca verified=true para un paquete de la whitelist curada', () => {
    const card = universeIndexEntryToCard({
      name: 'cetz',
      version: '0.5.2',
      description: 'drawing',
      authors: [],
      license: 'LGPL-3.0-or-later',
    });
    expect(card.verified).toBe(true);
  });

  it('no revienta con una descripción ausente', () => {
    const card = universeIndexEntryToCard({ name: 'sin-descripcion', version: '1.0.0', license: 'MIT' });
    expect(card.description).toBe('');
  });

  // RF-34, hallazgo real (2026-09-12): el catálogo completo mezcla paquetes y
  // plantillas en la MISMA lista de `index.json` — sin propagar `isTemplate`,
  // `universePanel.js` no tenía forma de saber que una entrada como
  // `campanile` (tesis de Berkeley) se crea con `typst init`, no se importa.
  it('propaga isTemplate cuando la entrada trae la clave `template`', () => {
    const card = universeIndexEntryToCard({
      name: 'campanile',
      version: '0.1.0',
      description: "Master's thesis",
      license: 'MIT-0',
      isTemplate: true,
    });
    expect(card.isTemplate).toBe(true);
  });

  it('isTemplate es false por defecto, para un paquete normal', () => {
    const card = universeIndexEntryToCard({ name: 'cetz', version: '0.5.2', license: 'LGPL-3.0-or-later' });
    expect(card.isTemplate).toBe(false);
  });
});

describe('filterUniverseIndexEntries', () => {
  const entries = [
    { name: 'a2c-nums', description: 'Convert a number to Chinese' },
    { name: 'quick-maths', description: 'Maths shorthands' },
    { name: 'unify', description: 'Numbers and units' },
  ];

  it('devuelve vacío con una búsqueda en blanco, sin filtrar todo el catálogo', () => {
    expect(filterUniverseIndexEntries(entries, '')).toEqual([]);
    expect(filterUniverseIndexEntries(entries, '   ')).toEqual([]);
  });

  it('filtra por nombre sin distinguir mayúsculas', () => {
    expect(filterUniverseIndexEntries(entries, 'QUICK')).toEqual([entries[1]]);
  });

  it('filtra también por descripción', () => {
    expect(filterUniverseIndexEntries(entries, 'chinese')).toEqual([entries[0]]);
  });

  it('sin coincidencias devuelve un array vacío, no undefined', () => {
    expect(filterUniverseIndexEntries(entries, 'no-existe-nada-parecido')).toEqual([]);
  });
});
