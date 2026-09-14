// =============================================================================
// DBV Typst Editor — Editor visual de ecuaciones (RF-46)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cableado DOM sobre `equationModel.js` (puro) — mismo reparto que
// `diagramEditor.js`/`toolbarActions.js`+`toolbar.js`. La "ecuación en
// construcción" es un campo de texto normal con el código Typst de la
// fórmula; los botones de pieza insertan en su cursor, y una vista previa
// recompila ese texto en vivo contra el sidecar real (spike de la Fase 19,
// `equation.rs`: ~80ms por compilación, muy por debajo del umbral de
// Doherty), no contra una librería de render matemático de terceros — así
// se ve exactamente lo que Typst va a componer, nunca una aproximación.

import { t } from '../i18n/i18n.js';
import { compileEquation } from '../services/backend.js';
import { registerPanel } from '../panels/registerPanel.js';
import {
  buildMitexCall,
  EQUATION_SNIPPETS,
  hasMitexImport,
  insertSnippet,
  mitexImportLine,
  wrapEquationForInsert,
} from './equationModel.js';

/** Glifo visible de cada pieza — puramente visual, la sintaxis real vive en `equationModel.js`. */
const SNIPPET_GLYPHS = {
  frac: 'a/b',
  pow: 'xⁿ',
  sub: 'xₙ',
  sqrt: '√',
  root: 'ⁿ√',
  sum: 'Σ',
  integral: '∫',
  prod: '∏',
  lim: 'lim',
  matrix: '2×2',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  pi: 'π',
  theta: 'θ',
  lambda: 'λ',
  infinity: '∞',
  times: '×',
  div: '÷',
  plusminus: '±',
  leq: '≤',
  geq: '≥',
  neq: '≠',
  approx: '≈',
  parens: '( )',
  brackets: '[ ]',
  braces: '{ }',
  abs: '|x|',
};

const GROUP_CONTAINER = {
  structure: 'group-structure',
  bigop: 'group-bigop',
  matrix: 'group-matrix',
  symbol: 'group-symbol',
  operator: 'group-operator',
  delimiter: 'group-delimiter',
};

/** Debounce de la vista previa en vivo — el mismo orden de magnitud que RF-06 (350ms), con margen de sobra sobre los ~80ms medidos por compilación. */
const PREVIEW_DEBOUNCE_MS = 200;

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 * @param {() => string | null} deps.getRoot Raíz del proyecto abierto, o `null` (`.typ` suelto / sin proyecto).
 */
export function createEquationEditor({ panelEl, getView, getRoot }) {
  const find = (name) => panelEl.querySelector(`[data-equation="${name}"]`);

  const sourceEl = find('source');
  const previewEl = find('preview');
  const hintEl = find('hint');
  const latexEl = find('latex');
  const latexInsertEl = find('latex-insert');
  const insertEl = find('insert');

  let debounceTimer = null;
  /** Se descarta cualquier respuesta que no sea la de la petición más reciente — mismo principio que la vista previa principal, aplicado en JS en vez de con un `Mutex` compartido en Rust (ver `equation.rs`). */
  let requestToken = 0;
  /** "Last good render" (mismo criterio que RF-24): un error de compilación no borra la última fórmula que sí se vio bien. */
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
    previewEl.textContent = t('equation.hintEmpty');
  }

  async function refreshPreview() {
    const math = sourceEl.value;
    if (!math.trim()) {
      renderEmptyPreview();
      setHint('equation.hintEmpty');
      lastGoodSvg = null;
      return;
    }

    const token = ++requestToken;
    const preamble = hasMitexImport(math) || math.includes('mi(') ? mitexImportLine() : null;
    const result = await compileEquation(math, { root: getRoot(), preamble });
    if (token !== requestToken) return; // ya hay una petición más reciente en vuelo

    if (result.ok) {
      lastGoodSvg = result.value;
      renderPreview(result.value);
      setHint('equation.hintDefault');
    } else if (lastGoodSvg) {
      // Se conserva la última fórmula que sí compiló — nunca se deja la
      // vista previa en blanco por un error a mitad de escribir.
      renderPreview(lastGoodSvg);
      setHint('equation.hintError');
    } else {
      setHint('equation.hintError');
    }
  }

  function schedulePreview() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refreshPreview, PREVIEW_DEBOUNCE_MS);
  }

  function applySnippet(snippet) {
    const { value, selectionStart, selectionEnd } = insertSnippet(
      sourceEl.value,
      sourceEl.selectionStart ?? sourceEl.value.length,
      sourceEl.selectionEnd ?? sourceEl.value.length,
      snippet,
    );
    sourceEl.value = value;
    sourceEl.focus();
    sourceEl.setSelectionRange(selectionStart, selectionEnd);
    schedulePreview();
  }

  function buildSnippetButtons() {
    for (const snippet of EQUATION_SNIPPETS) {
      const containerName = GROUP_CONTAINER[snippet.group];
      const container = find(containerName);
      if (!container) continue;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'equation-editor__snippet';
      // Atributo estable para tests/automatización — el título es texto
      // traducido y no debe ser la única forma de localizar el botón.
      button.dataset.equationSnippet = snippet.id;
      button.textContent = SNIPPET_GLYPHS[snippet.id] ?? snippet.id;
      button.title = t(`equation.snippet.${snippet.id}`);
      button.addEventListener('click', () => applySnippet(snippet));
      container.append(button);
    }
  }

  sourceEl?.addEventListener('input', schedulePreview);

  latexInsertEl?.addEventListener('click', () => {
    const latex = latexEl.value.trim();
    if (!latex) {
      setHint('equation.latexEmpty');
      return;
    }
    const call = buildMitexCall(latex);
    const { value, selectionStart, selectionEnd } = insertSnippet(
      sourceEl.value,
      sourceEl.selectionStart ?? sourceEl.value.length,
      sourceEl.selectionEnd ?? sourceEl.value.length,
      { insert: call },
    );
    sourceEl.value = value;
    sourceEl.setSelectionRange(selectionStart, selectionEnd);
    latexEl.value = '';
    sourceEl.focus();
    schedulePreview();
  });

  insertEl?.addEventListener('click', () => {
    const view = getView();
    const code = wrapEquationForInsert(sourceEl.value);
    if (!view || !code) return;

    const docText = view.state.doc.toString();
    const needsImport = (hasMitexImport(sourceEl.value) || sourceEl.value.includes('mi(')) && !hasMitexImport(docText);
    const importText = needsImport ? `${mitexImportLine()}\n\n` : '';

    const { from, to } = view.state.selection.main;
    const insertion = (from === 0 ? '' : docText[from - 1] === '\n' ? '\n' : '\n\n') + code + '\n';
    const changes = [];
    let offsetChars = 0;
    if (importText) {
      changes.push({ from: 0, to: 0, insert: importText });
      offsetChars = importText.length;
    }
    changes.push({ from, to, insert: insertion });
    view.dispatch({ changes, selection: { anchor: from + offsetChars + insertion.length } });
    view.focus();
    panel.close();
  });

  buildSnippetButtons();

  const panel = registerPanel(panelEl, { closeOnOutsideClick: false });

  return {
    openNear(triggerEl) {
      sourceEl.value = '';
      latexEl.value = '';
      lastGoodSvg = null;
      renderEmptyPreview();
      setHint('equation.hintEmpty');

      const rect = triggerEl.getBoundingClientRect();
      panelEl.style.top = `${rect.bottom + 6}px`;
      panelEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 420, rect.left))}px`;
      panelEl.style.right = 'auto';
      panelEl.style.transform = 'none';
      panel.open();
      sourceEl.focus();
    },
    close: panel.close,
  };
}
