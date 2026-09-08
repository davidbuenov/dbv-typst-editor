// =============================================================================
// DBV Typst Editor — Tests del objetivo de compilación (RF-14)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';

import { buildCompileTarget, hasRootDocument } from './compileTarget.js';

const PROYECTO = { root: '/proy', entrypoint: 'main.typ', isSingleFile: false };
const CAPITULO = '/proy/chapters/01.typ';

const base = (overrides = {}) => ({
  project: PROYECTO,
  previewDocument: CAPITULO,
  dirtyPath: null,
  dirtyContent: null,
  scope: 'document',
  ...overrides,
});

describe('buildCompileTarget', () => {
  it('compila el documento raíz aunque el editor esté en un capítulo', () => {
    // El caso que motivó RF-14: sin esto, el capítulo se compila suelto y se
    // queda sin bibliografía, sin numeración y sin referencias cruzadas.
    expect(buildCompileTarget(base()).document).toBe('/proy/main.typ');
  });

  it('compila el fichero abierto en el alcance "solo este fichero"', () => {
    expect(buildCompileTarget(base({ scope: 'file' })).document).toBe(CAPITULO);
  });

  it('un `.typ` suelto es siempre su propio documento', () => {
    // Su "entrypoint" es él mismo y su raíz la carpeta que lo contiene (RF-02b):
    // no hay un documento raíz distinto al que saltar.
    const project = { root: '/escritorio', entrypoint: 'notas.typ', isSingleFile: true };
    const target = buildCompileTarget(base({ project, previewDocument: '/escritorio/notas.typ' }));

    expect(target.document).toBe('/escritorio/notas.typ');
    expect(target.singleFile).toBe(true);
  });

  it('sin entrypoint no hay documento raíz al que ir', () => {
    const project = { root: '/proy', entrypoint: null, isSingleFile: false };
    expect(buildCompileTarget(base({ project })).document).toBe(CAPITULO);
  });

  it('lleva el fichero sucio aunque NO sea el que se compila', () => {
    // La razón de ser de la raíz sombra: el capítulo sin guardar tiene que
    // llegar al `#include` de `main.typ`.
    const target = buildCompileTarget(
      base({ dirtyPath: CAPITULO, dirtyContent: '= Sin guardar' }),
    );

    expect(target.document).toBe('/proy/main.typ');
    expect(target.dirtyPath).toBe(CAPITULO);
    expect(target.dirtyContent).toBe('= Sin guardar');
  });

  it('acepta un fichero acompañante sucio, como un `.bib`', () => {
    const target = buildCompileTarget(
      base({ dirtyPath: '/proy/refs.bib', dirtyContent: '@book{a,title={A}}' }),
    );

    expect(target.dirtyPath).toBe('/proy/refs.bib');
  });

  it('sin cambios sin guardar no manda contenido', () => {
    const target = buildCompileTarget(base());
    expect(target.dirtyPath).toBeNull();
    expect(target.dirtyContent).toBeNull();
  });

  it('un fichero sucio vacío se manda como cadena vacía, no como null', () => {
    // Vaciar el documento entero es una edición legítima; mandarlo como `null`
    // haría que se compilara el contenido de disco y el usuario vería su texto
    // borrado seguir apareciendo.
    const target = buildCompileTarget(base({ dirtyPath: CAPITULO, dirtyContent: '' }));
    expect(target.dirtyContent).toBe('');
  });

  it('sin proyecto o sin documento no hay nada que compilar', () => {
    expect(buildCompileTarget(base({ project: null }))).toBeNull();
    expect(buildCompileTarget(base({ previewDocument: null }))).toBeNull();
  });

  it('la raíz es siempre la del proyecto, no la del documento objetivo', () => {
    expect(buildCompileTarget(base()).root).toBe('/proy');
    expect(buildCompileTarget(base({ scope: 'file' })).root).toBe('/proy');
  });
});

describe('hasRootDocument', () => {
  it('es cierto en una carpeta de proyecto con entrypoint', () => {
    expect(hasRootDocument(PROYECTO)).toBe(true);
  });

  it('es falso para un `.typ` suelto y sin proyecto', () => {
    expect(hasRootDocument({ root: '/x', entrypoint: 'a.typ', isSingleFile: true })).toBe(false);
    expect(hasRootDocument({ root: '/x', entrypoint: null, isSingleFile: false })).toBe(false);
    expect(hasRootDocument(null)).toBe(false);
  });
});
