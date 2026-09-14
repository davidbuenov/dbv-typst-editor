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

import { beforeEach, describe, expect, it, vi } from 'vitest';

const CATALOGO_FALSO = [{ id: '@local/dbv-tfg', name: 'dbv-tfg', version: '1.0.0' }];

/** Fabrica una entrada de "recientes" con la forma real que devuelve el backend (RF-02c). */
function recentProject(overrides = {}) {
  return {
    path: 'D:\\bueno\\Documents\\Proyectos\\demo',
    name: 'demo',
    entrypoint: 'main.typ',
    isSingleFile: false,
    lastOpened: 0,
    ...overrides,
  };
}

let recentProjectsResult = { ok: true, value: [] };

// El lanzador habla con el backend; aquí solo importa que la carga siga
// ocurriendo y que el catálogo llegue a `getCatalog()`.
vi.mock('../services/backend.js', () => ({
  listTemplates: () => Promise.resolve({ ok: true, value: CATALOGO_FALSO }),
  getRecentProjects: () => Promise.resolve(recentProjectsResult),
  removeRecentProject: () => Promise.resolve({ ok: true }),
}));

import { createLauncher, localizeTemplate, RECENT_DISPLAY_LIMIT } from './launcher.js';

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

// ─── RF-44: tarjetas de proyectos recientes — recorte de ruta, límite de 5,
// icono por tipo. El backend ya guarda hasta 10 (`MAX_RECENT`); lo que cambia
// aquí es solo cuánto y cómo se PINTA.
describe('proyectos recientes (RF-44)', () => {
  beforeEach(() => {
    recentProjectsResult = { ok: true, value: [] };
  });

  it('pinta como mucho RECENT_DISPLAY_LIMIT tarjetas aunque el backend traiga más', async () => {
    recentProjectsResult = {
      ok: true,
      value: Array.from({ length: 10 }, (_, index) =>
        recentProject({ path: `D:\\p\\proyecto-${index}`, name: `proyecto-${index}` }),
      ),
    };
    const recentEl = document.createElement('div');
    document.body.append(recentEl);

    const launcher = createLauncher({ recentEl, onOpenRecent: () => {} });
    await launcher.load();

    expect(recentEl.querySelectorAll('.recent-item')).toHaveLength(RECENT_DISPLAY_LIMIT);
    // Y son las 5 MÁS RECIENTES (las primeras de la lista que ya llega
    // ordenada por el backend), no un subconjunto arbitrario.
    expect(recentEl.querySelector('.recent-item__name').textContent).toBe('proyecto-0');
  });

  it('muestra la ruta recortada, no la ruta completa, y guarda la completa en el título', async () => {
    const fullPath = 'D:\\bueno\\Documents\\Proyectos\\2025 Demo\\Carpeta\\proyecto';
    recentProjectsResult = { ok: true, value: [recentProject({ path: fullPath, name: 'proyecto' })] };
    const recentEl = document.createElement('div');
    document.body.append(recentEl);

    const launcher = createLauncher({ recentEl, onOpenRecent: () => {} });
    await launcher.load();

    const pathEl = recentEl.querySelector('.recent-item__path');
    expect(pathEl.textContent).toBe('…\\2025 Demo\\Carpeta');
    expect(pathEl.title).toBe(fullPath);
  });

  it('distingue con el icono un proyecto de un .typ suelto', async () => {
    recentProjectsResult = {
      ok: true,
      value: [
        recentProject({ path: 'D:\\p\\proyecto', isSingleFile: false }),
        recentProject({ path: 'D:\\p\\suelto.typ', name: 'suelto.typ', isSingleFile: true }),
      ],
    };
    const recentEl = document.createElement('div');
    document.body.append(recentEl);

    const launcher = createLauncher({ recentEl, onOpenRecent: () => {} });
    await launcher.load();

    const icons = [...recentEl.querySelectorAll('.recent-item__icon')].map((el) => el.textContent);
    expect(icons).toEqual(['📁', '📄']);
  });

  it('abrir sigue funcionando tras el rediseño de la tarjeta', async () => {
    recentProjectsResult = { ok: true, value: [recentProject({ path: 'D:\\p\\proyecto' })] };
    const recentEl = document.createElement('div');
    document.body.append(recentEl);
    const onOpenRecent = vi.fn();

    const launcher = createLauncher({ recentEl, onOpenRecent });
    await launcher.load();
    recentEl.querySelector('.recent-item__open').click();

    expect(onOpenRecent).toHaveBeenCalledWith('D:\\p\\proyecto');
  });
});
