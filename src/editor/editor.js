// =============================================================================
// DBV Typst Editor — Editor de documento
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Fachada del editor. El Slice 3 la implementa con un `<textarea>` —suficiente
// para validar el modelo de Proyecto— y el Slice 4 sustituye su interior por
// CodeMirror 6 sin tocar a quien la consume: `createEditor()` mantiene el mismo
// contrato (`setDocument`/`getContent`/`onChange`/`focus`).

/**
 * @param {HTMLElement} hostEl Contenedor donde vive el editor.
 * @param {{onChange?: (content: string) => void}} [options]
 */
export function createEditor(hostEl, { onChange } = {}) {
  if (!(hostEl instanceof HTMLElement)) {
    throw new TypeError('createEditor: hostEl debe ser un HTMLElement');
  }

  const textarea = document.createElement('textarea');
  textarea.className = 'editor__area';
  textarea.spellcheck = false;
  textarea.setAttribute('aria-label', 'Typst');
  hostEl.replaceChildren(textarea);

  let currentPath = null;
  // Distingue "el usuario ha escrito" de "hemos cargado un documento": sin
  // esta bandera, cargar un fichero marcaría el documento como modificado.
  let loading = false;

  textarea.addEventListener('input', () => {
    if (loading) return;
    onChange?.(textarea.value);
  });

  return {
    /** Carga un documento sin disparar `onChange`. */
    setDocument(content, path) {
      loading = true;
      textarea.value = content;
      currentPath = path ?? null;
      loading = false;
    },
    getContent: () => textarea.value,
    getPath: () => currentPath,
    setReadOnly(readOnly) {
      textarea.readOnly = readOnly;
    },
    focus() {
      textarea.focus();
    },
  };
}
