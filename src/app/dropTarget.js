// =============================================================================
// DBV Typst Editor — Destino de un soltado de ficheros (RF-18)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Hasta v0.4.0, soltar una imagen fuera del panel del editor no hacía nada, y
// además lo hacía en silencio: un usuario que la soltaba sobre el explorador de
// proyecto creía que la función no existía. Las fuentes, en cambio, siempre se
// aceptaron en cualquier parte de la ventana. RF-18 iguala las dos: la imagen se
// copia se suelte donde se suelte, y solo se INSERTA en el documento si además
// cayó sobre el editor, que es el único sitio donde hay un cursor con contexto.
//
// La decisión se extrae aquí como función pura, sin DOM, para poder testear la
// aritmética de coordenadas —que es donde estaba el error fácil— igual que se
// testeó `toolbarActions.js`.

/**
 * @typedef {object} DropDecision
 * @property {boolean} copy Copiar el fichero al proyecto.
 * @property {boolean} insert Insertar además la figura en el cursor.
 */

/**
 * Qué hacer con una imagen soltada en `position`.
 *
 * `position` llega en píxeles FÍSICOS de ventana (evento nativo de Tauri) y
 * `editorRect` en píxeles lógicos (`getBoundingClientRect`), así que hay que
 * pasar por `devicePixelRatio` antes de compararlos — en una pantalla con
 * escalado distinto de 1 la comparación directa cae siempre fuera del editor.
 *
 * @param {{x: number, y: number}} position Posición del soltado, píxeles físicos.
 * @param {{left: number, right: number, top: number, bottom: number} | null} editorRect
 * @param {number} devicePixelRatio
 * @returns {DropDecision}
 */
export function decideImageDrop(position, editorRect, devicePixelRatio) {
  const ratio = devicePixelRatio || 1;
  const x = position.x / ratio;
  const y = position.y / ratio;
  const onEditor = Boolean(
    editorRect &&
      x >= editorRect.left &&
      x <= editorRect.right &&
      y >= editorRect.top &&
      y <= editorRect.bottom,
  );
  return { copy: true, insert: onEditor };
}

/**
 * Rutas de `paths` cuya extensión está en `extensions` (sin punto, minúsculas).
 * La lista viene de Rust (`supported_asset_extensions`), única fuente de verdad:
 * antes se mantenía a mano en el frontend y se había desincronizado.
 *
 * @param {string[]} paths
 * @param {string[]} extensions
 * @returns {string[]}
 */
export function pathsWithExtension(paths, extensions) {
  const allowed = new Set(extensions.map((extension) => extension.toLowerCase()));
  return paths.filter((path) => {
    const dot = path.lastIndexOf('.');
    return dot !== -1 && allowed.has(path.slice(dot + 1).toLowerCase());
  });
}
