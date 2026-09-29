// =============================================================================
// DBV Typst Editor — Panel de navegación estructural (Outline, Beta)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// ARCHITECTURE.md §7.8. RF-89: el panel ya no compila por su cuenta. Sigue a
// cada compilación de la vista previa (`onCompiled`): con el motor en proceso,
// el esquema viene en el propio resultado, sacado del mismo documento que se
// ve; con el motor clásico de respaldo se pide al CLI. Así el esquema es
// siempre de la misma generación que las páginas, y no cuesta otra compilación.
//
// Hasta la 0.12.0, cualquier fallo al pedir el esquema dejaba el panel como
// estaba —vacío al abrir el proyecto—, y un sidecar que no arrancaba (un Mac de
// un usuario real) se veía como «este documento no tiene encabezados». Ahora
// cada situación tiene su estado, y ese mensaje solo sale cuando es verdad.
//
// Clic→navegación lleva la vista previa a la página y la coordenada `y` del
// encabezado.

import { t } from '../i18n/i18n.js';
import { getOutline } from '../services/backend.js';

/**
 * @typedef {{level: number, text: string, page: number, yPt: number}} OutlineEntry
 *
 * @typedef {object} CompiledResult Lo que la vista previa pasa a `onCompiled`.
 * @property {boolean} ok
 * @property {'inproc'|'classic'} [engine]
 * @property {OutlineEntry[] | null} [outline] Solo con el motor en proceso.
 * @property {{kind: string, message: string}} [error] Solo si falló.
 */

/**
 * @param {object} deps
 * @param {HTMLElement} deps.listEl Contenedor donde se pintan las entradas.
 * @param {(entry: {page: number, yPt: number}) => void} deps.onNavigate
 * @param {() => (import('../services/backend.js').CompileTarget | null)} deps.getTarget
 *   El MISMO objetivo que compila la vista previa (RF-14): el respaldo por CLI
 *   no debe listar los encabezados de otro fichero.
 * @param {typeof getOutline} [deps.fetchOutline] Esquema por CLI (inyectable en tests).
 */
export function createOutline({ listEl, onNavigate, getTarget, fetchOutline = getOutline }) {
  /**
   * Lo que se ve. `pending`: aún no ha compilado nada (panel vacío, sin
   * afirmar nada del documento). `list`: los encabezados, con `stale` si el
   * documento dejó de compilar. `noCompile`: tiene errores y no hay esquema
   * anterior. `failed`: falló la herramienta, con su motivo.
   * @type {{kind: 'pending'} | {kind: 'list', entries: OutlineEntry[], stale: boolean}
   *   | {kind: 'noCompile'} | {kind: 'failed', reason: string}}
   */
  let state = { kind: 'pending' };
  /** @type {OutlineEntry[] | null} Último esquema bueno, para el caso `stale`. */
  let lastGood = null;
  /** Descarta una respuesta del CLI que llega después de otra compilación. */
  let token = 0;
  /** Hay una compilación en marcha (solo se enseña mientras no hay esquema). */
  let compiling = false;

  function message(text, modifier) {
    const p = document.createElement('p');
    p.className = modifier ? `outline__empty outline__empty--${modifier}` : 'outline__empty';
    p.textContent = text;
    return p;
  }

  function paint() {
    listEl.replaceChildren();
    if (state.kind === 'pending') {
      // El primer esquema de un libro llega con su primera compilación, que
      // puede tardar: se ve que se está generando, como en la vista previa.
      if (compiling) {
        const loading = document.createElement('p');
        loading.className = 'outline__loading';
        loading.setAttribute('role', 'status');
        const spinner = document.createElement('span');
        spinner.className = 'preview-page__spinner';
        loading.append(spinner, t('outline.loading'));
        listEl.append(loading);
      }
      return;
    }
    if (state.kind === 'noCompile') {
      listEl.append(message(t('outline.doesNotCompile')));
      return;
    }
    if (state.kind === 'failed') {
      listEl.append(message(t('outline.failed').replace('{reason}', state.reason), 'error'));
      return;
    }
    if (state.entries.length === 0) {
      listEl.append(message(t('outline.empty')));
      return;
    }
    if (state.stale) {
      const notice = message(t('outline.stale'), 'notice');
      notice.setAttribute('role', 'status');
      listEl.append(notice);
    }
    const fragment = document.createDocumentFragment();
    for (const entry of state.entries) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'outline__item';
      item.style.setProperty('--outline-indent', String(Math.max(0, entry.level - 1)));
      item.textContent = entry.text || t('outline.untitled');
      item.addEventListener('click', () => onNavigate(entry));
      fragment.append(item);
    }
    listEl.append(fragment);
  }

  function showEntries(entries) {
    compiling = false;
    lastGood = entries;
    state = { kind: 'list', entries, stale: false };
    paint();
  }

  /** Un error con `kind` (ver `TypstError`): del documento o de la herramienta. */
  function showError(error) {
    compiling = false;
    if (error?.kind === 'compilationFailed') {
      // Se conserva el último esquema bueno, igual que la vista previa
      // conserva su última vista buena.
      state = lastGood ? { kind: 'list', entries: lastGood, stale: true } : { kind: 'noCompile' };
    } else {
      state = { kind: 'failed', reason: error?.message || error?.kind || '?' };
    }
    paint();
  }

  document.addEventListener('dbv-lang-changed', paint);

  return {
    /** La vista previa empieza a compilar. */
    onCompileStart() {
      compiling = true;
      if (state.kind === 'pending') paint();
    },
    /** @param {CompiledResult} result */
    async onCompiled(result) {
      const mine = ++token;
      if (!result.ok) {
        showError(result.error);
        return;
      }
      if (result.engine === 'inproc' && Array.isArray(result.outline)) {
        showEntries(result.outline);
        return;
      }
      // Motor clásico de respaldo (RF-89.2): el esquema sale del CLI.
      const target = getTarget();
      if (!target?.document || !target?.root) {
        compiling = false;
        paint();
        return;
      }
      const fetched = await fetchOutline(target);
      if (mine !== token) return;
      if (fetched.ok) showEntries(fetched.value);
      else showError(fetched.error);
    },
    /** Otro documento u otro proyecto: nada de lo anterior vale. */
    clear() {
      token += 1;
      compiling = false;
      lastGood = null;
      state = { kind: 'pending' };
      paint();
    },
  };
}
