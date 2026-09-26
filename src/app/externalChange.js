// =============================================================================
// DBV Typst Editor — Cambio externo decidido por contenido: decisiones puras (RF-68)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Hasta la 0.10.0, cualquier aviso del observador sobre el documento abierto
// que llegara más de 1,5 s después de un guardado propio se tomaba por un
// cambio real. En Windows, `notify` avisa también cuando el antivirus, el
// indexador o un cliente de sincronización tocan los ATRIBUTOS del fichero, y
// eso hacía saltar el diálogo de conflicto una y otra vez con el guardado
// automático encendido. Ahora manda el contenido: solo hay cambio externo si
// la huella del disco (`file_fingerprint`) no es la última que conocemos.
//
// Mismo patrón que `autoSave.js`: aquí el "qué hacer", en `workspace.js` el
// "cómo hacerlo".

/**
 * Qué hacer con un aviso del observador sobre el documento abierto.
 *
 * - `defer`: hay un guardado en vuelo. Su hash nuevo aún no ha llegado, así
 *   que comparar ahora daría un conflicto falso (el disco ya tiene lo nuevo y
 *   nosotros aún conocemos lo viejo). Se reevalúa al terminar el guardado.
 * - `ignore`: operación propia en curso, o el contenido es el que ya conocemos.
 * - `missing`: el fichero ha desaparecido del disco.
 * - `reload`: cambio real sin cambios locales → recarga silenciosa.
 * - `ask`: cambio real con cambios locales → conflicto, se pregunta.
 *
 * @param {{
 *   knownHash: string | null | undefined,
 *   fingerprint: {missing: boolean, contentHash: string | null},
 *   dirty: boolean,
 *   saving?: boolean,
 *   ownOperation?: boolean,
 * }} input
 * @returns {'defer' | 'ignore' | 'missing' | 'reload' | 'ask'}
 */
export function decideExternalChange({ knownHash, fingerprint, dirty, saving = false, ownOperation = false }) {
  if (saving) return 'defer';
  if (ownOperation) return 'ignore';
  if (fingerprint.missing) return 'missing';
  if (fingerprint.contentHash === knownHash) return 'ignore';
  return dirty ? 'ask' : 'reload';
}

/**
 * Si, justo antes de guardar, el disco tiene un contenido distinto del último
 * conocido (RF-07 + RF-68). Un fichero que ya no existe no es un conflicto:
 * guardar lo vuelve a crear.
 * @param {{knownHash: string | null | undefined, fingerprint: {missing: boolean, contentHash: string | null}}} input
 * @returns {boolean}
 */
export function changedOnDiskBeforeSave({ knownHash, fingerprint }) {
  if (fingerprint.missing) return false;
  return fingerprint.contentHash !== knownHash;
}

/**
 * Si `path` es alguna de `roots` o está dentro de alguna (una carpeta que se
 * está moviendo arrastra a todo lo que contiene). Sin distinguir mayúsculas ni
 * el separador, igual que el sistema de ficheros en Windows y macOS: una ruta
 * de más aquí solo silencia un aviso, nunca pierde datos.
 * @param {string} path
 * @param {Iterable<string>} roots
 * @returns {boolean}
 */
export function isWithinAny(path, roots) {
  const normalize = (value) => value.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
  const target = normalize(path);
  for (const root of roots) {
    const base = normalize(root);
    if (target === base || target.startsWith(`${base}/`)) return true;
  }
  return false;
}
