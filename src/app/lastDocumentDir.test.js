// =============================================================================
// DBV Typst Editor — Tests de la última carpeta usada (RF-106.3)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { folderOf, getLastDocumentDir, rememberDocumentPath } from './lastDocumentDir.js';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('última carpeta usada', () => {
  it('saca la carpeta de rutas de Windows y de Unix', () => {
    expect(folderOf('C:\\Users\\ana\\Documentos\\carta.typ')).toBe('C:\\Users\\ana\\Documentos');
    expect(folderOf('/home/ana/doc/carta.typ')).toBe('/home/ana/doc');
    expect(folderOf('carta.typ')).toBeNull();
    expect(folderOf('')).toBeNull();
    expect(folderOf(null)).toBeNull();
  });

  it('sin nada recordado no hay carpeta (el sistema usará Documentos)', () => {
    expect(getLastDocumentDir()).toBeNull();
  });

  it('recuerda la carpeta del último documento y la ofrece después', () => {
    rememberDocumentPath('D:\\tesis\\cap1.typ');
    expect(getLastDocumentDir()).toBe('D:\\tesis');
    rememberDocumentPath('D:\\cartas\\a.typ');
    expect(getLastDocumentDir()).toBe('D:\\cartas');
  });

  it('una ruta sin carpeta no borra lo recordado', () => {
    rememberDocumentPath('D:\\tesis\\cap1.typ');
    rememberDocumentPath('suelto.typ');
    expect(getLastDocumentDir()).toBe('D:\\tesis');
  });

  it('sin localStorage no falla: es solo una comodidad', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => rememberDocumentPath('D:\\x\\a.typ')).not.toThrow();
    expect(getLastDocumentDir()).toBeNull();
  });
});
