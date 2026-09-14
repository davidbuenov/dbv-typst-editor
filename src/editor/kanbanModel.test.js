// =============================================================================
// DBV Typst Editor — Test del modelo de tableros Kanban (RF-50)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  addCard,
  addColumn,
  boardToKantanCode,
  createEmptyBoard,
  hasKantanImport,
  kantanImportLine,
  removeCard,
  removeColumn,
} from './kanbanModel.js';

describe('addColumn', () => {
  it('añade una columna con nombre', () => {
    const board = addColumn(createEmptyBoard(), 'Backlog');
    expect(board.columns).toEqual([{ name: 'Backlog', cards: [] }]);
  });

  it('ignora una columna sin nombre', () => {
    expect(addColumn(createEmptyBoard(), '   ').columns).toEqual([]);
  });
});

describe('removeColumn', () => {
  it('retira la columna del índice indicado', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addColumn(board, 'Hecho');
    board = removeColumn(board, 0);
    expect(board.columns).toEqual([{ name: 'Hecho', cards: [] }]);
  });
});

describe('addCard', () => {
  it('añade una tarjeta con nombre a la columna indicada', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addCard(board, 0, { name: 'Tarea 1' });
    expect(board.columns[0].cards).toEqual([{ name: 'Tarea 1', assignee: '', hardness: '1', priority: '' }]);
  });

  it('acepta asignado, dificultad y prioridad', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addCard(board, 0, { name: 'Tarea 1', assignee: 'David', hardness: '5', priority: 'alta' });
    expect(board.columns[0].cards[0]).toEqual({ name: 'Tarea 1', assignee: 'David', hardness: '5', priority: 'alta' });
  });

  it('ignora una tarjeta sin nombre', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addCard(board, 0, { name: '   ' });
    expect(board.columns[0].cards).toEqual([]);
  });

  it('ignora una tarjeta destinada a una columna que no existe', () => {
    const board = addCard(createEmptyBoard(), 0, { name: 'Tarea 1' });
    expect(board.columns).toEqual([]);
  });
});

describe('removeCard', () => {
  it('retira la tarjeta del índice indicado dentro de su columna', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addCard(board, 0, { name: 'A' });
    board = addCard(board, 0, { name: 'B' });
    board = removeCard(board, 0, 0);
    expect(board.columns[0].cards).toEqual([{ name: 'B', assignee: '', hardness: '1', priority: '' }]);
  });
});

describe('boardToKantanCode', () => {
  it('sin columnas no hay nada que insertar', () => {
    expect(boardToKantanCode(createEmptyBoard())).toBeNull();
  });

  it('emite siempre font: y stroke: explícitos (landmines del spike de /plan)', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addCard(board, 0, { name: 'Tarea 1' });
    const code = boardToKantanCode(board);
    expect(code).toContain('font: "Libertinus Serif"');
    expect(code).toContain('stroke: rgb("#999999")');
  });

  it('una tarjeta sin asignado emite un solo bloque de contenido', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addCard(board, 0, { name: 'Tarea sin asignar' });
    const code = boardToKantanCode(board);
    expect(code).toContain('kanban-item(1, "", stroke: rgb("#999999"))[Tarea sin asignar]');
  });

  it('una tarjeta con asignado emite el bloque de asignado ANTES que el de nombre', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addCard(board, 0, { name: 'Tarea con asignado', assignee: 'David' });
    const code = boardToKantanCode(board);
    expect(code).toContain('kanban-item(1, "", stroke: rgb("#999999"))[David][Tarea con asignado]');
  });

  it('una dificultad numérica se emite sin comillas', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addCard(board, 0, { name: 'x', hardness: '8' });
    expect(boardToKantanCode(board)).toContain('kanban-item(8, ');
  });

  it('una dificultad no numérica se emite entre comillas para no romper la compilación', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addCard(board, 0, { name: 'x', hardness: 'XL' });
    expect(boardToKantanCode(board)).toContain('kanban-item("XL", ');
  });

  it('rota la paleta de colores por índice de columna', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addColumn(board, 'En curso');
    board = addColumn(board, 'Testing');
    board = addColumn(board, 'Hecho');
    board = addColumn(board, 'Quinta');
    const code = boardToKantanCode(board);
    expect(code).toContain('"Backlog", color: red');
    expect(code).toContain('"En curso", color: yellow');
    expect(code).toContain('"Testing", color: aqua');
    expect(code).toContain('"Hecho", color: green');
    expect(code).toContain('"Quinta", color: red');
  });

  it('escapa corchetes en el nombre de una tarjeta (contenido, no cadena)', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addCard(board, 0, { name: 'Tarea [urgente]' });
    expect(boardToKantanCode(board)).toContain('[Tarea \\[urgente\\]]');
  });

  it('escapa corchetes también en el nombre del asignado, no solo en el de la tarjeta', () => {
    let board = addColumn(createEmptyBoard(), 'Backlog');
    board = addCard(board, 0, { name: 'Tarea', assignee: 'David [equipo A]' });
    expect(boardToKantanCode(board)).toContain('[David \\[equipo A\\]][Tarea]');
  });

  it('escapa comillas en el nombre de una columna', () => {
    const board = addColumn(createEmptyBoard(), 'Fase "final"');
    expect(boardToKantanCode(board)).toContain('"Fase \\"final\\""');
  });

  it('una columna sin tarjetas no rompe la generación', () => {
    const board = addColumn(createEmptyBoard(), 'Backlog vacío');
    const code = boardToKantanCode(board);
    expect(code).toContain('kanban-column("Backlog vacío", color: red,)');
  });
});

describe('hasKantanImport / kantanImportLine', () => {
  it('detecta el import ya presente', () => {
    expect(hasKantanImport('#import "@preview/kantan:0.1.0": *')).toBe(true);
  });

  it('no confunde otro paquete', () => {
    expect(hasKantanImport('#import "@preview/gantty:0.5.1"')).toBe(false);
  });

  it('devuelve la línea de import esperada', () => {
    expect(kantanImportLine()).toBe('#import "@preview/kantan:0.1.0": *');
  });
});
