// =============================================================================
// DBV Typst Editor — Test del modelo del editor de ecuaciones (RF-46)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  buildMitexCall,
  EQUATION_SNIPPETS,
  escapeLatexForTypstString,
  hasMitexImport,
  insertSnippet,
  mitexImportLine,
  wrapEquationForInsert,
} from './equationModel.js';

const snippet = (id) => EQUATION_SNIPPETS.find((entry) => entry.id === id);

describe('insertSnippet', () => {
  it('inserta en la posición del cursor y coloca el cursor con caretAfter', () => {
    const result = insertSnippet('x = ', 4, 4, snippet('sqrt'));
    expect(result.value).toBe('x = sqrt()');
    // "sqrt(" son 5 caracteres: el cursor cae justo dentro de los paréntesis.
    expect(result.selectionStart).toBe(4 + 5);
    expect(result.selectionEnd).toBe(4 + 5);
  });

  it('sustituye la selección en vez de solo insertar en el cursor', () => {
    // Selecciona "vieja" en "x = vieja" y pone una fracción en su lugar.
    const result = insertSnippet('x = vieja', 4, 9, snippet('frac'));
    expect(result.value).toBe('x = ()/()');
  });

  it('con placeholder, selecciona ese texto en vez de solo mover el cursor', () => {
    const result = insertSnippet('', 0, 0, snippet('sum'));
    expect(result.value).toBe('sum_(i=1)^n ');
    const selected = result.value.slice(result.selectionStart, result.selectionEnd);
    expect(selected).toBe('i=1');
  });

  it('un snippet sin parámetros (símbolo suelto) deja el cursor justo después', () => {
    const result = insertSnippet('a + ', 4, 4, snippet('alpha'));
    expect(result.value).toBe('a + alpha');
    expect(result.selectionStart).toBe(result.value.length);
    expect(result.selectionStart).toBe(result.selectionEnd);
  });

  it('cada snippet del catálogo con caretAfter dado deja el cursor dentro del propio texto insertado', () => {
    for (const entry of EQUATION_SNIPPETS) {
      if (entry.caretAfter === undefined) continue;
      const result = insertSnippet('', 0, 0, entry);
      expect(result.selectionStart).toBeGreaterThanOrEqual(0);
      expect(result.selectionStart).toBeLessThanOrEqual(entry.insert.length);
    }
  });
});

describe('wrapEquationForInsert', () => {
  it('envuelve el cuerpo con espacio interior', () => {
    expect(wrapEquationForInsert('x^2 + y^2')).toBe('$ x^2 + y^2 $');
  });

  it('recorta espacio sobrante de los extremos', () => {
    expect(wrapEquationForInsert('  x  ')).toBe('$ x $');
  });

  it('un cuerpo vacío no produce nada que insertar', () => {
    expect(wrapEquationForInsert('')).toBeNull();
    expect(wrapEquationForInsert('   ')).toBeNull();
  });
});

describe('hasMitexImport', () => {
  it('detecta el import ya presente', () => {
    expect(hasMitexImport('#import "@preview/mitex:0.2.7": mi\n\n$ x $')).toBe(true);
  });

  it('no confunde otro paquete con MiTeX', () => {
    expect(hasMitexImport('#import "@preview/cetz:0.5.2"')).toBe(false);
  });

  it('un documento vacío no lo tiene', () => {
    expect(hasMitexImport('')).toBe(false);
  });
});

describe('escapeLatexForTypstString', () => {
  it('duplica cada backslash de LaTeX', () => {
    expect(escapeLatexForTypstString('\\frac{1}{2}')).toBe('\\\\frac{1}{2}');
  });

  it('escapa comillas dobles', () => {
    expect(escapeLatexForTypstString('\\text{"cita"}')).toBe('\\\\text{\\"cita\\"}');
  });

  it('una cadena sin caracteres especiales no cambia', () => {
    expect(escapeLatexForTypstString('x^2 + y^2')).toBe('x^2 + y^2');
  });
});

describe('buildMitexCall', () => {
  it('envuelve el LaTeX escapado en mi(...)', () => {
    expect(buildMitexCall('\\sqrt{x}')).toBe('mi("\\\\sqrt{x}")');
  });
});

describe('mitexImportLine', () => {
  it('devuelve la línea de import de mitex', () => {
    expect(mitexImportLine()).toBe('#import "@preview/mitex:0.2.7": mi');
  });
});
