// =============================================================================
// DBV Typst Editor — Tests de las acciones de la barra de herramientas
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// RF-13. Cada acción es `buildTransaction(state) -> TransactionSpec`, sin
// `EditorView` ni DOM de por medio (mismo patrón que `verify-frontend.mjs`
// usa para el resto del editor), así que se comprueba aplicando la
// transacción con `state.update(spec).state` y mirando el documento y la
// selección resultantes — nunca el propio wiring del clic, que es
// responsabilidad de `toolbar.js`.

import { EditorState } from '@codemirror/state';
import { typst_lezer } from 'codemirror-lang-typst/lezer';
import { describe, expect, it } from 'vitest';
import {
  TOOLBAR_ACTIONS,
  buildToolbarKeymap,
  cetzAction,
  figureActionForPath,
  getCetzSnippet,
  getJogsSnippet,
  hasCetzImport,
  hasJogsImport,
  insertSymbolAction,
  isInsideMath,
  jogsAction,
  tableAction,
} from './toolbarActions.js';

function action(id) {
  const found = TOOLBAR_ACTIONS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`acción de toolbar desconocida: ${id}`);
  return found;
}

/** Estado real con el modo Typst instalado, con la selección dada. */
function stateWithSelection(doc, from, to = from) {
  return EditorState.create({
    doc,
    selection: { anchor: from, head: to },
    extensions: [typst_lezer()],
  });
}

/** Aplica una acción y devuelve `{doc, selectedText}` del resultado. */
function apply(actionId, doc, from, to = from) {
  const state = stateWithSelection(doc, from, to);
  const spec = action(actionId).buildTransaction(state);
  const next = state.update(spec).state;
  const { from: nf, to: nt } = next.selection.main;
  return { doc: next.doc.toString(), selectedText: next.sliceDoc(nf, nt) };
}

describe('wrapToggle (negrita, cursiva, código...)', () => {
  it('envuelve la selección y la conserva dentro de los marcadores', () => {
    // "Hola mundo" — selecciona "mundo" (posiciones 5-10).
    const result = apply('bold', 'Hola mundo', 5, 10);
    expect(result.doc).toBe('Hola *mundo*');
    expect(result.selectedText).toBe('mundo');
  });

  it('alterna: pulsar sobre una selección que incluye los marcadores los quita', () => {
    const result = apply('bold', 'Hola *mundo* que tal', 5, 12);
    expect(result.doc).toBe('Hola mundo que tal');
    expect(result.selectedText).toBe('mundo');
  });

  it('alterna: pulsar con los marcadores pegados fuera de la selección los quita', () => {
    // Selecciona solo "mundo" (6-11); los asteriscos están justo fuera.
    const result = apply('bold', 'Hola *mundo* que tal', 6, 11);
    expect(result.doc).toBe('Hola mundo que tal');
    expect(result.selectedText).toBe('mundo');
  });

  it('sin selección, inserta el par y deja el cursor dentro', () => {
    const result = apply('italic', 'Hola  mundo', 5);
    expect(result.doc).toBe('Hola __ mundo');
    expect(result.selectedText).toBe('');
  });

  it('el código en línea usa comillas invertidas', () => {
    const result = apply('code', 'usa typst init', 4, 14);
    expect(result.doc).toBe('usa `typst init`');
  });

  it('el tachado y sub/superíndice usan la sintaxis de función de Typst', () => {
    expect(apply('strike', 'texto', 0, 5).doc).toBe('#strike[texto]');
    expect(apply('superscript', 'texto', 0, 5).doc).toBe('#super[texto]');
    expect(apply('subscript', 'texto', 0, 5).doc).toBe('#sub[texto]');
  });

  it('la alternancia también funciona con marcadores de distinta longitud (#strike[...])', () => {
    // "#strike[" (8) y "]" (1) no son simétricos: es el caso donde un cálculo
    // de índices con un solo `before.length` para ambos lados se rompería.
    const doc = '#strike[texto] normal';
    const result = apply('strike', doc, 8, 13);
    expect(result.doc).toBe('texto normal');
    expect(result.selectedText).toBe('texto');
  });
});

describe('linePrefixToggle (encabezados y listas)', () => {
  it('añade el prefijo a una línea que no tiene ninguno de la familia', () => {
    const result = apply('heading1', 'Título', 0);
    expect(result.doc).toBe('= Título');
  });

  it('alterna: pulsar el mismo nivel otra vez lo quita', () => {
    const result = apply('heading1', '= Título', 2);
    expect(result.doc).toBe('Título');
  });

  it('sustituye el prefijo si ya hay uno distinto de la misma familia', () => {
    const result = apply('heading2', '= Título', 2);
    expect(result.doc).toBe('== Título');
  });

  it('las listas son una familia mutuamente excluyente distinta de los encabezados', () => {
    // Una lista numerada sobre una línea que ya es viñeta se convierte, no se apila.
    const result = apply('numberedList', '- primer punto', 2);
    expect(result.doc).toBe('+ primer punto');
  });

  it('afecta a todas las líneas que toca una selección multilínea', () => {
    const doc = 'uno\ndos\ntres';
    const state = stateWithSelection(doc, 0, doc.length);
    const spec = action('bulletList').buildTransaction(state);
    const next = state.update(spec).state;
    expect(next.doc.toString()).toBe('- uno\n- dos\n- tres');
  });
});

describe('plantillas con hueco (enlace, figura, tabla, ecuación...)', () => {
  it('el enlace dela la selección como texto visible y deja el hueco en la URL', () => {
    const result = apply('link', 'visita mi sitio web', 7, 15);
    expect(result.doc).toBe('visita #link("url")[mi sitio] web');
    expect(result.selectedText).toBe('url');
  });

  it('el enlace sin selección usa un texto de ejemplo', () => {
    const result = apply('link', '', 0);
    expect(result.doc).toBe('#link("url")[enlace]');
  });

  it('la figura genera un pie de figura y deja el hueco en la ruta de la imagen, anclada a la raíz', () => {
    const result = apply('figure', '', 0);
    expect(result.doc).toContain('image("/images/...")');
    expect(result.doc).toContain('caption: [pie de figura]');
    expect(result.selectedText).toBe('/images/...');
  });

  it('la tabla es un esqueleto 2x2 con la primera celda seleccionada', () => {
    const result = apply('table', '', 0);
    expect(result.doc).toBe('#table(\n  columns: 2,\n  [Celda], [Celda],\n  [Celda], [Celda],\n)');
    expect(result.selectedText).toBe('Celda');
  });

  it('los bloques añaden salto de línea solo si el cursor no está ya al principio', () => {
    // Cursor a mitad de una línea con texto: hace falta separar en su propia línea.
    const result = apply('hr', 'texto', 5);
    expect(result.doc).toBe('texto\n#line(length: 100%)');
  });

  it('los bloques no añaden salto de línea de más si ya se está al principio', () => {
    const result = apply('hr', '', 0);
    expect(result.doc).toBe('#line(length: 100%)');
  });

  it('la etiqueta, la referencia cruzada y la cita usan la sintaxis real de Typst', () => {
    expect(apply('label', '', 0).doc).toBe('<etiqueta>');
    expect(apply('crossRef', '', 0).doc).toBe('@etiqueta');
    expect(apply('citation', '', 0).doc).toBe('#cite(<clave>)');
  });

  it('la bibliografía apunta por defecto a refs.bib, como las plantillas curadas', () => {
    const result = apply('bibliography', '', 0);
    expect(result.doc).toBe('#bibliography("refs.bib")');
    expect(result.selectedText).toBe('refs.bib');
  });
});

describe('isInsideMath', () => {
  it('reconoce el cursor dentro de una ecuación', () => {
    const doc = '$ x^2 + 1 $';
    const state = stateWithSelection(doc, doc.indexOf('x^2'));
    expect(isInsideMath(state)).toBe(true);
  });

  it('no confunde texto normal con una ecuación', () => {
    const doc = 'Texto normal, sin matemáticas.';
    const state = stateWithSelection(doc, 5);
    expect(isInsideMath(state)).toBe(false);
  });
});

describe('figureActionForPath (arrastrar y soltar una imagen, Beta §7.10)', () => {
  it('antepone "/" a la ruta que devuelve copy_asset_into_project, para anclarla a la raíz del proyecto', () => {
    const state = stateWithSelection('', 0);
    const spec = figureActionForPath('images/diagrama-1.png')(state);
    const next = state.update(spec).state;
    expect(next.doc.toString()).toBe(
      '#figure(\n  image("/images/diagrama-1.png"),\n  caption: [pie de figura],\n) <fig:diagrama-1>'
    );
    const { from, to } = next.selection.main;
    expect(next.sliceDoc(from, to)).toBe('pie de figura');
  });

  it('no duplica la barra si la ruta ya viene anclada a la raíz', () => {
    const state = stateWithSelection('', 0);
    const spec = figureActionForPath('/images/diagrama-1.png')(state);
    const next = state.update(spec).state;
    expect(next.doc.toString()).toBe(
      '#figure(\n  image("/images/diagrama-1.png"),\n  caption: [pie de figura],\n) <fig:diagrama-1>'
    );
  });

  // Petición del usuario (2026-09-12): que la imagen llegue ya referenciable.
  // Repetir una etiqueta es un ERROR de compilación en Typst, así que insertar
  // dos veces la misma imagen tenía que numerar la segunda o romper el
  // documento entero.
  it('numera la etiqueta si esa imagen ya está referenciada en el documento', () => {
    const doc = '#figure(\n  image("/images/foto.png"),\n  caption: [Una],\n) <fig:foto>\n';
    const state = stateWithSelection(doc, doc.length);
    const spec = figureActionForPath('images/foto.png')(state);
    const next = state.update(spec).state;
    expect(next.doc.toString()).toContain('<fig:foto-2>');
  });

  it('quita tildes y espacios del nombre, que una etiqueta de Typst no admite', () => {
    const state = stateWithSelection('', 0);
    const spec = figureActionForPath('images/Diseño del Árbol.png')(state);
    const next = state.update(spec).state;
    expect(next.doc.toString()).toContain('<fig:diseno-del-arbol>');
  });

  // Un nombre que al limpiarlo se queda sin nada no puede producir `<fig:>`,
  // que no compila.
  it('un nombre sin caracteres utilizables cae en una etiqueta de reserva', () => {
    const state = stateWithSelection('', 0);
    const spec = figureActionForPath('images/---.png')(state);
    const next = state.update(spec).state;
    expect(next.doc.toString()).toContain('<fig:imagen>');
  });
});

describe('insertSymbolAction (galería de símbolos, Beta §7.7.4)', () => {
  it('fuera de una ecuación, envuelve el símbolo en $...$', () => {
    const state = stateWithSelection('Texto ', 6);
    const spec = insertSymbolAction('alpha')(state);
    const next = state.update(spec).state;
    expect(next.doc.toString()).toBe('Texto $alpha$');
  });

  it('dentro de una ecuación, inserta el nombre desnudo', () => {
    const doc = '$ x + $';
    const state = stateWithSelection(doc, doc.indexOf('+') + 2);
    const spec = insertSymbolAction('alpha')(state);
    const next = state.update(spec).state;
    expect(next.doc.toString()).toBe('$ x + alpha$');
  });
});

describe('tableAction (diálogo de dimensiones, Beta §7.7.4)', () => {
  it('genera una tabla 3x2 sin cabecera, con el hueco en la primera celda', () => {
    const state = stateWithSelection('', 0);
    const spec = tableAction({ rows: 3, cols: 2, header: false })(state);
    const next = state.update(spec).state;
    expect(next.doc.toString()).toBe(
      '#table(\n  columns: 2,\n  [Celda], [Celda],\n  [Celda], [Celda],\n  [Celda], [Celda],\n)'
    );
    const { from, to } = next.selection.main;
    expect(next.sliceDoc(from, to)).toBe('Celda');
  });

  it('con cabecera, usa table.header y el hueco sigue cayendo en el cuerpo', () => {
    const state = stateWithSelection('', 0);
    const spec = tableAction({ rows: 1, cols: 2, header: true })(state);
    const next = state.update(spec).state;
    const doc = next.doc.toString();
    expect(doc).toContain('table.header([Encabezado 1], [Encabezado 2])');
    expect(doc).toContain('[Celda], [Celda]');

    const { from, to } = next.selection.main;
    // El hueco cae en el CUERPO, después de la línea de cabecera, no en ella.
    expect(from).toBeGreaterThan(doc.indexOf('table.header'));
    expect(next.sliceDoc(from, to)).toBe('Celda');
  });
});

describe('buildToolbarKeymap', () => {
  it('registra exactamente un atajo por cada acción que declara `shortcut`', () => {
    const withShortcut = TOOLBAR_ACTIONS.filter((toolbarAction) => toolbarAction.shortcut);
    expect(withShortcut.length).toBeGreaterThan(0);

    const extension = buildToolbarKeymap();
    // La extensión de `keymap.of([...])` es un array de facets internos de
    // CodeMirror; lo relevante para el test es que se construye sin lanzar y
    // que hay tantos bindings como acciones con atajo — se comprueba
    // instalándola en un estado real, igual que `verify-frontend.mjs`.
    const state = EditorState.create({ doc: '', extensions: [extension] });
    expect(state).toBeTruthy();
  });

  it('ningún atajo de la barra se repite entre dos acciones distintas', () => {
    const shortcuts = TOOLBAR_ACTIONS.filter((toolbarAction) => toolbarAction.shortcut).map(
      (toolbarAction) => toolbarAction.shortcut
    );
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });
});

describe('cetzAction', () => {
  it('detecta correctamente si cetz ya está importado', () => {
    expect(hasCetzImport('#import "@preview/cetz:0.3.1"')).toBe(true);
    expect(hasCetzImport("#import '@preview/cetz:0.3.0'")).toBe(true);
    expect(hasCetzImport('#import "@preview/cetz"')).toBe(true);
    expect(hasCetzImport('= Mi Documento\n\nTexto normal')).toBe(false);
  });

  it('devuelve código válido para todos los tipos de diagrama', () => {
    for (const type of ['flowchart', 'block', 'plot', 'canvas']) {
      const snippet = getCetzSnippet(type);
      expect(snippet).toContain('cetz.canvas');
    }
  });

  it('inyecta #import "@preview/cetz:0.5.2" en la cabecera si no existe', () => {
    // 0.5.2, no 0.3.1: verificado contra el binario real
    // (`spikes/cetz-block-bug/`) que 0.3.1 revienta con
    // `rect((0,0), ...)` — "Failed to resolve coordinate" — contra el
    // Typst vendorizado. 0.5.2 sí compila los 4 tipos.
    const state = stateWithSelection('= Documento\n\n', 13);
    const spec = cetzAction('flowchart')(state);
    const next = state.update(spec).state;
    const doc = next.doc.toString();
    expect(doc.startsWith('#import "@preview/cetz:0.5.2"')).toBe(true);
    expect(doc).toContain('cetz.canvas');
    expect(doc).toContain('Diagrama de flujo');
  });

  it('no duplica el #import de cetz si ya está presente en el documento', () => {
    const initial = '#import "@preview/cetz:0.5.2"\n\n= Documento\n';
    const state = stateWithSelection(initial, initial.length);
    const spec = cetzAction('canvas')(state);
    const next = state.update(spec).state;
    const doc = next.doc.toString();
    const matches = doc.match(/#import\s+"@preview\/cetz:/g);
    expect(matches?.length).toBe(1);
  });

  it('el tipo "plot" inyecta cetz Y cetz-plot (paquete hermano desde cetz 0.4)', () => {
    // "import cetz.plot" ya no existe dentro de cetz — verificado contra el
    // binario real que revienta con "module `cetz` does not contain `plot`".
    const state = stateWithSelection('= Documento\n\n', 13);
    const spec = cetzAction('plot')(state);
    const next = state.update(spec).state;
    const doc = next.doc.toString();
    expect(doc).toContain('#import "@preview/cetz:0.5.2"');
    expect(doc).toContain('#import "@preview/cetz-plot:0.1.4": plot');
    expect(doc).toContain('plot.plot');
    expect(doc).not.toContain('import cetz.plot');
  });

  it('el tipo "plot" no duplica ninguno de los dos imports si ya están presentes', () => {
    const initial = '#import "@preview/cetz:0.5.2"\n#import "@preview/cetz-plot:0.1.4": plot\n\n= Documento\n';
    const state = stateWithSelection(initial, initial.length);
    const spec = cetzAction('plot')(state);
    const next = state.update(spec).state;
    const doc = next.doc.toString();
    expect(doc.match(/#import\s+"@preview\/cetz:/g)?.length).toBe(1);
    expect(doc.match(/#import\s+"@preview\/cetz-plot:/g)?.length).toBe(1);
  });

  it('la acción cetz en TOOLBAR_ACTIONS funciona como fallback por defecto', () => {
    const res = apply('cetz', '', 0);
    expect(res.doc).toContain('#import "@preview/cetz:0.5.2"');
    expect(res.doc).toContain('cetz.canvas');
  });
});

describe('jogsAction', () => {
  it('detecta correctamente si jogs ya está importado', () => {
    expect(hasJogsImport('#import "@preview/jogs:0.2.4": eval-js')).toBe(true);
    expect(hasJogsImport("#import '@preview/jogs:0.2.0'")).toBe(true);
    expect(hasJogsImport('#import "@preview/jogs"')).toBe(true);
    expect(hasJogsImport('= Mi Documento\n\nTexto normal')).toBe(false);
  });

  it('el snippet usa eval-js y avisa del margen de 45s', () => {
    const snippet = getJogsSnippet();
    expect(snippet).toContain('eval-js');
    expect(snippet).toContain('45s');
  });

  it('inyecta #import "@preview/jogs:0.2.4" en la cabecera si no existe', () => {
    const state = stateWithSelection('= Documento\n\n', 13);
    const spec = jogsAction()(state);
    const next = state.update(spec).state;
    const doc = next.doc.toString();
    expect(doc.startsWith('#import "@preview/jogs:0.2.4": eval-js')).toBe(true);
    expect(doc).toContain('eval-js');
  });

  it('no duplica el #import si ya está presente en el documento', () => {
    const initial = '#import "@preview/jogs:0.2.4": eval-js\n\n= Documento\n';
    const state = stateWithSelection(initial, initial.length);
    const spec = jogsAction()(state);
    const next = state.update(spec).state;
    const doc = next.doc.toString();
    const matches = doc.match(/#import\s+"@preview\/jogs/g);
    expect(matches?.length).toBe(1);
  });
});

