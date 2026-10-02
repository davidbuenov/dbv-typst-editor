// =============================================================================
// DBV Typst Editor — Panel de Problemas (RF-97)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Sustituye al desplegable de la insignia (tope de 50 entradas) por una
// pestaña del panel lateral: la lista completa, agrupada por fichero, con los
// errores primero, filtros y, por cada problema, sus acciones. «Ver
// documentación» funciona siempre; «Explicar y arreglar» lo añade la IA cuando
// está conectada (RF-97.5), a través de `setActionProvider`.
//
// Con el motor clásico de respaldo no hay rangos: se extraen fichero y línea
// del texto del CLI cuando vienen y, si no, se enseña el mensaje sin inventar
// una posición (RF-97.4).

import { t } from '../i18n/i18n.js';

/**
 * @typedef {{level: 'error'|'warning', message: string, hints: string[], file: string|null, line: number|null, column: number|null}} Problem
 */

/**
 * Agrupa por fichero (los que tienen errores primero, luego por nombre) y
 * aplica los filtros. Dentro de cada grupo, errores primero y por línea.
 * @param {Problem[]} problems
 * @param {{errors?: boolean, warnings?: boolean, onlyFile?: string|null}} [filter]
 * @returns {Array<{file: string|null, errors: number, warnings: number, problems: Problem[]}>}
 */
export function groupProblems(problems, { errors = true, warnings = true, onlyFile = null } = {}) {
  const visible = problems.filter(
    (p) => (p.level === 'error' ? errors : warnings) && (onlyFile === null || p.file === onlyFile),
  );
  const groups = new Map();
  for (const problem of visible) {
    const key = problem.file ?? '';
    if (!groups.has(key)) groups.set(key, { file: problem.file, errors: 0, warnings: 0, problems: [] });
    const group = groups.get(key);
    group.problems.push(problem);
    if (problem.level === 'error') group.errors += 1;
    else group.warnings += 1;
  }
  const rank = (level) => (level === 'error' ? 0 : 1);
  const result = [...groups.values()];
  for (const group of result) {
    group.problems.sort((a, b) => rank(a.level) - rank(b.level) || (a.line ?? 0) - (b.line ?? 0));
  }
  // Con errores primero; los mensajes sin fichero, al final.
  result.sort(
    (a, b) =>
      Number(b.errors > 0) - Number(a.errors > 0) ||
      Number(a.file === null) - Number(b.file === null) ||
      String(a.file ?? '').localeCompare(String(b.file ?? '')),
  );
  return result;
}

/**
 * Mensajes del CLI de Typst (motor clásico) → problemas. Formato:
 * `error: mensaje` / `┌─ ruta:línea:columna` / `= hint: pista`.
 * @param {string} text
 * @returns {Problem[]}
 */
export function parseCliDiagnostics(text) {
  const problems = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    const head = line.match(/^(error|warning):\s*(.*)$/);
    if (head) {
      problems.push({ level: head[1], message: head[2], hints: [], file: null, line: null, column: null });
      continue;
    }
    const current = problems.at(-1);
    if (!current) continue;
    const location = line.match(/^┌─\s*(.+?):(\d+):(\d+)\s*$/);
    if (location && current.file === null) {
      current.file = location[1].replace(/\\/g, '/');
      current.line = Number(location[2]);
      current.column = Number(location[3]);
      continue;
    }
    const hint = line.match(/^=\s*hint:\s*(.*)$/);
    if (hint) current.hints.push(hint[1]);
  }
  return problems;
}

/**
 * @param {object} deps
 * @param {{list: HTMLElement, errors: HTMLInputElement, warnings: HTMLInputElement, onlyActive: HTMLInputElement, summary: HTMLElement}} deps.elements
 * @param {(file: string, line: number) => void} deps.goTo
 * @param {() => string|null} deps.getActiveFile Fichero activo, relativo a la raíz.
 * @param {(file: string, line: number) => Promise<string|null>} deps.getLine Texto de esa línea.
 * @param {(problem: Problem) => void} deps.onShowDocs
 */
export function createProblemsPanel({ elements, goTo, getActiveFile, getLine, onShowDocs }) {
  /** @type {Problem[]} */
  let problems = [];
  /** @type {(problem: Problem, all: Problem[]) => Array<{label: string, run: () => void, primary?: boolean}>} */
  let actionProvider = () => [];
  /** @type {(all: Problem[]) => {label: string, run: () => void} | null} */
  let bulkProvider = () => null;

  function filter() {
    return {
      errors: elements.errors.checked,
      warnings: elements.warnings.checked,
      onlyFile: elements.onlyActive.checked ? getActiveFile() : null,
    };
  }

  function button(label, run, className = 'button button--compact') {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = className;
    node.textContent = label;
    node.addEventListener('click', (event) => {
      event.stopPropagation();
      run();
    });
    return node;
  }

  function renderProblem(problem) {
    const item = document.createElement('div');
    item.className = `problem problem--${problem.level}`;
    item.setAttribute('role', 'listitem');
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'problem__head';
    const icon = document.createElement('span');
    icon.className = 'problem__icon';
    icon.textContent = problem.level === 'error' ? '✖' : '⚠';
    icon.setAttribute('aria-label', t(problem.level === 'error' ? 'problems.error' : 'problems.warning'));
    const message = document.createElement('span');
    message.className = 'problem__message';
    message.textContent = problem.message;
    const where = document.createElement('span');
    where.className = 'problem__where';
    where.textContent = problem.line ? `${problem.line}:${problem.column ?? 1}` : '';
    head.append(icon, message, where);
    head.disabled = !problem.file || !problem.line;
    head.addEventListener('click', () => goTo(problem.file, problem.line));
    item.append(head);

    if (problem.file && problem.line) {
      const excerpt = document.createElement('code');
      excerpt.className = 'problem__excerpt';
      item.append(excerpt);
      getLine(problem.file, problem.line).then((text) => {
        if (text) excerpt.textContent = text.trim();
        else excerpt.remove();
      });
    }
    for (const hint of problem.hints ?? []) {
      const p = document.createElement('p');
      p.className = 'problem__hint';
      p.textContent = `${t('problems.hint')}: ${hint}`;
      item.append(p);
    }
    const actions = document.createElement('div');
    actions.className = 'problem__actions';
    for (const action of actionProvider(problem, problems)) {
      actions.append(button(action.label, action.run, action.primary ? 'button button--primary button--compact' : 'button button--compact'));
    }
    actions.append(button(t('problems.showDocs'), () => onShowDocs(problem)));
    item.append(actions);
    return item;
  }

  function render() {
    const groups = groupProblems(problems, filter());
    elements.list.replaceChildren();
    const errors = problems.filter((p) => p.level === 'error').length;
    elements.summary.textContent = problems.length
      ? t('problems.summary').replace('{errors}', String(errors)).replace('{warnings}', String(problems.length - errors))
      : t('problems.none');
    const bulk = bulkProvider(problems);
    if (bulk && errors > 1) elements.list.append(button(bulk.label, bulk.run, 'button button--primary button--compact problems__bulk'));
    for (const group of groups) {
      const section = document.createElement('section');
      section.className = 'problems__group';
      const header = document.createElement('h3');
      header.className = 'problems__file';
      header.textContent = group.file ?? t('problems.noFile');
      const count = document.createElement('span');
      count.className = 'problems__count';
      count.textContent = [group.errors ? `✖ ${group.errors}` : '', group.warnings ? `⚠ ${group.warnings}` : ''].filter(Boolean).join(' · ');
      header.append(count);
      const list = document.createElement('div');
      list.setAttribute('role', 'list');
      list.append(...group.problems.map(renderProblem));
      section.append(header, list);
      elements.list.append(section);
    }
  }

  for (const input of [elements.errors, elements.warnings, elements.onlyActive]) input.addEventListener('change', render);

  return {
    /** @param {Problem[]} next */
    setProblems(next) {
      problems = next;
      render();
    },
    getProblems: () => problems,
    /** El documento activo cambió (filtro «solo el fichero activo»). */
    refresh: render,
    setActionProvider(provider, bulk = () => null) {
      actionProvider = provider;
      bulkProvider = bulk;
      render();
    },
  };
}
