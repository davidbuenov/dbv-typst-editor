// =============================================================================
// DBV Typst Editor — Buscador del catálogo completo de Typst Universe (RF-34)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Extraído de `universePanel.js` (RF-34.7, 2026-09-12) para poder montar el
// MISMO buscador en dos sitios: el panel de paquetes (✦, busca de todo) y la
// pestaña "Buscar" de la Galería de plantillas (busca solo plantillas, para
// crear un proyecto en vez de importar un paquete). Petición explícita del
// usuario: "esta búsqueda que ha funcionado muy bien, sería genial que se
// pudiera integrar... la ventana de búsqueda podría ser la misma".
//
// Lo que cambia entre los dos sitios no es CÓMO se busca (mismo índice, mismo
// filtro por substring, misma tarjeta), es QUÉ pasa al elegir un resultado:
// el panel de paquetes importa o redirige a la Galería; la Galería solo
// rellena el campo de dirección, sin tocar la red por sí sola (RF-26.6). De
// ahí que ese paso quede fuera de este módulo, en `onSelect`.

import { getLanguage, t } from '../i18n/i18n.js';
import { fetchUniverseIndex } from '../services/backend.js';
import { filterUniverseIndexEntries, universeIndexEntryToCard } from './curatedCatalog.js';
import { getUniversePackageIcon } from './universeThumbnails.js';

/**
 * @param {object} deps
 * @param {HTMLInputElement} deps.inputEl Campo de búsqueda.
 * @param {HTMLElement} deps.resultsEl Rejilla donde pintar las tarjetas.
 * @param {HTMLElement} deps.statusEl Mensaje de estado (cargando/error/vacío).
 * @param {(spec: string, card: object) => void} deps.onSelect Se pulsó una tarjeta.
 * @param {(spec: string) => void} [deps.onViewOnline] Enlace "↗" a typst.app — sin él, la tarjeta no lo muestra.
 * @param {(card: object) => boolean} [deps.filterEntries] Filtro adicional sobre las tarjetas ya adaptadas (p. ej. solo plantillas). Por defecto, todas.
 */
export function createUniverseSearch({ inputEl, resultsEl, statusEl, onSelect, onViewOnline, filterEntries }) {
  function renderGrid(entries) {
    const language = getLanguage();
    const fragment = document.createDocumentFragment();

    for (const entry of entries) {
      // La tarjeta ya NO es el propio botón: un botón dentro de otro botón
      // (el enlace "ver en typst.app" frente al cuerpo que selecciona) no es
      // válido en HTML ni accesible, así que la tarjeta es un contenedor y
      // cada acción es su propio botón, hermano del otro.
      const card = document.createElement('div');
      card.className = 'universe-card';

      const body = document.createElement('button');
      body.type = 'button';
      body.className = 'universe-card__body';

      const visualEl = document.createElement('div');
      visualEl.className = 'universe-card__visual';
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
      const badge = entry.verified ? `${t('universe.badgeVerified')} · ` : `${t('universe.badgeCommunity')} · `;
      // Una plantilla se crea (`typst init`), no se importa — el catálogo
      // completo mezcla las dos cosas en la misma lista (RF-34), así que hace
      // falta decirlo antes de que el usuario pulse esperando un `#import`.
      const kind = entry.isTemplate ? `${t('universe.badgeTemplate')} · ` : '';
      meta.textContent = `${kind}${badge}${entry.spec} · ${entry.license}`;

      content.append(title, description, meta);
      body.append(visualEl, content);
      body.addEventListener('click', () => onSelect(entry.spec, entry));
      card.append(body);

      if (onViewOnline) {
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
          onViewOnline(entry.spec);
        });
        card.append(link);
      }

      fragment.append(card);
    }

    resultsEl.replaceChildren(fragment);
  }

  // No se pinta sin escribir nada, tanto por volumen (~4.700 entradas) como
  // porque cada sitio que monta esto ya tiene su propio punto de entrada por
  // defecto (la lista curada, o las pestañas Local/Universe de la Galería).
  // El índice se descarga una sola vez por sesión: `fetchUniverseIndex` ya
  // cachea en el backend, y aquí se cachea también el resultado para no
  // repetir el `await` en cada tecla.
  let fullIndexCache = null;
  let searchToken = 0;

  async function runSearch(rawQuery) {
    const query = rawQuery.trim();
    if (query === '') {
      resultsEl.replaceChildren();
      statusEl.classList.add('hidden');
      return;
    }

    const token = ++searchToken;
    statusEl.textContent = t('universe.searchLoading');
    statusEl.classList.remove('hidden');

    if (!fullIndexCache) {
      const result = await fetchUniverseIndex();
      if (token !== searchToken) return; // una búsqueda posterior ya la sustituyó
      if (!result.ok) {
        statusEl.textContent = t('universe.searchFailed');
        return;
      }
      fullIndexCache = result.value;
    }

    let matches = filterUniverseIndexEntries(fullIndexCache, query).map(universeIndexEntryToCard);
    if (filterEntries) matches = matches.filter(filterEntries);
    matches = matches.slice(0, 60);

    if (matches.length === 0) {
      resultsEl.replaceChildren();
      statusEl.textContent = t('universe.searchEmpty');
      return;
    }

    statusEl.classList.add('hidden');
    renderGrid(matches);
  }

  inputEl.addEventListener('input', () => runSearch(inputEl.value));

  return {
    /** Vacía el campo y los resultados — para cuando el contenedor que lo monta se reinicia. */
    clear() {
      inputEl.value = '';
      resultsEl.replaceChildren();
      statusEl.classList.add('hidden');
    },
  };
}
