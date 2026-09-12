// =============================================================================
// DBV Typst Editor — Imagen pegada desde el portapapeles (RF-39)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Recortar una zona de la pantalla y pegarla en el documento no hacía nada:
// no es que fallara, es que nunca se implementó (feedback del usuario,
// 2026-09-12). Una imagen del portapapeles no tiene ruta de fichero, así que
// no puede pasar por `copy_asset_into_project` como el arrastre de RF-18 —
// llega como bytes y se guarda con `save_pasted_image`.
//
// La decisión de si un pegado trae imagen se extrae aquí como función pura,
// sin DOM ni backend, por el mismo motivo que `dropTarget.js`: es donde están
// los casos raros (un pegado mixto de texto e imagen, un tipo MIME que Typst
// no sabe incrustar) y es lo único que se puede probar sin ventana real.

/**
 * Tipos MIME de imagen que el portapapeles entrega y que Typst sabe incrustar,
 * con la extensión que les toca en disco. Deliberadamente NO incluye
 * `image/bmp`: Windows lo pone en el portapapeles con frecuencia, pero Typst
 * no lo incrusta, y guardarlo dejaría un fichero que rompe la compilación.
 */
const IMAGE_MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

/**
 * La imagen de un evento de pegado, si la hay.
 *
 * Devuelve `null` cuando el portapapeles trae texto: copiar texto desde una
 * página web arrastra a veces una imagen de adorno junto al texto, y ahí lo
 * que el usuario quiere pegar es el texto. Un recorte de pantalla, en cambio,
 * no trae `text/plain` ninguno.
 *
 * @param {DataTransfer | null} clipboardData
 * @returns {{ file: File, extension: string } | null}
 */
export function pickImageFromClipboard(clipboardData) {
  if (!clipboardData) return null;

  const types = Array.from(clipboardData.types ?? []);
  if (types.includes('text/plain')) return null;

  for (const item of Array.from(clipboardData.items ?? [])) {
    if (item.kind !== 'file') continue;
    const extension = IMAGE_MIME_EXTENSIONS[item.type];
    if (!extension) continue;
    const file = item.getAsFile();
    if (file) return { file, extension };
  }
  return null;
}

/**
 * Los bytes en base64 de un `data:` URL, sin la cabecera `data:image/png;base64,`.
 *
 * Se pasa por `FileReader.readAsDataURL` en vez de convertir el `ArrayBuffer`
 * a mano: `btoa(String.fromCharCode(...bytes))` desborda la pila de llamadas
 * con un recorte de pantalla de tamaño normal (cientos de miles de argumentos
 * en una sola llamada), y el navegador ya sabe hacer esta conversión.
 *
 * @param {string} dataUrl
 * @returns {string}
 */
export function base64FromDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(',');
  return comma === -1 ? '' : dataUrl.slice(comma + 1);
}

/**
 * Lee un `File` del portapapeles como base64 listo para `save_pasted_image`.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(base64FromDataUrl(String(reader.result)));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
