// =============================================================================
// DBV Typst Editor — Tests de los proveedores del eval (RF-104)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { anthropicBody, CLOUD, headersFor, openAiBody, parseAnthropic, parseOpenAi, requestFor, sumUsage } from '../../scripts/evalProviders.mjs';

const TOOLS = [{ name: 'read_file', description: 'Lee', parameters: { type: 'object', properties: { path: { type: 'string' } } } }];
const CONVERSATION = [
  { role: 'system', content: 'Eres útil.' },
  { role: 'system', content: '# Context' },
  { role: 'user', content: 'Mejora el párrafo' },
  { role: 'assistant', content: '', toolCalls: [{ id: 't1', name: 'read_file', arguments: '{"path":"main.typ"}' }] },
  { role: 'tool', toolCallId: 't1', content: '= Hola' },
  { role: 'user', content: 'Recuerda llamar a la herramienta' },
];

describe('cuerpo para OpenAI, Gemini y OpenRouter', () => {
  const body = openAiBody({ messages: CONVERSATION, tools: TOOLS, model: 'gpt-x' });

  it('traduce herramientas, llamadas y resultados', () => {
    expect(body.model).toBe('gpt-x');
    expect(body.tools[0]).toEqual({ type: 'function', function: { name: 'read_file', description: 'Lee', parameters: TOOLS[0].parameters } });
    expect(body.messages[3]).toEqual({ role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'read_file', arguments: '{"path":"main.typ"}' } }] });
    expect(body.messages[4]).toEqual({ role: 'tool', tool_call_id: 't1', content: '= Hola' });
  });

  it('sin herramientas no manda el campo', () => {
    expect(openAiBody({ messages: CONVERSATION, tools: [], model: 'm' }).tools).toBeUndefined();
  });
});

describe('cuerpo para Anthropic', () => {
  const body = anthropicBody({ messages: CONVERSATION, tools: TOOLS, model: 'claude-x' });

  it('junta los mensajes de sistema aparte y usa bloques', () => {
    expect(body.system).toBe('Eres útil.\n\n# Context');
    expect(body.messages.every((m) => m.role !== 'system')).toBe(true);
    expect(body.messages[1]).toEqual({ role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'read_file', input: { path: 'main.typ' } }] });
    expect(body.tools[0].input_schema).toEqual(TOOLS[0].parameters);
  });

  it('funde el resultado de la herramienta y el recordatorio en un solo mensaje de usuario (lo exige la API)', () => {
    expect(body.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(body.messages[2].content).toEqual([
      { type: 'tool_result', tool_use_id: 't1', content: '= Hola' },
      { type: 'text', text: 'Recuerda llamar a la herramienta' },
    ]);
  });

  it('argumentos que no son JSON dan un objeto vacío, no una excepción', () => {
    const odd = anthropicBody({ messages: [{ role: 'assistant', content: '', toolCalls: [{ id: 'x', name: 'f', arguments: '{roto' }] }], tools: [], model: 'm' });
    expect(odd.messages[0].content[0].input).toEqual({});
  });
});

describe('respuestas', () => {
  it('lee la de OpenAI con llamadas a herramientas y uso', () => {
    const data = { choices: [{ message: { content: 'Hecho', tool_calls: [{ id: 'c1', function: { name: 'read_file', arguments: '{"path":"a.typ"}' } }] } }], usage: { prompt_tokens: 120, completion_tokens: 30 } };
    expect(parseOpenAi(data)).toEqual({ text: 'Hecho', toolCalls: [{ id: 'c1', name: 'read_file', arguments: '{"path":"a.typ"}' }], usage: { input: 120, output: 30 } });
    expect(parseOpenAi({})).toEqual({ text: '', toolCalls: [], usage: { input: 0, output: 0 } });
  });

  it('lee la de Anthropic con bloques de texto y de herramienta', () => {
    const data = { content: [{ type: 'text', text: 'Voy' }, { type: 'tool_use', id: 'u1', name: 'read_file', input: { path: 'a.typ' } }], usage: { input_tokens: 90, output_tokens: 12 } };
    expect(parseAnthropic(data)).toEqual({ text: 'Voy', toolCalls: [{ id: 'u1', name: 'read_file', arguments: '{"path":"a.typ"}' }], usage: { input: 90, output: 12 } });
  });

  it('suma el uso de varias respuestas', () => {
    expect(sumUsage([{ input: 1, output: 2 }, { input: 10, output: 20 }, null])).toEqual({ input: 11, output: 22 });
  });
});

describe('la clave de API', () => {
  const KEY = 'sk-SUPER-SECRETA';

  it('viaja solo en la cabecera, nunca en el cuerpo de ningún proveedor', () => {
    for (const provider of Object.keys(CLOUD)) {
      const { body } = requestFor(provider, { messages: CONVERSATION, tools: TOOLS, model: 'm' });
      expect(JSON.stringify(body), provider).not.toContain(KEY);
      expect(Object.values(headersFor(provider, KEY)).some((value) => String(value).includes(KEY)), provider).toBe(true);
    }
  });

  it('Anthropic usa x-api-key y los demás Authorization: Bearer', () => {
    expect(headersFor('anthropic', KEY)['x-api-key']).toBe(KEY);
    expect(headersFor('anthropic', KEY).Authorization).toBeUndefined();
    expect(headersFor('openai', KEY).Authorization).toBe(`Bearer ${KEY}`);
    expect(headersFor('gemini', KEY)['x-api-key']).toBeUndefined();
  });

  it('cada proveedor lee su clave de su propia variable de entorno', () => {
    expect(Object.fromEntries(Object.entries(CLOUD).map(([name, info]) => [name, info.keyEnv]))).toEqual({
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      gemini: 'GEMINI_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      compatible: 'OPENAI_COMPATIBLE_API_KEY',
    });
  });

  it('un servidor propio compatible lleva su dirección y puede ir sin clave', () => {
    const { url } = requestFor('compatible', { messages: CONVERSATION, tools: [], model: 'm', baseUrl: 'http://127.0.0.1:8080/v1/' });
    expect(url).toBe('http://127.0.0.1:8080/v1/chat/completions');
    expect(headersFor('compatible', undefined)).toEqual({ 'Content-Type': 'application/json' });
    expect(CLOUD.compatible.keyOptional).toBe(true);
  });
});
