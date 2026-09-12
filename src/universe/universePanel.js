// =============================================================================
// DBV Typst Editor — Panel de Typst Universe (Beta, ARCHITECTURE.md §7.6)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Este panel tenía dos pestañas —Plantillas y Paquetes— hasta RF-26 (v0.5.0).
// La de Plantillas se absorbió en la galería, que es ahora la única puerta de
// entrada a la creación de documentos, y aquí queda solo la rama de Paquetes.
//
// La separación no es organizativa, es de trabajo: una plantilla CREA un
// proyecto y pertenece al lanzador; un paquete se importa en el documento YA
// abierto y pertenece al editor. Por eso este panel vive detrás del botón ✦ de
// la cabecera y no del lanzador.
//
// Se conservan las dos vías acordadas con el usuario (ADR-UNIVERSE-001): la
// lista revisada, para quien quiere fiarse, y un campo donde pegar cualquier
// `@preview/nombre:version`, para quien sabe lo que busca.
//
// RF-34.6 (2026-09-12): "Paquetes" y "Buscar" volvieron a ser dos pestañas de
// verdad — la nota de arriba sobre "no dejar una sola pestaña llena" seguía
// siendo cierta mientras solo había un camino, pero desde RF-34 hay DOS
// (la lista revisada y el catálogo completo) apilados en la misma pantalla, y
// el usuario lo describió con precisión: "divides la pantalla en 2 partes...
// pero confunde mucho". Con las dos rejillas SIEMPRE visibles a la vez,
// cada una se llevaba la mitad de la altura del panel aunque no hubiera
// ninguna búsqueda en curso, cortando tarjetas por la mitad. Con pestañas de
// verdad, cada rejilla tiene el panel entero para ella sola y nunca compiten
// por espacio — mismo patrón que Archivos/Esquema del panel lateral.
//
// RF-34.7 (2026-09-12): el motor de la pestaña "Buscar" se extrajo a
// `universeSearch.js` para poder montar el MISMO buscador en la Galería de
// plantillas, filtrado a solo plantillas — petición explícita del usuario.
// Aquí solo queda la rejilla curada (que NUNCA usa ese buscador: es una
// lista fija, sin red) y el cableado de las pestañas.

import { getLanguage, t } from '../i18n/i18n.js';
import { CURATED_PACKAGES } from './curatedCatalog.js';
import { parseUniverseSpec } from './universeSpec.js';
import { createUniverseSearch } from './universeSearch.js';
import { getUniversePackageIcon } from './universeThumbnails.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.packagesEl Rejilla de paquetes curados.
 * @param {HTMLInputElement} deps.specInputEl Campo del identificador libre.
 * @param {HTMLButtonElement} deps.specButtonEl Botón que lo aplica.
 * @param {HTMLElement} deps.errorEl Mensaje de error del campo.
 * @param {HTMLInputElement} [deps.searchInputEl] Búsqueda sobre el catálogo completo (RF-34).
 * @param {HTMLElement} [deps.searchResultsEl] Rejilla de resultados de esa búsqueda.
 * @param {HTMLElement} [deps.searchStatusEl] Mensaje de estado de la búsqueda (cargando/error/vacío).
 * @param {HTMLButtonElement} [deps.tabPackagesEl] Pestaña "Paquetes" (RF-34.6).
 * @param {HTMLButtonElement} [deps.tabSearchEl] Pestaña "Buscar".
 * @param {HTMLElement} [deps.viewPackagesEl] Panel que la pestaña "Paquetes" muestra.
 * @param {HTMLElement} [deps.viewSearchEl] Panel que la pestaña "Buscar" muestra.
 * @param {(spec: string) => void} deps.onUsePackage
 * @param {(spec: string) => void} [deps.onUseTemplate] Una entrada del catálogo completo resultó ser plantilla, no paquete (RF-34).
 * @param {(spec: string) => void} deps.onViewPackage Abre la ficha en typst.app, sin instalar nada.
 */
export function createUniversePanel({
  packagesEl,
  specInputEl,
  specButtonEl,
  errorEl,
  searchInputEl,
  searchResultsEl,
  searchStatusEl,
  tabPackagesEl,
  tabSearchEl,
  viewPackagesEl,
  viewSearchEl,
  onUsePackage,
  onUseTemplate,
  onViewPackage,
}) {
  function showError(key) {
    errorEl.textContent = t(key);
    errorEl.classList.remove('hidden');
  }

  function hideError() {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  /**
   * Solo para la rejilla curada: a diferencia del buscador (`universeSearch.js`),
   * aquí nunca hay `verified`/`isTemplate` que anunciar — TODA la lista ya es
   * la verificada, y ninguna entrada curada es una plantilla (esas viven en
   * `CURATED_TEMPLATES`, en la Galería). Mostrar esos badges aquí sería ruido.
   */
  function renderCurated() {
    const fragment = document.createDocumentFragment();

    for (const entry of CURATED_PACKAGES) {
      const card = document.createElement('div');
      card.className = 'universe-card';

      const body = document.createElement('button');
      body.type = 'button';
      body.className = 'universe-card__body';

      const visualEl = document.createElement('div');
      visualEl.className = 'universe-card__visual';
      const icon = document.createElement('div');
      icon.className = 'universe-card__icon-fallback';
      icon.innerHTML = getUniversePackageIcon(entry.spec.split('/')[1]?.split(':')[0] || 'default');
      visualEl.append(icon);

      const content = document.createElement('div');
      content.className = 'universe-card__content';

      const title = document.createElement('span');
      title.className = 'universe-card__title';
      const language = getLanguage();
      title.textContent = language === 'en' ? entry.titleEn : entry.title;

      const description = document.createElement('span');
      description.className = 'universe-card__description';
      description.textContent = language === 'en' ? entry.descriptionEn : entry.description;

      const meta = document.createElement('span');
      meta.className = 'universe-card__meta';
      meta.textContent = `${entry.spec} · ${entry.license}`;

      content.append(title, description, meta);
      body.append(visualEl, content);
      body.addEventListener('click', () => onUsePackage(entry.spec));

      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'universe-card__link';
      link.title = t('universe.viewOnline');
      link.setAttribute('aria-label', t('universe.viewOnline'));
      link.textContent = '↗';
      link.addEventListener('click', (event) => {
        event.stopPropagation();
        onViewPackage(entry.spec);
      });

      card.append(body, link);
      fragment.append(card);
    }

    packagesEl.replaceChildren(fragment);
  }

  if (searchInputEl && searchResultsEl && searchStatusEl) {
    createUniverseSearch({
      inputEl: searchInputEl,
      resultsEl: searchResultsEl,
      statusEl: searchStatusEl,
      onViewOnline: onViewPackage,
      // Aquí sí se buscan las dos cosas: es el mismo sitio donde ya vive la
      // rejilla curada de paquetes. La Galería, en cambio, filtra a solo
      // plantillas — ver `templateGalleryModal.js`.
      onSelect: (spec, card) => {
        if (card.isTemplate) onUseTemplate?.(spec);
        else onUsePackage(spec);
      },
    });
  }

  function applyTypedSpec() {
    const parsed = parseUniverseSpec(specInputEl.value);
    if (!parsed.ok) {
      showError(parsed.reason === 'empty' ? 'universe.errorEmpty' : 'universe.errorFormat');
      return;
    }
    hideError();
    specInputEl.value = '';
    onUsePackage(parsed.spec);
  }

  specInputEl.placeholder = '@preview/quick-maths:0.2.1';
  specButtonEl.addEventListener('click', applyTypedSpec);
  specInputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyTypedSpec();
  });
  specInputEl.addEventListener('input', hideError);

  // RF-34.6: mismo patrón que Archivos/Esquema (`wireSidebarTabs` en
  // `main.js`) — un único interruptor que alterna clase `active` y `hidden`,
  // sin tocar el estado de ninguna de las dos vistas al cambiar entre ellas
  // (una búsqueda ya escrita sigue ahí si se vuelve a "Buscar").
  function setActiveTab(tab) {
    tabPackagesEl?.classList.toggle('active', tab === 'packages');
    tabSearchEl?.classList.toggle('active', tab === 'search');
    viewPackagesEl?.classList.toggle('hidden', tab !== 'packages');
    viewSearchEl?.classList.toggle('hidden', tab !== 'search');
    if (tab === 'search') searchInputEl?.focus();
  }

  tabPackagesEl?.addEventListener('click', () => setActiveTab('packages'));
  tabSearchEl?.addEventListener('click', () => setActiveTab('search'));

  renderCurated();
  document.addEventListener('dbv-lang-changed', renderCurated);

  return { render: renderCurated, showError, hideError };
}
