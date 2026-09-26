// =============================================================================
// DBV Typst Editor — Utilidades de ruta
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Extraído de `workspace.js` (Beta, §7.11): `bibliography/bibEntryPanel.js`
// necesita `joinPath` y, si importara `workspace.js` directamente, se crearía
// un ciclo de módulos (`workspace.js` → `bibEntryPanel.js` → `workspace.js`).
// Estas tres funciones son puras y sin estado — el candidato natural para
// vivir en un módulo hoja del que cualquiera pueda depender sin ciclos.
// `workspace.js` las re-exporta para no romper a quien ya las importaba de ahí.

/** Une carpeta y nombre de fichero respetando el separador ya presente. */
export function joinPath(dir, name) {
  if (!dir) return name;
  const separator = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
  const trimmed = dir.endsWith('/') || dir.endsWith('\\') ? dir.slice(0, -1) : dir;
  return `${trimmed}${separator}${name}`;
}

/** True si la ruta es un documento Typst compilable. */
export function isTypstPath(path) {
  return /\.typ$/i.test(path ?? '');
}

/** Nombre de fichero de una ruta, con cualquiera de los dos separadores. */
export function baseName(path) {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index >= 0 ? path.slice(index + 1) : path;
}

/** Normaliza separadores a `/` y quita el que sobre al final. */
function normalize(path) {
  return path.split('\\').join('/').replace(/\/+$/, '');
}

/**
 * Ruta de `path` relativa a `root`, siempre con `/`, o `null` si no cuelga de
 * ella (RF-16: es la forma en que las anclas identifican cada fichero, y la
 * misma que produce `shadow::seed_anchors` en el backend).
 */
export function relativeToRoot(root, path) {
  if (!root || !path) return null;
  const normalizedRoot = normalize(root);
  const normalizedPath = normalize(path);
  if (normalizedPath === normalizedRoot) return '';
  const prefix = `${normalizedRoot}/`;
  return normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : null;
}

/**
 * Los últimos `segments` tramos de la carpeta CONTENEDORA de `path` — no de
 * `path` en sí, porque su último tramo (el nombre del proyecto o fichero) ya
 * se muestra aparte como título (RF-44). Con marca de recorte ("…") cuando
 * queda algo por delante, para no dar la impresión de que esa es la ruta
 * completa. Pensada para tarjetas de "proyectos recientes": una ruta completa
 * de Windows de varios niveles no cabe, y no aporta nada a simple vista.
 * @param {string} path
 * @param {number} [segments] Cuántos tramos de la carpeta padre mostrar.
 */
export function truncateParentPath(path, segments = 2) {
  const separator = path.includes('\\') && !path.includes('/') ? '\\' : '/';
  const parts = path.split(/[/\\]/).filter(Boolean);
  const parent = parts.slice(0, -1);
  if (parent.length === 0) return '';

  const shown = parent.slice(-segments);
  const truncated = shown.length < parent.length;
  // Una ruta Unix absoluta ("/home/...") pierde su "/" inicial al filtrar el
  // tramo vacío de delante del primer separador — se repone aquí cuando no se
  // ha recortado nada por delante (si se ha recortado, "…/" ya cumple el
  // mismo papel de "hay más por delante").
  const isAbsoluteUnix = separator === '/' && path.startsWith('/');
  const prefix = truncated ? `…${separator}` : isAbsoluteUnix ? separator : '';
  return prefix + shown.join(separator);
}

/**
 * Dónde ha quedado `path` tras los movimientos o renombrados `moved` (RF-69,
 * RF-70): si era uno de ellos o colgaba de una carpeta movida, su ruta nueva;
 * si no, la misma. Sin distinguir mayúsculas ni separador, como el sistema de
 * ficheros en Windows y macOS; el resultado usa el separador de la ruta nueva.
 * @param {string} path
 * @param {Array<{from: string, to: string}>} moved
 * @returns {string}
 */
export function remapMovedPath(path, moved) {
  if (!path) return path;
  const target = normalize(path);
  const key = target.toLowerCase();
  for (const { from, to } of moved) {
    const source = normalize(from).toLowerCase();
    if (key === source) return to;
    if (key.startsWith(`${source}/`)) {
      const rest = target.slice(source.length + 1);
      const separator = to.includes('\\') && !to.includes('/') ? '\\' : '/';
      return `${to.replace(/[\\/]+$/, '')}${separator}${rest.split('/').join(separator)}`;
    }
  }
  return path;
}
