// =============================================================================
// DBV Typst Editor — «Guardar selección como snippet…» (RF-81.7)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Añade una entrada al fichero de snippets tocando SOLO ese tramo del texto
// (`modify` + `applyEdits` de `jsonc-parser`): los comentarios y el formato
// del usuario se conservan (R-N1). Si el fichero tiene errores de sintaxis no
// se escribe nada: reescribirlo podría perder lo que el usuario tenía.

import { applyEdits, modify, parse } from 'jsonc-parser';
import { escapeSnippetText } from './model.js';

/**
 * Cuerpo del snippet a partir del texto seleccionado: `$`, `}` y `\` se
 * escapan para que se inserte literal (R-N2); varias líneas → lista.
 * @param {string} text
 * @returns {string | string[]}
 */
export function selectionToBody(text) {
  const lines = escapeSnippetText(text).split(/\r?\n/);
  return lines.length === 1 ? lines[0] : lines;
}

/**
 * Añade `{prefix, body, description}` con el nombre `name` (o `name 2`, `name
 * 3`… si ya existe) al texto de un fichero de snippets.
 * @param {string} text
 * @param {{name: string, prefix: string, description: string, body: string | string[], scope?: string}} entry
 * @returns {{ok: true, text: string, name: string} | {ok: false, reason: 'invalid'}}
 */
export function addSnippetToText(text, entry) {
  const errors = [];
  const source = text.trim() === '' ? '{}\n' : text;
  const data = parse(source, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length > 0 || !data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'invalid' };
  let name = entry.name;
  for (let n = 2; Object.prototype.hasOwnProperty.call(data, name); n += 1) name = `${entry.name} ${n}`;
  const value = { prefix: entry.prefix, body: entry.body, description: entry.description, ...(entry.scope ? { scope: entry.scope } : {}) };
  const edits = modify(source, [name], value, {
    formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' },
  });
  return { ok: true, text: applyEdits(source, edits), name };
}

/**
 * Diálogo de «Guardar selección como snippet…»: nombre, prefijo, descripción
 * y destino. Resuelve con los datos o `null` si se cancela.
 * @param {object} deps
 * @param {Record<string, HTMLElement>} deps.elements dialog, form, name, prefix, description, destination, error, cancel
 * @param {(key: string) => string} deps.t
 */
export function createSnippetDialog({ elements, t }) {
  let pending = null;
  const finish = (value) => {
    elements.dialog.classList.add('hidden');
    const resolve = pending;
    pending = null;
    resolve?.(value);
  };
  const showError = (message) => {
    elements.error.textContent = message ?? '';
    elements.error.classList.toggle('hidden', !message);
  };
  elements.cancel.addEventListener('click', () => finish(null));
  elements.dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && pending) {
      event.stopPropagation();
      finish(null);
    }
  });
  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = elements.name.value.trim();
    const prefix = elements.prefix.value.trim();
    if (!name || !prefix) {
      showError(t('snippets.needsNameAndPrefix'));
      (name ? elements.prefix : elements.name).focus();
      return;
    }
    finish({ name, prefix, description: elements.description.value.trim() || name, destination: elements.destination.value });
  });

  return {
    /**
     * @param {{hasProject: boolean}} options
     * @returns {Promise<null | {name: string, prefix: string, description: string, destination: 'global' | 'project'}>}
     */
    open({ hasProject }) {
      showError(null);
      for (const field of [elements.name, elements.prefix, elements.description]) field.value = '';
      const projectOption = elements.destination.querySelector('option[value="project"]');
      if (projectOption) projectOption.disabled = !hasProject;
      elements.destination.value = hasProject ? 'project' : 'global';
      elements.dialog.classList.remove('hidden');
      elements.name.focus();
      return new Promise((resolve) => {
        pending = resolve;
      });
    },
  };
}
