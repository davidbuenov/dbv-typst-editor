// =============================================================================
// DBV Typst Editor — Actualización de referencias tras mover (RF-70, frontend)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Se cuelga de `fileOperations.afterMove`: tras mover o renombrar, pide al
// backend (`refs.rs`) que reescriba las rutas afectadas. El documento abierto
// se edita en el editor, nunca en disco (sus cambios sin guardar mandan). El
// aviso final permite ver qué cambió y deshacerlo todo: deshacer es la
// operación inversa (volver a mover y reescribir en sentido contrario), así
// que respeta lo que se haya editado entre medias.

import { t } from '../i18n/i18n.js';
import { getPref } from '../app/prefs.js';
import { fsRevertMoves, refsApply, refsPlan } from '../services/backend.js';

/** Cuántos cambios se listan en «Ver cambios» antes de resumir. */
const CHANGES_LIST_LIMIT = 40;

/**
 * Texto de «Ver cambios»: una línea por ruta reescrita.
 * @param {{files: Array<{relative: string, changes: Array<{line: number, oldValue: string, newValue: string}>}>}} report
 * @returns {string}
 */
export function formatReport(report) {
  const lines = [];
  for (const file of report.files) {
    for (const change of file.changes) {
      lines.push(`${file.relative}:${change.line} — ${change.oldValue} → ${change.newValue}`);
    }
  }
  const rest = lines.length - CHANGES_LIST_LIMIT;
  const shown = lines.slice(0, CHANGES_LIST_LIMIT);
  if (rest > 0) shown.push(t('refs.moreChanges').replace('{n}', String(rest)));
  return shown.join('\n');
}

/**
 * @param {object} deps
 * @param {{getRoot: () => string, refresh: () => Promise<boolean>}} deps.tree
 * @param {object} deps.workspace  El de `createWorkspace`.
 * @param {{ask: Function}} deps.dialog
 * @param {(message: string, tone?: string, durationMs?: number, actions?: Array) => void} deps.notify
 */
export function createReferenceUpdater({ tree, workspace, dialog, notify }) {
  /** Reescribe y aplica al editor lo que toque al documento abierto. */
  async function apply(moved) {
    const result = await refsApply(tree.getRoot(), moved, workspace.getOpenDocumentSnapshot());
    if (!result.ok) {
      notify(`${t('refs.error')} — ${result.error.message}`, 'error');
      return null;
    }
    workspace.applyBufferEdits(result.value.openDocumentEdits);
    if (result.value.failed.length) {
      notify(`${t('refs.failed')} ${result.value.failed.join(', ')}`, 'error', 10000);
    }
    return result.value;
  }

  async function showChanges(report) {
    await dialog.ask({
      titleKey: 'refs.changesTitle',
      textKey: 'refs.changesText',
      text: formatReport(report),
      choices: [{ key: 'close', labelKey: 'refs.close', tone: 'primary' }],
    });
  }

  async function undo(moved) {
    const reverted = await workspace.runOwnOperation(
      moved.map((step) => step.to),
      () => fsRevertMoves(tree.getRoot(), moved),
    );
    if (!reverted.ok) {
      notify(`${t('refs.undoError')} — ${reverted.error.message}`, 'error');
      return;
    }
    await workspace.applyPathMoves(reverted.value);
    await apply(reverted.value);
    await tree.refresh();
    notify(t('refs.undone'));
  }

  /**
   * `afterMove` de `fileOperations`: actualiza las referencias a lo movido.
   * @param {Array<{from: string, to: string}>} moved
   */
  async function afterMove(moved) {
    if (!moved.length) return;
    if (getPref('askBeforeUpdatingRefs')) {
      const plan = await refsPlan(tree.getRoot(), moved, workspace.getOpenDocumentSnapshot());
      if (!plan.ok || plan.value.total === 0) return;
      const choice = await dialog.ask({
        titleKey: 'refs.askTitle',
        textKey: 'refs.askText',
        text: formatReport(plan.value),
        choices: [
          { key: 'skip', labelKey: 'refs.skip' },
          { key: 'apply', labelKey: 'refs.apply', tone: 'primary' },
        ],
      });
      if (choice !== 'apply') return;
    }

    const report = await apply(moved);
    if (!report || report.total === 0) return;
    const message = t('refs.updated').replace('{n}', String(report.total)).replace('{m}', String(report.files.length));
    notify(message, 'info', undefined, [
      { label: t('refs.viewChanges'), run: () => showChanges(report) },
      { label: t('refs.undo'), run: () => undo(moved) },
    ]);
  }

  return { afterMove };
}
