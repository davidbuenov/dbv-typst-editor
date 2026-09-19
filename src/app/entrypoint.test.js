// =============================================================================
// DBV Typst Editor — Tests del documento principal elegido a mano
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Sin `main.typ` el backend escoge el primer `.typ` alfabético: en `z6-IPbook`
// era `CexsTasks.typ` y no el libro `IP.typ`. La elección del usuario tiene que
// aceptar solo lo que puede ser documento principal y recordarse por proyecto.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  entrypointKey,
  isSafeRelativePath,
  readStoredEntrypoint,
  resolveEntrypoint,
  storeEntrypoint,
} from './entrypoint.js';

const BS = String.fromCharCode(92);
const project = { root: '/home/ana/libro', isSingleFile: false };
const winProject = { root: ['D:', 'libros', 'ip'].join(BS), isSingleFile: false };

describe('resolveEntrypoint', () => {
  it('devuelve la ruta relativa de un .typ del proyecto', () => {
    expect(resolveEntrypoint(project, '/home/ana/libro/IP.typ')).toBe('IP.typ');
    expect(resolveEntrypoint(project, '/home/ana/libro/cap/01.typ')).toBe('cap/01.typ');
  });

  it('acepta rutas de Windows y devuelve la relativa con /', () => {
    const path = ['D:', 'libros', 'ip', 'cap', '01.typ'].join(BS);
    expect(resolveEntrypoint(winProject, path)).toBe('cap/01.typ');
  });

  it('rechaza lo que no es un .typ', () => {
    expect(resolveEntrypoint(project, '/home/ana/libro/refs.bib')).toBeNull();
    expect(resolveEntrypoint(project, '/home/ana/libro/figs/logo.png')).toBeNull();
  });

  it('rechaza un .typ de fuera del proyecto', () => {
    expect(resolveEntrypoint(project, '/home/ana/otro/IP.typ')).toBeNull();
  });

  it('rechaza la raíz del proyecto en sí (ruta relativa vacía)', () => {
    expect(resolveEntrypoint(project, '/home/ana/libro')).toBeNull();
  });

  it('rechaza un .typ suelto: él mismo ES su documento', () => {
    expect(resolveEntrypoint({ ...project, isSingleFile: true }, '/home/ana/libro/IP.typ')).toBeNull();
  });

  it('rechaza sin proyecto o sin ruta', () => {
    expect(resolveEntrypoint(null, '/home/ana/libro/IP.typ')).toBeNull();
    expect(resolveEntrypoint(project, null)).toBeNull();
    expect(resolveEntrypoint(project, undefined)).toBeNull();
  });
});

describe('elección guardada', () => {
  beforeEach(() => localStorage.clear());

  it('se guarda y se lee por proyecto', () => {
    storeEntrypoint('/a', 'IP.typ');
    storeEntrypoint('/b', 'main.typ');

    expect(readStoredEntrypoint('/a')).toBe('IP.typ');
    expect(readStoredEntrypoint('/b')).toBe('main.typ');
    expect(readStoredEntrypoint('/c')).toBeNull();
  });

  it('cambiar la elección anula la anterior', () => {
    storeEntrypoint('/a', 'CexsTasks.typ');
    storeEntrypoint('/a', 'IP.typ');

    expect(readStoredEntrypoint('/a')).toBe('IP.typ');
  });

  it('usa una clave propia por proyecto, distinta de la del alcance', () => {
    expect(entrypointKey('/a')).toBe('dbv-typst-entrypoint:/a');
    expect(entrypointKey('/a')).not.toBe(entrypointKey('/b'));
  });

  it('un almacenamiento que falla no rompe nada', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const spySet = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(readStoredEntrypoint('/a')).toBeNull();
    expect(() => storeEntrypoint('/a', 'IP.typ')).not.toThrow();

    spy.mockRestore();
    spySet.mockRestore();
  });
});

describe('un valor guardado se trata como dato no fiable', () => {
  beforeEach(() => localStorage.clear());

  it('isSafeRelativePath acepta rutas relativas normales', () => {
    for (const value of ['IP.typ', 'cap/01.typ', ['cap', '01.typ'].join(BS)]) {
      expect(isSafeRelativePath(value), value).toBe(true);
    }
  });

  it('isSafeRelativePath rechaza rutas absolutas, con .. y valores no textuales', () => {
    const rejected = [
      '',
      '../fuera.typ',
      'cap/../../fuera.typ',
      ['..', 'fuera.typ'].join(BS),
      '/etc/passwd',
      BS + 'servidor' + BS + 'share',
      'C:' + BS + 'Windows' + BS + 'x.typ',
      'D:/x.typ',
      null,
      undefined,
      42,
    ];
    for (const value of rejected) {
      expect(isSafeRelativePath(value), String(value)).toBe(false);
    }
  });

  it('un nombre que solo CONTIENE dos puntos no se confunde con ..', () => {
    expect(isSafeRelativePath('notas..finales.typ')).toBe(true);
  });

  it('readStoredEntrypoint descarta un valor manipulado en el almacenamiento', () => {
    localStorage.setItem(entrypointKey('/a'), '../../secreto.typ');

    expect(readStoredEntrypoint('/a')).toBeNull();
  });
});
