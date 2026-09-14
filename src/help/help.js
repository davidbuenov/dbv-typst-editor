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
import { openExternalUrl } from '../services/backend.js';
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
    if (block.docLink) {
      // RF-52.1: enlace a la documentación ORIGINAL del paquete/lenguaje que
      // usa cada asistente (Graphviz para DOT, el manual de CeTZ para
      // diagramas...), tras su explicación — petición directa del usuario:
      // la explicación propia no sustituye a la referencia completa de
      // quien mantiene esa sintaxis. `preventDefault` + `openExternalUrl`
      // (comando Rust que abre el navegador del sistema) en vez de dejar que
      // el propio WebView navegue — un `<a>` normal se quedaría intentando
      // cargar la URL externa dentro de la propia app.
      const link = document.createElement('a');
      link.className = 'help__doc-link';
      link.href = block.docLink.url;
      link.textContent = pick(block.docLink.label);
      link.addEventListener('click', (event) => {
        event.preventDefault();
        openExternalUrl(block.docLink.url);
      });
      return link;
    }
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
      link.addEventListener('click', () => scrollToSection(section.id));
      nav.append(link);
    }

    contentEl.append(content);
    navEl.append(nav);
  }

  /** Usado también por los botones "?" de cada asistente (RF-52, `helpTrigger.js`). */
  function scrollToSection(sectionId) {
    document.getElementById(`help-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  render();
  document.addEventListener('dbv-lang-changed', render);

  return { render, scrollToSection };
}
