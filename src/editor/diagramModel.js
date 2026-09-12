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

/**
 * Formas disponibles para un nodo. Los cuatro nombres se corresponden con
 * primitivas distintas de `cetz.draw` (ver `shapeToCetz`), no con variantes
 * de estilo de la misma: el rombo, por ejemplo, es un `line(..., close: true)`
 * de cuatro puntos porque CeTZ no trae una primitiva de rombo.
 */
export const NODE_SHAPES = ['rect', 'round', 'ellipse', 'diamond', 'triangle', 'hexagon'];

/**
 * Dirección de una conexión. Los cuatro valores se traducen al argumento
 * `mark` de `cetz.draw.line` (verificado contra el compilador real): `end` es
 * una punta al final, `start` al principio, `both` en los dos extremos, y
 * `none` una línea sin puntas, para relaciones sin sentido de lectura.
 */
export const EDGE_DIRECTIONS = ['end', 'start', 'both', 'none'];

/** Trazo de una conexión: continuo, o discontinuo para relaciones opcionales. */
export const EDGE_STYLES = ['solid', 'dashed'];

/**
 * Paleta de colores. Cada entrada lleva su pareja relleno/trazo ya emparejada
 * en vez de dejar elegir los dos por separado: un selector libre de color
 * produce diagramas ilegibles (relleno oscuro con trazo oscuro), y una paleta
 * corta de parejas con contraste comprobado no.
 */
export const NODE_COLORS = [
  { id: 'blue', fill: '#dbeafe', stroke: '#1d4ed8' },
  { id: 'green', fill: '#dcfce7', stroke: '#15803d' },
  { id: 'amber', fill: '#fef3c7', stroke: '#b45309' },
  { id: 'purple', fill: '#f3e8ff', stroke: '#7e22ce' },
  { id: 'rose', fill: '#ffe4e6', stroke: '#be123c' },
  { id: 'plain', fill: '#ffffff', stroke: '#334155' },
];

const DEFAULT_COLOR = 'blue';
const DEFAULT_SHAPE = 'rect';

/**
 * Resuelve el color de un nodo, tolerando modelos antiguos (sin campo
 * `color`) y valores desconocidos — un diagrama guardado con una versión
 * anterior se reabre igual, con el color por defecto, en vez de romperse.
 */
export function colorOf(node) {
  return NODE_COLORS.find((c) => c.id === node.color) ?? NODE_COLORS.find((c) => c.id === DEFAULT_COLOR);
}

/** Misma tolerancia que `colorOf`, para la forma. */
export function shapeOf(node) {
  return NODE_SHAPES.includes(node.shape) ? node.shape : DEFAULT_SHAPE;
}

/** @returns {{nodes: Array, edges: Array, nextId: number}} */
export function createEmptyDiagram() {
  return { nodes: [], edges: [], nextId: 1, caption: '', label: '' };
}

/**
 * @param {object} diagram
 * @param {{x?: number, y?: number, w?: number, h?: number, label?: string, shape?: string, color?: string}} [opts]
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
    shape: NODE_SHAPES.includes(opts.shape) ? opts.shape : DEFAULT_SHAPE,
    color: NODE_COLORS.some((c) => c.id === opts.color) ? opts.color : DEFAULT_COLOR,
  };
  return { ...diagram, nodes: [...diagram.nodes, node], nextId: diagram.nextId + 1 };
}

export function moveNode(diagram, id, x, y) {
  return { ...diagram, nodes: diagram.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)) };
}

export function renameNode(diagram, id, label) {
  return { ...diagram, nodes: diagram.nodes.map((node) => (node.id === id ? { ...node, label } : node)) };
}

/** Cambia la forma de un nodo; un nombre desconocido deja el diagrama intacto. */
export function setNodeShape(diagram, id, shape) {
  if (!NODE_SHAPES.includes(shape)) return diagram;
  return { ...diagram, nodes: diagram.nodes.map((node) => (node.id === id ? { ...node, shape } : node)) };
}

/** Cambia el color de un nodo; un color fuera de la paleta deja el diagrama intacto. */
export function setNodeColor(diagram, id, color) {
  if (!NODE_COLORS.some((c) => c.id === color)) return diagram;
  return { ...diagram, nodes: diagram.nodes.map((node) => (node.id === id ? { ...node, color } : node)) };
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
  return {
    ...diagram,
    edges: [...diagram.edges, { from, to, dir: 'end', style: 'solid', label: '' }],
  };
}

export function removeEdge(diagram, from, to) {
  return { ...diagram, edges: diagram.edges.filter((edge) => !(edge.from === from && edge.to === to)) };
}

/** Misma tolerancia con modelos antiguos que `colorOf`/`shapeOf`, para las conexiones. */
export function directionOf(edge) {
  return EDGE_DIRECTIONS.includes(edge.dir) ? edge.dir : 'end';
}

export function styleOf(edge) {
  return EDGE_STYLES.includes(edge.style) ? edge.style : 'solid';
}

/** Cambia una propiedad de una conexión concreta, validando el valor. */
function patchEdge(diagram, from, to, patch) {
  return {
    ...diagram,
    edges: diagram.edges.map((edge) => (edge.from === from && edge.to === to ? { ...edge, ...patch } : edge)),
  };
}

export function setEdgeDirection(diagram, from, to, dir) {
  if (!EDGE_DIRECTIONS.includes(dir)) return diagram;
  return patchEdge(diagram, from, to, { dir });
}

export function setEdgeStyle(diagram, from, to, style) {
  if (!EDGE_STYLES.includes(style)) return diagram;
  return patchEdge(diagram, from, to, { style });
}

/** Texto sobre la conexión — el "sí"/"no" que sale de un rombo de decisión. */
export function setEdgeLabel(diagram, from, to, label) {
  return patchEdge(diagram, from, to, { label });
}

/**
 * Pie de la figura y etiqueta de referencia (`<fig:...>`), para poder citarla
 * con `@fig:...` desde el texto. Viajan dentro del modelo serializado, así que
 * sobreviven a cerrar y reabrir el diagrama.
 */
export function setCaption(diagram, caption) {
  return { ...diagram, caption };
}

export function setLabel(diagram, label) {
  return { ...diagram, label };
}

/** Escapa el texto de un nodo para que un nombre con corchetes/comillas no rompa el marcado Typst. */
function escapeTypstContent(label) {
  return label.replace(/([\[\]#])/g, '\\$1');
}

/**
 * Traduce un nodo a la primitiva de `cetz.draw` que le toca. Las coordenadas
 * llegan ya convertidas a unidades CeTZ y con la Y invertida — aquí solo se
 * decide la forma. Verificado compilando las cuatro contra typst 0.15.1 +
 * `@preview/cetz:0.5.2`: las flechas se recortan solas al borde de la forma
 * con nombre, sea cual sea, así que el rombo y la elipse conectan igual de
 * bien que el rectángulo.
 */
function shapeToCetz(node, { x0, x1, y0, y1 }) {
  const { fill, stroke } = colorOf(node);
  const style = `name: "${node.id}", fill: rgb("${fill}"), stroke: rgb("${stroke}")`;
  const cx = Math.round(((x0 + x1) / 2) * 100) / 100;
  const cy = Math.round(((y0 + y1) / 2) * 100) / 100;

  switch (shapeOf(node)) {
    case 'round':
      return `rect((${x0}, ${y0}), (${x1}, ${y1}), radius: 0.3, ${style})`;
    case 'ellipse':
      return `circle((${cx}, ${cy}), radius: (${Math.round(((x1 - x0) / 2) * 100) / 100}, ${Math.round(((y1 - y0) / 2) * 100) / 100}), ${style})`;
    case 'diamond':
      // CeTZ no trae primitiva de rombo: cuatro puntos (arriba, derecha,
      // abajo, izquierda) cerrados sobre sí mismos. Lo mismo vale para el
      // triángulo y el hexágono de abajo.
      return `line((${cx}, ${y1}), (${x1}, ${cy}), (${cx}, ${y0}), (${x0}, ${cy}), close: true, ${style})`;
    case 'triangle':
      return `line((${cx}, ${y1}), (${x1}, ${y0}), (${x0}, ${y0}), close: true, ${style})`;
    case 'hexagon': {
      // Hexágono apaisado: lados planos arriba y abajo, puntas a izquierda y
      // derecha — la forma habitual para "entrada/salida" en un diagrama de
      // flujo. Los vértices laterales se meten un cuarto del ancho.
      const inset = Math.round(((x1 - x0) / 4) * 100) / 100;
      const left = Math.round((x0 + inset) * 100) / 100;
      const right = Math.round((x1 - inset) * 100) / 100;
      return `line((${left}, ${y1}), (${right}, ${y1}), (${x1}, ${cy}), (${right}, ${y0}), (${left}, ${y0}), (${x0}, ${cy}), close: true, ${style})`;
    }
    default:
      return `rect((${x0}, ${y0}), (${x1}, ${y1}), ${style})`;
  }
}

/**
 * Fracción de la caja del nodo en la que cabe el texto sin salirse de la
 * silueta: un rectángulo la aprovecha entera, pero en una elipse o un rombo
 * las esquinas no existen, así que el texto se encaja en el rectángulo
 * inscrito. Valores comprobados compilando etiquetas largas contra el
 * compilador real.
 */
const LABEL_INSET = {
  rect: { w: 1, h: 1 },
  round: { w: 0.94, h: 0.94 },
  ellipse: { w: 0.7, h: 0.75 },
  diamond: { w: 0.6, h: 0.5 },
  // El rectángulo inscrito en un triángulo vive pegado a la base, no centrado:
  // de ahí el desplazamiento hacia abajo además del encogimiento.
  triangle: { w: 0.62, h: 0.45, shiftY: -0.2 },
  hexagon: { w: 0.85, h: 0.9 },
};

/**
 * Coloca la etiqueta de un nodo.
 *
 * Se le pasan DOS coordenadas, no el nombre de la forma: con el nombre, CeTZ
 * centra el texto en el ancla y lo deja desbordarse por los lados en cuanto es
 * largo (comprobado: "Validar credenciales del usuario" se salía del
 * rectángulo por ambos extremos). Con dos coordenadas lo encaja dentro de la
 * caja, partiéndolo en líneas; el `align(center + horizon)` es lo que lo
 * vuelve a centrar dentro de esa caja, porque encajado sin más queda pegado
 * arriba a la izquierda.
 */
function labelToCetz(node, { x0, x1, y0, y1 }) {
  const inset = LABEL_INSET[shapeOf(node)] ?? LABEL_INSET.rect;
  const round = (value) => Math.round(value * 100) / 100;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2 + (y1 - y0) * (inset.shiftY ?? 0);
  const halfW = ((x1 - x0) / 2) * inset.w;
  const halfH = ((y1 - y0) / 2) * inset.h;
  const body = `align(center + horizon)[${escapeTypstContent(node.label)}]`;
  return `content((${round(cx - halfW)}, ${round(cy - halfH)}), (${round(cx + halfW)}, ${round(cy + halfH)}), padding: 0.1, ${body})`;
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
    const shape = shapeToCetz(node, { x0, x1, y0, y1 });
    return `    ${shape}\n    ${labelToCetz(node, { x0, x1, y0, y1 })}`;
  });

  const lines = diagram.edges.flatMap((edge) => edgeToCetz(edge));

  const model = JSON.stringify(diagram);
  const caption = escapeTypstContent(diagram.caption?.trim() || 'Diagrama');
  // El `<fig:...>` va PEGADO al cierre del `#figure`, sin salto de línea: con
  // una línea en medio Typst lo toma como etiqueta del párrafo siguiente y
  // `@fig:...` deja de resolver.
  const label = diagram.label?.trim() ? ` <${diagram.label.trim()}>` : '';

  return `#figure(
  cetz.canvas({
    // dbv-diagram-model: ${model}
    import cetz.draw: *
${rects.join('\n')}
${lines.join('\n')}
  }),
  caption: [${caption}],
)${label}`;
}

/**
 * Traduce una conexión a una o dos instrucciones de `cetz.draw`: la línea, y
 * la etiqueta si la tiene.
 *
 * La etiqueta se coloca en `("origen", 50%, "destino")` — un PORCENTAJE, no
 * el número `0.5`: comprobado contra el compilador real, un número plano se
 * interpreta como una distancia en unidades de lienzo, así que la etiqueta
 * aparecía a medio centímetro del origen, encima de la propia caja, en vez de
 * a mitad de camino. El `box(fill: white)` es lo que abre un hueco en la
 * línea para que el texto se lea encima.
 */
function edgeToCetz(edge) {
  const direction = directionOf(edge);
  const args = [`"${edge.from}"`, `"${edge.to}"`];

  if (direction === 'both') args.push('mark: (start: ">", end: ">")');
  else if (direction !== 'none') args.push(`mark: (${direction}: ">")`);

  if (styleOf(edge) === 'dashed') args.push('stroke: (dash: "dashed")');

  const instructions = [`    line(${args.join(', ')})`];

  const label = edge.label?.trim();
  if (label) {
    instructions.push(
      `    content(("${edge.from}", 50%, "${edge.to}"), box(fill: white, inset: 2pt)[${escapeTypstContent(label)}])`,
    );
  }
  return instructions;
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
