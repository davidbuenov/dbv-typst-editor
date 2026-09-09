// =============================================================================
// DBV Typst Editor — Tests de la chincheta de ventana encima
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { createAlwaysOnTop } from './alwaysOnTop.js';
import { t } from '../i18n/i18n.js';

function montar({ setAlwaysOnTop, isAlwaysOnTop } = {}) {
  const buttonEl = document.createElement('button');
  document.body.append(buttonEl);

  const appWindow = {
    setAlwaysOnTop: setAlwaysOnTop ?? vi.fn().mockResolvedValue(undefined),
    isAlwaysOnTop: isAlwaysOnTop ?? vi.fn().mockResolvedValue(false),
  };
  const onError = vi.fn();

  return { buttonEl, appWindow, onError, pin: createAlwaysOnTop({ buttonEl, appWindow, onError }) };
}

describe('chincheta de ventana encima (RF-28)', () => {
  it('nace suelta y lo dice', () => {
    const { buttonEl, pin } = montar();

    expect(pin.isPinned()).toBe(false);
    expect(buttonEl.classList.contains('active')).toBe(false);
    expect(buttonEl.getAttribute('aria-pressed')).toBe('false');
    expect(buttonEl.title).toBe(t('action.alwaysOnTop'));
  });

  it('al pulsarla fija la ventana y el control lo refleja', async () => {
    const { buttonEl, appWindow, pin } = montar();

    await pin.toggle();

    expect(appWindow.setAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(pin.isPinned()).toBe(true);
    expect(buttonEl.classList.contains('active')).toBe(true);
    expect(buttonEl.getAttribute('aria-pressed')).toBe('true');
    // Un control que no dice cómo desactivarse obliga a probarlo para saberlo.
    expect(buttonEl.title).toBe(t('action.alwaysOnTopActive'));
  });

  it('vuelve a soltarla en la segunda pulsación', async () => {
    const { appWindow, pin } = montar();

    await pin.toggle();
    await pin.toggle();

    expect(appWindow.setAlwaysOnTop).toHaveBeenNthCalledWith(2, false);
    expect(pin.isPinned()).toBe(false);
  });

  it('si la ventana no obedece, el control NO miente sobre su estado', async () => {
    // RF-28.5. Marcar la chincheta como activa cuando la llamada ha fallado deja
    // al usuario creyendo que su ventana está fijada cuando no lo está, y la
    // siguiente pulsación intentaría soltar algo que nunca se fijó.
    const { buttonEl, onError, pin } = montar({
      setAlwaysOnTop: vi.fn().mockRejectedValue(new Error('permiso denegado')),
    });

    await pin.toggle();

    expect(pin.isPinned()).toBe(false);
    expect(buttonEl.classList.contains('active')).toBe(false);
    expect(onError).toHaveBeenCalledWith('permiso denegado');
  });

  it('el clic del ratón hace lo mismo que llamar a toggle()', async () => {
    const { buttonEl, appWindow } = montar();

    buttonEl.click();
    await vi.waitFor(() => expect(appWindow.setAlwaysOnTop).toHaveBeenCalledWith(true));
  });

  it('sync() adopta el estado real de la ventana', async () => {
    const { pin } = montar({ isAlwaysOnTop: vi.fn().mockResolvedValue(true) });

    await pin.sync();

    expect(pin.isPinned()).toBe(true);
  });

  it('sync() degrada a "suelta" si la ventana no contesta', async () => {
    const { buttonEl, pin } = montar({
      isAlwaysOnTop: vi.fn().mockRejectedValue(new Error('sin API de ventana')),
    });

    await pin.sync();

    expect(pin.isPinned()).toBe(false);
    expect(buttonEl.classList.contains('active')).toBe(false);
  });
});
