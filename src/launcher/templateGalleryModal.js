// =============================================================================
// DBV Typst Editor — Modal de Galería de Plantillas con Vista Previa
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Modal a dos columnas inspirado en maquetadores científicos avanzados:
// - Columna izquierda: Búsqueda reactiva y lista scrollable de plantillas
//   con categoría, versión, icono y descripción.
// - Columna derecha: Vista previa maquetada a alta resolución de la página
//   completa con sombras realistas, tipografía nítida y botón de acción directa.

import { getLanguage, t } from '../i18n/i18n.js';
import { localizeTemplate } from './launcher.js';
import { getTemplateFullPreviewSvg, getTemplateThumbnailSvg } from './templateThumbnails.js';

/**
 * Crea el controlador del diálogo modal de la galería de plantillas.
 *
 * @param {object} deps
 * @param {HTMLElement} deps.dialogEl Elemento contenedor modal
 * @param {HTMLElement} deps.listEl Contenedor de la lista de plantillas
 * @param {HTMLElement} deps.previewEl Contenedor de la vista previa maquetada
 * @param {HTMLInputElement} deps.searchEl Campo de búsqueda
 * @param {HTMLElement} deps.useBtnEl Botón principal para usar la plantilla
 * @param {HTMLElement} deps.cancelBtnEl Botón de cancelación / cierre
 * @param {HTMLElement} [deps.metaEl] Contenedor de metadatos de la plantilla activa
 * @param {(template: object) => void} deps.onSelectTemplate Callback al confirmar una plantilla
 */
export function createTemplateGalleryModal({
  dialogEl,
  listEl,
  previewEl,
  searchEl,
  useBtnEl,
  cancelBtnEl,
  metaEl,
  onSelectTemplate,
}) {
  /** @type {object[]} Catálogo completo de plantillas */
  let catalog = [];
  /** @type {object[]} Plantillas filtradas por la búsqueda actual */
  let filteredCatalog = [];
  /** @type {object|null} Plantilla actualmente seleccionada */
  let selectedTemplate = null;

  function isOpen() {
    return !dialogEl.classList.contains('hidden');
  }

  function renderList() {
    if (!listEl) return;

    if (filteredCatalog.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'template-gallery__empty';
      empty.textContent = t('gallery.noResults');
      listEl.replaceChildren(empty);
      if (previewEl) previewEl.replaceChildren();
      if (useBtnEl) {
        useBtnEl.disabled = true;
        useBtnEl.textContent = t('gallery.useTemplate');
      }
      return;
    }

    const language = getLanguage();
    const fragment = document.createDocumentFragment();

    for (const template of filteredCatalog) {
      const { name, description } = localizeTemplate(template, language);
      const isSelected = selectedTemplate && (selectedTemplate.id === template.id || selectedTemplate.name === template.name);

      const item = document.createElement('button');
      item.type = 'button';
      item.className = `template-gallery__item ${isSelected ? 'is-selected' : ''}`;
      item.setAttribute('data-template-id', template.id || template.name);

      const thumb = document.createElement('div');
      thumb.className = 'template-gallery__item-thumb';
      thumb.innerHTML = getTemplateThumbnailSvg(template.id || template.name);
      item.append(thumb);

      const details = document.createElement('div');
      details.className = 'template-gallery__item-details';

      const titleRow = document.createElement('div');
      titleRow.className = 'template-gallery__item-title-row';

      const title = document.createElement('span');
      title.className = 'template-gallery__item-title';
      title.textContent = name;
      titleRow.append(title);

      const category = template.dbv?.dbvCategory || template.category;
      if (category) {
        const badge = document.createElement('span');
        badge.className = 'template-gallery__item-badge';
        badge.textContent = category;
        titleRow.append(badge);
      }
      details.append(titleRow);

      const desc = document.createElement('span');
      desc.className = 'template-gallery__item-desc';
      desc.textContent = description;
      details.append(desc);

      item.append(details);

      item.addEventListener('click', () => {
        selectTemplate(template);
      });

      fragment.append(item);
    }

    listEl.replaceChildren(fragment);
  }

  function renderPreview() {
    if (!selectedTemplate || !previewEl) return;

    const language = getLanguage();
    const { name, description } = localizeTemplate(selectedTemplate, language);

    // Renderizar la página maquetada completa en SVG
    const templateIdentifier = selectedTemplate.id || selectedTemplate.universeSpec || selectedTemplate.name;
    const svgCode = getTemplateFullPreviewSvg(templateIdentifier);
    previewEl.innerHTML = `
      <div class="template-gallery__preview-wrapper">
        <div class="template-gallery__page-canvas">
          ${svgCode}
        </div>
      </div>
    `;

    // Actualizar metadatos informativos si existe el contenedor
    if (metaEl) {
      const category = selectedTemplate.dbv?.dbvCategory || selectedTemplate.category || 'General';
      const version = selectedTemplate.version ? `v${selectedTemplate.version}` : '';
      const entrypoint = selectedTemplate.entrypoint || 'main.typ';
      const licenseChip = selectedTemplate.license ? `<span class="template-gallery__meta-chip">⚖️ ${selectedTemplate.license}</span>` : '';

      metaEl.innerHTML = `
        <div class="template-gallery__meta-row">
          <span class="template-gallery__meta-title">${name}</span>
          <span class="template-gallery__meta-badge">${category}</span>
          ${version ? `<span class="template-gallery__meta-version">${version}</span>` : ''}
        </div>
        <p class="template-gallery__meta-desc">${description}</p>
        <div class="template-gallery__meta-chips">
          <span class="template-gallery__meta-chip">📄 ${entrypoint}</span>
          <span class="template-gallery__meta-chip">🏷️ ${templateIdentifier}</span>
          ${licenseChip}
        </div>
      `;
    }

    // Actualizar botón de acción principal
    if (useBtnEl) {
      useBtnEl.disabled = false;
      const label = t('gallery.useTemplateNamed', { name }).replace('{name}', name);
      useBtnEl.textContent = label;
    }
  }

  function selectTemplate(template) {
    selectedTemplate = template;
    // Actualizar clases de selección en la lista
    if (listEl) {
      const items = listEl.querySelectorAll('.template-gallery__item');
      for (const el of items) {
        const id = el.getAttribute('data-template-id');
        if (id === (template.id || template.name)) {
          el.classList.add('is-selected');
          el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        } else {
          el.classList.remove('is-selected');
        }
      }
    }
    renderPreview();
  }

  function applyFilter(query = '') {
    const q = query.trim().toLowerCase();
    if (!q) {
      filteredCatalog = catalog.slice();
    } else {
      const language = getLanguage();
      filteredCatalog = catalog.filter((tpl) => {
        const { name, description } = localizeTemplate(tpl, language);
        const category = (tpl.dbv?.dbvCategory || tpl.category || '').toLowerCase();
        const id = (tpl.id || tpl.name || '').toLowerCase();
        const tags = (tpl.keywords || []).join(' ').toLowerCase();

        return (
          name.toLowerCase().includes(q) ||
          description.toLowerCase().includes(q) ||
          category.includes(q) ||
          id.includes(q) ||
          tags.includes(q)
        );
      });
    }

    // Mantener la plantilla seleccionada si sigue visible, o seleccionar la primera
    if (filteredCatalog.length > 0) {
      const stillVisible = selectedTemplate && filteredCatalog.some(
        (t) => (t.id || t.name) === (selectedTemplate.id || selectedTemplate.name)
      );
      if (!stillVisible) {
        selectedTemplate = filteredCatalog[0];
      }
    } else {
      selectedTemplate = null;
    }

    renderList();
    renderPreview();
  }

  // Eventos del campo de búsqueda
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      applyFilter(searchEl.value);
    });
  }

  // Navegación por teclado en la lista
  dialogEl?.addEventListener('keydown', (event) => {
    if (!isOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (filteredCatalog.length === 0) return;
      event.preventDefault();

      const currentIndex = filteredCatalog.findIndex(
        (t) => (t.id || t.name) === (selectedTemplate?.id || selectedTemplate?.name)
      );

      let nextIndex = 0;
      if (event.key === 'ArrowDown') {
        nextIndex = currentIndex < filteredCatalog.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : filteredCatalog.length - 1;
      }

      selectTemplate(filteredCatalog[nextIndex]);
      return;
    }

    if (event.key === 'Enter' && event.target !== searchEl) {
      if (selectedTemplate && onSelectTemplate) {
        event.preventDefault();
        confirmSelection();
      }
    }
  });

  function confirmSelection() {
    if (!selectedTemplate) return;
    const chosen = selectedTemplate;
    close();
    onSelectTemplate(chosen);
  }

  // Botones de acción
  if (useBtnEl) {
    useBtnEl.addEventListener('click', confirmSelection);
  }

  if (cancelBtnEl) {
    cancelBtnEl.addEventListener('click', close);
  }

  // Cerrar al pulsar sobre el fondo oscuro del modal
  dialogEl?.addEventListener('click', (event) => {
    if (event.target === dialogEl) {
      close();
    }
  });

  function open(initialTemplateId = null, availableCatalog = []) {
    if (availableCatalog && availableCatalog.length > 0) {
      catalog = availableCatalog.slice();
    }
    filteredCatalog = catalog.slice();

    if (searchEl) {
      searchEl.value = '';
    }

    // Seleccionar la plantilla inicial si se proporciona, o la primera del catálogo
    if (initialTemplateId && catalog.length > 0) {
      const cleanId = initialTemplateId.replace(/^(@local\/|@preview\/)/, '').split(':')[0].toLowerCase();
      const found = catalog.find((t) => {
        if (!t) return false;
        if (t.id === initialTemplateId || t.universeSpec === initialTemplateId || t.name === initialTemplateId) return true;
        const tId = (t.id || t.universeSpec || t.name || '').replace(/^(@local\/|@preview\/)/, '').split(':')[0].toLowerCase();
        return tId === cleanId;
      });
      selectedTemplate = found || catalog[0];
    } else if (catalog.length > 0) {
      selectedTemplate = catalog[0];
    } else {
      selectedTemplate = null;
    }

    renderList();
    renderPreview();

    dialogEl.classList.remove('hidden');
    // Foco en el buscador para escribir o navegar con flechas inmediatamente
    searchEl?.focus();
  }

  function close() {
    dialogEl.classList.add('hidden');
  }

  return {
    open,
    close,
    isOpen,
    selectTemplate,
    getSelectedTemplate: () => selectedTemplate,
    setCatalog: (newCatalog) => {
      catalog = newCatalog ? newCatalog.slice() : [];
      filteredCatalog = catalog.slice();
    },
    refreshLanguage() {
      if (isOpen()) {
        renderList();
        renderPreview();
      }
    },
  };
}
