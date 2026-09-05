// =============================================================================
// DBV Typst Editor — Tests del contenido de la ayuda
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El fallo probable de un fichero bilingüe no es que reviente: es que alguien
// añada una sección y traduzca solo la mitad. Eso no da error en ninguna parte
// — el panel simplemente cae al castellano — así que se comprueba aquí.

import { describe, expect, it } from 'vitest';
import { HELP_SECTIONS } from './helpContent.js';

/** Recorre cada bloque de cada sección con su ruta, para errores legibles. */
function eachBlock(callback) {
  for (const section of HELP_SECTIONS) {
    section.blocks.forEach((block, index) => callback(block, `${section.id}[${index}]`));
  }
}

describe('HELP_SECTIONS', () => {
  it('cada sección tiene id único y título en los dos idiomas', () => {
    const ids = HELP_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size, `ids duplicados en ${ids}`).toBe(ids.length);

    for (const section of HELP_SECTIONS) {
      expect(section.id, 'sección sin id').toBeTruthy();
      expect(section.title.es, `${section.id}: falta el título en español`).toBeTruthy();
      expect(section.title.en, `${section.id}: falta el título en inglés`).toBeTruthy();
    }
  });

  it('todo bloque de texto está en los dos idiomas', () => {
    eachBlock((block, path) => {
      if (block.list || block.shortcuts) return;
      expect(block.es, `${path}: párrafo sin español`).toBeTruthy();
      expect(block.en, `${path}: párrafo sin inglés`).toBeTruthy();
    });
  });

  it('las listas tienen el mismo número de puntos en los dos idiomas', () => {
    eachBlock((block, path) => {
      if (!block.list) return;
      expect(Array.isArray(block.list.es), `${path}: lista sin español`).toBe(true);
      expect(Array.isArray(block.list.en), `${path}: lista sin inglés`).toBe(true);
      // Si no coinciden, una de las dos versiones ha perdido información.
      expect(block.list.en.length, `${path}: la lista pierde puntos al traducirse`).toBe(block.list.es.length);
      for (const item of [...block.list.es, ...block.list.en]) {
        expect(item.trim(), `${path}: punto de lista vacío`).toBeTruthy();
      }
    });
  });

  it('cada atajo tiene combinación y descripción bilingüe', () => {
    eachBlock((block, path) => {
      if (!block.shortcuts) return;
      for (const [combo, description] of block.shortcuts) {
        expect(combo, `${path}: atajo sin combinación de teclas`).toBeTruthy();
        expect(description.es, `${path}: atajo "${combo}" sin descripción en español`).toBeTruthy();
        expect(description.en, `${path}: atajo "${combo}" sin descripción en inglés`).toBeTruthy();
      }
    });
  });

  it('cubre las funcionalidades principales del producto', () => {
    // Ancla la ayuda al producto: si se añade una función grande y no se
    // documenta, o se retira una sección, este test lo señala.
    const ids = HELP_SECTIONS.map((section) => section.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'inicio',
        'paneles',
        'editor',
        'asistentes',
        'vista-previa',
        'guardar',
        'fuentes',
        'paquetes',
        'terminal',
        'apariencia',
      ])
    );
  });
});
