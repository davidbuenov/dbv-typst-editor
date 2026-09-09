// =============================================================================
// DBV Typst Editor — Tests del Modal de Galería de Plantillas
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTemplateGalleryModal } from './templateGalleryModal.js';

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

