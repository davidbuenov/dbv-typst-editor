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

  it('«Nuevo .typ vacío…» (RF-106) está en el menú Archivo, en el inicio, en el menú de macOS y cableado', () => {
    expect(idsInHtml.has('btn-new-document')).toBe(true);
    expect(idsInHtml.has('btn-empty-new-document')).toBe(true);
    expect(main).toContain("el('btn-new-document').addEventListener");
    expect(main).toContain("el('btn-empty-new-document').addEventListener");
    expect(main).toContain("on('menu-new-document', newDocument)");
    // Menú de arranque de macOS (RF-125.9): su entrada se reenvía como `menu-new-document`.
    expect(read('src-tauri/src/macos_menu.rs')).toMatch(/FORWARDED[\s\S]*"menu-new-document"/);
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

  it('«Cerrar pestaña» (RF-125.7) está en el menú Archivo, antes de «Cerrar proyecto», y cableada', () => {
    const fileMenu = html.slice(html.indexOf('id="file-menu"'), html.indexOf('id="tools-menu"'));
    expect(fileMenu.indexOf('id="btn-close-tab"')).toBeGreaterThan(-1);
    expect(fileMenu.indexOf('id="btn-close-tab"')).toBeLessThan(fileMenu.indexOf('id="btn-close-project"'));
    expect(main).toContain("el('btn-close-tab').addEventListener('click', () => workspace.closeDocument())");
    expect(main).toContain("documentMenuItems: [el('btn-close-tab')]");
    expect(i18n).toContain("'action.closeTab': 'Cerrar pestaña'");
    expect(i18n).toContain("'action.closeTab': 'Close tab'");
  });

  it('⌘N del menú de arranque de macOS abre «Proyecto en blanco» (RF-125.6)', () => {
    expect(main).toContain("on('menu-new-project', () => el('btn-new-blank-project').click())");
  });

});

describe('menú nativo de macOS ↔ index.html y main.js (RF-125)', () => {
  // El File de arranque (RF-125.9) vive en Rust y el Archivo del DOM en index.html:
  // si un atajo cambia en uno y no en el otro, ⌘S haría cosas distintas según el
  // instante. Se comparan aquí, y que cada evento del menú nativo tenga oyente.
  it('el File de arranque de macOS usa los mismos atajos que el Archivo del DOM (RF-125.9)', () => {
    const rust = read('src-tauri/src/macos_menu.rs');
    const fallback = rust.slice(rust.indexOf('fn fallback_file_menu'));
    const entries = [...fallback.matchAll(/entry\("(menu-[a-z-]+)",[^)]*?Some\("([^"]+)"\)\)/g)];
    const BUTTON = {
      'menu-new-project': 'btn-new-blank-project',
      'menu-new-document': 'btn-new-document',
      'menu-open-folder': 'btn-open-folder',
      'menu-open-file': 'btn-open-file',
      'menu-save': 'btn-save',
      'menu-save-as': 'btn-save-as',
      'menu-close-tab': 'btn-close-tab',
      'menu-close-project': 'btn-close-project',
    };
    const domAccel = (id) => html.match(new RegExp(`id="${id}"[^>]*data-accel="([^"]+)"`))?.[1];
    // `Mod-Alt-n` y `Cmd+Alt+N` describen lo mismo en macOS.
    const canon = (combo) => combo.replace(/^Mod/, 'Cmd').replace(/[-+]/g, '+').toLowerCase().split('+').sort().join('+');

    expect(entries.map(([, event]) => event).sort()).toEqual(Object.keys(BUTTON).sort());
    for (const [, event, accel] of entries) {
      expect(canon(domAccel(BUTTON[event]) ?? ''), event).toBe(canon(accel));
    }
  });

  it('cada evento que reemite el menú nativo tiene oyente en main.js', () => {
    const rust = read('src-tauri/src/macos_menu.rs');
    const forwarded = rust.slice(rust.indexOf('const FORWARDED'), rust.indexOf('];', rust.indexOf('const FORWARDED')));
    const events = [...forwarded.matchAll(/"(menu-[a-z-]+)"/g)].map((match) => match[1]);

    expect(events.length).toBeGreaterThan(10);
    expect(events.filter((event) => !main.includes(`on('${event}'`))).toEqual([]);
  });
});
