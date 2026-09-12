// =============================================================================
// DBV Typst Editor — Tests del Modal de Galería de Plantillas
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countBySource,
  createTemplateGalleryModal,
  templateSource,
} from './templateGalleryModal.js';

describe('templateGalleryModal', () => {
  let dialogEl;
  let listEl;
  let previewEl;
  let searchEl;
  let useBtnEl;
  let cancelBtnEl;
  let metaEl;
  let onSelectTemplate;

  const mockCatalog = [
    {
      id: '@local/dbv-tfg',
      name: 'dbv-tfg',
      version: '1.0.0',
      description: 'Plantilla completa para Trabajo de Fin de Grado',
      dbv: { dbvCategory: 'TFG' },
    },
    {
      id: '@local/dbv-articulo',
      name: 'dbv-articulo',
      version: '1.0.0',
      description: 'Artículo científico a dos columnas',
      dbv: { dbvCategory: 'Artículo' },
    },
    {
      id: '@local/dbv-presentacion',
      name: 'dbv-presentacion',
      version: '1.0.0',
      description: 'Presentación 16:9 con Touying',
      dbv: { dbvCategory: 'Presentación' },
    },
  ];

  beforeEach(() => {
    dialogEl = document.createElement('div');
    dialogEl.className = 'modal hidden';

    listEl = document.createElement('div');
    previewEl = document.createElement('div');
    searchEl = document.createElement('input');
    searchEl.type = 'search';
    useBtnEl = document.createElement('button');
    cancelBtnEl = document.createElement('button');
    metaEl = document.createElement('div');

    dialogEl.append(searchEl, listEl, previewEl, metaEl, useBtnEl, cancelBtnEl);
    document.body.appendChild(dialogEl);

    onSelectTemplate = vi.fn();
  });

  it('inicia cerrado y expone isOpen() correctamente', () => {
    const gallery = createTemplateGalleryModal({
      dialogEl,
      listEl,
      previewEl,
      searchEl,
      useBtnEl,
      cancelBtnEl,
      metaEl,
      onSelectTemplate,
    });

    expect(gallery.isOpen()).toBe(false);
  });

  it('al abrir, muestra las plantillas del catálogo y selecciona la primera por defecto', () => {
    const gallery = createTemplateGalleryModal({
      dialogEl,
      listEl,
      previewEl,
      searchEl,
      useBtnEl,
      cancelBtnEl,
      metaEl,
      onSelectTemplate,
    });

    gallery.open(null, mockCatalog);

    expect(gallery.isOpen()).toBe(true);
    expect(listEl.children.length).toBe(3);
    expect(gallery.getSelectedTemplate()?.id).toBe('@local/dbv-tfg');
    expect(previewEl.innerHTML).toContain('template-full-preview-svg');
  });

  it('permite abrir seleccionando una plantilla concreta mediante su ID', () => {
    const gallery = createTemplateGalleryModal({
      dialogEl,
      listEl,
      previewEl,
      searchEl,
      useBtnEl,
      cancelBtnEl,
      metaEl,
      onSelectTemplate,
    });

    gallery.open('dbv-presentacion', mockCatalog);

    expect(gallery.getSelectedTemplate()?.id).toBe('@local/dbv-presentacion');
    expect(previewEl.innerHTML).toContain('viewBox="0 0 960 540"');
  });

  it('filtra la lista en tiempo real según el texto introducido en el buscador', () => {
    const gallery = createTemplateGalleryModal({
      dialogEl,
      listEl,
      previewEl,
      searchEl,
      useBtnEl,
      cancelBtnEl,
      metaEl,
      onSelectTemplate,
    });

    gallery.open(null, mockCatalog);

    searchEl.value = 'presentacion';
    searchEl.dispatchEvent(new Event('input'));

    expect(listEl.children.length).toBe(1);
    expect(gallery.getSelectedTemplate()?.id).toBe('@local/dbv-presentacion');
  });

  it('permite navegar entre plantillas usando las flechas de teclado', () => {
    const gallery = createTemplateGalleryModal({
      dialogEl,
      listEl,
      previewEl,
      searchEl,
      useBtnEl,
      cancelBtnEl,
      metaEl,
      onSelectTemplate,
    });

    gallery.open(null, mockCatalog);
    expect(gallery.getSelectedTemplate()?.id).toBe('@local/dbv-tfg');

    dialogEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(gallery.getSelectedTemplate()?.id).toBe('@local/dbv-articulo');

    dialogEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(gallery.getSelectedTemplate()?.id).toBe('@local/dbv-tfg');
  });

  it('confirma la selección y llama a onSelectTemplate al pulsar el botón de usar', () => {
    const gallery = createTemplateGalleryModal({
      dialogEl,
      listEl,
      previewEl,
      searchEl,
      useBtnEl,
      cancelBtnEl,
      metaEl,
      onSelectTemplate,
    });

    gallery.open('dbv-articulo', mockCatalog);
    useBtnEl.click();

    expect(onSelectTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: '@local/dbv-articulo' })
    );
    expect(gallery.isOpen()).toBe(false);
  });

  it('se cierra al pulsar la tecla Escape o el botón de cancelar', () => {
    const gallery = createTemplateGalleryModal({
      dialogEl,
      listEl,
      previewEl,
      searchEl,
      useBtnEl,
      cancelBtnEl,
      metaEl,
      onSelectTemplate,
    });

    gallery.open(null, mockCatalog);
    expect(gallery.isOpen()).toBe(true);

    dialogEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(gallery.isOpen()).toBe(false);

    gallery.open(null, mockCatalog);
    cancelBtnEl.click();
    expect(gallery.isOpen()).toBe(false);
  });

  it('permite abrir y previsualizar plantillas de Typst Universe con metadatos y licencia', () => {
    const universeCatalog = [
      ...mockCatalog,
      {
        id: '@preview/charged-ieee:0.1.4',
        name: 'IEEE — artículo de congreso o revista',
        description: 'Formato IEEE para ingeniería e informática.',
        version: '0.1.4',
        category: 'Typst Universe',
        entrypoint: 'main.typ',
        universeSpec: '@preview/charged-ieee:0.1.4',
        license: 'MIT-0',
        dbv: { dbvCategory: 'Typst Universe' },
      },
    ];

    const gallery = createTemplateGalleryModal({
      dialogEl,
      listEl,
      previewEl,
      searchEl,
      useBtnEl,
      cancelBtnEl,
      metaEl,
      onSelectTemplate,
    });

    gallery.open('@preview/charged-ieee:0.1.4', universeCatalog);
    expect(gallery.isOpen()).toBe(true);
    expect(gallery.getSelectedTemplate()?.id).toBe('@preview/charged-ieee:0.1.4');
    expect(previewEl.innerHTML).toContain('template-full-preview-svg');
    expect(previewEl.innerHTML).toContain('IEEE TRANSACTIONS');
    expect(metaEl.innerHTML).toContain('Typst Universe');
    expect(metaEl.innerHTML).toContain('MIT-0');

    useBtnEl.click();
    expect(onSelectTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ universeSpec: '@preview/charged-ieee:0.1.4' })
    );
  });
});

// ─── RF-26: la galería como única puerta de entrada ─────────────────────────
describe('galería unificada de tres pestañas (RF-26)', () => {
  const catalogoMixto = [
    { id: '@local/dbv-tfg', name: 'dbv-tfg', version: '1.0.0', description: 'TFG' },
    { id: '@local/dbv-articulo', name: 'dbv-articulo', version: '1.0.0', description: 'Artículo' },
    {
      id: '@preview/charged-ieee:0.1.4',
      name: 'charged-ieee',
      version: '0.1.4',
      description: 'IEEE',
      universeSpec: '@preview/charged-ieee:0.1.4',
    },
  ];

  function montar({ onPreviewSpec } = {}) {
    const dialogEl = document.createElement('div');
    dialogEl.className = 'modal hidden';

    const listEl = document.createElement('div');
    const previewEl = document.createElement('div');
    const metaEl = document.createElement('div');
    const searchWrap = document.createElement('div');
    const searchEl = document.createElement('input');
    searchWrap.append(searchEl);
    const useBtnEl = document.createElement('button');
    const cancelBtnEl = document.createElement('button');
    const sidebarEl = document.createElement('aside');
    const specPanelEl = document.createElement('aside');
    specPanelEl.className = 'hidden';
    const specInputEl = document.createElement('input');
    const specErrorEl = document.createElement('p');
    specErrorEl.className = 'hidden';
    const specPreviewBtnEl = document.createElement('button');

    const tabsEl = document.createElement('div');
    for (const tab of ['local', 'universe', 'spec']) {
      const button = document.createElement('button');
      button.setAttribute('data-gallery-tab', tab);
      const count = document.createElement('span');
      count.setAttribute('data-gallery-tab-count', '');
      button.append(count);
      tabsEl.append(button);
    }

    sidebarEl.append(listEl);
    specPanelEl.append(specInputEl, specErrorEl, specPreviewBtnEl);
    dialogEl.append(tabsEl, searchWrap, sidebarEl, specPanelEl, previewEl, metaEl, useBtnEl, cancelBtnEl);
    document.body.append(dialogEl);

    const gallery = createTemplateGalleryModal({
      dialogEl,
      listEl,
      previewEl,
      searchEl,
      useBtnEl,
      cancelBtnEl,
      metaEl,
      onSelectTemplate: vi.fn(),
      tabsEl,
      sidebarEl,
      specPanelEl,
      specInputEl,
      specErrorEl,
      specPreviewBtnEl,
      onPreviewSpec,
    });

    return {
      gallery,
      tabsEl,
      searchEl,
      specInputEl,
      specErrorEl,
      specPreviewBtnEl,
      useBtnEl,
      previewEl,
      metaEl,
      sidebarEl,
      specPanelEl,
    };
  }

  it('separa el catálogo por origen sin necesitar que nadie lo etiquete', () => {
    expect(templateSource(catalogoMixto[0])).toBe('local');
    expect(templateSource(catalogoMixto[2])).toBe('universe');
    // Una entrada de Universe puede llegar sin `universeSpec` si viene del
    // catálogo curado: el prefijo del registro público basta para reconocerla.
    expect(templateSource({ id: '@preview/ilm:1.4.1' })).toBe('universe');
    expect(countBySource(catalogoMixto)).toEqual({ local: 2, universe: 1 });
  });

  it('cada pestaña muestra solo las plantillas de su origen', () => {
    const { gallery } = montar();
    gallery.open(null, catalogoMixto);

    expect(gallery.getActiveTab()).toBe('local');
    expect(gallery.getVisibleTemplates().map((t) => t.name)).toEqual(['dbv-tfg', 'dbv-articulo']);

    gallery.setActiveTab('universe');
    expect(gallery.getVisibleTemplates().map((t) => t.name)).toEqual(['charged-ieee']);
  });

  it('abrir con un identificador de Universe deja visible su pestaña', () => {
    // Si no, la plantilla quedaría seleccionada dentro de una lista oculta.
    const { gallery } = montar();
    gallery.open('@preview/charged-ieee:0.1.4', catalogoMixto);
    expect(gallery.getActiveTab()).toBe('universe');
    expect(gallery.getSelectedTemplate().name).toBe('charged-ieee');
  });

  it('la pestaña Dirección sustituye la lista, no la vista previa', () => {
    const { gallery, sidebarEl, specPanelEl } = montar();
    gallery.open(null, catalogoMixto);

    gallery.setActiveTab('spec');
    expect(sidebarEl.classList.contains('hidden')).toBe(true);
    expect(specPanelEl.classList.contains('hidden')).toBe(false);

    gallery.setActiveTab('local');
    expect(sidebarEl.classList.contains('hidden')).toBe(false);
    expect(specPanelEl.classList.contains('hidden')).toBe(true);
  });

  it('un identificador incompleto explica qué falta y bloquea la acción principal', () => {
    const { gallery, specInputEl, specErrorEl, specPreviewBtnEl, useBtnEl } = montar();
    gallery.open(null, catalogoMixto);
    gallery.setActiveTab('spec');

    specInputEl.value = '@preview/charged-ieee';
    specInputEl.dispatchEvent(new Event('input'));

    expect(specErrorEl.classList.contains('hidden')).toBe(false);
    expect(specPreviewBtnEl.disabled).toBe(true);
    expect(useBtnEl.disabled).toBe(true);
  });

  it('un identificador válido habilita crear y previsualizar', () => {
    const { gallery, specInputEl, specErrorEl, specPreviewBtnEl, useBtnEl } = montar();
    gallery.open(null, catalogoMixto);
    gallery.setActiveTab('spec');

    specInputEl.value = '@preview/charged-ieee:0.1.4';
    specInputEl.dispatchEvent(new Event('input'));

    expect(specErrorEl.classList.contains('hidden')).toBe(true);
    expect(specPreviewBtnEl.disabled).toBe(false);
    expect(useBtnEl.disabled).toBe(false);
    expect(gallery.getSelectedTemplate().universeSpec).toBe('@preview/charged-ieee:0.1.4');
  });

  it('no toca la red hasta que se pulsa el control que lo anuncia (RF-26.6)', async () => {
    const onPreviewSpec = vi.fn().mockResolvedValue({ ok: true, value: '<svg></svg>' });
    const { gallery, specInputEl, specPreviewBtnEl, previewEl } = montar({ onPreviewSpec });
    gallery.open(null, catalogoMixto);
    gallery.setActiveTab('spec');

    specInputEl.value = '@preview/charged-ieee:0.1.4';
    specInputEl.dispatchEvent(new Event('input'));
    // Validar NO descarga: escribir un identificador correcto no puede disparar
    // la descarga y ejecución de código de terceros.
    expect(onPreviewSpec).not.toHaveBeenCalled();

    specPreviewBtnEl.click();
    await vi.waitFor(() => expect(onPreviewSpec).toHaveBeenCalledWith('@preview/charged-ieee:0.1.4'));
    await vi.waitFor(() => expect(previewEl.innerHTML).toContain('<svg>'));
  });

  it('un paquete que no es plantilla se explica y no deja crear el documento', async () => {
    const onPreviewSpec = vi.fn().mockResolvedValue({ ok: false, error: { kind: 'notATemplate' } });
    const { gallery, specInputEl, specPreviewBtnEl, useBtnEl } = montar({ onPreviewSpec });
    gallery.open(null, catalogoMixto);
    gallery.setActiveTab('spec');

    specInputEl.value = '@preview/cetz:0.3.1';
    specInputEl.dispatchEvent(new Event('input'));
    expect(useBtnEl.disabled).toBe(false);

    specPreviewBtnEl.click();
    await vi.waitFor(() => expect(useBtnEl.disabled).toBe(true));
  });

  // Bug real (2026-09-12): el usuario eligió "Artículo académico" en la
  // pestaña Local, luego escribió y descargó "@preview/campanile:0.1.0" en
  // "Dirección" — el lienzo mostraba correctamente la maquetación de
  // campanile, pero el pie de abajo (título/versión/ficheros) seguía
  // anunciando "Artículo académico", sin relación ninguna con lo descargado.
  describe('el pie de metadatos no se queda con la plantilla de otra pestaña (RF-26.6)', () => {
    it('cambia en cuanto se escribe un identificador válido, sin esperar la descarga', () => {
      const { gallery, specInputEl, metaEl } = montar();
      gallery.open(null, catalogoMixto);
      // Como en el reporte real: primero se elige una plantilla LOCAL.
      gallery.setActiveTab('local');
      gallery.selectTemplate(catalogoMixto[1]); // dbv-articulo
      expect(metaEl.textContent).toContain('dbv-articulo');

      gallery.setActiveTab('spec');
      specInputEl.value = '@preview/campanile:0.1.0';
      specInputEl.dispatchEvent(new Event('input'));

      expect(metaEl.textContent).not.toContain('dbv-articulo');
      expect(metaEl.textContent).toContain('@preview/campanile:0.1.0');
    });

    it('tras la descarga real, el pie sigue hablando del identificador descargado, no de otra plantilla', async () => {
      const onPreviewSpec = vi.fn().mockResolvedValue({ ok: true, value: '<svg>campanile</svg>' });
      const { gallery, specInputEl, specPreviewBtnEl, previewEl, metaEl } = montar({ onPreviewSpec });
      gallery.open(null, catalogoMixto);
      gallery.setActiveTab('local');
      gallery.selectTemplate(catalogoMixto[1]); // dbv-articulo

      gallery.setActiveTab('spec');
      specInputEl.value = '@preview/campanile:0.1.0';
      specInputEl.dispatchEvent(new Event('input'));
      specPreviewBtnEl.click();

      await vi.waitFor(() => expect(previewEl.innerHTML).toContain('campanile'));
      expect(metaEl.textContent).not.toContain('dbv-articulo');
      expect(metaEl.textContent).toContain('@preview/campanile:0.1.0');
    });

    it('entrar en la pestaña Dirección con el campo vacío no arrastra el pie de la pestaña anterior', () => {
      const { gallery, metaEl } = montar();
      gallery.open(null, catalogoMixto);
      gallery.setActiveTab('universe');
      expect(metaEl.textContent).toContain('charged-ieee');

      gallery.setActiveTab('spec');

      expect(metaEl.textContent).not.toContain('charged-ieee');
    });
  });

  // El buscador del catálogo completo de Typst Universe (RF-34) puede
  // encontrar una PLANTILLA, no solo un paquete — y una plantilla no se
  // importa en el documento abierto, se crea como proyecto nuevo. Por eso
  // "Usar" sobre ella redirige aquí en vez de tocar el editor.
  it('openWithSpec abre directamente en Dirección con el identificador ya puesto, sin descargar solo', () => {
    const onPreviewSpec = vi.fn();
    const { gallery, specInputEl, tabsEl } = montar({ onPreviewSpec });

    gallery.openWithSpec('@preview/campanile:0.1.0', catalogoMixto);

    expect(gallery.getActiveTab()).toBe('spec');
    expect(specInputEl.value).toBe('@preview/campanile:0.1.0');
    expect(tabsEl.querySelector('[data-gallery-tab="spec"]').classList.contains('is-active')).toBe(true);
    // Solo escribe el identificador — RF-26.6 exige un clic aparte para
    // descargar y ejecutar código de terceros, incluso viniendo ya del
    // buscador de Universe.
    expect(onPreviewSpec).not.toHaveBeenCalled();
  });

  it('el buscador filtra dentro de la pestaña abierta, no en todo el catálogo', () => {
    const { gallery, searchEl } = montar();
    gallery.open(null, catalogoMixto);
    gallery.setActiveTab('universe');

    // "dbv" solo aparece en las plantillas locales. Desde la pestaña de
    // Universe no debe devolver ninguna: encontrar un resultado que vive en una
    // pestaña que no ves es peor que no encontrarlo.
    searchEl.value = 'dbv';
    searchEl.dispatchEvent(new Event('input'));
    expect(gallery.getVisibleTemplates()).toHaveLength(0);

    // Y el mismo texto desde la pestaña local sí encuentra las dos.
    gallery.setActiveTab('local');
    searchEl.value = 'dbv';
    searchEl.dispatchEvent(new Event('input'));
    expect(gallery.getVisibleTemplates()).toHaveLength(2);
  });
});

// ─── RF-29: ver la página a tamaño grande ───────────────────────────────────
describe('vista ampliada de la previsualización (RF-29)', () => {
  const catalogo = [
    { id: '@local/dbv-tfg', name: 'dbv-tfg', version: '1.0.0', description: 'TFG' },
  ];

  function montarConZoom() {
    const dialogEl = document.createElement('div');
    dialogEl.className = 'modal hidden';

    const listEl = document.createElement('div');
    const previewEl = document.createElement('div');
    const metaEl = document.createElement('div');
    const searchWrap = document.createElement('div');
    const searchEl = document.createElement('input');
    searchWrap.append(searchEl);
    const useBtnEl = document.createElement('button');
    const cancelBtnEl = document.createElement('button');
    const sidebarEl = document.createElement('aside');

    const zoomEl = document.createElement('div');
    zoomEl.className = 'hidden';
    const zoomContentEl = document.createElement('div');
    const zoomCloseEl = document.createElement('button');
    zoomEl.append(zoomCloseEl, zoomContentEl);

    sidebarEl.append(listEl);
    dialogEl.append(searchWrap, sidebarEl, previewEl, metaEl, useBtnEl, cancelBtnEl, zoomEl);
    document.body.append(dialogEl);

    const gallery = createTemplateGalleryModal({
      dialogEl,
      listEl,
      previewEl,
      searchEl,
      useBtnEl,
      cancelBtnEl,
      metaEl,
      onSelectTemplate: vi.fn(),
      sidebarEl,
      zoomEl,
      zoomContentEl,
      zoomCloseEl,
    });

    return { gallery, dialogEl, previewEl, zoomEl, zoomContentEl, zoomCloseEl };
  }

  it('pulsar la página la amplía', () => {
    const { gallery, previewEl, zoomEl, zoomContentEl } = montarConZoom();
    gallery.open(null, catalogo);

    previewEl.querySelector('.template-gallery__page-canvas').click();

    expect(gallery.isZoomOpen()).toBe(true);
    expect(zoomEl.classList.contains('hidden')).toBe(false);
    // La página se CLONA: la galería de debajo sigue mostrando la suya.
    expect(zoomContentEl.querySelector('svg')).not.toBeNull();
    expect(previewEl.querySelector('svg')).not.toBeNull();
  });

  it('el control de cierre la cierra', () => {
    const { gallery, zoomCloseEl } = montarConZoom();
    gallery.open(null, catalogo);
    gallery.openZoom();

    zoomCloseEl.click();

    expect(gallery.isZoomOpen()).toBe(false);
  });

  it('pulsar el fondo la cierra, pero pulsar la página no', () => {
    const { gallery, zoomEl, zoomContentEl } = montarConZoom();
    gallery.open(null, catalogo);
    gallery.openZoom();

    // Sobre la propia página no: ahí es donde se está mirando.
    zoomContentEl.click();
    expect(gallery.isZoomOpen()).toBe(true);

    zoomEl.click();
    expect(gallery.isZoomOpen()).toBe(false);
  });

  it('Escape cierra la ampliación y NO la galería', () => {
    // Cerrarlo todo de golpe obligaría a rehacer la búsqueda y la selección.
    const { gallery, dialogEl } = montarConZoom();
    gallery.open(null, catalogo);
    gallery.openZoom();

    dialogEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(gallery.isZoomOpen()).toBe(false);
    expect(gallery.isOpen()).toBe(true);
  });

  it('el segundo Escape ya sí cierra la galería', () => {
    const { gallery, dialogEl } = montarConZoom();
    gallery.open(null, catalogo);
    gallery.openZoom();

    dialogEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    dialogEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(gallery.isOpen()).toBe(false);
  });

  it('al cerrar la ampliación no se pierde la plantilla seleccionada', () => {
    const { gallery } = montarConZoom();
    gallery.open(null, catalogo);
    const antes = gallery.getSelectedTemplate();

    gallery.openZoom();
    gallery.closeZoom();

    expect(gallery.getSelectedTemplate()).toBe(antes);
  });

  it('cerrar la galería no deja la ampliación colgando', () => {
    const { gallery } = montarConZoom();
    gallery.open(null, catalogo);
    gallery.openZoom();

    gallery.close();

    expect(gallery.isZoomOpen()).toBe(false);
  });
});
