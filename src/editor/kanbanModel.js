// =============================================================================
// DBV Typst Editor — Modelo puro del asistente de tableros Kanban (RF-50)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Paquete elegido en `/spec` (SPECIFICATIONS.md §5g v1.9) y verificado contra
// el registro real de Typst Universe: `@preview/kantan:0.1.0` (única versión
// publicada, licencia AGPL-3.0-only — ver `ADR-DECISION-006` en `memory.md`
// para la nota de transparencia sobre esa licencia).
//
// Dos landmines reales encontrados en el spike de `/plan` (implementation_plan.md
// §6.1), ninguno señalado por el propio README del paquete:
//   1. `kanban-item` sin `stroke:` explícito ROMPE la compilación siempre — su
//      valor por defecto (`0.05em`, un largo) hace que el código interno de
//      `lib.typ` acabe pasando `auto` a un parámetro `fill:` que no lo admite.
//   2. `kanban()` sin `font:` explícito TAMBIÉN rompe ("font fallback list
//      must not be empty") — su valor por defecto es un array vacío.
// Por eso `boardToKantanCode` emite SIEMPRE ambos, nunca dejándolos al valor
// por defecto del paquete.
//
// Mismo reparto que `sequenceModel.js`/`ganttModel.js`: funciones puras sobre
// un objeto `board` inmutable, sin DOM — `kanbanEditor.js` es el cableado fino
// encima. A diferencia del lienzo de RF-31, un tablero Kanban se describe bien
// con dos listas anidadas (columnas, y dentro de cada una sus tarjetas) — el
// mismo criterio de "asistente de formulario, no lienzo" que ya justificó
// RF-48 (`ADR-DECISION-004`).

import { escapeTypstContent, escapeTypstString } from './typstEscape.js';

const KANTAN_SPEC = '@preview/kantan:0.1.0';

/**
 * Paleta fija rotando por índice de columna, sin selector de color para el
 * usuario — mismo criterio de "cuatro datos" que ya prefirió Gantty sobre
 * Timeliney (`ADR-DECISION-005`): un tablero con 3-5 columnas no necesita una
 * superficie más para elegir su color, y las propias tarjetas ya llevan color
 * de dificultad/prioridad codificado por el paquete. Colores tomados del
 * propio ejemplo del README de Kantan.
 */
const COLUMN_COLORS = ['red', 'yellow', 'aqua', 'green'];

/** Trazo fijo de toda tarjeta — ver landmine 1 de la cabecera: nunca se omite. */
const CARD_STROKE = 'rgb("#999999")';

/** Fuente fija del tablero — ver landmine 2: la única que el binario vendorizado trae embebida bajo este nombre exacto (`typst fonts`), a diferencia de "Linux Libertine" que usan los ejemplos del propio README. */
const BOARD_FONT = 'Libertinus Serif';

export function createEmptyBoard() {
  return { columns: [] };
}

/** Añade una columna; ignora un nombre vacío. */
export function addColumn(board, name) {
  const trimmed = name.trim();
  if (!trimmed) return board;
  return { columns: [...board.columns, { name: trimmed, cards: [] }] };
}

export function removeColumn(board, columnIndex) {
  return { columns: board.columns.filter((_, i) => i !== columnIndex) };
}

/**
 * Añade una tarjeta a la columna `columnIndex`. Solo el nombre es obligatorio
 * — `assignee` es opcional (determina si la tarjeta emite 1 o 2 bloques de
 * contenido, ver `boardToKantanCode`), `hardness`/`priority` tienen valores
 * por defecto razonables para no exigir cuatro campos por cada tarjeta.
 */
export function addCard(board, columnIndex, { name, assignee = '', hardness = '1', priority = '' } = {}) {
  const trimmedName = name?.trim();
  if (!trimmedName || !board.columns[columnIndex]) return board;

  const card = { name: trimmedName, assignee: assignee.trim(), hardness: hardness.trim() || '1', priority: priority.trim() };
  return {
    columns: board.columns.map((column, i) =>
      i === columnIndex ? { ...column, cards: [...column.cards, card] } : column,
    ),
  };
}

export function removeCard(board, columnIndex, cardIndex) {
  return {
    columns: board.columns.map((column, i) =>
      i === columnIndex ? { ...column, cards: column.cards.filter((_, j) => j !== cardIndex) } : column,
    ),
  };
}

/** `hardness` es "cualquier cosa, normalmente un número" (README) — un número válido se emite sin comillas, cualquier otra cosa se trata como texto libre entre comillas para no romper la compilación con un identificador Typst inválido. */
function formatHardness(hardness) {
  const trimmed = hardness.trim();
  return trimmed !== '' && !Number.isNaN(Number(trimmed)) ? trimmed : `"${escapeTypstString(trimmed)}"`;
}

function cardToKantanCode(card) {
  const hardness = formatHardness(card.hardness);
  const priority = `"${escapeTypstString(card.priority)}"`;
  const nameBlock = `[${escapeTypstContent(card.name)}]`;
  const trailing = card.assignee ? `[${escapeTypstContent(card.assignee)}]${nameBlock}` : nameBlock;
  return `      kanban-item(${hardness}, ${priority}, stroke: ${CARD_STROKE})${trailing},`;
}

/**
 * Traduce el modelo a una llamada `#kanban(...)` legible.
 * @returns {string | null} `null` sin ninguna columna.
 */
export function boardToKantanCode(board) {
  if (board.columns.length === 0) return null;

  const columns = board.columns
    .map((column, index) => {
      const color = COLUMN_COLORS[index % COLUMN_COLORS.length];
      const items = column.cards.map(cardToKantanCode).join('\n');
      const body = items ? `\n${items}\n    ` : '';
      return `    kanban-column("${escapeTypstString(column.name)}", color: ${color},${body}),`;
    })
    .join('\n');

  return [`#kanban(`, `  font: "${BOARD_FONT}",`, columns, `)`].join('\n');
}

export function hasKantanImport(docText) {
  return /#import\s+["']@preview\/kantan[:0-9.]*["']/.test(docText);
}

export function kantanImportLine() {
  return `#import "${KANTAN_SPEC}": *`;
}
