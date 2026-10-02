// =============================================================================
// DBV Typst Editor — Bucle del asistente con herramientas (RF-94)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Puro e inyectable: el modelo (`callModel`) y las herramientas llegan como
// dependencias, así que el MISMO código lo usa la aplicación y el script de
// evaluación (RNF-IA-EVAL), que corre en Node contra un modelo local.
//
//   1. Se pide una respuesta al modelo (con las herramientas, si las admite).
//   2. Si pide herramientas, se ejecutan y sus resultados vuelven al modelo.
//   3. Se repite hasta que responda sin pedir nada, hasta el máximo de pasos
//      (RF-94.2) o hasta que el usuario lo detenga.
// La autocorrección por compilación (RF-94.3) la hace la propia herramienta
// `propose_changes`, que devuelve los errores nuevos al modelo.

/** Pasos (llamadas al modelo) por petición del usuario (ADR-V0130-002). */
export const MAX_STEPS = 15;

/**
 * @typedef {{role: string, content: string, toolCalls?: Array<{id: string, name: string, arguments: string}>, toolCallId?: string, images?: Array}} Message
 * @typedef {{name: string, description: string, parameters: object, run: (args: any) => Promise<string>, label?: (args: any) => string}} Tool
 */

/** Argumentos de una llamada (JSON del modelo); un JSON roto da `{}` y un aviso. */
export function parseArguments(raw) {
  let result = { args: {}, error: null };
  try {
    const value = JSON.parse(raw || '{}');
    result = { args: value && typeof value === 'object' ? value : {}, error: null };
  } catch (error) {
    result = { args: {}, error: `invalid JSON arguments: ${error.message}` };
  }
  return result;
}

/**
 * Ejecuta el bucle. Devuelve los mensajes nuevos (asistente y herramientas) y
 * cómo terminó: `done`, `maxSteps`, `cancelled` o `error`.
 * @param {object} options
 * @param {(request: {messages: Message[], tools: Array}) => Promise<{text: string, toolCalls: Array, usage?: object}>} options.callModel
 * @param {Tool[]} options.tools
 * @param {Message[]} options.messages Conversación hasta ahora (con sistema y contexto).
 * @param {boolean} [options.useTools]
 * @param {number} [options.maxSteps]
 * @param {(step: {tool: string, label: string, result: string}) => void} [options.onStep]
 * @param {() => boolean} [options.isCancelled]
 */
export async function runAgent({ callModel, tools, messages, useTools = true, maxSteps = MAX_STEPS, onStep = () => {}, isCancelled = () => false }) {
  const added = [];
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const specs = useTools ? tools.map(({ name, description, parameters }) => ({ name, description, parameters })) : [];
  let outcome = 'done';
  let usage = { input: 0, output: 0 };
  for (let step = 0; ; step += 1) {
    if (isCancelled()) {
      outcome = 'cancelled';
      break;
    }
    if (step >= maxSteps) {
      outcome = 'maxSteps';
      break;
    }
    let response;
    try {
      response = await callModel({ messages: [...messages, ...added], tools: specs });
    } catch (error) {
      outcome = error?.kind === 'cancelled' ? 'cancelled' : 'error';
      added.push({ role: 'error', content: error?.message ?? String(error), kind: error?.kind ?? 'unknown' });
      break;
    }
    usage = { input: usage.input + (response.usage?.input ?? 0), output: usage.output + (response.usage?.output ?? 0) };
    const calls = useTools ? response.toolCalls ?? [] : [];
    added.push({ role: 'assistant', content: response.text ?? '', toolCalls: calls });
    if (!calls.length) break;
    for (const call of calls) {
      const tool = byName.get(call.name);
      const { args, error } = parseArguments(call.arguments);
      let result;
      if (!tool) result = `error: unknown tool "${call.name}"`;
      else if (error) result = `error: ${error}`;
      else {
        try {
          result = await tool.run(args);
        } catch (failure) {
          result = `error: ${failure?.message ?? failure}`;
        }
      }
      onStep({ tool: call.name, label: tool?.label?.(args) ?? call.name, result });
      added.push({ role: 'tool', toolCallId: call.id, content: String(result) });
      if (isCancelled()) break;
    }
  }
  return { messages: added, outcome, usage };
}
