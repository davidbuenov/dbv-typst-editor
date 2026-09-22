// =============================================================================
// DBV Typst Editor — Tests de la ruta corta y desambiguada (RF-65)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { shortPathLabel } from './pathLabel.js';

describe('shortPathLabel', () => {
  it('un nombre único se muestra sin ningún prefijo', () => {
    const all = ['/p/main.typ', '/p/refs.bib', '/p/figs/portada.png'];
    expect(shortPathLabel('/p/main.typ', all)).toBe('main.typ');
  });

  it('dos ficheros con el mismo nombre se distinguen hasta donde difieren', () => {
    const all = ['/p/a/main.typ', '/p/b/main.typ'];
    expect(shortPathLabel('/p/a/main.typ', all)).toBe('a/main.typ');
    expect(shortPathLabel('/p/b/main.typ', all)).toBe('b/main.typ');
  });

  it('cuando un tramo no basta, amplía uno más', () => {
    const all = ['/p/x/a/main.typ', '/p/y/a/main.typ'];
    expect(shortPathLabel('/p/x/a/main.typ', all)).toBe('x/a/main.typ');
    expect(shortPathLabel('/p/y/a/main.typ', all)).toBe('y/a/main.typ');
  });

  it('funciona igual con rutas de Windows', () => {
    const all = [String.raw`D:\p\a\main.typ`, String.raw`D:\p\b\main.typ`];
    expect(shortPathLabel(String.raw`D:\p\a\main.typ`, all)).toBe('a/main.typ');
  });

  it('da igual que `path` esté o no dentro de `allPaths`', () => {
    const withSelf = ['/p/a/main.typ', '/p/a/main.typ', '/p/b/main.typ'];
    const withoutSelf = ['/p/b/main.typ'];
    expect(shortPathLabel('/p/a/main.typ', withSelf)).toBe('a/main.typ');
    expect(shortPathLabel('/p/a/main.typ', withoutSelf)).toBe('a/main.typ');
  });

  it('tres o más ficheros con el mismo nombre se resuelven todos a la vez', () => {
    const all = ['/p/a/main.typ', '/p/b/main.typ', '/p/c/main.typ'];
    expect(shortPathLabel('/p/a/main.typ', all)).toBe('a/main.typ');
    expect(shortPathLabel('/p/c/main.typ', all)).toBe('c/main.typ');
  });

  it('una lista vacía deja el nombre a secas', () => {
    expect(shortPathLabel('/p/main.typ', [])).toBe('main.typ');
  });
});
