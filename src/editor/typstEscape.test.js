// =============================================================================
// DBV Typst Editor — Test del escapado de cadenas Typst
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { escapeTypstContent, escapeTypstString } from './typstEscape.js';

describe('escapeTypstString', () => {
  it('duplica cada backslash', () => {
    expect(escapeTypstString('\\frac{1}{2}')).toBe('\\\\frac{1}{2}');
  });

  it('escapa comillas dobles', () => {
    expect(escapeTypstString('di "hola"')).toBe('di \\"hola\\"');
  });

  it('una cadena sin caracteres especiales no cambia', () => {
    expect(escapeTypstString('Alice')).toBe('Alice');
  });
});

describe('escapeTypstContent', () => {
  it('escapa corchetes', () => {
    expect(escapeTypstContent('Tarea [urgente]')).toBe('Tarea \\[urgente\\]');
  });

  it('escapa la almohadilla', () => {
    expect(escapeTypstContent('Issue #42')).toBe('Issue \\#42');
  });

  it('un texto sin caracteres especiales no cambia', () => {
    expect(escapeTypstContent('David')).toBe('David');
  });
});
