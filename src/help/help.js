// =============================================================================
// DBV Typst Editor — Panel de ayuda
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Capa de render fina sobre `helpContent.js` (mismo reparto que
// `toolbar.js`/`toolbarActions.js`): aquí no hay ni un texto de ayuda, solo la
// construcción del DOM. Se repinta entero al cambiar de idioma, porque el
// contenido no lleva atributos `data-i18n` que `applyTranslations` pueda tocar.

import { getLanguage } from '../i18n/i18n.js';
import { HELP_SECTIONS } from './helpContent.js';

/** Devuelve la variante del idioma activo, con castellano como respaldo. */
function pick(bilingual) {
  const lang = getLanguage();
  return bilingual[lang] ?? bilingual.es;
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.contentEl Contenedor donde se pinta la ayuda.
 * @param {HTMLElement} deps.navEl Índice de secciones.
 */
export function createHelp({ contentEl, navEl }) {
  function renderShortcuts(rows) {
    const table = document.createElement('dl');
    table.className = 'help__shortcuts';
    for (const [combo, description] of rows) {
      const key = document.createElement('dt');
      key.textContent = combo;
      const value = document.createElement('dd');
      value.textContent = pick(description);
      table.append(key, value);
    }
    return table;
  }

  function renderBlock(block) {
    if (block.list) {
      const list = document.createElement('ul');
      list.className = 'help__list';
      for (const item of pick(block.list)) {
        const li = document.createElement('li');
        li.textContent = item;
        list.append(li);
      }
      return list;
    }
    if (block.shortcuts) return renderShortcuts(block.shortcuts);

    const paragraph = document.createElement('p');
    paragraph.className = 'help__paragraph';
    paragraph.textContent = pick(block);
    return paragraph;
  }

  function render() {
    contentEl.replaceChildren();
    navEl.replaceChildren();

    const content = document.createDocumentFragment();
    const nav = document.createDocumentFragment();

    for (const section of HELP_SECTIONS) {
      const heading = document.createElement('h3');
      heading.className = 'help__heading';
      heading.id = `help-section-${section.id}`;
      heading.textContent = pick(section.title);
      content.append(heading);

      for (const block of section.blocks) content.append(renderBlock(block));

      // El índice desplaza dentro del propio panel, no de la ventana: un
      // `href="#id"` navegaría el WebView entero.
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'help__nav-item';
      link.textContent = pick(section.title);
      link.addEventListener('click', () => {
        document.getElementById(`help-section-${section.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      nav.append(link);
    }

    contentEl.append(content);
    navEl.append(nav);
  }

  render();
  document.addEventListener('dbv-lang-changed', render);

  return { render };
}
