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

import { t } from '../i18n/i18n.js';
import { getRecentProjects, listTemplates, removeRecentProject } from '../services/backend.js';
import { baseName } from '../app/workspace.js';
import { truncateParentPath } from '../app/paths.js';

/**
 * RF-44: el backend ya guarda hasta 10 (`MAX_RECENT`,
 * `commands/recent_projects.rs`), pero el lanzador es una pantalla de
 * arranque, no un historial — más allá de 5 tarjetas no aporta y un buscador
 * sería demasiado para una lista corta (decisión explícita del usuario). El
 * histórico en disco no se toca: solo se recorta lo que se PINTA.
 */
export const RECENT_DISPLAY_LIMIT = 5;

/** Nombre y descripción de una plantilla en el idioma activo. */
export function localizeTemplate(template, language) {
  const localized = template.dbv?.localization?.[language];
  return {
    name: localized?.name || template.name,
    description: localized?.description || template.description,
  };
}

/**
 * Desde RF-25 el lanzador NO pinta plantillas: la única vía de creación es la
 * galería. Sigue cargando el catálogo porque es el único sitio que lo pide al
 * backend, y de `getCatalog()` come la pestaña "Plantillas locales" de esa
 * galería — quitar la carga junto con la rejilla la habría dejado vacía sin
 * ningún error visible.
 *
 * @param {object} deps
 * @param {HTMLElement} deps.recentEl Lista de proyectos recientes.
 * @param {(path: string) => void} deps.onOpenRecent
 */
export function createLauncher({ recentEl, onOpenRecent }) {
  /** @type {object[]} Catálogo cacheado: no cambia mientras la app vive. */
  let catalog = [];

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
    // RF-44: como mucho 5 tarjetas visibles — el resto del histórico (hasta
    // 10, `MAX_RECENT` en el backend) sigue ahí, solo no se pinta.
    for (const project of projects.slice(0, RECENT_DISPLAY_LIMIT)) {
      const item = document.createElement('div');
      item.className = 'recent-item';

      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'recent-item__open';

      // Icono por tipo: una carpeta de proyecto y un `.typ` suelto (RF-02b) no
      // se abren igual ni tienen la misma estructura detrás, así que conviene
      // distinguirlos de un vistazo, no solo por el texto de la ruta.
      const icon = document.createElement('span');
      icon.className = 'recent-item__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = project.isSingleFile ? '📄' : '📁';
      openButton.append(icon);

      const text = document.createElement('span');
      text.className = 'recent-item__text';

      const name = document.createElement('span');
      name.className = 'recent-item__name';
      name.textContent = project.name || baseName(project.path);
      text.append(name);

      // Solo los últimos tramos de la carpeta CONTENEDORA, no la ruta
      // completa de Windows — inútil a simple vista y es lo que hacía la
      // lista "horrorosa" en palabras del usuario. La ruta completa sigue
      // disponible en el `title` (tooltip) para quien la necesite.
      const path = document.createElement('span');
      path.className = 'recent-item__path';
      path.textContent = truncateParentPath(project.path);
      path.title = project.path;
      text.append(path);

      openButton.append(text);

      openButton.addEventListener('click', () => onOpenRecent(project.path));
      item.append(openButton);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'recent-item__remove';
      removeButton.title = t('recent.remove');
      removeButton.setAttribute('aria-label', t('recent.remove'));
      removeButton.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      `;
      removeButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        await removeRecentProject(project.path);
        await renderRecent();
      });
      item.append(removeButton);

      fragment.append(item);
    }
    recentEl.replaceChildren(fragment);
  }

  return {
    /** Carga el catálogo (una sola vez) y pinta los proyectos recientes. */
    async load() {
      if (catalog.length === 0) {
        const result = await listTemplates();
        catalog = result.ok ? result.value : [];
      }
      await renderRecent();
    },
    refreshRecent: renderRecent,
    /** Repinta al cambiar de idioma: los recientes llevan textos traducidos. */
    refreshLanguage: renderRecent,
    /** Lo consume la pestaña "Plantillas locales" de la galería (RF-26). */
    getCatalog: () => catalog.slice(),
  };
}
