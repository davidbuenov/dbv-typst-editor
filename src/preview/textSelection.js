// =============================================================================
// DBV Typst Editor — Buscar y seleccionar en la vista previa: decisiones puras (RF-82)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Sin capa DOM de texto encima del SVG (R-P2): taparía el doble clic de
// sincronización (RF-57), la puntería de los enlaces (RF-72) y el menú
// contextual. La selección es un modelo propio sobre la capa de texto que da el
// motor (`engine_page_text`: un carácter y su caja en pt): aquí se decide qué
// carácter hay bajo el puntero, qué rectángulos pintar y qué texto copiar.
// Mismo reparto que `linkHits.js`: sin DOM, para poder probarlo.

/**
 * @typedef {{text: string, boxes: Array<[number, number, number, number]>}} PageText
 *   `text` y `boxes` van a la par por carácter (punto de código).
 */

/** Distancia (px) a partir de la cual pulsar y mover es seleccionar, no hacer clic. */
export const SELECT_THRESHOLD_PX = 4;

/** Caracteres (puntos de código) de una página, a la par de sus cajas. */
export function pageChars(pageText) {
  return Array.from(pageText.text);
}

/**
 * Frontera de carácter (0…n) más cercana a `point` (pt de la página): se elige
 * la línea que contiene el punto (o la más cercana en vertical) y, en ella, el
 * hueco entre caracteres más próximo en horizontal.
 * @param {PageText} pageText
 * @param {{xPt: number, yPt: number}} point
 * @returns {number}
 */
export function boundaryAt(pageText, point) {
  const boxes = pageText.boxes;
  let bestLine = null;
  let bestDistance = Infinity;
  for (let i = 0; i < boxes.length; i += 1) {
    const [, y, w, h] = boxes[i];
    if (w <= 0 && h <= 0) continue;
    const distance = point.yPt < y ? y - point.yPt : point.yPt > y + h ? point.yPt - (y + h) : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLine = y;
    }
  }
  let boundary = 0;
  if (bestLine !== null) {
    let first = -1;
    let last = -1;
    for (let i = 0; i < boxes.length; i += 1) {
      const [x, y, w, h] = boxes[i];
      if ((w > 0 || h > 0) && Math.abs(y - bestLine) < h * 0.5) {
        if (first < 0) first = i;
        last = i;
        if (point.xPt >= x + w / 2) boundary = i + 1;
      }
    }
    boundary = Math.min(Math.max(boundary, first), last + 1);
  }
  return boundary;
}

/**
 * Rectángulos (pt) que cubren los caracteres `from…to` de una página, uno por
 * línea.
 * @param {PageText} pageText
 * @param {number} from
 * @param {number} to
 * @param {number} page 1-indexada.
 * @returns {Array<{page: number, xPt: number, yPt: number, wPt: number, hPt: number}>}
 */
export function rangeRects(pageText, from, to, page) {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const rects = [];
  for (const [x, y, w, h] of pageText.boxes.slice(start, end)) {
    if (w <= 0 && h <= 0) continue;
    const last = rects.at(-1);
    if (last && Math.abs(last.yPt - y) < h * 0.5 && x >= last.xPt - 0.5) {
      const right = Math.max(last.xPt + last.wPt, x + w);
      last.wPt = right - last.xPt;
    } else {
      rects.push({ page, xPt: x, yPt: y, wPt: w, hPt: h });
    }
  }
  return rects;
}

/**
 * Texto de los caracteres `from…to`, sin espacios sobrantes en los extremos.
 * @param {PageText} pageText
 */
export function textBetween(pageText, from, to) {
  return pageChars(pageText)
    .slice(Math.min(from, to), Math.max(from, to))
    .join('')
    .trim();
}

/**
 * Posición en la vista previa (px, contra el contenedor de las páginas) de un
 * rectángulo en pt. La misma razón que `scrollToPage` y `placeMark`
 * (`offsetHeight / altoEnPt`), así que sigue al zoom y a «Ajustar al ancho».
 * @param {{xPt: number, yPt: number, wPt: number, hPt: number}} rect
 * @param {{offsetTop: number, offsetLeft: number, offsetHeight: number}} pageBox
 * @param {number} heightPt
 */
export function toCss(rect, pageBox, heightPt) {
  const ratio = pageBox.offsetHeight / (heightPt || pageBox.offsetHeight || 1);
  return {
    top: pageBox.offsetTop + rect.yPt * ratio,
    left: pageBox.offsetLeft + rect.xPt * ratio,
    width: rect.wPt * ratio,
    height: rect.hPt * ratio,
  };
}

/**
 * Cursor sobre las coincidencias de la búsqueda: «n de m», siguiente y
 * anterior en círculo (Intro / Mayús+Intro).
 * @param {Array<{page: number, rects: any[]}>} matches
 */
export function createMatchCursor(matches) {
  let index = matches.length > 0 ? 0 : -1;
  return {
    current: () => (index >= 0 ? matches[index] : null),
    index: () => index,
    count: () => matches.length,
    next() {
      if (matches.length > 0) index = (index + 1) % matches.length;
      return this.current();
    },
    prev() {
      if (matches.length > 0) index = (index - 1 + matches.length) % matches.length;
      return this.current();
    },
  };
}
