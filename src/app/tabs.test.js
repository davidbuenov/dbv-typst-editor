// =============================================================================
// DBV Typst Editor — Tests del modelo de pestañas (RF-79)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  activateTab,
  closeTab,
  emptyTabs,
  moveTab,
  neighbourTab,
  openTab,
  readStoredTabs,
  remapTabPaths,
  removeTabPaths,
  restoreTabs,
  serializeTabs,
  storeTabs,
  tabsKey,
} from './tabs.js';

const ROOT = 'D:/libro';
const A = `${ROOT}/main.typ`;
const B = `${ROOT}/cap/uno.typ`;
const C = `${ROOT}/cap/dos.typ`;

/** Modelo con A, B y C abiertos en ese orden y `active` activa. */
const three = (active = C) => activateTab([A, B, C].reduce(openTab, emptyTabs()), active);

describe('modelo de pestañas (RF-79.7)', () => {
  it('abrir añade a la derecha de la activa y la activa', () => {
    let model = openTab(emptyTabs(), A);
    model = openTab(model, B);
    model = activateTab(model, A);
    model = openTab(model, C);
    expect(model).toEqual({ paths: [A, C, B], active: C });
  });

  it('abrir un fichero ya abierto solo lo activa (sin duplicar, también con otra grafía en Windows)', () => {
    const model = openTab(three(A), 'd:\\libro\\cap\\uno.typ');
    expect(model.paths).toEqual([A, B, C]);
    expect(model.active).toBe(B);
  });

  it('cerrar la activa activa la de la derecha, o la de la izquierda si era la última', () => {
    expect(closeTab(three(B), B)).toEqual({ paths: [A, C], active: C });
    expect(closeTab(three(C), C)).toEqual({ paths: [A, B], active: B });
    expect(closeTab(openTab(emptyTabs(), A), A)).toEqual({ paths: [], active: null });
  });

  it('cerrar una de fondo no cambia la activa', () => {
    expect(closeTab(three(C), A)).toEqual({ paths: [B, C], active: C });
  });

  it('reordenar mueve la pestaña sin cambiar la activa, con la posición recortada', () => {
    expect(moveTab(three(), A, 2)).toEqual({ paths: [B, C, A], active: C });
    expect(moveTab(three(), C, -5).paths).toEqual([C, A, B]);
    expect(moveTab(three(), 'no/abierta.typ', 0)).toEqual(three());
  });

  it('Ctrl+Tab y Ctrl+Mayús+Tab recorren en círculo', () => {
    expect(neighbourTab(three(C), 1)).toBe(A);
    expect(neighbourTab(three(A), -1)).toBe(C);
    expect(neighbourTab(emptyTabs(), 1)).toBe(null);
  });

  it('renombrar o mover un fichero o su carpeta actualiza sus pestañas y la activa', () => {
    const model = remapTabPaths(three(B), [{ from: `${ROOT}/cap`, to: `${ROOT}/capitulos` }]);
    expect(model).toEqual({ paths: [A, `${ROOT}/capitulos/uno.typ`, `${ROOT}/capitulos/dos.typ`], active: `${ROOT}/capitulos/uno.typ` });
  });

  it('eliminar una carpeta cierra sus pestañas y la activa pasa a la vecina', () => {
    expect(removeTabPaths(three(B), [`${ROOT}/cap`])).toEqual({ paths: [A], active: A });
  });

  it('se guardan rutas relativas y se restauran omitiendo las que ya no existen', () => {
    const saved = serializeTabs(three(B), ROOT);
    expect(saved).toEqual({ tabs: ['main.typ', 'cap/uno.typ', 'cap/dos.typ'], active: 'cap/uno.typ' });

    const restored = restoreTabs(saved, ROOT, (path) => path !== B);
    expect(restored).toEqual({ paths: [A, C], active: A });
  });

  it('una ruta manipulada, absoluta o fuera del proyecto no se restaura', () => {
    const raw = { tabs: ['../fuera.typ', '/etc/passwd', 'C:/otra/x.typ', 'cap/dos.typ', 42, 'cap/dos.typ'], active: '../fuera.typ' };
    expect(restoreTabs(raw, ROOT, () => true)).toEqual({ paths: [C], active: C });
    expect(restoreTabs('basura', ROOT, () => true)).toEqual({ paths: [], active: null });
  });

  it('las pestañas de fuera del proyecto (un paquete en solo lectura) no se guardan', () => {
    const model = openTab(three(), 'C:/Users/x/AppData/typst/packages/cetz/canvas.typ');
    expect(serializeTabs(model, ROOT)).toEqual({ tabs: ['main.typ', 'cap/uno.typ', 'cap/dos.typ'], active: null });
  });
});

describe('persistencia por proyecto', () => {
  beforeEach(() => localStorage.clear());

  it('guarda y lee con una clave propia de cada proyecto', () => {
    storeTabs(ROOT, three(B));
    expect(JSON.parse(localStorage.getItem(tabsKey(ROOT)))).toEqual({ tabs: ['main.typ', 'cap/uno.typ', 'cap/dos.typ'], active: 'cap/uno.typ' });
    expect(readStoredTabs(ROOT)).toEqual({ tabs: ['main.typ', 'cap/uno.typ', 'cap/dos.typ'], active: 'cap/uno.typ' });
    expect(readStoredTabs('D:/otro')).toBe(null);
  });

  it('un valor roto en el almacenamiento no rompe nada', () => {
    localStorage.setItem(tabsKey(ROOT), '{no es json');
    expect(readStoredTabs(ROOT)).toBe(null);
  });
});
