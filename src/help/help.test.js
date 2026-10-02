// =============================================================================
// DBV Typst Editor — Test del panel de Ayuda
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const openExternalUrl = vi.fn();
vi.mock('../services/backend.js', () => ({ openExternalUrl: (...args) => openExternalUrl(...args) }));

import { createHelp } from './help.js';
import { HELP_SECTIONS } from './helpContent.js';
import { formatCombo, SHORTCUT_SCOPES } from '../editor/shortcuts.js';
import { getLanguage, setLanguage } from '../i18n/i18n.js';

describe('createHelp', () => {
  let contentEl;
  let navEl;

  beforeEach(() => {
    openExternalUrl.mockClear();
    contentEl = document.createElement('div');
    navEl = document.createElement('nav');
    document.body.replaceChildren(contentEl, navEl);
  });

  it('pinta una cabecera por sección, con su índice a juego', () => {
    createHelp({ contentEl, navEl });

    expect(contentEl.querySelectorAll('.help__heading').length).toBe(HELP_SECTIONS.length);
    expect(navEl.querySelectorAll('.help__nav-item').length).toBe(HELP_SECTIONS.length);
  });

  it('scrollToSection desplaza hasta la cabecera de esa sección', () => {
    const help = createHelp({ contentEl, navEl });
    const heading = document.getElementById('help-section-dot');
    heading.scrollIntoView = vi.fn();

    help.scrollToSection('dot');

    expect(heading.scrollIntoView).toHaveBeenCalled();
  });

  it('la sección «Atajos de teclado» se genera desde el registro, agrupada por ámbito (RF-80)', () => {
    createHelp({ contentEl, navEl });

    const heading = document.getElementById('help-section-atajos');
    expect(heading).not.toBeNull();
    const lang = getLanguage() === 'en' ? 'en' : 'es';
    const groups = [...contentEl.querySelectorAll('.help__subheading')].map((node) => node.textContent);
    expect(groups).toEqual(SHORTCUT_SCOPES.map((scope) => scope.title[lang]));
    const combos = [...contentEl.querySelectorAll('.help__shortcuts dt')].map((node) => node.textContent);
    expect(combos).toContain(formatCombo('Ctrl-Shift-ArrowUp', lang, false));
    expect(combos).toContain('Alt + ↑');
  });

  it('un enlace de documentación externa abre el navegador del sistema, no el propio WebView', () => {
    createHelp({ contentEl, navEl });

    const link = contentEl.querySelector('.help__doc-link');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toMatch(/^https:\/\//);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(openExternalUrl).toHaveBeenCalledWith(link.getAttribute('href'));
  });

  it('la guía de la IA enlaza a su versión en el idioma de la interfaz', () => {
    const previous = getLanguage();
    try {
      for (const [language, file] of [['es', 'IA.md'], ['en', 'IA.en.md']]) {
        setLanguage(language);
        createHelp({ contentEl, navEl });
        const hrefs = [...contentEl.querySelectorAll('.help__doc-link')].map((node) => node.getAttribute('href'));
        expect(hrefs.some((href) => href.endsWith(`/docs/${file}`)), `${language}: falta el enlace a ${file}`).toBe(true);
      }
    } finally {
      setLanguage(previous);
    }
  });
});
