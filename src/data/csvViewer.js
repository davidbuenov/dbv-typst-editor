// =============================================================================
// DBV Typst Editor — Visor de datos CSV/TSV (RF-98)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Tabla de solo lectura (se edita en modo texto, en el editor) con orden por
// columna, filtro y desplazamiento virtual: solo existen en el DOM las filas
// visibles, así que 100 000 filas no cuestan más que 50. Desde aquí se inserta
// la tabla en el documento leyendo el fichero con `csv()`, o se copia con los
// datos incrustados.

import { t } from '../i18n/i18n.js';
import {
  detectDelimiter,
  detectHeader,
  numericColumns,
  parseCsv,
  staticTableCode,
  tableCode,
  viewRows,
} from './csv.js';

/** Alto fijo de fila (px): la base del desplazamiento virtual. */
export const ROW_HEIGHT = 26;
/** Filas extra por encima y por debajo de las visibles. */
const OVERSCAN = 10;
/** Tope de «Copiar como tabla Typst»: más filas no tiene sentido incrustarlas. */
export const STATIC_LIMIT = 500;

/** Primera y última fila que hay que pintar para un desplazamiento dado. */
export function visibleRange(scrollTop, viewportHeight, total) {
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(total, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  return { first, last };
}

/**
 * @param {object} deps
 * @param {Record<string, HTMLElement>} deps.elements
 * @param {() => void} deps.show
 * @param {(code: string) => Promise<boolean>} deps.insertIntoDocument Inserta en el último `.typ` activo.
 * @param {() => string|null} deps.getTargetTyp Ruta relativa del último `.typ` activo.
 * @param {(text: string) => Promise<void>} deps.copy
 * @param {(message: string, tone?: string) => void} deps.notify
 */
export function createCsvViewer({ elements, show, insertIntoDocument, getTargetTyp, copy, notify }) {
  let state = null;

  function body() {
    return state.header ? state.rows.slice(1) : state.rows;
  }

  function currentRows() {
    return viewRows(body(), {
      sortColumn: state.sortColumn,
      descending: state.descending,
      query: elements.filter.value,
      column: elements.filterColumn.value === '' ? null : Number(elements.filterColumn.value),
      numeric: state.numeric,
    });
  }

  function renderHead() {
    const tr = document.createElement('tr');
    for (let column = 0; column < state.width; column += 1) {
      const th = document.createElement('th');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'data__sort';
      const label = state.header ? state.rows[0][column] ?? '' : `${t('data.column')} ${column + 1}`;
      const arrow = state.sortColumn === column ? (state.descending ? ' ▼' : ' ▲') : '';
      button.textContent = `${label}${arrow}`;
      button.title = t('data.sortHint');
      button.addEventListener('click', () => {
        state.descending = state.sortColumn === column ? !state.descending : false;
        state.sortColumn = column;
        refresh();
      });
      th.append(button);
      if (state.numeric[column]) th.classList.add('data__numeric');
      tr.append(th);
    }
    elements.head.replaceChildren(tr);
    elements.filterColumn.replaceChildren(new Option(t('data.allColumns'), ''));
    for (let column = 0; column < state.width; column += 1) {
      const label = state.header ? state.rows[0][column] : `${t('data.column')} ${column + 1}`;
      elements.filterColumn.append(new Option(label || `${column + 1}`, String(column)));
    }
  }

  function renderBody() {
    const rows = state.view;
    const { first, last } = visibleRange(elements.scroller.scrollTop, elements.scroller.clientHeight || 400, rows.length);
    const fragment = document.createDocumentFragment();
    const spacerTop = document.createElement('tr');
    spacerTop.style.height = `${first * ROW_HEIGHT}px`;
    fragment.append(spacerTop);
    for (let index = first; index < last; index += 1) {
      const tr = document.createElement('tr');
      tr.style.height = `${ROW_HEIGHT}px`;
      for (let column = 0; column < state.width; column += 1) {
        const td = document.createElement('td');
        td.textContent = rows[index][column] ?? '';
        if (state.numeric[column]) td.className = 'data__numeric';
        tr.append(td);
      }
      fragment.append(tr);
    }
    const spacerBottom = document.createElement('tr');
    spacerBottom.style.height = `${(rows.length - last) * ROW_HEIGHT}px`;
    fragment.append(spacerBottom);
    elements.body.replaceChildren(fragment);
  }

  function refresh() {
    if (!state) return;
    state.view = currentRows();
    elements.count.textContent = t('data.count').replace('{shown}', String(state.view.length)).replace('{total}', String(body().length));
    renderHead();
    renderBody();
  }

  function load({ text, path, relative }) {
    const delimiter = detectDelimiter(text, path);
    const rows = parseCsv(text, delimiter);
    const width = Math.max(0, ...rows.map((row) => row.length));
    const header = detectHeader(rows);
    state = { path, relative, text, delimiter, rows, width, header, sortColumn: null, descending: false, view: [] };
    state.numeric = numericColumns(header ? rows.slice(1) : rows, width);
    elements.title.textContent = relative ?? path;
    elements.header.checked = header;
    elements.delimiter.value = delimiter;
    elements.filter.value = '';
    elements.scroller.scrollTop = 0;
    elements.insert.disabled = !relative;
    elements.insert.title = relative ? '' : t('data.insertNeedsProject');
    refresh();
  }

  elements.scroller.addEventListener('scroll', () => state && renderBody());
  elements.filter.addEventListener('input', refresh);
  elements.filterColumn.addEventListener('change', refresh);
  elements.header.addEventListener('change', () => {
    state.header = elements.header.checked;
    state.numeric = numericColumns(body(), state.width);
    state.sortColumn = null;
    refresh();
  });
  elements.delimiter.addEventListener('change', () => {
    state.delimiter = elements.delimiter.value;
    state.rows = parseCsv(state.text, state.delimiter);
    state.width = Math.max(0, ...state.rows.map((row) => row.length));
    state.sortColumn = null;
    state.numeric = numericColumns(body(), state.width);
    refresh();
  });

  elements.insert.addEventListener('click', async () => {
    const typPath = getTargetTyp();
    if (!typPath || !state?.relative) {
      notify(t('data.noTarget'), 'error');
      return;
    }
    const code = tableCode({
      csvPath: state.relative,
      typPath,
      delimiter: state.delimiter,
      columns: state.width,
      header: state.header,
      align: state.numeric.map((numeric) => (numeric ? 'right' : 'left')),
      figure: elements.asFigure.checked,
      caption: elements.caption.value,
      label: elements.label.value,
    });
    if (await insertIntoDocument(code)) notify(t('data.inserted').replace('{file}', typPath));
  });
  elements.copyStatic.addEventListener('click', async () => {
    const rows = state.view.slice(0, STATIC_LIMIT);
    await copy(staticTableCode(rows, state.header ? state.rows[0] : null, state.width));
    notify(state.view.length > STATIC_LIMIT ? t('data.copiedTruncated').replace('{n}', String(STATIC_LIMIT)) : t('data.copied'));
  });

  return {
    /** Abre el visor con el contenido de un fichero (o del editor, sin guardar). */
    open(source) {
      show();
      load(source);
    },
    /** Datos actuales, para «Preguntar a la IA sobre estos datos» (RF-98.7). */
    getSample(maxRows = 30) {
      return state ? { path: state.relative ?? state.path, header: state.header ? state.rows[0] : null, rows: body().slice(0, maxRows), total: body().length } : null;
    },
  };
}
