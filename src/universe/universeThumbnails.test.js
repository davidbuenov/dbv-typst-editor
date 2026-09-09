// =============================================================================
// DBV Typst Editor — Tests de resolución de thumbnails de Typst Universe
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  findCuratedMetadata,
  getCuratedUniverseTemplatesCatalog,
  getUniversePackageIcon,
  getUniverseThumbnailUrl,
} from './universeThumbnails.js';

describe('universeThumbnails', () => {
  it('resuelve la URL correcta para plantillas curadas con thumbnail estándar', () => {
    const url = getUniverseThumbnailUrl('@preview/charged-ieee:0.1.4');
    expect(url).toBe(
      'https://raw.githubusercontent.com/typst/packages/main/packages/preview/charged-ieee/0.1.4/thumbnail.png'
    );
  });

  it('resuelve la ruta especial de thumbnail para springer-spaniel y modern-cv', () => {
    const springer = getUniverseThumbnailUrl('@preview/springer-spaniel:0.1.0');
    expect(springer).toContain('/springer-spaniel/0.1.0/thumbnails/1.png');

    const cv = getUniverseThumbnailUrl('@preview/modern-cv:0.10.0');
    expect(cv).toContain('/modern-cv/0.10.0/assets/images/resume.png');
  });

  it('devuelve null si el spec no es válido', () => {
    expect(getUniverseThumbnailUrl('invalido')).toBeNull();
    expect(getUniverseThumbnailUrl('@local/tfg:1.0.0')).toBeNull();
  });

  it('proporciona iconos SVG temáticos para paquetes conocidos', () => {
    const cetzIcon = getUniversePackageIcon('cetz');
    expect(cetzIcon).toContain('<svg');
    const defaultIcon = getUniversePackageIcon('desconocido');
    expect(defaultIcon).toContain('<svg');
  });

  it('localiza metadatos de plantillas y paquetes curados', () => {
    const metaTpl = findCuratedMetadata('@preview/ilm:2.1.1');
    expect(metaTpl.isTemplate).toBe(true);
    expect(metaTpl.title).toContain('ilm');

    const metaPkg = findCuratedMetadata('@preview/cetz:0.5.2');
    expect(metaPkg.isTemplate).toBe(false);
    expect(metaPkg.license).toContain('LGPL');
  });

  it('exporta el catálogo curado de plantillas en formato compatible con TemplateGalleryModal y Wizard', () => {
    const catalog = getCuratedUniverseTemplatesCatalog();
    expect(catalog.length).toBe(6);
    for (const tpl of catalog) {
      expect(tpl.id).toMatch(/^@preview\//);
      expect(tpl.universeSpec).toBe(tpl.id);
      expect(tpl.entrypoint).toBe('main.typ');
      expect(tpl.category).toBe('Typst Universe');
      expect(tpl.dbv.dbvCategory).toBe('Typst Universe');
      expect(tpl.dbv.localization.es.name).toBeTruthy();
      expect(tpl.dbv.localization.en.name).toBeTruthy();
    }
  });
});

