// =============================================================================
// DBV Typst Editor — Tests de las herramientas del asistente (RF-94)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { runAgent } from './agentLoop.js';
import { createProposal, resultText } from './proposal.js';
import { createTools, describeCheck, MAX_FIX_ATTEMPTS, newErrors } from './tools.js';

const err = (file, message) => ({ level: 'error', file, line: 1, message });

function setup({ check } = {}) {
  const files = { 'main.typ': '= Hola\n#include "cap.typ"\n', 'cap.typ': 'Uno.\n' };
  const proposal = createProposal();
  const deps = {
    getRoot: () => 'D:/p',
    join: (root, rel) => `${root}/${rel}`,
    readText: vi.fn(async (path) => files[path] ?? null),
    listFiles: async () => Object.keys(files),
    search: async (query) => (query === 'Uno' ? [{ relative: 'cap.typ', line: 1, text: 'Uno.' }] : []),
    diagnostics: async () => [err('cap.typ', 'unknown variable: x')],
    outline: () => [{ level: 1, text: 'Hola', page: 1 }],
    docsSearch: async () => [{ title: 'table', heading: 'Parameters', path: 'reference/model/table', anchor: 'parameters', snippet: 'columns…' }],
    docsPage: async (path) => (path === 'reference/model/table' ? '# table' : null),
    checkProposal: check ?? (async () => ({ fresh: [], fixed: 0 })),
    getProposal: () => proposal,
  };
  const tools = Object.fromEntries(createTools(deps).map((tool) => [tool.name, tool]));
  return { tools, proposal, deps };
}

describe('herramientas', () => {
  it('leen, listan, buscan y consultan la documentación', async () => {
    const { tools } = setup();
    expect(await tools.read_file.run({ path: 'cap.typ' })).toBe('Uno.\n');
    expect(await tools.read_file.run({ path: 'main.typ', start_line: 2, end_line: 2 })).toBe('#include "cap.typ"');
    expect(await tools.list_files.run({})).toContain('main.typ');
    expect(await tools.search_project.run({ query: 'Uno' })).toBe('cap.typ:1: Uno.');
    expect(await tools.get_diagnostics.run({})).toContain('unknown variable');
    expect(await tools.search_typst_docs.run({ query: 'table header' })).toContain('reference/model/table#parameters');
    expect(await tools.read_typst_docs.run({ path: 'reference/model/table#x' })).toBe('# table');
  });

  it('rechazan rutas fuera del proyecto (RNF-IA.3)', async () => {
    const { tools, deps } = setup();
    await expect(tools.read_file.run({ path: '../secreto.txt' })).rejects.toThrow(/outside the project/);
    await expect(tools.read_file.run({ path: 'C:/Windows/win.ini' })).rejects.toThrow(/outside the project/);
    expect(deps.readText).not.toHaveBeenCalled();
  });

  it('propose_changes acumula en la propuesta y dice que compila', async () => {
    const { tools, proposal } = setup();
    const report = await tools.propose_changes.run({ summary: 'Arreglo', changes: [{ path: 'cap.typ', action: 'edit', search: 'Uno.', replace: 'Uno bis.' }] });
    expect(report).toContain('ok: edit cap.typ');
    expect(report).toContain('without new errors');
    expect(resultText(proposal.files.get('cap.typ'))).toBe('Uno bis.\n');
    expect(proposal.summary).toBe('Arreglo');
  });

  it('si la propuesta no compila, pide corregir y deja de insistir tras los reintentos (RF-94.3)', async () => {
    const check = async () => ({ fresh: [err('cap.typ', 'unknown variable: y')], fixed: 0 });
    const { tools } = setup({ check });
    const change = { changes: [{ path: 'cap.typ', action: 'replace_all', content: '#y' }] };
    for (let i = 0; i < MAX_FIX_ATTEMPTS; i += 1) expect(await tools.propose_changes.run(change)).toMatch(/Fix them/);
    expect(await tools.propose_changes.run(change)).toMatch(/Do not try again/);
  });
});

describe('comparar diagnósticos', () => {
  it('cuenta errores nuevos y corregidos sin confundir repetidos', () => {
    const baseline = [err('a.typ', 'x'), err('a.typ', 'x'), err('b.typ', 'z')];
    const checked = [err('a.typ', 'x'), err('c.typ', 'nuevo')];
    expect(newErrors(baseline, checked)).toEqual([err('c.typ', 'nuevo')]);
    expect(describeCheck(baseline, checked)).toMatchObject({ fixed: 2, errors: 2 });
  });
});

describe('extremo a extremo con un modelo simulado (RF-94.7)', () => {
  it('lee, propone, corrige tras el error de compilación y termina', async () => {
    let checks = 0;
    const check = async (proposal) => {
      checks += 1;
      const text = resultText(proposal.files.get('cap.typ'));
      return text.includes('#tabla') ? { fresh: [err('cap.typ', 'unknown variable: tabla')], fixed: 0 } : { fresh: [], fixed: 0 };
    };
    const { tools, proposal } = setup({ check });
    const script = [
      { text: '', toolCalls: [{ id: '1', name: 'read_file', arguments: '{"path":"cap.typ"}' }] },
      { text: '', toolCalls: [{ id: '2', name: 'propose_changes', arguments: JSON.stringify({ changes: [{ path: 'cap.typ', action: 'edit', search: 'Uno.', replace: '#tabla(columns: 2)' }] }) }] },
      { text: '', toolCalls: [{ id: '3', name: 'propose_changes', arguments: JSON.stringify({ changes: [{ path: 'cap.typ', action: 'edit', search: '#tabla(columns: 2)', replace: '#table(columns: 2)' }] }) }] },
      { text: 'Listo: he añadido una tabla.', toolCalls: [] },
    ];
    const result = await runAgent({ callModel: async () => script.shift(), tools: Object.values(tools), messages: [{ role: 'user', content: 'añade una tabla' }] });
    expect(result.outcome).toBe('done');
    expect(checks).toBe(2);
    expect(resultText(proposal.files.get('cap.typ'))).toBe('#table(columns: 2)\n');
    const toolResults = result.messages.filter((m) => m.role === 'tool').map((m) => m.content);
    expect(toolResults[1]).toMatch(/NEW error/);
    expect(toolResults[2]).toMatch(/without new errors/);
  });
});
