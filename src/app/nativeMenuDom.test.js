// =============================================================================
// DBV Typst Editor — Tests del cableado del menú nativo de macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Sobre el HTML REAL de la cabecera (`index.html`): si una entrada nueva rompe la
// descripción o un `data-accel` pisa un atajo del editor, falla aquí y no en el Mac.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTranslations, t } from '../i18n/i18n.js';
import { APP_SHORTCUTS } from '../editor/shortcuts.js';
import { acceleratorConflicts } from './nativeMenu.js';
import { collectNativeMenus, initNativeMenu, paintMenuKeys } from './nativeMenuDom.js';
import { positionPanelNear } from '../panels/registerPanel.js';

const html = readFileSync(join(process.cwd(), 'src/index.html'), 'utf8');
const header = html.slice(html.indexOf('<header class="app-header">'), html.indexOf('</header>') + '</header>'.length);

beforeEach(() => {
  document.body.className = '';
  document.body.innerHTML = header;
  applyTranslations(document);
});

describe('collectNativeMenus sobre index.html (RF-125.2)', () => {
  it('describe Archivo, Herramientas y Preferencias con sus entradas en orden', () => {
    const { description } = collectNativeMenus(document, t);
    expect(description.menus.map((m) => m.id)).toEqual(['file', 'tools', 'prefs']);
    const file = description.menus[0];
    expect(file.title).toBe(t('action.fileMenu'));
    const ids = file.items.filter((i) => i.kind !== 'sep').map((i) => i.id);
    const domIds = [...document.querySelectorAll('#file-menu > .menu-item')].map((el) => `file:${el.id}`);
    expect(ids).toEqual(domIds);
    expect(file.items.find((i) => i.id === 'file:btn-save')).toMatchObject({ label: t('action.save'), accel: 'CmdOrCtrl+S' });
  });

  it('las preferencias son casillas con su estado', () => {
    document.getElementById('pref-vim-mode').setAttribute('aria-checked', 'true');
    const prefs = collectNativeMenus(document, t).description.menus[2];
    expect(prefs.items.find((i) => i.id === 'prefs:pref-vim-mode')).toMatchObject({ kind: 'check', checked: true });
    expect(prefs.items.find((i) => i.id === 'prefs:pref-theme-dialog')).toMatchObject({ kind: 'item', label: t('prefs.themes') });
  });

  it('lo deshabilitado sale apagado y lo oculto no sale', () => {
    document.getElementById('btn-save').disabled = true;
    document.getElementById('btn-mcp-server').classList.add('hidden');
    const { description } = collectNativeMenus(document, t);
    const all = description.menus.flatMap((m) => m.items);
    expect(all.find((i) => i.id === 'file:btn-save').enabled).toBe(false);
    expect(all.some((i) => i.id === 'tools:btn-mcp-server')).toBe(false);
  });
});

describe('atajos de index.html (RF-125.6)', () => {
  const entries = [...html.matchAll(/id="([^"]+)"[^>]*data-accel="([^"]+)"/g)].map(([, key, accel]) => ({ key, accel }));

  it('conserva los atajos del menú nativo de la 0.15.0, más ⌘W', () => {
    expect(Object.fromEntries(entries.map((e) => [e.key, e.accel]))).toEqual({
      'btn-new-blank-project': 'Mod-n',
      'btn-new-document': 'Mod-Alt-n',
      'btn-save': 'Mod-s',
      'btn-save-as': 'Mod-Shift-s',
      'btn-open-folder': 'Mod-o',
      'btn-open-file': 'Mod-Shift-o',
      'btn-close-tab': 'Mod-w',
      'btn-close-project': 'Mod-Shift-w',
    });
  });

  it('ninguno pisa un atajo del editor salvo el de la misma acción', () => {
    const sameAction = { 'cmd-s': 'save', 'alt-cmd-n': 'newDocument', 'cmd-w': 'closeTab' };
    expect(acceleratorConflicts(entries, APP_SHORTCUTS, sameAction)).toEqual([]);
  });

  it('pinta el atajo de «Cerrar pestaña» según la plataforma', () => {
    paintMenuKeys(document, 'es', false);
    expect(document.querySelector('#btn-close-tab .menu-item__keys').textContent).toMatch(/Ctrl\s*\+\s*W/);
    paintMenuKeys(document, 'en', true);
    expect(document.querySelector('#btn-close-tab .menu-item__keys').textContent).toBe('⌘W');
  });
});

describe('initNativeMenu (RF-125.1, .4, .5, .10)', () => {
  function start(enabled) {
    const publish = vi.fn(async () => ({ ok: true }));
    let handler = null;
    const listen = vi.fn((event, fn) => {
      if (event === 'menu-item') handler = fn;
    });
    const api = initNativeMenu({ enabled, publish, listen, t });
    return { api, publish, fire: (id) => handler(id) };
  }

  it('fuera de macOS no toca nada', () => {
    const { api, publish } = start(false);
    expect(api).toBeNull();
    expect(document.body.classList.contains('native-menus')).toBe(false);
    expect(publish).not.toHaveBeenCalled();
  });

  it('en macOS oculta los menús de la ventana y publica la descripción', () => {
    const { publish } = start(true);
    expect(document.body.classList.contains('native-menus')).toBe(true);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0].menus).toHaveLength(3);
  });

  it('un clic nativo pulsa el botón de su id; un id desconocido o una entrada apagada no hacen nada', () => {
    const { fire } = start(true);
    const save = document.getElementById('btn-save');
    const clicked = vi.fn();
    save.addEventListener('click', clicked);
    expect(fire('file:btn-save')).toBe(true);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(fire('file:no-existe')).toBe(false);
    expect(fire({ id: 'file:btn-save' })).toBe(false);
    save.disabled = true;
    expect(fire('file:btn-save')).toBe(false);
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('republica cuando cambia el estado del DOM, y no si nada cambia', async () => {
    const { api, publish } = start(true);
    document.getElementById('btn-save').disabled = true;
    await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(2));
    const last = publish.mock.calls[1][0].menus[0].items.find((i) => i.id === 'file:btn-save');
    expect(last.enabled).toBe(false);
    api.push();
    expect(publish).toHaveBeenCalledTimes(2);
  });
});

describe('positionPanelNear con el disparador oculto (RF-125, revisión adversarial)', () => {
  it('centra el panel bajo la cabecera en vez de la esquina superior izquierda', () => {
    const panel = document.createElement('div');
    const trigger = document.getElementById('btn-tools-diagram');
    document.body.classList.add('native-menus');
    positionPanelNear(panel, trigger, { width: 600 });
    expect(panel.style.left).toBe(`${Math.max(10, (window.innerWidth - 600) / 2)}px`);
  });
});
