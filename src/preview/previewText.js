// =============================================================================
// DBV Typst Editor — Buscar y copiar en la vista previa (RF-82)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Ctrl/Cmd+F con el foco en la vista previa abre una barra de búsqueda sobre el
// documento maquetado (el Ctrl+F del editor no cambia). La búsqueda la hace el
// motor en TODAS las páginas (`engine_search`), también las que aún no se han
// pintado. Arrastrar sobre una página selecciona texto y Ctrl/Cmd+C lo copia.
//
// Los resaltados y la selección son rectángulos no interactivos
// (`pointer-events: none`) colocados como las marcas de sincronización: el
// clic en un enlace (RF-72), el doble clic (RF-57) y el menú contextual no
// cambian. Arrastrar solo empieza por encima de 4 px (R-P2).
//
// Motor clásico de respaldo: no hay capa de texto; la barra lo dice y la
// selección no se activa (RF-82.4).

import { SELECT_THRESHOLD_PX, boundaryAt, createMatchCursor, rangeRects, textBetween, toCss } from './textSelection.js';

/** Espera tras escribir en la barra antes de buscar. */
const FIND_DEBOUNCE_MS = 200;
/** Tope de rectángulos resaltados a la vez: más no aporta y cuesta pintarlos. */
const MAX_HIGHLIGHTS = 2000;

/**
 * @param {object} deps
 * @param {HTMLElement} deps.pagesEl Contenedor de las páginas.
 * @param {HTMLElement} deps.hostEl Panel de la vista previa (recibe Ctrl+F y Ctrl+C).
 * @param {Record<string, HTMLElement> | null} deps.elements bar, input, count, prev, next, caseToggle, close
 * @param {() => number} deps.getGeneration
 * @param {() => boolean} deps.isInproc
 * @param {(index: number) => number} deps.getPageHeightPt Alto (pt) de la página `index` (0-indexada).
 * @param {(page: number, yPt: number) => void} deps.scrollToPage
 * @param {(clientX: number, clientY: number) => ({page: number, xPt: number, yPt: number} | null)} deps.pointAt
 * @param {Function} deps.engineSearch
 * @param {Function} deps.enginePageText
 * @param {(key: string) => string} deps.t
 */
export function createPreviewText({ pagesEl, hostEl, elements, getGeneration, isInproc, getPageHeightPt, scrollToPage, pointAt, engineSearch, enginePageText, t }) {
  /** Coincidencias de la búsqueda vigente y el cursor «n de m» sobre ellas. */
  let matches = [];
  let cursor = createMatchCursor(matches);
  let timer = null;
  let searchToken = 0;
  /** Texto de cada página de la generación vigente (promesas). */
  const pageTexts = new Map();
  /** Selección vigente: página y fronteras de carácter. */
  let selection = null;
  let drag = null;
  let suppressClick = false;

  function pageTextFor(page) {
    const key = `${getGeneration()}:${page}`;
    if (!pageTexts.has(key)) {
      pageTexts.set(
        key,
        enginePageText(getGeneration(), page).then((result) => (result.ok ? result.value : { text: '', boxes: [] })),
      );
    }
    return pageTexts.get(key);
  }

  /** Pinta rectángulos (pt) con una clase, sustituyendo los que la tuvieran. */
  function paint(className, rects, currentIndex = -1) {
    pagesEl.querySelectorAll(`.${className}`).forEach((node) => node.remove());
    const fragment = document.createDocumentFragment();
    rects.slice(0, MAX_HIGHLIGHTS).forEach((rect, index) => {
      const pageEl = pagesEl.children[rect.page - 1];
      if (!pageEl?.classList.contains('preview-page')) return;
      const box = toCss(rect, pageEl, getPageHeightPt(rect.page - 1));
      const node = document.createElement('div');
      node.className = className + (index === currentIndex ? ' is-current' : '');
      node.style.top = `${box.top}px`;
      node.style.left = `${box.left}px`;
      node.style.width = `${box.width}px`;
      node.style.height = `${box.height}px`;
      fragment.append(node);
    });
    pagesEl.append(fragment);
  }

  // ── Buscar ────────────────────────────────────────────────────────────────
  function paintMatches() {
    const rects = [];
    let currentRect = -1;
    matches.forEach((match, i) => {
      if (i === cursor.index()) currentRect = rects.length;
      rects.push(...match.rects);
    });
    paint('preview-find-hit', rects, currentRect);
    if (elements) {
      const count = cursor.count();
      elements.count.textContent = !elements.input.value
        ? ''
        : count === 0
          ? t('previewFind.none')
          : t('previewFind.count').replace('{n}', String(cursor.index() + 1)).replace('{m}', String(count));
    }
  }

  function reveal() {
    const match = cursor.current();
    if (match) scrollToPage(match.page, match.rects[0]?.yPt ?? 0);
    paintMatches();
  }

  async function runSearch() {
    const query = elements.input.value;
    const token = ++searchToken;
    if (!query.trim() || !isInproc()) {
      matches = [];
      cursor = createMatchCursor(matches);
      paintMatches();
      return;
    }
    const caseSensitive = elements.caseToggle.getAttribute('aria-pressed') === 'true';
    const result = await engineSearch(getGeneration(), query, caseSensitive);
    if (token !== searchToken) return;
    matches = result.ok ? result.value : [];
    cursor = createMatchCursor(matches);
    reveal();
  }

  function openFind() {
    if (!elements) return;
    elements.bar.classList.remove('hidden');
    const available = isInproc();
    elements.input.disabled = !available;
    elements.caseToggle.disabled = !available;
    elements.count.textContent = available ? '' : t('previewFind.classic');
    if (available) {
      elements.input.focus();
      elements.input.select();
      if (elements.input.value) runSearch();
    }
  }

  function closeFind() {
    if (!elements) return;
    elements.bar.classList.add('hidden');
    matches = [];
    cursor = createMatchCursor(matches);
    paint('preview-find-hit', []);
    pagesEl.focus();
  }

  if (elements) {
    elements.caseToggle.setAttribute('aria-pressed', 'false');
    elements.input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(runSearch, FIND_DEBOUNCE_MS);
    });
    elements.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) cursor.prev();
        else cursor.next();
        reveal();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeFind();
      }
    });
    elements.next.addEventListener('click', () => {
      cursor.next();
      reveal();
    });
    elements.prev.addEventListener('click', () => {
      cursor.prev();
      reveal();
    });
    elements.caseToggle.addEventListener('click', () => {
      const pressed = elements.caseToggle.getAttribute('aria-pressed') === 'true';
      elements.caseToggle.setAttribute('aria-pressed', String(!pressed));
      runSearch();
    });
    elements.close.addEventListener('click', closeFind);
  }

  // ── Seleccionar y copiar ──────────────────────────────────────────────────
  function clearSelection() {
    selection = null;
    paint('preview-selection', []);
  }

  /**
   * Recalcula la selección de un arrastre. Cada arrastre numera sus
   * actualizaciones: una respuesta que llega tarde (el texto de la página se
   * pide al motor) no pisa a otra posterior, aunque el botón ya se haya soltado.
   */
  async function updateSelection(current, clientX, clientY) {
    if (!current) return;
    const seq = ++current.seq;
    const point = pointAt(clientX, clientY);
    const pageText = await pageTextFor(current.page);
    if (seq !== current.seq) return;
    // Fuera de la página de partida: hasta su principio o su final.
    let to;
    if (!point || point.page !== current.page) {
      to = point && point.page < current.page ? 0 : pageText.boxes.length;
    } else {
      to = boundaryAt(pageText, point);
    }
    const from = current.from ?? boundaryAt(pageText, current.start);
    current.from = from;
    selection = { page: current.page, from, to, pageText };
    paint('preview-selection', rangeRects(pageText, from, to, current.page));
  }

  pagesEl.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !isInproc()) return;
    const start = pointAt(event.clientX, event.clientY);
    if (!start) return;
    drag = { page: start.page, start, x: event.clientX, y: event.clientY, selecting: false, from: null, seq: 0 };
  });

  pagesEl.addEventListener('pointermove', (event) => {
    if (!drag) return;
    if (!drag.selecting && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < SELECT_THRESHOLD_PX) return;
    drag.selecting = true;
    pagesEl.classList.add('is-selecting');
    updateSelection(drag, event.clientX, event.clientY);
  });

  const endDrag = (event) => {
    if (!drag) return;
    const selected = drag.selecting;
    if (selected) {
      updateSelection(drag, event.clientX, event.clientY);
      // El clic que sigue a un arrastre no es un clic en un enlace.
      suppressClick = true;
    }
    drag = null;
    pagesEl.classList.remove('is-selecting');
    if (!selected) clearSelection();
    pagesEl.focus({ preventScroll: true });
  };
  pagesEl.addEventListener('pointerup', endDrag);
  pagesEl.addEventListener('pointercancel', () => {
    drag = null;
    pagesEl.classList.remove('is-selecting');
  });

  function selectedText() {
    return selection ? textBetween(selection.pageText, selection.from, selection.to) : '';
  }

  async function copySelection() {
    const text = selectedText();
    if (text) await navigator.clipboard?.writeText(text);
    return text;
  }

  hostEl.addEventListener('keydown', (event) => {
    const mod = event.ctrlKey || event.metaKey;
    if (!mod || event.altKey || event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key === 'f' && elements) {
      event.preventDefault();
      event.stopPropagation();
      openFind();
    } else if (key === 'c' && selection && !elements?.bar.contains(event.target)) {
      event.preventDefault();
      copySelection();
    }
  });

  return {
    openFind,
    closeFind,
    copySelection,
    selectedText,
    hasSelection: () => Boolean(selectedText()),
    /** Consume el clic que sigue a un arrastre (para no seguir un enlace). */
    consumeClick() {
      const consumed = suppressClick;
      suppressClick = false;
      return consumed;
    },
    /** El zoom cambió: los rectángulos se recolocan. */
    relayout() {
      paintMatches();
      if (selection) paint('preview-selection', rangeRects(selection.pageText, selection.from, selection.to, selection.page));
    },
    /** Hay una compilación nueva: la selección ya no vale y la búsqueda se repite. */
    onNewGeneration() {
      pageTexts.clear();
      clearSelection();
      if (elements && !elements.bar.classList.contains('hidden')) runSearch();
      else paintMatches();
    },
  };
}
