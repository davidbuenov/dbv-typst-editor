// =============================================================================
// DBV Typst Editor — Búsqueda en la tabla de anclas (RF-16)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La tabla la produce `typst_sync_anchors` en orden de documento. Aquí viven las
// dos búsquedas que la explotan, como funciones puras: son donde está la
// aritmética delicada del Slice 30, y se pueden comprobar sin DOM ni compilador.
//
// Dos salvedades medidas en el Spike S-2, ambas con su test:
//
//   · En un documento a DOS COLUMNAS la segunda columna tiene una `y` MENOR que
//     la primera. Ordenar por (página, y) desordena la tabla; la clave correcta
//     es (página, banda de x, y).
//   · Los FLOTANTES no se resuelven por posición: `location().position()` de una
//     `figure(placement: top)` devuelve dónde estaba en el flujo, no dónde se
//     dibuja, así que un clic encima puede no tener ninguna ancla por delante.
//     Por eso el camino inverso cae al ancla más cercana en distancia absoluta
//     en vez de rendirse.

/** Ancho de la banda en puntos con el que se agrupan las columnas. */
const COLUMN_BAND_PT = 40;

const band = (xPt) => Math.round(xPt / COLUMN_BAND_PT);

/** Orden de lectura: página, después columna, después altura. */
function compareReadingOrder(a, b) {
  if (a.page !== b.page) return a.page - b.page;
  if (band(a.xPt) !== band(b.xPt)) return band(a.xPt) - band(b.xPt);
  return a.yPt - b.yPt;
}

/**
 * Ancla que corresponde a un punto de la vista previa (render → editor).
 *
 * Primero se busca la última ancla que precede al punto en orden de lectura, que
 * es el caso normal. Si no hay ninguna —un clic sobre una figura flotante, que
 * se dibuja por encima de todas las anclas de su página— se cae a la más cercana
 * en distancia absoluta, que es aproximada pero mucho mejor que no hacer nada.
 *
 * @param {Array<{file: string, line: number, page: number, xPt: number, yPt: number}>} anchors
 * @param {{page: number, xPt: number, yPt: number}} point
 * @returns {object | null}
 */
export function anchorAtPoint(anchors, point) {
  if (!anchors || anchors.length === 0) return null;

  let previous = null;
  for (const anchor of anchors) {
    if (compareReadingOrder(anchor, point) <= 0) previous = anchor;
    else break;
  }
  if (previous) return previous;

  // Sin ancla por delante: la más cercana en distancia, con las páginas pesando
  // mucho más que los puntos dentro de una página.
  const distance = (anchor) =>
    Math.abs(anchor.page - point.page) * 10000 +
    Math.abs(anchor.yPt - point.yPt) +
    Math.abs(anchor.xPt - point.xPt);

  return anchors.reduce(
    (best, anchor) => (distance(anchor) < distance(best) ? anchor : best),
    anchors[0],
  );
}

/** Alto por defecto de la marca cuando no se sabe dónde acaba el bloque, en puntos. */
const DEFAULT_SPAN_PT = 60;

/**
 * Alto en puntos del bloque que empieza en `anchor`: hasta la ancla siguiente si
 * cae en la MISMA página y columna por debajo; si no (último bloque de la
 * página, o el siguiente está en otra columna), un alto por defecto. Sirve para
 * pintar la marca visual del salto de sincronización.
 *
 * @param {Array<{page: number, xPt: number, yPt: number}>} anchors
 * @param {{page: number, xPt: number, yPt: number}} anchor
 * @returns {number}
 */
export function anchorSpan(anchors, anchor) {
  const index = anchors ? anchors.indexOf(anchor) : -1;
  const next = index >= 0 ? anchors[index + 1] : null;
  const sameColumnBelow =
    next && next.page === anchor.page && band(next.xPt) === band(anchor.xPt) && next.yPt > anchor.yPt;
  return sameColumnBelow ? next.yPt - anchor.yPt : DEFAULT_SPAN_PT;
}

/**
 * Posición del render que corresponde a una línea del fuente (editor → render).
 *
 * Se busca dentro del mismo fichero la última ancla cuya línea no pasa de la
 * pedida: es el bloque en el que está el cursor. Si el cursor está por encima
 * del primer bloque, vale la primera ancla del fichero.
 *
 * @param {Array<{file: string, line: number, page: number, xPt: number, yPt: number}>} anchors
 * @param {string} file Ruta relativa a la raíz del proyecto, con `/`.
 * @param {number} line Línea 1-indexada.
 * @returns {object | null}
 */
export function anchorForLine(anchors, file, line) {
  if (!anchors || anchors.length === 0) return null;

  const normalized = file.replace(/\\/g, '/').replace(/^\//, '');
  const ofFile = anchors.filter((anchor) => anchor.file === normalized);
  if (ofFile.length === 0) return null;

  let best = ofFile[0];
  for (const anchor of ofFile) {
    if (anchor.line <= line) best = anchor;
    else break;
  }
  return best;
}
