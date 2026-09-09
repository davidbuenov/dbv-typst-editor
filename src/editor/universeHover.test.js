// =============================================================================
// DBV Typst Editor — Tests del hover enriquecido de Typst Universe
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { findUniverseSpecInLine } from './universeHover.js';

describe('universeHover', () => {
  it('detecta un identificador de Universe en una línea con #import', () => {
    const line = '#import "@preview/charged-ieee:0.1.4": *';
    const match = findUniverseSpecInLine(line, 15);
    expect(match).not.toBeNull();
    expect(match.spec).toBe('@preview/charged-ieee:0.1.4');
  });

  it('no detecta nada si la posición del cursor está fuera del spec', () => {
    const line = '#import "@preview/charged-ieee:0.1.4": *';
    const match = findUniverseSpecInLine(line, 2); // En "#i"
    expect(match).toBeNull();
  });

  it('detecta el spec correcto cuando hay múltiples identificadores o texto', () => {
    const line = 'Mira @preview/ilm:2.1.1 y también @preview/cetz:0.5.2';
    const matchIlm = findUniverseSpecInLine(line, 10);
    expect(matchIlm?.spec).toBe('@preview/ilm:2.1.1');

    const matchCetz = findUniverseSpecInLine(line, 40);
    expect(matchCetz?.spec).toBe('@preview/cetz:0.5.2');
  });

  it('ignora imports locales o rutas normales', () => {
    const line = '#import "@local/dbv-tfg:1.0.0": *';
    const match = findUniverseSpecInLine(line, 15);
    expect(match).toBeNull();
  });
});
