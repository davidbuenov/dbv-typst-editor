// =============================================================================
// DBV Typst Editor — Conmutación y persistencia de tema
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Mismo mecanismo que dbv-md-reader (atributo `data-theme` en <html> +
// localStorage), reducido a los dos temas que pide RF-08 y adaptado a ESM.

const STORAGE_KEY = 'dbv-typst-theme';
const THEMES = ['dark', 'light'];

/** @returns {'dark'|'light'} Tema persistido, o el del sistema, o 'dark'. */
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

/** @returns {'dark'|'light'} */
export function getTheme() {
  return currentTheme;
}

/** @param {'dark'|'light'} theme */
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

/** Alterna entre claro y oscuro. @returns {'dark'|'light'} El tema resultante. */
export function toggleTheme() {
  setTheme(currentTheme === 'dark' ? 'light' : 'dark');
  return currentTheme;
}

/** Aplica el tema inicial. Llamar lo antes posible para evitar parpadeo. */
export function initTheme() {
  setTheme(currentTheme);
}
