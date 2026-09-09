// =============================================================================
// DBV Typst Editor — Hover Tooltip Enriquecido para Typst Universe
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Extensión para CodeMirror 6 que detecta identificadores de Typst Universe
// (`@preview/nombre:version`) bajo el cursor o puntero del ratón y muestra
// una tarjeta interactiva con:
// - Miniatura de la plantilla (o icono del paquete)
// - Nombre, versión y licencia
// - Descripción
// - Botón directo para "Ver en Typst Universe" (typst.app/universe)

import { hoverTooltip } from '@codemirror/view';
import { getLanguage, t } from '../i18n/i18n.js';
import { openUniversePackagePage } from '../services/backend.js';
import {
  findCuratedMetadata,
  getUniversePackageIcon,
  getUniverseThumbnailUrl,
} from '../universe/universeThumbnails.js';

const UNIVERSE_SPEC_REGEX = /@preview\/[A-Za-z0-9_-]+:\d+\.\d+\.\d+/g;

/**
 * Encuentra un identificador `@preview/...` en la posición dada de la línea de texto.
 * @param {string} lineText Texto completo de la línea
 * @param {number} col Índice de columna (0-indexed)
 * @returns {{ spec: string, from: number, to: number } | null}
 */
export function findUniverseSpecInLine(lineText, col) {
  let match;
  UNIVERSE_SPEC_REGEX.lastIndex = 0;
  while ((match = UNIVERSE_SPEC_REGEX.exec(lineText)) !== null) {
    const from = match.index;
    const to = from + match[0].length;
    if (col >= from && col <= to) {
      return { spec: match[0], from, to };
    }
  }
  return null;
}

/**
 * Crea la extensión de hover tooltip de CodeMirror para Typst Universe.
 */
export function createUniverseHover() {
  return hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const col = pos - line.from;
    const found = findUniverseSpecInLine(line.text, col);
    if (!found) return null;

    const startPos = line.from + found.from;
    const endPos = line.from + found.to;

    return {
      pos: startPos,
      end: endPos,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'cm-universe-hover-tooltip';

        const meta = findCuratedMetadata(found.spec);
        const language = getLanguage();
        const title = language === 'en' ? meta?.titleEn || meta?.title : meta?.title;
        const description = language === 'en' ? meta?.descriptionEn || meta?.description : meta?.description;
        const thumbnailUrl = getUniverseThumbnailUrl(found.spec);

        // Header: Título y versión
        const header = document.createElement('div');
        header.className = 'cm-universe-hover__header';

        const titleEl = document.createElement('span');
        titleEl.className = 'cm-universe-hover__title';
        titleEl.textContent = title || meta?.parsed?.name || found.spec;

        const badgeEl = document.createElement('span');
        badgeEl.className = 'cm-universe-hover__badge';
        badgeEl.textContent = meta?.parsed?.version ? `v${meta.parsed.version}` : 'preview';

        header.append(titleEl, badgeEl);

        // Contenedor de vista previa: Imagen de maquetación o Icono temático
        const previewContainer = document.createElement('div');
        previewContainer.className = 'cm-universe-hover__preview';

        if (meta?.isTemplate && thumbnailUrl) {
          const img = document.createElement('img');
          img.className = 'cm-universe-hover__img';
          img.src = thumbnailUrl;
          img.alt = title;
          img.loading = 'lazy';

          img.onerror = () => {
            // Si la imagen falla o no existe, degradar suavemente al icono temático
            previewContainer.replaceChildren();
            const fallback = document.createElement('div');
            fallback.className = 'cm-universe-hover__icon-fallback';
            fallback.innerHTML = getUniversePackageIcon(meta?.parsed?.name || 'default');
            previewContainer.append(fallback);
          };

          previewContainer.append(img);
        } else {
          const iconEl = document.createElement('div');
          iconEl.className = 'cm-universe-hover__icon-fallback';
          iconEl.innerHTML = getUniversePackageIcon(meta?.parsed?.name || 'default');
          previewContainer.append(iconEl);
        }

        // Descripción y metadatos
        const descEl = document.createElement('p');
        descEl.className = 'cm-universe-hover__desc';
        descEl.textContent = description || '';

        const metaRow = document.createElement('div');
        metaRow.className = 'cm-universe-hover__meta';

        const licenseEl = document.createElement('span');
        licenseEl.className = 'cm-universe-hover__license';
        licenseEl.textContent = `⚖️ ${meta?.license || 'MIT'}`;

        const linkBtn = document.createElement('button');
        linkBtn.type = 'button';
        linkBtn.className = 'cm-universe-hover__link-btn';
        linkBtn.textContent = `${t('universe.viewOnline')} ↗`;
        linkBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openUniversePackagePage(found.spec).catch(console.error);
        });

        metaRow.append(licenseEl, linkBtn);

        dom.append(header, previewContainer, descEl, metaRow);
        return { dom };
      },
    };
  });
}
