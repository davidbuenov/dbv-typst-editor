// =============================================================================
// DBV Typst Editor — Test del modelo del asistente de DOT/Graphviz (RF-51)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { diagraphImportLine, hasDiagraphImport, wrapDotForInsert } from './dotModel.js';

describe('wrapDotForInsert', () => {
  it('envuelve el texto DOT en una llamada render', () => {
    expect(wrapDotForInsert('digraph { a -> b }')).toBe('#render("digraph { a -> b }")');
  });

  it('devuelve null con un DOT vacío', () => {
    expect(wrapDotForInsert('')).toBeNull();
    expect(wrapDotForInsert('   ')).toBeNull();
  });

  it('recorta espacios sobrantes', () => {
    expect(wrapDotForInsert('  digraph { a -> b }  ')).toBe('#render("digraph { a -> b }")');
  });

  it('escapa comillas dentro del texto DOT', () => {
    expect(wrapDotForInsert('digraph { a [label="hi"] }')).toBe(
      '#render("digraph { a [label=\\"hi\\"] }")',
    );
  });
});

describe('hasDiagraphImport / diagraphImportLine', () => {
  it('detecta el import ya presente', () => {
    expect(hasDiagraphImport('#import "@preview/diagraph:0.3.7": render')).toBe(true);
  });

  it('no confunde otro paquete', () => {
    expect(hasDiagraphImport('#import "@preview/kantan:0.1.0": *')).toBe(false);
  });

  it('devuelve la línea de import esperada', () => {
    expect(diagraphImportLine()).toBe('#import "@preview/diagraph:0.3.7": render');
  });
});
