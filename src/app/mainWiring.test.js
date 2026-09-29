// =============================================================================
// DBV Typst Editor — Cableado entre main.js e index.html
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// `main.js` pide sus elementos con `el('id')`, y un id que no exista en
// `index.html` devuelve `null`: el primer `.addEventListener` sobre él rompe el
// arranque ENTERO de la aplicación, no solo esa función. Nadie más lo detecta
// sin abrir la ventana real. Se comprueba aquí para todos los ids a la vez —
// incluido el del menú "Establecer como documento principal" —, y que cada
// clave de texto usada en el HTML exista en los dos idiomas.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative) => readFileSync(join(process.cwd(), relative), 'utf8');
const html = read('src/index.html');
const main = read('src/main.js');
const i18n = read('src/i18n/i18n.js');

const idsInHtml = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));

describe('main.js ↔ index.html', () => {
  it('todo id pedido con el("...") existe en index.html', () => {
    const requested = [...main.matchAll(/\bel\('([^']+)'\)/g)].map((match) => match[1]);
    const missing = [...new Set(requested)].filter((id) => !idsInHtml.has(id));

    expect(requested.length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });

  it('el menú de documento principal está en el HTML y cableado', () => {
    expect(idsInHtml.has('btn-set-entrypoint')).toBe(true);
    expect(main).toContain("el('btn-set-entrypoint').addEventListener");
  });

  it('«Nuevo proyecto en blanco» es la primera opción del menú Archivo y está cableada', () => {
    const fileMenu = html.slice(html.indexOf('id="file-menu"'));
    const firstItem = fileMenu.match(/<button id="([^"]+)" class="menu-item"/)[1];

    expect(firstItem).toBe('btn-new-blank-project');
    expect(main).toContain("el('btn-new-blank-project').addEventListener");
  });

  // v0.12.1: tres cableados que, rotos, no se ven en ningún test de módulo.
  it('el esquema y el aviso «motor clásico» siguen a cada compilación de la vista previa', () => {
    const onCompiled = main.slice(main.indexOf('onCompiled: (result) => {'), main.indexOf('onCompiled: (result) => {') + 300);
    expect(onCompiled).toContain('outline.onCompiled(result)');
    expect(onCompiled).toContain('engineNotice.onCompiled(result)');
    expect(main).toContain('outline.onCompileStart()');
    // El esquema ya no se recalcula por su cuenta (RF-89.1).
    expect(main).not.toMatch(/outline\.(restart|onContentChanged)\(/);
  });

  it('cada proyecto que se abre reactiva el motor rápido (RF-87.4)', () => {
    const opened = main.slice(main.indexOf("setListener('projectOpened'"), main.indexOf("setListener('projectOpened'") + 400);
    expect(opened).toContain("engineSetMode('inproc')");
  });

  it('no queda ningún conmutador para elegir el motor clásico a mano (RF-87.1)', () => {
    expect(idsInHtml.has('btn-preview-engine')).toBe(false);
    expect(main).not.toContain("engineSetMode('classic')");
  });

  it('no hay ids duplicados en index.html', () => {
    const all = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    const duplicated = all.filter((id, index) => all.indexOf(id) !== index);

    expect(duplicated).toEqual([]);
  });
});

describe('claves de i18n usadas en index.html', () => {
  const keysIn = (dictionaryStart, dictionaryEnd) =>
    new Set([...i18n.slice(dictionaryStart, dictionaryEnd).matchAll(/^\s*'([\w.]+)':/gm)].map((match) => match[1]));
  const split = i18n.indexOf('en: {') > 0 ? i18n.indexOf('en: {') : Math.floor(i18n.length / 2);
  const es = keysIn(0, split);
  const en = keysIn(split, i18n.length);

  it('cada data-i18n del HTML existe en español e inglés', () => {
    const used = [...html.matchAll(/data-i18n(?:-title|-placeholder)?="([^"]+)"/g)].map((match) => match[1]);
    const missingEs = used.filter((key) => !es.has(key));
    const missingEn = used.filter((key) => !en.has(key));

    expect(used.length).toBeGreaterThan(20);
    expect(missingEs).toEqual([]);
    expect(missingEn).toEqual([]);
  });

  it('las claves nuevas del documento principal existen en los dos idiomas', () => {
    for (const key of [
      'action.setEntrypoint',
      'project.entrypointSet',
      'project.entrypointInvalid',
      'tree.entrypointBadge',
      'tree.entrypointBadgeTitle',
    ]) {
      expect(es.has(key), `falta en español: ${key}`).toBe(true);
      expect(en.has(key), `falta en inglés: ${key}`).toBe(true);
    }
  });
});
