// =============================================================================
// DBV Typst Editor — Conmutación y persistencia de tema
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Mismo mecanismo que dbv-md-reader (atributo `data-theme` en <html> +
// localStorage), adaptado a ESM. El tercer tema, Sepia, llega por petición
// directa de un usuario que ya lo conocía de dbv-md-reader — mismos valores
// exactos (`tokens.css`), sin inventar una paleta nueva.

const STORAGE_KEY = 'dbv-typst-theme';
const THEMES = ['dark', 'light', 'sepia'];

/** @returns {'dark'|'light'|'sepia'} Tema persistido, o el del sistema, o 'dark'. */
function resolveInitialTheme() {
  let resolved = 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(stored)) {
      resolved = stored;
    } else if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      resolved = 'light';
    }
  } catch {
    // localStorage puede lanzar en algunos WebViews: el tema por defecto basta.
  }
  return resolved;
}

let currentTheme = resolveInitialTheme();

/** @returns {'dark'|'light'|'sepia'} */
export function getTheme() {
  return currentTheme;
}

/** @param {'dark'|'light'|'sepia'} theme */
export function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ver comentario en resolveInitialTheme().
  }
}

/**
 * Pasa al siguiente tema en orden fijo (oscuro → claro → sepia → oscuro...).
 * Con tres temas ya no tiene sentido un botón único de alternancia binaria
 * (RF-08 pedía solo claro/oscuro) — la cabecera usa un selector de tres
 * botones que llaman a `setTheme` directamente; esta función solo la usa el
 * menú nativo de macOS (Slice 24), que sigue siendo un único atajo de teclado
 * y necesita "el siguiente", no "uno concreto".
 * @returns {'dark'|'light'|'sepia'} El tema resultante.
 */
export function cycleTheme() {
  const index = THEMES.indexOf(currentTheme);
  setTheme(THEMES[(index + 1) % THEMES.length]);
  return currentTheme;
}

/** Aplica el tema inicial. Llamar lo antes posible para evitar parpadeo. */
export function initTheme() {
  setTheme(currentTheme);
}
