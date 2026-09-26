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
  /** Textos originales que `open({ labels })` sustituye y `close` devuelve. */
  let restoreLabels = null;

  function close() {
    dialogEl.classList.add('hidden');
    onResolve = null;
    restoreLabels?.();
    restoreLabels = null;
  }

  /**
   * RF-73: el mismo modal compara una versión del historial con el contenido
   * actual, con sus propios títulos y botones («Restaurar esta versión»).
   */
  function applyLabels(labels) {
    const [localTitle, diskTitle] = dialogEl.querySelectorAll('.diff-pane__title');
    const targets = [
      [dialogEl.querySelector('.modal__title'), labels.title],
      [localTitle, labels.local],
      [diskTitle, labels.disk],
      [keepMineBtn, labels.keep],
      [reloadDiskBtn, labels.reload],
    ].filter(([element, text]) => element && text);
    const originals = targets.map(([element]) => element.textContent);
    for (const [element, text] of targets) element.textContent = text;
    restoreLabels = () => targets.forEach(([element], index) => (element.textContent = originals[index]));
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
    open({ localContent, diskContent, labels }) {
      return new Promise((resolve) => {
        onResolve = resolve;
        if (labels) applyLabels(labels);
        localEl.textContent = localContent;
        diskEl.textContent = diskContent;
        dialogEl.classList.remove('hidden');
      });
    },
    close,
  };
}
