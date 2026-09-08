// =============================================================================
// DBV Typst Editor — Panel de navegación estructural (Outline, Beta)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// ARCHITECTURE.md §7.8. Mismo ciclo de vida que `preview.js` a propósito
// (`restart`/`onContentChanged`/`clear`): desde RF-14 los dos compilan el MISMO
// objetivo, que pide cada uno a `workspace.getCompileTarget()` en el momento de
// usarlo. Si el outline eligiera su documento por su cuenta, el panel listaría
// los encabezados de algo distinto de lo que se ve compilado, y la navegación
// llevaría a páginas que no existen en la vista previa.
//
// Clic→navegación cubre hoy solo la vista previa (página + coordenada `y`, que
// es justo lo que expone `typst eval`). Llevar además el cursor del editor a la
// posición del fuente es RF-16, que se apoya en anclas y llega en el Slice 30
// (ADR-SYNC-001: no hay posición real de fuente accesible desde el sidecar).

import { t } from '../i18n/i18n.js';
import { getOutline } from '../services/backend.js';

const DEBOUNCE_MS = 500;

/**
 * @param {object} deps
 * @param {HTMLElement} deps.listEl Contenedor donde se pintan las entradas.
 * @param {(entry: {page: number, yPt: number}) => void} deps.onNavigate
 * @param {() => (import('../services/backend.js').CompileTarget | null)} deps.getTarget
 *   El MISMO objetivo que compila la vista previa (RF-14): un outline que
 *   listara los encabezados de otro fichero no navegaría a lo que se ve.
 */
export function createOutline({ listEl, onNavigate, getTarget }) {
  let debounceTimer = null;

  function render(entries) {
    listEl.replaceChildren();
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'outline__empty';
      empty.textContent = t('outline.empty');
      listEl.append(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'outline__item';
      item.style.setProperty('--outline-indent', String(Math.max(0, entry.level - 1)));
      item.textContent = entry.text || t('outline.untitled');
      item.addEventListener('click', () => onNavigate(entry));
      fragment.append(item);
    }
    listEl.append(fragment);
  }

  async function fetchNow() {
    const target = getTarget();
    if (!target?.document || !target?.root) return;
    const result = await getOutline(target);
    // Un error de compilación no vacía el panel: se queda el último esquema
    // bueno, igual que la vista previa mantiene su última vista buena.
    if (result.ok) render(result.value);
  }

  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchNow, DEBOUNCE_MS);
  }

  render([]);

  return {
    /** Empieza de cero con el objetivo vigente. */
    restart() {
      fetchNow();
    },
    onContentChanged() {
      schedule();
    },
    clear() {
      if (debounceTimer) clearTimeout(debounceTimer);
      render([]);
    },
  };
}
