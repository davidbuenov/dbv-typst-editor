// =============================================================================
// DBV Typst Editor — Descripción del menú nativo de macOS (lógica pura)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// RF-125: convierte lo que `nativeMenuDom.js` lee de los paneles HTML (Archivo,
// Herramientas, Preferencias) en la descripción neutra que recibe el comando
// `set_native_menu`. Sin DOM ni Tauri, para poder probarlo con Vitest. El DOM
// sigue siendo la única fuente de las entradas (RF-125.2). Portado de
// `nativemenu.js` de DBV Markdown Reader (su RF-65), con la notación de atajos de
// `editor/shortcuts.js` (`Mod-Shift-o`) en vez de una segunda sintaxis.
//
// Entrada de `describeMenus`: [{ id, title, items: [{ key, kind, label, accel, hidden, disabled, checked }] }]
//   kind: 'item' | 'check' | 'sep'
// Salida: { menus: [{ id, title, items: [{ id, kind, label, accel, enabled, checked }] }] }
//
// @spec RF-125

import { comboFor, normalizeCombo } from '../editor/shortcuts.js';

const MODIFIERS = { mod: 'CmdOrCtrl', shift: 'Shift', alt: 'Alt', ctrl: 'Ctrl', cmd: 'Cmd' };
const KEY_RE = /^([A-Z0-9]|F([1-9]|1[0-9]|2[0-4]))$/;

/**
 * `Mod-Shift-o` → `CmdOrCtrl+Shift+O` (acelerador de Tauri). Una tecla o un
 * modificador desconocidos dan `null`: la entrada sale sin atajo en vez de
 * fallar (RF-125.10).
 * @param {string | null | undefined} combo
 * @returns {string | null}
 * @spec RF-125
 */
export function toAccelerator(combo) {
  const parts = typeof combo === 'string' && combo ? combo.split('-') : [];
  if (parts.length === 0) return null;
  const key = parts.pop().toUpperCase();
  const mods = parts.map((part) => MODIFIERS[part.toLowerCase()]);
  if (!KEY_RE.test(key) || !mods.every(Boolean)) return null;
  return [...mods, key].join('+');
}

/**
 * Quita lo oculto, poda los separadores al principio, al final o dos seguidos,
 * y descarta un menú que se quede sin entradas (RF-125.4).
 * @param {Array<{id: string, title: string, items: Array<object>}>} menus
 * @returns {{menus: Array<object>}}
 * @spec RF-125
 */
export function describeMenus(menus) {
  const seen = new Set();
  const result = [];
  for (const menu of menus ?? []) {
    const items = [];
    for (const src of menu.items ?? []) {
      if (src.hidden) continue;
      if (src.kind === 'sep') {
        const last = items.at(-1);
        if (last && last.kind !== 'sep') items.push({ id: '', kind: 'sep', label: '', accel: null, enabled: true, checked: false });
        continue;
      }
      const id = `${menu.id}:${src.key}`;
      if (!src.key || seen.has(id)) continue;
      seen.add(id);
      const isCheck = src.kind === 'check';
      items.push({
        id,
        kind: isCheck ? 'check' : 'item',
        label: String(src.label ?? '').replace(/\s+/g, ' ').trim(),
        accel: toAccelerator(src.accel),
        enabled: !src.disabled,
        checked: isCheck && Boolean(src.checked),
      });
    }
    while (items.at(-1)?.kind === 'sep') items.pop();
    if (items.length > 0) result.push({ id: menu.id, title: menu.title, items });
  }
  return { menus: result };
}

/** Huella de la descripción completa: solo se publica a Rust cuando cambia (sin IPC en reposo). */
export function signature(description) {
  return JSON.stringify(description);
}

/**
 * Atajos de la app que coinciden con el de una entrada del menú. Un acelerador
 * de macOS se resuelve antes de que la tecla llegue al DOM: si choca con un atajo
 * del editor, ese atajo deja de funcionar sin ningún aviso (RF-125.6). Solo se
 * permite coincidir con el atajo de la MISMA acción (`allowed`: combo → id).
 * @param {Array<{key: string, accel?: string|null}>} entries Entradas con `accel` en notación `Mod-Shift-o`.
 * @param {Array<{id?: string, key?: string, mac?: string}>} appShortcuts `APP_SHORTCUTS`.
 * @param {Record<string, string>} allowed Combo normalizado de macOS → id del atajo permitido.
 * @returns {Array<{entry: string, combo: string, shortcut: string}>}
 * @spec RF-125
 */
export function acceleratorConflicts(entries, appShortcuts, allowed = {}) {
  const conflicts = [];
  const canon = (combo) => normalizeCombo(combo, true).toLowerCase();
  for (const entry of entries) {
    if (!entry.accel) continue;
    const combo = canon(entry.accel);
    for (const shortcut of appShortcuts) {
      const own = comboFor(shortcut, true);
      if (!own || canon(own) !== combo) continue;
      if (allowed[combo] === shortcut.id) continue;
      conflicts.push({ entry: entry.key, combo, shortcut: shortcut.id ?? own });
    }
  }
  return conflicts;
}
