// =============================================================================
// DBV Typst Editor — Modelo de datos del editor WYSIWYG de diagramas (RF-31)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Sustituye al asistente de plantillas de código CeTZ (RF-23, `cetzAssistant.js`)
// por manipulación directa: el usuario arrastra y conecta nodos sobre un lienzo,
// y ESTE módulo traduce ese modelo a código CeTZ, no al revés — al contrario que
// el asistente anterior, que solo insertaba plantillas de texto ya escritas.
//
// Alcance reducido de esta primera pasada (decisión del usuario, 2026-09-11):
// un único lienzo genérico de nodos rectangulares conectados por flechas cubre
// tanto "diagrama de flujo" como "diagrama de bloques" del asistente anterior
// — la distinción entre esos dos tipos solo tenía sentido para plantillas de
// código fijas; en un lienzo de manipulación libre es la misma herramienta.
// Gráficas de funciones 2D y lienzo libre quedan para una iteración posterior.
//
// Funciones puras sobre un objeto `diagram` inmutable, mismo patrón que
// `toolbarActions.js` (`buildTransaction(state) -> spec`, sin DOM ni
// `EditorView`) — testeable sin montar el lienzo.

/** Constante de escala: 40px de lienzo = 1 unidad CeTZ (coordenadas razonables sin decimales largos). */
const CETZ_UNIT = 40;

/** @returns {{nodes: Array, edges: Array, nextId: number}} */
export function createEmptyDiagram() {
  return { nodes: [], edges: [], nextId: 1 };
}

/**
 * @param {object} diagram
 * @param {{x?: number, y?: number, w?: number, h?: number, label?: string}} [opts]
 */
export function addNode(diagram, opts = {}) {
  const id = `n${diagram.nextId}`;
  const node = {
    id,
    x: opts.x ?? 40,
    y: opts.y ?? 40,
    w: opts.w ?? 140,
    h: opts.h ?? 60,
    label: opts.label ?? 'Nodo',
  };
  return { ...diagram, nodes: [...diagram.nodes, node], nextId: diagram.nextId + 1 };
}

export function moveNode(diagram, id, x, y) {
  return { ...diagram, nodes: diagram.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)) };
}

export function renameNode(diagram, id, label) {
  return { ...diagram, nodes: diagram.nodes.map((node) => (node.id === id ? { ...node, label } : node)) };
}

/** Retira un nodo y cualquier conexión que lo mencionara — nunca deja una flecha colgando de un nodo borrado. */
export function removeNode(diagram, id) {
  return {
    ...diagram,
    nodes: diagram.nodes.filter((node) => node.id !== id),
    edges: diagram.edges.filter((edge) => edge.from !== id && edge.to !== id),
  };
}

/** Añade una conexión, sin duplicar la misma pareja ni permitir un nodo consigo mismo. */
export function addEdge(diagram, from, to) {
  if (from === to) return diagram;
  if (diagram.edges.some((edge) => edge.from === from && edge.to === to)) return diagram;
  return { ...diagram, edges: [...diagram.edges, { from, to }] };
}

export function removeEdge(diagram, from, to) {
  return { ...diagram, edges: diagram.edges.filter((edge) => !(edge.from === from && edge.to === to)) };
}

/** Escapa el texto de un nodo para que un nombre con corchetes/comillas no rompa el marcado Typst. */
function escapeTypstContent(label) {
  return label.replace(/([\[\]#])/g, '\\$1');
}

/**
 * Traduce el modelo a un bloque `cetz.canvas` legible, con el modelo
 * serializado en un comentario propio para poder reabrirlo (ver
 * `extractDiagramModelNear`). Coordenadas convertidas a unidades CeTZ e
 * invertidas en Y (el lienzo crece hacia abajo, CeTZ hacia arriba).
 */
export function diagramToCetzCode(diagram) {
  const toUnit = (px) => Math.round((px / CETZ_UNIT) * 100) / 100;
  const maxY = diagram.nodes.reduce((max, node) => Math.max(max, node.y + node.h), 0);

  const rects = diagram.nodes.map((node) => {
    const x0 = toUnit(node.x);
    const x1 = toUnit(node.x + node.w);
    const y0 = toUnit(maxY - (node.y + node.h));
    const y1 = toUnit(maxY - node.y);
    return `    rect((${x0}, ${y0}), (${x1}, ${y1}), name: "${node.id}")\n    content("${node.id}", [${escapeTypstContent(node.label)}])`;
  });

  const lines = diagram.edges.map((edge) => `    line("${edge.from}", "${edge.to}", mark: (end: ">"))`);

  const model = JSON.stringify(diagram);
  return `#figure(
  cetz.canvas({
    // dbv-diagram-model: ${model}
    import cetz.draw: *
${rects.join('\n')}
${lines.join('\n')}
  }),
  caption: [Diagrama],
)`;
}

/**
 * Busca el modelo serializado más cercano ANTES del cursor, dentro de una
 * distancia razonable (mismo bloque `cetz.canvas`, no todo el documento) —
 * así un diagrama insertado por este editor se puede reabrir, y uno de CeTZ
 * escrito a mano (sin el comentario) nunca se ofrece como reabrible (RF-31.3).
 * @param {string} docText
 * @param {number} cursorPos
 * @returns {object | null}
 */
export function extractDiagramModelNear(docText, cursorPos) {
  const marker = '// dbv-diagram-model: ';
  const before = docText.slice(0, cursorPos);
  const after = docText.slice(cursorPos);

  const lastBefore = before.lastIndexOf(marker);
  const firstAfter = after.indexOf(marker);

  // El más cercano de los dos lados, dentro de una ventana de 2000 caracteres
  // (el tamaño de un bloque de diagrama típico) — no todo el documento, para
  // no "reabrir" un diagrama que está en un capítulo completamente distinto.
  const candidates = [];
  if (lastBefore !== -1 && cursorPos - lastBefore < 2000) candidates.push(lastBefore);
  if (firstAfter !== -1 && firstAfter < 2000) candidates.push(cursorPos + firstAfter);

  if (candidates.length === 0) return null;

  const closest = candidates.sort((a, b) => Math.abs(a - cursorPos) - Math.abs(b - cursorPos))[0];
  const lineEnd = docText.indexOf('\n', closest);
  const jsonText = docText.slice(closest + marker.length, lineEnd === -1 ? undefined : lineEnd).trim();

  try {
    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return parsed;
  } catch {
    return null;
  }
}
