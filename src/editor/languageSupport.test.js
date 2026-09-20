// =============================================================================
// DBV Typst Editor — Tests del lenguaje del fichero abierto (RF-60)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { language as languageFacet } from '@codemirror/language';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEditor } from './editor.js';
import { detectLanguage, loadLanguageExtension } from './languageSupport.js';

describe('detectLanguage', () => {
  it.each([
    ['C:\\p\\src\\main.cpp', 'C++'],
    ['/p/Main.java', 'Java'],
    ['/p/script.py', 'Python'],
    ['/p/datos.json', 'JSON'],
    ['/p/estilo.css', 'CSS'],
  ])('%s se reconoce como código (%s)', (path, name) => {
    const language = detectLanguage(path);

    expect(language.kind).toBe('code');
    expect(language.name).toBe(name);
  });

  it('un .typ es Typst y no busca paquete de lenguaje', () => {
    expect(detectLanguage('/p/main.typ')).toMatchObject({ kind: 'typst', name: 'Typst', description: null });
  });

  it('una extensión desconocida se edita como texto plano', () => {
    expect(detectLanguage('/p/notas.zzz')).toMatchObject({ kind: 'text', description: null });
    expect(detectLanguage(null)).toMatchObject({ kind: 'text' });
  });
});

describe('loadLanguageExtension', () => {
  it('carga el paquete de un lenguaje conocido', async () => {
    const extension = await loadLanguageExtension(detectLanguage('/p/a.py'));

    expect(extension).toBeTruthy();
  });

  it('sin lenguaje no hay nada que cargar', async () => {
    expect(await loadLanguageExtension(detectLanguage('/p/a.zzz'))).toBeNull();
  });

  it('un fallo de carga no lanza: se edita sin resaltado', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = { name: 'X', description: { load: () => Promise.reject(new Error('sin paquete')) } };

    expect(await loadLanguageExtension(broken)).toBeNull();
    warn.mockRestore();
  });
});

describe('el editor aplica el lenguaje del fichero', () => {
  let host;
  let editor;

  beforeEach(() => {
    Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
    Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
    host = document.createElement('div');
    document.body.append(host);
    editor = createEditor(host);
  });

  afterEach(() => host.remove());

  const languageName = () => editor.getView().state.facet(languageFacet)?.name ?? null;

  it('un .py se resalta como Python cuando llega su paquete', async () => {
    editor.setDocument('def f():\n    return 1\n', '/p/a.py');

    await vi.waitFor(() => expect(languageName()).toBe('python'));
  });

  it('volver a un .typ recupera el lenguaje de Typst', async () => {
    editor.setDocument('x = 1', '/p/a.py');
    await vi.waitFor(() => expect(languageName()).toBe('python'));

    editor.setDocument('= Título', '/p/main.typ');

    expect(languageName()).not.toBe('python');
  });

  it('un paquete que llega tarde no pisa al fichero que se abrió después', async () => {
    editor.setDocument('x = 1', '/p/a.py');
    editor.setDocument('= Título', '/p/main.typ');

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(languageName()).not.toBe('python');
  });

  it('un fichero de texto plano no arrastra el lenguaje anterior', async () => {
    editor.setDocument('x = 1', '/p/a.py');
    await vi.waitFor(() => expect(languageName()).toBe('python'));

    editor.setDocument('hola', '/p/notas.zzz');

    expect(languageName()).toBeNull();
  });
});
