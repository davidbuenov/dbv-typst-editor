// =============================================================================
// DBV Typst Editor — Enlaces de la vista previa: decisiones puras (RF-72)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// No hay capa DOM encima del SVG (taparía la selección, el doble clic de
// RF-57 y el menú contextual): la vista previa pregunta aquí qué enlace hay
// bajo un punto de la página, con los rectángulos que da `engine_links`.

/**
 * @typedef {object} PreviewLink
 * @property {number} xPt
 * @property {number} yPt
 * @property {number} wPt
 * @property {number} hPt
 * @property {string | null} [url]
 * @property {number | null} [targetPage]
 * @property {number | null} [targetXPt]
 * @property {number | null} [targetYPt]
 */

/**
 * Enlace bajo `point` (pt de la página). Si se solapan varios, gana el más
 * pequeño: un enlace dentro de otro (una cita dentro de un párrafo enlazado)
 * es el que el usuario está señalando.
 * @param {PreviewLink[]} links
 * @param {{xPt: number, yPt: number}} point
 * @returns {PreviewLink | null}
 */
export function linkAt(links, point) {
  let best = null;
  for (const link of links) {
    const inside =
      point.xPt >= link.xPt &&
      point.xPt <= link.xPt + link.wPt &&
      point.yPt >= link.yPt &&
      point.yPt <= link.yPt + link.hPt;
    if (inside && (!best || link.wPt * link.hPt < best.wPt * best.hPt)) best = link;
  }
  return best;
}

/** Espera de un clic sobre un enlace, por si es el primero de un doble clic (R-L1). */
export const LINK_CLICK_DELAY_MS = 250;

/**
 * Distingue un clic en un enlace del primer clic de un doble clic: el clic
 * espera `delayMs` antes de navegar, y un doble clic lo cancela (entonces
 * manda la sincronización hacia el editor de RF-57).
 * @param {{delayMs?: number, onActivate: (link: PreviewLink) => void}} options
 */
export function createLinkClickGate({ delayMs = LINK_CLICK_DELAY_MS, onActivate }) {
  let timer = null;
  return {
    /** @param {PreviewLink} link */
    click(link) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        onActivate(link);
      }, delayMs);
    },
    cancel() {
      clearTimeout(timer);
      timer = null;
    },
    isPending: () => timer !== null,
  };
}

/**
 * Texto de ayuda al pasar por encima de un enlace.
 * @param {PreviewLink} link
 * @param {(key: string) => string} t
 */
export function linkTitle(link, t) {
  if (link.url) return link.url;
  return t('preview.internalLink').replace('{page}', String(link.targetPage));
}
