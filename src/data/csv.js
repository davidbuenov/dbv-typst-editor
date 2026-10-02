// =============================================================================
// DBV Typst Editor — Lector CSV/TSV y código Typst para tablas (RF-98)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Funciones puras: leer un CSV (comillas, separadores y saltos de línea dentro
// de comillas, BOM), detectar separador y cabecera, ordenar y filtrar, y
// generar el código Typst que lo pinta. «Insertar como tabla» lee el fichero
// con `csv()` (la tabla sigue al fichero); «Copiar como tabla Typst» incrusta
// los datos (para tablas pequeñas o una vista filtrada).

const CANDIDATES = [',', ';', '\t', '|'];

/** Separador más probable: el que da el mismo número de columnas (>1) en más filas. */
export function detectDelimiter(text, fileName = '') {
  if (/\.tsv$/i.test(fileName)) return '\t';
  const sample = String(text ?? '').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).slice(0, 20).join('\n');
  let best = ',';
  let bestScore = -1;
  for (const delimiter of CANDIDATES) {
    const rows = parseCsv(sample, delimiter);
    const widths = rows.map((row) => row.length);
    const first = widths[0] ?? 0;
    const score = first > 1 ? widths.filter((width) => width === first).length * first : 0;
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }
  return best;
}

/**
 * CSV → filas (RFC 4180, tolerante): comillas dobles, `""` dentro de comillas,
 * separador y saltos de línea dentro de comillas; CRLF o LF; BOM inicial.
 * @returns {string[][]}
 */
export function parseCsv(text, delimiter = ',') {
  const source = String(text ?? '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
    index += 1;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/** ¿Parece un número? Admite coma decimal y separador de miles. */
export function toNumber(value) {
  const text = String(value ?? '').trim().replace(/\s/g, '');
  if (!/^[-+]?(\d{1,3}([.,]\d{3})*|\d+)([.,]\d+)?(e[-+]?\d+)?%?$/i.test(text)) return null;
  let normal = text.replace('%', '');
  const lastComma = normal.lastIndexOf(',');
  const lastDot = normal.lastIndexOf('.');
  if (lastComma > lastDot) normal = normal.replace(/\./g, '').replace(',', '.');
  else normal = normal.replace(/,/g, '');
  const number = Number(normal);
  return Number.isFinite(number) ? number : null;
}

/** Cabecera probable: la primera fila no tiene números y alguna columna de las siguientes sí. */
export function detectHeader(rows) {
  if (rows.length < 2) return false;
  const [first, ...rest] = rows;
  const firstHasNumbers = first.some((cell) => toNumber(cell) !== null);
  const restHasNumbers = first.some((_, column) => rest.slice(0, 20).some((row) => toNumber(row[column]) !== null));
  const allText = first.every((cell) => cell.trim() !== '');
  return !firstHasNumbers && (restHasNumbers || allText);
}

/** Columnas numéricas: todos sus valores no vacíos son números. */
export function numericColumns(rows, width) {
  return Array.from({ length: width }, (_, column) => {
    const values = rows.map((row) => row[column] ?? '').filter((value) => value.trim() !== '');
    return values.length > 0 && values.every((value) => toNumber(value) !== null);
  });
}

/**
 * Ordena y filtra el cuerpo (sin la cabecera).
 * @param {string[][]} body
 * @param {{sortColumn?: number|null, descending?: boolean, query?: string, column?: number|null, numeric?: boolean[]}} options
 */
export function viewRows(body, { sortColumn = null, descending = false, query = '', column = null, numeric = [] } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  let rows = needle
    ? body.filter((row) => (column === null ? row : [row[column] ?? '']).some((cell) => String(cell).toLocaleLowerCase().includes(needle)))
    : [...body];
  if (sortColumn !== null) {
    const isNumeric = numeric[sortColumn];
    const key = (row) => (isNumeric ? toNumber(row[sortColumn]) ?? -Infinity : String(row[sortColumn] ?? ''));
    rows = rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const ka = key(a.row);
        const kb = key(b.row);
        const order = isNumeric ? ka - kb : String(ka).localeCompare(String(kb), undefined, { numeric: true, sensitivity: 'base' });
        return (descending ? -order : order) || a.index - b.index;
      })
      .map((entry) => entry.row);
  }
  return rows;
}

/** Ruta de `target` vista desde la carpeta del fichero `fromFile` (las dos relativas a la raíz, con `/`). */
export function relativeFrom(fromFile, target) {
  const from = fromFile.split('/').slice(0, -1);
  const to = target.split('/');
  let common = 0;
  while (common < from.length && common < to.length - 1 && from[common] === to[common]) common += 1;
  return [...Array(from.length - common).fill('..'), ...to.slice(common)].join('/');
}

/** Nombre de variable Typst a partir del fichero (`ventas 2025.csv` → `datos-ventas-2025`). */
export function variableName(fileName) {
  const base = fileName.split('/').at(-1).replace(/\.[^.]+$/, '');
  const slug = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `datos-${slug || 'tabla'}`;
}

const delimiterArg = (delimiter) => (delimiter === ',' ? '' : `, delimiter: ${delimiter === '\t' ? '"\\t"' : JSON.stringify(delimiter)}`);

/**
 * Código Typst que lee el CSV con `csv()` y lo pinta (RF-98.5).
 * @param {{csvPath: string, typPath: string, delimiter: string, columns: number, header: boolean, align?: string[], figure?: boolean, caption?: string, label?: string}} options
 */
export function tableCode({ csvPath, typPath, delimiter, columns, header, align = [], figure = false, caption = '', label = '' }) {
  const name = variableName(csvPath);
  const path = relativeFrom(typPath, csvPath);
  const alignment = align.length && align.some((a) => a !== 'left') ? `\n    align: (${align.join(', ')}),` : '';
  const body = header
    ? `\n    table.header(..${name}.first()),\n    ..${name}.slice(1).flatten(),`
    : `\n    ..${name}.flatten(),`;
  const table = `table(\n    columns: ${columns},${alignment}${body}\n  )`;
  const lines = [`#let ${name} = csv(${JSON.stringify(path)}${delimiterArg(delimiter)})`];
  if (figure) {
    const labelText = label ? ` <${label.replace(/[^\w:.-]/g, '-')}>` : '';
    lines.push(`#figure(\n  ${table},\n  caption: [${escapeMarkup(caption)}],\n)${labelText}`);
  } else {
    lines.push(`#${table.replace(/\n {2}/g, '\n')}`);
  }
  return `${lines.join('\n')}\n`;
}

/** Escapa los caracteres con significado en el marcado de Typst. */
export function escapeMarkup(text) {
  return String(text ?? '').replace(/[\\#*_`$@<>[\]~=/+-]/g, (char) => `\\${char}`);
}

/**
 * Tabla Typst con los datos incrustados (RF-98.5, «Copiar como tabla Typst»).
 * @param {string[][]} rows Filas a incluir (ya filtradas/ordenadas).
 * @param {string[]|null} headerRow
 */
export function staticTableCode(rows, headerRow, columns) {
  const cell = (value) => `[${escapeMarkup(value)}]`;
  const lines = [`#table(`, `  columns: ${columns},`];
  if (headerRow) lines.push(`  table.header(${headerRow.map(cell).join(', ')}),`);
  for (const row of rows) {
    const filled = Array.from({ length: columns }, (_, index) => row[index] ?? '');
    lines.push(`  ${filled.map(cell).join(', ')},`);
  }
  lines.push(')');
  return `${lines.join('\n')}\n`;
}
