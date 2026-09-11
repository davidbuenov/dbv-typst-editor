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
//
// LECCIÓN de la primera versión (2026-09-11, feedback real del usuario: "no
// se pueden mover ni arrastrar"): `render()` reconstruía TODO el SVG
// (`svgEl.replaceChildren()`) en cada `pointerdown` (para marcar la
// selección) y en cada `pointermove` del arrastre (para reflejar la nueva
// posición). Eso destruye y sustituye el propio `<g>` que acaba de capturar
// el puntero (`setPointerCapture`) — el arrastre se rompía en el primer
// píxel de movimiento porque el elemento que lo empezó ya no existía. La
// solución: `render()` completo SOLO cuando cambia la lista de nodos/aristas
// (añadir, borrar, conectar); mover y seleccionar actualizan el DOM que ya
// existe, sin reconstruir nada.

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
 * Plantillas de arranque (RF-31, feedback del usuario: "sería bueno que
 * aparecieran con algún contenido como idea, al menos el contenido de los
 * diagramas que aparecen cuando se pulsa el hexágono") — mismo contenido que
 * `getCetzSnippet('flowchart'|'block')` en `toolbarActions.js`, pero como
 * modelo de nodos editable en vez de código de texto fijo.
 */
const SEED_TEMPLATES = {
  flowchart: () => {
    let diagram = addNode(createEmptyDiagram(), { x: 40, y: 40, label: 'Inicio' });
    diagram = addNode(diagram, { x: 40, y: 140, label: 'Procesar' });
    diagram = addNode(diagram, { x: 40, y: 240, label: 'Fin' });
    diagram = addEdge(diagram, 'n1', 'n2');
    diagram = addEdge(diagram, 'n2', 'n3');
    return diagram;
  },
  block: () => {
    let diagram = addNode(createEmptyDiagram(), { x: 20, y: 40, label: 'Cliente' });
    diagram = addNode(diagram, { x: 200, y: 40, label: 'Servidor' });
    diagram = addNode(diagram, { x: 380, y: 40, label: 'Base de Datos' });
    diagram = addEdge(diagram, 'n1', 'n2');
    diagram = addEdge(diagram, 'n2', 'n3');
    return diagram;
  },
};

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl Panel flotante que contiene el lienzo.
 * @param {SVGSVGElement} deps.svgEl Lienzo SVG donde se dibujan los nodos.
 * @param {HTMLElement} deps.seedRowEl Fila de plantillas de arranque, oculta cuando el lienzo ya tiene nodos.
 * @param {HTMLButtonElement} deps.seedFlowchartBtn
 * @param {HTMLButtonElement} deps.seedBlockBtn
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
  seedRowEl,
  seedFlowchartBtn,
  seedBlockBtn,
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

  function updateSeedVisibility() {
    if (seedRowEl) seedRowEl.classList.toggle('hidden', diagram.nodes.length > 0);
  }

  /** Coordenadas del centro de un nodo, para el punto de anclaje de sus flechas. */
  function nodeCenter(node) {
    return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
  }

  /**
   * Reconstrucción completa del lienzo — SOLO cuando cambia qué nodos/aristas
   * existen (añadir, borrar, conectar) o al abrir el panel. Nunca durante un
   * arrastre en curso: ver la lección al principio del fichero.
   */
  function render() {
    svgEl.replaceChildren();
    updateSeedVisibility();

    for (const edge of diagram.edges) {
      const from = diagram.nodes.find((node) => node.id === edge.from);
      const to = diagram.nodes.find((node) => node.id === edge.to);
      if (!from || !to) continue;
      const line = document.createElementNS(SVG_NS, 'line');
      const a = nodeCenter(from);
      const b = nodeCenter(to);
      line.setAttribute('x1', String(a.x));
      line.setAttribute('y1', String(a.y));
      line.setAttribute('x2', String(b.x));
      line.setAttribute('y2', String(b.y));
      line.setAttribute('class', 'diagram-edge');
      line.dataset.from = edge.from;
      line.dataset.to = edge.to;
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
      wireNodeInteraction(g, rect, text, node.id);
      svgEl.append(g);
    }
  }

  /** Marca visualmente el nodo seleccionado sin tocar el resto del DOM. */
  function applySelection(nodeId) {
    selectedId = nodeId;
    for (const rect of svgEl.querySelectorAll('.diagram-node__rect')) {
      const isSelected = rect.closest('.diagram-node')?.dataset.nodeId === nodeId;
      rect.classList.toggle('diagram-node__rect--selected', isSelected);
    }
  }

  /**
   * Mueve un nodo actualizando SOLO sus atributos SVG y los de las flechas
   * que lo tocan — nunca reconstruye el lienzo (eso es lo que rompía el
   * arrastre, ver la nota al principio del fichero).
   */
  function patchNodePosition(node, rectEl, textEl) {
    rectEl.setAttribute('x', String(node.x));
    rectEl.setAttribute('y', String(node.y));
    textEl.setAttribute('x', String(node.x + 4));
    textEl.setAttribute('y', String(node.y + 4));

    const center = nodeCenter(node);
    for (const line of svgEl.querySelectorAll('.diagram-edge')) {
      if (line.dataset.from === node.id) {
        line.setAttribute('x1', String(center.x));
        line.setAttribute('y1', String(center.y));
      }
      if (line.dataset.to === node.id) {
        line.setAttribute('x2', String(center.x));
        line.setAttribute('y2', String(center.y));
      }
    }
  }

  function wireNodeInteraction(g, rectEl, textEl, nodeId) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let nodeStartX = 0;
    let nodeStartY = 0;
    let moved = false;

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
          render(); // aquí SÍ hace falta: añade una arista nueva al DOM
        }
        return;
      }

      applySelection(nodeId);
      const node = diagram.nodes.find((n) => n.id === nodeId);
      dragging = true;
      moved = false;
      startX = event.clientX;
      startY = event.clientY;
      nodeStartX = node.x;
      nodeStartY = node.y;
      g.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    g.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      moved = true;
      const scale = svgEl.clientWidth ? svgEl.viewBox.baseVal.width / svgEl.clientWidth : 1;
      const dx = (event.clientX - startX) * scale;
      const dy = (event.clientY - startY) * scale;
      diagram = moveNode(diagram, nodeId, Math.max(0, nodeStartX + dx), Math.max(0, nodeStartY + dy));
      const node = diagram.nodes.find((n) => n.id === nodeId);
      patchNodePosition(node, rectEl, textEl);
    });

    const stopDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      g.releasePointerCapture?.(event.pointerId);
      // Un clic sin arrastre real activa la edición del texto directamente,
      // para no obligar a un segundo clic aparte solo para escribir.
      if (!moved) textEl.querySelector('.diagram-node__label')?.focus();
    };
    g.addEventListener('pointerup', stopDrag);
    g.addEventListener('pointercancel', stopDrag);
  }

  function seedWith(templateFn) {
    diagram = templateFn();
    selectedId = null;
    render();
  }

  seedFlowchartBtn?.addEventListener('click', () => seedWith(SEED_TEMPLATES.flowchart));
  seedBlockBtn?.addEventListener('click', () => seedWith(SEED_TEMPLATES.block));

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
    setHint(connectMode ? t('diagram.connectHint') : t('diagram.defaultHint'));
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
      setHint(existing ? t('diagram.editingExisting') : t('diagram.defaultHint'));

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
