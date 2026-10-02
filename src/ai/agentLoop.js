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

/**
 * Llamadas a herramientas escritas como texto (`<tool_call>{"name": …,
 * "arguments": …}</tool_call>`, el formato de Qwen/Hermes) cuando el servidor
 * no las reconoció. Devuelve las llamadas y el texto sin ellas.
 */
export function extractTextToolCalls(text) {
  const calls = [];
  const rest = String(text ?? '').replace(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g, (match, body) => {
    try {
      const value = JSON.parse(body);
      if (value && typeof value.name === 'string') {
        calls.push({ id: `text_${calls.length}`, name: value.name, arguments: JSON.stringify(value.arguments ?? value.parameters ?? {}) });
        return '';
      }
    } catch {
      // No es una llamada válida: se queda como texto.
    }
    return match;
  });
  return { calls, text: rest.trim() };
}

/** Recordatorio si el modelo dice que hay que usar `propose_changes` y no la usa. */
export function proposeNudge(text) {
  return /propose_changes/.test(text ?? '')
    ? 'You mentioned propose_changes but did not call it. If a file must change, call the propose_changes tool now with the exact edit; otherwise answer briefly without code.'
    : null;
}

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

/** Etiqueta de un paso. Los argumentos los escribe el modelo: si no encajan, nunca debe tumbar el turno. */
function safeLabel(tool, args, fallback) {
  try {
    return tool?.label?.(args) ?? fallback;
  } catch {
    return fallback;
  }
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
export async function runAgent({ callModel, tools, messages, useTools = true, maxSteps = MAX_STEPS, onStep = () => {}, isCancelled = () => false, followUp = () => null }) {
  const added = [];
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const specs = useTools ? tools.map(({ name, description, parameters }) => ({ name, description, parameters })) : [];
  let outcome = 'done';
  let usage = { input: 0, output: 0 };
  let nudged = false;
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
    // Modelos pequeños escriben a veces la llamada como texto (`<tool_call>…`).
    const fromText = useTools && !response.toolCalls?.length ? extractTextToolCalls(response.text ?? '') : null;
    const calls = useTools ? (fromText?.calls.length ? fromText.calls : response.toolCalls ?? []) : [];
    added.push({ role: 'assistant', content: fromText?.calls.length ? fromText.text : response.text ?? '', toolCalls: calls });
    if (!calls.length) {
      // Un solo recordatorio si el modelo dijo que iba a usar una herramienta y no lo hizo.
      const nudge = nudged ? null : followUp(response.text ?? '');
      if (!nudge) break;
      nudged = true;
      added.push({ role: 'user', content: nudge });
      continue;
    }
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
      onStep({ tool: call.name, label: safeLabel(tool, args, call.name), result });
      added.push({ role: 'tool', toolCallId: call.id, content: String(result) });
      if (isCancelled()) break;
    }
  }
  return { messages: added, outcome, usage };
}
