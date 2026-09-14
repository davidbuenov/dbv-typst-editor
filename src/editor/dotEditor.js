// =============================================================================
// DBV Typst Editor — Asistente de DOT/Graphviz (RF-51)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cableado DOM sobre `dotModel.js` (puro) — mismo criterio de vista previa en
// vivo que `equationEditor.js` (RF-46), pero sin ningún catálogo de piezas:
// el propio texto DOT que escribe el usuario ES el contenido (SPECIFICATIONS.md
// §5g RF-51.1 — quien usa esto ya sabe o ya tiene escrito el DOT).

import { t } from '../i18n/i18n.js';
import { compileDot } from '../services/backend.js';
import { positionPanelNear, registerPanel } from '../panels/registerPanel.js';
import { diagraphImportLine, hasDiagraphImport, wrapDotForInsert } from './dotModel.js';
import { insertGeneratedCode } from './insertGeneratedCode.js';

/** Mismo debounce que RF-46 — el spike de `/plan` midió ~105ms de media por compilación de DOT, con margen de sobra. */
const PREVIEW_DEBOUNCE_MS = 200;

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 * @param {() => string | null} deps.getRoot Raíz del proyecto abierto, o `null` (`.typ` suelto / sin proyecto).
 */
export function createDotEditor({ panelEl, getView, getRoot }) {
  const find = (name) => panelEl.querySelector(`[data-dot="${name}"]`);

  const sourceEl = find('source');
  const previewEl = find('preview');
  const hintEl = find('hint');
  const insertEl = find('insert');

  let debounceTimer = null;
  /** Mismo principio que `equationEditor.js`: se descarta cualquier respuesta que no sea la de la petición más reciente. */
  let requestToken = 0;
  /** "Last good render" (mismo criterio que RF-24/RF-46): un DOT a medio escribir no borra la última vista previa que sí compiló. */
  let lastGoodSvg = null;

  function setHint(key) {
    hintEl.textContent = t(key);
  }

  function renderPreview(svg) {
    previewEl.classList.remove('equation-editor__preview--empty');
    previewEl.innerHTML = svg;
  }

  function renderEmptyPreview() {
    previewEl.classList.add('equation-editor__preview--empty');
    previewEl.textContent = t('dot.hintEmpty');
  }

  async function refreshPreview() {
    const dot = sourceEl.value;
    if (!dot.trim()) {
      renderEmptyPreview();
      setHint('dot.hintEmpty');
      lastGoodSvg = null;
      return;
    }

    const token = ++requestToken;
    const result = await compileDot(dot, { root: getRoot() });
    if (token !== requestToken) return; // ya hay una petición más reciente en vuelo

    if (result.ok) {
      lastGoodSvg = result.value;
      renderPreview(result.value);
      setHint('dot.hintDefault');
    } else if (lastGoodSvg) {
      renderPreview(lastGoodSvg);
      setHint('dot.hintError');
    } else {
      setHint('dot.hintError');
    }
  }

  function schedulePreview() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refreshPreview, PREVIEW_DEBOUNCE_MS);
  }

  sourceEl?.addEventListener('input', schedulePreview);

  insertEl?.addEventListener('click', () => {
    const view = getView();
    const code = wrapDotForInsert(sourceEl.value);
    if (!view || !code) return;

    const needsImport = !hasDiagraphImport(view.state.doc.toString());
    const importText = needsImport ? `${diagraphImportLine()}\n\n` : '';

    insertGeneratedCode(view, { code, importText });
    panel.close();
  });

  const panel = registerPanel(panelEl, { closeOnOutsideClick: false });

  return {
    openNear(triggerEl) {
      sourceEl.value = '';
      lastGoodSvg = null;
      renderEmptyPreview();
      setHint('dot.hintEmpty');

      positionPanelNear(panelEl, triggerEl, { width: 640 });
      panel.open();
      sourceEl.focus();
    },
    close: panel.close,
  };
}
