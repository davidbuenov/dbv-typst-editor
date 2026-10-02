// =============================================================================
// DBV Typst Editor — Tests del lector CSV y del código Typst (RF-98)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  detectDelimiter,
  detectHeader,
  escapeMarkup,
  numericColumns,
  parseCsv,
  relativeFrom,
  staticTableCode,
  tableCode,
  toNumber,
  variableName,
  viewRows,
} from './csv.js';

describe('parseCsv', () => {
  it('admite comillas, comillas dobladas, separadores y saltos de línea dentro', () => {
    const text = '﻿nombre,nota\r\n"Pérez, Ana","dijo ""hola""\nadiós"\nLuis,7\n';
    expect(parseCsv(text)).toEqual([
      ['nombre', 'nota'],
      ['Pérez, Ana', 'dijo "hola"\nadiós'],
      ['Luis', '7'],
    ]);
  });

  it('detecta el separador (coma, punto y coma, tabulador)', () => {
    expect(detectDelimiter('a;b;c\n1;2;3\n4;5;6')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(detectDelimiter('a,b\n"1;2",3')).toBe(',');
    expect(detectDelimiter('x', 'datos.tsv')).toBe('\t');
  });
});

describe('cabecera y números', () => {
  it('reconoce números con coma decimal, miles y porcentajes', () => {
    expect(toNumber('3,5')).toBe(3.5);
    expect(toNumber('1.234,5')).toBe(1234.5);
    expect(toNumber('1,234.5')).toBe(1234.5);
    expect(toNumber('12%')).toBe(12);
    expect(toNumber('abc')).toBeNull();
  });

  it('detecta la cabecera y las columnas numéricas', () => {
    const rows = [['año', 'ventas'], ['2024', '10,5'], ['2025', '12']];
    expect(detectHeader(rows)).toBe(true);
    expect(detectHeader([['1', '2'], ['3', '4']])).toBe(false);
    expect(numericColumns(rows.slice(1), 2)).toEqual([true, true]);
  });

  it('ordena numéricamente, filtra y es estable', () => {
    const body = [['b', '10'], ['a', '9'], ['c', '10']];
    expect(viewRows(body, { sortColumn: 1, numeric: [false, true] }).map((r) => r[0])).toEqual(['a', 'b', 'c']);
    expect(viewRows(body, { sortColumn: 1, descending: true, numeric: [false, true] }).map((r) => r[0])).toEqual(['b', 'c', 'a']);
    expect(viewRows(body, { query: 'A' }).map((r) => r[0])).toEqual(['a']);
    expect(viewRows(body, { query: '10', column: 0 })).toEqual([]);
  });
});

describe('código Typst', () => {
  it('ruta relativa desde el .typ', () => {
    expect(relativeFrom('main.typ', 'data/x.csv')).toBe('data/x.csv');
    expect(relativeFrom('cap/uno.typ', 'data/x.csv')).toBe('../data/x.csv');
    expect(relativeFrom('cap/uno.typ', 'cap/x.csv')).toBe('x.csv');
  });

  it('nombre de variable estable y sin tildes', () => {
    expect(variableName('data/Ventas Año 2025.csv')).toBe('datos-ventas-ano-2025');
  });

  it('escapa el marcado de Typst', () => {
    expect(escapeMarkup('#a *b* [c] $d$ @e <f>')).toBe('\\#a \\*b\\* \\[c\\] \\$d\\$ \\@e \\<f\\>');
  });

  it('tabla con cabecera, separador y figura', () => {
    const code = tableCode({ csvPath: 'data/x.csv', typPath: 'cap/uno.typ', delimiter: ';', columns: 2, header: true, align: ['left', 'right'], figure: true, caption: 'Ventas', label: 'tab:ventas' });
    expect(code).toContain('#let datos-x = csv("../data/x.csv", delimiter: ";")');
    expect(code).toContain('table.header(..datos-x.first())');
    expect(code).toContain('align: (left, right)');
    expect(code).toContain('<tab:ventas>');
  });

  // RF-98.8: el código generado compila con el compilador real.
  const binary = ['typst-x86_64-pc-windows-msvc.exe', 'typst-x86_64-unknown-linux-gnu', 'typst-aarch64-apple-darwin', 'typst-x86_64-apple-darwin']
    .map((name) => join(process.cwd(), 'src-tauri', 'binaries', name))
    .find((path) => existsSync(path));
  it.skipIf(!binary)('el código generado compila con el sidecar (misma carpeta y otra carpeta)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dbv-csv-'));
    mkdirSync(join(dir, 'data'));
    mkdirSync(join(dir, 'cap'));
    writeFileSync(join(dir, 'data', 'x.csv'), 'año;ventas\n2024;10,5\n2025;12\n');
    const fromCap = tableCode({ csvPath: 'data/x.csv', typPath: 'cap/uno.typ', delimiter: ';', columns: 2, header: true, figure: true, caption: 'Ventas', label: 'tab:v' });
    writeFileSync(join(dir, 'cap', 'uno.typ'), `${fromCap}\n@tab:v\n`);
    const rows = parseCsv('a,b\n#1,[x]\n');
    writeFileSync(join(dir, 'main.typ'), `#include "cap/uno.typ"\n${tableCode({ csvPath: 'data/x.csv', typPath: 'main.typ', delimiter: ';', columns: 2, header: false })}\n${staticTableCode(rows.slice(1), rows[0], 2)}`);
    execFileSync(binary, ['compile', '--root', dir, join(dir, 'main.typ'), join(dir, 'out.pdf')], { stdio: 'pipe' });
    expect(existsSync(join(dir, 'out.pdf'))).toBe(true);
  });
});
