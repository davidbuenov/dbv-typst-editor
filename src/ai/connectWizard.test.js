// =============================================================================
// DBV Typst Editor — Tests del formulario de conexión (RF-101, RF-103)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerTranslations, setLanguage } from '../i18n/i18n.js';
import { createConnectWizard } from './connectWizard.js';
import { AI_TRANSLATIONS } from './translations.js';

registerTranslations(AI_TRANSLATIONS);

const ok = (value) => ({ ok: true, value });
const providers = [
  { provider: 'ollama', baseUrl: 'http://localhost:11434/v1', contextTokens: 4096, cloud: false },
  { provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', contextTokens: 32768, cloud: true },
];

const SMALL = { parameterSize: '3.1B', contextLength: 32768, capabilities: ['completion', 'tools'] };
const THINKER = { parameterSize: '8.2B', contextLength: 40960, capabilities: ['completion', 'tools', 'thinking'] };

async function setup({ info = null } = {}) {
  document.body.innerHTML = '<div id="host"></div>';
  const backend = {
    aiProviders: vi.fn(async () => ok(providers)),
    aiConnections: vi.fn(async () => ok({ connections: [], active: null, showAi: true })),
    aiDetect: vi.fn(async () => ok({ servers: [{ provider: 'ollama', running: true, models: ['qwen3:8b'] }], tools: [] })),
    aiModelInfo: vi.fn(async () => ok(info)),
    aiListModels: vi.fn(async () => ok(['qwen3:8b'])),
    aiSaveConnection: vi.fn(async (connection) => ok({ file: { connections: [connection], active: connection.id, showAi: true }, keyStorage: null })),
    aiSetPreferences: vi.fn(async () => ok(null)),
    aiDeleteConnection: vi.fn(),
    openExternalUrl: vi.fn(),
  };
  const host = document.getElementById('host');
  const wizard = createConnectWizard({ host, backend, onChanged: vi.fn(), notify: vi.fn() });
  await wizard.open();
  await vi.waitFor(() => expect(host.querySelector('.ai-detect__item button')).not.toBeNull());
  return { host, backend };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function openOllamaForm(context) {
  context.host.querySelector('.ai-detect__item button').click();
  await vi.waitFor(() => expect(context.backend.aiModelInfo).toHaveBeenCalled());
  await settle();
}

const selectByLabel = (host, label) => [...host.querySelectorAll('.ai-form__row')].find((row) => row.textContent.startsWith(label))?.querySelector('select');
const hintOf = (host, label) => [...host.querySelectorAll('.ai-form__row')].find((row) => row.textContent.startsWith(label))?.querySelector('.ai-form__hint').textContent;
const advice = (host) => [...host.querySelectorAll('.ai-advice')].map((node) => node.textContent);
const saveButton = (host) => [...host.querySelectorAll('.ai-form__actions button')].find((b) => b.classList.contains('button--primary'));

beforeEach(() => setLanguage('es'));

describe('avisos del modelo en el formulario (RF-103)', () => {
  it('un modelo pequeño con el contexto por defecto de Ollama avisa de las dos cosas, con los números', async () => {
    const context = await setup({ info: SMALL });
    await openOllamaForm(context);
    const messages = advice(context.host);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('modelo pequeño (3.1B)');
    expect(messages[1]).toMatch(/4[. ]?096 tokens/);
    expect(messages[1]).toMatch(/8[. ]?192/);
  });

  it('un modelo grande con contexto suficiente no avisa de nada', async () => {
    const context = await setup({ info: THINKER });
    await openOllamaForm(context);
    const contextInput = context.host.querySelector('input[type="number"]');
    contextInput.value = '16384';
    contextInput.dispatchEvent(new Event('change'));
    await settle();
    expect(advice(context.host)).toEqual([]);
  });

  it('sin información del modelo (servidor que no la da) no se inventa ningún aviso de tamaño', async () => {
    const context = await setup({ info: null });
    await openOllamaForm(context);
    expect(advice(context.host).every((text) => !text.includes('modelo pequeño'))).toBe(true);
  });
});

describe('interruptor «Razonamiento» (RF-101)', () => {
  it('un modelo que razona: desactivado por defecto, activable, y se guarda en la conexión', async () => {
    const context = await setup({ info: THINKER });
    await openOllamaForm(context);
    const reasoning = selectByLabel(context.host, 'Razonamiento');
    expect(reasoning.disabled).toBe(false);
    expect(reasoning.value).toBe('false');
    reasoning.value = 'true';
    reasoning.dispatchEvent(new Event('change'));
    await settle();
    saveButton(context.host).click();
    await vi.waitFor(() => expect(context.backend.aiSaveConnection).toHaveBeenCalled());
    expect(context.backend.aiSaveConnection.mock.calls[0][0]).toMatchObject({ provider: 'ollama', model: 'qwen3:8b', reasoning: true });
  });

  it('por defecto se guarda desactivado, nunca como «sin decidir»', async () => {
    const context = await setup({ info: THINKER });
    await openOllamaForm(context);
    saveButton(context.host).click();
    await vi.waitFor(() => expect(context.backend.aiSaveConnection).toHaveBeenCalled());
    expect(context.backend.aiSaveConnection.mock.calls[0][0].reasoning).toBe(false);
  });

  it('si Ollama dice que el modelo no razona, el interruptor queda inactivo y lo explica', async () => {
    const context = await setup({ info: SMALL });
    await openOllamaForm(context);
    expect(selectByLabel(context.host, 'Razonamiento').disabled).toBe(true);
    expect(hintOf(context.host, 'Razonamiento')).toContain('no razona');
    saveButton(context.host).click();
    await vi.waitFor(() => expect(context.backend.aiSaveConnection).toHaveBeenCalled());
    expect(context.backend.aiSaveConnection.mock.calls[0][0].reasoning).toBeNull();
  });

  it('con un proveedor donde DBV no puede fijarlo, el interruptor es inactivo y dice cómo hacerlo en el servidor', async () => {
    const context = await setup();
    // «Añadir IA en la nube» abre el formulario de Anthropic.
    [...context.host.querySelectorAll('button')].find((b) => b.textContent.startsWith('Añadir una IA en la nube')).click();
    await vi.waitFor(() => expect(selectByLabel(context.host, 'Razonamiento')).toBeTruthy());
    await settle();
    expect(selectByLabel(context.host, 'Razonamiento').disabled).toBe(true);
    expect(hintOf(context.host, 'Razonamiento')).toContain('--reasoning-budget 0');
    expect(context.backend.aiModelInfo).not.toHaveBeenCalled();
  });
});
