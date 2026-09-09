// =============================================================================
// DBV Typst Editor — Miniaturas y Metadatos de Typst Universe
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Módulo para resolver miniaturas de previsualización y metadatos enriquecidos
// de plantillas y paquetes de Typst Universe:
// 1. Resuelve la URL o ruta oficial del thumbnail de plantillas curadas y de la comunidad.
// 2. Proporciona fallbacks SVG limpios para paquetes de utilidades (cetz, codly, etc.)
//    que no disponen de thumbnail de maquetación.
// 3. Proporciona caché en memoria para minimizar peticiones remotas.

import { CURATED_PACKAGES, CURATED_TEMPLATES } from './curatedCatalog.js';
import { parseUniverseSpec } from './universeSpec.js';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/typst/packages/main/packages/preview';

/**
 * Rutas verificadas para los thumbnails del catálogo curado.
 * Typst Universe almacena los thumbnails en diferentes rutas relativas dentro de cada paquete.
 */
const CURATED_THUMBNAIL_PATHS = {
  'charged-ieee:0.1.4': 'thumbnail.png',
  'faithful-acmart:0.1.0': 'thumbnail.png',
  'springer-spaniel:0.1.0': 'thumbnails/1.png',
  'ilm:2.1.1': 'thumbnail.png',
  'modern-cv:0.10.0': 'assets/images/resume.png',
  'appreciated-letter:0.1.0': 'thumbnail.png',
};

/**
 * Diccionario de iconos temáticos SVG para paquetes conocidos sin thumbnail.
 */
const PACKAGE_ICONS = {
  cetz: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M3 12h18"/><circle cx="12" cy="12" r="4"/></svg>`,
  fletcher: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="6" r="3"/><circle cx="19" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><path d="M7.6 7.4l6.8 8.2"/><path d="M16.4 7.4l-2.8 3.4"/><path d="M7.5 6h9"/></svg>`,
  touying: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 8l5 3-5 3V8z"/></svg>`,
  'quick-maths': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/><path d="M14 5h6"/></svg>`,
  physica: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)"/><circle cx="12" cy="12" r="2"/></svg>`,
  codly: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  showybox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/><circle cx="7" cy="6" r="1"/></svg>`,
  default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
};

/**
 * Obtiene la URL de la miniatura oficial de una plantilla de Typst Universe.
 * @param {string} spec Identificador completo `@preview/nombre:version`
 * @returns {string|null} URL pública de la miniatura en raw.githubusercontent.com
 */
export function getUniverseThumbnailUrl(spec) {
  const parsed = parseUniverseSpec(spec);
  if (!parsed.ok) return null;

  const key = `${parsed.name}:${parsed.version}`;
  const relativePath = CURATED_THUMBNAIL_PATHS[key] || 'thumbnail.png';

  return `${GITHUB_RAW_BASE}/${parsed.name}/${parsed.version}/${relativePath}`;
}

/**
 * Obtiene un icono vectorial SVG temático para un paquete.
 * @param {string} packageName Nombre del paquete
 * @returns {string} Código SVG
 */
export function getUniversePackageIcon(packageName) {
  return PACKAGE_ICONS[packageName] || PACKAGE_ICONS.default;
}

/**
 * Busca metadatos en los catálogos curados de plantillas o paquetes.
 * @param {string} spec
 * @returns {object|null}
 */
export function findCuratedMetadata(spec) {
  const parsed = parseUniverseSpec(spec);
  if (!parsed.ok) return null;

  const foundTemplate = CURATED_TEMPLATES.find((t) => {
    const p = parseUniverseSpec(t.spec);
    return p.ok && p.name === parsed.name;
  });

  if (foundTemplate) {
    return {
      ...foundTemplate,
      isTemplate: true,
      parsed,
    };
  }

  const foundPackage = CURATED_PACKAGES.find((p) => {
    const parsedPkg = parseUniverseSpec(p.spec);
    return parsedPkg.ok && parsedPkg.name === parsed.name;
  });

  if (foundPackage) {
    return {
      ...foundPackage,
      isTemplate: false,
      parsed,
    };
  }

  return {
    spec: parsed.spec,
    title: parsed.name,
    titleEn: parsed.name,
    description: 'Paquete de Typst Universe',
    descriptionEn: 'Typst Universe package',
    license: 'Desconocida',
    isTemplate: true, // Asumir que puede ser plantilla si se invoca
    parsed,
  };
}

/**
 * Devuelve el catálogo de plantillas curadas de Typst Universe en el formato
 * estándar de TemplateInfo consumido por el Template Gallery Modal y el Wizard.
 * @returns {object[]}
 */
export function getCuratedUniverseTemplatesCatalog() {
  return CURATED_TEMPLATES.map((entry) => {
    const parsed = parseUniverseSpec(entry.spec);
    const version = parsed.ok ? parsed.version : '0.1.0';
    return {
      id: entry.spec,
      name: entry.title,
      description: entry.description,
      version,
      category: 'Typst Universe',
      entrypoint: 'main.typ',
      universeSpec: entry.spec,
      license: entry.license,
      dbv: {
        dbvCategory: 'Typst Universe',
        localization: {
          es: { name: entry.title, description: entry.description },
          en: { name: entry.titleEn, description: entry.descriptionEn },
        },
      },
    };
  });
}

