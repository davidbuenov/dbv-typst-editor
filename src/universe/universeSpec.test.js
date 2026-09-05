// =============================================================================
// DBV Typst Editor — Tests de identificadores e importación de Universe
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { CURATED_PACKAGES, CURATED_TEMPLATES } from './curatedCatalog.js';
import { importPackageAction, parseUniverseSpec, specName } from './universeSpec.js';

/** Aplica la transacción y devuelve el documento resultante. */
function applied(doc, spec) {
  const state = EditorState.create({ doc });
  const transaction = importPackageAction(spec)(state);
  if (!transaction) return null;
  return state.update(transaction).state.doc.toString();
}

describe('parseUniverseSpec', () => {
  it('acepta identificadores reales del catálogo curado', () => {
    for (const entry of [...CURATED_TEMPLATES, ...CURATED_PACKAGES]) {
      const parsed = parseUniverseSpec(entry.spec);
      expect(parsed.ok, `${entry.spec} debería ser válido`).toBe(true);
    }
  });

  it('extrae nombre y versión', () => {
    const parsed = parseUniverseSpec('@preview/cetz:0.5.2');
    expect(parsed).toMatchObject({ ok: true, name: 'cetz', version: '0.5.2' });
  });

  it('tolera espacios alrededor', () => {
    expect(parseUniverseSpec('  @preview/cetz:0.5.2  ').ok).toBe(true);
  });

  it('rechaza lo que no es un identificador de Universe', () => {
    const invalidos = [
      '',
      'cetz',
      'preview/cetz:0.5.2',
      '@preview/cetz',
      '@preview/cetz:0.5',
      '@preview/cetz:x.y.z',
      '@local/dbv-tfg:1.0.0',
      '@preview/../etc:1.0.0',
      '@preview/ce tz:1.0.0',
    ];
    for (const entrada of invalidos) {
      expect(parseUniverseSpec(entrada).ok, `debería rechazarse: "${entrada}"`).toBe(false);
    }
  });

  it('specName devuelve el nombre legible', () => {
    expect(specName('@preview/quick-maths:0.2.1')).toBe('quick-maths');
    expect(specName('basura')).toBe('basura');
  });
});

describe('importPackageAction', () => {
  it('inserta el import al principio de un documento sin importaciones', () => {
    expect(applied('= Título\n\nTexto', '@preview/cetz:0.5.2')).toBe(
      '#import "@preview/cetz:0.5.2": *\n= Título\n\nTexto'
    );
  });

  it('lo pone DESPUÉS de las importaciones que ya hay', () => {
    // Si fuera antes o en medio del cuerpo, el paquete quedaría sin definir
    // para todo lo escrito por encima.
    const doc = '#import "@preview/codly:1.3.0": *\n\n= Título';
    expect(applied(doc, '@preview/cetz:0.5.2')).toBe(
      '#import "@preview/codly:1.3.0": *\n#import "@preview/cetz:0.5.2": *\n\n= Título'
    );
  });

  it('no duplica un paquete ya importado', () => {
    const doc = '#import "@preview/cetz:0.5.2": *\n= Título';
    expect(applied(doc, '@preview/cetz:0.5.2')).toBeNull();
  });

  it('funciona sobre un documento vacío', () => {
    expect(applied('', '@preview/cetz:0.5.2')).toBe('#import "@preview/cetz:0.5.2": *\n');
  });

  it('no confunde un #import de mitad de documento con la cabecera', () => {
    const doc = '= Título\n\n#import "@preview/otro:1.0.0": *\n';
    expect(applied(doc, '@preview/cetz:0.5.2')).toBe(
      '#import "@preview/cetz:0.5.2": *\n= Título\n\n#import "@preview/otro:1.0.0": *\n'
    );
  });
});

describe('catálogo curado', () => {
  it('no tiene identificadores repetidos', () => {
    const specs = [...CURATED_TEMPLATES, ...CURATED_PACKAGES].map((entry) => entry.spec);
    expect(new Set(specs).size).toBe(specs.length);
  });

  it('cada entrada está descrita en los dos idiomas y declara licencia', () => {
    for (const entry of [...CURATED_TEMPLATES, ...CURATED_PACKAGES]) {
      expect(entry.title, `${entry.spec}: falta título`).toBeTruthy();
      expect(entry.titleEn, `${entry.spec}: falta título en inglés`).toBeTruthy();
      expect(entry.description, `${entry.spec}: falta descripción`).toBeTruthy();
      expect(entry.descriptionEn, `${entry.spec}: falta descripción en inglés`).toBeTruthy();
      // La licencia se enseña al usuario: es código de terceros y tiene
      // derecho a saber bajo qué condiciones lo instala.
      expect(entry.license, `${entry.spec}: falta licencia`).toBeTruthy();
    }
  });
});
