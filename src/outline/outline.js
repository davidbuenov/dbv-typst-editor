// =============================================================================
// DBV Typst Editor — Panel de navegación estructural (Outline, Beta)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// ARCHITECTURE.md §7.8. Mismo ciclo de vida que `preview.js` a propósito
// (`setDocument`/`onContentChanged`/`detachLiveContent`/`clear`): ambos leen
// el mismo documento en vivo, y mantener el contrato idéntico es lo que evita
// que `main.js` tenga que tratarlos de forma distinta.
//
// Clic→navegación cubre hoy solo la vista previa (página + coordenada `y`,
// que es justo lo que expone `typst eval`); saltar también el cursor del
// editor a la posición exacta necesitaría mapear posición de PDF a posición de
// texto fuente, que es la sincronización "por posición real" que
// ARCHITECTURE.md deja para más adelante en Beta — no está aquí todavía.

import { t } from '../i18n/i18n.js';
import { getOutline } from '../services/backend.js';

const DEBOUNCE_MS = 500;

/**
 * @param {object} deps
 * @param {HTMLElement} deps.listEl Contenedor donde se pintan las entradas.
 * @param {(entry: {page: number, yPt: number}) => void} deps.onNavigate
 */
export function createOutline({ listEl, onNavigate }) {
  let debounceTimer = null;
  /** @type {null | {document: string, root: string, content: string|null, dirty: boolean}} */
  let request = null;

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
    if (!request?.document || !request?.root) return;
    const result = await getOutline({
      document: request.document,
      root: request.root,
      content: request.dirty ? request.content : null,
    });
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
    setDocument({ document, root, content }) {
      request = { document, root, content, dirty: false };
      fetchNow();
    },
    onContentChanged(content) {
      if (!request) return;
      request.content = content;
      request.dirty = true;
      schedule();
    },
    detachLiveContent() {
      if (!request) return;
      request.dirty = false;
      request.content = null;
    },
    onSaved() {
      if (!request) return;
      request.dirty = false;
    },
    clear() {
      if (debounceTimer) clearTimeout(debounceTimer);
      request = null;
      render([]);
    },
  };
}
