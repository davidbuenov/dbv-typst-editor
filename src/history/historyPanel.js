// =============================================================================
// DBV Typst Editor — Panel del historial local (RF-73)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Lista las versiones que `history.rs` guardó de un fichero, las compara con
// el contenido actual (el modal de diferencias de RF-19) y restaura una. Restaurar
// NUNCA escribe en disco: pone la versión en el editor como cambio sin guardar,
// que se deshace con Ctrl+Z como cualquier otro.

import { t } from '../i18n/i18n.js';
import { historyList, historyRead, readFile } from '../services/backend.js';

const REASON_KEYS = {
  save: 'history.reasonSave',
  auto: 'history.reasonAuto',
  reload: 'history.reasonReload',
  refs: 'history.reasonRefs',
};

/**
 * Texto de una versión: cuándo, por qué y cuánto ocupa.
 * @param {{id: number, reason: string, size: number}} version
 * @param {string} [locale]
 */
export function describeVersion(version, locale) {
  const when = new Date(version.id).toLocaleString(locale);
  const reason = t(REASON_KEYS[version.reason] ?? 'history.reasonSave');
  const size = version.size < 1024 ? `${version.size} B` : `${(version.size / 1024).toFixed(1)} KB`;
  return { when, reason, size };
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.dialogEl
 * @param {HTMLElement} deps.fileEl
 * @param {HTMLElement} deps.listEl
 * @param {HTMLElement} deps.closeEl
 * @param {{open: Function}} deps.diffModal
 * @param {{getOpenDocumentPath?: Function, getDocumentPath: () => string | null, getContent: () => string, restoreVersion: (path: string, content: string) => Promise<boolean>}} deps.workspace
 * @param {(message: string, tone?: string) => void} deps.notify
 */
export function createHistoryPanel({ dialogEl, fileEl, listEl, closeEl, diffModal, workspace, notify }) {
  const close = () => dialogEl.classList.add('hidden');
  closeEl.addEventListener('click', close);
  dialogEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  /** Contenido actual: el del editor si es el documento abierto (con sus cambios), si no el del disco. */
  async function currentContent(path) {
    if (workspace.getDocumentPath() === path) return workspace.getContent();
    const read = await readFile(path);
    return read.ok ? read.value.content : '';
  }

  async function restore(path, content) {
    close();
    if (await workspace.restoreVersion(path, content)) notify(t('history.restored'));
  }

  async function compare(path, version, when) {
    const read = await historyRead(path, version.id);
    if (!read.ok) {
      notify(`${t('history.readError')} — ${read.error.message}`, 'error');
      return;
    }
    const choice = await diffModal.open({
      localContent: await currentContent(path),
      diskContent: read.value,
      labels: {
        title: t('history.compareTitle'),
        local: t('history.current'),
        disk: t('history.version').replace('{when}', when),
        keep: t('refs.close'),
        reload: t('history.restore'),
      },
    });
    if (choice === 'reload') await restore(path, read.value);
  }

  function renderRow(path, version) {
    const { when, reason, size } = describeVersion(version);
    const row = document.createElement('li');
    row.className = 'history-list__item';
    const label = document.createElement('span');
    label.className = 'history-list__label';
    label.textContent = `${when} · ${reason} · ${size}`;
    const compareButton = document.createElement('button');
    compareButton.type = 'button';
    compareButton.className = 'button button--compact';
    compareButton.textContent = t('history.compare');
    compareButton.addEventListener('click', () => compare(path, version, when));
    const restoreButton = document.createElement('button');
    restoreButton.type = 'button';
    restoreButton.className = 'button button--compact';
    restoreButton.textContent = t('history.restore');
    restoreButton.addEventListener('click', async () => {
      const read = await historyRead(path, version.id);
      if (read.ok) await restore(path, read.value);
      else notify(`${t('history.readError')} — ${read.error.message}`, 'error');
    });
    row.append(label, compareButton, restoreButton);
    return row;
  }

  /** Abre el panel con las versiones de `path`. */
  async function open(path) {
    const listed = await historyList(path);
    fileEl.textContent = path;
    listEl.replaceChildren();
    if (!listed.ok || listed.value.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'history-list__empty';
      empty.textContent = listed.ok ? t('history.empty') : `${t('history.readError')} — ${listed.error.message}`;
      listEl.append(empty);
    } else {
      for (const version of listed.value) listEl.append(renderRow(path, version));
    }
    dialogEl.classList.remove('hidden');
    (listEl.querySelector('button') ?? closeEl).focus();
  }

  return { open, close };
}
