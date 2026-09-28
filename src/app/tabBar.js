// =============================================================================
// DBV Typst Editor — Barra de pestañas (RF-79)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Capa DOM fina: pinta las pestañas que le da el workspace (`getTabs()`) y le
// devuelve las intenciones del usuario (activar, cerrar, mover). No guarda
// estado propio salvo el arrastre en curso.
//
// Reordenar usa eventos de puntero con un umbral de 4 px, NO la API de drag &
// drop de HTML5: en Windows el arrastre nativo de ficheros sobre la ventana
// (RF-18) impide que el drag & drop HTML5 llegue a la página (R-T6, la misma
// lección que el árbol de RF-69).

import { t } from '../i18n/i18n.js';

/** Distancia (px) a partir de la cual pulsar y mover es arrastrar, no hacer clic. */
export const DRAG_THRESHOLD_PX = 4;

/**
 * Qué atajo global de pestañas es `event`, si lo es: cerrar (Ctrl+W),
 * siguiente (Ctrl+Tab) o anterior (Ctrl+Mayús+Tab). En macOS Cmd+W lo atiende
 * el menú nativo (`macos_menu.rs`), así que aquí no se mira `metaKey`.
 * @param {{key: string, ctrlKey: boolean, shiftKey: boolean, altKey: boolean, metaKey: boolean}} event
 * @returns {'close' | 'next' | 'prev' | null}
 */
export function tabShortcutAction(event) {
  let action = null;
  if (event.ctrlKey && !event.altKey && !event.metaKey) {
    if (event.key === 'Tab') action = event.shiftKey ? 'prev' : 'next';
    else if (!event.shiftKey && event.key.toLowerCase() === 'w') action = 'close';
  }
  return action;
}

/**
 * Posición a la que iría una pestaña soltada en `x`, según los centros de las
 * pestañas (sin contar la que se arrastra, que ya no ocupa su sitio).
 * @param {number[]} centers Centro horizontal de cada pestaña, en orden.
 * @param {number} fromIndex Pestaña que se arrastra.
 * @param {number} x
 * @returns {number}
 */
export function dropIndex(centers, fromIndex, x) {
  const others = centers.filter((_, index) => index !== fromIndex);
  const before = others.filter((center) => center < x).length;
  return before;
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.containerEl Contenedor con `role="tablist"`.
 * @param {(path: string) => void} deps.onActivate
 * @param {(path: string) => void} deps.onClose
 * @param {(path: string, toIndex: number) => void} deps.onMove
 */
export function createTabBar({ containerEl, onActivate, onClose, onMove }) {
  containerEl.setAttribute('role', 'tablist');
  containerEl.setAttribute('aria-label', t('tab.listLabel'));

  /** Arrastre en curso: pestaña, punto de partida y si ya superó el umbral. */
  let drag = null;

  /** @param {{path: string, label: string, active: boolean, dirty: boolean, readOnly: boolean}} tab */
  function renderTab(tab) {
    const el = document.createElement('div');
    el.className = 'tab';
    el.classList.toggle('tab--active', tab.active);
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-selected', String(tab.active));
    el.tabIndex = tab.active ? 0 : -1;
    el.dataset.path = tab.path;
    el.title = tab.path;

    const name = document.createElement('span');
    name.className = 'tab__name';
    name.textContent = tab.label;
    el.append(name);

    if (tab.readOnly) {
      const badge = document.createElement('span');
      badge.className = 'tab__badge';
      badge.textContent = t('tab.readOnly');
      el.append(badge);
    }
    // RF-64.3: el punto de modificado, con su texto para el lector de pantalla.
    if (tab.dirty) {
      const dot = document.createElement('span');
      dot.className = 'tab__dirty';
      dot.title = t('doc.unsaved');
      dot.setAttribute('aria-label', t('doc.unsaved'));
      el.append(dot);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tab__close';
    close.textContent = '×';
    close.tabIndex = -1;
    close.setAttribute('aria-label', `${t('tab.close')} ${tab.label}`);
    close.title = t('tab.close');
    close.addEventListener('pointerdown', (event) => event.stopPropagation());
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      onClose(tab.path);
    });
    el.append(close);
    return el;
  }

  /**
   * @param {Array<{path: string, label: string, active: boolean, dirty: boolean, readOnly: boolean}>} tabs
   */
  function render(tabs) {
    // Si el foco estaba en la barra (navegación con teclado), vuelve a la
    // pestaña activa tras repintar: los elementos se sustituyen.
    const hadFocus = containerEl.contains(document.activeElement);
    containerEl.replaceChildren(...tabs.map(renderTab));
    containerEl.classList.toggle('hidden', tabs.length === 0);
    // La activa siempre a la vista, aunque haya muchas pestañas.
    const active = containerEl.querySelector('.tab--active');
    if (active && typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (active && hadFocus) active.focus();
  }

  const tabEls = () => [...containerEl.querySelectorAll('.tab')];
  const tabOf = (target) => (target instanceof Element ? target.closest('.tab') : null);

  containerEl.addEventListener('pointerdown', (event) => {
    const tab = tabOf(event.target);
    if (!tab || event.button !== 0) return;
    drag = { path: tab.dataset.path, startX: event.clientX, moving: false };
    containerEl.setPointerCapture?.(event.pointerId);
  });

  containerEl.addEventListener('pointermove', (event) => {
    if (!drag) return;
    if (!drag.moving && Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD_PX) return;
    drag.moving = true;
    containerEl.classList.add('tabs--dragging');
    for (const el of tabEls()) el.classList.toggle('tab--dragged', el.dataset.path === drag.path);
  });

  containerEl.addEventListener('pointerup', (event) => {
    const current = drag;
    drag = null;
    containerEl.classList.remove('tabs--dragging');
    if (!current) return;
    if (!current.moving) {
      onActivate(current.path);
      return;
    }
    const els = tabEls();
    const fromIndex = els.findIndex((el) => el.dataset.path === current.path);
    const centers = els.map((el) => {
      const rect = el.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });
    onMove(current.path, dropIndex(centers, fromIndex, event.clientX));
  });

  containerEl.addEventListener('pointercancel', () => {
    drag = null;
    containerEl.classList.remove('tabs--dragging');
  });

  // Clic central: cerrar, como en cualquier navegador o editor.
  containerEl.addEventListener('auxclick', (event) => {
    const tab = tabOf(event.target);
    if (!tab || event.button !== 1) return;
    event.preventDefault();
    onClose(tab.dataset.path);
  });

  // Teclado (patrón «tabs» de WAI-ARIA): flechas, Inicio/Fin y Supr.
  containerEl.addEventListener('keydown', (event) => {
    const tab = tabOf(event.target);
    if (!tab) return;
    const els = tabEls();
    const index = els.indexOf(tab);
    let target = null;
    if (event.key === 'ArrowRight') target = els[(index + 1) % els.length];
    else if (event.key === 'ArrowLeft') target = els[(index - 1 + els.length) % els.length];
    else if (event.key === 'Home') target = els[0];
    else if (event.key === 'End') target = els[els.length - 1];
    else if (event.key === 'Delete') {
      event.preventDefault();
      onClose(tab.dataset.path);
      return;
    } else if (event.key === 'Enter' || event.key === ' ') target = tab;
    if (!target) return;
    event.preventDefault();
    target.focus();
    onActivate(target.dataset.path);
  });

  return { render };
}
