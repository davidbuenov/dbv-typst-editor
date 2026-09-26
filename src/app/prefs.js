// =============================================================================
// DBV Typst Editor — Preferencias del usuario (v0.10.0)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Base de los 4 ajustes nuevos de v0.10.0 (RF-63 a RF-65): ocultar dotfiles,
// números de línea, guardado automático y ruta completa. UN solo objeto en
// `localStorage`, no una clave suelta por ajuste (como hacían `preview.js` o
// `main.js` antes de esto): así un dato corrupto o de una versión futura con
// más campos se resuelve en un único sitio, con valores por defecto que NO
// cambian el comportamiento de la 0.9.0 salvo que el usuario lo pida.
//
// Mismo patrón que `i18n.js`: estado de módulo (singleton — solo hay UNAS
// preferencias para toda la aplicación) y un evento de `document` para que
// los módulos que no tienen una referencia entre sí se enteren del cambio.

const STORAGE_KEY = 'dbv-typst-prefs';
const CHANGE_EVENT = 'dbv-prefs-changed';

/**
 * @typedef {object} Prefs
 * @property {boolean} showHiddenFiles RF-63.1 — dotfiles en el panel Archivos.
 * @property {boolean} showLineNumbers RF-63.2 — números de línea del editor.
 * @property {boolean} autoSave RF-64.1 — guardado automático.
 * @property {boolean} showFullPath RF-65.2 — ruta completa en vez de solo el nombre.
 * @property {boolean} askBeforeUpdatingRefs RF-70.9 — revisar antes de reescribir referencias.
 */

/** @type {Prefs} */
const DEFAULTS = Object.freeze({
  showHiddenFiles: false,
  showLineNumbers: true,
  autoSave: false,
  showFullPath: false,
  askBeforeUpdatingRefs: false,
});

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULTS };
    // Cada campo se valida por separado: un booleano roto o una clave que ya
    // no existe (una versión futura la quitó) no invalida el resto.
    const result = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      if (typeof parsed[key] === 'boolean') result[key] = parsed[key];
    }
    return result;
  } catch {
    return { ...DEFAULTS };
  }
}

/** @type {Prefs} */
let current = readStored();

function writeStored() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Sin almacenamiento (privado, cuota agotada…) la preferencia vale solo
    // para esta sesión — no es motivo para romper nada.
  }
}

/** El objeto completo de preferencias actual. */
export function getPrefs() {
  return current;
}

/**
 * @param {keyof Prefs} key
 * @returns {boolean}
 */
export function getPref(key) {
  return current[key];
}

/**
 * @param {keyof Prefs} key
 * @param {boolean} value
 */
export function setPref(key, value) {
  if (!(key in DEFAULTS) || typeof value !== 'boolean') return;
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  writeStored();
  document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key, value } }));
}

/** @param {keyof Prefs} key */
export function togglePref(key) {
  setPref(key, !current[key]);
}

/**
 * @param {(detail: {key: keyof Prefs, value: boolean}) => void} listener
 * @returns {() => void} Función para dejar de escuchar.
 */
export function onPrefsChanged(listener) {
  const handler = (event) => listener(event.detail);
  document.addEventListener(CHANGE_EVENT, handler);
  return () => document.removeEventListener(CHANGE_EVENT, handler);
}

/** Solo para tests: vuelve a leer `localStorage` desde cero. */
export function reloadPrefsForTests() {
  current = readStored();
}
