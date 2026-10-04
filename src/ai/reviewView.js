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
 * @param {{status: () => Promise<{exists: boolean, shadowsEnvPaths: boolean}>, install: (family: string, createAnyway: boolean) => Promise<{ok: boolean, value?: object, error?: object}>, remove: (files: string[], removeFolder: boolean) => Promise<object>, openPage: (url: string) => void}} [deps.fonts]
 *   Fuentes que la IA ofrece añadir al proyecto (RF-111): se instalan SOLO con el clic del usuario, y se pueden deshacer.
 * @param {() => void} [deps.onFontsChanged] Se llama al instalar o quitar una fuente (para recompilar la vista previa).
 * @param {{info: (ids: string[]) => Promise<Array>, install: (id: string) => Promise<{ok: boolean, error?: object}>, openPage: (id: string) => void}} [deps.packages]
 *   Paquetes de Universe que la propuesta importa y no están instalados (RF-109.2): datos, descarga con confirmación y ficha.
 * @returns {HTMLElement}
 */
export function createReviewCard({ proposal, check, setPreview, apply, onDone, openFile, packages = null, fonts = null, onFontsChanged = () => {} }) {
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
  const packagesBox = el('div', 'ai-review__packages hidden');
  packagesBox.setAttribute('role', 'group');
  packagesBox.setAttribute('aria-label', t('ai.packagesTitle'));
  const fontsBox = el('div', 'ai-review__packages hidden');
  fontsBox.setAttribute('role', 'group');
  fontsBox.setAttribute('aria-label', t('ai.fontsTitle'));
  card.append(head, status, packagesBox, fontsBox, list, actions);
  let previewing = false;
  let checkTimer = null;
  /** Paquetes que el usuario decidió no descargar: se quedan sin comprobar. */
  const declined = new Set();

  /**
   * «Paquetes que se descargarán» (RF-109.2): cada uno con su licencia, su ficha y, al pie, descargar o no.
   * Nada se descarga sin este clic: es código de terceros (ADR-UNIVERSE-001, RNF-IA.9.4).
   */
  async function renderMissing(ids) {
    packagesBox.replaceChildren();
    packagesBox.classList.toggle('hidden', !ids.length || !packages);
    if (!ids.length || !packages) return;
    packagesBox.append(el('strong', '', t('ai.packagesTitle')), el('p', 'ai-review__packages-note', t('ai.packagesNote')));
    const rows = new Map();
    for (const id of ids) {
      const row = el('div', 'ai-package');
      const name = el('code', 'ai-package__id', id);
      const meta = el('span', 'ai-package__meta', '');
      row.append(name, meta, button(t('ai.packagesPage'), () => packages.openPage(id), 'button button--compact button--ghost'));
      rows.set(id, meta);
      packagesBox.append(row);
    }
    packages.info(ids).then((found) => {
      for (const info of found) {
        const text = [info.license && `${t('ai.packagesLicense')}: ${info.license}`, info.description].filter(Boolean).join(' · ');
        if (rows.has(info.id)) rows.get(info.id).textContent = text || t('ai.packagesUnknown');
      }
    });
    const pending = ids.filter((id) => !declined.has(id));
    if (!pending.length) {
      packagesBox.append(el('p', 'ai-review__done', t('ai.packagesDeclined')));
      return;
    }
    const buttons = el('div', 'ai-review__packages-actions');
    const download = button(t('ai.packagesDownload'), async () => {
      download.disabled = true;
      decline.disabled = true;
      status.className = 'ai-review__status';
      status.textContent = t('ai.packagesDownloading');
      for (const id of pending) {
        const installed = await packages.install(id);
        if (!installed.ok) {
          status.classList.add('ai-review__status--error');
          status.textContent = t('ai.packagesFailed').replace('{id}', id).replace('{reason}', installed.error?.message ?? '');
          download.disabled = false;
          decline.disabled = false;
          return;
        }
      }
      // Instalados: se repite la comprobación, que ahora sí compila el proyecto entero.
      await runCheck();
      if (previewing) setPreview(true);
    }, 'button button--primary button--compact');
    const decline = button(t('ai.packagesDecline'), () => {
      for (const id of pending) declined.add(id);
      renderMissing(ids);
    }, 'button button--compact');
    buttons.append(download, decline);
    packagesBox.append(buttons);
  }

  async function runCheck() {
    status.className = 'ai-review__status';
    status.textContent = t('ai.checking');
    const result = await check();
    if (!result) {
      status.textContent = t('ai.checkUnavailable');
      return;
    }
    const { fresh, fixed, missing = [] } = result;
    renderMissing(missing);
    // Con paquetes sin instalar la comprobación es INCOMPLETA: ni «compila» ni «introduce errores» sería honesto.
    status.classList.add(missing.length ? 'ai-review__status--warn' : fresh.length ? 'ai-review__status--error' : 'ai-review__status--ok');
    status.textContent = missing.length
      ? t('ai.checkMissing').replace('{n}', String(missing.length))
      : fresh.length
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
  /** Estado de cada fuente ofrecida: la familia → `offered`, `installing`, `installed` (con lo instalado), `declined`, `failed`, `removed`. */
  const fontState = new Map();
  const formatSize = (bytes) => (bytes ? (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`) : t('ai.fontsSizeUnknown'));

  /**
   * «Fuentes que se añadirán al proyecto» (RF-111.3): licencia, tamaño y ficheros a la vista y dos opciones.
   * Nada se descarga sin el clic; son ficheros de terceros que irán a `fonts/` y, con él, a git (RF-111.7).
   */
  async function renderFonts() {
    fontsBox.replaceChildren();
    const offers = proposal.fonts ?? [];
    fontsBox.classList.toggle('hidden', !offers.length || !fonts);
    if (!offers.length || !fonts) return;
    const folder = await fonts.status();
    fontsBox.append(el('strong', '', t('ai.fontsTitle')), el('p', 'ai-review__packages-note', t('ai.fontsNote')));
    for (const offer of offers) {
      const state = fontState.get(offer.family) ?? { kind: 'offered' };
      const row = el('div', 'ai-package');
      row.append(el('code', 'ai-package__id', offer.family), el('span', 'ai-package__meta', `${offer.license} · ${t('ai.fontsFiles').replace('{n}', String(offer.files.length))} · ${formatSize(offer.totalBytes)}`));
      row.append(button(t('ai.packagesPage'), () => fonts.openPage(offer.page), 'button button--compact button--ghost'));
      fontsBox.append(row);
      const names = offer.files.map((file) => file.name).join(', ');
      fontsBox.append(el('p', 'ai-review__packages-note', names));
      if (state.kind === 'offered' || state.kind === 'failed') {
        if (state.kind === 'failed') fontsBox.append(el('p', 'ai-review__warn', state.message));
        if (folder.shadowsEnvPaths) fontsBox.append(el('p', 'ai-review__warn', t('ai.fontsEnvPaths')));
        const buttons = el('div', 'ai-review__packages-actions');
        const add = button(t(folder.shadowsEnvPaths ? 'ai.fontsAddCreate' : 'ai.fontsAdd'), async () => {
          add.disabled = true;
          fontState.set(offer.family, { kind: 'installing' });
          fontsBox.append(el('p', 'ai-review__packages-note', t('ai.fontsInstalling')));
          const installed = await fonts.install(offer.family, Boolean(folder.shadowsEnvPaths));
          if (installed.ok) {
            fontState.set(offer.family, { kind: 'installed', report: installed.value });
            onFontsChanged();
          } else fontState.set(offer.family, { kind: 'failed', message: installed.error?.message ?? '' });
          renderFonts();
        }, 'button button--primary button--compact');
        const decline = button(t('ai.fontsDecline'), () => {
          fontState.set(offer.family, { kind: 'declined' });
          renderFonts();
        }, 'button button--compact');
        buttons.append(add, decline);
        fontsBox.append(buttons);
      } else if (state.kind === 'installed') {
        const { installed, skipped, createdFolder } = state.report;
        fontsBox.append(el('p', 'ai-review__done', t('ai.fontsInstalled').replace('{n}', String(installed.length + skipped.length))));
        if (installed.length) {
          fontsBox.append(button(t('ai.undo'), async () => {
            await fonts.remove(installed, createdFolder);
            fontState.set(offer.family, { kind: 'removed' });
            onFontsChanged();
            renderFonts();
          }, 'button button--compact'));
        }
      } else if (state.kind === 'declined' || state.kind === 'removed') {
        fontsBox.append(el('p', 'ai-review__done', t(state.kind === 'removed' ? 'ai.fontsRemoved' : 'ai.fontsDeclined')));
      }
    }
  }
  renderFonts();

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
  // Una propuesta que solo ofrece fuentes no tiene cambios que aplicar ni comprobar.
  if (proposal.files.size) runCheck();
  else {
    list.classList.add('hidden');
    actions.classList.add('hidden');
    status.classList.add('hidden');
  }
  return card;
}
