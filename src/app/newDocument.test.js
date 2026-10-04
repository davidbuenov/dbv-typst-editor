// =============================================================================
// DBV Typst Editor — Tests del atajo de «Nuevo .typ vacío» (RF-106.1)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { createNewDocumentFlow, isNewDocumentShortcut } from './newDocument.js';

const event = (over) => ({ key: 'n', ctrlKey: true, metaKey: false, shiftKey: false, altKey: true, ...over });

describe('atajo de Nuevo .typ vacío', () => {
  it('Ctrl+Alt+N lo dispara, con cualquier mayúscula', () => {
    expect(isNewDocumentShortcut(event({}))).toBe(true);
    expect(isNewDocumentShortcut(event({ key: 'N' }))).toBe(true);
  });

  it('no se confunde con otras combinaciones', () => {
    expect(isNewDocumentShortcut(event({ altKey: false }))).toBe(false);
    expect(isNewDocumentShortcut(event({ ctrlKey: false }))).toBe(false);
    expect(isNewDocumentShortcut(event({ shiftKey: true }))).toBe(false);
    expect(isNewDocumentShortcut(event({ key: 'm' }))).toBe(false);
  });

  it('en macOS lo atiende el menú nativo, no el teclado de la página', () => {
    expect(isNewDocumentShortcut(event({ ctrlKey: false, metaKey: true }))).toBe(false);
  });
});

describe('flujo de Nuevo .typ vacío (RF-106)', () => {
  const ok = (value) => ({ ok: true, value });

  function setup({ picked = ok('D:\docs\carta.typ'), created = ok('D:\docs\carta.typ'), lastDir = 'D:\docs' } = {}) {
    const calls = [];
    const deps = {
      pickSaveTarget: vi.fn(async (...args) => {
        calls.push(['pick', ...args]);
        return picked;
      }),
      createEmptyDocument: vi.fn(async (path) => {
        calls.push(['create', path]);
        return created;
      }),
      openPath: vi.fn(async (path) => calls.push(['open', path])),
      getLastDocumentDir: vi.fn(() => lastDir),
      rememberDocumentPath: vi.fn((path) => calls.push(['remember', path])),
      notify: vi.fn(),
      t: (key) => ({ 'action.newDocumentExists': 'ya existe', 'action.newDocumentError': 'no se pudo' })[key] ?? key,
    };
    return { flow: createNewDocumentFlow(deps), deps, calls };
  }

  it('abre el diálogo en la última carpeta, crea el fichero, recuerda su carpeta y lo abre, en este orden', async () => {
    const { flow, calls, deps } = setup();
    await flow();
    expect(calls).toEqual([
      ['pick', 'documento.typ', 'Typst', ['typ'], 'D:\docs'],
      ['create', 'D:\docs\carta.typ'],
      ['remember', 'D:\docs\carta.typ'],
      ['open', 'D:\docs\carta.typ'],
    ]);
    expect(deps.notify).not.toHaveBeenCalled();
  });

  it('usa la ruta final que devuelve el backend (la que lleva la extensión añadida)', async () => {
    const { flow, calls } = setup({ picked: ok('D:\docs\carta'), created: ok('D:\docs\carta.typ') });
    await flow();
    expect(calls.at(-1)).toEqual(['open', 'D:\docs\carta.typ']);
  });

  it('cancelar el diálogo no crea ni abre nada', async () => {
    for (const picked of [ok(null), { ok: false, error: { kind: 'io', message: 'x' } }]) {
      const { flow, deps } = setup({ picked });
      await flow();
      expect(deps.createEmptyDocument).not.toHaveBeenCalled();
      expect(deps.openPath).not.toHaveBeenCalled();
      expect(deps.notify).not.toHaveBeenCalled();
    }
  });

  it('si ya hay un documento con contenido, avisa, no abre nada y no recuerda la carpeta', async () => {
    const { flow, deps } = setup({ created: { ok: false, error: { kind: 'denied', message: 'D:\docs\carta.typ' } } });
    await flow();
    expect(deps.notify).toHaveBeenCalledWith('ya existe', 'error');
    expect(deps.openPath).not.toHaveBeenCalled();
    expect(deps.rememberDocumentPath).not.toHaveBeenCalled();
  });

  it('cualquier otro fallo se muestra con su motivo', async () => {
    const { flow, deps } = setup({ created: { ok: false, error: { kind: 'io', message: 'disco lleno' } } });
    await flow();
    expect(deps.notify).toHaveBeenCalledWith('no se pudo — disco lleno', 'error');
    expect(deps.openPath).not.toHaveBeenCalled();
  });

  it('sin carpeta recordada pasa null (el sistema usará Documentos)', async () => {
    const { flow, calls } = setup({ lastDir: null });
    await flow();
    expect(calls[0][4]).toBeNull();
  });
});
