// =============================================================================
// DBV Typst Editor — Tests del asistente de citas enriquecido (RF-35)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { labelForEntry } from './citationPicker.js';

function entry(overrides = {}) {
  return {
    key: 'knuth1984',
    entryType: 'article',
    title: 'The TeXbook',
    authors: ['Knuth, Donald E.'],
    year: 1984,
    duplicate: false,
    missingRequired: false,
    ...overrides,
  };
}

describe('labelForEntry', () => {
  it('muestra clave, título, primer apellido y año', () => {
    expect(labelForEntry(entry())).toBe('knuth1984 — The TeXbook — Knuth, 1984');
  });

  it('degrada limpiamente sin título ni autor, solo la clave', () => {
    expect(
      labelForEntry(entry({ title: null, authors: [], year: null, missingRequired: true }))
    ).toBe('⚠ knuth1984');
  });

  it('marca con ⚠ una entrada duplicada', () => {
    expect(labelForEntry(entry({ duplicate: true }))).toBe('⚠ knuth1984 — The TeXbook — Knuth, 1984');
  });

  it('marca con ⚠ una entrada con campos obligatorios ausentes', () => {
    expect(labelForEntry(entry({ missingRequired: true, title: null }))).toContain('⚠ ');
  });

  it('sin año usa solo el autor en el detalle', () => {
    expect(labelForEntry(entry({ year: null }))).toBe('knuth1984 — The TeXbook — Knuth');
  });
});
