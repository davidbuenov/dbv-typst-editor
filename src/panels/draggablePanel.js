// =============================================================================
// DBV Typst Editor — Arrastrar un panel flotante por su cabecera
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Petición explícita del usuario tras probar el terminal avanzado (Beta,
// §7.14): un panel centrado con `left: 50%; transform: translateX(-50%)` no se
// puede mover. Al primer arrastre se congela la posición actual en píxeles
// (sustituyendo el centrado) y a partir de ahí es una resta de coordenadas de
// puntero, igual que `ui/splitter.js` pero en dos ejes en vez de uno.

/**
 * @param {HTMLElement} panelEl Panel a mover (posición `absolute`/`fixed`).
 * @param {HTMLElement} handleEl Elemento que se arrastra (su cabecera).
 */
export function makeDraggable(panelEl, handleEl) {
  let dragging = false;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let panelStartLeft = 0;
  let panelStartTop = 0;

  handleEl.addEventListener('pointerdown', (event) => {
    // No empezar a arrastrar al pulsar un botón de la propia cabecera (cerrar, limpiar).
    if (event.target.closest('button')) return;

    const rect = panelEl.getBoundingClientRect();
    panelEl.style.left = `${rect.left}px`;
    panelEl.style.top = `${rect.top}px`;
    panelEl.style.right = 'auto';
    panelEl.style.transform = 'none';

    dragging = true;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    panelStartLeft = rect.left;
    panelStartTop = rect.top;
    handleEl.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  handleEl.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    panelEl.style.left = `${panelStartLeft + (event.clientX - pointerStartX)}px`;
    panelEl.style.top = `${panelStartTop + (event.clientY - pointerStartY)}px`;
  });

  const stop = (event) => {
    dragging = false;
    handleEl.releasePointerCapture?.(event.pointerId);
  };
  handleEl.addEventListener('pointerup', stop);
  handleEl.addEventListener('pointercancel', stop);
}
