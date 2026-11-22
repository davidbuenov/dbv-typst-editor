// =============================================================================
// DBV Typst Editor — Menús de la cabecera en la barra de macOS (cableado)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// RF-125: lee los tres paneles de la cabecera (Archivo, Herramientas,
// Preferencias), los convierte con `nativeMenu.js` y publica la descripción a Rust
// (`set_native_menu`). El DOM es la única fuente: no hay aquí ninguna lista de
// entradas. Cada entrada del menú HTML ES el botón de su acción (`btn-save`,
// `pref-vim-mode`…), así que un clic en el menú nativo se traduce en `click()`
// sobre ese botón y no se reimplementa nada.
//
// El estado (deshabilitado, oculto, marcado, textos traducidos) ya lo escribe el
// código de siempre (`renderProjectBar`, `renderPrefCheckbox`, `applyTranslations`):
// aquí basta con observarlo con un `MutationObserver` y republicar cuando cambia.
// Sin cambios no hay IPC.
//
// @spec RF-125

import { formatCombo } from '../editor/shortcuts.js';
import { describeMenus, signature } from './nativeMenu.js';

/** Menús que pasan a la barra del sistema: id nativo, panel del DOM y clave de su título. */
export const NATIVE_PANELS = [
  ['file', 'file-menu', 'action.fileMenu'],
  ['tools', 'tools-menu', 'action.toolsMenu'],
  ['prefs', 'preferences-menu', 'action.preferencesMenu'],
];

/** Texto visible de una entrada: el de su `data-i18n`, sin icono ni atajo. */
function labelOf(itemEl) {
  const labelEl = itemEl.querySelector('[data-i18n]');
  return (labelEl ?? itemEl).textContent ?? '';
}

/**
 * Lee los paneles y devuelve la descripción para Rust y, por id nativo, el botón
 * que lo ejecuta. Un botón sin `id` no entra: no habría a quién devolver el clic.
 * @param {Document} doc
 * @param {(key: string) => string} t
 * @returns {{description: {menus: Array<object>}, items: Map<string, HTMLElement>}}
 */
export function collectNativeMenus(doc, t) {
  const items = new Map();
  const menus = NATIVE_PANELS.map(([id, panelId, titleKey]) => {
    const panel = doc.getElementById(panelId);
    const entries = [];
    for (const el of panel?.children ?? []) {
      if (el.classList.contains('menu-separator')) {
        entries.push({ kind: 'sep' });
      } else if (el.classList.contains('menu-item') && el.id) {
        const role = el.getAttribute('role');
        entries.push({
          key: el.id,
          kind: role === 'menuitemcheckbox' || role === 'menuitemradio' ? 'check' : 'item',
          label: labelOf(el),
          accel: el.dataset.accel ?? null,
          hidden: el.hidden || el.classList.contains('hidden'),
          disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
          checked: el.getAttribute('aria-checked') === 'true',
        });
        items.set(`${id}:${el.id}`, el);
      }
    }
    return { id, title: t(titleKey), items: entries };
  });
  return { description: describeMenus(menus), items };
}

/**
 * Pinta los atajos que la ventana muestra (`.menu-item__keys[data-keys]`) con la
 * notación de la plataforma y el idioma: «Ctrl + W» o «⌘W» (RF-125.7).
 * @param {Document} doc
 * @param {'es'|'en'} lang
 * @param {boolean} isMac
 */
export function paintMenuKeys(doc, lang, isMac) {
  for (const el of doc.querySelectorAll('.menu-item__keys[data-keys]')) {
    el.textContent = formatCombo(el.dataset.keys, lang, isMac);
  }
}

/**
 * Activa los menús nativos (solo macOS dentro de Tauri). Fuera de ahí no toca nada:
 * ni la clase `native-menus` ni el DOM (RF-125.1).
 * @param {{
 *   doc?: Document,
 *   enabled: boolean,
 *   publish: (description: object) => Promise<{ok: boolean, error?: {message: string}}>,
 *   listen: (event: string, handler: (payload: unknown) => void) => unknown,
 *   t: (key: string) => string,
 *   onError?: (message: string) => void,
 *   win?: Window,
 * }} deps
 * @returns {null | {push: (force?: boolean) => void, activate: (id: unknown) => boolean}}
 */
export function initNativeMenu({ doc = document, enabled, publish, listen, t, onError = () => {}, win = window }) {
  if (!enabled) return null;
  doc.body.classList.add('native-menus');

  let items = new Map();
  let lastSignature = '';
  let scheduled = false;

  function push(force = false) {
    const collected = collectNativeMenus(doc, t);
    items = collected.items;
    const current = signature(collected.description);
    if (!force && current === lastSignature) return;
    lastSignature = current;
    Promise.resolve(publish(collected.description)).then((result) => {
      if (result && result.ok === false) {
        lastSignature = '';
        onError(result.error?.message ?? 'set_native_menu');
      }
    });
  }

  /** Agrupa en una sola publicación todos los cambios del mismo turno. */
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      push();
    });
  }

  /** Clic en una entrada nativa: solo ids recogidos del DOM (RF-125.10). */
  function activate(id) {
    const el = typeof id === 'string' ? items.get(id) : undefined;
    if (!el || el.disabled) return false;
    el.click();
    // La casilla nativa conmuta sola; el DOM manda. Se republica aunque la firma
    // no cambie (p. ej. si la preferencia no llegó a cambiar) y otra vez cuando
    // haya terminado una acción asíncrona.
    for (const ms of [60, 450]) win.setTimeout(() => push(true), ms);
    return true;
  }

  const observer = new MutationObserver(schedule);
  for (const [, panelId] of NATIVE_PANELS) {
    const panel = doc.getElementById(panelId);
    if (!panel) continue;
    observer.observe(panel, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['disabled', 'class', 'hidden', 'aria-checked', 'aria-disabled'],
    });
  }
  win.addEventListener('focus', () => push(true));
  doc.addEventListener('dbv-lang-changed', schedule);
  listen('menu-item', activate);
  push(true);
  return { push, activate };
}
