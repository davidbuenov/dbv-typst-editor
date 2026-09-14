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
import { getRecentProjects, listTemplates, removeRecentProject } from '../services/backend.js';
import { baseName } from '../app/workspace.js';
import { truncateParentPath } from '../app/paths.js';

/**
 * RF-44: el backend ya guarda hasta 10 (`MAX_RECENT`,
 * `commands/recent_projects.rs`), pero el lanzador es una pantalla de
 * arranque, no un historial — más allá de 5 tarjetas no aporta y un buscador
 * sería demasiado para una lista corta (decisión explícita del usuario). El
 * histórico en disco no se toca: solo se recorta lo que se PINTA por defecto;
 * "Ver todos" (rediseño posterior, a partir de una referencia visual que le
 * gustó al usuario) revela el resto sin ningún viaje nuevo al backend.
 */
export const RECENT_DISPLAY_LIMIT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Frases de tiempo relativo por idioma. No pasa por el diccionario de `t()`
 * a propósito: ese sistema son solo claves planas sin interpolación, y aquí
 * hace falta un número — más simple una tabla propia y pequeña que añadir
 * plantillas al sistema de i18n entero por esto.
 */
const RELATIVE_TIME_LABELS = {
  es: {
    today: 'hoy',
    yesterday: 'ayer',
    days: (n) => `${n} días`,
    weeks: (n) => `${n} sem`,
    months: (n) => `${n} ${n === 1 ? 'mes' : 'meses'}`,
  },
  en: {
    today: 'today',
    yesterday: 'yesterday',
    days: (n) => `${n}d`,
    weeks: (n) => `${n}w`,
    months: (n) => `${n}mo`,
  },
};

/**
 * "hoy" / "ayer" / "3 días" / "1 sem" / "2 meses" a partir de un timestamp
 * Unix en segundos (`lastOpened`, tal cual lo guarda `recent_projects.rs`).
 * `now` es un parámetro, no `Date.now()` fijo, para que el test no dependa
 * del reloj real. Un `lastOpened` en el futuro (reloj del sistema desajustado)
 * se trata como "ahora mismo" en vez de dar una cifra negativa sin sentido.
 * @param {number} lastOpenedSeconds
 * @param {{now?: number, language?: 'es'|'en'}} [options]
 */
export function formatRelativeTime(lastOpenedSeconds, { now = Date.now(), language = 'es' } = {}) {
  const diffDays = Math.max(0, now - lastOpenedSeconds * 1000) / DAY_MS;
  const labels = RELATIVE_TIME_LABELS[language] ?? RELATIVE_TIME_LABELS.es;

  if (diffDays < 1) return labels.today;
  if (diffDays < 2) return labels.yesterday;
  if (diffDays < 7) return labels.days(Math.floor(diffDays));
  if (diffDays < 30) return labels.weeks(Math.max(1, Math.floor(diffDays / 7)));
  return labels.months(Math.max(1, Math.floor(diffDays / 30)));
}

/** Nombre y descripción de una plantilla en el idioma activo. */
export function localizeTemplate(template, language) {
  const localized = template.dbv?.localization?.[language];
  return {
    name: localized?.name || template.name,
    description: localized?.description || template.description,
  };
}

/** SVG de carpeta/documento, mismo trazo que el resto de la aplicación (viewBox 20, stroke 1.5) — nada de emoji para un icono funcional. */
const RECENT_ICON_MARKUP = {
  folder:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2.5 6.2c0-.7.6-1.3 1.3-1.3h3.5l1.5 1.8h7.2c.7 0 1.3.6 1.2 1.3l-.9 6.2c-.1.7-.7 1.2-1.3 1.2H4.1c-.7 0-1.2-.5-1.3-1.2L2.5 6.2Z"/></svg>',
  file:
    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6.3 2.5h5l3.4 3.4V16a1 1 0 0 1-1 1H6.3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"/><path d="M11.3 2.5V6h3.4"/><path d="M7.3 10h5.4M7.3 12.6h5.4"/></svg>',
};

/**
 * Desde RF-25 el lanzador NO pinta plantillas: la única vía de creación es la
 * galería. Sigue cargando el catálogo porque es el único sitio que lo pide al
 * backend, y de `getCatalog()` come la pestaña "Plantillas locales" de esa
 * galería — quitar la carga junto con la rejilla la habría dejado vacía sin
 * ningún error visible.
 *
 * @param {object} deps
 * @param {HTMLElement} deps.recentEl Lista de proyectos recientes.
 * @param {HTMLElement} [deps.recentToggleEl] Botón "Ver todos" / "Ver menos", opcional.
 * @param {(path: string) => void} deps.onOpenRecent
 */
export function createLauncher({ recentEl, recentToggleEl, onOpenRecent }) {
  /** @type {object[]} Catálogo cacheado: no cambia mientras la app vive. */
  let catalog = [];
  /** "Ver todos" pulsado en esta sesión del lanzador — se resetea en cada `load()` (volver del workspace cuenta como una vuelta a la pantalla de inicio, no como seguir mirando la misma lista). */
  let expanded = false;

  function syncToggleVisibility(totalCount) {
    if (!recentToggleEl) return;
    recentToggleEl.classList.toggle('hidden', totalCount <= RECENT_DISPLAY_LIMIT);
    recentToggleEl.textContent = expanded ? t('recent.viewLess') : t('recent.viewAll');
  }

  function buildRecentItem(project) {
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
    icon.innerHTML = project.isSingleFile ? RECENT_ICON_MARKUP.file : RECENT_ICON_MARKUP.folder;
    openButton.append(icon);

    const name = document.createElement('span');
    name.className = 'recent-item__name';
    name.textContent = project.name || baseName(project.path);
    openButton.append(name);

    // Solo los últimos tramos de la carpeta CONTENEDORA, no la ruta completa
    // de Windows — inútil a simple vista y es lo que hacía la lista
    // "horrorosa" en palabras del usuario. La ruta completa sigue disponible
    // en el `title` (tooltip) para quien la necesite. En línea junto al
    // nombre, no debajo: la fila entera pesa menos así.
    const path = document.createElement('span');
    path.className = 'recent-item__path';
    path.textContent = truncateParentPath(project.path);
    path.title = project.path;
    openButton.append(path);

    const time = document.createElement('span');
    time.className = 'recent-item__time';
    time.textContent = formatRelativeTime(project.lastOpened, { language: getLanguage() });
    openButton.append(time);

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

    return item;
  }

  async function renderRecent() {
    const result = await getRecentProjects();
    const projects = result.ok ? result.value : [];

    if (projects.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'recent-list__empty';
      empty.textContent = t('recent.empty');
      recentEl.replaceChildren(empty);
      recentToggleEl?.classList.add('hidden');
      return;
    }

    const visible = expanded ? projects : projects.slice(0, RECENT_DISPLAY_LIMIT);
    const fragment = document.createDocumentFragment();
    for (const project of visible) fragment.append(buildRecentItem(project));
    recentEl.replaceChildren(fragment);
    syncToggleVisibility(projects.length);
  }

  recentToggleEl?.addEventListener('click', () => {
    expanded = !expanded;
    renderRecent();
  });

  return {
    /** Carga el catálogo (una sola vez) y pinta los proyectos recientes. */
    async load() {
      expanded = false;
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
