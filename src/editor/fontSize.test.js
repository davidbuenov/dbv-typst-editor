// =============================================================================
// DBV Typst Editor — Test del tamaño de fuente del editor (RF-42)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { clampEditorFontSize, EDITOR_FONT_MAX, EDITOR_FONT_MIN, stepEditorFontSize } from './fontSize.js';

describe('clampEditorFontSize', () => {
  it('deja pasar un valor dentro del rango', () => {
    expect(clampEditorFontSize(16)).toBe(16);
  });

  it('recorta por debajo del mínimo', () => {
    expect(clampEditorFontSize(1)).toBe(EDITOR_FONT_MIN);
  });

  it('recorta por encima del máximo', () => {
    expect(clampEditorFontSize(99)).toBe(EDITOR_FONT_MAX);
  });
});

describe('stepEditorFontSize', () => {
  it('acerca un paso', () => {
    expect(stepEditorFontSize(13, 1)).toBe(14);
  });

  it('aleja un paso', () => {
    expect(stepEditorFontSize(13, -1)).toBe(12);
  });

  it('no baja del mínimo aunque se pida varias veces seguidas', () => {
    expect(stepEditorFontSize(EDITOR_FONT_MIN, -1)).toBe(EDITOR_FONT_MIN);
  });

  it('no sube del máximo aunque se pida varias veces seguidas', () => {
    expect(stepEditorFontSize(EDITOR_FONT_MAX, 1)).toBe(EDITOR_FONT_MAX);
  });

  it('usa solo el signo de la dirección, no su magnitud (rueda vs. teclado, mismo paso)', () => {
    expect(stepEditorFontSize(13, 120)).toBe(14);
    expect(stepEditorFontSize(13, -120)).toBe(12);
  });
});
