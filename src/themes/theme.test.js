// =============================================================================
// DBV Typst Editor — Tests de los 10 temas curados, WCAG AA y tema custom (RF-122)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_THEME_IDS,
  CURATED_THEMES,
  DEFAULT_THEME_SLOTS,
  contrastRatio,
  cycleTheme,
  getCustomTheme,
  getTheme,
  getThemeDescriptor,
  getThemeSlots,
  isDarkTheme,
  reloadThemeForTests,
  resetCustomTheme,
  setCustomTheme,
  setTheme,
  setThemeSlot,
} from './theme.js';
import { createThemeDialog } from './themeDialog.js';

const TOKENS_CSS = readFileSync(resolve(process.cwd(), 'src/themes/tokens.css'), 'utf8');

function extractThemeBlockVars(themeId) {
  const escaped = themeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = themeId === 'dark'
    ? new RegExp(`(?::root,\\s*)?\\[data-theme='dark'\\]\\s*\\{([\\s\\S]*?)\\}`, 'm')
    : new RegExp(`\\[data-theme='${escaped}'\\]\\s*\\{([\\s\\S]*?)\\}`, 'm');
  const match = matcher.exec(TOKENS_CSS);
  expect(match, `Falta el bloque CSS para [data-theme='${themeId}']`).not.toBeNull();
  const vars = {};
  for (const line of match[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    vars[line[1]] = line[2].trim();
  }
  return vars;
}

describe('catálogo de 10 temas curados y contraste WCAG (RF-122)', () => {
  it('declara exactamente 10 temas curados incluyendo los 3 originales', () => {
    expect(CURATED_THEMES.map((t) => t.id)).toEqual([
      'dark',
      'light',
      'sepia',
      'high-contrast',
      'nord',
      'dracula',
      'catppuccin-mocha',
      'catppuccin-latte',
      'solarized-dark',
      'gruvbox-dark',
    ]);
    expect(ALL_THEME_IDS).toContain('custom');
  });

  it('cada uno de los 10 temas curados declara todos los tokens requeridos y alcanza contraste WCAG AA', () => {
    const requiredTokens = Object.keys(extractThemeBlockVars('dark'));
    const contrastTokens = [
      '--text-primary',
      '--text-secondary',
      '--code-keyword',
      '--code-string',
      '--code-comment',
      '--code-function',
      '--code-number',
      '--code-tag',
      '--code-class',
      '--code-operator',
    ];

    for (const theme of CURATED_THEMES) {
      const cssVars = extractThemeBlockVars(theme.id);
      for (const token of requiredTokens) {
        expect(cssVars[token], `${theme.id} omite ${token} en tokens.css`).toBeTruthy();
      }
      const bg = cssVars['--bg-primary'];
      for (const fgToken of contrastTokens) {
        const ratio = contrastRatio(cssVars[fgToken], bg);
        expect(ratio, `${theme.id}: ${fgToken} (${cssVars[fgToken]}) sobre ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        expect(cssVars[fgToken].toLowerCase()).toBe(theme.tokens[fgToken].toLowerCase());
      }
      expect(isDarkTheme(theme.id)).toBe(theme.isDark);
    }
  });
});

describe('gestión de tema activo, slots de botones y tema personalizado (RF-122)', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadThemeForTests();
  });

  it('aplica cualquiera de los 10 temas curados en data-theme y limpia overrides custom', () => {
    setTheme('custom');
    expect(document.documentElement.style.getPropertyValue('--bg-primary')).not.toBe('');

    setTheme('nord');
    expect(getTheme()).toBe('nord');
    expect(document.documentElement.dataset.theme).toBe('nord');
    expect(document.documentElement.style.getPropertyValue('--bg-primary')).toBe('');
  });

  it('el tema personalizado permite editar colores, heredar dark/light y restaurar desde un curado', () => {
    setCustomTheme({ '--bg-primary': '#ffffff', '--text-primary': '#111111' }, { baseThemeId: 'light' });
    setTheme('custom');
    expect(getTheme()).toBe('custom');
    expect(isDarkTheme('custom')).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--bg-primary')).toBe('#ffffff');

    resetCustomTheme('dracula');
    expect(isDarkTheme('custom')).toBe(true);
    expect(getCustomTheme()['--accent']).toBe(getThemeDescriptor('dracula').tokens['--accent']);
  });

  it('los 3 botones rápidos empiezan en light/dark/sepia y permiten asignar cualquier tema', () => {
    expect(getThemeSlots()).toEqual([...DEFAULT_THEME_SLOTS]);
    const updated = setThemeSlot(1, 'nord');
    setThemeSlot(2, 'custom');
    expect(updated).toEqual(['light', 'nord', 'sepia']);
    expect(getThemeSlots()).toEqual(['light', 'nord', 'custom']);

    setTheme('light');
    expect(cycleTheme()).toBe('nord');
    expect(cycleTheme()).toBe('custom');
    expect(cycleTheme()).toBe('light');
  });

  it('devuelve métricas de contraste coherentes', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 2);
  });
});

describe('createThemeDialog — UI de temas, botones rápidos y personalizado (RF-122)', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadThemeForTests();
  });

  it('muestra 11 tarjetas (10 curados + custom), asigna slots rápidos y clona/edita el tema custom', () => {
    const body = document.createElement('div');
    const dialog = createThemeDialog({ bodyEl: body, t: (k) => k });
    dialog.render();

    const cards = body.querySelectorAll('.theme-card');
    expect(cards.length).toBe(11);

    body.querySelector('.theme-card[data-theme-id="dracula"]').click();
    expect(getTheme()).toBe('dracula');

    const slotSelect = body.querySelector('.theme-slots__select[data-slot-index="1"]');
    slotSelect.value = 'nord';
    slotSelect.dispatchEvent(new Event('change'));
    expect(getThemeSlots()[1]).toBe('nord');

    const baseSelect = body.querySelector('.theme-custom__base');
    baseSelect.value = 'catppuccin-latte';
    body.querySelector('[data-action="clone-theme"]').click();
    expect(getTheme()).toBe('custom');
    expect(isDarkTheme('custom')).toBe(false);

    const bgInput = body.querySelector('.theme-custom__color[data-token="--bg-primary"]');
    bgInput.value = '#101010';
    bgInput.dispatchEvent(new Event('input'));
    expect(getCustomTheme()['--bg-primary']).toBe('#101010');
  });
});
