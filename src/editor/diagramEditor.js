// =============================================================================
// DBV Typst Editor — Editor WYSIWYG de diagramas (RF-31)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Manipulación directa sobre un lienzo SVG: insertar nodos de cuatro formas,
// arrastrarlos, colorearlos, conectarlos y editar su texto in situ, con zoom y
// paneo sobre el lienzo. `diagramModel.js` tiene toda la lógica pura (modelo,
// traducción a CeTZ, reapertura); este módulo es solo el cableado DOM/SVG
// sobre ese modelo — mismo reparto de responsabilidad que el resto del editor
// (`toolbarActions.js` puro + `toolbar.js` que aplica).
//
// La segunda pasada (feedback del usuario, 2026-09-11: "el editor es más
// simple que un botijo y solo permite añadir cuadros, sin colores") se apoya
// en dbv-eer-studio, el otro editor de diagramas de la casa, del que se
// adopta su modelo de interacción ya rodado: paleta de formas que se insertan
// con un clic, transformación `translate(offset) scale(zoom)` sobre un grupo
// contenedor en vez de recalcular cada coordenada, arrastre del propio lienzo
// para panear, y controles de zoom flotando sobre la esquina del lienzo.
//
// LECCIÓN de la primera versión (feedback real: "no se pueden mover ni
// arrastrar"): `render()` reconstruía TODO el SVG en cada `pointerdown` y en
// cada `pointermove` del arrastre, destruyendo el propio `<g>` que acababa de
// capturar el puntero. La solución, que se mantiene: `render()` completo SOLO
// cuando cambia qué nodos/aristas existen; mover y seleccionar parchean el DOM
// que ya existe. Corolario descubierto al reescribir: el `render()` antiguo
// hacía `svgEl.replaceChildren()`, que se llevaba por delante el `<defs>` con
// la punta de flecha declarado en el HTML — las flechas perdían la punta tras
// el primer dibujado. Por eso ahora se dibuja dentro de un `<g>` contenedor y
// nunca directamente sobre el `<svg>`.

import { t } from '../i18n/i18n.js';
import { hasCetzImport } from './toolbarActions.js';
import {
  NODE_COLORS,
  NODE_SHAPES,
  addEdge,
  addNode,
  colorOf,
  createEmptyDiagram,
  diagramToCetzCode,
  extractDiagramModelNear,
  moveNode,
  removeNode,
  renameNode,
  setNodeColor,
  shapeOf,
} from './diagramModel.js';
import { registerPanel } from '../panels/registerPanel.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

/**
 * Plantillas de arranque (RF-31, feedback del usuario: "sería bueno que
 * aparecieran con algún contenido como idea, al menos el contenido de los
 * diagramas que aparecen cuando se pulsa el hexágono") — mismo contenido que
 * `getCetzSnippet('flowchart'|'block')` en `toolbarActions.js`, pero como
 * modelo de nodos editable en vez de código de texto fijo. Cada plantilla
 * estrena forma y color propios para que se vea de un vistazo que el lienzo
 * no es un único tipo de caja.
 */
const SEED_TEMPLATES = {
  flowchart: () => {
    let diagram = addNode(createEmptyDiagram(), { x: 60, y: 30, label: 'Inicio', shape: 'round', color: 'green' });
    diagram = addNode(diagram, { x: 60, y: 140, label: 'Procesar', shape: 'rect', color: 'blue' });
    diagram = addNode(diagram, { x: 60, y: 250, label: 'Fin', shape: 'round', color: 'rose' });
    diagram = addEdge(diagram, 'n1', 'n2');
    diagram = addEdge(diagram, 'n2', 'n3');
    return diagram;
  },
  block: () => {
    let diagram = addNode(createEmptyDiagram(), { x: 30, y: 60, label: 'Cliente', shape: 'rect', color: 'blue' });
    diagram = addNode(diagram, { x: 240, y: 60, label: 'Servidor', shape: 'rect', color: 'purple' });
    diagram = addNode(diagram, { x: 450, y: 60, label: 'Base de Datos', shape: 'ellipse', color: 'amber' });
    diagram = addEdge(diagram, 'n1', 'n2');
    diagram = addEdge(diagram, 'n2', 'n3');
    return diagram;
  },
};

/**
 * El editor busca sus propios controles dentro del panel por `data-diagram`,
 * en vez de recibir quince elementos sueltos desde `workspace.js`: los botones
 * del lienzo son parte del panel, no del cableado de la aplicación, y así
 * añadir uno nuevo no obliga a tocar tres ficheros.
 *
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl Panel flotante que contiene el lienzo y sus controles.
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 */
export function createDiagramEditor({ panelEl, getView }) {
  const find = (name) => panelEl.querySelector(`[data-diagram="${name}"]`);

  const svgEl = find('canvas');
  const viewportEl = find('viewport') ?? svgEl.appendChild(document.createElementNS(SVG_NS, 'g'));
  const seedRowEl = find('seed-row');
  const colorsEl = find('colors');
  const hintEl = find('hint');
  const zoomLevelEl = find('zoom-level');

  let diagram = createEmptyDiagram();
  let connectMode = false;
  let connectFrom = null;
  let selectedId = null;
  let zoom = 1;
  let offset = { x: 0, y: 0 };

  function setHint(text) {
    if (hintEl) hintEl.textContent = text;
  }

  function updateSeedVisibility() {
    seedRowEl?.classList.toggle('hidden', diagram.nodes.length > 0);
  }

  /** Coordenadas del centro de un nodo, para el punto de anclaje de sus flechas. */
  function nodeCenter(node) {
    return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
  }

  /**
   * Factor entre píxeles de pantalla y unidades del lienzo, combinando el
   * escalado del `viewBox` (el SVG se estira al ancho disponible) con el zoom
   * del usuario. Sin esto, arrastrar con zoom al 50% movería el nodo el doble
   * de lo que se ve.
   */
  function pointerScale() {
    const viewBoxScale = svgEl.clientWidth ? svgEl.viewBox.baseVal.width / svgEl.clientWidth : 1;
    return viewBoxScale / zoom;
  }

  function applyViewport() {
    viewportEl.setAttribute('transform', `translate(${offset.x}, ${offset.y}) scale(${zoom})`);
    if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(zoom * 100)}%`;
  }

  function setZoom(next) {
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(next * 100) / 100));
    applyViewport();
  }

  /** Encuadra todo el diagrama en el lienzo — el "fit to content" de eer-studio. */
  function fitToContent() {
    if (diagram.nodes.length === 0) {
      zoom = 1;
      offset = { x: 0, y: 0 };
      applyViewport();
      return;
    }
    const minX = Math.min(...diagram.nodes.map((n) => n.x));
    const minY = Math.min(...diagram.nodes.map((n) => n.y));
    const maxX = Math.max(...diagram.nodes.map((n) => n.x + n.w));
    const maxY = Math.max(...diagram.nodes.map((n) => n.y + n.h));
    const box = svgEl.viewBox.baseVal;
    const margin = 24;
    const scale = Math.min(
      (box.width - margin * 2) / Math.max(1, maxX - minX),
      (box.height - margin * 2) / Math.max(1, maxY - minY),
    );
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(scale * 100) / 100));
    offset = {
      x: Math.round(margin - minX * zoom + (box.width - margin * 2 - (maxX - minX) * zoom) / 2),
      y: Math.round(margin - minY * zoom + (box.height - margin * 2 - (maxY - minY) * zoom) / 2),
    };
    applyViewport();
  }

  /** Dibuja la silueta de un nodo con la primitiva SVG que le toca por forma. */
  function createShapeElement(node) {
    const { fill, stroke } = colorOf(node);
    const shape = shapeOf(node);
    let el;

    if (shape === 'ellipse') {
      el = document.createElementNS(SVG_NS, 'ellipse');
    } else if (shape === 'diamond') {
      el = document.createElementNS(SVG_NS, 'polygon');
    } else {
      el = document.createElementNS(SVG_NS, 'rect');
      el.setAttribute('rx', shape === 'round' ? '14' : '3');
    }

    el.setAttribute('class', 'diagram-node__shape');
    el.setAttribute('fill', fill);
    el.setAttribute('stroke', stroke);
    positionShapeElement(el, node);
    return el;
  }

  /** Coloca la silueta ya creada; separado de la creación para poder reusarlo en el arrastre. */
  function positionShapeElement(el, node) {
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;

    if (el.tagName === 'ellipse') {
      el.setAttribute('cx', String(cx));
      el.setAttribute('cy', String(cy));
      el.setAttribute('rx', String(node.w / 2));
      el.setAttribute('ry', String(node.h / 2));
    } else if (el.tagName === 'polygon') {
      el.setAttribute(
        'points',
        `${cx},${node.y} ${node.x + node.w},${cy} ${cx},${node.y + node.h} ${node.x},${cy}`,
      );
    } else {
      el.setAttribute('x', String(node.x));
      el.setAttribute('y', String(node.y));
      el.setAttribute('width', String(node.w));
      el.setAttribute('height', String(node.h));
    }
  }

  /**
   * Reconstrucción completa del lienzo — SOLO cuando cambia qué nodos/aristas
   * existen (insertar, borrar, conectar, recolorear) o al abrir el panel.
   * Nunca durante un arrastre en curso: ver la lección al principio del
   * fichero. Dibuja dentro de `viewportEl`, jamás sobre el `<svg>`, para no
   * borrar el `<defs>` con la punta de flecha y la rejilla.
   */
  function render() {
    viewportEl.replaceChildren();
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
      viewportEl.append(line);
    }

    for (const node of diagram.nodes) {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', node.id === selectedId ? 'diagram-node diagram-node--selected' : 'diagram-node');
      g.dataset.nodeId = node.id;

      const shapeEl = createShapeElement(node);

      const text = document.createElementNS(SVG_NS, 'foreignObject');
      text.setAttribute('x', String(node.x + 6));
      text.setAttribute('y', String(node.y + 6));
      text.setAttribute('width', String(Math.max(0, node.w - 12)));
      text.setAttribute('height', String(Math.max(0, node.h - 12)));
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

      g.append(shapeEl, text);
      wireNodeInteraction(g, shapeEl, text, node.id);
      viewportEl.append(g);
    }
  }

  /** Marca visualmente el nodo seleccionado sin tocar el resto del DOM. */
  function applySelection(nodeId) {
    selectedId = nodeId;
    for (const g of viewportEl.querySelectorAll('.diagram-node')) {
      g.classList.toggle('diagram-node--selected', g.dataset.nodeId === nodeId);
    }
    syncColorSelection();
  }

  /**
   * Mueve un nodo actualizando SOLO sus atributos SVG y los de las flechas
   * que lo tocan — nunca reconstruye el lienzo (eso es lo que rompía el
   * arrastre, ver la nota al principio del fichero).
   */
  function patchNodePosition(node, shapeEl, textEl) {
    positionShapeElement(shapeEl, node);
    textEl.setAttribute('x', String(node.x + 6));
    textEl.setAttribute('y', String(node.y + 6));

    const center = nodeCenter(node);
    for (const line of viewportEl.querySelectorAll('.diagram-edge')) {
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

  function wireNodeInteraction(g, shapeEl, textEl, nodeId) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let nodeStartX = 0;
    let nodeStartY = 0;
    let moved = false;

    g.addEventListener('pointerdown', (event) => {
      // Frena el paneo del lienzo: sin esto, arrastrar un nodo movería además
      // todo el fondo bajo él.
      event.stopPropagation();

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
      const scale = pointerScale();
      const dx = (event.clientX - startX) * scale;
      const dy = (event.clientY - startY) * scale;
      diagram = moveNode(diagram, nodeId, Math.max(0, nodeStartX + dx), Math.max(0, nodeStartY + dy));
      const node = diagram.nodes.find((n) => n.id === nodeId);
      patchNodePosition(node, shapeEl, textEl);
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

  // --- Paneo del lienzo -------------------------------------------------
  // Arrastrar sobre el fondo mueve la vista, no los nodos (igual que en
  // eer-studio): con diagramas que no caben en el panel es la única forma de
  // llegar a lo que queda fuera sin reducir el zoom.
  let panning = false;
  let panStart = { x: 0, y: 0 };
  let panOrigin = { x: 0, y: 0 };

  svgEl.addEventListener('pointerdown', (event) => {
    panning = true;
    panStart = { x: event.clientX, y: event.clientY };
    panOrigin = { ...offset };
    svgEl.setPointerCapture?.(event.pointerId);
    applySelection(null);
  });

  svgEl.addEventListener('pointermove', (event) => {
    if (!panning) return;
    const viewBoxScale = svgEl.clientWidth ? svgEl.viewBox.baseVal.width / svgEl.clientWidth : 1;
    offset = {
      x: panOrigin.x + (event.clientX - panStart.x) * viewBoxScale,
      y: panOrigin.y + (event.clientY - panStart.y) * viewBoxScale,
    };
    applyViewport();
  });

  const stopPan = (event) => {
    panning = false;
    svgEl.releasePointerCapture?.(event.pointerId);
  };
  svgEl.addEventListener('pointerup', stopPan);
  svgEl.addEventListener('pointercancel', stopPan);

  svgEl.addEventListener('wheel', (event) => {
    event.preventDefault();
    setZoom(zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
  });

  // --- Paleta de colores ------------------------------------------------
  /** Construye los botones de color una sola vez, desde la paleta del modelo. */
  function buildColorSwatches() {
    if (!colorsEl) return;
    colorsEl.replaceChildren();
    for (const color of NODE_COLORS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'diagram-editor__swatch';
      button.dataset.color = color.id;
      button.style.background = color.fill;
      button.style.borderColor = color.stroke;
      button.title = t(`diagram.color.${color.id}`);
      button.addEventListener('click', () => {
        if (!selectedId) {
          setHint(t('diagram.colorNeedsSelection'));
          return;
        }
        diagram = setNodeColor(diagram, selectedId, color.id);
        render();
        applySelection(selectedId);
      });
      colorsEl.append(button);
    }
  }

  /** Resalta el color del nodo seleccionado, o ninguno si no hay selección. */
  function syncColorSelection() {
    if (!colorsEl) return;
    const node = diagram.nodes.find((n) => n.id === selectedId);
    for (const button of colorsEl.querySelectorAll('.diagram-editor__swatch')) {
      button.classList.toggle('diagram-editor__swatch--selected', Boolean(node) && button.dataset.color === colorOf(node).id);
    }
  }

  // --- Controles --------------------------------------------------------
  function insertShape(shape) {
    // Escalonar la posición evita que dos nodos seguidos salgan exactamente
    // uno encima de otro, lo que parecería que el botón no ha hecho nada.
    const step = (diagram.nodes.length % 6) * 26;
    diagram = addNode(diagram, {
      x: 40 + step,
      y: 40 + step,
      w: shape === 'ellipse' || shape === 'diamond' ? 150 : 140,
      h: shape === 'diamond' ? 80 : 60,
      shape,
      label: t('diagram.newNodeLabel'),
    });
    const created = diagram.nodes[diagram.nodes.length - 1].id;
    render();
    applySelection(created);
  }

  for (const button of panelEl.querySelectorAll('[data-diagram-shape]')) {
    const shape = button.dataset.diagramShape;
    if (!NODE_SHAPES.includes(shape)) continue;
    button.addEventListener('click', () => insertShape(shape));
  }

  find('seed-flowchart')?.addEventListener('click', () => seedWith(SEED_TEMPLATES.flowchart));
  find('seed-block')?.addEventListener('click', () => seedWith(SEED_TEMPLATES.block));

  // Las plantillas están dibujadas a la medida del lienzo, así que NO se
  // reencuadran: hacerlo movería y escalaría el diagrama nada más sembrarlo,
  // que parece un fallo. El encuadre automático se reserva para reabrir un
  // diagrama existente, cuyo tamaño no se conoce de antemano.
  function seedWith(templateFn) {
    diagram = templateFn();
    selectedId = null;
    render();
  }

  const connectButtonEl = find('connect');
  connectButtonEl?.addEventListener('click', () => {
    connectMode = !connectMode;
    connectFrom = null;
    // Sin modificador `--active` propio: reutiliza `--primary`/`--ghost`, ya
    // existentes, para no añadir una variante de botón nueva solo para esto.
    connectButtonEl.classList.toggle('button--primary', connectMode);
    connectButtonEl.classList.toggle('button--ghost', !connectMode);
    setHint(connectMode ? t('diagram.connectHint') : t('diagram.defaultHint'));
  });

  function deleteSelected() {
    if (!selectedId) return;
    diagram = removeNode(diagram, selectedId);
    selectedId = null;
    render();
    syncColorSelection();
  }

  find('delete')?.addEventListener('click', deleteSelected);

  // Suprimir borra el nodo elegido, salvo mientras se escribe dentro de una
  // etiqueta — ahí la tecla es para el texto, no para el nodo.
  panelEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Delete' || event.target.closest('.diagram-node__label')) return;
    event.preventDefault();
    deleteSelected();
  });

  find('zoom-in')?.addEventListener('click', () => setZoom(zoom * 1.2));
  find('zoom-out')?.addEventListener('click', () => setZoom(zoom / 1.2));
  find('zoom-fit')?.addEventListener('click', fitToContent);

  find('insert')?.addEventListener('click', () => {
    const view = getView();
    if (!view || diagram.nodes.length === 0) return;

    const docText = view.state.doc.toString();
    const needsImport = !hasCetzImport(docText);
    const importText = '#import "@preview/cetz:0.5.2"\n\n';
    const code = diagramToCetzCode(diagram);
    const { from, to } = view.state.selection.main;

    const insertion = (from === 0 ? '' : docText[from - 1] === '\n' ? '\n' : '\n\n') + code + '\n';
    const changes = [];
    let offsetChars = 0;
    if (needsImport && from === 0) {
      changes.push({ from: 0, to, insert: importText + code + '\n\n' });
    } else {
      if (needsImport) {
        changes.push({ from: 0, to: 0, insert: importText });
        offsetChars = importText.length;
      }
      changes.push({ from, to, insert: insertion });
    }
    view.dispatch({ changes, selection: { anchor: from + offsetChars + insertion.length } });
    view.focus();
    panel.close();
  });

  buildColorSwatches();

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
      zoom = 1;
      offset = { x: 0, y: 0 };
      connectButtonEl?.classList.add('button--ghost');
      connectButtonEl?.classList.remove('button--primary');
      setHint(existing ? t('diagram.editingExisting') : t('diagram.defaultHint'));

      const rect = triggerEl.getBoundingClientRect();
      panelEl.style.top = `${rect.bottom + 6}px`;
      panelEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 680, rect.left))}px`;
      panelEl.style.right = 'auto';
      panelEl.style.transform = 'none';
      render();
      applyViewport();
      syncColorSelection();
      if (existing) fitToContent();
      panel.open();
    },
    close: panel.close,
  };
}
