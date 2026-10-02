// =============================================================================
// DBV Typst Editor — Aplicar y deshacer una propuesta (RF-93.4, RF-93.5)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La propuesta aceptada se escribe con la MISMA maquinaria que renombrar
// símbolos o reemplazar en el proyecto (`multiFileEdit`, RF-70/77/78): las
// pestañas abiertas se editan en el editor con sus cambios sin guardar, los
// ficheros cerrados se escriben de forma atómica con copia en el historial
// (RF-73), las huellas se validan antes de escribir y Deshacer es todo o nada.
// Crear, renombrar y eliminar usan las operaciones del árbol (RF-69), que ya
// validan rutas dentro del proyecto; eliminar manda a la papelera.
//
// Cada fichero se recoloca sobre su texto ACTUAL (`rebase`): si el usuario lo
// editó mientras la IA respondía, lo que ya no casa no se aplica y se informa.

import { rebase } from './diff.js';
import { resultText } from './proposal.js';

/** Carpeta y nombre de una ruta relativa. */
export function splitRelative(relative) {
  const parts = relative.split('/');
  return { dir: parts.slice(0, -1), name: parts.at(-1) };
}

/** Ediciones LSP que sustituyen TODO `before` por `after` (una sola edición). */
export function fullReplace(before, after) {
  const lines = before.split('\n');
  return [{ range: { start: { line: 0, character: 0 }, end: { line: lines.length - 1, character: lines.at(-1).length } }, newText: after }];
}

/**
 * @param {object} deps
 * @param {() => string} deps.getRoot
 * @param {(root: string, relative: string) => string} deps.join
 * @param {(relative: string) => Promise<string|null>} deps.readText Contenido actual (editor o disco).
 * @param {{apply: Function, undo: Function}} deps.multiFileEdit
 * @param {{fsCreateDir: Function, fsCreateFile: Function, writeFile: Function, fsRename: Function, fsMove: Function, fsTrash: Function}} deps.backend
 */
export function createProposalApplier({ getRoot, join, readText, multiFileEdit, backend }) {
  async function ensureDir(root, dirParts) {
    let current = root;
    for (const part of dirParts) {
      const next = join(current, part);
      await backend.fsCreateDir(root, current, part); // ya existe → error que se ignora
      current = next;
    }
    return current;
  }

  /**
   * Aplica los ficheros aceptados. Devuelve qué se hizo, los conflictos y un
   * `undo()` que lo revierte todo (o nada, si algo cambió desde entonces).
   * @param {{files: Map}} proposal
   */
  async function apply(proposal) {
    const root = getRoot();
    const report = { modified: [], created: [], deleted: [], renamed: [], conflicts: [], failed: [] };
    const edits = [];
    const undoSteps = [];

    for (const file of proposal.files.values()) {
      if (file.kind !== 'modify') continue;
      if (!file.accepted.size) continue;
      const current = await readText(file.path);
      if (current === null) {
        report.failed.push({ path: file.path, message: 'ya no existe' });
        continue;
      }
      const result = rebase(file.base, current, file.regions, file.accepted);
      if (result.conflicts.length) report.conflicts.push({ path: file.path, count: result.conflicts.length });
      if (result.text !== current) {
        edits.push({ path: join(root, file.path), edits: fullReplace(current, result.text) });
        report.modified.push(file.path);
      }
    }
    let journal = null;
    if (edits.length) {
      const applied = await multiFileEdit.apply(edits, { reason: 'ai' });
      if (!applied) {
        report.failed.push(...report.modified.map((path) => ({ path, message: 'no se pudo aplicar' })));
        report.modified = [];
      } else {
        journal = applied.journal;
        if (applied.failure) report.failed.push({ path: applied.failure.file.relative, message: applied.failure.message });
      }
    }

    for (const file of proposal.files.values()) {
      if (file.kind === 'create' && file.accepted.size) {
        const { dir, name } = splitRelative(file.path);
        const folder = await ensureDir(root, dir);
        const created = await backend.fsCreateFile(root, folder, name);
        const written = created.ok ? await backend.writeFile(created.value, resultText(file), 'ai') : created;
        if (written.ok) {
          report.created.push(file.path);
          undoSteps.push(() => backend.fsTrash(root, [created.value]));
        } else report.failed.push({ path: file.path, message: written.error.message });
      } else if (file.kind === 'delete' && file.accepted.size) {
        const target = join(root, file.path);
        const before = await readText(file.path);
        const trashed = await backend.fsTrash(root, [target]);
        if (trashed.ok) {
          report.deleted.push(file.path);
          undoSteps.push(async () => {
            const { dir, name } = splitRelative(file.path);
            const folder = await ensureDir(root, dir);
            const created = await backend.fsCreateFile(root, folder, name);
            if (created.ok) await backend.writeFile(created.value, before ?? '', 'ai');
          });
        } else report.failed.push({ path: file.path, message: trashed.error.message });
      } else if (file.kind === 'rename' && file.renameAccepted !== false) {
        const source = join(root, file.path);
        const target = splitRelative(file.newPath);
        const from = splitRelative(file.path);
        let current = source;
        let ok = true;
        if (target.dir.join('/') !== from.dir.join('/')) {
          const folder = await ensureDir(root, target.dir);
          const moved = await backend.fsMove(root, [current], folder);
          ok = moved.ok;
          if (moved.ok) current = moved.value[0]?.to ?? join(folder, from.name);
        }
        if (ok && target.name !== from.name) {
          const renamed = await backend.fsRename(root, current, target.name);
          ok = renamed.ok;
          if (renamed.ok) current = renamed.value?.to ?? current;
        }
        if (ok) {
          report.renamed.push(`${file.path} → ${file.newPath}`);
          undoSteps.push(async () => {
            const back = await backend.fsMove(root, [current], from.dir.length ? join(root, from.dir.join('/')) : root);
            const at = back.ok ? back.value[0]?.to ?? current : current;
            if (from.name !== target.name) await backend.fsRename(root, at, from.name);
          });
        } else report.failed.push({ path: file.path, message: 'no se pudo renombrar' });
      }
    }

    proposal.status = 'applied';
    const undo = async () => {
      let ok = true;
      if (journal) ok = await multiFileEdit.undo(journal, 'ai');
      for (const step of [...undoSteps].reverse()) await step();
      proposal.status = 'undone';
      return ok;
    };
    return { report, undo };
  }

  return { apply };
}
