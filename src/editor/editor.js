// =============================================================================
// DBV Typst Editor — Editor de documento (CodeMirror 6)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// RF-05 / ADR-EDITOR-001. Sustituye al `<textarea>` del Slice 3 conservando
// exactamente el mismo contrato (`setDocument`/`getContent`/`onChange`/`focus`),
// que es justo el motivo por el que el Slice 3 lo definió como fachada.
//
// Modo de lenguaje (riesgo R-02 del plan, resuelto por el spike del Slice 4):
// se usa el parser Lezer nativo de `codemirror-lang-typst` (`typst_lezer`), NO
// su variante por WASM. Motivos: no arrastra un binario WebAssembly al bundle
// —lo que contradiría el argumento de instalador ligero—, y aun así da árbol
// sintáctico real de Typst 0.15, plegado, indentación y autocompletado de las
// funciones y símbolos integrados. El plan B (gramática propia mínima) queda
// descartado: habría sido estrictamente peor.

import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import {
  TypstHighlightSytle,
  typstLezerListKeymap,
  typst_lezer,
} from 'codemirror-lang-typst/lezer';

/**
 * Tema del editor construido sobre los tokens CSS de la aplicación
 * (`themes/tokens.css`): al cambiar de claro a oscuro no hay que redefinir
 * colores aquí, basta con reconfigurar el flag `dark` que CodeMirror usa para
 * sus propios ajustes internos (cursor, selección, gutter activo).
 */
function buildTheme(isDark) {
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontSize: '13px',
      },
      '.cm-scroller': {
        fontFamily: 'var(--font-mono)',
        lineHeight: '1.6',
        overflow: 'auto',
      },
      '.cm-content': { padding: '12px 0', caretColor: 'var(--accent)' },
      '.cm-gutters': {
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-muted)',
        border: 'none',
        borderRight: '1px solid var(--border)',
      },
      '.cm-activeLine': { backgroundColor: 'var(--quote-bg)' },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-secondary)',
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'var(--bg-tertiary)',
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
      '.cm-panels': {
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        borderColor: 'var(--border)',
      },
      '.cm-panels input, .cm-panels button': {
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        fontFamily: 'inherit',
        padding: '2px 6px',
      },
      '.cm-searchMatch': { backgroundColor: 'var(--quote-bg)', outline: '1px solid var(--accent)' },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--bg-tertiary)' },
      '.cm-tooltip': {
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: 'var(--accent)',
        color: '#fff',
      },
    },
    { dark: isDark }
  );
}

/**
 * @param {HTMLElement} hostEl Contenedor donde se monta el editor.
 * @param {object} [options]
 * @param {(content: string) => void} [options.onChange] Cambio hecho por el usuario.
 * @param {() => void} [options.onSave] Atajo de guardado (Ctrl/Cmd+S).
 * @param {'dark'|'light'} [options.theme] Tema inicial.
 */
export function createEditor(hostEl, { onChange, onSave, theme = 'dark' } = {}) {
  if (!(hostEl instanceof HTMLElement)) {
    throw new TypeError('createEditor: hostEl debe ser un HTMLElement');
  }

  const themeCompartment = new Compartment();
  const readOnlyCompartment = new Compartment();
  // El historial vive en su propio compartimento por un motivo concreto: al
  // abrir otro documento hay que VACIARLO. Si no, un Ctrl+Z justo después de
  // cambiar de fichero deshace hasta el texto del documento anterior y lo
  // escribe encima del nuevo — una forma silenciosa de destruir trabajo.
  const historyCompartment = new Compartment();

  let currentPath = null;
  // Distingue "el usuario ha escrito" de "hemos cargado un documento": sin esta
  // bandera, abrir un fichero lo marcaría inmediatamente como modificado.
  let loading = false;

  const saveKeymap = keymap.of([
    {
      key: 'Mod-s',
      preventDefault: true,
      run: () => {
        onSave?.();
        return true;
      },
    },
  ]);

  const view = new EditorView({
    parent: hostEl,
    state: EditorState.create({
      doc: '',
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        historyCompartment.of(history()),
        foldGutter(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightSelectionMatches(),
        search({ top: true }),
        autocompletion(),
        EditorView.lineWrapping,
        typst_lezer(),
        syntaxHighlighting(TypstHighlightSytle),
        // El orden importa: el atajo de guardado va primero para que gane a
        // cualquier binding por defecto que pudiera capturar Mod-s.
        saveKeymap,
        keymap.of([
          ...closeBracketsKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...typstLezerListKeymap,
          ...defaultKeymap,
          indentWithTab,
        ]),
        themeCompartment.of(buildTheme(theme === 'dark')),
        readOnlyCompartment.of(EditorState.readOnly.of(false)),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || loading) return;
          onChange?.(update.state.doc.toString());
        }),
      ],
    }),
  });

  return {
    /** Carga un documento sin disparar `onChange` ni conservar el historial. */
    setDocument(content, path) {
      loading = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
        selection: { anchor: 0 },
      });
      // Reconfigurar el compartimento descarta el historial acumulado y vuelve
      // a instalarlo vacío: deshacer en el documento recién abierto ya no puede
      // llegar al contenido del anterior.
      view.dispatch({ effects: historyCompartment.reconfigure([]) });
      view.dispatch({ effects: historyCompartment.reconfigure(history()) });
      currentPath = path ?? null;
      loading = false;
    },
    getContent: () => view.state.doc.toString(),
    getPath: () => currentPath,
    setReadOnly(readOnly) {
      view.dispatch({
        effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
      });
    },
    /** @param {'dark'|'light'} nextTheme */
    setTheme(nextTheme) {
      view.dispatch({
        effects: themeCompartment.reconfigure(buildTheme(nextTheme === 'dark')),
      });
    },
    focus() {
      view.focus();
    },
    /** Inserta texto en la posición del cursor (asistentes de inserción, Beta). */
    insertAtCursor(text) {
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      });
      view.focus();
    },
    destroy() {
      view.destroy();
    },
  };
}
