// =============================================================================
// DBV Typst Editor — Panel de Typst Universe (Beta, ARCHITECTURE.md §7.6)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Dos ramas de igual peso, como fija §7.6.0.1 — Plantillas (crean un proyecto)
// y Paquetes (se importan en el documento abierto) — resueltas aquí como dos
// pestañas del mismo panel en vez de dos vistas separadas: comparten el mismo
// catálogo curado, el mismo campo de identificador libre y el mismo aviso de
// que es código de terceros. Separarlas en dos paneles habría triplicado la
// interfaz sin añadir nada.
//
// Cada pestaña ofrece las dos vías acordadas con el usuario: la lista revisada
// (para quien quiere fiarse) y un campo donde pegar cualquier
// `@preview/nombre:version` (para quien sabe lo que busca).

import { getLanguage, t } from '../i18n/i18n.js';
import { CURATED_PACKAGES, CURATED_TEMPLATES } from './curatedCatalog.js';
import { parseUniverseSpec } from './universeSpec.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.templatesEl Rejilla de plantillas curadas.
 * @param {HTMLElement} deps.packagesEl Rejilla de paquetes curados.
 * @param {HTMLInputElement} deps.specInputEl Campo del identificador libre.
 * @param {HTMLButtonElement} deps.specButtonEl Botón que lo aplica.
 * @param {HTMLElement} deps.errorEl Mensaje de error del campo.
 * @param {HTMLButtonElement} deps.tabTemplatesEl
 * @param {HTMLButtonElement} deps.tabPackagesEl
 * @param {(spec: string) => void} deps.onUseTemplate
 * @param {(spec: string) => void} deps.onUsePackage
 * @param {(spec: string) => void} deps.onViewPackage Abre la ficha en typst.app, sin instalar nada.
 */
export function createUniversePanel({
  templatesEl,
  packagesEl,
  specInputEl,
  specButtonEl,
  errorEl,
  tabTemplatesEl,
  tabPackagesEl,
  onUseTemplate,
  onUsePackage,
  onViewPackage,
}) {
  /** @type {'templates'|'packages'} */
  let activeTab = 'templates';

  function showError(key) {
    errorEl.textContent = t(key);
    errorEl.classList.remove('hidden');
  }

  function hideError() {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  function renderGrid(container, entries, onUse) {
    const language = getLanguage();
    const fragment = document.createDocumentFragment();

    for (const entry of entries) {
      // La tarjeta ya NO es el propio botón: un botón dentro de otro botón
      // (el enlace "ver en typst.app" frente al cuerpo que instala) no es
      // válido en HTML ni accesible, así que la tarjeta es un contenedor y
      // cada acción es su propio botón, hermano del otro.
      const card = document.createElement('div');
      card.className = 'universe-card';

      const body = document.createElement('button');
      body.type = 'button';
      body.className = 'universe-card__body';

      const title = document.createElement('span');
      title.className = 'universe-card__title';
      title.textContent = language === 'en' ? entry.titleEn : entry.title;

      const description = document.createElement('span');
      description.className = 'universe-card__description';
      description.textContent = language === 'en' ? entry.descriptionEn : entry.description;

      // Identificador y licencia siempre a la vista: es código de terceros y
      // el usuario tiene derecho a saber qué instala y bajo qué condiciones.
      const meta = document.createElement('span');
      meta.className = 'universe-card__meta';
      meta.textContent = `${entry.spec} · ${entry.license}`;

      body.append(title, description, meta);
      body.addEventListener('click', () => onUse(entry.spec));

      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'universe-card__link';
      link.title = t('universe.viewOnline');
      link.setAttribute('aria-label', t('universe.viewOnline'));
      link.textContent = '↗';
      // `stopPropagation` no bastaría por sí solo (el body es hermano, no
      // ancestro), pero evita que un futuro cambio de estructura reintroduzca
      // el disparo doble si alguien anida esto de nuevo.
      link.addEventListener('click', (event) => {
        event.stopPropagation();
        onViewPackage(entry.spec);
      });

      card.append(body, link);
      fragment.append(card);
    }

    container.replaceChildren(fragment);
  }

  function render() {
    renderGrid(templatesEl, CURATED_TEMPLATES, onUseTemplate);
    renderGrid(packagesEl, CURATED_PACKAGES, onUsePackage);
  }

  function setActiveTab(tab) {
    activeTab = tab;
    const isTemplates = tab === 'templates';
    tabTemplatesEl.classList.toggle('active', isTemplates);
    tabPackagesEl.classList.toggle('active', !isTemplates);
    templatesEl.classList.toggle('hidden', !isTemplates);
    packagesEl.classList.toggle('hidden', isTemplates);
    specInputEl.placeholder = isTemplates ? '@preview/charged-ieee:0.1.4' : '@preview/quick-maths:0.2.1';
    hideError();
  }

  function applyTypedSpec() {
    const parsed = parseUniverseSpec(specInputEl.value);
    if (!parsed.ok) {
      showError(parsed.reason === 'empty' ? 'universe.errorEmpty' : 'universe.errorFormat');
      return;
    }
    hideError();
    specInputEl.value = '';
    if (activeTab === 'templates') onUseTemplate(parsed.spec);
    else onUsePackage(parsed.spec);
  }

  tabTemplatesEl.addEventListener('click', () => setActiveTab('templates'));
  tabPackagesEl.addEventListener('click', () => setActiveTab('packages'));
  specButtonEl.addEventListener('click', applyTypedSpec);
  specInputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') applyTypedSpec();
  });
  specInputEl.addEventListener('input', hideError);

  render();
  setActiveTab('templates');
  document.addEventListener('dbv-lang-changed', render);

  return { render, showError, hideError };
}
