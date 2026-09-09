// =============================================================================
// DBV Typst Editor — Tests del modal de diferencias Side-by-Side (RF-19)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { createDiffModal } from './diffModal.js';

describe('diffModal', () => {
  let dialogEl;
  let localEl;
  let diskEl;
  let keepMineBtn;
  let reloadDiskBtn;
  let cancelBtn;

  beforeEach(() => {
    dialogEl = document.createElement('div');
    dialogEl.className = 'modal hidden';
    localEl = document.createElement('pre');
    diskEl = document.createElement('pre');
    keepMineBtn = document.createElement('button');
    reloadDiskBtn = document.createElement('button');
    cancelBtn = document.createElement('button');
  });

  function setup() {
    return createDiffModal({
      dialogEl,
      localEl,
      diskEl,
      keepMineBtn,
      reloadDiskBtn,
      cancelBtn,
    });
  }

  it('open sets contents and removes hidden class', () => {
    const modal = setup();
    modal.open({ localContent: 'linea local', diskContent: 'linea disco' });

    expect(localEl.textContent).toBe('linea local');
    expect(diskEl.textContent).toBe('linea disco');
    expect(dialogEl.classList.contains('hidden')).toBe(false);
  });

  it('keepMineBtn resolves to "keep" and hides dialog', async () => {
    const modal = setup();
    const promise = modal.open({ localContent: 'a', diskContent: 'b' });

    keepMineBtn.click();
    const result = await promise;

    expect(result).toBe('keep');
    expect(dialogEl.classList.contains('hidden')).toBe(true);
  });

  it('reloadDiskBtn resolves to "reload" and hides dialog', async () => {
    const modal = setup();
    const promise = modal.open({ localContent: 'a', diskContent: 'b' });

    reloadDiskBtn.click();
    const result = await promise;

    expect(result).toBe('reload');
    expect(dialogEl.classList.contains('hidden')).toBe(true);
  });

  it('cancelBtn resolves to "cancel" and hides dialog', async () => {
    const modal = setup();
    const promise = modal.open({ localContent: 'a', diskContent: 'b' });

    cancelBtn.click();
    const result = await promise;

    expect(result).toBe('cancel');
    expect(dialogEl.classList.contains('hidden')).toBe(true);
  });
});
