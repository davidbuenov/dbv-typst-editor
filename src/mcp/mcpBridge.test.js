import { describe, expect, it, vi } from 'vitest';
import { buildEditorState, initMcpBridge } from './mcpBridge.js';

const relativeToRoot = (root, path) => (path.startsWith(`${root}/`) ? path.slice(root.length + 1) : null);

function workspaceWith({ active = '/p/main.typ', head = 6, from = 2, to = 6 } = {}) {
  const text = '= Hola\nmundo';
  return {
    state: { project: { root: '/p' } },
    getOpenTextsWithState: () => [
      { path: '/p/main.typ', content: text, dirty: true },
      { path: '/p/cap.typ', content: 'x', dirty: false },
      { path: '/otro/ajeno.typ', content: 'SECRETO', dirty: true },
    ],
    getDocumentPath: () => active,
    getEditorView: () => ({
      state: {
        selection: { main: { head, from, to } },
        doc: { lineAt: () => ({ number: 1, from: 0 }) },
        sliceDoc: (a, b) => text.slice(a, b),
      },
    }),
  };
}

const parts = {
  relativeToRoot,
  projectRoot: '/p',
  getProblems: () => [{ level: 'error', file: 'main.typ', startLine: 3, message: 'm' }],
  getOutline: () => [{ title: 'Hola' }],
};

describe('buildEditorState', () => {
  it('da pestañas relativas con su texto sin guardar, activo, cursor, selección, esquema y problemas', () => {
    const state = buildEditorState({ workspace: workspaceWith(), ...parts });
    expect(state.tabs).toEqual([
      { path: 'main.typ', content: '= Hola\nmundo', unsaved: true },
      { path: 'cap.typ', content: 'x', unsaved: false },
    ]);
    expect(state.active).toBe('main.typ');
    expect(state.cursor).toEqual({ line: 1, column: 7 });
    expect(state.selection).toBe('Hola');
    expect(state.outline).toEqual([{ title: 'Hola' }]);
    expect(state.problems).toEqual([{ level: 'error', file: 'main.typ', line: 3, message: 'm' }]);
  });

  it('no incluye lo que está fuera del proyecto', () => {
    expect(JSON.stringify(buildEditorState({ workspace: workspaceWith(), ...parts }))).not.toContain('SECRETO');
  });

  it('un documento activo fuera del proyecto no se expone ni da cursor', () => {
    const state = buildEditorState({ workspace: workspaceWith({ active: '/otro/ajeno.typ' }), ...parts });
    expect(state.active).toBeNull();
    expect(state.cursor).toBeNull();
    expect(state.selection).toBe('');
  });
});

describe('initMcpBridge', () => {
  function setup({ shared = true } = {}) {
    const handlers = {};
    const backend = {
      on: vi.fn((name, fn) => {
        handlers[name] = fn;
      }),
      mcpBridgeConfigure: vi.fn(async () => ({ ok: true })),
      mcpStateReply: vi.fn(async () => true),
    };
    const badge = document.createElement('button');
    badge.className = 'hidden';
    const flags = { shared };
    const stopSharing = vi.fn(() => {
      flags.shared = false;
    });
    const bridge = initMcpBridge({
      backend,
      workspace: workspaceWith(),
      relativeToRoot,
      getProblems: parts.getProblems,
      getOutline: parts.getOutline,
      isShared: () => flags.shared,
      stopSharing,
      badge,
    });
    return { handlers, backend, badge, bridge, flags, stopSharing };
  }

  it('contesta la petición del servidor con la foto', async () => {
    const { handlers, backend } = setup();
    await handlers['mcp-state-request']({ id: 7 });
    expect(backend.mcpStateReply).toHaveBeenCalledWith(7, expect.objectContaining({ active: 'main.typ' }));
  });

  it('con el ajuste apagado no entrega nada', async () => {
    const { handlers, backend } = setup({ shared: false });
    await handlers['mcp-state-request']({ id: 8 });
    expect(backend.mcpStateReply).not.toHaveBeenCalled();
  });

  it('configure comparte la raíz del proyecto solo con el ajuste activo', async () => {
    const on = setup();
    await on.bridge.configure();
    expect(on.backend.mcpBridgeConfigure).toHaveBeenCalledWith('/p');
    const off = setup({ shared: false });
    await off.bridge.configure();
    expect(off.backend.mcpBridgeConfigure).toHaveBeenCalledWith(null);
  });

  it('la insignia aparece con un agente y su botón corta la compartición', () => {
    const { handlers, badge, stopSharing } = setup();
    handlers['mcp-agent-connected']();
    expect(badge.classList.contains('hidden')).toBe(false);
    badge.click();
    expect(stopSharing).toHaveBeenCalled();
    expect(badge.classList.contains('hidden')).toBe(true);
  });
});
