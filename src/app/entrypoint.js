// =============================================================================
// DBV Typst Editor — Documento principal elegido a mano
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Sin `main.typ`, el backend escoge el primer `.typ` alfabético, que en un libro
// real (`z6-IPbook`) era `CexsTasks.typ` y no `IP.typ`. Aquí vive la elección
// del usuario: por proyecto, en el almacenamiento de la app y sin escribir nada
// en su carpeta. Funciones sin estado para poder probarlas sin montar el
// espacio de trabajo entero.

import { isTypstPath, relativeToRoot } from './paths.js';

/** Clave por proyecto: el documento principal es una decisión de ESE proyecto. */
export const entrypointKey = (root) => `dbv-typst-entrypoint:${root}`;

/**
 * True si `value` es una ruta relativa SEGURA dentro del proyecto: sin
 * segmentos `..`, sin empezar por `/` ni `\`, sin letra de unidad. El valor
 * guardado acaba formando la ruta del documento que se compila (`joinPath(root,
 * value)`); tratarlo como dato no fiable evita que un valor manipulado —o de
 * una versión futura con otro formato— apunte fuera de la carpeta del proyecto.
 */
export function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value === '') return false;
  const startsAbsolute = /^([\\/]|[A-Za-z]:)/.test(value);
  const escapes = value.split(/[\\/]/).includes('..');
  return !startsAbsolute && !escapes;
}

/** Documento principal guardado para `root` (ruta relativa segura), o `null`. */
export function readStoredEntrypoint(root) {
  let stored = null;
  try {
    stored = localStorage.getItem(entrypointKey(root));
  } catch {
    // Sin almacenamiento no hay elección guardada.
  }
  return isSafeRelativePath(stored) ? stored : null;
}

/** Guarda la elección. Sin almacenamiento vale solo para esta sesión. */
export function storeEntrypoint(root, relative) {
  try {
    localStorage.setItem(entrypointKey(root), relative);
  } catch {
    // No es motivo para impedir la elección.
  }
}

/**
 * Ruta relativa a la raíz que se guardaría como documento principal, o `null`
 * si `path` no puede serlo: no hay proyecto, es un `.typ` suelto (él MISMO es su
 * documento), no es un `.typ`, o no cuelga de la raíz del proyecto.
 *
 * @param {null | {root: string, isSingleFile: boolean}} project
 * @param {string | null | undefined} path Ruta absoluta del fichero candidato.
 * @returns {string | null}
 */
export function resolveEntrypoint(project, path) {
  if (!project || project.isSingleFile || !isTypstPath(path)) return null;
  return relativeToRoot(project.root, path) || null;
}
