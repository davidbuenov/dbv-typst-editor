// =============================================================================
// DBV Typst Editor — Revisión de una propuesta de la IA (RF-93.2 a RF-93.6)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La tarjeta que aparece en la conversación cuando la IA propone cambios:
// lista de ficheros con lo que añade y quita, cada trozo con su casilla, el
// texto propuesto retocable, el resultado de compilarla («compila», «introduce
// N errores», «corrige M»), «Ver en la vista previa» y Aplicar/Rechazar. Tras
// aplicar, el informe con Deshacer. Todo el texto ajeno entra por
// `textContent` (R-A4).

import { t } from '../i18n/i18n.js';
import { editProposed, fileStats, setAll } from './proposal.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, onClick, className = 'button button--compact') {
  const node = el('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

/**
 * @param {object} deps
 * @param {object} deps.proposal
 * @param {() => Promise<{fresh: Array, fixed: number}|null>} deps.check
 * @param {(on: boolean) => void} deps.setPreview
 * @param {() => Promise<{report: object, undo: () => Promise<boolean>}>} deps.apply
 * @param {() => void} deps.onDone Al aplicar o rechazar (la conversación guarda el resumen).
 * @param {(path: string) => void} deps.openFile
 * @returns {HTMLElement}
 */
export function createReviewCard({ proposal, check, setPreview, apply, onDone, openFile }) {
  const card = el('div', 'ai-review');
  card.setAttribute('role', 'group');
  card.setAttribute('aria-label', t('ai.reviewTitle'));
  const head = el('div', 'ai-review__head');
  head.append(el('strong', '', t('ai.reviewTitle')));
  if (proposal.summary) head.append(el('span', 'ai-review__summary', proposal.summary));
  const status = el('p', 'ai-review__status', '');
  status.setAttribute('aria-live', 'polite');
  const list = el('div', 'ai-review__files');
  const actions = el('div', 'ai-review__actions');
  card.append(head, status, list, actions);
  let previewing = false;
  let checkTimer = null;

  async function runCheck() {
    status.className = 'ai-review__status';
    status.textContent = t('ai.checking');
    const result = await check();
    if (!result) {
      status.textContent = t('ai.checkUnavailable');
      return;
    }
    const { fresh, fixed } = result;
    status.classList.add(fresh.length ? 'ai-review__status--error' : 'ai-review__status--ok');
    status.textContent = fresh.length
      ? t('ai.checkErrors').replace('{n}', String(fresh.length))
      : fixed
        ? t('ai.checkFixes').replace('{n}', String(fixed))
        : t('ai.checkOk');
    if (fresh.length) {
      const details = el('ul', 'ai-review__errors');
      for (const d of fresh.slice(0, 8)) details.append(el('li', '', `${d.file ?? ''}${d.line ? `:${d.line}` : ''} — ${d.message}`));
      status.append(details);
    }
  }
  const recheck = () => {
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => {
      runCheck();
      if (previewing) setPreview(true);
    }, 300);
  };

  function renderHunks(file, host) {
    host.replaceChildren();
    for (const region of file.regions) {
      if (region.type !== 'change') continue;
      const hunk = el('div', 'ai-hunk');
      const toggle = el('label', 'ai-hunk__toggle');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = file.accepted.has(region.id);
      box.addEventListener('change', () => {
        if (box.checked) file.accepted.add(region.id);
        else file.accepted.delete(region.id);
        renderFiles();
        recheck();
      });
      toggle.append(box, el('span', '', t('ai.hunkLine').replace('{n}', String(region.baseStart + 1))));
      const pre = el('pre', 'ai-hunk__diff');
      for (const line of region.removed) pre.append(el('span', 'ai-hunk__del', `- ${line}\n`));
      for (const line of region.added) pre.append(el('span', 'ai-hunk__add', `+ ${line}\n`));
      hunk.append(toggle, pre);
      host.append(hunk);
    }
  }

  function renderFiles() {
    list.replaceChildren();
    for (const file of proposal.files.values()) {
      const row = el('details', 'ai-file');
      const summary = el('summary', 'ai-file__summary');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.title = t('ai.acceptFile');
      const all = file.regions.filter((r) => r.type === 'change').length;
      box.checked = file.kind === 'rename' ? file.renameAccepted !== false : file.accepted.size > 0;
      box.indeterminate = file.accepted.size > 0 && file.accepted.size < all;
      box.addEventListener('click', (event) => event.stopPropagation());
      box.addEventListener('change', () => {
        setAll(file, box.checked);
        renderFiles();
        recheck();
      });
      const kind = el('span', `ai-file__kind ai-file__kind--${file.kind}`, t(`ai.kind.${file.kind}`));
      const name = el('span', 'ai-file__path', file.kind === 'rename' ? `${file.path} → ${file.newPath}` : file.path);
      const { added, removed } = fileStats(file);
      const stats = el('span', 'ai-file__stats', file.kind === 'delete' ? '' : `+${added} −${removed}`);
      summary.append(box, kind, name, stats);
      row.append(summary);
      const body = el('div', 'ai-file__body');
      const hunks = el('div', 'ai-file__hunks');
      renderHunks(file, hunks);
      const tools = el('div', 'ai-file__tools');
      if (file.kind !== 'delete') {
        tools.append(
          button(t('ai.retouch'), () => {
            const area = document.createElement('textarea');
            area.className = 'ai-file__editor';
            area.value = file.proposed;
            area.spellcheck = false;
            const save = button(t('ai.retouchSave'), () => {
              editProposed(file, area.value);
              renderFiles();
              recheck();
            }, 'button button--primary button--compact');
            body.replaceChildren(area, save);
          }),
        );
      }
      if (file.kind !== 'create') tools.append(button(t('ai.openFile'), () => openFile(file.path)));
      body.append(hunks, tools);
      row.append(body);
      list.append(row);
    }
  }

  const previewButton = button(t('ai.previewOn'), () => {
    previewing = !previewing;
    setPreview(previewing);
    previewButton.textContent = t(previewing ? 'ai.previewOff' : 'ai.previewOn');
    previewButton.setAttribute('aria-pressed', String(previewing));
  });
  const applyButton = button(
    t('ai.applySelected'),
    async () => {
      applyButton.disabled = true;
      if (previewing) setPreview(false);
      const { report, undo } = await apply();
      showReport(report, undo);
      onDone('applied', report);
    },
    'button button--primary button--compact',
  );
  const rejectButton = button(t('ai.reject'), () => {
    if (previewing) setPreview(false);
    proposal.status = 'rejected';
    actions.replaceChildren(el('span', 'ai-review__done', t('ai.rejected')));
    list.querySelectorAll('input').forEach((input) => (input.disabled = true));
    onDone('rejected', null);
  });
  actions.append(applyButton, rejectButton, previewButton);

  function showReport(report, undo) {
    list.querySelectorAll('input, button').forEach((node) => (node.disabled = true));
    const parts = [];
    if (report.modified.length) parts.push(t('ai.reportModified').replace('{n}', String(report.modified.length)));
    if (report.created.length) parts.push(t('ai.reportCreated').replace('{n}', String(report.created.length)));
    if (report.deleted.length) parts.push(t('ai.reportDeleted').replace('{n}', String(report.deleted.length)));
    if (report.renamed.length) parts.push(t('ai.reportRenamed').replace('{n}', String(report.renamed.length)));
    const text = el('div', 'ai-review__report', parts.length ? parts.join(' · ') : t('ai.reportNothing'));
    for (const conflict of report.conflicts) text.append(el('p', 'ai-review__warn', t('ai.reportConflict').replace('{file}', conflict.path).replace('{n}', String(conflict.count))));
    for (const failure of report.failed) text.append(el('p', 'ai-review__warn', `${failure.path}: ${failure.message}`));
    const undoButton = button(t('ai.undo'), async () => {
      undoButton.disabled = true;
      await undo();
      text.append(el('p', 'ai-review__done', t('ai.undone')));
    });
    actions.replaceChildren(text, undoButton);
  }

  renderFiles();
  runCheck();
  return card;
}
