// =============================================================================
// DBV Typst Editor — Arrastrar en el árbol: decisiones puras (RF-69.5)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Qué carpeta recibe lo que se suelta y si soltarlo ahí tiene sentido. El
// backend (`fs_move`) vuelve a comprobarlo todo; esto solo decide qué se
// resalta mientras se arrastra, para no ofrecer un destino que se rechazará.

/** Ruta normalizada para comparar: separador `/`, sin barra final, sin mayúsculas. */
const key = (path) => (path || '').replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();

/** Carpeta que contiene `path`. */
function parentKey(path) {
  const normalized = key(path);
  return normalized.slice(0, normalized.lastIndexOf('/'));
}

/**
 * Carpeta de destino al soltar sobre `over`: la propia carpeta, la carpeta del
 * fichero, o la raíz si se suelta en el hueco del árbol.
 * @param {{path: string, isDir: boolean} | null | undefined} over
 * @param {string} root
 * @returns {string}
 */
export function dropTargetDir(over, root) {
  if (!over) return root;
  if (over.isDir) return over.path;
  const cut = Math.max(over.path.lastIndexOf('/'), over.path.lastIndexOf('\\'));
  return cut > 0 ? over.path.slice(0, cut) : root;
}

/**
 * Si soltar `entries` en `destDir` movería algo: ninguna carpeta puede ir
 * dentro de sí misma, y soltar todo donde ya estaba no hace nada.
 * @param {Array<{path: string}>} entries
 * @param {string | null} destDir
 * @returns {boolean}
 */
export function isValidDrop(entries, destDir) {
  if (!destDir || entries.length === 0) return false;
  const dest = key(destDir);
  for (const entry of entries) {
    const source = key(entry.path);
    if (dest === source || dest.startsWith(`${source}/`)) return false;
  }
  return entries.some((entry) => parentKey(entry.path) !== dest);
}
