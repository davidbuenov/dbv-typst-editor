// =============================================================================
// DBV Typst Editor — Tests del panel de Problemas (RF-97)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { createProblemsPanel, groupProblems, parseCliDiagnostics } from './problemsPanel.js';

const p = (level, file, line, message = 'm') => ({ level, file, line, column: 1, message, hints: [] });

describe('groupProblems', () => {
  const problems = [p('warning', 'b.typ', 3), p('error', 'cap/uno.typ', 9), p('warning', 'cap/uno.typ', 2), p('error', 'cap/uno.typ', 1), p('warning', null, null)];

  it('agrupa por fichero, con los que tienen errores primero y errores dentro por línea', () => {
    const groups = groupProblems(problems);
    expect(groups.map((g) => g.file)).toEqual(['cap/uno.typ', 'b.typ', null]);
    expect(groups[0].problems.map((x) => `${x.level}:${x.line}`)).toEqual(['error:1', 'error:9', 'warning:2']);
    expect(groups[0]).toMatchObject({ errors: 2, warnings: 1 });
  });

  it('filtra por gravedad y por fichero activo', () => {
    expect(groupProblems(problems, { warnings: false }).flatMap((g) => g.problems).every((x) => x.level === 'error')).toBe(true);
    expect(groupProblems(problems, { onlyFile: 'b.typ' }).map((g) => g.file)).toEqual(['b.typ']);
  });

  it('no tiene tope de entradas', () => {
    const many = Array.from({ length: 120 }, (_, i) => p('error', 'main.typ', i + 1));
    expect(groupProblems(many)[0].problems).toHaveLength(120);
  });
});

describe('parseCliDiagnostics (motor clásico)', () => {
  it('extrae mensaje, fichero, línea y pistas', () => {
    const text = 'error: unknown variable: foo\n  ┌─ cap\\uno.typ:3:2\n  │\n3 │ #foo\n  │  ^^^\n  = hint: did you mean `for`?\n\nwarning: unused import\n';
    expect(parseCliDiagnostics(text)).toEqual([
      { level: 'error', message: 'unknown variable: foo', hints: ['did you mean `for`?'], file: 'cap/uno.typ', line: 3, column: 2 },
      { level: 'warning', message: 'unused import', hints: [], file: null, line: null, column: null },
    ]);
  });
});

describe('createProblemsPanel', () => {
  function setup() {
    document.body.innerHTML = '<div id="list"></div><input type="checkbox" id="e" checked><input type="checkbox" id="w" checked><input type="checkbox" id="o"><p id="s"></p>';
    const goTo = vi.fn();
    const onShowDocs = vi.fn();
    const panel = createProblemsPanel({
      elements: { list: document.getElementById('list'), errors: document.getElementById('e'), warnings: document.getElementById('w'), onlyActive: document.getElementById('o'), summary: document.getElementById('s') },
      goTo,
      getActiveFile: () => 'main.typ',
      getLine: async () => '  #foo  ',
      onShowDocs,
    });
    return { panel, goTo, onShowDocs };
  }

  it('pinta, salta al sitio y ofrece la documentación', async () => {
    const { panel, goTo, onShowDocs } = setup();
    panel.setProblems([p('error', 'main.typ', 4, 'unknown variable: foo')]);
    document.querySelector('.problem__head').click();
    expect(goTo).toHaveBeenCalledWith('main.typ', 4);
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('.problem__excerpt').textContent).toBe('#foo');
    [...document.querySelectorAll('.problem__actions button')].at(-1).click();
    expect(onShowDocs).toHaveBeenCalled();
    expect(document.getElementById('s').textContent).not.toBe('');
  });

  it('las acciones de la IA llegan por el proveedor y el filtro de fichero activo se aplica', () => {
    const { panel } = setup();
    const run = vi.fn();
    panel.setProblems([p('error', 'main.typ', 1), p('error', 'otro.typ', 1)]);
    panel.setActionProvider(() => [{ label: 'Explicar y arreglar', run, primary: true }], () => ({ label: 'Arreglar todos', run }));
    expect(document.querySelector('.problems__bulk')).not.toBeNull();
    document.querySelector('.problem__actions .button--primary').click();
    expect(run).toHaveBeenCalled();
    const only = document.getElementById('o');
    only.checked = true;
    only.dispatchEvent(new Event('change'));
    expect([...document.querySelectorAll('.problems__file')].map((h) => h.firstChild.textContent)).toEqual(['main.typ']);
  });
});
