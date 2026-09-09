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
// No se dejó una barra de pestañas con una sola llena a propósito: una pestaña
// que nunca cambia de sitio es una pregunta que la interfaz le hace al usuario
// sin necesidad, y esa acumulación es justo lo que llevó a tener tres formas de
// elegir plantilla.
//
// La separación no es organizativa, es de trabajo: una plantilla CREA un
// proyecto y pertenece al lanzador; un paquete se importa en el documento YA
// abierto y pertenece al editor. Por eso este panel vive detrás del botón ✦ de
// la cabecera y no del lanzador.
//
// Se conservan las dos vías acordadas con el usuario (ADR-UNIVERSE-001): la
// lista revisada, para quien quiere fiarse, y un campo donde pegar cualquier
// `@preview/nombre:version`, para quien sabe lo que busca.

import { getLanguage, t } from '../i18n/i18n.js';
import { CURATED_PACKAGES } from './curatedCatalog.js';
import { parseUniverseSpec } from './universeSpec.js';
import { getUniversePackageIcon } from './universeThumbnails.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.packagesEl Rejilla de paquetes curados.
 * @param {HTMLInputElement} deps.specInputEl Campo del identificador libre.
 * @param {HTMLButtonElement} deps.specButtonEl Botón que lo aplica.
 * @param {HTMLElement} deps.errorEl Mensaje de error del campo.
 * @param {(spec: string) => void} deps.onUsePackage
 * @param {(spec: string) => void} deps.onViewPackage Abre la ficha en typst.app, sin instalar nada.
 */
export function createUniversePanel({
  packagesEl,
  specInputEl,
  specButtonEl,
  errorEl,
  onUsePackage,
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

      // Thumbnail de documento o Icono temático de paquete
      const visualEl = document.createElement('div');
      visualEl.className = 'universe-card__visual';

      // Aquí ya solo hay paquetes, así que siempre toca el icono temático: las
      // miniaturas de documento se fueron con la pestaña de plantillas.
      const icon = document.createElement('div');
      icon.className = 'universe-card__icon-fallback';
      const pkgName = entry.spec?.split('/')?.[1]?.split(':')?.[0] || 'default';
      icon.innerHTML = getUniversePackageIcon(pkgName);
      visualEl.append(icon);

      const content = document.createElement('div');
      content.className = 'universe-card__content';

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

      content.append(title, description, meta);
      body.append(visualEl, content);
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
    renderGrid(packagesEl, CURATED_PACKAGES, onUsePackage);
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

  render();
  document.addEventListener('dbv-lang-changed', render);

  return { render, showError, hideError };
}
