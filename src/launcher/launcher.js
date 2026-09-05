// =============================================================================
// DBV Typst Editor — Lanzador orientado a tareas
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// RF-01 / ARCHITECTURE.md §7.13. La pantalla de bienvenida no es un editor
// vacío: es "¿qué quieres escribir hoy?". Y no es una pantalla aparte del
// catálogo de plantillas — es, funcionalmente, un Template Explorer reducido al
// catálogo curado (§7.6.3), que es lo que en Beta se generaliza al catálogo
// comunitario sin rehacer esta vista: consume `TemplateInfo` (R-MVP-1), no
// rutas ni ficheros concretos.

import { getLanguage, t } from '../i18n/i18n.js';
import { getRecentProjects, listTemplates } from '../services/backend.js';
import { baseName } from '../app/workspace.js';

/** Nombre y descripción de una plantilla en el idioma activo. */
export function localizeTemplate(template, language) {
  const localized = template.dbv?.localization?.[language];
  return {
    name: localized?.name || template.name,
    description: localized?.description || template.description,
  };
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.templatesEl Rejilla de plantillas.
 * @param {HTMLElement} deps.recentEl Lista de proyectos recientes.
 * @param {(template: object) => void} deps.onCreateFromTemplate
 * @param {(path: string) => void} deps.onOpenRecent
 */
export function createLauncher({ templatesEl, recentEl, onCreateFromTemplate, onOpenRecent }) {
  /** @type {object[]} Catálogo cacheado: no cambia mientras la app vive. */
  let catalog = [];

  function renderTemplates() {
    if (catalog.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'recent-list__empty';
      empty.textContent = t('launcher.noTemplates');
      templatesEl.replaceChildren(empty);
      return;
    }

    const language = getLanguage();
    const fragment = document.createDocumentFragment();
    for (const template of catalog) {
      const { name, description } = localizeTemplate(template, language);

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'template-card';

      const title = document.createElement('span');
      title.className = 'template-card__name';
      title.textContent = name;
      card.append(title);

      const text = document.createElement('span');
      text.className = 'template-card__description';
      text.textContent = description;
      card.append(text);

      const meta = document.createElement('span');
      meta.className = 'template-card__meta';
      // La categoría propia de DBV es más específica que las oficiales de Typst
      // Universe (TFG/TFM no existen allí), así que manda cuando está.
      meta.textContent = [template.dbv?.dbvCategory, `v${template.version}`]
        .filter(Boolean)
        .join(' · ');
      card.append(meta);

      card.addEventListener('click', () => onCreateFromTemplate(template));
      fragment.append(card);
    }
    templatesEl.replaceChildren(fragment);
  }

  async function renderRecent() {
    const result = await getRecentProjects();
    const projects = result.ok ? result.value : [];

    if (projects.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'recent-list__empty';
      empty.textContent = t('recent.empty');
      recentEl.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const project of projects) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'recent-item';

      const name = document.createElement('span');
      name.className = 'recent-item__name';
      name.textContent = project.name || baseName(project.path);
      item.append(name);

      const path = document.createElement('span');
      path.className = 'recent-item__path';
      path.textContent = project.path;
      item.append(path);

      item.addEventListener('click', () => onOpenRecent(project.path));
      fragment.append(item);
    }
    recentEl.replaceChildren(fragment);
  }

  return {
    /** Carga el catálogo (una sola vez) y pinta el lanzador entero. */
    async load() {
      if (catalog.length === 0) {
        const result = await listTemplates();
        catalog = result.ok ? result.value : [];
      }
      renderTemplates();
      await renderRecent();
    },
    refreshRecent: renderRecent,
    /** Repinta al cambiar de idioma (los textos vienen del catálogo, no del DOM). */
    refreshLanguage: renderTemplates,
    getCatalog: () => catalog.slice(),
  };
}
