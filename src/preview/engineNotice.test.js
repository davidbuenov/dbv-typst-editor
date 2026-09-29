// =============================================================================
// DBV Typst Editor — Tests del aviso «motor clásico» (RF-87.4) y de la insignia
// de Tinymist traducida (RF-88.3)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage, t } from '../i18n/i18n.js';
import { createEngineNotice } from './engineNotice.js';

function setup() {
  const button = document.createElement('button');
  button.className = 'hidden';
  const setMode = vi.fn().mockResolvedValue({ ok: true });
  const restart = vi.fn();
  const notice = createEngineNotice({ button, setMode, restart });
  const visible = () => !button.classList.contains('hidden');
  return { button, setMode, restart, notice, visible };
}

describe('aviso «motor clásico» (RF-87.4)', () => {
  beforeEach(() => setLanguage('es'));

  it('con el motor rápido no se ve', () => {
    const { notice, visible } = setup();
    notice.onCompiled({ ok: true, engine: 'inproc' });
    expect(visible()).toBe(false);
  });

  it('al caer al clásico aparece con el motivo', () => {
    const { notice, visible, button } = setup();
    notice.onCompiled({ ok: true, engine: 'classic', fallbackReason: 'una compilación superó el plazo de 45 s' });
    expect(visible()).toBe(true);
    expect(button.title).toContain('superó el plazo de 45 s');
  });

  it('las compilaciones clásicas siguientes, que ya no traen motivo, lo conservan', () => {
    const { notice, button } = setup();
    notice.onCompiled({ ok: true, engine: 'classic', fallbackReason: 'Typst entró en pánico' });
    notice.onCompiled({ ok: true, engine: 'classic', fallbackReason: null });
    expect(button.title).toContain('Typst entró en pánico');
  });

  it('sin motivo conocido lo dice de forma genérica', () => {
    const { notice, button } = setup();
    notice.onCompiled({ ok: true, engine: 'classic' });
    expect(button.title).toContain(t('preview.engineClassicUnknown'));
  });

  it('pulsarlo reactiva el motor rápido ANTES de recompilar', async () => {
    const { notice, button, setMode, restart, visible } = setup();
    notice.onCompiled({ ok: true, engine: 'classic', fallbackReason: 'x' });
    button.click();
    await vi.waitFor(() => expect(restart).toHaveBeenCalled());
    expect(setMode).toHaveBeenCalledWith('inproc');
    expect(setMode.mock.invocationCallOrder[0]).toBeLessThan(restart.mock.invocationCallOrder[0]);
    expect(visible()).toBe(false);
  });

  it('vuelve a ocultarse cuando el motor rápido compila de nuevo', () => {
    const { notice, visible } = setup();
    notice.onCompiled({ ok: true, engine: 'classic', fallbackReason: 'x' });
    notice.onCompiled({ ok: true, engine: 'inproc' });
    expect(visible()).toBe(false);
  });

  it('un error de compilación no lo cambia', () => {
    const { notice, visible } = setup();
    notice.onCompiled({ ok: true, engine: 'classic', fallbackReason: 'x' });
    notice.onCompiled({ ok: false, error: { kind: 'compilationFailed', message: 'e' } });
    expect(visible()).toBe(true);
  });

  it('su descripción cambia de idioma', () => {
    const { notice, button } = setup();
    notice.onCompiled({ ok: true, engine: 'classic', fallbackReason: 'x' });
    setLanguage('en');
    expect(button.title).toContain('classic fallback engine');
  });
});

describe('insignia de Tinymist traducida (RF-88.3, issue #2)', () => {
  const main = readFileSync(join(process.cwd(), 'src/main.js'), 'utf8');
  const KEYS = ['badgeReady', 'titleReady', 'badgeIdle', 'titleIdle', 'badgeStarting', 'titleStarting', 'badgeError', 'titleError', 'disabledToast', 'startingToast', 'errorToast'];

  it('los textos de la insignia y sus avisos no van escritos a mano en main.js', () => {
    for (const literal of ['LSP no disponible', 'Activar Tinymist', 'Conectando LSP', 'Tinymist desactivado', 'Tinymist LSP está iniciando']) {
      expect(main, literal).not.toContain(literal);
    }
  });

  it('cada texto existe en español y en inglés, y son distintos', () => {
    for (const key of KEYS) {
      setLanguage('es');
      const es = t(`lsp.${key}`);
      setLanguage('en');
      const en = t(`lsp.${key}`);
      expect(es, key).not.toBe(`lsp.${key}`);
      expect(en, key).not.toBe(`lsp.${key}`);
      if (key !== 'badgeReady') expect(en, key).not.toBe(es);
    }
  });
});
