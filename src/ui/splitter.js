// =============================================================================
// DBV Typst Editor — Separador redimensionable con persistencia
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Portado del split editor↔preview de dbv-md-reader (ARCHITECTURE.md §3 fila
// 15), generalizado a "cualquier columna de una rejilla": el mismo módulo sirve
// para el explorador (Slice 3) y para el reparto editor↔vista previa (Slice 5).
//
// El ancho vive en una custom property CSS y se persiste en localStorage: así
// la rejilla sigue siendo declarativa y el arrastre solo escribe un número.

/**
 * @param {HTMLElement} handleEl Elemento que se arrastra.
 * @param {object} options
 * @param {HTMLElement} options.hostEl Elemento con la rejilla (donde vive la variable).
 * @param {string} options.cssVariable Custom property que fija el ancho.
 * @param {string} options.storageKey Clave de persistencia.
 * @param {number} options.min Ancho mínimo en píxeles.
 * @param {number} options.max Ancho máximo en píxeles.
 * @param {'start'|'end'} [options.measureFrom] Desde qué borde se mide el ancho.
 * @param {'x'|'y'} [options.axis] Eje de arrastre: columna (por defecto) o fila
 *   — la consola de errores de la vista previa (Beta) se redimensiona en `y`.
 */
export function createSplitter(handleEl, options) {
  const { hostEl, cssVariable, storageKey, min, max, measureFrom = 'start', axis = 'x' } = options;
  if (!(handleEl instanceof HTMLElement) || !(hostEl instanceof HTMLElement)) {
    throw new TypeError('createSplitter: se esperan elementos del DOM');
  }

  const clamp = (value) => Math.min(max, Math.max(min, value));

  const apply = (width) => {
    hostEl.style.setProperty(cssVariable, `${Math.round(width)}px`);
  };

  const persist = (width) => {
    try {
      localStorage.setItem(storageKey, String(Math.round(width)));
    } catch {
      // Un WebView que bloquee el almacenamiento no debe impedir redimensionar:
      // simplemente se pierde la preferencia entre sesiones.
    }
  };

  const restore = () => {
    try {
      const stored = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(stored) && stored > 0) apply(clamp(stored));
    } catch {
      // Ver comentario en persist().
    }
  };

  let dragging = false;

  const widthFromPointer = (event) => {
    const bounds = hostEl.getBoundingClientRect();
    if (axis === 'y') {
      const point = event.clientY;
      const raw = measureFrom === 'start' ? point - bounds.top : bounds.bottom - point;
      return clamp(raw);
    }
    const point = event.clientX;
    const raw = measureFrom === 'start' ? point - bounds.left : bounds.right - point;
    return clamp(raw);
  };

  const onPointerMove = (event) => {
    if (!dragging) return;
    apply(widthFromPointer(event));
  };

  const stop = (event) => {
    if (!dragging) return;
    dragging = false;
    handleEl.classList.remove('is-dragging');
    handleEl.releasePointerCapture?.(event.pointerId);
    persist(widthFromPointer(event));
  };

  handleEl.addEventListener('pointerdown', (event) => {
    dragging = true;
    handleEl.classList.add('is-dragging');
    handleEl.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  handleEl.addEventListener('pointermove', onPointerMove);
  handleEl.addEventListener('pointerup', stop);
  handleEl.addEventListener('pointercancel', stop);
  // Doble clic devuelve el reparto por defecto, sin tener que afinar a mano.
  handleEl.addEventListener('dblclick', () => {
    hostEl.style.removeProperty(cssVariable);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Ver comentario en persist().
    }
  });

  restore();

  return { apply: (width) => apply(clamp(width)) };
}
