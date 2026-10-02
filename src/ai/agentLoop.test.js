// =============================================================================
// DBV Typst Editor — Tests del bucle del asistente y del contexto (RF-94)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { parseArguments, runAgent } from './agentLoop.js';
import { buildContext, estimateTokens, systemPrompt, windowAround } from './context.js';

/** Modelo simulado con guion: devuelve las respuestas en orden. */
function scripted(...responses) {
  const calls = [];
  const callModel = vi.fn(async (request) => {
    calls.push(request);
    return responses.shift() ?? { text: 'fin', toolCalls: [] };
  });
  return { callModel, calls };
}

const tool = (name, run) => ({ name, description: name, parameters: { type: 'object' }, run: vi.fn(run), label: (args) => `${name} ${JSON.stringify(args)}` });

describe('runAgent', () => {
  it('ejecuta herramientas y devuelve sus resultados al modelo hasta que responde', async () => {
    const read = tool('read_file', async ({ path }) => `contenido de ${path}`);
    const { callModel, calls } = scripted(
      { text: '', toolCalls: [{ id: 'c1', name: 'read_file', arguments: '{"path":"main.typ"}' }], usage: { input: 10, output: 2 } },
      { text: 'Hecho.', toolCalls: [], usage: { input: 20, output: 5 } },
    );
    const steps = [];
    const result = await runAgent({ callModel, tools: [read], messages: [{ role: 'user', content: 'hola' }], onStep: (s) => steps.push(s) });
    expect(result.outcome).toBe('done');
    expect(read.run).toHaveBeenCalledWith({ path: 'main.typ' });
    expect(calls[1].messages.at(-1)).toEqual({ role: 'tool', toolCallId: 'c1', content: 'contenido de main.typ' });
    expect(result.messages.at(-1).content).toBe('Hecho.');
    expect(result.usage).toEqual({ input: 30, output: 7 });
    expect(steps[0].label).toContain('main.typ');
  });

  it('se para en el máximo de pasos', async () => {
    const loop = tool('list_files', async () => 'a.typ');
    const callModel = vi.fn(async () => ({ text: '', toolCalls: [{ id: 'x', name: 'list_files', arguments: '{}' }] }));
    const result = await runAgent({ callModel, tools: [loop], messages: [], maxSteps: 3 });
    expect(result.outcome).toBe('maxSteps');
    expect(callModel).toHaveBeenCalledTimes(3);
  });

  it('una herramienta desconocida, un JSON roto o una excepción vuelven como error al modelo', async () => {
    const boom = tool('boom', async () => {
      throw new Error('falló');
    });
    const { callModel } = scripted({
      text: '',
      toolCalls: [
        { id: '1', name: 'nada', arguments: '{}' },
        { id: '2', name: 'boom', arguments: '{roto' },
        { id: '3', name: 'boom', arguments: '{}' },
      ],
    });
    const result = await runAgent({ callModel, tools: [boom], messages: [] });
    const tools = result.messages.filter((m) => m.role === 'tool').map((m) => m.content);
    expect(tools[0]).toMatch(/unknown tool/);
    expect(tools[1]).toMatch(/invalid JSON/);
    expect(tools[2]).toBe('error: falló');
  });

  it('sin herramientas no se ofrecen ni se ejecutan', async () => {
    const read = tool('read_file', async () => 'x');
    const { callModel, calls } = scripted({ text: 'respuesta', toolCalls: [{ id: '1', name: 'read_file', arguments: '{}' }] });
    const result = await runAgent({ callModel, tools: [read], messages: [], useTools: false });
    expect(calls[0].tools).toEqual([]);
    expect(read.run).not.toHaveBeenCalled();
    expect(result.messages).toHaveLength(1);
  });

  it('se detiene si el usuario cancela, y un error del proveedor termina con su tipo', async () => {
    let cancelled = false;
    const slow = tool('list_files', async () => {
      cancelled = true;
      return 'x';
    });
    const { callModel } = scripted({ text: '', toolCalls: [{ id: '1', name: 'list_files', arguments: '{}' }] });
    expect((await runAgent({ callModel, tools: [slow], messages: [], isCancelled: () => cancelled })).outcome).toBe('cancelled');
    const failing = vi.fn(async () => {
      throw Object.assign(new Error('clave mala'), { kind: 'auth' });
    });
    const result = await runAgent({ callModel: failing, tools: [], messages: [] });
    expect(result.outcome).toBe('error');
    expect(result.messages[0]).toMatchObject({ role: 'error', kind: 'auth' });
  });

  it('parseArguments tolera vacío y objetos', () => {
    expect(parseArguments('')).toEqual({ args: {}, error: null });
    expect(parseArguments('[1]').args).toEqual([1]);
    expect(parseArguments('{"a":1}').args).toEqual({ a: 1 });
  });
});

describe('contexto con presupuesto (RF-94.5)', () => {
  const big = Array.from({ length: 2000 }, (_, i) => `Línea ${i} del capítulo.`).join('\n');
  const source = {
    projectName: 'Libro',
    entrypoint: 'main.typ',
    files: ['main.typ', 'cap/uno.typ'],
    active: { path: 'cap/uno.typ', content: big, cursor: big.indexOf('Línea 1500'), selection: 'Línea 1500 del capítulo.' },
    diagnostics: [{ level: 'error', file: 'cap/uno.typ', line: 3, message: 'unknown variable: foo' }],
    outline: [{ level: 1, text: 'Introducción' }],
  };

  it('con poco presupuesto, la selección y el fichero recortado alrededor del cursor entran antes que el resto', () => {
    const { text, items } = buildContext(source, 1500);
    expect(estimateTokens(text)).toBeLessThanOrEqual(1500);
    expect(items.find((i) => i.id === 'selection').included).toBe(true);
    const active = items.find((i) => i.id === 'active');
    expect(active).toMatchObject({ included: true, trimmed: true });
    expect(text).toContain('Línea 1500');
    expect(text).not.toContain('Línea 3 del');
  });

  it('con presupuesto de sobra entra todo y nada se marca como recortado', () => {
    const { items } = buildContext({ ...source, active: { ...source.active, content: 'corto' } }, 100000);
    expect(items.every((i) => i.included && !i.trimmed)).toBe(true);
  });

  it('lo que el usuario quita del indicador no se envía', () => {
    const { text, items } = buildContext({ ...source, excluded: ['diagnostics', 'outline'] }, 100000);
    expect(text).not.toContain('unknown variable');
    expect(items.some((i) => i.id === 'diagnostics')).toBe(false);
  });

  it('windowAround corta en límites de línea', () => {
    const view = windowAround('a\nbb\nccc\ndddd\neeeee', 9, 8);
    expect(view.trimmed).toBe(true);
    expect(view.text.startsWith('ccc') || view.text.startsWith('bb')).toBe(true);
  });

  it('las instrucciones cambian con o sin herramientas y con el idioma', () => {
    expect(systemPrompt({ tools: true })).toContain('propose_changes');
    expect(systemPrompt({ tools: false })).toContain('dbv-edit');
    expect(systemPrompt({ lang: 'en' })).toContain('Answer in English');
    expect(systemPrompt()).toContain('NOT LaTeX');
  });
});
