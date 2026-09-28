// =============================================================================
// DBV Typst Editor — Tests de la barra de pestañas (RF-79)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTabBar, dropIndex, tabShortcutAction } from './tabBar.js';

const TABS = [
  { path: 'D:/l/main.typ', label: 'main.typ', active: false, dirty: true, readOnly: false },
  { path: 'D:/l/cap/uno.typ', label: 'uno.typ', active: true, dirty: false, readOnly: false },
  { path: 'C:/pkg/canvas.typ', label: 'canvas.typ', active: false, dirty: false, readOnly: true },
];

describe('barra de pestañas (RF-79)', () => {
  let container;
  let handlers;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.replaceChildren(container);
    handlers = { onActivate: vi.fn(), onClose: vi.fn(), onMove: vi.fn() };
    createTabBar({ containerEl: container, ...handlers }).render(TABS);
  });

  const tabs = () => [...container.querySelectorAll('.tab')];
  const pointer = (type, target, init) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init }));

  it('pinta una pestaña por documento, accesible como tablist, con modificado y solo lectura', () => {
    expect(container.getAttribute('role')).toBe('tablist');
    expect(tabs().map((tab) => tab.querySelector('.tab__name').textContent)).toEqual(['main.typ', 'uno.typ', 'canvas.typ']);
    expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
    expect(tabs()[0].querySelector('.tab__dirty')).not.toBeNull();
    expect(tabs()[2].querySelector('.tab__badge')).not.toBeNull();
    expect(tabs()[0].title).toBe('D:/l/main.typ');
  });

  it('sin pestañas la barra se oculta', () => {
    createTabBar({ containerEl: container, ...handlers }).render([]);
    expect(container.classList.contains('hidden')).toBe(true);
  });

  it('un clic activa, la cruz y el clic central cierran', () => {
    pointer('pointerdown', tabs()[0], { clientX: 10 });
    pointer('pointerup', tabs()[0], { clientX: 11 });
    expect(handlers.onActivate).toHaveBeenCalledWith('D:/l/main.typ');

    tabs()[2].querySelector('.tab__close').click();
    expect(handlers.onClose).toHaveBeenCalledWith('C:/pkg/canvas.typ');

    tabs()[1].dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(handlers.onClose).toHaveBeenCalledWith('D:/l/cap/uno.typ');
  });

  it('arrastrar más de 4 px reordena en vez de activar (eventos de puntero, R-T6)', () => {
    const rects = [0, 100, 200];
    tabs().forEach((tab, index) => {
      tab.getBoundingClientRect = () => ({ left: rects[index], width: 100, right: rects[index] + 100, top: 0, bottom: 20, height: 20 });
    });
    pointer('pointerdown', tabs()[0], { clientX: 50 });
    pointer('pointermove', container, { clientX: 52 });
    expect(container.classList.contains('tabs--dragging')).toBe(false);
    pointer('pointermove', container, { clientX: 260 });
    expect(container.classList.contains('tabs--dragging')).toBe(true);
    pointer('pointerup', container, { clientX: 260 });

    expect(handlers.onMove).toHaveBeenCalledWith('D:/l/main.typ', 2);
    expect(handlers.onActivate).not.toHaveBeenCalled();
  });

  it('con el teclado: flechas activan la vecina y Supr cierra', () => {
    tabs()[1].focus();
    tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(handlers.onActivate).toHaveBeenLastCalledWith('C:/pkg/canvas.typ');
    tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(handlers.onActivate).toHaveBeenLastCalledWith('D:/l/main.typ');
    tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(handlers.onClose).toHaveBeenLastCalledWith('D:/l/cap/uno.typ');
  });
});

describe('atajos y posición al soltar', () => {
  const key = (init) => ({ key: '', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...init });

  it('Ctrl+W cierra, Ctrl+Tab y Ctrl+Mayús+Tab recorren; lo demás no es de las pestañas', () => {
    expect(tabShortcutAction(key({ key: 'w', ctrlKey: true }))).toBe('close');
    expect(tabShortcutAction(key({ key: 'W', ctrlKey: true }))).toBe('close');
    expect(tabShortcutAction(key({ key: 'Tab', ctrlKey: true }))).toBe('next');
    expect(tabShortcutAction(key({ key: 'Tab', ctrlKey: true, shiftKey: true }))).toBe('prev');
    expect(tabShortcutAction(key({ key: 'w', metaKey: true }))).toBe(null);
    expect(tabShortcutAction(key({ key: 'Tab' }))).toBe(null);
    expect(tabShortcutAction(key({ key: 'w', ctrlKey: true, shiftKey: true }))).toBe(null);
  });

  it('dropIndex cuenta los centros que quedan a la izquierda, sin la pestaña arrastrada', () => {
    expect(dropIndex([50, 150, 250], 0, 260)).toBe(2);
    expect(dropIndex([50, 150, 250], 2, 10)).toBe(0);
    expect(dropIndex([50, 150, 250], 1, 160)).toBe(1);
  });
});
