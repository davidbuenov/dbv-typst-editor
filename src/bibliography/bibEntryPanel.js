// =============================================================================
// DBV Typst Editor — Panel "Nueva entrada bibliográfica" (Beta, §7.11)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Se abre desde el desplegable de citas (Slice 16): "no encuentro la fuente
// que busco" es justo el momento en que hace falta crearla, así que cierra el
// círculo insertando la cita nueva al guardar, en vez de dejar al usuario
// volver a abrir el desplegable a mano.
//
// Siempre escribe en `refs.bib` en la raíz del proyecto — la convención que
// usan las 8 plantillas curadas. Si el proyecto no lo tiene todavía (viene de
// una plantilla en blanco, o es un proyecto ajeno), lo crea; si ya existe,
// añade la entrada al final sin tocar lo que ya había.

import { joinPath } from '../app/paths.js';
import { t } from '../i18n/i18n.js';
import { registerPanel } from '../panels/registerPanel.js';
import { getBibliographyKeys, readFile, writeFile } from '../services/backend.js';
import { BIB_ENTRY_TYPES, serializeBibEntry, suggestBibKey, validateBibFields } from './bibEntryForm.js';

const REFS_FILE_NAME = 'refs.bib';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl
 * @param {HTMLSelectElement} deps.typeEl
 * @param {HTMLInputElement} deps.keyEl
 * @param {HTMLElement} deps.fieldsEl Contenedor donde se pintan los campos del tipo elegido.
 * @param {HTMLElement} deps.errorEl
 * @param {HTMLButtonElement} deps.saveButtonEl
 * @param {HTMLButtonElement} deps.cancelButtonEl
 * @param {() => string | null} deps.getRoot
 * @param {() => import('@codemirror/view').EditorView | null} deps.getView
 * @param {(message: string, tone?: 'info'|'error') => void} deps.notify
 */
export function createBibEntryPanel({
  panelEl,
  typeEl,
  keyEl,
  fieldsEl,
  errorEl,
  saveButtonEl,
  cancelButtonEl,
  getRoot,
  getView,
  notify,
}) {
  /** @type {Map<string, HTMLInputElement>} */
  let fieldInputs = new Map();
  // Mientras el usuario no toque la clave a mano, se sigue recalculando sola
  // según escribe autor/año — en cuanto la edita, deja de tocarse.
  let keyEditedByUser = false;

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function hideError() {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  function currentType() {
    return BIB_ENTRY_TYPES.find((type) => type.id === typeEl.value) ?? BIB_ENTRY_TYPES[0];
  }

  function readValues() {
    const values = {};
    for (const [key, input] of fieldInputs) values[key] = input.value;
    return values;
  }

  function refreshSuggestedKey() {
    if (keyEditedByUser) return;
    const values = readValues();
    keyEl.value = suggestBibKey(values.author ?? '', values.year ?? '');
  }

  function renderFields() {
    fieldsEl.replaceChildren();
    fieldInputs = new Map();

    for (const field of currentType().fields) {
      const row = document.createElement('label');
      row.className = 'form-row';

      const caption = document.createElement('span');
      caption.className = 'form-row__label';
      caption.textContent = `${t(field.i18nKey)}${field.required ? ' *' : ''}`;
      row.append(caption);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-row__input';
      input.addEventListener('input', refreshSuggestedKey);
      row.append(input);

      fieldsEl.append(row);
      fieldInputs.set(field.key, input);
    }
  }

  async function save() {
    hideError();
    const root = getRoot();
    if (!root) return;

    const typeId = typeEl.value;
    const key = keyEl.value.trim();
    const values = readValues();

    if (!key) {
      showError(t('bibEntry.errorNoKey'));
      return;
    }
    const missing = validateBibFields(typeId, values);
    if (missing.length > 0) {
      showError(t('bibEntry.errorMissingFields'));
      return;
    }

    const existingKeys = await getBibliographyKeys(root);
    if (existingKeys.ok && existingKeys.value.keys.includes(key)) {
      showError(t('bibEntry.errorDuplicateKey'));
      return;
    }

    const entryText = serializeBibEntry(typeId, key, values);
    const path = joinPath(root, REFS_FILE_NAME);
    const current = await readFile(path);
    // Sin `refs.bib` todavía (plantilla en blanco, proyecto ajeno...): se crea
    // con esta primera entrada — no es un error, es el caso esperado.
    const currentContent = current.ok ? current.value.content : '';
    const needsBlankLine = currentContent !== '' && !currentContent.endsWith('\n\n');
    const separator = currentContent === '' ? '' : needsBlankLine ? (currentContent.endsWith('\n') ? '\n' : '\n\n') : '';

    const written = await writeFile(path, currentContent + separator + entryText);
    if (!written.ok) {
      showError(`${t('bibEntry.errorSave')} — ${written.error.message}`);
      return;
    }

    const view = getView();
    if (view) {
      const { from, to } = view.state.selection.main;
      const insert = `#cite(<${key}>)`;
      view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length } });
      view.focus();
    }

    notify(`${t('bibEntry.saved')} ${key}`);
    panel.close();
  }

  const panel = registerPanel(panelEl, {
    closeOnOutsideClick: false, // formulario con varios campos: un clic fuera sin querer no debe tirarlo
    onOpen: () => {
      hideError();
      keyEditedByUser = false;
      typeEl.value = BIB_ENTRY_TYPES[0].id;
      renderFields();
      refreshSuggestedKey();
    },
  });

  typeEl.addEventListener('change', renderFields);
  keyEl.addEventListener('input', () => {
    keyEditedByUser = true;
  });
  saveButtonEl.addEventListener('click', save);
  cancelButtonEl.addEventListener('click', panel.close);

  return { open: panel.open, close: panel.close };
}
