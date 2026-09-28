// =============================================================================
// DBV Typst Editor — Modelo de pestañas (RF-79)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Qué pestañas hay abiertas, en qué orden y cuál está activa. Nada más: el
// contenido de cada pestaña (su `EditorState`, si está modificada, su huella
// en disco) lo guarda el workspace, indexado por la misma ruta. Separarlo así
// permite probar abrir, cerrar, reordenar, renombrar y restaurar sin montar el
// editor, igual que `entrypoint.js` con el documento principal.
//
// El modelo es inmutable: cada operación devuelve uno nuevo. Las rutas se
// comparan con `pathKey` (sin distinguir mayúsculas ni separadores en Windows
// y macOS), como el resto de la aplicación.

import { isSafeRelativePath } from './entrypoint.js';
import { isWithinAny } from './externalChange.js';
import { joinPath, pathKey, relativeToRoot, remapMovedPath } from './paths.js';

/** @typedef {{paths: string[], active: string | null}} TabsModel */

/** Clave de `localStorage` por proyecto: las pestañas son de ESE proyecto. */
export const tabsKey = (root) => `dbv-typst-tabs:${root}`;

/** @returns {TabsModel} */
export function emptyTabs() {
  return { paths: [], active: null };
}

/**
 * Posición de `path` entre las pestañas, o -1.
 * @param {TabsModel} model
 * @param {string | null | undefined} path
 */
export function indexOfTab(model, path) {
  const key = path ? pathKey(path) : null;
  return key === null ? -1 : model.paths.findIndex((candidate) => pathKey(candidate) === key);
}

/**
 * Abre `path` en una pestaña nueva a la derecha de la activa, o activa la que
 * ya lo tenía (RF-79.1: un fichero no se abre dos veces).
 * @param {TabsModel} model
 * @param {string} path
 * @returns {TabsModel}
 */
export function openTab(model, path) {
  const existing = indexOfTab(model, path);
  let result;
  if (existing >= 0) {
    result = { paths: model.paths, active: model.paths[existing] };
  } else {
    const activeIndex = indexOfTab(model, model.active);
    const insertAt = activeIndex >= 0 ? activeIndex + 1 : model.paths.length;
    const paths = [...model.paths.slice(0, insertAt), path, ...model.paths.slice(insertAt)];
    result = { paths, active: path };
  }
  return result;
}

/**
 * Activa una pestaña ya abierta. Una ruta que no está no cambia nada.
 * @param {TabsModel} model
 * @param {string} path
 * @returns {TabsModel}
 */
export function activateTab(model, path) {
  const index = indexOfTab(model, path);
  return index >= 0 ? { paths: model.paths, active: model.paths[index] } : model;
}

/**
 * Cierra una pestaña. Si era la activa, pasa a serlo la de su derecha (o la de
 * su izquierda si era la última), como en VS Code.
 * @param {TabsModel} model
 * @param {string} path
 * @returns {TabsModel}
 */
export function closeTab(model, path) {
  const index = indexOfTab(model, path);
  let result = model;
  if (index >= 0) {
    const paths = model.paths.filter((_, position) => position !== index);
    const wasActive = indexOfTab(model, model.active) === index;
    const active = wasActive ? (paths[Math.min(index, paths.length - 1)] ?? null) : model.active;
    result = { paths, active };
  }
  return result;
}

/**
 * Mueve una pestaña a la posición `toIndex` (se recorta al rango válido).
 * @param {TabsModel} model
 * @param {string} path
 * @param {number} toIndex
 * @returns {TabsModel}
 */
export function moveTab(model, path, toIndex) {
  const from = indexOfTab(model, path);
  let result = model;
  if (from >= 0) {
    const paths = [...model.paths];
    const [moved] = paths.splice(from, 1);
    const target = Math.max(0, Math.min(paths.length, Math.trunc(toIndex)));
    paths.splice(target, 0, moved);
    result = { paths, active: model.active };
  }
  return result;
}

/**
 * Pestaña siguiente (`step` = 1) o anterior (-1) a la activa, en círculo
 * (Ctrl+Tab / Ctrl+Mayús+Tab).
 * @param {TabsModel} model
 * @param {1 | -1} step
 * @returns {string | null}
 */
export function neighbourTab(model, step) {
  const count = model.paths.length;
  const index = indexOfTab(model, model.active);
  return count === 0 ? null : model.paths[(((index < 0 ? 0 : index + step) % count) + count) % count];
}

/**
 * Las pestañas siguen a sus ficheros tras mover o renombrar desde el árbol
 * (RF-69/RF-70). Si dos acaban en la misma ruta, queda una.
 * @param {TabsModel} model
 * @param {Array<{from: string, to: string}>} moved
 * @returns {TabsModel}
 */
export function remapTabPaths(model, moved) {
  const remapped = model.paths.map((path) => remapMovedPath(path, moved));
  const paths = remapped.filter((path, index) => remapped.findIndex((other) => pathKey(other) === pathKey(path)) === index);
  return { paths, active: model.active ? remapMovedPath(model.active, moved) : null };
}

/**
 * Quita las pestañas de lo eliminado (o de lo que estaba dentro de una carpeta
 * eliminada). La activa, si se va, se sustituye como en `closeTab`.
 * @param {TabsModel} model
 * @param {string[]} removed
 * @returns {TabsModel}
 */
export function removeTabPaths(model, removed) {
  let result = model;
  for (const path of model.paths) {
    if (isWithinAny(path, removed)) result = closeTab(result, path);
  }
  return result;
}

/**
 * Forma guardable de las pestañas: rutas RELATIVAS al proyecto, para que no
 * viajen rutas absolutas de otro equipo. Las de fuera del proyecto (un
 * paquete abierto en solo lectura) no se guardan.
 * @param {TabsModel} model
 * @param {string} root
 * @returns {{tabs: string[], active: string | null}}
 */
export function serializeTabs(model, root) {
  const tabs = model.paths.map((path) => relativeToRoot(root, path)).filter((relative) => isSafeRelativePath(relative));
  const active = relativeToRoot(root, model.active);
  return { tabs, active: isSafeRelativePath(active) ? active : null };
}

/**
 * Reconstruye las pestañas guardadas. El dato viene de `localStorage` y se
 * trata como no fiable: se descarta lo que no sea una ruta relativa segura
 * (sin `..`, sin raíz ni unidad) y lo que `exists` diga que ya no está.
 * @param {unknown} raw
 * @param {string} root
 * @param {(path: string) => boolean} exists
 * @returns {TabsModel}
 */
export function restoreTabs(raw, root, exists) {
  const stored = raw && typeof raw === 'object' ? /** @type {{tabs?: unknown, active?: unknown}} */ (raw) : {};
  const relatives = Array.isArray(stored.tabs) ? stored.tabs.filter((value) => isSafeRelativePath(value)) : [];
  let model = emptyTabs();
  for (const relative of relatives) {
    const path = joinPath(root, relative);
    if (exists(path) && indexOfTab(model, path) < 0) model = { paths: [...model.paths, path], active: model.active };
  }
  const active = isSafeRelativePath(stored.active) ? joinPath(root, /** @type {string} */ (stored.active)) : null;
  const activeIndex = indexOfTab(model, active);
  return { paths: model.paths, active: activeIndex >= 0 ? model.paths[activeIndex] : (model.paths[0] ?? null) };
}

/**
 * Lee las pestañas guardadas de un proyecto (sin validar: ver `restoreTabs`).
 * @param {string} root
 * @returns {unknown}
 */
export function readStoredTabs(root) {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(tabsKey(root)) ?? 'null');
  } catch {
    // JSON roto o sin almacenamiento: se empieza sin pestañas guardadas.
  }
  return raw;
}

/**
 * Guarda las pestañas de un proyecto. Sin almacenamiento, valen solo para
 * esta sesión.
 * @param {string} root
 * @param {TabsModel} model
 */
export function storeTabs(root, model) {
  try {
    localStorage.setItem(tabsKey(root), JSON.stringify(serializeTabs(model, root)));
  } catch {
    // No es motivo para impedir trabajar.
  }
}
