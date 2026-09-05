// =============================================================================
// DBV Typst Editor — Acciones de la barra de herramientas del editor
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// RF-13 / ARCHITECTURE.md §7.7. Tabla de acciones como dato, no como `switch`:
// es lo que permite reordenar/ocultar botones por modo de escritura (Beta,
// §7.9) sin tocar esta lógica. Cada acción expone `buildTransaction(state)`,
// que devuelve la especificación de transacción de CodeMirror 6 SIN necesitar
// una `EditorView` ni DOM — la misma separación que ya usa `verify-frontend.mjs`
// para poder comprobar el editor en Node. `toolbar.js` es quien la aplica con
// `view.dispatch(...)`.

import { syntaxTree } from '@codemirror/language';
import { keymap } from '@codemirror/view';

/**
 * True si la posición del cursor cae dentro de una ecuación Typst (`$...$`).
 *
 * Se comprueba a ambos lados del cursor (`resolveInner(pos, -1)` y `(pos, 1)`)
 * porque un cursor justo al final o al principio de la ecuación debe seguir
 * contando como "dentro" — es la frontera donde más se pulsa un botón después
 * de escribir el símbolo de cierre.
 */
export function isInsideMath(state) {
  const pos = state.selection.main.head;
  const tree = syntaxTree(state);
  for (const side of [-1, 1]) {
    let node = tree.resolveInner(pos, side);
    while (node) {
      if (node.name === 'Equation') return true;
      node = node.parent;
    }
  }
  return false;
}

/**
 * Envuelve la selección entre `before` y `after`, con alternancia (§7.7.3.2):
 * volver a pulsar sobre texto ya marcado retira el marcado en vez de anidarlo.
 * Cubre dos formas de "ya marcado": la selección incluye los propios
 * marcadores, o los marcadores están justo pegados fuera de la selección.
 */
function wrapToggle(before, after) {
  return function buildTransaction(state) {
    const { from, to } = state.selection.main;
    const selected = state.sliceDoc(from, to);

    if (
      selected.length >= before.length + after.length &&
      selected.startsWith(before) &&
      selected.endsWith(after)
    ) {
      const inner = selected.slice(before.length, selected.length - after.length);
      return {
        changes: { from, to, insert: inner },
        selection: { anchor: from, head: from + inner.length },
      };
    }

    const beforeStart = from - before.length;
    const afterEnd = to + after.length;
    if (
      beforeStart >= 0 &&
      state.sliceDoc(beforeStart, from) === before &&
      state.sliceDoc(to, afterEnd) === after
    ) {
      return {
        changes: [
          { from: beforeStart, to: from, insert: '' },
          { from: to, to: afterEnd, insert: '' },
        ],
        selection: { anchor: beforeStart, head: beforeStart + selected.length },
      };
    }

    return {
      changes: { from, to, insert: before + selected + after },
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
    };
  };
}

/**
 * Antepone `prefix` a cada línea tocada por la selección. Alternancia dentro de
 * una `family` mutuamente excluyente (los tres niveles de encabezado entre sí,
 * o los tres marcadores de lista entre sí): pulsar el mismo prefijo lo quita,
 * pulsar uno distinto de la misma familia lo sustituye.
 *
 * No fija `selection` en la transacción a propósito: al omitirla, CodeMirror
 * mapea la selección previa a través de los cambios, que es justo lo que hace
 * falta aquí (la selección de texto no se mueve al cambiar el prefijo de línea).
 */
function linePrefixToggle(prefix, family) {
  return function buildTransaction(state) {
    const { from, to } = state.selection.main;
    const startLine = state.doc.lineAt(from).number;
    const endLine = state.doc.lineAt(to).number;
    const changes = [];

    for (let lineNo = startLine; lineNo <= endLine; lineNo++) {
      const line = state.doc.line(lineNo);
      const existing = family.find((candidate) => line.text.startsWith(candidate));
      if (existing === prefix) {
        changes.push({ from: line.from, to: line.from + prefix.length, insert: '' });
      } else if (existing) {
        changes.push({ from: line.from, to: line.from + existing.length, insert: prefix });
      } else {
        changes.push({ from: line.from, to: line.from, insert: prefix });
      }
    }
    return { changes };
  };
}

/**
 * Plantilla de un solo hueco, en línea (sin salto de línea propio): la
 * selección previa se usa como contenido si existe, o el valor por defecto de
 * `build` si no. `holeStart`/`holeLength` marcan, dentro del texto generado,
 * el fragmento que queda seleccionado para que el usuario siga escribiendo ahí.
 */
function inlineTemplate(build) {
  return function buildTransaction(state) {
    const { from, to } = state.selection.main;
    const { text, holeStart, holeLength } = build(state.sliceDoc(from, to));
    const holeFrom = from + holeStart;
    return {
      changes: { from, to, insert: text },
      selection: { anchor: holeFrom, head: holeFrom + holeLength },
    };
  };
}

/**
 * Como `inlineTemplate`, pero para bloques que deben quedar en su propia línea
 * (figura, tabla, ecuación en bloque...): añade un salto de línea antes y/o
 * después solo si el cursor no está ya al principio/final de línea, para no
 * dejar líneas en blanco de más.
 */
function blockTemplate(build) {
  return function buildTransaction(state) {
    const { from, to } = state.selection.main;
    const { text, holeStart, holeLength } = build(state.sliceDoc(from, to));

    const atLineStart = state.doc.lineAt(from).from === from;
    const atLineEnd = state.doc.lineAt(to).to === to;
    const prefix = atLineStart ? '' : '\n';
    const suffix = atLineEnd ? '' : '\n';

    const holeFrom = from + prefix.length + holeStart;
    return {
      changes: { from, to, insert: prefix + text + suffix },
      selection: { anchor: holeFrom, head: holeFrom + holeLength },
    };
  };
}

/**
 * Variante de la acción "figura" para una ruta ya conocida (arrastrar y
 * soltar una imagen sobre el editor, Beta §7.10): a diferencia del botón de la
 * barra, el hueco no se deja en la ruta —ya se sabe cuál es, la acaba de
 * copiar `copy_asset_into_project`— sino en el pie de figura, que es lo único
 * que queda por escribir.
 */
export function figureActionForPath(path) {
  return blockTemplate((selected) => {
    const caption = selected || 'pie de figura';
    const text = `#figure(\n  image("${path}"),\n  caption: [${caption}],\n)`;
    const captionStart = text.indexOf('[', text.indexOf('caption')) + 1;
    return { text, holeStart: captionStart, holeLength: caption.length };
  });
}

/**
 * Inserta un símbolo Typst elegido en la galería (Beta, §7.7.4): dentro de una
 * ecuación, el nombre tal cual (`alpha`, `arrow.r`...); fuera, envuelto en
 * `$...$` — misma comprobación de contexto que el resto de la barra.
 */
export function insertSymbolAction(symbolName) {
  return (state) => {
    const text = isInsideMath(state) ? symbolName : `$${symbolName}$`;
    const { from, to } = state.selection.main;
    return { changes: { from, to, insert: text }, selection: { anchor: from + text.length } };
  };
}

/**
 * Genera una tabla real con las dimensiones elegidas en el diálogo (Beta,
 * §7.7.4) — a diferencia del botón liso de la barra, que siempre es 2×2. La
 * fila de cabecera, si se pide, usa `table.header(...)` (la forma oficial,
 * no una fila normal más), y el hueco de edición cae en la primera celda del
 * CUERPO — nunca en la cabecera, que ya lleva un texto de ejemplo propio.
 */
export function tableAction({ rows, cols, header }) {
  return blockTemplate(() => {
    const headerLine = header
      ? `  table.header(${Array.from({ length: cols }, (_, i) => `[Encabezado ${i + 1}]`).join(', ')}),\n`
      : '';
    const bodyRows = Array.from(
      { length: rows },
      () => `  ${Array.from({ length: cols }, () => '[Celda]').join(', ')},`
    ).join('\n');
    const text = `#table(\n  columns: ${cols},\n${headerLine}${bodyRows}\n)`;

    const celdaIndex = text.indexOf('[Celda]');
    const holeStart = celdaIndex >= 0 ? celdaIndex + 1 : text.length;
    const holeLength = celdaIndex >= 0 ? 'Celda'.length : 0;
    return { text, holeStart, holeLength };
  });
}

const HEADING_PREFIXES = ['= ', '== ', '=== '];
const LIST_PREFIXES = ['- ', '+ ', '/ '];

/**
 * Inventario de botones (§7.7.2). El orden de este array es el orden visual:
 * agrupado por `group`, con un divisor entre grupos (ver `toolbar.js`).
 */
export const TOOLBAR_ACTIONS = [
  // ── Formato ──────────────────────────────────────────────────────────────
  { id: 'bold', group: 'format', glyph: 'B', i18nKey: 'toolbar.bold', shortcut: 'Mod-b', buildTransaction: wrapToggle('*', '*') },
  { id: 'italic', group: 'format', glyph: 'I', i18nKey: 'toolbar.italic', shortcut: 'Mod-i', buildTransaction: wrapToggle('_', '_') },
  { id: 'strike', group: 'format', glyph: 'S', i18nKey: 'toolbar.strike', buildTransaction: wrapToggle('#strike[', ']') },
  { id: 'code', group: 'format', glyph: '</>', i18nKey: 'toolbar.code', shortcut: 'Mod-e', buildTransaction: wrapToggle('`', '`') },
  { id: 'superscript', group: 'format', glyph: 'x²', i18nKey: 'toolbar.superscript', buildTransaction: wrapToggle('#super[', ']') },
  { id: 'subscript', group: 'format', glyph: 'x₂', i18nKey: 'toolbar.subscript', buildTransaction: wrapToggle('#sub[', ']') },

  // ── Estructura ───────────────────────────────────────────────────────────
  { id: 'heading1', group: 'structure', glyph: 'H1', i18nKey: 'toolbar.heading1', shortcut: 'Mod-Shift-1', buildTransaction: linePrefixToggle('= ', HEADING_PREFIXES) },
  { id: 'heading2', group: 'structure', glyph: 'H2', i18nKey: 'toolbar.heading2', shortcut: 'Mod-Shift-2', buildTransaction: linePrefixToggle('== ', HEADING_PREFIXES) },
  { id: 'heading3', group: 'structure', glyph: 'H3', i18nKey: 'toolbar.heading3', shortcut: 'Mod-Shift-3', buildTransaction: linePrefixToggle('=== ', HEADING_PREFIXES) },
  { id: 'bulletList', group: 'structure', glyph: '•', i18nKey: 'toolbar.bulletList', buildTransaction: linePrefixToggle('- ', LIST_PREFIXES) },
  { id: 'numberedList', group: 'structure', glyph: '1.', i18nKey: 'toolbar.numberedList', buildTransaction: linePrefixToggle('+ ', LIST_PREFIXES) },
  // Sustituye a la lista de tareas de DBV Markdown Reader: Typst no tiene
  // checklist nativa, pero sí lista de términos — mejor encaje académico.
  { id: 'termList', group: 'structure', glyph: 'Term', i18nKey: 'toolbar.termList', buildTransaction: linePrefixToggle('/ ', LIST_PREFIXES) },

  // ── Contenido ────────────────────────────────────────────────────────────
  {
    id: 'link',
    group: 'content',
    glyph: 'Link',
    i18nKey: 'toolbar.link',
    shortcut: 'Mod-k',
    // La URL, no el texto visible, es el hueco que casi siempre queda por
    // rellenar — por eso la selección final cae ahí y no dentro de `[...]`.
    buildTransaction: inlineTemplate((selected) => {
      const label = selected || 'enlace';
      const url = 'url';
      const text = `#link("${url}")[${label}]`;
      return { text, holeStart: text.indexOf(url), holeLength: url.length };
    }),
  },
  {
    id: 'figure',
    group: 'content',
    glyph: 'Fig',
    i18nKey: 'toolbar.figure',
    buildTransaction: blockTemplate((selected) => {
      const path = 'images/...';
      const caption = selected || 'pie de figura';
      const text = `#figure(\n  image("${path}"),\n  caption: [${caption}],\n)`;
      return { text, holeStart: text.indexOf(path), holeLength: path.length };
    }),
  },
  { id: 'quote', group: 'content', glyph: '“', i18nKey: 'toolbar.quote', buildTransaction: wrapToggle('#quote(block: true)[', ']') },
  {
    id: 'codeBlock',
    group: 'content',
    glyph: '{ }',
    i18nKey: 'toolbar.codeBlock',
    buildTransaction: blockTemplate((selected) => {
      const lang = 'typst';
      const body = selected || '';
      const text = '```' + lang + '\n' + body + '\n```';
      return { text, holeStart: 3, holeLength: lang.length };
    }),
  },
  {
    id: 'table',
    group: 'content',
    glyph: '▦',
    i18nKey: 'toolbar.table',
    // Esqueleto 2×2 fijo (el diálogo de dimensiones es Beta, §7.7.4): la
    // selección previa no se usa, solo se coloca sobre la primera celda.
    buildTransaction: blockTemplate(() => {
      const text = '#table(\n  columns: 2,\n  [Celda], [Celda],\n  [Celda], [Celda],\n)';
      return { text, holeStart: text.indexOf('Celda'), holeLength: 'Celda'.length };
    }),
  },
  {
    id: 'hr',
    group: 'content',
    glyph: '—',
    i18nKey: 'toolbar.hr',
    buildTransaction: blockTemplate(() => {
      const text = '#line(length: 100%)';
      return { text, holeStart: text.length, holeLength: 0 };
    }),
  },

  // ── Typst ────────────────────────────────────────────────────────────────
  {
    id: 'symbols',
    group: 'typst',
    glyph: 'Σ',
    i18nKey: 'toolbar.symbols',
    // Fallback si no hay galería wireada (Beta, §7.7.4): inserta un símbolo de
    // ejemplo, envuelto en `$...$` si el cursor no está ya en modo matemático
    // — la misma comprobación que usa `insertSymbol()` de verdad.
    buildTransaction: (state) => {
      const inMath = isInsideMath(state);
      const symbol = 'alpha';
      const text = inMath ? symbol : `$${symbol}$`;
      const { from, to } = state.selection.main;
      return { changes: { from, to, insert: text }, selection: { anchor: from + text.length } };
    },
  },
  { id: 'equationInline', group: 'typst', glyph: '$x$', i18nKey: 'toolbar.equationInline', buildTransaction: wrapToggle('$', '$') },
  {
    id: 'equationBlock',
    group: 'typst',
    glyph: '$ x $',
    i18nKey: 'toolbar.equationBlock',
    buildTransaction: blockTemplate((selected) => {
      const body = selected || 'x';
      const text = `$ ${body} $`;
      return { text, holeStart: 2, holeLength: body.length };
    }),
  },
  {
    id: 'label',
    group: 'typst',
    glyph: '<>',
    i18nKey: 'toolbar.label',
    buildTransaction: inlineTemplate((selected) => {
      const name = selected || 'etiqueta';
      return { text: `<${name}>`, holeStart: 1, holeLength: name.length };
    }),
  },
  {
    id: 'crossRef',
    group: 'typst',
    glyph: '@',
    i18nKey: 'toolbar.crossRef',
    buildTransaction: inlineTemplate((selected) => {
      const name = selected || 'etiqueta';
      return { text: `@${name}`, holeStart: 1, holeLength: name.length };
    }),
  },
  {
    id: 'citation',
    group: 'typst',
    glyph: 'Cite',
    i18nKey: 'toolbar.citation',
    buildTransaction: inlineTemplate((selected) => {
      const key = selected || 'clave';
      const text = `#cite(<${key}>)`;
      return { text, holeStart: text.indexOf(key), holeLength: key.length };
    }),
  },
  {
    id: 'bibliography',
    group: 'typst',
    glyph: 'Bib',
    i18nKey: 'toolbar.bibliography',
    buildTransaction: blockTemplate(() => {
      const text = '#bibliography("refs.bib")';
      return { text, holeStart: text.indexOf('refs.bib'), holeLength: 'refs.bib'.length };
    }),
  },
  {
    id: 'pagebreak',
    group: 'typst',
    glyph: '⏎',
    i18nKey: 'toolbar.pagebreak',
    buildTransaction: blockTemplate(() => {
      const text = '#pagebreak()';
      return { text, holeStart: text.length, holeLength: 0 };
    }),
  },
];

/**
 * Extensión de CodeMirror con los atajos de teclado de las acciones que
 * declaran `shortcut` (§7.7.3.5). Deliberadamente no todas las acciones tienen
 * uno: el modelo de interacción principal de la barra es el clic (ver
 * ARCHITECTURE.md §7.7.4, "el usuario pulsa el botón"), y asignar un atajo
 * único a cada uno de los ~20 botones sin colisionar con `defaultKeymap`,
 * `searchKeymap` o `historyKeymap` no aporta valor proporcional al riesgo.
 */
export function buildToolbarKeymap() {
  const bindings = TOOLBAR_ACTIONS.filter((action) => action.shortcut).map((action) => ({
    key: action.shortcut,
    preventDefault: true,
    run: (view) => {
      const spec = action.buildTransaction(view.state);
      if (spec) view.dispatch(spec);
      return true;
    },
  }));
  return keymap.of(bindings);
}
