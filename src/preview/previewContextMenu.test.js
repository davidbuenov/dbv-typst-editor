// =============================================================================
// DBV Typst Editor — Tests del menú contextual de la vista previa (RF-58)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPreviewContextMenu } from './previewContextMenu.js';

describe('createPreviewContextMenu', () => {
  let host;
  let onGoToSource;
  let menu;

  const item = () => document.querySelector('.preview-context-menu .menu-item');
  const rightClick = (clientX = 120, clientY = 80) =>
    host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY }));

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    onGoToSource = vi.fn();
    menu = createPreviewContextMenu({ hostEl: host, onGoToSource, t: (key) => key });
  });

  afterEach(() => {
    menu.close();
    host.remove();
  });

  it('el botón derecho ofrece ir al código y avisa del atajo del doble clic', () => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    host.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(item().textContent).toContain('previewMenu.goToSource');
    expect(item().textContent).toContain('previewMenu.doubleClick');
  });

  it('elegirla salta al punto donde se pulsó el botón derecho y cierra el menú', () => {
    rightClick(120, 80);
    item().click();

    expect(onGoToSource).toHaveBeenCalledWith(120, 80);
    expect(menu.isOpen()).toBe(false);
  });

  it('un segundo botón derecho sustituye al menú anterior y usa el punto nuevo', () => {
    rightClick(10, 10);
    rightClick(200, 300);

    expect(document.querySelectorAll('.preview-context-menu')).toHaveLength(1);
    item().click();
    expect(onGoToSource).toHaveBeenCalledWith(200, 300);
  });

  it('sobre un enlace externo ofrece copiar su dirección (RF-72); sobre uno interno, no', async () => {
    menu.close();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const getLinkAt = vi.fn(async () => ({ url: 'https://typst.app' }));
    const linked = createPreviewContextMenu({ hostEl: host, onGoToSource, t: (key) => key, getLinkAt });

    rightClick(50, 60);
    await Promise.resolve();
    const copy = document.querySelector('.preview-context-menu [data-action="copyLink"]');
    expect(getLinkAt).toHaveBeenCalledWith(50, 60);
    copy.click();
    expect(writeText).toHaveBeenCalledWith('https://typst.app');
    linked.close();

    getLinkAt.mockResolvedValue({ targetPage: 3 });
    rightClick();
    await Promise.resolve();
    expect(document.querySelector('.preview-context-menu [data-action="copyLink"]')).toBeNull();
    linked.close();
  });

  it('Escape y pulsar fuera lo cierran sin saltar', () => {
    rightClick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu.isOpen()).toBe(false);

    rightClick();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu.isOpen()).toBe(false);
    expect(onGoToSource).not.toHaveBeenCalled();
  });
});
