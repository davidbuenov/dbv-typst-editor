// =============================================================================
// DBV Typst Editor — Tests de miniaturas vectoriales de plantillas
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { getTemplateFullPreviewSvg, getTemplateThumbnailSvg } from './templateThumbnails.js';

describe('templateThumbnails', () => {
  const templates = [
    'dbv-tfg',
    'dbv-tfm',
    'dbv-articulo',
    'dbv-tesis',
    'dbv-informe-tecnico',
    'dbv-presentacion',
    'dbv-cv',
    'dbv-blank',
  ];

  it.each(templates)('genera un SVG válido para la plantilla %s', (tplId) => {
    const svg = getTemplateThumbnailSvg(tplId);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('template-thumbnail-svg');
    expect(svg).toContain('viewBox=');
  });

  it('soporta identificadores con el prefijo @local/', () => {
    const svg = getTemplateThumbnailSvg('@local/dbv-tfg');
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 210 297"');
  });

  it('genera SVG en formato 16:9 para la plantilla de presentación', () => {
    const svg = getTemplateThumbnailSvg('dbv-presentacion');
    expect(svg).toContain('viewBox="0 0 320 180"');
    expect(svg).toContain('template-thumbnail-svg--slide');
  });

  it('ofrece un SVG de fallback limpio para plantillas desconocidas', () => {
    const svg = getTemplateThumbnailSvg('plantilla-desconocida');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  const universeTemplates = [
    '@preview/charged-ieee:0.1.4',
    '@preview/faithful-acmart:0.1.0',
    '@preview/springer-spaniel:0.1.0',
    '@preview/ilm:2.1.1',
    '@preview/modern-cv:0.10.0',
    '@preview/appreciated-letter:0.1.0',
  ];

  it.each(universeTemplates)('genera miniatura SVG representativa para la plantilla de Universe %s', (spec) => {
    const svg = getTemplateThumbnailSvg(spec);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('template-thumbnail-svg');
    expect(svg).toContain('viewBox="0 0 210 297"');
  });

  describe('getTemplateFullPreviewSvg', () => {
    it.each(templates)('genera un SVG de alta fidelidad para la plantilla %s', (tplId) => {
      const svg = getTemplateFullPreviewSvg(tplId);
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('template-full-preview-svg');
      expect(svg).toContain('viewBox=');
      expect(svg).toContain('#ffffff');
    });

    it.each(universeTemplates)('genera un SVG de alta fidelidad para la plantilla de Universe %s', (spec) => {
      const svg = getTemplateFullPreviewSvg(spec);
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('template-full-preview-svg');
      expect(svg).toContain('viewBox="0 0 595 842"');
      expect(svg).toContain('#ffffff');
    });

    it('genera SVG en formato 16:9 (960x540) para la presentación', () => {
      const svg = getTemplateFullPreviewSvg('dbv-presentacion');
      expect(svg).toContain('viewBox="0 0 960 540"');
    });

    it('genera SVG en formato A4 (595x842) para artículos y TFG', () => {
      const svg = getTemplateFullPreviewSvg('dbv-articulo');
      expect(svg).toContain('viewBox="0 0 595 842"');
    });

    it('genera maqueta para paquetes arbitrarios de Universe', () => {
      const svg = getTemplateFullPreviewSvg('@preview/arbitrary-pkg:1.0.0');
      expect(svg).toContain('TYPST UNIVERSE TEMPLATE');
      expect(svg).toContain('@preview/arbitrary-pkg:1.0.0');
    });
  });
});

