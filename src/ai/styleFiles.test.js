// =============================================================================
// DBV Typst Editor — Tests de los ficheros de estilo (RF-105)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { countStyleRules, detectStyleFiles, importedFiles, isStyleFileName, looksLikeStyleFile, separationChecks } from './styleFiles.js';

const STYLE = '#let estilo(doc) = {\n  set text(font: "Libertinus Serif", size: 12pt)\n  set page(margin: 3cm)\n  doc\n}\n';
const MAIN = '#import "estilos.typ": estilo\n#show: estilo\n\n= Título\n\nTexto.\n';

describe('contar reglas de estilo', () => {
  it('cuenta #set y #show al principio de línea y set/show con sangría dentro de un bloque', () => {
    expect(countStyleRules('#set text(size: 12pt)\n#show heading: set text(blue)\n= Título\n')).toBe(2);
    expect(countStyleRules(STYLE)).toBe(2);
    expect(countStyleRules('  #set par(justify: true)\n')).toBe(1);
  });

  it('aplicar la plantilla (#show: estilo) no es una regla de aspecto', () => {
    expect(countStyleRules(MAIN)).toBe(0);
    expect(countStyleRules('#show: conf.with(title: [Hola])\n')).toBe(0);
    expect(countStyleRules('#show: it => it\n#show heading: set text(red)\n')).toBe(1);
  });

  it('no confunde prosa con reglas', () => {
    expect(countStyleRules('= Introducción\n\nset de datos, show business y #strong[set]\nUn #emph[show] más.\n')).toBe(0);
    expect(countStyleRules('')).toBe(0);
    expect(countStyleRules(null)).toBe(0);
  });
});

describe('nombres y referencias', () => {
  it('reconoce los nombres habituales de un fichero de estilo, también en subcarpetas', () => {
    for (const name of ['estilos.typ', 'estilo.typ', 'style.typ', 'styles.typ', 'template.typ', 'config.typ', 'conf.typ', 'tema.typ', 'lib/ESTILOS.typ']) expect(isStyleFileName(name), name).toBe(true);
    for (const name of ['main.typ', 'cap1.typ', 'estilos.txt', 'mi-estilos.typ', 'estilosx.typ']) expect(isStyleFileName(name), name).toBe(false);
  });

  it('saca los ficheros que el principal importa o incluye', () => {
    expect(importedFiles('#import "estilos.typ": estilo\n#include "./cap1.typ"\n#import "@preview/cetz:0.3.1": canvas\n')).toEqual(['estilos.typ', 'cap1.typ']);
    expect(importedFiles('')).toEqual([]);
  });

  it('un fichero es de estilo si solo tiene reglas y funciones', () => {
    expect(looksLikeStyleFile(STYLE)).toBe(true);
    expect(looksLikeStyleFile('// Estilos\n#set text(size: 11pt)\n#show heading: it => it\n')).toBe(true);
    expect(looksLikeStyleFile(MAIN)).toBe(false);
    expect(looksLikeStyleFile('= Capítulo\n\nTexto con #set dentro.\n')).toBe(false);
    expect(looksLikeStyleFile('')).toBe(false);
    expect(looksLikeStyleFile('#import "a.typ"\n')).toBe(false);
  });
});

describe('detectar los ficheros de estilo de un proyecto', () => {
  it('por el nombre', () => {
    expect(detectStyleFiles({ files: ['main.typ', 'estilos.typ', 'cap1.typ'] })).toEqual(['estilos.typ']);
  });

  it('por lo que el principal importa, si solo tiene reglas y funciones', () => {
    const files = ['main.typ', 'apariencia.typ', 'cap1.typ'];
    const texts = { 'apariencia.typ': STYLE, 'cap1.typ': '= Uno\n\nTexto.\n' };
    const entrypointText = '#import "apariencia.typ": estilo\n#show: estilo\n#include "cap1.typ"\n';
    expect(detectStyleFiles({ files, entrypointText, texts })).toEqual(['apariencia.typ']);
  });

  it('sin el texto del fichero no se afirma nada de lo que no se llama como estilo', () => {
    expect(detectStyleFiles({ files: ['main.typ', 'apariencia.typ'], entrypointText: '#import "apariencia.typ": e\n', texts: {} })).toEqual([]);
  });

  it('un proyecto sin ficheros de estilo da una lista vacía', () => {
    expect(detectStyleFiles({ files: ['main.typ', 'cap1.typ'] })).toEqual([]);
  });
});

describe('separación en un cambio (métrica del eval, RF-105.7)', () => {
  const before = { 'main.typ': '= Título\n\nTexto.\n' };

  it('bien: el aspecto va a un fichero nuevo y el principal solo lo importa', () => {
    const after = { 'main.typ': MAIN, 'estilos.typ': STYLE };
    expect(separationChecks({ before, after })).toEqual({ contentKept: true, styleChanged: true });
  });

  it('mal: la IA mete las reglas en el principal', () => {
    const after = { 'main.typ': '#set text(size: 12pt)\n#set page(margin: 3cm)\n= Título\n\nTexto.\n' };
    expect(separationChecks({ before, after })).toEqual({ contentKept: false, styleChanged: false });
  });

  it('bien en un proyecto con estilo: solo cambia el fichero de estilo', () => {
    const start = { 'main.typ': MAIN, 'estilos.typ': STYLE };
    const after = { 'main.typ': MAIN, 'estilos.typ': `${STYLE}  set par(justify: true)\n` };
    expect(separationChecks({ before: start, after })).toEqual({ contentKept: true, styleChanged: true });
  });

  it('bien: editar un valor que ya existe (2cm → 3cm) cambia el fichero de estilo aunque no gane reglas', () => {
    const start = { 'main.typ': MAIN, 'estilos.typ': STYLE.replace('3cm', '2cm') };
    expect(separationChecks({ before: start, after: { ...start, 'estilos.typ': STYLE } })).toEqual({ contentKept: true, styleChanged: true });
  });

  it('un cambio solo de contenido no gana ni pierde reglas', () => {
    const start = { 'main.typ': MAIN, 'estilos.typ': STYLE };
    const after = { ...start, 'main.typ': `${MAIN}\nOtro párrafo.\n` };
    expect(separationChecks({ before: start, after })).toEqual({ contentKept: true, styleChanged: false });
  });

  it('los ficheros de contenido son configurables', () => {
    const start = { 'main.typ': MAIN, 'cap1.typ': '= Uno\n' };
    const after = { ...start, 'cap1.typ': '#set text(red)\n= Uno\n' };
    expect(separationChecks({ before: start, after, contentFiles: ['main.typ', 'cap1.typ'] }).contentKept).toBe(false);
    expect(separationChecks({ before: start, after, contentFiles: ['main.typ'] }).contentKept).toBe(true);
  });
});
