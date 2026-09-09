// =============================================================================
// DBV Typst Editor — Tests de la localización de plantillas del lanzador
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// R-MVP-1: el lanzador consume `TemplateInfo`, no ficheros. `localizeTemplate`
// es la frontera entre ese dato y lo que ve el usuario, y tiene que degradar
// limpiamente cuando la plantilla no trae la capa DBV — el caso de las
// plantillas comunitarias que llegarán en Beta.

import { describe, expect, it, vi } from 'vitest';

const CATALOGO_FALSO = [{ id: '@local/dbv-tfg', name: 'dbv-tfg', version: '1.0.0' }];

// El lanzador habla con el backend; aquí solo importa que la carga siga
// ocurriendo y que el catálogo llegue a `getCatalog()`.
vi.mock('../services/backend.js', () => ({
  listTemplates: () => Promise.resolve({ ok: true, value: CATALOGO_FALSO }),
  getRecentProjects: () => Promise.resolve({ ok: true, value: [] }),
  removeRecentProject: () => Promise.resolve({ ok: true }),
}));

import { createLauncher, localizeTemplate } from './launcher.js';

const CON_LOCALIZACION = {
  name: 'dbv-tfg',
  description: 'Bachelor thesis template',
  dbv: {
    localization: {
      es: { name: 'TFG', description: 'Plantilla de Trabajo Fin de Grado' },
      en: { name: 'Bachelor Thesis', description: 'Bachelor thesis template' },
    },
  },
};

describe('localizeTemplate', () => {
  it('devuelve el nombre y la descripción del idioma pedido', () => {
    expect(localizeTemplate(CON_LOCALIZACION, 'es')).toEqual({
      name: 'TFG',
      description: 'Plantilla de Trabajo Fin de Grado',
    });
  });

  it('cae al dato oficial del typst.toml si falta ese idioma', () => {
    expect(localizeTemplate(CON_LOCALIZACION, 'fr')).toEqual({
      name: 'dbv-tfg',
      description: 'Bachelor thesis template',
    });
  });

  it('degrada limpiamente en una plantilla sin capa DBV', () => {
    // Principio Universe-First: `dbv-template.toml` es opcional y aditivo.
    const comunitaria = { name: 'charged-ieee', description: 'IEEE conference paper' };
    expect(localizeTemplate(comunitaria, 'es')).toEqual({
      name: 'charged-ieee',
      description: 'IEEE conference paper',
    });
  });

  it('ignora una traducción vacía en vez de mostrar un hueco en blanco', () => {
    const parcial = { name: 'dbv-cv', description: 'CV', dbv: { localization: { es: { name: '' } } } };
    expect(localizeTemplate(parcial, 'es')).toEqual({ name: 'dbv-cv', description: 'CV' });
  });
});

// ─── RF-25: el lanzador ya no pinta plantillas, pero sigue cargando el catálogo
describe('el catálogo sobrevive a la poda de la rejilla (R-26)', () => {
  it('getCatalog() devuelve el catálogo aunque no exista ninguna rejilla', async () => {
    // `createLauncher` es el único sitio de la aplicación que llama a
    // `listTemplates()`, y de `getCatalog()` come la pestaña "Plantillas
    // locales" de la galería. Si la poda de RF-25 se hubiera llevado la carga
    // junto con la rejilla, esa pestaña saldría vacía sin un solo error: el peor
    // modo de fallo posible, porque parece un catálogo que no existe.
    const recentEl = document.createElement('div');
    document.body.append(recentEl);

    const launcher = createLauncher({ recentEl, onOpenRecent: () => {} });
    await launcher.load();

    expect(launcher.getCatalog()).toEqual(CATALOGO_FALSO);
  });

  it('no necesita un contenedor de plantillas para cargar', async () => {
    const recentEl = document.createElement('div');
    document.body.append(recentEl);

    const launcher = createLauncher({ recentEl, onOpenRecent: () => {} });
    await expect(launcher.load()).resolves.not.toThrow();
  });
});
