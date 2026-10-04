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
  function setup({ shared = true, allow = true, install = async () => ({ ok: true, value: {} }), root = '/p' } = {}) {
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
    const confirm = vi.fn(async () => allow);
    const installPackage = vi.fn(install);
    const stopSharing = vi.fn(() => {
      flags.shared = false;
    });
    const bridge = initMcpBridge({
      backend,
      workspace: { ...workspaceWith(), state: { project: root ? { root } : null } },
      relativeToRoot,
      getProblems: parts.getProblems,
      getOutline: parts.getOutline,
      isShared: () => flags.shared,
      stopSharing,
      badge,
      confirmInstall: confirm,
      installPackage: installPackage,
    });
    return { handlers, backend, badge, bridge, flags, stopSharing, confirm, installPackage };
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
    expect(on.backend.mcpBridgeConfigure).toHaveBeenCalledWith('/p', true);
    const off = setup({ shared: false });
    await off.bridge.configure();
    // Con el estado sin compartir, el proyecto abierto sigue constando: un agente puede pedir instalar un paquete.
    expect(off.backend.mcpBridgeConfigure).toHaveBeenCalledWith('/p', false);
    const none = setup({ root: null });
    await none.bridge.configure();
    expect(none.backend.mcpBridgeConfigure).toHaveBeenCalledWith(null, false);
  });

  it('un agente que pide instalar un paquete: se pregunta al usuario y solo si acepta se descarga', async () => {
    const yes = setup();
    await yes.handlers['mcp-install-request']({ id: 3, package: '@preview/x:1.0.0' });
    expect(yes.confirm).toHaveBeenCalledWith('@preview/x:1.0.0');
    expect(yes.installPackage).toHaveBeenCalledWith('@preview/x:1.0.0');
    expect(yes.backend.mcpStateReply).toHaveBeenCalledWith(3, { installed: true });

    const no = setup({ allow: false });
    await no.handlers['mcp-install-request']({ id: 4, package: '@preview/x:1.0.0' });
    expect(no.installPackage).not.toHaveBeenCalled();
    expect(no.backend.mcpStateReply).toHaveBeenCalledWith(4, { installed: false, reason: 'denied' });
  });

  it('si la descarga falla se lo dice al agente y sin proyecto abierto ni siquiera pregunta', async () => {
    const failing = setup({ install: async () => ({ ok: false, error: { message: 'sin red' } }) });
    await failing.handlers['mcp-install-request']({ id: 5, package: '@preview/x:1.0.0' });
    expect(failing.backend.mcpStateReply).toHaveBeenCalledWith(5, { installed: false, reason: 'failed', message: 'sin red' });

    const closed = setup({ root: null });
    await closed.handlers['mcp-install-request']({ id: 6, package: '@preview/x:1.0.0' });
    expect(closed.confirm).not.toHaveBeenCalled();
    expect(closed.installPackage).not.toHaveBeenCalled();
    expect(closed.backend.mcpStateReply).toHaveBeenCalledWith(6, { installed: false, reason: 'denied' });
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
