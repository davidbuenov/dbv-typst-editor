// =============================================================================
// DBV Typst Editor — Snippets de usuario en el autocompletado (RF-81.3)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Fuente de autocompletado propia, que se suma a la de Tinymist y funciona sin
// ella. El cuerpo pasa por `lspSnippetToCodeMirror` (RF-74, ya probado con las
// llaves de Typst, elecciones y placeholders anidados) tras sustituir las
// variables admitidas (R-N2), así que un snippet copiado de VS Code se inserta
// con sus campos y Tab salta entre ellos.

import { snippet } from '@codemirror/autocomplete';
import { lspSnippetToCodeMirror } from '../editor/lspClient.js';
import { resolveVariables, snippetStore } from './model.js';

/** Vista previa del cuerpo: sin marcas de campos, recortada. */
export function previewBody(body) {
  const plain = body.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\{?\d+\}?/g, '');
  return plain.length > 400 ? `${plain.slice(0, 400)}…` : plain;
}

/**
 * @param {() => import('./model.js').Snippet[]} [getSnippets]
 * @param {() => string | null} [getPath] Fichero abierto (para `TM_FILENAME`).
 * @returns {import('@codemirror/autocomplete').CompletionSource}
 */
export function createSnippetCompletionSource(getSnippets = () => snippetStore.all(), getPath = () => null) {
  return (context) => {
    const snippets = getSnippets();
    const word = context.matchBefore(/[#@]?[\p{L}\p{N}_\-.:]*/u);
    if (snippets.length === 0 || !word || (word.from === word.to && !context.explicit)) return null;
    const fileName = (getPath() ?? '').split(/[\\/]/).pop() ?? '';
    return {
      from: word.from,
      options: snippets.map((item) => ({
        label: item.prefix,
        detail: item.description,
        type: 'snippet',
        info: previewBody(item.body),
        // Debajo de Tinymist cuando empatan: los propios se ven, sin tapar.
        boost: item.origin === 'project' ? -1 : -2,
        apply(view, completion, from, to) {
          const selection = view.state.selection.main;
          const selectedText = selection.empty ? '' : view.state.sliceDoc(selection.from, selection.to);
          const body = resolveVariables(item.body, { selectedText, fileName });
          snippet(lspSnippetToCodeMirror(body))(view, completion, from, to);
        },
      })),
    };
  };
}
