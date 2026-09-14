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

import { createLauncher, formatRelativeTime, localizeTemplate, RECENT_DISPLAY_LIMIT } from './launcher.js';

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

    // Iconos SVG con el mismo trazo que el resto de la app, no emoji — se
    // comprueba por la silueta (un `path` distinto por icono), no por texto.
    const icons = [...recentEl.querySelectorAll('.recent-item__icon')].map((el) => el.innerHTML);
    expect(icons[0]).toContain('M2.5 6.2'); // carpeta
    expect(icons[1]).toContain('M6.3 2.5'); // documento
    expect(icons[0]).not.toBe(icons[1]);
  });

  it('muestra "Ver todos" solo si hay más de RECENT_DISPLAY_LIMIT, y expande al pulsarlo', async () => {
    recentProjectsResult = {
      ok: true,
      value: Array.from({ length: 7 }, (_, index) =>
        recentProject({ path: `D:\\p\\proyecto-${index}`, name: `proyecto-${index}` }),
      ),
    };
    const recentEl = document.createElement('div');
    const recentToggleEl = document.createElement('button');
    document.body.append(recentEl, recentToggleEl);

    const launcher = createLauncher({ recentEl, recentToggleEl, onOpenRecent: () => {} });
    await launcher.load();

    expect(recentToggleEl.classList.contains('hidden')).toBe(false);
    expect(recentEl.querySelectorAll('.recent-item')).toHaveLength(RECENT_DISPLAY_LIMIT);

    recentToggleEl.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(recentEl.querySelectorAll('.recent-item')).toHaveLength(7);
  });

  it('oculta "Ver todos" cuando no hay más entradas que las visibles', async () => {
    recentProjectsResult = { ok: true, value: [recentProject({ path: 'D:\\p\\proyecto' })] };
    const recentEl = document.createElement('div');
    const recentToggleEl = document.createElement('button');
    document.body.append(recentEl, recentToggleEl);

    const launcher = createLauncher({ recentEl, recentToggleEl, onOpenRecent: () => {} });
    await launcher.load();

    expect(recentToggleEl.classList.contains('hidden')).toBe(true);
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

describe('formatRelativeTime', () => {
  // Momento de referencia fijo, no `Date.now()`: mismo motivo por el que
  // `lastOpened` viaja como parámetro y no como reloj real.
  const NOW = new Date('2026-09-14T12:00:00Z').getTime();
  const hoursAgo = (h) => Math.round(NOW / 1000 - h * 3600);

  it('menos de 24h es "hoy"', () => {
    expect(formatRelativeTime(hoursAgo(2), { now: NOW })).toBe('hoy');
  });

  it('entre 24h y 48h es "ayer"', () => {
    expect(formatRelativeTime(hoursAgo(30), { now: NOW })).toBe('ayer');
  });

  it('entre 2 y 6 días cuenta días', () => {
    expect(formatRelativeTime(hoursAgo(3 * 24), { now: NOW })).toBe('3 días');
  });

  it('a partir de 7 días cuenta semanas', () => {
    expect(formatRelativeTime(hoursAgo(7 * 24), { now: NOW })).toBe('1 sem');
    expect(formatRelativeTime(hoursAgo(20 * 24), { now: NOW })).toBe('2 sem');
  });

  it('a partir de 30 días cuenta meses, con singular correcto', () => {
    expect(formatRelativeTime(hoursAgo(30 * 24), { now: NOW })).toBe('1 mes');
    expect(formatRelativeTime(hoursAgo(65 * 24), { now: NOW })).toBe('2 meses');
  });

  it('un lastOpened en el futuro (reloj desajustado) no da una cifra negativa', () => {
    expect(formatRelativeTime(Math.round(NOW / 1000) + 3600, { now: NOW })).toBe('hoy');
  });

  it('respeta el idioma inglés', () => {
    expect(formatRelativeTime(hoursAgo(2), { now: NOW, language: 'en' })).toBe('today');
    expect(formatRelativeTime(hoursAgo(30), { now: NOW, language: 'en' })).toBe('yesterday');
    expect(formatRelativeTime(hoursAgo(3 * 24), { now: NOW, language: 'en' })).toBe('3d');
    expect(formatRelativeTime(hoursAgo(20 * 24), { now: NOW, language: 'en' })).toBe('2w');
    expect(formatRelativeTime(hoursAgo(65 * 24), { now: NOW, language: 'en' })).toBe('2mo');
  });
});
