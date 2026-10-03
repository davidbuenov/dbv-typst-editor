// =============================================================================
// DBV Typst Editor — Última carpeta usada con un documento (RF-106.3)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// «Abrir documento», «Guardar como» y «Nuevo .typ vacío» abren el diálogo del
// sistema en la carpeta donde se usó un documento por última vez. Es una
// comodidad por equipo, no un dato del proyecto: vive en `localStorage` y, si
// no está disponible o la carpeta ya no existe, el diálogo cae a la carpeta de
// documentos del sistema (el backend ignora una carpeta que no existe).

const KEY = 'dbv-typst-last-document-dir';

/** Carpeta que contiene `path` (acepta `/` y `\`), o `null` si no tiene. */
export function folderOf(path) {
  const text = String(path ?? '');
  const cut = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
  return cut > 0 ? text.slice(0, cut) : null;
}

/** Última carpeta recordada, o `null`. */
export function getLastDocumentDir() {
  let result = null;
  try {
    result = localStorage.getItem(KEY) || null;
  } catch {
    // Sin almacenamiento (ventana privada, bloqueado): se usa la del sistema.
  }
  return result;
}

/** Recuerda la carpeta del documento `path`. No hace nada si no tiene carpeta. */
export function rememberDocumentPath(path) {
  const folder = folderOf(path);
  if (!folder) return;
  try {
    localStorage.setItem(KEY, folder);
  } catch {
    // Es una comodidad: si no se puede guardar, no pasa nada.
  }
}
