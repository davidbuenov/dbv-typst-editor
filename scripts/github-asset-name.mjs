// =============================================================================
// DBV Typst Editor — Nombre de un asset de GitHub Releases
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// GitHub renombra al subirlo cualquier fichero cuyo nombre lleve espacios:
// `DBV Typst Editor_0.7.0_x64-setup.exe` queda como
// `DBV.Typst.Editor_0.7.0_x64-setup.exe`. El manifiesto de actualización
// (`latest.json`) tiene que apuntar al nombre que tendrá el asset YA SUBIDO, no
// al del fichero local: con el nombre local (espacios codificados como `%20`)
// la URL devolvía 404, y el auto-actualizador de Windows no podía descargar
// nada. Hallado el 2026-09-19 comprobando con `curl` los `latest.json`
// publicados de v0.6.0 y v0.7.0; los dos apuntaban a una URL inexistente.

/**
 * Nombre con el que GitHub publica un fichero subido como asset de una Release.
 * @param {string} fileName Nombre del fichero local.
 * @returns {string}
 */
export function githubAssetName(fileName) {
  return fileName.replace(/\s/g, '.');
}
