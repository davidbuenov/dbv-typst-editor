// =============================================================================
// DBV Typst Editor — Tests del editor: números de línea optativos (RF-63.2)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEditor } from './editor.js';
import { reloadPrefsForTests, setPref } from '../app/prefs.js';

describe('números de línea optativos (RF-63.2)', () => {
  let host;
  let editor;

  beforeEach(() => {
    Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
    Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
    localStorage.clear();
    reloadPrefsForTests();
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    editor?.destroy();
    host.remove();
  });

  const hasLineNumbers = () => Boolean(editor.getView().dom.querySelector('.cm-lineNumbers'));

  it('se muestran por defecto (no cambia el comportamiento de la 0.9.0)', () => {
    editor = createEditor(host);
    editor.setDocument('= Título\nHola', '/p/main.typ');

    expect(hasLineNumbers()).toBe(true);
  });

  it('se respeta la preferencia ya guardada al crear el editor', () => {
    setPref('showLineNumbers', false);

    editor = createEditor(host);
    editor.setDocument('= Título', '/p/main.typ');

    expect(hasLineNumbers()).toBe(false);
  });

  it('se alternan en caliente desde el menú Preferencias, sin perder el cursor', () => {
    editor = createEditor(host);
    editor.setDocument('= Título\nHola mundo', '/p/main.typ');
    const view = editor.getView();
    view.dispatch({ selection: { anchor: 12 } }); // cursor dentro de "Hola mundo"

    setPref('showLineNumbers', false);
    expect(hasLineNumbers()).toBe(false);
    expect(view.state.selection.main.head).toBe(12);

    setPref('showLineNumbers', true);
    expect(hasLineNumbers()).toBe(true);
    expect(view.state.selection.main.head).toBe(12);
  });

  it('un editor destruido no reacciona a cambios de preferencia posteriores', () => {
    editor = createEditor(host);
    editor.setDocument('= Título', '/p/main.typ');
    editor.destroy();

    // No debe lanzar ni intentar despachar sobre una vista ya destruida.
    expect(() => setPref('showLineNumbers', false)).not.toThrow();
    editor = null; // ya destruido: que afterEach no vuelva a llamar destroy().
  });
});
