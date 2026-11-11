// =============================================================================
// DBV Typst Editor — Conmutación, 10 temas curados y tema personalizado (RF-122)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

const STORAGE_KEY = 'dbv-typst-theme';
const SLOTS_STORAGE_KEY = 'dbv-typst-theme-slots';
const CUSTOM_STORAGE_KEY = 'dbv-typst-custom-theme';

export const DEFAULT_THEME_SLOTS = Object.freeze(['light', 'dark', 'sepia']);

export const THEME_ICONS = Object.freeze({
  dark: '🌙',
  light: '☀️',
  sepia: '📜',
  'high-contrast': '◐',
  nord: '❄',
  dracula: '🦇',
  'catppuccin-mocha': '☕',
  'catppuccin-latte': '🥛',
  'solarized-dark': '🌊',
  'gruvbox-dark': '🌲',
  custom: '🎨',
});

/** Tokens editables en el tema personalizado y sus etiquetas CSS. */
export const CUSTOM_THEME_KEYS = Object.freeze([
  '--bg-primary',
  '--bg-secondary',
  '--bg-tertiary',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--accent',
  '--accent-hover',
  '--border',
  '--code-bg',
  '--code-keyword',
  '--code-string',
  '--code-comment',
  '--code-function',
  '--code-number',
  '--code-tag',
  '--code-class',
  '--code-operator',
]);

/** Paletas curadas (deben mantenerse alineadas con `src/themes/tokens.css`). */
export const CURATED_THEMES = Object.freeze([
  {
    id: 'dark',
    labelKey: 'theme.dark',
    isDark: true,
    tokens: {
      '--bg-primary': '#0d1117',
      '--bg-secondary': '#161b22',
      '--bg-tertiary': '#21262d',
      '--text-primary': '#f0f6fc',
      '--text-secondary': '#9da7b3',
      '--text-muted': '#848d97',
      '--accent': '#58a6ff',
      '--accent-hover': '#79c0ff',
      '--border': '#30363d',
      '--code-bg': '#161b22',
      '--code-keyword': '#e2a8ff',
      '--code-string': '#85e89d',
      '--code-comment': '#9ca3af',
      '--code-function': '#ffa657',
      '--code-number': '#79c0ff',
      '--code-tag': '#ff7b72',
      '--code-class': '#ffd580',
      '--code-operator': '#7ee7d8',
    },
  },
  {
    id: 'light',
    labelKey: 'theme.light',
    isDark: false,
    tokens: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f6f8fa',
      '--bg-tertiary': '#eaeef2',
      '--text-primary': '#1f2328',
      '--text-secondary': '#57606a',
      '--text-muted': '#636c76',
      '--accent': '#0969da',
      '--accent-hover': '#0550ae',
      '--border': '#d0d7de',
      '--code-bg': '#f6f8fa',
      '--code-keyword': '#cf222e',
      '--code-string': '#0a3069',
      '--code-comment': '#6e7781',
      '--code-function': '#8250df',
      '--code-number': '#0550ae',
      '--code-tag': '#116329',
      '--code-class': '#953800',
      '--code-operator': '#24292f',
    },
  },
  {
    id: 'sepia',
    labelKey: 'theme.sepia',
    isDark: false,
    tokens: {
      '--bg-primary': '#faf3e0',
      '--bg-secondary': '#f2e8cc',
      '--bg-tertiary': '#e8d9b5',
      '--text-primary': '#3b2c1a',
      '--text-secondary': '#6b5240',
      '--text-muted': '#765c47',
      '--accent': '#8b4513',
      '--accent-hover': '#6b340f',
      '--border': '#d4bc8a',
      '--code-bg': '#f2e8cc',
      '--code-keyword': '#9a3324',
      '--code-string': '#46613e',
      '--code-comment': '#765c47',
      '--code-function': '#8b4513',
      '--code-number': '#6b4f8f',
      '--code-tag': '#7a4419',
      '--code-class': '#8d5510',
      '--code-operator': '#5a4332',
    },
  },
  {
    id: 'high-contrast',
    labelKey: 'theme.highContrast',
    isDark: true,
    tokens: {
      '--bg-primary': '#000000',
      '--bg-secondary': '#0c0c0c',
      '--bg-tertiary': '#1c1c1c',
      '--text-primary': '#ffffff',
      '--text-secondary': '#e2e8f0',
      '--text-muted': '#b8c2cc',
      '--accent': '#4dabff',
      '--accent-hover': '#82c8ff',
      '--border': '#6b7280',
      '--code-bg': '#0c0c0c',
      '--code-keyword': '#ff7edb',
      '--code-string': '#72f1b8',
      '--code-comment': '#cbd5e1',
      '--code-function': '#ffd166',
      '--code-number': '#7cc4ff',
      '--code-tag': '#ff6b6b',
      '--code-class': '#fde047',
      '--code-operator': '#67e8f9',
    },
  },
  {
    id: 'nord',
    labelKey: 'theme.nord',
    isDark: true,
    tokens: {
      '--bg-primary': '#2e3440',
      '--bg-secondary': '#3b4252',
      '--bg-tertiary': '#434c5e',
      '--text-primary': '#eceff4',
      '--text-secondary': '#d8dee9',
      '--text-muted': '#aeb9cc',
      '--accent': '#88c0d0',
      '--accent-hover': '#8fbcbb',
      '--border': '#4c566a',
      '--code-bg': '#3b4252',
      '--code-keyword': '#9ec0e6',
      '--code-string': '#a3be8c',
      '--code-comment': '#aeb9cc',
      '--code-function': '#88c0d0',
      '--code-number': '#d4a6cb',
      '--code-tag': '#eb8b93',
      '--code-class': '#ebcb8b',
      '--code-operator': '#8fbcbb',
    },
  },
  {
    id: 'dracula',
    labelKey: 'theme.dracula',
    isDark: true,
    tokens: {
      '--bg-primary': '#282a36',
      '--bg-secondary': '#21222c',
      '--bg-tertiary': '#343746',
      '--text-primary': '#f8f8f2',
      '--text-secondary': '#cbd2e6',
      '--text-muted': '#98a2c7',
      '--accent': '#bd93f9',
      '--accent-hover': '#d1b3ff',
      '--border': '#44475a',
      '--code-bg': '#21222c',
      '--code-keyword': '#ff79c6',
      '--code-string': '#f1fa8c',
      '--code-comment': '#9ca7cc',
      '--code-function': '#50fa7b',
      '--code-number': '#bd93f9',
      '--code-tag': '#ff6e6e',
      '--code-class': '#ffb86c',
      '--code-operator': '#8be9fd',
    },
  },
  {
    id: 'catppuccin-mocha',
    labelKey: 'theme.catppuccinMocha',
    isDark: true,
    tokens: {
      '--bg-primary': '#1e1e2e',
      '--bg-secondary': '#181825',
      '--bg-tertiary': '#313244',
      '--text-primary': '#cdd6f4',
      '--text-secondary': '#bac2de',
      '--text-muted': '#9399b2',
      '--accent': '#89b4fa',
      '--accent-hover': '#b4befe',
      '--border': '#45475a',
      '--code-bg': '#181825',
      '--code-keyword': '#cba6f7',
      '--code-string': '#a6e3a1',
      '--code-comment': '#9399b2',
      '--code-function': '#89b4fa',
      '--code-number': '#fab387',
      '--code-tag': '#f38ba8',
      '--code-class': '#f9e2af',
      '--code-operator': '#94e2d5',
    },
  },
  {
    id: 'catppuccin-latte',
    labelKey: 'theme.catppuccinLatte',
    isDark: false,
    tokens: {
      '--bg-primary': '#eff1f5',
      '--bg-secondary': '#e6e9ef',
      '--bg-tertiary': '#dce0e8',
      '--text-primary': '#2e3248',
      '--text-secondary': '#4c4f69',
      '--text-muted': '#6c6f85',
      '--accent': '#1e66f5',
      '--accent-hover': '#1750c4',
      '--border': '#bcc0cc',
      '--code-bg': '#e6e9ef',
      '--code-keyword': '#7830c9',
      '--code-string': '#2c6d24',
      '--code-comment': '#5c5f77',
      '--code-function': '#1754cc',
      '--code-number': '#9c4200',
      '--code-tag': '#b00d2e',
      '--code-class': '#995c00',
      '--code-operator': '#0e6b73',
    },
  },
  {
    id: 'solarized-dark',
    labelKey: 'theme.solarizedDark',
    isDark: true,
    tokens: {
      '--bg-primary': '#002b36',
      '--bg-secondary': '#073642',
      '--bg-tertiary': '#0c4654',
      '--text-primary': '#eee8d5',
      '--text-secondary': '#b9c4c2',
      '--text-muted': '#8ea0a0',
      '--accent': '#3ea1e6',
      '--accent-hover': '#62b6f0',
      '--border': '#175160',
      '--code-bg': '#073642',
      '--code-keyword': '#a2be1a',
      '--code-string': '#39bfb2',
      '--code-comment': '#93a1a1',
      '--code-function': '#4fa9eb',
      '--code-number': '#ee7db3',
      '--code-tag': '#f0655d',
      '--code-class': '#d7a61d',
      '--code-operator': '#95a4f0',
    },
  },
  {
    id: 'gruvbox-dark',
    labelKey: 'theme.gruvboxDark',
    isDark: true,
    tokens: {
      '--bg-primary': '#282828',
      '--bg-secondary': '#1d2021',
      '--bg-tertiary': '#3c3836',
      '--text-primary': '#ebdbb2',
      '--text-secondary': '#d5c4a1',
      '--text-muted': '#a89984',
      '--accent': '#83a598',
      '--accent-hover': '#8ec07c',
      '--border': '#504945',
      '--code-bg': '#1d2021',
      '--code-keyword': '#fb6f5f',
      '--code-string': '#b8bb26',
      '--code-comment': '#a89984',
      '--code-function': '#8ec07c',
      '--code-number': '#d3869b',
      '--code-tag': '#fe8019',
      '--code-class': '#fabd2f',
      '--code-operator': '#83a598',
    },
  },
]);

const CURATED_BY_ID = new Map(CURATED_THEMES.map((item) => [item.id, item]));
export const ALL_THEME_IDS = Object.freeze([...CURATED_THEMES.map((item) => item.id), 'custom']);

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHex(hex) {
  if (typeof hex !== 'string') return null;
  const trimmed = hex.trim();
  const match = HEX_COLOR_RE.exec(trimmed);
  if (!match) return null;
  const body = match[1];
  if (body.length === 3) {
    return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`.toLowerCase();
  }
  return `#${body.toLowerCase()}`;
}

/** Luminancia relativa WCAG 2.1 (`0` negro..`1` blanco) de un color hex. */
export function relativeLuminance(hex) {
  const full = normalizeHex(hex);
  if (!full) return null;
  const channels = [0, 2, 4].map((offset) => {
    const c = Number.parseInt(full.slice(1 + offset, 3 + offset), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Ratio de contraste WCAG 2.1 (`1..21`) entre dos colores hex. */
export function contrastRatio(fgHex, bgHex) {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  if (l1 === null || l2 === null) return 1;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isDarkHex(hex) {
  const lum = relativeLuminance(hex);
  return lum === null ? true : lum <= 0.18;
}

function loadCustomThemeFromStorage() {
  const fallback = { ...CURATED_BY_ID.get('dark').tokens };
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    for (const key of CUSTOM_THEME_KEYS) {
      const hex = normalizeHex(parsed[key]);
      if (hex) fallback[key] = hex;
    }
  } catch {
    // localStorage no disponible o JSON dañado: usa copia de `dark`.
  }
  return fallback;
}

let customTokens = loadCustomThemeFromStorage();

function loadThemeSlotsFromStorage() {
  try {
    const raw = localStorage.getItem(SLOTS_STORAGE_KEY);
    if (!raw) return [...DEFAULT_THEME_SLOTS];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 3 && parsed.every((id) => ALL_THEME_IDS.includes(id))) {
      return [...parsed];
    }
  } catch {
    // Sin almacenamiento o formato antiguo.
  }
  return [...DEFAULT_THEME_SLOTS];
}

let themeSlots = loadThemeSlotsFromStorage();
const themeListeners = new Set();

function notifyThemeChanged(theme) {
  for (const listener of themeListeners) listener(theme);
}

export function onThemeChanged(listener) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

export function getCustomTheme() {
  return { ...customTokens };
}

function clearCustomCssVars() {
  const style = document.documentElement?.style;
  if (!style) return;
  for (const key of CUSTOM_THEME_KEYS) style.removeProperty(key);
  style.removeProperty('--band-hint');
}

function applyCustomCssVars(tokens) {
  const style = document.documentElement?.style;
  if (!style) return;
  for (const key of CUSTOM_THEME_KEYS) {
    if (tokens[key]) style.setProperty(key, tokens[key]);
  }
  style.setProperty('--band-hint', tokens['--accent']);
}

export function setCustomTheme(nextTokens, { baseThemeId } = {}) {
  const seed = CURATED_BY_ID.get(baseThemeId)?.tokens ?? customTokens;
  const merged = { ...seed };
  if (nextTokens && typeof nextTokens === 'object') {
    for (const key of CUSTOM_THEME_KEYS) {
      const hex = normalizeHex(nextTokens[key]);
      if (hex) merged[key] = hex;
    }
  }
  customTokens = merged;
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customTokens));
  } catch {
    // Ignorado si no hay almacenamiento.
  }
  if (currentTheme === 'custom') {
    applyCustomCssVars(customTokens);
    notifyThemeChanged('custom');
  }
  return getCustomTheme();
}

export function resetCustomTheme(baseThemeId = 'dark') {
  const base = CURATED_BY_ID.get(baseThemeId)?.tokens ?? CURATED_BY_ID.get('dark').tokens;
  return setCustomTheme(base, { baseThemeId });
}

export function getThemeSlots() {
  return [...themeSlots];
}

export function setThemeSlot(slotIndex, themeId) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 2) return getThemeSlots();
  if (!ALL_THEME_IDS.includes(themeId)) return getThemeSlots();
  themeSlots = themeSlots.map((id, i) => (i === slotIndex ? themeId : id));
  try {
    localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(themeSlots));
  } catch {
    // Ignorado si no hay almacenamiento.
  }
  notifyThemeChanged(currentTheme);
  return getThemeSlots();
}

export function isDarkTheme(theme = currentTheme) {
  if (theme === 'custom') return isDarkHex(customTokens['--bg-primary']);
  return CURATED_BY_ID.get(theme)?.isDark ?? true;
}

export function getThemeDescriptor(themeId) {
  if (themeId === 'custom') {
    return {
      id: 'custom',
      labelKey: 'theme.custom',
      icon: THEME_ICONS.custom,
      isDark: isDarkTheme('custom'),
      tokens: getCustomTheme(),
    };
  }
  const found = CURATED_BY_ID.get(themeId);
  return found ? { ...found, icon: THEME_ICONS[found.id] ?? '🎨' } : null;
}

/** @returns {string} Tema persistido, o el del sistema, o 'dark'. */
function resolveInitialTheme() {
  let resolved = 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (ALL_THEME_IDS.includes(stored)) {
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

/** @returns {string} */
export function getTheme() {
  return currentTheme;
}

/** @param {string} theme */
export function setTheme(theme) {
  if (!ALL_THEME_IDS.includes(theme)) return;
  currentTheme = theme;
  if (theme === 'custom') {
    document.documentElement.dataset.theme = isDarkTheme('custom') ? 'dark' : 'light';
    applyCustomCssVars(customTokens);
  } else {
    clearCustomCssVars();
    document.documentElement.dataset.theme = theme;
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ver comentario en resolveInitialTheme().
  }
  notifyThemeChanged(currentTheme);
}

/**
 * Alterna entre los temas asignados a los 3 botones rápidos de cabecera (o
 * toda la lista curada si el usuario usa el menú de macOS).
 */
export function cycleTheme() {
  const slots = getThemeSlots();
  const index = slots.indexOf(currentTheme);
  const next = index === -1 ? slots[0] : slots[(index + 1) % slots.length];
  setTheme(next);
  return currentTheme;
}

/** Aplica el tema inicial. Llamar lo antes posible para evitar parpadeo. */
export function initTheme() {
  setTheme(currentTheme);
}

/** Recarga el estado desde `localStorage` en tests unitarios. */
export function reloadThemeForTests() {
  customTokens = loadCustomThemeFromStorage();
  themeSlots = loadThemeSlotsFromStorage();
  currentTheme = resolveInitialTheme();
  setTheme(currentTheme);
}
