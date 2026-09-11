// =============================================================================
// DBV Typst Editor — Editor WYSIWYG de diagramas (RF-31)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Manipulación directa sobre un lienzo SVG: arrastrar nodos, conectarlos con
// un clic en modo "Conectar", editar su texto in situ. `diagramModel.js` tiene
// toda la lógica pura (modelo, traducción a CeTZ, reapertura); este módulo es
// solo el cableado DOM/SVG sobre ese modelo — mismo reparto de responsabilidad
// que el resto del editor (`toolbarActions.js` puro + `toolbar.js` que aplica).
//
// Coexiste con el asistente de plantillas CeTZ (RF-23, `cetzAssistant.js`)
// hasta que cubra sin regresión sus 4 tipos — entonces se retira (Slice 49).
// Alcance de esta primera pasada: lienzo genérico de nodos y flechas (cubre
// "flujo" y "bloques"); gráficas 2D y lienzo libre quedan para después.

import { t } from '../i18n/i18n.js';
import { hasCetzImport } from './toolbarActions.js';
import {
  addEdge,
  addNode,
  createEmptyDiagram,
  diagramToCetzCode,
  extractDiagramModelNear,
  moveNode,
  removeNode,
  renameNode,
} from './diagramModel.js';
import { registerPanel } from '../panels/registerPanel.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl Panel flotante que contiene el lienzo.
 * @param {SVGSVGElement} deps.svgEl Lienzo SVG donde se dibujan los nodos.
 * @param {HTMLButtonElement} deps.addNodeButtonEl
 * @param {HTMLButtonElement} deps.connectButtonEl Alterna el modo "Conectar".
 * @param {HTMLButtonElement} deps.deleteButtonEl Borra el nodo seleccionado.
 * @param {HTMLButtonElement} deps.insertButtonEl
 * @param {HTMLElement} deps.hintEl Pista de estado (modo conectar, nodo elegido...).
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 */
export function createDiagramEditor({
  panelEl,
  svgEl,
  addNodeButtonEl,
  connectButtonEl,
  deleteButtonEl,
  insertButtonEl,
  hintEl,
  getView,
}) {
  let diagram = createEmptyDiagram();
  let connectMode = false;
  let connectFrom = null;
  let selectedId = null;

  function setHint(text) {
    hintEl.textContent = text;
  }

  function render() {
    svgEl.replaceChildren();

    for (const edge of diagram.edges) {
      const from = diagram.nodes.find((node) => node.id === edge.from);
      const to = diagram.nodes.find((node) => node.id === edge.to);
      if (!from || !to) continue;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(from.x + from.w / 2));
      line.setAttribute('y1', String(from.y + from.h / 2));
      line.setAttribute('x2', String(to.x + to.w / 2));
      line.setAttribute('y2', String(to.y + to.h / 2));
      line.setAttribute('class', 'diagram-edge');
      line.setAttribute('marker-end', 'url(#diagram-arrow)');
      svgEl.append(line);
    }

    for (const node of diagram.nodes) {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'diagram-node');
      g.dataset.nodeId = node.id;

      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(node.x));
      rect.setAttribute('y', String(node.y));
      rect.setAttribute('width', String(node.w));
      rect.setAttribute('height', String(node.h));
      rect.setAttribute('rx', '6');
      rect.setAttribute('class', node.id === selectedId ? 'diagram-node__rect diagram-node__rect--selected' : 'diagram-node__rect');

      const text = document.createElementNS(SVG_NS, 'foreignObject');
      text.setAttribute('x', String(node.x + 4));
      text.setAttribute('y', String(node.y + 4));
      text.setAttribute('width', String(Math.max(0, node.w - 8)));
      text.setAttribute('height', String(Math.max(0, node.h - 8)));
      const label = document.createElement('div');
      label.className = 'diagram-node__label';
      label.contentEditable = 'true';
      label.spellcheck = false;
      label.textContent = node.label;
      label.addEventListener('pointerdown', (event) => event.stopPropagation());
      label.addEventListener('blur', () => {
        diagram = renameNode(diagram, node.id, label.textContent.trim() || node.label);
      });
      text.append(label);

      g.append(rect, text);
      wireNodeInteraction(g, node.id);
      svgEl.append(g);
    }
  }

  function wireNodeInteraction(g, nodeId) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let nodeStartX = 0;
    let nodeStartY = 0;

    g.addEventListener('pointerdown', (event) => {
      if (connectMode) {
        if (connectFrom === null) {
          connectFrom = nodeId;
          const originLabel = diagram.nodes.find((n) => n.id === nodeId)?.label ?? nodeId;
          setHint(`${originLabel} → ${t('diagram.connectHintTarget')}`);
        } else {
          diagram = addEdge(diagram, connectFrom, nodeId);
          connectFrom = null;
          setHint(t('diagram.connectHint'));
          render();
        }
        return;
      }

      selectedId = nodeId;
      const node = diagram.nodes.find((n) => n.id === nodeId);
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      nodeStartX = node.x;
      nodeStartY = node.y;
      g.setPointerCapture?.(event.pointerId);
      render();
    });

    g.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const scale = svgEl.clientWidth ? svgEl.viewBox.baseVal.width / svgEl.clientWidth : 1;
      const dx = (event.clientX - startX) * scale;
      const dy = (event.clientY - startY) * scale;
      diagram = moveNode(diagram, nodeId, Math.max(0, nodeStartX + dx), Math.max(0, nodeStartY + dy));
      render();
    });

    const stopDrag = (event) => {
      dragging = false;
      g.releasePointerCapture?.(event.pointerId);
    };
    g.addEventListener('pointerup', stopDrag);
    g.addEventListener('pointercancel', stopDrag);
  }

  addNodeButtonEl.addEventListener('click', () => {
    const offset = (diagram.nodes.length % 5) * 24;
    diagram = addNode(diagram, { x: 40 + offset, y: 40 + offset });
    render();
  });

  connectButtonEl.addEventListener('click', () => {
    connectMode = !connectMode;
    connectFrom = null;
    // Sin modificador `--active` propio: reutiliza `--primary`/`--ghost`, ya
    // existentes, para no añadir una variante de botón nueva solo para esto.
    connectButtonEl.classList.toggle('button--primary', connectMode);
    connectButtonEl.classList.toggle('button--ghost', !connectMode);
    setHint(connectMode ? t('diagram.connectHint') : '');
  });

  deleteButtonEl.addEventListener('click', () => {
    if (!selectedId) return;
    diagram = removeNode(diagram, selectedId);
    selectedId = null;
    render();
  });

  insertButtonEl.addEventListener('click', () => {
    const view = getView();
    if (!view || diagram.nodes.length === 0) return;

    const docText = view.state.doc.toString();
    const needsImport = !hasCetzImport(docText);
    const importText = '#import "@preview/cetz:0.5.2"\n\n';
    const code = diagramToCetzCode(diagram);
    const { from, to } = view.state.selection.main;

    const insertion = (from === 0 ? '' : docText[from - 1] === '\n' ? '\n' : '\n\n') + code + '\n';
    const changes = [];
    let offset = 0;
    if (needsImport && from === 0) {
      changes.push({ from: 0, to, insert: importText + code + '\n\n' });
    } else {
      if (needsImport) {
        changes.push({ from: 0, to: 0, insert: importText });
        offset = importText.length;
      }
      changes.push({ from, to, insert: insertion });
    }
    view.dispatch({ changes, selection: { anchor: from + offset + insertion.length } });
    view.focus();
    panel.close();
  });

  const panel = registerPanel(panelEl, {
    closeOnOutsideClick: false,
  });

  return {
    /** Abre el editor vacío, o cargando el diagrama existente bajo el cursor si lo hay (RF-31.3). */
    openNear(triggerEl) {
      const view = getView();
      const existing = view ? extractDiagramModelNear(view.state.doc.toString(), view.state.selection.main.from) : null;
      diagram = existing ?? createEmptyDiagram();
      selectedId = null;
      connectMode = false;
      connectFrom = null;
      connectButtonEl.classList.add('button--ghost');
      connectButtonEl.classList.remove('button--primary');
      setHint(existing ? t('diagram.editingExisting') : '');

      const rect = triggerEl.getBoundingClientRect();
      panelEl.style.top = `${rect.bottom + 6}px`;
      panelEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 480, rect.left))}px`;
      panelEl.style.right = 'auto';
      render();
      panel.open();
    },
    close: panel.close,
  };
}
