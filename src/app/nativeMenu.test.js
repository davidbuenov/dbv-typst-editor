// =============================================================================
// DBV Typst Editor — Tests de la descripción del menú nativo de macOS
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { acceleratorConflicts, describeMenus, signature, toAccelerator } from './nativeMenu.js';

const item = (key, extra = {}) => ({ key, kind: 'item', label: key, ...extra });
const sep = () => ({ kind: 'sep' });

describe('toAccelerator (RF-125)', () => {
  it('traduce la notación de shortcuts.js a un acelerador de Tauri', () => {
    expect(toAccelerator('Mod-s')).toBe('CmdOrCtrl+S');
    expect(toAccelerator('Mod-Shift-o')).toBe('CmdOrCtrl+Shift+O');
    expect(toAccelerator('Mod-Alt-n')).toBe('CmdOrCtrl+Alt+N');
    expect(toAccelerator('F2')).toBe('F2');
  });

  it('un atajo ilegible deja la entrada sin atajo', () => {
    for (const malo of ['', null, undefined, 'Mod-', 'Hyper-k', 'Mod-ArrowUp', 'F99']) {
      expect(toAccelerator(malo)).toBeNull();
    }
  });
});

describe('describeMenus (RF-125)', () => {
  it('convierte entradas, casillas y separadores, con el id del menú delante', () => {
    const out = describeMenus([
      {
        id: 'prefs',
        title: 'Preferencias',
        items: [item('pref-vim-mode', { kind: 'check', checked: true }), sep(), item('pref-theme-dialog', { label: '  Temas\n…  ' })],
      },
    ]);
    expect(out.menus[0].items).toEqual([
      { id: 'prefs:pref-vim-mode', kind: 'check', label: 'pref-vim-mode', accel: null, enabled: true, checked: true },
      { id: '', kind: 'sep', label: '', accel: null, enabled: true, checked: false },
      { id: 'prefs:pref-theme-dialog', kind: 'item', label: 'Temas …', accel: null, enabled: true, checked: false },
    ]);
  });

  it('lo deshabilitado se queda (apagado) y lo oculto se omite', () => {
    const [menu] = describeMenus([
      { id: 'file', title: 'Archivo', items: [item('btn-save', { disabled: true, accel: 'Mod-s' }), item('btn-x', { hidden: true })] },
    ]).menus;
    expect(menu.items).toHaveLength(1);
    expect(menu.items[0]).toMatchObject({ id: 'file:btn-save', enabled: false, accel: 'CmdOrCtrl+S' });
  });

  it('poda los separadores huérfanos, también los que deja una entrada oculta', () => {
    const [menu] = describeMenus([
      { id: 'tools', title: 'Herramientas', items: [sep(), item('a'), sep(), item('b', { hidden: true }), sep(), item('c'), sep()] },
    ]).menus;
    expect(menu.items.map((i) => i.kind)).toEqual(['item', 'sep', 'item']);
  });

  it('solo una casilla puede ir marcada, y un menú sin entradas desaparece', () => {
    const out = describeMenus([
      { id: 'file', title: 'Archivo', items: [item('a', { checked: true })] },
      { id: 'tools', title: 'Herramientas', items: [sep(), item('b', { hidden: true })] },
    ]);
    expect(out.menus).toHaveLength(1);
    expect(out.menus[0].items[0].checked).toBe(false);
  });

  it('una entrada sin id o repetida no entra', () => {
    const [menu] = describeMenus([{ id: 'file', title: 'Archivo', items: [item(''), item('a'), item('a')] }]).menus;
    expect(menu.items.map((i) => i.id)).toEqual(['file:a']);
  });

  it('la firma cambia con el estado, no con una descripción idéntica', () => {
    const a = describeMenus([{ id: 'file', title: 'Archivo', items: [item('a')] }]);
    const b = describeMenus([{ id: 'file', title: 'Archivo', items: [item('a')] }]);
    const c = describeMenus([{ id: 'file', title: 'Archivo', items: [item('a', { disabled: true })] }]);
    expect(signature(a)).toBe(signature(b));
    expect(signature(a)).not.toBe(signature(c));
  });
});

describe('acceleratorConflicts (RF-125.6)', () => {
  const APP = [
    { id: 'save', key: 'Mod-s' },
    { id: 'bold', key: 'Mod-b' },
    { id: 'altOnMac', key: 'Alt-l', mac: 'Ctrl-l' },
  ];

  it('detecta un acelerador que pisa un atajo del editor, sin importar el orden de los modificadores', () => {
    expect(acceleratorConflicts([{ key: 'x', accel: 'Mod-b' }], APP)).toEqual([{ entry: 'x', combo: 'cmd-b', shortcut: 'bold' }]);
    expect(acceleratorConflicts([{ key: 'y', accel: 'Shift-Mod-b' }], [{ id: 'z', key: 'Mod-Shift-b' }])).toHaveLength(1);
  });

  it('compara con la combinación de macOS del atajo', () => {
    expect(acceleratorConflicts([{ key: 'x', accel: 'Ctrl-l' }], APP)).toHaveLength(1);
    expect(acceleratorConflicts([{ key: 'x', accel: 'Alt-l' }], APP)).toHaveLength(0);
  });

  it('permite coincidir solo con el atajo de la misma acción', () => {
    expect(acceleratorConflicts([{ key: 'btn-save', accel: 'Mod-s' }], APP, { 'cmd-s': 'save' })).toEqual([]);
    expect(acceleratorConflicts([{ key: 'btn-save', accel: 'Mod-s' }], APP, { 'cmd-s': 'otro' })).toHaveLength(1);
  });
});
