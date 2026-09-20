// =============================================================================
// DBV Typst Editor — Tests del menú contextual del editor (RF-58)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMenuItems, createEditorContextMenu, isGoToPreviewShortcut } from './editorContextMenu.js';

const labels = (key) => key;

describe('buildMenuItems', () => {
  const enabled = (context) => Object.fromEntries(buildMenuItems(context).map((i) => [i.id, i.enabled]));

  it('sin selección no se puede cortar ni copiar, pero sí pegar y seleccionar todo', () => {
    expect(enabled({ hasSelection: false, canGoToPreview: true })).toEqual({
      goToPreview: true,
      cut: false,
      copy: false,
      paste: true,
      selectAll: true,
    });
  });

  it('con selección se activan cortar y copiar', () => {
    expect(enabled({ hasSelection: true, canGoToPreview: true })).toMatchObject({ cut: true, copy: true });
  });

  it('en solo lectura no se corta ni se pega, pero se puede copiar', () => {
    expect(enabled({ hasSelection: true, canGoToPreview: true, readOnly: true })).toMatchObject({
      cut: false,
      copy: true,
      paste: false,
    });
  });

  it('fuera de un documento con vista previa, "Ir a la vista previa" queda desactivado', () => {
    expect(enabled({ hasSelection: false, canGoToPreview: false }).goToPreview).toBe(false);
  });

  it('"Ir a la vista previa" va primero y separado del portapapeles', () => {
    const [first] = buildMenuItems({ hasSelection: false, canGoToPreview: true });

    expect(first).toMatchObject({ id: 'goToPreview', separatorAfter: true });
  });
});

describe('isGoToPreviewShortcut', () => {
  it('Ctrl+Alt+P y Cmd+Alt+P sí; con Mayús o sin Alt, no', () => {
    expect(isGoToPreviewShortcut({ ctrlKey: true, altKey: true, code: 'KeyP' })).toBe(true);
    expect(isGoToPreviewShortcut({ metaKey: true, altKey: true, code: 'KeyP' })).toBe(true);
    expect(isGoToPreviewShortcut({ ctrlKey: true, altKey: true, shiftKey: true, code: 'KeyP' })).toBe(false);
    expect(isGoToPreviewShortcut({ ctrlKey: true, code: 'KeyP' })).toBe(false);
  });
});

describe('createEditorContextMenu', () => {
  let host;
  let view;
  let onGoToPreview;
  let notify;
  let menu;
  let canGo;

  const items = () => [...document.querySelectorAll('.editor-context-menu .menu-item')];
  const item = (id) => document.querySelector(`.editor-context-menu [data-action="${id}"]`);

  beforeEach(() => {
    // jsdom no implementa la geometría de `Range`, que CodeMirror usa al medir.
    Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
    Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
    host = document.createElement('div');
    document.body.append(host);
    view = new EditorView({ parent: host, state: EditorState.create({ doc: 'hola mundo' }) });
    onGoToPreview = vi.fn();
    notify = vi.fn();
    canGo = true;
    menu = createEditorContextMenu({
      hostEl: host,
      getView: () => view,
      canGoToPreview: () => canGo,
      onGoToPreview,
      notify,
      t: labels,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(), readText: vi.fn().mockResolvedValue('PEGADO') },
    });
  });

  afterEach(() => {
    menu.close();
    view.destroy();
    host.remove();
  });

  const rightClick = () =>
    host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  const key = (init) =>
    host.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

  it('el botón derecho abre el menú y evita el del sistema', () => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    host.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(items().map((i) => i.dataset.action)).toEqual(['goToPreview', 'cut', 'copy', 'paste', 'selectAll']);
  });

  it('"Ir a la vista previa" llama a la acción y cierra el menú', () => {
    rightClick();
    item('goToPreview').click();

    expect(onGoToPreview).toHaveBeenCalledOnce();
    expect(menu.isOpen()).toBe(false);
  });

  it('desactivado cuando no hay documento con vista previa', () => {
    canGo = false;
    rightClick();

    expect(item('goToPreview').disabled).toBe(true);
  });

  it('copiar lleva la selección al portapapeles', async () => {
    view.dispatch({ selection: { anchor: 0, head: 4 } });
    rightClick();
    item('copy').click();

    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hola'));
  });

  it('cortar copia y borra la selección', async () => {
    view.dispatch({ selection: { anchor: 0, head: 5 } });
    rightClick();
    item('cut').click();

    await vi.waitFor(() => expect(view.state.doc.toString()).toBe('mundo'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hola ');
  });

  it('pegar inserta el texto del portapapeles en el cursor', async () => {
    view.dispatch({ selection: { anchor: 4 } });
    rightClick();
    item('paste').click();

    await vi.waitFor(() => expect(view.state.doc.toString()).toBe('holaPEGADO mundo'));
  });

  it('seleccionar todo selecciona el documento entero', async () => {
    rightClick();
    item('selectAll').click();

    await vi.waitFor(() => expect(view.state.selection.main).toMatchObject({ from: 0, to: 10 }));
  });

  it('si el sistema deniega el portapapeles, se avisa en vez de fallar en silencio', async () => {
    navigator.clipboard.readText = vi.fn().mockRejectedValue(new Error('denegado'));
    rightClick();
    item('paste').click();

    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith('editorMenu.clipboardDenied'));
    expect(view.state.doc.toString()).toBe('hola mundo');
  });

  it('Mayús+F10 abre el menú con el teclado', () => {
    key({ key: 'F10', shiftKey: true });

    expect(menu.isOpen()).toBe(true);
  });

  it('Escape y pulsar fuera lo cierran', () => {
    rightClick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu.isOpen()).toBe(false);

    rightClick();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu.isOpen()).toBe(false);
  });

  it('el atajo Ctrl+Alt+P va a la vista previa sin abrir el menú', () => {
    key({ code: 'KeyP', ctrlKey: true, altKey: true });

    expect(onGoToPreview).toHaveBeenCalledOnce();
    expect(menu.isOpen()).toBe(false);
  });

  it('el atajo no hace nada si no hay vista previa a la que ir', () => {
    canGo = false;
    key({ code: 'KeyP', ctrlKey: true, altKey: true });

    expect(onGoToPreview).not.toHaveBeenCalled();
  });
});
