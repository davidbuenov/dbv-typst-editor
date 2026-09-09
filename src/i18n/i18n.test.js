// =============================================================================
// DBV Typst Editor — Tests de la capa de idiomas
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// 708 líneas sin una sola prueba hasta ahora, y con dos modos de fallo que no
// avisan: una clave que existe en un idioma y no en el otro deja al usuario
// inglés con el identificador crudo en pantalla, y `applyTranslations` escribe
// `textContent`, así que un `data-i18n` puesto en el sitio equivocado borra en
// silencio lo que hubiera dentro del elemento — iconos incluidos.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyTranslations, getLanguage, setLanguage, t } from './i18n.js';

/** Claves declaradas por idioma, leídas del fichero fuente. */
function clavesPorIdioma() {
  const fuente = readFileSync(join(process.cwd(), 'src/i18n/i18n.js'), 'utf8');
  const apariciones = [...fuente.matchAll(/^\s{4}'([a-zA-Z0-9_.]+)':/gm)].map((m) => m[1]);

  // El fichero declara los dos diccionarios seguidos, así que cada clave debe
  // aparecer exactamente dos veces: una en español y otra en inglés.
  const cuenta = new Map();
  for (const clave of apariciones) cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  return cuenta;
}

describe('diccionarios de idioma', () => {
  it('toda clave existe en español Y en inglés', () => {
    // Este proyecto tiene la regla de mantener el changelog en los dos idiomas;
    // la interfaz merece la misma disciplina, y a mano se olvida. Una clave que
    // falta no lanza: `t()` devuelve el identificador y el usuario ve
    // "gallery.tabSpec" en mitad de la pantalla.
    const desparejadas = [...clavesPorIdioma()]
      .filter(([, veces]) => veces !== 2)
      .map(([clave, veces]) => `${clave} (${veces})`);

    expect(desparejadas).toEqual([]);
  });

  it('ninguna traducción se queda vacía', () => {
    const fuente = readFileSync(join(process.cwd(), 'src/i18n/i18n.js'), 'utf8');
    const vacias = [...fuente.matchAll(/^\s{4}'([a-zA-Z0-9_.]+)':\s*''/gm)].map((m) => m[1]);
    expect(vacias).toEqual([]);
  });

  it('una clave que no existe devuelve su propio identificador, no undefined', () => {
    // Degradar a la clave es feo pero legible; devolver `undefined` pintaría
    // "undefined" en la interfaz.
    expect(t('clave.que.no.existe')).toBe('clave.que.no.existe');
  });
});

describe('applyTranslations', () => {
  it('traduce contenido, tooltip y marcador de posición', () => {
    setLanguage('es');
    const raiz = document.createElement('div');
    raiz.innerHTML = `
      <span data-i18n="gallery.close"></span>
      <button data-i18n-title="gallery.close"></button>
      <input data-i18n-placeholder="gallery.searchPlaceholder" />
    `;

    applyTranslations(raiz);

    expect(raiz.querySelector('[data-i18n]').textContent).toBe(t('gallery.close'));
    expect(raiz.querySelector('[data-i18n-title]').title).toBe(t('gallery.close'));
    // El tooltip también alimenta la etiqueta accesible: un botón de solo icono
    // no tiene texto que leer.
    expect(raiz.querySelector('[data-i18n-title]').getAttribute('aria-label')).toBe(t('gallery.close'));
    expect(raiz.querySelector('[data-i18n-placeholder]').placeholder).toBe(t('gallery.searchPlaceholder'));
  });

  it('no borra el icono de un botón con icono y etiqueta', () => {
    // `applyTranslations` escribe `textContent`, que sustituye TODO el contenido
    // del elemento. Por eso el patrón `button--icon-label` pone la etiqueta en un
    // `<span>` hermano del SVG y nunca `data-i18n` en el propio botón: hacerlo
    // borraría el icono en cuanto se aplicara un idioma, y no al pintar, así que
    // el botón se vería bien hasta el primer cambio de idioma.
    setLanguage('es');
    const boton = document.createElement('button');
    boton.className = 'button button--icon-label';
    boton.innerHTML = '<svg class="button__icon"></svg><span data-i18n="action.openFolder"></span>';
    document.body.append(boton);

    applyTranslations(boton);

    expect(boton.querySelector('svg')).not.toBeNull();
    expect(boton.querySelector('span').textContent).toBe(t('action.openFolder'));
  });

  it('cambiar de idioma cambia el texto de las mismas claves', () => {
    const raiz = document.createElement('div');
    raiz.innerHTML = '<span data-i18n="gallery.tabSpec"></span>';

    setLanguage('es');
    applyTranslations(raiz);
    const enEspanol = raiz.querySelector('span').textContent;

    setLanguage('en');
    applyTranslations(raiz);
    const enIngles = raiz.querySelector('span').textContent;

    expect(getLanguage()).toBe('en');
    expect(enEspanol).not.toBe('');
    expect(enIngles).not.toBe('');
    expect(enIngles).not.toBe(enEspanol);

    setLanguage('es');
  });
});
