// =============================================================================
// DBV Typst Editor — Tests de las herramientas del asistente (RF-94)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { runAgent } from './agentLoop.js';
import { createProposal, resultText } from './proposal.js';
import { detectStyleFiles, importedFiles, separationChecks } from './styleFiles.js';
import { estimateTokens } from './context.js';
import { TOOL_SPEC_TOKENS } from './modelFit.js';
import { createTools, describeCheck, describePackageCheck, formatUniverseResult, MAX_FIX_ATTEMPTS, newErrors, newPackageIds } from './tools.js';

const err = (file, message) => ({ level: 'error', file, line: 1, message });

function setup({ check, universe } = {}) {
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
    ...(universe ?? {}),
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

  it('TOOL_SPEC_TOKENS cubre lo que ocupan las definiciones de las herramientas (RF-103)', () => {
    const { deps } = setup();
    const specs = createTools(deps).map(({ name, description, parameters }) => ({ name, description, parameters }));
    const real = estimateTokens(JSON.stringify(specs));
    // Si las herramientas crecen, hay que subir la constante: el presupuesto de contexto depende de ella.
    expect(real).toBeLessThanOrEqual(TOOL_SPEC_TOKENS);
    expect(real).toBeGreaterThan(TOOL_SPEC_TOKENS * 0.8);
  });

  it('rechazan rutas fuera del proyecto (RNF-IA.3)', async () => {
    const { tools, deps } = setup();
    await expect(tools.read_file.run({ path: '../secreto.txt' })).rejects.toThrow(/outside the project/);
    await expect(tools.read_file.run({ path: 'C:/Windows/win.ini' })).rejects.toThrow(/outside the project/);
    expect(deps.readText).not.toHaveBeenCalled();
  });

  it('la etiqueta de propose_changes tolera argumentos que no son una lista', () => {
    const { tools } = setup();
    for (const changes of [undefined, null, 'cap.typ', { path: 'cap.typ' }, [null, { path: 'a.typ' }]]) {
      expect(() => tools.propose_changes.label({ changes })).not.toThrow();
    }
    expect(tools.propose_changes.label({ changes: { path: 'cap.typ' } })).toContain('el proyecto');
    expect(tools.propose_changes.label({ changes: [{ path: 'a.typ' }] })).toContain('a.typ');
  });

  it('propose_changes acumula en la propuesta y dice que compila', async () => {
    const { tools, proposal } = setup();
    const report = await tools.propose_changes.run({ summary: 'Arreglo', changes: [{ path: 'cap.typ', action: 'edit', search: 'Uno.', replace: 'Uno bis.' }] });
    expect(report).toContain('ok: edit cap.typ');
    expect(report).toContain('without new errors');
    expect(resultText(proposal.files.get('cap.typ'))).toBe('Uno bis.\n');
    expect(proposal.summary).toBe('Arreglo');
  });

  it('propose_changes sin cambios utilizables avisa de que NO se propuso nada', async () => {
    const { tools, proposal, deps } = setup();
    for (const changes of [undefined, [], null, 'cap.typ', 7]) {
      // El aviso específico (nada recibido) es el que ve el modelo, no el genérico de «ningún cambio modificó un fichero».
      expect(await tools.propose_changes.run({ changes })).toMatch(/no changes were received, so NOTHING was proposed/);
    }
    expect(proposal.files.size).toBe(0);
    expect(deps.readText).not.toHaveBeenCalled();
  });

  it('propose_changes acepta un único cambio como objeto en vez de lista', async () => {
    const { tools, proposal } = setup();
    const report = await tools.propose_changes.run({ changes: { path: 'cap.typ', action: 'edit', search: 'Uno.', replace: 'Uno bis.' } });
    expect(report).toContain('ok: edit cap.typ');
    expect(resultText(proposal.files.get('cap.typ'))).toBe('Uno bis.\n');
  });

  it('en un documento suelto propose_changes rechaza cualquier otro fichero (RF-106.7)', async () => {
    const { tools, proposal, deps } = setup();
    const confined = Object.fromEntries(createTools({ ...deps, allowPath: (path) => path === 'cap.typ' }).map((tool) => [tool.name, tool]));
    const report = await confined.propose_changes.run({
      changes: [
        { path: 'main.typ', action: 'edit', search: 'Hola', replace: 'Adiós' },
        { path: 'nuevo.typ', action: 'create', content: 'x' },
        { path: 'cap.typ', action: 'edit', search: 'Uno.', replace: 'Uno bis.' },
      ],
    });
    expect(report).toContain('error: main.typ');
    expect(report).toContain('error: nuevo.typ');
    expect(report).toContain('ok: edit cap.typ');
    expect([...proposal.files.keys()]).toEqual(['cap.typ']);
  });

  it('propose_changes avisa si ningún cambio modifica un fichero (idéntico o fallido)', async () => {
    const { tools, proposal } = setup();
    const same = await tools.propose_changes.run({ changes: [{ path: 'cap.typ', action: 'edit', search: 'Uno.', replace: 'Uno.' }] });
    expect(same).toMatch(/NOTHING was proposed/);
    const missing = await tools.propose_changes.run({ changes: [{ path: 'cap.typ', action: 'edit', search: 'no existe', replace: 'x' }] });
    expect(missing).toContain('error: cap.typ');
    expect(missing).toMatch(/NOTHING was proposed/);
    expect(proposal.files.size).toBe(0);
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

describe('separar presentación de contenido con un modelo simulado (RF-105.8)', () => {
  const MAIN = '= Informe\n\nTexto del informe.\n';
  const STYLE = '#let estilo(doc) = {\n  set page(margin: 2cm)\n  doc\n}\n';

  /** Ejecuta el bucle real con un modelo con guion sobre un proyecto; devuelve el proyecto resultante. */
  async function run(files, calls) {
    const proposal = createProposal();
    const deps = {
      getRoot: () => 'D:/p',
      join: (root, rel) => `${root}/${rel}`,
      readText: async (path) => files[path] ?? null,
      listFiles: async () => Object.keys(files),
      search: async () => [],
      diagnostics: async () => [],
      outline: () => [],
      docsSearch: async () => [],
      docsPage: async () => null,
      checkProposal: async () => ({ fresh: [], fixed: 0 }),
      getProposal: () => proposal,
    };
    const tools = createTools(deps);
    const script = [{ text: '', toolCalls: [{ id: '1', name: 'propose_changes', arguments: JSON.stringify({ changes: calls }) }] }, { text: 'Hecho.', toolCalls: [] }];
    await runAgent({ callModel: async () => script.shift(), tools, messages: [{ role: 'user', content: 'cambia el aspecto' }] });
    const after = { ...files };
    for (const file of proposal.files.values()) after[file.path] = resultText(file);
    return after;
  }

  it('sin fichero de estilo: lo crea y el principal solo lo importa y lo aplica', async () => {
    const after = await run({ 'main.typ': MAIN }, [
      { path: 'estilos.typ', action: 'create', content: STYLE.replace('2cm', '3cm') },
      { path: 'main.typ', action: 'edit', search: '= Informe', replace: '#import "estilos.typ": estilo\n#show: estilo\n\n= Informe' },
    ]);
    expect(Object.keys(after).sort()).toEqual(['estilos.typ', 'main.typ']);
    expect(separationChecks({ before: { 'main.typ': MAIN }, after })).toEqual({ contentKept: true, styleChanged: true });
    expect(importedFiles(after['main.typ'])).toEqual(['estilos.typ']);
  });

  it('con fichero de estilo: el cambio de aspecto es una edición del fichero de estilo y el principal no se toca', async () => {
    const before = { 'main.typ': `#import "estilos.typ": estilo\n#show: estilo\n\n${MAIN}`, 'estilos.typ': STYLE };
    const after = await run(before, [{ path: 'estilos.typ', action: 'edit', search: '2cm', replace: '3cm' }]);
    expect(after['main.typ']).toBe(before['main.typ']);
    expect(after['estilos.typ']).toContain('3cm');
    expect(separationChecks({ before, after })).toEqual({ contentKept: true, styleChanged: true });
    expect(detectStyleFiles({ files: Object.keys(after) })).toEqual(['estilos.typ']);
  });

  it('la métrica detecta el caso malo: las reglas puestas en el principal', async () => {
    const after = await run({ 'main.typ': MAIN }, [{ path: 'main.typ', action: 'edit', search: '= Informe', replace: '#set text(font: "Libertinus Serif", size: 12pt)\n= Informe' }]);
    expect(separationChecks({ before: { 'main.typ': MAIN }, after })).toEqual({ contentKept: false, styleChanged: false });
  });
});

const HIT = { id: '@preview/charged-ieee:0.1.4', name: 'charged-ieee', version: '0.1.4', description: 'An IEEE-style paper template', kind: 'template', categories: ['paper'], license: 'MIT-0', updated: '2025-01-10', newerIncompatible: null };
const CETZ = { id: '@preview/cetz:0.5.2', name: 'cetz', version: '0.5.2', description: 'Drawing with Typst', kind: 'package', categories: [], license: 'LGPL-3.0-or-later', updated: '2025-10-09', newerIncompatible: { version: '0.6.0', compiler: '0.16.0' } };

describe('search_universe (RF-108.2)', () => {
  it('solo se ofrece si hay catálogo que consultar', () => {
    expect(setup().tools.search_universe).toBeUndefined();
    expect(setup({ universe: { universeSearch: async () => ({ status: 'ok', hits: [] }) } }).tools.search_universe).toBeDefined();
  });

  it('devuelve el identificador completo de cada resultado y recuerda no escribir nada de memoria', async () => {
    const universeSearch = vi.fn(async () => ({ status: 'ok', hits: [HIT, CETZ] }));
    const { tools } = setup({ universe: { universeSearch } });
    const text = await tools.search_universe.run({ query: 'ieee', kind: 'template' });
    expect(universeSearch).toHaveBeenCalledWith('ieee', 'template');
    expect(text).toContain('1. @preview/charged-ieee:0.1.4 — template [paper] — An IEEE-style paper template (MIT-0, 2025-01-10)');
    expect(text).toContain('2. @preview/cetz:0.5.2 — package');
    expect(text).toContain('a newer 0.6.0 exists but needs Typst 0.16.0');
    expect(text).toMatch(/ONLY these exact identifiers/);
    expect(text).toMatch(/never write a package or a version from memory/);
  });

  it('un tipo desconocido se trata como «any» y la consulta no es un riesgo', async () => {
    const universeSearch = vi.fn(async () => ({ status: 'ok', hits: [] }));
    const { tools } = setup({ universe: { universeSearch } });
    await tools.search_universe.run({ query: 12, kind: '../../x' });
    expect(universeSearch).toHaveBeenCalledWith('12', 'any');
  });

  it('sin catálogo lo dice y manda a la galería en vez de dejar que adivine', async () => {
    const { tools } = setup({ universe: { universeSearch: async () => ({ status: 'noCatalog', hits: [] }) } });
    const text = await tools.search_universe.run({ query: 'cetz' });
    expect(text).toMatch(/not available yet/);
    expect(text).toMatch(/do NOT guess/);
  });

  it('sin resultados no inventa y avisa del paquete que existe pero no cabe en este compilador', async () => {
    const { tools } = setup({ universe: { universeSearch: async () => ({ status: 'ok', hits: [], unavailable: [{ name: 'futuro', compiler: '0.16.0' }] }) } });
    const text = await tools.search_universe.run({ query: 'futuro' });
    expect(text).toContain('no results for "futuro"');
    expect(text).toContain('futuro exists but needs Typst 0.16.0 or newer');
    expect(text).toMatch(/Do not invent/);
  });

  it('las definiciones de las herramientas, con ésta incluida, caben en el presupuesto de contexto (RF-103)', () => {
    const { deps } = setup({ universe: { universeSearch: async () => ({ status: 'ok', hits: [] }) } });
    const specs = createTools(deps).map(({ name, description, parameters }) => ({ name, description, parameters }));
    expect(estimateTokens(JSON.stringify(specs))).toBeLessThanOrEqual(TOOL_SPEC_TOKENS);
  });
});

describe('paquetes que la IA escribe en una propuesta (RF-108.4)', () => {
  const change = (content) => ({ changes: [{ path: 'main.typ', action: 'replace_all', content }] });

  it('newPackageIds solo devuelve los identificadores que el texto ESTRENA', () => {
    const before = '#import "@preview/cetz:0.4.2": canvas\n';
    const after = '#import "@preview/cetz:0.4.2": canvas\n#import "@preview/tablex:0.0.9": *\n#import "@preview/tablex:0.0.9": tablex\n';
    expect(newPackageIds(after, before)).toEqual(['@preview/tablex:0.0.9']);
    expect(newPackageIds('#import "@local/x:1.0.0"')).toEqual([]);
    expect(newPackageIds('#import "@preview/sin-version"')).toEqual([]);
  });

  it('describePackageCheck dice qué usar en cada caso y calla cuando está bien', () => {
    expect(describePackageCheck({ id: '@preview/cetz:0.5.2', status: 'ok' })).toBeNull();
    expect(describePackageCheck({ id: '@preview/inventado:1.0.0', status: 'unknownPackage' })).toMatch(/Never invent a package/);
    expect(describePackageCheck({ id: '@preview/cetz:0.4.2', status: 'outdated', latest: '0.5.2' })).toContain('@preview/cetz:0.5.2');
    expect(describePackageCheck({ id: '@preview/cetz:9.9.9', status: 'unknownVersion', latest: '0.5.2' })).toContain('never write a version from memory');
    expect(describePackageCheck({ id: '@preview/cetz:0.6.0', status: 'needsNewerCompiler', latest: '0.5.2', compiler: '0.16.0' })).toMatch(/needs Typst 0\.16\.0/);
    expect(describePackageCheck({ id: '@preview/futuro:1.0.0', status: 'unavailable', compiler: '0.16.0' })).toMatch(/Choose another package/);
  });

  it('una propuesta con un paquete inexistente o con una versión de memoria recibe el aviso, y se propone igual', async () => {
    const universeCheck = vi.fn(async () => [
      { id: '@preview/cetz:0.4.2', status: 'outdated', latest: '0.5.2' },
      { id: '@preview/inventado:1.0.0', status: 'unknownPackage' },
    ]);
    const { tools, proposal } = setup({ universe: { universeCheck } });
    const result = await tools.propose_changes.run(change('#import "@preview/cetz:0.4.2": canvas\n#import "@preview/inventado:1.0.0": *\n'));
    expect(universeCheck).toHaveBeenCalledWith(['@preview/cetz:0.4.2', '@preview/inventado:1.0.0']);
    expect(result).toContain('WARNING about packages');
    expect(result).toContain('@preview/cetz:0.5.2');
    expect(result).toContain('Never invent a package');
    expect(proposal.files.size).toBe(1);
  });

  it('un paquete que ya estaba en el fichero no se vuelve a cuestionar, ni uno que está bien', async () => {
    const universeCheck = vi.fn(async () => [{ id: '@preview/cetz:0.5.2', status: 'ok' }]);
    const { tools, deps } = setup({ universe: { universeCheck } });
    deps.readText.mockImplementation(async () => '#import "@preview/viejo:0.1.0": *\n= Hola\n');
    const result = await tools.propose_changes.run(change('#import "@preview/viejo:0.1.0": *\n#import "@preview/cetz:0.5.2": canvas\n= Hola\n'));
    expect(universeCheck).toHaveBeenCalledWith(['@preview/cetz:0.5.2']);
    expect(result).not.toContain('WARNING');
  });

  it('sin paquetes nuevos ni siquiera se consulta el catálogo', async () => {
    const universeCheck = vi.fn(async () => []);
    const { tools } = setup({ universe: { universeCheck } });
    await tools.propose_changes.run(change('= Otro título\n'));
    expect(universeCheck).not.toHaveBeenCalled();
  });

  it('con el catálogo sin descargar (sin veredictos) no se inventa ningún aviso', async () => {
    const { tools } = setup({ universe: { universeCheck: async () => [] } });
    const result = await tools.propose_changes.run(change('#import "@preview/cetz:0.5.2": canvas\n'));
    expect(result).not.toContain('WARNING');
  });

  it('formatUniverseResult acepta un resultado vacío sin lanzar', () => {
    expect(formatUniverseResult({ status: 'ok', hits: [] }, 'x')).toContain('no results');
  });
});
