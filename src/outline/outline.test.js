// =============================================================================
// DBV Typst Editor — Tests del panel Esquema (RF-89)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage, t } from '../i18n/i18n.js';
import { createOutline } from './outline.js';

const TARGET = { document: '/p/main.typ', root: '/p' };
const ENTRIES = [
  { level: 1, text: 'Introducción', page: 1, yPt: 70 },
  { level: 2, text: 'Motivación', page: 1, yPt: 120 },
];

function setup({ fetchOutline = vi.fn(), target = TARGET } = {}) {
  const listEl = document.createElement('div');
  const onNavigate = vi.fn();
  const outline = createOutline({ listEl, onNavigate, getTarget: () => target, fetchOutline });
  const items = () => [...listEl.querySelectorAll('.outline__item')].map((b) => b.textContent);
  const messages = () => [...listEl.querySelectorAll('.outline__empty')].map((p) => p.textContent);
  return { listEl, onNavigate, outline, fetchOutline, items, messages };
}

const inproc = (outline) => ({ ok: true, engine: 'inproc', outline });
const failed = (kind, message = 'boom') => ({ ok: false, error: { kind, message } });

describe('panel Esquema (RF-89.5)', () => {
  beforeEach(() => setLanguage('es'));

  it('antes de la primera compilación no afirma nada del documento', () => {
    const { listEl } = setup();
    expect(listEl.textContent).toBe('');
  });

  it('con el motor en proceso pinta el esquema que trae la compilación, sin pedirlo al CLI', async () => {
    const { outline, items, fetchOutline, onNavigate, listEl } = setup();
    await outline.onCompiled(inproc(ENTRIES));
    expect(items()).toEqual(['Introducción', 'Motivación']);
    expect(fetchOutline).not.toHaveBeenCalled();
    listEl.querySelectorAll('.outline__item')[1].click();
    expect(onNavigate).toHaveBeenCalledWith(ENTRIES[1]);
  });

  it('«no tiene encabezados» solo cuando el documento compila y no los tiene', async () => {
    const { outline, messages } = setup();
    await outline.onCompiled(inproc([]));
    expect(messages()).toEqual([t('outline.empty')]);
  });

  it('un error del documento conserva el último esquema bueno con un aviso', async () => {
    const { outline, items, messages } = setup();
    await outline.onCompiled(inproc(ENTRIES));
    await outline.onCompiled(failed('compilationFailed', 'error: unclosed delimiter'));
    expect(items()).toEqual(['Introducción', 'Motivación']);
    expect(messages()).toEqual([t('outline.stale')]);
    // Al volver a compilar, el aviso desaparece.
    await outline.onCompiled(inproc(ENTRIES));
    expect(messages()).toEqual([]);
  });

  it('un error del documento sin esquema anterior dice que no compila, no que no hay encabezados', async () => {
    const { outline, messages } = setup();
    await outline.onCompiled(failed('compilationFailed'));
    expect(messages()).toEqual([t('outline.doesNotCompile')]);
  });

  it('un fallo de la herramienta muestra su motivo, NUNCA «no tiene encabezados»', async () => {
    const { outline, messages, items } = setup();
    await outline.onCompiled(inproc(ENTRIES));
    await outline.onCompiled(failed('executionFailed', 'Operation not permitted (os error 1)'));
    expect(items()).toEqual([]);
    expect(messages()).toEqual([t('outline.failed').replace('{reason}', 'Operation not permitted (os error 1)')]);
    expect(messages()[0]).not.toBe(t('outline.empty'));
  });

  it('con el motor clásico pide el esquema al CLI con el mismo objetivo', async () => {
    const fetchOutline = vi.fn().mockResolvedValue({ ok: true, value: ENTRIES });
    const { outline, items } = setup({ fetchOutline });
    await outline.onCompiled({ ok: true, engine: 'classic', outline: null });
    expect(fetchOutline).toHaveBeenCalledWith(TARGET);
    expect(items()).toEqual(['Introducción', 'Motivación']);
  });

  it('si el CLI no arranca (el caso del Mac), el panel lo dice', async () => {
    const fetchOutline = vi.fn().mockResolvedValue(failed('executionFailed', 'Operation not permitted (os error 1)'));
    const { outline, messages } = setup({ fetchOutline });
    await outline.onCompiled({ ok: true, engine: 'classic', outline: null });
    expect(messages()[0]).toContain('Operation not permitted');
    expect(messages()).not.toContain(t('outline.empty'));
  });

  it('una respuesta del CLI que llega tras una compilación más nueva se descarta', async () => {
    let resolveSlow;
    const fetchOutline = vi.fn().mockReturnValue(new Promise((resolve) => (resolveSlow = resolve)));
    const { outline, items } = setup({ fetchOutline });
    const slow = outline.onCompiled({ ok: true, engine: 'classic', outline: null });
    await outline.onCompiled(inproc([ENTRIES[0]]));
    resolveSlow({ ok: true, value: ENTRIES });
    await slow;
    expect(items()).toEqual(['Introducción']);
  });

  it('clear() olvida el esquema: un error posterior no resucita el del documento anterior', async () => {
    const { outline, messages, items, listEl } = setup();
    await outline.onCompiled(inproc(ENTRIES));
    outline.clear();
    expect(listEl.textContent).toBe('');
    await outline.onCompiled(failed('compilationFailed'));
    expect(items()).toEqual([]);
    expect(messages()).toEqual([t('outline.doesNotCompile')]);
  });

  it('los mensajes cambian de idioma sin recompilar', async () => {
    const { outline, messages } = setup();
    await outline.onCompiled(inproc([]));
    setLanguage('en');
    expect(messages()).toEqual(['This document has no headings yet.']);
  });
});
