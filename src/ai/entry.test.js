// =============================================================================
// DBV Typst Editor — Tests de la entrada de la IA (RNF-IA.1, RF-116)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';

const created = vi.hoisted(() => ({ calls: 0, app: null }));

vi.mock('./aiApp.js', () => ({
  createAiApp: vi.fn(() => {
    created.calls += 1;
    created.app = { onProjectOpened: vi.fn(), onProjectClosed: vi.fn(), openConnect: vi.fn(), applyTemplate: vi.fn(), isReady: () => true };
    return created.app;
  }),
}));

import { initAi } from './entry.js';

const ok = (value) => ({ ok: true, value });

function setup(file) {
  document.body.innerHTML = '<button id="connect"></button><button id="apply"></button>';
  const backend = { aiConnections: vi.fn(async () => ok(file)) };
  const ai = initAi({ backend, connectButton: document.getElementById('connect') });
  return { ai, backend };
}

beforeEach(() => {
  created.calls = 0;
  created.app = null;
});

describe('la IA solo se carga cuando hace falta (RNF-IA.1)', () => {
  it('sin ninguna conexión no se carga nada al arrancar', async () => {
    setup({ connections: [], active: null, showAi: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(created.calls).toBe(0);
  });

  it('«Aplicar plantilla…» carga el módulo al usarlo, SIN conexiones, y abre el diálogo', async () => {
    const { ai } = setup({ connections: [], active: null, showAi: true });
    ai.applyTemplate({ id: '@preview/x:1.0.0' });
    await vi.waitFor(() => expect(created.app?.applyTemplate).toHaveBeenCalledTimes(1));
    expect(created.calls).toBe(1);
    expect(created.app.openConnect).not.toHaveBeenCalled();
  });

  it('pulsarlo dos veces no carga el módulo dos veces', async () => {
    const { ai } = setup({ connections: [], active: null, showAi: true });
    ai.applyTemplate({ id: '@preview/x:1.0.0' });
    await vi.waitFor(() => expect(created.app?.applyTemplate).toHaveBeenCalledTimes(1));
    ai.applyTemplate({ id: '@preview/x:1.0.0' });
    await vi.waitFor(() => expect(created.app.applyTemplate).toHaveBeenCalledTimes(2));
    expect(created.calls).toBe(1);
  });

  it('«Conectar una IA…» sigue abriendo el asistente de conexión, no el de plantillas', async () => {
    setup({ connections: [], active: null, showAi: true });
    document.getElementById('connect').click();
    await vi.waitFor(() => expect(created.app?.openConnect).toHaveBeenCalledTimes(1));
    expect(created.app.applyTemplate).not.toHaveBeenCalled();
  });
});
