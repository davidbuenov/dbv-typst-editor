// =============================================================================
// DBV Typst Editor — Tests del modelo de diagnósticos en línea (RF-59)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { Text } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import {
  ENGINE_SOURCE,
  countProblems,
  dedupeAgainstTinymist,
  mergeDiagnostics,
  offsetOf,
  toEditorDiagnostics,
  toProblemList,
} from './diagnosticsModel.js';

const doc = Text.of(['primera línea', 'segunda', 'tercera']);

const diag = (extra = {}) => ({
  level: 'error',
  message: 'unknown variable',
  hints: [],
  file: 'main.typ',
  startLine: 2,
  startColumn: 3,
  endLine: 2,
  endColumn: 6,
  ...extra,
});

describe('offsetOf', () => {
  it('convierte línea y columna 1-indexadas en el desplazamiento del documento', () => {
    expect(offsetOf(doc, 1, 1)).toBe(0);
    expect(offsetOf(doc, 2, 3)).toBe(doc.line(2).from + 2);
  });

  it('recorta una posición fuera del documento en vez de salirse', () => {
    expect(offsetOf(doc, 99, 1)).toBe(doc.line(3).from);
    expect(offsetOf(doc, 1, 500)).toBe(doc.line(1).to);
    expect(offsetOf(doc, 0, 0)).toBe(0);
  });
});

describe('toEditorDiagnostics', () => {
  it('convierte el rango, la gravedad y el origen', () => {
    const [result] = toEditorDiagnostics([diag()], 'main.typ', doc);

    expect(result).toEqual({
      from: doc.line(2).from + 2,
      to: doc.line(2).from + 5,
      severity: 'error',
      message: 'unknown variable',
      source: ENGINE_SOURCE,
    });
  });

  it('los avisos salen como warning', () => {
    expect(toEditorDiagnostics([diag({ level: 'warning' })], 'main.typ', doc)[0].severity).toBe('warning');
  });

  it('las pistas de Typst se añaden al mensaje', () => {
    const [result] = toEditorDiagnostics([diag({ hints: ['prueba con x'] })], 'main.typ', doc);

    expect(result.message).toBe('unknown variable\n• prueba con x');
  });

  it('solo se subrayan los diagnósticos del fichero abierto', () => {
    const list = [diag({ file: 'otro.typ' }), diag({ file: null }), diag()];

    expect(toEditorDiagnostics(list, 'main.typ', doc)).toHaveLength(1);
  });

  it('sin fichero abierto identificable no se subraya nada', () => {
    expect(toEditorDiagnostics([diag()], null, doc)).toEqual([]);
  });

  it('un rango invertido o vacío no rompe: to nunca queda antes de from', () => {
    const [result] = toEditorDiagnostics([diag({ endLine: 1, endColumn: 1 })], 'main.typ', doc);

    expect(result.to).toBeGreaterThanOrEqual(result.from);
  });
});

describe('dedupeAgainstTinymist', () => {
  const engine = { from: 10, to: 15, severity: 'error', message: 'a', source: 'Typst' };

  it('quita el del motor si Tinymist dice lo mismo sobre el mismo trozo', () => {
    const tinymist = [{ from: 10, to: 15, severity: 'error', message: 'a', source: 'Tinymist' }];

    expect(dedupeAgainstTinymist([engine], tinymist)).toEqual([]);
  });

  it('también si los rangos solo se solapan', () => {
    const tinymist = [{ from: 12, to: 30, severity: 'error', message: 'b', source: 'Tinymist' }];

    expect(dedupeAgainstTinymist([engine], tinymist)).toEqual([]);
  });

  it('se conserva si Tinymist no dice nada sobre ese trozo', () => {
    const tinymist = [{ from: 40, to: 45, severity: 'error', message: 'b', source: 'Tinymist' }];

    expect(dedupeAgainstTinymist([engine], tinymist)).toEqual([engine]);
  });

  it('se conserva si el trozo coincide pero la gravedad es distinta', () => {
    const tinymist = [{ from: 10, to: 15, severity: 'warning', message: 'b', source: 'Tinymist' }];

    expect(dedupeAgainstTinymist([engine], tinymist)).toEqual([engine]);
  });
});

describe('mergeDiagnostics', () => {
  it('con Tinymist apagado, todo lo que ve el motor se enseña (independiente de Tinymist)', () => {
    const engine = [{ from: 1, to: 2, severity: 'error', message: 'x', source: 'Typst' }];

    expect(mergeDiagnostics(engine, [])).toEqual(engine);
  });

  it('Tinymist primero y sin duplicados', () => {
    const tinymist = [{ from: 0, to: 5, severity: 'error', message: 't', source: 'Tinymist' }];
    const engine = [
      { from: 1, to: 2, severity: 'error', message: 'dup', source: 'Typst' },
      { from: 50, to: 55, severity: 'warning', message: 'solo motor', source: 'Typst' },
    ];

    expect(mergeDiagnostics(engine, tinymist).map((d) => d.message)).toEqual(['t', 'solo motor']);
  });
});

describe('toProblemList y countProblems', () => {
  const list = [diag({ level: 'warning', message: 'w' }), diag({ message: 'e' })];

  it('los errores van antes que los avisos y conserva el fichero y la línea', () => {
    const problems = toProblemList(list);

    expect(problems.map((p) => p.message)).toEqual(['e', 'w']);
    expect(problems[0]).toMatchObject({ file: 'main.typ', line: 2, column: 3 });
  });

  it('cuenta errores y avisos', () => {
    expect(countProblems(list)).toEqual({ errors: 1, warnings: 1 });
    expect(countProblems([])).toEqual({ errors: 0, warnings: 0 });
  });
});
