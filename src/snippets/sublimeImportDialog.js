// =============================================================================
// DBV Typst Editor — Diálogo «Importar snippets de Sublime…» (RF-112)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Elegir ficheros `.sublime-snippet` (o una carpeta), ver el RESUMEN antes de escribir nada
// («N convertidos, M omitidos» con el motivo de cada omisión), elegir el destino —el proyecto
// por defecto, para compartirlos— y confirmar. Si el fichero de destino ya existe se pregunta
// si añadir o reemplazar y NUNCA se sobrescribe sin confirmar (RF-112.4). Todo el texto ajeno
// (nombres de fichero, motivos) entra por `textContent` (R-A4).

import { parseSnippetFile } from './model.js';
import { buildSnippetFile, convertBatch, mergeIntoFile, repeatedWithExisting } from './sublimeImport.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function radio(name, value, label, checked = false) {
  const wrapper = el('label', 'snippet-import__option');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = name;
  input.value = value;
  input.checked = checked;
  wrapper.append(input, el('span', '', label));
  return { wrapper, input };
}

/**
 * @param {object} deps
 * @param {{panel: HTMLElement, body: HTMLElement}} deps.elements
 * @param {{snippetsPickSublime: Function, snippetsReadSublime: Function, snippetsImportTarget: Function, snippetsWriteImported: Function}} deps.backend
 * @param {(key: string) => string} deps.t
 * @param {() => string|null} deps.getProjectRoot Raíz del proyecto abierto, o `null` (también con un documento suelto).
 * @param {() => void} deps.close
 * @param {(path: string, text: string, destination: string) => void | Promise<void>} deps.onImported
 * @param {(message: string, tone?: string) => void} deps.notify
 */
export function createSublimeImportDialog({ elements, backend, t, getProjectRoot, close, onImported, notify }) {
  let batch = null;
  let target = null;
  let truncated = false;

  const intro = el('p', 'snippet-import__intro', t('snippets.sublime.intro'));
  const pickFiles = el('button', 'button button--compact', t('snippets.sublime.pickFiles'));
  pickFiles.type = 'button';
  const pickFolder = el('button', 'button button--compact', t('snippets.sublime.pickFolder'));
  pickFolder.type = 'button';
  const picks = el('div', 'snippet-import__picks');
  picks.append(pickFiles, pickFolder);
  const summary = el('div', 'snippet-import__summary');
  summary.setAttribute('aria-live', 'polite');
  const details = el('div', 'snippet-import__details');
  const destinationBox = el('fieldset', 'snippet-import__destination hidden');
  const modeBox = el('fieldset', 'snippet-import__mode hidden');
  const message = el('p', 'snippet-import__message');
  message.setAttribute('aria-live', 'polite');
  const importButton = el('button', 'button button--primary button--compact', t('snippets.sublime.import'));
  importButton.type = 'button';
  importButton.disabled = true;
  const cancel = el('button', 'button button--compact button--ghost', t('action.cancel'));
  cancel.type = 'button';
  cancel.addEventListener('click', close);
  const actions = el('div', 'snippet-import__actions');
  actions.append(importButton, cancel);
  elements.body.replaceChildren(intro, picks, summary, details, destinationBox, modeBox, message, actions);
  elements.panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  const destination = () => destinationBox.querySelector('input:checked')?.value ?? 'global';
  const mode = () => modeBox.querySelector('input:checked')?.value ?? 'add';

  function reasonText(skip) {
    const base = t(`snippets.sublime.reason.${skip.reason}`);
    return skip.detail ? `${base} (${skip.detail})` : base;
  }

  function renderSummary() {
    details.replaceChildren();
    if (!batch) {
      summary.textContent = '';
      return;
    }
    summary.textContent = t('snippets.sublime.summary').replace('{ok}', String(batch.entries.length)).replace('{skipped}', String(batch.skipped.length));
    if (truncated) details.append(el('p', 'snippet-import__warn', t('snippets.sublime.truncated')));
    if (batch.skipped.length) {
      const list = el('ul', 'snippet-import__list');
      for (const skip of batch.skipped) list.append(el('li', '', `${skip.name} — ${reasonText(skip)}`));
      const box = el('details', 'snippet-import__skipped');
      box.append(el('summary', '', t('snippets.sublime.skippedTitle')), list);
      details.append(box);
    }
    for (const warning of batch.warnings) {
      details.append(el('p', 'snippet-import__warn', `${warning.name} — ${t(`snippets.sublime.warning.${warning.warning}`)}${warning.detail ? ` (${warning.detail})` : ''}`));
    }
  }

  async function refreshTarget() {
    target = null;
    modeBox.classList.add('hidden');
    modeBox.replaceChildren();
    message.textContent = '';
    importButton.disabled = true;
    if (!batch?.entries.length) return;
    const found = await backend.snippetsImportTarget(destination(), getProjectRoot());
    if (!found.ok) {
      message.className = 'snippet-import__message is-error';
      message.textContent = found.error?.message ?? '';
      return;
    }
    target = found.value;
    importButton.disabled = false;
    if (!target.exists) return;
    // Ya existe: añadir (por defecto) o reemplazar. En el fichero global NO se ofrece reemplazar: es el de sus snippets propios.
    modeBox.classList.remove('hidden');
    modeBox.append(el('legend', '', t('snippets.sublime.existsTitle')));
    modeBox.append(radio('sublime-mode', 'add', t('snippets.sublime.modeAdd'), true).wrapper);
    if (destination() === 'project') modeBox.append(radio('sublime-mode', 'replace', t('snippets.sublime.modeReplace')).wrapper);
    const existing = parseSnippetFile(target.content ?? '', 'project');
    const repeated = repeatedWithExisting(batch.entries, existing.snippets);
    if (repeated.length) {
      message.className = 'snippet-import__message is-warning';
      message.textContent = t('snippets.sublime.repeatedWithExisting').replace('{prefixes}', repeated.join(', '));
    }
  }

  function renderDestination() {
    destinationBox.replaceChildren(el('legend', '', t('snippets.sublime.destination')));
    const hasProject = Boolean(getProjectRoot());
    const project = radio('sublime-destination', 'project', t('snippets.sublime.destProject'), hasProject);
    project.input.disabled = !hasProject;
    const global = radio('sublime-destination', 'global', t('snippets.sublime.destGlobal'), !hasProject);
    destinationBox.append(project.wrapper, global.wrapper);
    destinationBox.classList.remove('hidden');
    for (const option of [project.input, global.input]) option.addEventListener('change', refreshTarget);
  }

  async function choose(folder) {
    const picked = await backend.snippetsPickSublime(folder);
    if (!picked.ok || !picked.value?.length) return;
    const read = await backend.snippetsReadSublime(picked.value);
    if (!read.ok) {
      message.className = 'snippet-import__message is-error';
      message.textContent = read.error?.message ?? '';
      return;
    }
    truncated = Boolean(read.value.truncated);
    batch = convertBatch(read.value.sources);
    renderSummary();
    renderDestination();
    await refreshTarget();
    if (!read.value.sources.length) summary.textContent = t('snippets.sublime.nothingFound');
  }

  pickFiles.addEventListener('click', () => choose(false));
  pickFolder.addEventListener('click', () => choose(true));

  importButton.addEventListener('click', async () => {
    if (!batch?.entries.length || !target) return;
    importButton.disabled = true;
    const replace = target.exists && mode() === 'replace';
    let text;
    if (target.exists && !replace) {
      const merged = mergeIntoFile(target.content ?? '', batch.entries);
      if (!merged.ok) {
        message.className = 'snippet-import__message is-error';
        message.textContent = t('snippets.sublime.existingInvalid');
        importButton.disabled = false;
        return;
      }
      text = merged.text;
    } else text = buildSnippetFile(batch.entries);
    // `overwrite` solo cuando el usuario eligió añadir o reemplazar sobre un fichero que ya existía.
    const written = await backend.snippetsWriteImported(destination(), getProjectRoot(), text, target.exists);
    if (!written.ok) {
      message.className = 'snippet-import__message is-error';
      message.textContent = written.error?.message ?? '';
      importButton.disabled = false;
      return;
    }
    await onImported(written.value, text, destination());
    notify(t('snippets.sublime.done').replace('{n}', String(batch.entries.length)).replace('{file}', written.value.split(/[\\/]/).pop()));
    close();
  });

  return {
    open() {
      batch = null;
      target = null;
      truncated = false;
      destinationBox.classList.add('hidden');
      modeBox.classList.add('hidden');
      importButton.disabled = true;
      message.textContent = '';
      renderSummary();
      pickFiles.focus();
    },
  };
}
