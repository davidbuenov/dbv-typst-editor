// =============================================================================
// DBV Typst Editor — Resolución visual de conflictos de fusión Git (RF-19)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Un `git pull` que deja un conflicto real (marcas `<<<<<<<`/`=======`/
// `>>>>>>>` dentro del fichero, `conflictParser.js`) dejaba al usuario solo
// con el texto crudo de esas marcas y ningún sitio de la interfaz para
// hacer nada con ellas — encontrado en la primera pasada manual de v0.6.0.
// Este modal deja elegir, bloque a bloque, "Mío" o "Remoto"; el resto del
// documento (fuera de los bloques en conflicto) nunca se toca.
//
// No sustituye la edición manual: quien prefiera mezclar líneas de las dos
// versiones a mano siempre puede cerrar este modal y editar el fichero
// directamente, las marcas siguen ahí hasta que se aplica una resolución.

import { t } from '../i18n/i18n.js';
import { countConflicts, parseConflictMarkers, resolveConflicts } from './conflictParser.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.dialogEl
 * @param {HTMLElement} deps.titleEl
 * @param {HTMLElement} deps.blocksEl Contenedor donde se pintan los bloques.
 * @param {HTMLElement} deps.hintEl Cuenta "N de M bloques resueltos".
 * @param {HTMLButtonElement} deps.applyBtn
 * @param {HTMLButtonElement} deps.cancelBtn
 */
export function createConflictResolver({ dialogEl, titleEl, blocksEl, hintEl, applyBtn, cancelBtn }) {
  let segments = [];
  let choices = [];
  let onResolve = null;

  function updateHint() {
    const total = countConflicts(segments);
    const done = choices.filter(Boolean).length;
    hintEl.textContent = t('mergeConflict.progress').replace('{done}', done).replace('{total}', total);
    applyBtn.disabled = done < total;
  }

  function render() {
    blocksEl.replaceChildren();
    let conflictIndex = 0;
    const fragment = document.createDocumentFragment();

    for (const segment of segments) {
      if (segment.type === 'context') {
        if (segment.text.trim() === '') continue; // contexto vacío no aporta nada a la vista
        const pre = document.createElement('pre');
        pre.className = 'conflict-block__context';
        pre.textContent = segment.text;
        fragment.append(pre);
        continue;
      }

      const index = conflictIndex;
      conflictIndex += 1;

      const block = document.createElement('div');
      block.className = 'conflict-block';

      const ourPane = document.createElement('button');
      ourPane.type = 'button';
      ourPane.className = 'conflict-block__pane';
      ourPane.innerHTML = `<span class="conflict-block__pane-label">${t('mergeConflict.mine')}</span>`;
      const ourText = document.createElement('pre');
      ourText.textContent = segment.ours;
      ourPane.append(ourText);

      const theirPane = document.createElement('button');
      theirPane.type = 'button';
      theirPane.className = 'conflict-block__pane';
      theirPane.innerHTML = `<span class="conflict-block__pane-label">${t('mergeConflict.theirs')}</span>`;
      const theirText = document.createElement('pre');
      theirText.textContent = segment.theirs;
      theirPane.append(theirText);

      const select = (choice) => {
        choices[index] = choice;
        ourPane.classList.toggle('conflict-block__pane--selected', choice === 'ours');
        theirPane.classList.toggle('conflict-block__pane--selected', choice === 'theirs');
        updateHint();
      };
      ourPane.addEventListener('click', () => select('ours'));
      theirPane.addEventListener('click', () => select('theirs'));

      block.append(ourPane, theirPane);
      fragment.append(block);
    }

    blocksEl.append(fragment);
    updateHint();
  }

  function close() {
    dialogEl.classList.add('hidden');
    onResolve = null;
  }

  applyBtn.addEventListener('click', () => {
    const cb = onResolve;
    const content = resolveConflicts(segments, choices);
    close();
    cb?.({ action: 'apply', content });
  });

  cancelBtn.addEventListener('click', () => {
    const cb = onResolve;
    close();
    cb?.({ action: 'cancel' });
  });

  return {
    /**
     * @param {{fileName: string, content: string}} params
     * @returns {Promise<{action: 'apply', content: string} | {action: 'cancel'}>}
     */
    open({ fileName, content }) {
      return new Promise((resolve) => {
        onResolve = resolve;
        titleEl.textContent = `${t('mergeConflict.title')} — ${fileName}`;
        segments = parseConflictMarkers(content);
        choices = new Array(countConflicts(segments)).fill(null);
        render();
        dialogEl.classList.remove('hidden');
      });
    },
    close,
  };
}
