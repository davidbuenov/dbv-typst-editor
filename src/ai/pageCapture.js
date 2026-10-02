// =============================================================================
// DBV Typst Editor — «Adjuntar la página visible» como imagen (RF-92.3)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La vista previa pinta cada página como SVG con los glifos convertidos en
// trazos, así que basta con rasterizar el SVG de la página más visible en un
// `canvas`: sin compilar de nuevo ni exportar a disco. La imagen se envía solo
// a modelos que admiten imágenes, y solo cuando el usuario la adjunta.

/** Índice de la página que más ocupa la ventana visible del contenedor. */
export function mostVisible(rects, viewport) {
  let best = -1;
  let bestArea = 0;
  rects.forEach((rect, index) => {
    const visible = Math.max(0, Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top));
    if (visible > bestArea) {
      bestArea = visible;
      best = index;
    }
  });
  return best;
}

/**
 * PNG en base64 de la página más visible de `pagesEl`, o `null`.
 * @param {HTMLElement} pagesEl
 * @param {number} [scale] Factor sobre el tamaño en pantalla (nitidez para el modelo).
 */
export async function capturePage(pagesEl, scale = 1.6) {
  const pages = [...pagesEl.querySelectorAll('.preview-page')].filter((page) => page.querySelector('svg'));
  const index = mostVisible(pages.map((page) => page.getBoundingClientRect()), pagesEl.getBoundingClientRect());
  if (index < 0) return null;
  const svg = pages[index].querySelector('svg');
  const box = svg.getBoundingClientRect();
  const markup = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  let result = null;
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(box.width * scale));
    canvas.height = Math.max(1, Math.round(box.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    result = { mime: 'image/png', base64: canvas.toDataURL('image/png').split(',')[1], page: index + 1 };
  } catch {
    result = null;
  } finally {
    URL.revokeObjectURL(url);
  }
  return result;
}
