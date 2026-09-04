// =============================================================================
// DBV Typst Editor — Internacionalización (ES / EN)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Diccionario propio, sin librería externa: mismo patrón que
// dbv-md-reader/src/i18n.js (ARCHITECTURE.md §3 fila 14), adaptado a ESM.

const STORAGE_KEY = 'dbv-typst-lang';

const DICTIONARIES = {
  es: {
    'app.tagline': 'Escritura académica y técnica, sencilla. Con Typst.',
    'action.toggleTheme': 'Cambiar tema claro/oscuro',
    'action.about': 'Acerca de',
    'action.close': 'Cerrar',
    'scaffold.heading': 'Andamiaje operativo',
    'scaffold.text':
      'El shell de la aplicación arranca correctamente y el puente con el backend responde. El editor y la vista previa llegan en los siguientes slices.',
    'scaffold.appVersion': 'Versión',
    'scaffold.platform': 'Plataforma',
    'scaffold.bridge': 'Puente Tauri',
    'scaffold.typst': 'Compilador Typst',
    'about.title': 'DBV Typst Editor',
    'about.text':
      'El entorno de escritorio más accesible para el ecosistema Typst. Proyecto en construcción.',
    'bridge.ok': 'operativo',
    'bridge.fail': 'sin respuesta',
    'typst.embedded': '(embebido)',
    'typst.fail': 'sidecar no disponible',
  },
  en: {
    'app.tagline': 'Academic and technical writing made simple. Powered by Typst.',
    'action.toggleTheme': 'Toggle light/dark theme',
    'action.about': 'About',
    'action.close': 'Close',
    'scaffold.heading': 'Scaffolding is up',
    'scaffold.text':
      'The application shell starts correctly and the backend bridge responds. The editor and preview arrive in the next slices.',
    'scaffold.appVersion': 'Version',
    'scaffold.platform': 'Platform',
    'scaffold.bridge': 'Tauri bridge',
    'scaffold.typst': 'Typst compiler',
    'about.title': 'DBV Typst Editor',
    'about.text':
      'The most user-friendly desktop environment for the Typst ecosystem. Work in progress.',
    'bridge.ok': 'up',
    'bridge.fail': 'no response',
    'typst.embedded': '(embedded)',
    'typst.fail': 'sidecar unavailable',
  },
};

/** @returns {'es'|'en'} Idioma persistido, o el del sistema, o 'es'. */
function resolveInitialLanguage() {
  let resolved = 'es';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') {
      resolved = stored;
    } else if (typeof navigator !== 'undefined' && navigator.language?.startsWith('en')) {
      resolved = 'en';
    }
  } catch {
    // localStorage puede lanzar (modo privado, políticas del WebView): el
    // idioma por defecto es suficiente, no es motivo para romper el arranque.
  }
  return resolved;
}

let currentLanguage = resolveInitialLanguage();

/** @returns {'es'|'en'} */
export function getLanguage() {
  return currentLanguage;
}

/**
 * Traduce una clave. Devuelve la propia clave si no existe, para que una
 * traducción olvidada sea visible en la UI en vez de dejar un hueco en blanco.
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  return DICTIONARIES[currentLanguage][key] ?? key;
}

/**
 * Cambia el idioma activo y vuelve a aplicar las traducciones al DOM.
 * @param {'es'|'en'} language
 */
export function setLanguage(language) {
  if (language !== 'es' && language !== 'en') return;
  currentLanguage = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Ver comentario en resolveInitialLanguage().
  }
  applyTranslations();
}

/**
 * Aplica las traducciones a los elementos marcados con `data-i18n`
 * (contenido) y `data-i18n-title` (tooltip / etiqueta accesible).
 */
export function applyTranslations(root = document) {
  document.documentElement.lang = currentLanguage;

  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    const label = t(el.dataset.i18nTitle);
    el.title = label;
    el.setAttribute('aria-label', label);
  }
}
