// =============================================================================
// DBV Typst Editor — Asistente de creación de proyecto
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// RF-03 / ARCHITECTURE.md §7.6.4. Diferenciador de producto explícito: el
// usuario debe sentir que **crea un documento**, no que inicializa un paquete.
// De ahí que el formulario hable de "título" y "tutor" y no de `typst init`.
//
// El formulario se genera desde `dbv-template.toml` de la plantilla elegida. Si
// la plantilla no trae sidecar —caso de las comunitarias en Beta— el asistente
// pide solo el nombre y la ubicación y crea el proyecto tal cual: degradación
// limpia a "scaffolding puro", nunca un error.

import { getLanguage, t } from '../i18n/i18n.js';
import { createProject, createProjectFromUniverse, pickProjectFolder } from '../services/backend.js';
import { localizeTemplate } from '../launcher/launcher.js';

/** Campo de nombre de proyecto, común a todas las plantillas. */
const PROJECT_NAME_KEY = '__projectName';

/**
 * Valida los campos del formulario contra las reglas del sidecar.
 *
 * Función pura, separada del DOM: es la regla de negocio del asistente y
 * conviene poder razonar sobre ella sin montar la interfaz.
 * @returns {string[]} Claves de los campos inválidos (vacío = todo correcto).
 */
export function validateFields(fields, values) {
  const invalid = [];
  for (const field of fields) {
    const value = (values[field.key] ?? '').trim();
    const { required, maxLength } = field.validation ?? {};
    if (required && value === '') invalid.push(field.key);
    else if (maxLength && value.length > maxLength) invalid.push(field.key);
  }
  return invalid;
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.dialogEl
 * @param {HTMLElement} deps.titleEl
 * @param {HTMLElement} deps.descriptionEl
 * @param {HTMLElement} deps.formEl
 * @param {HTMLElement} deps.locationEl Texto con la carpeta destino elegida.
 * @param {HTMLButtonElement} deps.browseButton
 * @param {HTMLButtonElement} deps.createButton
 * @param {HTMLButtonElement} deps.cancelButton
 * @param {HTMLElement} deps.errorEl
 * @param {(message: string, tone?: 'info'|'error') => void} deps.notify
 * @param {(project: object) => void} deps.onCreated
 */
export function createWizard(deps) {
  const {
    dialogEl,
    titleEl,
    descriptionEl,
    formEl,
    locationEl,
    browseButton,
    createButton,
    cancelButton,
    errorEl,
    notify,
    onCreated,
  } = deps;

  let template = null;
  let parentDir = null;
  let busy = false;

  const close = () => {
    dialogEl.classList.add('hidden');
    template = null;
  };

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function hideError() {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  /** Construye una fila de formulario y devuelve su `<input>`. */
  function buildField({ key, label, placeholder, value = '' }) {
    const row = document.createElement('label');
    row.className = 'form-row';

    const caption = document.createElement('span');
    caption.className = 'form-row__label';
    caption.textContent = label;
    row.append(caption);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-row__input';
    input.name = key;
    input.value = value;
    if (placeholder) input.placeholder = placeholder;
    row.append(input);

    formEl.append(row);
    return input;
  }

  /** Lee el formulario. */
  function readValues() {
    const values = {};
    for (const input of formEl.querySelectorAll('input')) {
      values[input.name] = input.value;
    }
    return values;
  }

  function markInvalid(keys) {
    for (const input of formEl.querySelectorAll('input')) {
      input.classList.toggle('is-invalid', keys.includes(input.name));
    }
  }

  async function browse() {
    const picked = await pickProjectFolder();
    if (!picked.ok || !picked.value) return;
    parentDir = picked.value;
    locationEl.textContent = parentDir;
  }

  async function create() {
    if (!template || busy) return;
    hideError();

    const values = readValues();
    const projectName = (values[PROJECT_NAME_KEY] ?? '').trim();
    if (projectName === '') {
      markInvalid([PROJECT_NAME_KEY]);
      showError(t('wizard.nameRequired'));
      return;
    }
    if (!parentDir) {
      showError(t('wizard.locationRequired'));
      return;
    }

    const templateFields = template.dbv?.fields ?? [];
    const invalid = validateFields(templateFields, values);
    markInvalid(invalid);
    if (invalid.length > 0) {
      showError(t('wizard.fieldsInvalid'));
      return;
    }

    // Los valores del formulario van al proyecto como marcadores sustituibles;
    // el nombre de proyecto no es uno de ellos (es la carpeta), pero se ofrece
    // igualmente como `{{proyecto}}` porque muchas portadas lo usan.
    const fields = { proyecto: projectName };
    for (const field of templateFields) fields[field.key] = values[field.key] ?? '';

    busy = true;
    createButton.disabled = true;
    // Una plantilla de Universe se instancia con otro comando: mismo
    // `typst init`, pero con el namespace público y sin `--package-path`. No
    // trae `dbv-template.toml`, así que aquí no hay marcadores que sustituir.
    const result = template.universeSpec
      ? await createProjectFromUniverse({ spec: template.universeSpec, parentDir, projectName })
      : await createProject({
          templateName: template.name,
          templateVersion: template.version,
          parentDir,
          projectName,
          fields,
        });
    busy = false;
    createButton.disabled = false;

    if (!result.ok) {
      // `denied` es el caso concreto de "esa carpeta ya existe": merece un
      // mensaje propio, porque la acción correctiva del usuario es distinta.
      showError(
        result.error.kind === 'denied'
          ? `${t('wizard.folderExists')} — ${result.error.message}`
          : `${t('wizard.createError')} — ${result.error.message}`
      );
      return;
    }

    close();
    notify(t('wizard.created'));
    onCreated(result.value);
  }

  browseButton.addEventListener('click', browse);
  createButton.addEventListener('click', create);
  cancelButton.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !dialogEl.classList.contains('hidden')) close();
  });

  return {
    /** Abre el asistente para la plantilla dada. */
    open(selected) {
      template = selected;
      hideError();
      formEl.replaceChildren();

      const language = getLanguage();
      const { name, description } = localizeTemplate(selected, language);
      titleEl.textContent = name;
      descriptionEl.textContent = description;

      const nameInput = buildField({
        key: PROJECT_NAME_KEY,
        label: t('wizard.projectName'),
        placeholder: t('wizard.projectNamePlaceholder'),
      });

      for (const field of selected.dbv?.fields ?? []) {
        buildField({
          key: field.key,
          label: field.label || field.key,
          placeholder: field.placeholder ?? '',
          value: field.default ?? '',
        });
      }

      locationEl.textContent = parentDir ?? t('wizard.noLocation');
      dialogEl.classList.remove('hidden');
      nameInput.focus();
    },
    close,
  };
}
