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
});
