// =============================================================================
// DBV Typst Editor — Tests de los modos de escritura
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { WRITING_MODES, getWritingMode, setWritingMode } from './writingMode.js';

describe('setWritingMode / getWritingMode', () => {
  beforeEach(() => {
    localStorage.clear();
    setWritingMode('edicion', document.createElement('div'));
  });

  it('fija data-mode en el elemento dado', () => {
    const el = document.createElement('div');
    setWritingMode('dividido', el);
    expect(el.dataset.mode).toBe('dividido');
    expect(getWritingMode()).toBe('dividido');
  });

  it('ignora un modo desconocido en vez de dejar el estado a medias', () => {
    const el = document.createElement('div');
    setWritingMode('modo-inventado', el);
    expect(getWritingMode()).toBe('edicion');
    expect(el.dataset.mode).toBeUndefined();
  });

  it('persiste el modo en localStorage', () => {
    setWritingMode('lectura', document.createElement('div'));
    expect(localStorage.getItem('dbv-typst-writing-mode')).toBe('lectura');
  });

  it('los cuatro modos del diseño (§7.9) están todos en WRITING_MODES', () => {
    expect(WRITING_MODES).toEqual(['edicion', 'escritura', 'dividido', 'lectura']);
  });
});
