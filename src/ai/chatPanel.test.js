// =============================================================================
// DBV Typst Editor — Tests de la burbuja del asistente (RF-100, RF-102)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerTranslations, setLanguage } from '../i18n/i18n.js';
import { createChatPanel } from './chatPanel.js';
import { AI_TRANSLATIONS } from './translations.js';

registerTranslations(AI_TRANSLATIONS);

function setup() {
  document.body.innerHTML = '<aside id="host"></aside>';
  const noop = () => {};
  const panel = createChatPanel({
    host: document.getElementById('host'),
    callbacks: { onSend: noop, onStop: noop, onCopy: noop, onInsert: noop, onAttachPage: noop, onDocLink: noop, onExternalLink: noop },
  });
  return { panel, host: document.getElementById('host') };
}

beforeEach(() => {
  vi.useFakeTimers();
  setLanguage('es');
});
afterEach(() => vi.useRealTimers());

describe('indicador de actividad (RF-100.3)', () => {
  it('dice qué hace el modelo, aunque no llegue razonamiento, y desaparece al terminar', () => {
    const { panel, host } = setup();
    const bubble = panel.addAssistant();
    bubble.activity('waiting');
    const status = host.querySelector('.ai-activity');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.classList.contains('hidden')).toBe(false);
    expect(status.textContent).toBe('Esperando al modelo…');
    bubble.activity('writing');
    expect(status.textContent).toBe('Escribiendo…');
    bubble.append('Hola');
    bubble.finish('Hola');
    expect(status.classList.contains('hidden')).toBe(true);
    expect(host.querySelector('.ai-msg__body').textContent).toContain('Hola');
  });
});

describe('bloque de razonamiento (RF-100.2)', () => {
  it('aparece abierto con el texto fluyendo y se contrae a «Pensó durante N s» al terminar', () => {
    const { panel, host } = setup();
    const bubble = panel.addAssistant();
    expect(host.querySelector('.ai-think').classList.contains('hidden')).toBe(true);
    bubble.thinking('Primero ');
    bubble.thinking('miro el fichero.');
    const box = host.querySelector('.ai-think');
    expect(box.open).toBe(true);
    expect(box.classList.contains('hidden')).toBe(false);
    expect(box.querySelector('.ai-think__summary').textContent).toBe('Pensando… 0 s');
    vi.advanceTimersByTime(3000);
    expect(box.querySelector('.ai-think__summary').textContent).toBe('Pensando… 3 s');
    expect(box.querySelector('.ai-think__text').textContent).toBe('Primero miro el fichero.');

    bubble.endThinking();
    expect(box.open).toBe(false);
    expect(box.querySelector('.ai-think__summary').textContent).toBe('Pensó durante 3 s');
    // El contador se para: pasar más tiempo no lo cambia.
    vi.advanceTimersByTime(5000);
    expect(box.querySelector('.ai-think__summary').textContent).toBe('Pensó durante 3 s');
  });

  it('el razonamiento es texto plano: nunca entra como HTML', () => {
    const { panel, host } = setup();
    const bubble = panel.addAssistant();
    bubble.thinking('<img src=x onerror=alert(1)>');
    bubble.endThinking();
    expect(host.querySelector('.ai-think img')).toBeNull();
    expect(host.querySelector('.ai-think__text').textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('no va en una región aria-live: solo el indicador de estado', () => {
    const { panel, host } = setup();
    const bubble = panel.addAssistant();
    bubble.thinking('pienso');
    // La lista de mensajes es aria-live=polite; el bloque lo apaga para no leer el razonamiento en voz alta.
    expect(host.querySelector('.ai-think').closest('[aria-live]').getAttribute('aria-live')).toBe('off');
  });

  it('un modelo que no razona no deja bloque, y una burbuja vacía se quita', () => {
    const { panel, host } = setup();
    const bubble = panel.addAssistant();
    bubble.append('Hola');
    bubble.finish('Hola');
    expect(host.querySelector('.ai-think').classList.contains('hidden')).toBe(true);
    const empty = panel.addAssistant();
    empty.finish('');
    expect(host.querySelectorAll('.ai-msg--assistant')).toHaveLength(1);
  });

  it('si solo hubo razonamiento (el modelo llamó a una herramienta) la burbuja se queda para poder verlo', () => {
    const { panel, host } = setup();
    const bubble = panel.addAssistant();
    bubble.thinking('Voy a leer main.typ');
    bubble.finish('');
    expect(host.querySelectorAll('.ai-msg--assistant')).toHaveLength(1);
    expect(host.querySelector('.ai-think').open).toBe(false);
    expect(host.querySelector('.ai-think__text').textContent).toBe('Voy a leer main.typ');
    vi.advanceTimersByTime(5000);
    expect(host.querySelector('.ai-think__summary').textContent).toBe('Pensó durante 0 s');
  });

  it('detener a mitad no deja el contador corriendo', () => {
    const { panel } = setup();
    const bubble = panel.addAssistant();
    bubble.thinking('pienso');
    vi.advanceTimersByTime(2000);
    bubble.finish('');
    vi.advanceTimersByTime(5000);
    // Si el contador siguiera vivo, diría 7 s.
    expect(document.querySelector('.ai-think__summary').textContent).toBe('Pensó durante 2 s');
  });
});

describe('velocidad (RF-102.1)', () => {
  it('se pinta junto al consumo', () => {
    const { panel, host } = setup();
    panel.setSpeed('38 tokens/s · 4.2 s');
    expect(host.querySelector('.ai-panel__speed').textContent).toBe('38 tokens/s · 4.2 s');
  });
});
