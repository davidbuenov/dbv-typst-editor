// =============================================================================
// DBV Typst Editor — Modelo puro del asistente de diagramas de Gantt (RF-49)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Paquete elegido en `/build` (spike de comparación real, memory.md
// ADR-DECISION-005), corrigiendo la preferencia de `/plan` (que había
// apuntado a Timeliney solo por licencia): Gantty trabaja con FECHAS REALES
// (`"2026-01-05"`, verificado leyendo `datetime.typ` del propio paquete —
// acepta directamente una cadena ISO, sin construir un `datetime(...)`),
// mientras que Timeliney trabaja con coordenadas numéricas abstractas sobre
// las que el propio documento tiene que dibujar encabezados con sentido. Para
// un asistente con "elige fecha de inicio y de fin" (los "cuatro datos" que
// ya es la filosofía del resto de esta app), fechas reales es la elección
// correcta — la licencia (LGPL, misma familia que `cetz`) no era el criterio
// que debía decidir esto.
//
// La firma real de `gantty:0.5.1` — `gantt(diccionario, drawer: ...)` — se
// verificó leyendo `src/gantt.typ` del propio paquete: acepta un DICCIONARIO
// Typst normal, no solo el resultado de `yaml(...)` que muestra el README
// (`yaml()` simplemente produce ese mismo diccionario a partir de un fichero
// — el diccionario escrito a mano vale igual). Sintaxis compilada de humo
// contra el binario real antes de fijarla.

import { escapeTypstString } from './typstEscape.js';

const GANTT_SPEC = '@preview/gantty:0.5.1';

export function createEmptyGanttChart() {
  return { tasks: [] };
}

/** Añade una tarea; una sin nombre o sin las dos fechas no se añade. */
export function addTask(chart, name, start, end) {
  const trimmed = name.trim();
  if (!trimmed || !start || !end) return chart;
  return { tasks: [...chart.tasks, { name: trimmed, start, end }] };
}

export function removeTask(chart, index) {
  return { tasks: chart.tasks.filter((_, i) => i !== index) };
}

/**
 * Traduce el modelo a una llamada `#gantt((...))` legible.
 * @returns {string | null} `null` sin ninguna tarea.
 */
export function ganttChartToCode(chart) {
  if (chart.tasks.length === 0) return null;

  const tasks = chart.tasks
    .map(
      (task) =>
        `    (\n      name: "${escapeTypstString(task.name)}",\n      intervals: ((start: "${task.start}", end: "${task.end}"),),\n    ),`,
    )
    .join('\n');

  return [
    '#gantt((',
    '  show-today: true,',
    '  headers: ("month", "week"),',
    '  tasks: (',
    tasks,
    '  ),',
    '))',
  ].join('\n');
}

export function hasGanttyImport(docText) {
  return /#import\s+["']@preview\/gantty[:0-9.]*["']/.test(docText);
}

export function ganttyImportLine() {
  return `#import "${GANTT_SPEC}": gantt`;
}
