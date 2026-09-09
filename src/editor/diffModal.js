// =============================================================================
// DBV Typst Editor — Modal de diferencias Side-by-Side (RF-19)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

/**
 * @param {object} deps
 * @param {HTMLElement} deps.dialogEl
 * @param {HTMLElement} deps.localEl
 * @param {HTMLElement} deps.diskEl
 * @param {HTMLButtonElement} deps.keepMineBtn
 * @param {HTMLButtonElement} deps.reloadDiskBtn
 * @param {HTMLButtonElement} deps.cancelBtn
 */
export function createDiffModal({
  dialogEl,
  localEl,
  diskEl,
  keepMineBtn,
  reloadDiskBtn,
  cancelBtn,
}) {
  let onResolve = null;

  function close() {
    dialogEl.classList.add('hidden');
    onResolve = null;
  }

  keepMineBtn.addEventListener('click', () => {
    const cb = onResolve;
    close();
    cb?.('keep');
  });

  reloadDiskBtn.addEventListener('click', () => {
    const cb = onResolve;
    close();
    cb?.('reload');
  });

  cancelBtn.addEventListener('click', () => {
    const cb = onResolve;
    close();
    cb?.('cancel');
  });

  return {
    /**
     * Abre el modal comparador side-by-side y devuelve una promesa con la elección:
     * 'keep' | 'reload' | 'cancel'
     */
    open({ localContent, diskContent }) {
      return new Promise((resolve) => {
        onResolve = resolve;
        localEl.textContent = localContent;
        diskEl.textContent = diskContent;
        dialogEl.classList.remove('hidden');
      });
    },
    close,
  };
}
