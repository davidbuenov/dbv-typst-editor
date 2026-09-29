// =============================================================================
// DBV Typst Editor — Ir a la definición y buscar referencias (RF-77.1, RF-77.3)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// F12, Ctrl/Cmd+clic y Mayús+F12 preguntan a Tinymist y llevan al destino en
// su pestaña (RF-79). Comprobado con el binario (hallazgos 2 y 5 del plan):
//   · una función interna de Typst (`box`, `text`…) no tiene código fuente:
//     Tinymist devuelve `null` y se dice, en vez de no hacer nada;
//   · las etiquetas (`@fig-x`, `<fig-x>`) solo se resuelven si el documento
//     compila sin errores (R-L2): con errores se avisa de eso;
//   · un destino fuera del proyecto (la caché de paquetes) se abre en solo
//     lectura.

import { syntaxTree } from '@codemirror/language';
import { posFromLsp } from './lspClient.js';
import { revealRangeAndFlash } from './syncFlash.js';
import { pathKey, relativeToRoot } from '../app/paths.js';

/**
 * Símbolo bajo el cursor: la etiqueta (`@fig-x` o `<fig-x>`) o el
 * identificador que contiene la posición.
 * @param {import('@codemirror/state').EditorState} state
 * @param {number} pos
 * @returns {{text: string, isLabel: boolean} | null}
 */
export function symbolAt(state, pos) {
  const line = state.doc.lineAt(pos);
  const column = pos - line.from;
  let found = null;
  for (const match of line.text.matchAll(/@[\p{L}\p{N}_\-:.]+|<[\p{L}\p{N}_\-:.]+>|[\p{L}\p{N}_-]+/gu)) {
    const start = match.index;
    const end = start + match[0].length;
    if (column >= start && column <= end) {
      const text = match[0];
      found = { text, isLabel: text.startsWith('@') || text.startsWith('<') };
      break;
    }
  }
  return found;
}

/**
 * ¿El cursor está sobre texto normal (prosa), no sobre código? Allí no hay
 * nada que definir, referenciar ni renombrar, y el aviso de «función interna»
 * confundía (lo pidió el usuario al probar F12 sobre un párrafo). Se mira el
 * nodo más interior del árbol de Typst a los dos lados del cursor: en prosa es
 * `Text`; en código, `Ident`, `Ref`, `MathIdent`, `Str`… Sin árbol (un fichero
 * que no es Typst, o aún sin analizar) se da por código y decide Tinymist.
 * @param {import('@codemirror/state').EditorState} state
 * @param {number} pos
 */
export function isPlainText(state, pos) {
  const tree = syntaxTree(state);
  const names = [-1, 1].map((side) => tree.resolveInner(pos, side).name);
  return names.every((name) => name === 'Text' || name === 'Space');
}

/**
 * Referencias agrupadas por fichero, con la línea de contexto de cada una.
 * @param {Array<{path: string, range: any}>} locations
 * @param {string | null} root
 * @param {(path: string) => string} contentOf Texto de cada fichero.
 * @returns {Array<{path: string, relative: string, items: Array<{line: number, text: string, from: number, to: number, range: any}>}>}
 */
export function groupLocations(locations, root, contentOf) {
  const groups = new Map();
  for (const location of locations) {
    const key = pathKey(location.path);
    if (!groups.has(key)) {
      groups.set(key, { path: location.path, relative: relativeToRoot(root, location.path) ?? location.path, lines: contentOf(location.path).split('\n'), items: [] });
    }
    const group = groups.get(key);
    const { start, end } = location.range;
    const text = group.lines[start.line] ?? '';
    group.items.push({
      line: start.line + 1,
      text,
      from: start.character,
      to: end.line === start.line ? end.character : text.length,
      range: location.range,
    });
  }
  const result = [...groups.values()].map(({ lines, ...group }) => ({
    ...group,
    items: group.items.sort((a, b) => a.range.start.line - b.range.start.line || a.from - b.from),
  }));
  return result.sort((a, b) => a.relative.localeCompare(b.relative));
}

/**
 * @param {object} deps
 * @param {ReturnType<import('./lspClient.js').createLspClient> | undefined} deps.lspClient
 * @param {object} deps.workspace
 * @param {(path: string) => Promise<{ok: boolean, value?: {content: string}}>} deps.readFile
 * @param {(message: string, tone?: string) => void} deps.notify
 * @param {(key: string) => string} deps.t
 * @param {(result: {title: string, groups: any[]}) => void} deps.showReferences
 */
export function createNavigation({ lspClient, workspace, readFile, notify, t }) {
  let showReferences = () => {};

  /** Aviso para texto normal: dónde sí funcionan F12, Mayús+F12 y F2. */
  function onPlainText(view) {
    const plain = isPlainText(view.state, view.state.selection.main.head);
    if (plain) notify(t('nav.plainText'));
    return plain;
  }

  /** Motivo por el que no se puede navegar ahora, o `null` si se puede. */
  function unavailableReason() {
    const path = workspace.getDocumentPath();
    let reason = null;
    if (!path || !/\.typ$/i.test(path)) reason = t('nav.notTypst');
    else if (!lspClient) reason = t('nav.lspOff');
    else if (lspClient.getStatus() === 'starting') reason = t('nav.lspStarting');
    else if (!lspClient.isActive()) reason = t('nav.lspOff');
    return reason;
  }

  /** Posición LSP del cursor en el documento activo. */
  function cursor(view) {
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    return { head, line: line.number - 1, character: head - line.from };
  }

  /** Aviso cuando Tinymist no da destino: etiqueta sin compilar, etiqueta o función interna. */
  function explainEmpty(symbol) {
    let message = t('nav.builtin');
    if (symbol?.isLabel) message = workspace.hasEngineErrors() ? t('nav.labelNeedsCompile') : t('nav.noDefinition');
    notify(message, 'error');
  }

  /**
   * Abre `location` en su pestaña y selecciona el rango. Fuera del proyecto
   * (un paquete de la caché), en solo lectura y avisando.
   */
  async function openAt(location) {
    const root = workspace.getRoot();
    const inside = Boolean(root) && relativeToRoot(root, location.path) !== null;
    const opened = await workspace.openDocument(location.path, { readOnly: !inside });
    const view = opened ? workspace.getEditorView() : null;
    if (view) {
      if (!inside) notify(t('nav.readOnlyPackage'));
      const from = posFromLsp(view.state.doc, location.range.start);
      const to = posFromLsp(view.state.doc, location.range.end);
      revealRangeAndFlash(view, from, to);
      view.focus();
    }
    return Boolean(view);
  }

  /** F12 / Ctrl+clic (RF-77.1). */
  async function goToDefinition(view) {
    const reason = unavailableReason();
    if (reason) {
      notify(reason, 'error');
      return false;
    }
    if (onPlainText(view)) return false;
    const { head, line, character } = cursor(view);
    const symbol = symbolAt(view.state, head);
    const targets = await lspClient.getDefinition(line, character);
    if (targets.length === 0) {
      explainEmpty(symbol);
      return false;
    }
    return openAt(targets[0]);
  }

  /** Contenido de un fichero para la línea de contexto: el de su pestaña, si está abierto. */
  async function contents(paths) {
    const map = new Map();
    for (const path of paths) {
      let text = workspace.getTabContent(path);
      if (text === null) {
        const read = await readFile(path);
        text = read.ok ? read.value.content : '';
      }
      map.set(pathKey(path), text);
    }
    return map;
  }

  /** Mayús+F12 (RF-77.3): referencias agrupadas por fichero en el panel «Buscar». */
  async function findReferences(view) {
    const reason = unavailableReason();
    if (reason) {
      notify(reason, 'error');
      return false;
    }
    if (onPlainText(view)) return false;
    const { head, line, character } = cursor(view);
    const symbol = symbolAt(view.state, head);
    // Medido en /test sobre un libro de 224 páginas: la primera búsqueda de
    // referencias tarda unos 18 s en Tinymist. Sin este aviso parecería que
    // Mayús+F12 no hace nada.
    notify(t('nav.searchingReferences'));
    const locations = await lspClient.getReferences(line, character);
    if (locations.length === 0) {
      explainEmpty(symbol);
      return false;
    }
    const texts = await contents(locations.map((location) => location.path));
    const groups = groupLocations(locations, workspace.getRoot(), (path) => texts.get(pathKey(path)) ?? '');
    showReferences({ title: t('nav.referencesOf').replace('{name}', symbol?.text ?? ''), groups });
    return true;
  }

  return {
    goToDefinition,
    findReferences,
    openAt,
    unavailableReason,
    onPlainText,
    /** Dónde se enseñan las referencias (el panel «Buscar», RF-78). */
    setReferencesView(show) {
      showReferences = show;
    },
  };
}
