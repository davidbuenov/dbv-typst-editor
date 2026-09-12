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
import { parseUniverseSpec } from '../universe/universeSpec.js';
import { localizeTemplate } from './launcher.js';
import { getTemplateFullPreviewSvg, getTemplateThumbnailSvg } from './templateThumbnails.js';

/**
 * De dónde viene una plantilla del catálogo unificado (RF-26).
 *
 * El catálogo que llega aquí ya venía fusionado desde antes de este rediseño
 * (`getFullGalleryCatalog()` en `main.js`), pero nada distinguía una plantilla
 * local de una de Universe. La marca no se inventa: una entrada de Universe
 * lleva `universeSpec`, o un `id` con el prefijo del registro público.
 *
 * @param {object} template
 * @returns {'local'|'universe'}
 */
export function templateSource(template) {
  if (!template) return 'local';
  if (template.universeSpec) return 'universe';
  const id = String(template.id || '');
  return id.startsWith('@preview/') ? 'universe' : 'local';
}

/**
 * Cuántas plantillas tiene cada pestaña. Se calcula sobre el catálogo COMPLETO,
 * no sobre el filtrado: el contador dice cuántas hay, no cuántas quedan tras
 * escribir en el buscador.
 *
 * @param {object[]} catalog
 * @returns {{local: number, universe: number}}
 */
export function countBySource(catalog) {
  const counts = { local: 0, universe: 0 };
  for (const template of catalog || []) counts[templateSource(template)] += 1;
  return counts;
}

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
 * @param {HTMLElement} [deps.tabsEl] Barra de las tres pestañas (RF-26)
 * @param {HTMLElement} [deps.sidebarEl] Columna de la lista, que la pestaña "Dirección" sustituye
 * @param {HTMLElement} [deps.specPanelEl] Panel del identificador libre
 * @param {HTMLInputElement} [deps.specInputEl] Campo del identificador libre
 * @param {HTMLElement} [deps.specErrorEl] Mensaje de error del identificador
 * @param {HTMLButtonElement} [deps.specPreviewBtnEl] Control que descarga y previsualiza
 * @param {((spec: string) => Promise<{ok: boolean, value?: string, error?: {kind: string}}>)|null} [deps.onPreviewSpec]
 * @param {HTMLElement} [deps.zoomEl] Capa de vista ampliada (RF-29)
 * @param {HTMLElement} [deps.zoomContentEl] Contenedor de la página ampliada
 * @param {HTMLButtonElement} [deps.zoomCloseEl] Control de cierre de la ampliación
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
  tabsEl,
  sidebarEl,
  specPanelEl,
  specInputEl,
  specErrorEl,
  specPreviewBtnEl,
  onPreviewSpec,
  zoomEl,
  zoomContentEl,
  zoomCloseEl,
}) {
  /** @type {object[]} Catálogo completo de plantillas */
  let catalog = [];
  /** @type {object[]} Plantillas filtradas por la búsqueda actual */
  let filteredCatalog = [];
  /** @type {object|null} Plantilla actualmente seleccionada */
  let selectedTemplate = null;
  /** @type {'local'|'universe'|'spec'} Pestaña activa (RF-26). */
  let activeTab = 'local';
  /** @type {object|null} Entrada sintética de la pestaña "Dirección", si ya se validó. */
  let typedTemplate = null;
  /** @type {string|null} Identificador cuyo lienzo se ve ahora mismo en la pestaña "Dirección". */
  let previewedSpec = null;

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

  /**
   * Metadatos informativos (título, versión, ficheros, licencia) de la
   * plantilla activa — separado de `renderPreview()` porque la pestaña
   * "Dirección" necesita refrescar SOLO esto tras descargar (ver
   * `previewTypedSpec`): su lienzo ya lo pinta la respuesta real del
   * servidor, y volver a llamar a `renderPreview()` lo sustituiría por el
   * SVG sintético de `getTemplateFullPreviewSvg`, que no sabe nada de un
   * identificador escrito a mano.
   *
   * Bug real (2026-09-12): al no llamarse desde ningún sitio de la pestaña
   * "Dirección", este panel se quedaba con los datos de la ÚLTIMA plantilla
   * elegida en OTRA pestaña — el usuario descargaba y previsualizaba
   * `@preview/campanile:0.1.0` y el pie seguía mostrando "Articulo
   * académico", una plantilla local sin relación ninguna.
   */
  function renderMeta(template) {
    if (!metaEl) return;
    if (!template) {
      metaEl.innerHTML = '';
      return;
    }

    const language = getLanguage();
    const { name, description } = localizeTemplate(template, language);
    const templateIdentifier = template.id || template.universeSpec || template.name;
    const category = template.dbv?.dbvCategory || template.category || 'General';
    const version = template.version ? `v${template.version}` : '';
    const entrypoint = template.entrypoint || 'main.typ';
    const licenseChip = template.license ? `<span class="template-gallery__meta-chip">⚖️ ${template.license}</span>` : '';

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

  function renderPreview() {
    if (!selectedTemplate || !previewEl) return;

    const language = getLanguage();
    const { name } = localizeTemplate(selectedTemplate, language);

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

    renderMeta(selectedTemplate);

    // Actualizar botón de acción principal
    if (useBtnEl) {
      useBtnEl.disabled = false;
      const label = t('gallery.useTemplateNamed', { name }).replace('{name}', name);
      useBtnEl.textContent = label;
    }
  }

  function renderTabs() {
    if (!tabsEl) return;
    const counts = countBySource(catalog);
    for (const button of tabsEl.querySelectorAll('[data-gallery-tab]')) {
      const tab = button.getAttribute('data-gallery-tab');
      const isActive = tab === activeTab;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      // El contador solo tiene sentido donde hay una lista que contar.
      const counter = button.querySelector('[data-gallery-tab-count]');
      if (counter && tab !== 'spec') counter.textContent = String(counts[tab] ?? 0);
    }
  }

  function setActiveTab(tab) {
    activeTab = tab;
    const isSpec = tab === 'spec';

    // La pestaña "Dirección" sustituye la columna de la lista por su formulario:
    // el panel de vista previa NO se mueve, que es lo que impide que las tres
    // vías vuelvan a divergir en tres interfaces distintas.
    sidebarEl?.classList.toggle('hidden', isSpec);
    specPanelEl?.classList.toggle('hidden', !isSpec);
    if (searchEl) searchEl.parentElement?.classList.toggle('hidden', isSpec);

    renderTabs();
    if (searchEl) searchEl.value = '';
    if (isSpec) {
      renderSpecState();
    } else {
      applyFilter('');
    }
  }

  /** Estado del formulario de identificador libre: validez, error y acciones. */
  function renderSpecState() {
    if (!specInputEl) return;
    const raw = specInputEl.value.trim();
    const parsed = raw ? parseUniverseSpec(raw) : { ok: false, reason: 'empty' };

    if (specErrorEl) {
      const showError = raw.length > 0 && !parsed.ok;
      specErrorEl.textContent = showError ? t('gallery.specErrorFormat') : '';
      specErrorEl.classList.toggle('hidden', !showError);
    }

    if (specPreviewBtnEl) specPreviewBtnEl.disabled = !parsed.ok;
    // La acción principal solo se habilita con un identificador válido; la
    // previsualización es opcional, no un peaje obligatorio.
    if (useBtnEl) useBtnEl.disabled = !parsed.ok;

    typedTemplate = parsed.ok ? syntheticTemplate(parsed.spec) : null;
    selectedTemplate = typedTemplate;
    // El pie tiene que reflejar el identificador escrito desde el primer
    // carácter válido — no solo tras pulsar "Descargar y previsualizar" —
    // para que nunca se quede mostrando la plantilla de OTRA pestaña.
    renderMeta(typedTemplate);

    // El lienzo, en cambio, SÍ se deja vacío hasta que se pulse el botón: es
    // el único punto de esta pestaña con permiso para tocar la red (RF-26.6).
    // Pero si ya había un lienzo de un identificador ANTERIOR, dejarlo puesto
    // mientras el pie ya habla de uno distinto sería el mismo problema que
    // esto arregla, solo que al revés — así que se limpia en cuanto deja de
    // corresponder a lo escrito.
    if (previewEl && typedTemplate?.universeSpec !== previewedSpec) {
      previewEl.replaceChildren();
      previewedSpec = null;
    }
  }

  /** Entrada de catálogo mínima para un identificador escrito a mano. */
  function syntheticTemplate(spec) {
    return {
      id: spec,
      name: spec,
      description: spec,
      version: spec.split(':')[1] || '',
      category: 'Typst Universe',
      entrypoint: 'main.typ',
      universeSpec: spec,
      dbv: { dbvCategory: 'Typst Universe' },
    };
  }

  /**
   * Descarga y compila la plantilla escrita a mano para enseñar su maquetación
   * real. Es el ÚNICO punto de esta pestaña que toca la red, y solo se llega
   * aquí desde un control que dice que va a hacerlo (RF-26.6).
   */
  async function previewTypedSpec() {
    if (!onPreviewSpec || !typedTemplate || !previewEl) return;
    const spec = typedTemplate.universeSpec;

    previewEl.innerHTML = `<div class="template-gallery__spec-status">${t('gallery.specDownloading')}</div>`;
    if (specPreviewBtnEl) specPreviewBtnEl.disabled = true;

    const result = await onPreviewSpec(spec);

    // Mientras se descargaba, el usuario ha podido cambiar de pestaña o de
    // identificador: una respuesta que ya no corresponde no se pinta.
    if (activeTab !== 'spec' || typedTemplate?.universeSpec !== spec) return;
    if (specPreviewBtnEl) specPreviewBtnEl.disabled = false;

    if (result?.ok) {
      previewEl.innerHTML = `
        <div class="template-gallery__preview-wrapper">
          <div class="template-gallery__page-canvas">${result.value}</div>
        </div>
      `;
      // Bug real (2026-09-12): esta rama nunca tocaba el pie de metadatos, así
      // que se quedaba con el de la plantilla elegida en OTRA pestaña antes de
      // llegar aquí — el lienzo mostraba correctamente la maquetación
      // descargada mientras el pie seguía anunciando una plantilla distinta.
      renderMeta(typedTemplate);
      previewedSpec = spec;
      return;
    }

    // "No es una plantilla" tiene su propio discriminante desde Rust: es el
    // fallo que de verdad se encuentra quien escribe un identificador a mano.
    const key =
      result?.error?.kind === 'notATemplate' ? 'gallery.specNotATemplate' : 'gallery.specPreviewFailed';
    previewEl.innerHTML = `<div class="template-gallery__spec-status is-error">${t(key)}</div>`;
    if (key === 'gallery.specNotATemplate' && useBtnEl) useBtnEl.disabled = true;
  }

  function isZoomOpen() {
    return Boolean(zoomEl) && !zoomEl.classList.contains('hidden');
  }

  /**
   * Amplía la página que haya ahora mismo en el panel de vista previa. Se clona
   * en vez de moverse: al cerrar, la galería sigue mostrando exactamente lo
   * mismo que antes, sin repintar ni perder la selección (RF-29.3).
   */
  function openZoom() {
    if (!zoomEl || !zoomContentEl || !previewEl) return;
    const pagina = previewEl.querySelector('.template-gallery__page-canvas');
    if (!pagina) return;

    zoomContentEl.replaceChildren(pagina.cloneNode(true));
    zoomEl.classList.remove('hidden');
    zoomCloseEl?.focus();
  }

  function closeZoom() {
    if (!zoomEl) return;
    zoomEl.classList.add('hidden');
    zoomContentEl?.replaceChildren();
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

  /** Las plantillas de la pestaña abierta, antes de aplicar el buscador. */
  function tabCatalog() {
    if (activeTab === 'spec') return typedTemplate ? [typedTemplate] : [];
    return catalog.filter((template) => templateSource(template) === activeTab);
  }

  function applyFilter(query = '') {
    const q = query.trim().toLowerCase();
    const base = tabCatalog();
    if (!q) {
      filteredCatalog = base.slice();
    } else {
      const language = getLanguage();
      filteredCatalog = base.filter((tpl) => {
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
      // Con la ampliación abierta, Escape la cierra a ella y NO la galería:
      // cerrarlo todo de golpe obligaría a rehacer la búsqueda y la selección.
      if (isZoomOpen()) {
        closeZoom();
        return;
      }
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

  // La página entera es la zona pulsable: es lo que el usuario mira, y darle
  // un botón aparte añadiría un control donde ya hay un objetivo evidente.
  previewEl?.addEventListener('click', (event) => {
    if (event.target.closest('.template-gallery__page-canvas')) openZoom();
  });

  zoomCloseEl?.addEventListener('click', closeZoom);
  // Pulsar el fondo cierra; pulsar la propia página, no — ahí se está mirando.
  zoomEl?.addEventListener('click', (event) => {
    if (event.target === zoomEl) closeZoom();
  });

  if (tabsEl) {
    for (const button of tabsEl.querySelectorAll('[data-gallery-tab]')) {
      button.addEventListener('click', () => setActiveTab(button.getAttribute('data-gallery-tab')));
    }
  }

  if (specInputEl) {
    specInputEl.addEventListener('input', renderSpecState);
    specInputEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      // Enter previsualiza en lugar de crear: en esta pestaña la tecla más
      // fácil de pulsar por inercia no debe ser la que descarga y genera un
      // proyecto de una vez.
      if (!specPreviewBtnEl?.disabled) previewTypedSpec();
    });
  }

  if (specPreviewBtnEl) {
    specPreviewBtnEl.addEventListener('click', previewTypedSpec);
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

    // Abrir con un identificador de Universe debe dejar visible la pestaña
    // donde esa plantilla vive; si no, la selección quedaría en una lista oculta.
    closeZoom();
    activeTab = selectedTemplate ? templateSource(selectedTemplate) : 'local';
    typedTemplate = null;
    previewedSpec = null;
    setActiveTab(activeTab);
    if (selectedTemplate) selectTemplate(selectedTemplate);

    dialogEl.classList.remove('hidden');
    // Foco en el buscador para escribir o navegar con flechas inmediatamente
    searchEl?.focus();
  }

  function close() {
    closeZoom();
    dialogEl.classList.add('hidden');
  }

  /**
   * Abre la galería directamente en la pestaña "Dirección" con `spec` ya
   * escrito, sin descargarlo — la política de RF-26.6 (nada de red sin un
   * control que lo declare) sigue en pie, así que hace falta un segundo
   * clic en "Descargar y previsualizar". Es la puerta de entrada de una
   * plantilla encontrada en el buscador del catálogo completo de Typst
   * Universe (RF-34): ese buscador vive en el panel de PAQUETES, y una
   * plantilla no se importa, se crea — de ahí que "Usar" sobre una de ellas
   * no dispare `onUsePackage`, sino este redirigido.
   */
  function openWithSpec(spec, availableCatalog = []) {
    open(null, availableCatalog);
    if (specInputEl) specInputEl.value = spec;
    setActiveTab('spec');
  }

  return {
    open,
    openWithSpec,
    close,
    isOpen,
    selectTemplate,
    setActiveTab,
    getActiveTab: () => activeTab,
    openZoom,
    closeZoom,
    isZoomOpen,
    getVisibleTemplates: () => filteredCatalog.slice(),
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
