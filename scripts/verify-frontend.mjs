#!/usr/bin/env node
// =============================================================================
// DBV Typst Editor — Verificación del frontend sin navegador
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Existe por un fallo real: en el Slice 4 se usó `typstLezerListKeymap` como si
// fuera un array de atajos (`...typstLezerListKeymap`) cuando el paquete lo
// exporta ya como extensión de CodeMirror. El `vite build`, los 77 tests de Rust
// y las 28 comprobaciones contra el compilador pasaban en verde, y el error solo
// apareció al abrir la ventana: "TypeError: typstLezerListKeymap is not
// iterable", con la interfaz muerta detrás.
//
// La clave para poder comprobarlo sin navegador: `EditorState.create()` resuelve
// y valida la lista COMPLETA de extensiones sin tocar el DOM (solo `EditorView`
// necesita ventana). Así que aquí se construye el estado real del editor, con
// las mismas extensiones que usa la aplicación, y se ejercitan las operaciones
// que dependen de que esa configuración esté bien formada.
//
// Cubre además la otra causa habitual de "ventana en blanco" en esta app: un
// `getElementById` que devuelve `null` porque el id no existe en `index.html`.
// El fallo es idéntico de ver (una excepción durante el arranque y una interfaz
// muerta) y hasta ahora nada lo detectaba antes de abrir la ventana.
//
// Sin dependencias nuevas: usa las que ya trae el proyecto.

import { ensureSyntaxTree, language as languageFacet } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildExtensions } from '../src/editor/editor.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const results = [];
const record = (ok, message, detail = '') => {
  results.push({ ok, message });
  console.log(`${ok ? '  OK  ' : ' FALLO'}  ${message}${detail ? ` — ${detail}` : ''}`);
};

function check(message, run) {
  try {
    const detail = run();
    record(true, message, detail ?? '');
  } catch (error) {
    record(false, message, error.message);
  }
}

/** Construye el estado del editor igual que lo hace `createEditor`. */
function createState(doc = '') {
  return EditorState.create({
    doc,
    extensions: buildExtensions({
      themeCompartment: new Compartment(),
      readOnlyCompartment: new Compartment(),
      historyCompartment: new Compartment(),
      saveKeymap: keymap.of([{ key: 'Mod-s', run: () => true }]),
      updateListener: EditorView.updateListener.of(() => {}),
      isDark: true,
    }),
  });
}

console.log('Verificación del frontend sin navegador\n');

check('todos los elementos que busca el arranque existen en index.html', () => {
  const html = readFileSync(join(ROOT, 'src', 'index.html'), 'utf8');
  const sources = ['main.js', 'app/workspace.js', 'preview/preview.js'].map((file) =>
    readFileSync(join(ROOT, 'src', file), 'utf8')
  );

  // Ids declarados en el HTML, con comillas simples o dobles.
  const declared = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));

  // Ids que el frontend pide: el atajo `el('x')` y `document.getElementById('x')`.
  const requested = new Set();
  for (const source of sources) {
    for (const match of source.matchAll(/\bel\((["'])([^"']+)\1\)/g)) requested.add(match[2]);
    for (const match of source.matchAll(/getElementById\((["'])([^"']+)\1\)/g)) {
      requested.add(match[2]);
    }
  }

  const missing = [...requested].filter((id) => !declared.has(id));
  if (missing.length > 0) {
    throw new Error(`ids ausentes en index.html: ${missing.join(', ')}`);
  }
  return `${requested.size} elementos comprobados`;
});

check('no se usan los diálogos nativos del WebView', () => {
  // `window.confirm`, `alert` y `prompt` NO son gratis en un WebView de Tauri:
  // el plugin de diálogos los intercepta y exige permisos explícitos
  // (`dialog:allow-confirm`...), así que fallan en tiempo de ejecución con
  // "dialog.confirm not allowed" — que es como se descubrió esto. La aplicación
  // usa su propio modal (`ui/choiceDialog.js`), traducido y con el tema puesto.
  const sources = ['main.js', 'app/workspace.js', 'preview/preview.js', 'project-wizard/wizard.js']
    .map((file) => [file, readFileSync(join(ROOT, 'src', file), 'utf8')]);

  const offenders = [];
  for (const [file, source] of sources) {
    for (const [index, line] of source.split('\n').entries()) {
      // Se ignoran los comentarios: este mismo fichero y el de workspace
      // explican por escrito por qué no se usan.
      const code = line.replace(/\/\/.*$/, '');
      if (/\b(?:window\.)?(?:confirm|alert|prompt)\s*\(/.test(code)) {
        offenders.push(`${file}:${index + 1}`);
      }
    }
  }
  if (offenders.length > 0) {
    throw new Error(`diálogos nativos en ${offenders.join(', ')}`);
  }
  return `${sources.length} ficheros revisados`;
});

check('la lista de extensiones se resuelve sin errores', () => {
  const state = createState('= Hola');
  return `${state.doc.toString()}`;
});

check('el tema claro también resuelve', () => {
  EditorState.create({
    doc: '',
    extensions: buildExtensions({
      themeCompartment: new Compartment(),
      readOnlyCompartment: new Compartment(),
      historyCompartment: new Compartment(),
      saveKeymap: keymap.of([{ key: 'Mod-s', run: () => true }]),
      updateListener: EditorView.updateListener.of(() => {}),
      isDark: false,
    }),
  });
});

check('el modo de lenguaje Typst está instalado en el estado', () => {
  const state = createState('#let x = 1');
  const language = state.facet(languageFacet);
  if (!language) throw new Error('no hay lenguaje activo en el estado');
  return language.name || 'lenguaje presente';
});

check('el parser de Typst produce un árbol sintáctico real', () => {
  // Es la comprobación que distingue "el paquete de lenguaje carga" de "el
  // paquete de lenguaje entiende Typst": sin nodos reconocidos, el resaltado
  // saldría plano aunque la extensión se hubiera resuelto sin errores.
  const state = createState('= Título\n\n#let suma(a, b) = a + b\n\n$ E = m c^2 $\n');
  const tree = ensureSyntaxTree(state, state.doc.length, 5000);
  if (!tree) throw new Error('no se pudo construir el árbol sintáctico');

  const nodes = new Set();
  tree.iterate({
    enter: (node) => {
      nodes.add(node.name);
    },
  });
  if (nodes.size <= 1) {
    throw new Error(`el árbol no reconoce estructura: ${[...nodes].join(', ')}`);
  }
  return `${nodes.size} tipos de nodo reconocidos`;
});

check('una edición produce un estado nuevo coherente', () => {
  const state = createState('= Título');
  const next = state.update({ changes: { from: 8, insert: ' nuevo' } }).state;
  if (next.doc.toString() !== '= Título nuevo') {
    throw new Error(`documento inesperado: ${next.doc.toString()}`);
  }
  return next.doc.toString();
});

check('el modo de solo lectura se puede activar', () => {
  const state = EditorState.create({ extensions: [EditorState.readOnly.of(true)] });
  if (!state.readOnly) throw new Error('readOnly no se aplicó');
});

const failed = results.filter((entry) => !entry.ok).length;
console.log(`\n${results.length - failed}/${results.length} comprobaciones en verde`);
process.exit(failed === 0 ? 0 : 1);
