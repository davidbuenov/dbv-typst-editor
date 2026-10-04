// =============================================================================
// DBV Typst Editor — Proveedores en la nube para la evaluación (RNF-IA-EVAL, RF-104)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Traduce la conversación del bucle del asistente a la petición de cada
// proveedor (sin streaming: el eval no lo necesita) y lee su respuesta. Es lo
// mismo que hace `src-tauri/src/ai/providers.rs`, en pequeño. PURO: no hace
// red ni lee el entorno, así que se prueba. La clave de API la pone quien llama,
// SOLO en la cabecera (`headersFor`); nunca entra en el cuerpo ni en un resultado.

/** Proveedores en la nube que admite `eval:ai --provider`. */
export const CLOUD = {
  anthropic: { url: 'https://api.anthropic.com/v1/messages', keyEnv: 'ANTHROPIC_API_KEY', protocol: 'anthropic' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', keyEnv: 'OPENAI_API_KEY', protocol: 'openai' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', keyEnv: 'GEMINI_API_KEY', protocol: 'openai' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', keyEnv: 'OPENROUTER_API_KEY', protocol: 'openai' },
  // Un servidor propio compatible con OpenAI (llama-server, vLLM, LM Studio…): la dirección viene de `--base-url` y la clave es opcional.
  compatible: { url: null, keyEnv: 'OPENAI_COMPATIBLE_API_KEY', protocol: 'openai', keyOptional: true },
};

/** Cabeceras de la petición; aquí, y solo aquí, va la clave. */
export function headersFor(provider, key) {
  const headers = { 'Content-Type': 'application/json' };
  if (!key) return headers;
  if (CLOUD[provider].protocol === 'anthropic') {
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

const parseArguments = (raw) => {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
};

/** Cuerpo para `/chat/completions` (OpenAI, Gemini y OpenRouter). */
export function openAiBody({ messages, tools, model, temperature = 0.2 }) {
  const body = {
    model,
    temperature,
    messages: messages.map((message) => {
      if (message.role === 'tool') return { role: 'tool', tool_call_id: message.toolCallId, content: message.content ?? '' };
      if (message.role === 'assistant' && message.toolCalls?.length) {
        return {
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: { name: call.name, arguments: call.arguments },
            // Gemini 3 exige recibir de vuelta su firma de pensamiento con la llamada (si no, 400).
            ...(call.thoughtSignature ? { extra_content: { google: { thought_signature: call.thoughtSignature } } } : {}),
          })),
        };
      }
      return { role: message.role, content: message.content ?? '' };
    }),
  };
  if (tools.length) body.tools = tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } }));
  return body;
}

/** Cuerpo para `/messages` (Anthropic): el sistema va aparte y los mensajes del mismo rol se funden. */
export function anthropicBody({ messages, tools, model, temperature = 0.2, maxTokens = 4096 }) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const turns = [];
  const push = (role, blocks) => {
    const last = turns.at(-1);
    if (last?.role === role) last.content.push(...blocks);
    else turns.push({ role, content: blocks });
  };
  for (const message of messages.filter((m) => m.role !== 'system')) {
    if (message.role === 'tool') push('user', [{ type: 'tool_result', tool_use_id: message.toolCallId, content: message.content ?? '' }]);
    else if (message.role === 'assistant') {
      const blocks = [];
      if (message.content) blocks.push({ type: 'text', text: message.content });
      for (const call of message.toolCalls ?? []) blocks.push({ type: 'tool_use', id: call.id, name: call.name, input: parseArguments(call.arguments) });
      if (blocks.length) push('assistant', blocks);
    } else push('user', [{ type: 'text', text: message.content ?? '' }]);
  }
  const body = { model, max_tokens: maxTokens, temperature, messages: turns };
  if (system) body.system = system;
  if (tools.length) body.tools = tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters }));
  return body;
}

/** Respuesta de `/chat/completions` → `{text, toolCalls, usage}`. */
export function parseOpenAi(data) {
  const message = data.choices?.[0]?.message ?? {};
  return {
    text: message.content ?? '',
    toolCalls: (message.tool_calls ?? []).map((call, index) => ({
      id: call.id ?? `call_${index}`,
      name: call.function.name,
      arguments: call.function.arguments || '{}',
      ...(call.extra_content?.google?.thought_signature ? { thoughtSignature: call.extra_content.google.thought_signature } : {}),
    })),
    usage: { input: data.usage?.prompt_tokens ?? 0, output: data.usage?.completion_tokens ?? 0 },
  };
}

/** Respuesta de `/messages` → `{text, toolCalls, usage}`. */
export function parseAnthropic(data) {
  const blocks = data.content ?? [];
  return {
    text: blocks.filter((b) => b.type === 'text').map((b) => b.text).join(''),
    toolCalls: blocks.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, arguments: JSON.stringify(b.input ?? {}) })),
    usage: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0 },
  };
}

/** Petición completa (sin la clave) de un proveedor. */
export function requestFor(provider, { messages, tools, model, baseUrl = '' }) {
  const { protocol } = CLOUD[provider];
  const url = CLOUD[provider].url ?? `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  return { url, body: protocol === 'anthropic' ? anthropicBody({ messages, tools, model }) : openAiBody({ messages, tools, model }) };
}

/** Interpreta la respuesta según el proveedor. */
export function parseResponse(provider, data) {
  return CLOUD[provider].protocol === 'anthropic' ? parseAnthropic(data) : parseOpenAi(data);
}

/**
 * Motivo de un error HTTP. Los proveedores lo dan como `{"error": {"message"}}`, `{"error": "texto"}` o, Gemini,
 * como una LISTA `[{"error": {"message"}}]`; si no se entiende, el texto crudo (recortado) en vez de perderlo.
 */
export function errorMessage(text, status) {
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // No era JSON: se usa el texto tal cual.
  }
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  const detail = first?.error?.message ?? (typeof first?.error === 'string' ? first.error : null);
  return detail ?? (String(text ?? '').trim().slice(0, 500) || `HTTP ${status}`);
}

/** Suma el uso de varias respuestas. */
export function sumUsage(list) {
  return list.reduce((total, usage) => ({ input: total.input + (usage?.input ?? 0), output: total.output + (usage?.output ?? 0) }), { input: 0, output: 0 });
}
