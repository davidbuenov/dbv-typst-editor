// =============================================================================
// DBV Typst Editor — Desplegable de imágenes del proyecto (RF-17)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Hasta v0.4.0 el botón "Fig" abría directamente el explorador de ficheros, lo
// que obligaba a navegar el disco incluso para reutilizar una imagen que ya
// estaba en el proyecto. Petición explícita de un usuario por coherencia con
// "Cite", que sí ofrece primero lo que el proyecto ya tiene: mismo componente
// (`filterablePicker.js`), misma salida de escape al final para lo que falte.

import { getProjectImages } from '../services/backend.js';
import { createFilterablePicker } from './filterablePicker.js';
import { figureActionForPath } from './toolbarActions.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl
 * @param {HTMLElement} deps.listEl
 * @param {HTMLInputElement} deps.filterEl
 * @param {HTMLButtonElement} [deps.browseButtonEl] "Buscar una imagen…": el
 *   selector nativo de fichero de siempre, ahora como última opción y no como
 *   única vía.
 * @param {() => void} [deps.onBrowse]
 * @param {() => string | null} deps.getRoot Raíz del proyecto activo, o `null`.
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 */
export function createImagePicker({ panelEl, listEl, filterEl, browseButtonEl, onBrowse, getRoot, getView }) {
  function insertFigure(image) {
    const view = getView();
    if (!view) return;
    // `figureActionForPath` es la misma inserción que usan el arrastre y el
    // selector nativo: deja el cursor en el pie de figura, que es lo único que
    // el usuario tiene que escribir.
    view.dispatch(figureActionForPath(image.path)(view.state));
    view.focus();
  }

  return createFilterablePicker({
    panelEl,
    listEl,
    filterEl,
    actionButtonEl: browseButtonEl,
    onAction: onBrowse,
    load: async () => {
      const root = getRoot();
      if (!root) return [];
      const result = await getProjectImages(root);
      return result.ok ? result.value : [];
    },
    onPick: insertFigure,
    // El nombre, no la ruta: es lo que el usuario recuerda de su imagen. La
    // ruta completa iría cortada en un panel de 260 px y filtraría peor.
    labelOf: (image) => image.name,
    emptyKey: 'image.empty',
    noMatchesKey: 'image.noMatches',
  });
}
