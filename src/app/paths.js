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
