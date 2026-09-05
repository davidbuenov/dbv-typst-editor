// =============================================================================
// DBV Typst Editor - Tests de las utilidades de ruta del espacio de trabajo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops - https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// `isTypstPath` es la funcion que decide que se compila. Uno de los tres fallos
// que rompieron la aplicacion en manos del usuario fue precisamente la vista
// previa intentando compilar `refs.bib`: de ahi que aqui se prueben los ficheros
// acompanantes uno a uno y no solo el caso feliz.

import { describe, expect, it } from 'vitest';
import { baseName, isTypstPath, joinPath } from './workspace.js';

describe('joinPath', () => {
  it('usa la barra normal en rutas POSIX', () => {
    expect(joinPath('/home/david/tesis', 'main.typ')).toBe('/home/david/tesis/main.typ');
  });

  it('conserva la barra invertida en rutas de Windows', () => {
    expect(joinPath('D:\\Proyectos\\tesis', 'main.typ')).toBe('D:\\Proyectos\\tesis\\main.typ');
  });

  it('prefiere la barra normal si la ruta mezcla ambos separadores', () => {
    expect(joinPath('D:\\Proyectos/tesis', 'main.typ')).toBe('D:\\Proyectos/tesis/main.typ');
  });

  it('no duplica el separador si la carpeta ya termina en uno', () => {
    expect(joinPath('/home/david/', 'main.typ')).toBe('/home/david/main.typ');
    expect(joinPath('D:\\Proyectos\\', 'main.typ')).toBe('D:\\Proyectos\\main.typ');
  });

  it('devuelve el nombre tal cual si no hay carpeta', () => {
    expect(joinPath('', 'main.typ')).toBe('main.typ');
    expect(joinPath(undefined, 'main.typ')).toBe('main.typ');
  });
});

describe('isTypstPath', () => {
  it('acepta documentos .typ en cualquier caja', () => {
    expect(isTypstPath('main.typ')).toBe(true);
    expect(isTypstPath('MAIN.TYP')).toBe(true);
    expect(isTypstPath('D:\\tesis\\chapters\\01.typ')).toBe(true);
  });

  it('rechaza los ficheros acompanantes de un proyecto Typst', () => {
    // El caso real que rompio la vista previa: `refs.bib` no es compilable.
    expect(isTypstPath('refs.bib')).toBe(false);
    expect(isTypstPath('images/portada.png')).toBe(false);
    expect(isTypstPath('typst.toml')).toBe(false);
    expect(isTypstPath('README.md')).toBe(false);
  });

  it('rechaza rutas que solo contienen ".typ" sin ser extension', () => {
    expect(isTypstPath('mi.typo')).toBe(false);
    expect(isTypstPath('carpeta.typ/notas.txt')).toBe(false);
  });

  it('no revienta con ruta ausente', () => {
    expect(isTypstPath(null)).toBe(false);
    expect(isTypstPath(undefined)).toBe(false);
  });
});

describe('baseName', () => {
  it('extrae el nombre con cualquiera de los dos separadores', () => {
    expect(baseName('/home/david/tesis/main.typ')).toBe('main.typ');
    expect(baseName('D:\\Proyectos\\tesis\\main.typ')).toBe('main.typ');
  });

  it('devuelve la ruta entera si no hay separador', () => {
    expect(baseName('main.typ')).toBe('main.typ');
  });

  it('devuelve cadena vacia si la ruta termina en separador', () => {
    expect(baseName('/home/david/')).toBe('');
  });
});
