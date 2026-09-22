// =============================================================================
// DBV Typst Editor — Ruta corta y desambiguada (RF-65)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Por defecto se muestra solo el nombre del fichero en la barra del
// documento; si dos ficheros del proyecto comparten nombre, se amplía SOLO
// hasta donde sus rutas difieren (`a/main.typ` frente a `main.typ` a secas
// si el nombre es único). Función pura: no sabe nada de `.document__name` ni
// del árbol, solo de rutas — así se comprueba sin montar el espacio de
// trabajo, que hoy no tiene mecanismo para probarlo de otra forma.

/** Trocea una ruta en sus segmentos, con cualquiera de los dos separadores. */
function segments(path) {
  return path.replaceAll('\\', '/').split('/').filter(Boolean);
}

/**
 * Etiqueta corta de `path` entre `allPaths` (normalmente los ficheros
 * conocidos del proyecto, `tree.getKnownFiles()`): el nombre a secas si es
 * único entre ellos, o ampliado tramo a tramo desde el final hasta
 * distinguirse de cualquier otro con el mismo nombre.
 *
 * @param {string} path
 * @param {string[]} allPaths Incluir o no `path` no cambia el resultado.
 * @returns {string}
 */
export function shortPathLabel(path, allPaths) {
  const target = segments(path);
  if (target.length === 0) return path;
  const name = target.at(-1);

  const others = allPaths
    .filter((candidate) => candidate !== path)
    .map(segments)
    .filter((candidateSegments) => candidateSegments.at(-1) === name);

  if (others.length === 0) return name;

  for (let depth = 1; depth <= target.length; depth++) {
    const suffix = target.slice(-depth).join('/');
    const collides = others.some((candidateSegments) => candidateSegments.slice(-depth).join('/') === suffix);
    if (!collides) return suffix;
  }
  return target.join('/');
}
