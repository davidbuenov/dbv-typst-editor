// =============================================================================
// DBV Typst Editor — Test del modelo de diagramas de Gantt (RF-49)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  addTask,
  createEmptyGanttChart,
  ganttChartToCode,
  ganttyImportLine,
  hasGanttyImport,
  removeTask,
} from './ganttModel.js';

describe('addTask', () => {
  it('añade una tarea con nombre y las dos fechas', () => {
    const chart = addTask(createEmptyGanttChart(), 'Investigación', '2026-01-05', '2026-01-20');
    expect(chart.tasks).toEqual([{ name: 'Investigación', start: '2026-01-05', end: '2026-01-20' }]);
  });

  it('ignora una tarea sin nombre', () => {
    const chart = addTask(createEmptyGanttChart(), '  ', '2026-01-05', '2026-01-20');
    expect(chart.tasks).toEqual([]);
  });

  it('ignora una tarea sin fecha de inicio o de fin', () => {
    expect(addTask(createEmptyGanttChart(), 'x', '', '2026-01-20').tasks).toEqual([]);
    expect(addTask(createEmptyGanttChart(), 'x', '2026-01-05', '').tasks).toEqual([]);
  });
});

describe('removeTask', () => {
  it('retira la tarea del índice indicado', () => {
    let chart = addTask(createEmptyGanttChart(), 'A', '2026-01-01', '2026-01-05');
    chart = addTask(chart, 'B', '2026-01-05', '2026-01-10');
    chart = removeTask(chart, 0);
    expect(chart.tasks).toEqual([{ name: 'B', start: '2026-01-05', end: '2026-01-10' }]);
  });
});

describe('ganttChartToCode', () => {
  it('sin tareas no hay nada que insertar', () => {
    expect(ganttChartToCode(createEmptyGanttChart())).toBeNull();
  });

  it('emite una tarea por entrada, con sus fechas', () => {
    let chart = addTask(createEmptyGanttChart(), 'Investigación', '2026-01-05', '2026-01-20');
    chart = addTask(chart, 'Redacción', '2026-01-20', '2026-02-10');

    const code = ganttChartToCode(chart);
    expect(code).toContain('#gantt((');
    expect(code).toContain('name: "Investigación"');
    expect(code).toContain('start: "2026-01-05", end: "2026-01-20"');
    expect(code).toContain('name: "Redacción"');
  });

  it('escapa comillas dentro del nombre de una tarea', () => {
    const chart = addTask(createEmptyGanttChart(), 'Fase "final"', '2026-01-01', '2026-01-05');
    expect(ganttChartToCode(chart)).toContain('name: "Fase \\"final\\""');
  });
});

describe('hasGanttyImport / ganttyImportLine', () => {
  it('detecta el import ya presente', () => {
    expect(hasGanttyImport('#import "@preview/gantty:0.5.1": gantt')).toBe(true);
  });

  it('no confunde otro paquete', () => {
    expect(hasGanttyImport('#import "@preview/chronos:0.3.0"')).toBe(false);
  });

  it('devuelve la línea de import esperada', () => {
    expect(ganttyImportLine()).toBe('#import "@preview/gantty:0.5.1": gantt');
  });
});
