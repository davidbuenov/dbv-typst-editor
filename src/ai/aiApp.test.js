// =============================================================================
// DBV Typst Editor — Integración de la IA con backend y modelo simulados
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Recorre el cableado real de `aiApp.js` (panel, propuestas, revisión,
// aplicar, aviso de nube, modo sin herramientas, agentes por ACP) con todo lo
// externo simulado: backend de Tauri, workspace, `multiFileEdit` y el modelo.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAiApp } from './aiApp.js';
import { setLanguage } from '../i18n/i18n.js';

const ok = (value) => ({ ok: true, value });

function setup({ connections, script = [], agent = null } = {}) {
  document.body.innerHTML = `
    <main class="app-body"><section id="ws"></section><div id="split" class="hidden"></div><aside id="panel" class="hidden"></aside></main>
    <button id="toggle" class="hidden"></button>
    <div id="connect" class="hidden"><div id="connect-body"></div><button id="connect-close"></button></div>`;
  const handlers = {};
  const disk = { 'D:/p/main.typ': '= Hola\n\nUno.\n' };
  const saved = [];
  let file = { connections, active: connections[0]?.id ?? null, showAi: true };
  const backend = {
    on: vi.fn(async (event, handler) => {
      handlers[event] = handler;
      return () => {};
    }),
    aiChat: vi.fn(async (requestId) => {
      const next = script.shift() ?? { text: 'Listo.', toolCalls: [] };
      queueMicrotask(() => {
        if (next.error) {
          handlers['ai-stream']({ requestId, type: 'error', error: next.error });
          return;
        }
        if (next.thinking) handlers['ai-stream']({ requestId, type: 'thinking', text: next.thinking });
        if (next.text) handlers['ai-stream']({ requestId, type: 'text', text: next.text });
        for (const call of next.toolCalls ?? []) handlers['ai-stream']({ requestId, type: 'toolCall', ...call });
        handlers['ai-stream']({ requestId, type: 'usage', input: 10, output: 5, ...next.usage });
        handlers['ai-stream']({ requestId, type: 'done', stopReason: next.toolCalls?.length ? 'toolCalls' : 'stop' });
      });
      return ok(null);
    }),
    aiCancel: vi.fn(async () => ok(null)),
    aiCheckProposal: vi.fn(async () => ok([])),
    aiProjectStateLoad: vi.fn(async () => ok(null)),
    aiProjectStateSave: vi.fn(async (root, value) => {
      saved.push(JSON.parse(JSON.stringify(value)));
      return ok(null);
    }),
    aiModelInfo: vi.fn(async () => ok(null)),
    aiProviders: vi.fn(async () => ok([{ provider: 'ollama', contextTokens: 4096, cloud: false, baseUrl: 'http://localhost:11434/v1' }])),
    aiRelease: vi.fn(async () => ok(null)),
    aiSaveConnection: vi.fn(async (connection) => {
      file = { ...file, connections: file.connections.map((c) => (c.id === connection.id ? connection : c)) };
      return ok({ file, keyStorage: null });
    }),
    aiSetPreferences: vi.fn(async () => ok(file)),
    aiConnections: vi.fn(async () => ok(file)),
    aiDetect: vi.fn(async () => ok({ servers: [], tools: [] })),
    docsSearch: vi.fn(async () => ok([])),
    docsPage: vi.fn(async () => ok({ markdown: '# x' })),
    docsExportDir: vi.fn(async () => ok('C:/datos/typst-docs/0.15.1')),
    listDirectory: vi.fn(async () => ok([{ name: 'main.typ', path: 'D:/p/main.typ', isDir: false, isTypst: true, isEditable: true }])),
    readFile: vi.fn(async (path) => (path in disk ? ok({ content: disk[path] }) : { ok: false, error: { kind: 'notFound', message: path } })),
    writeFile: vi.fn(async (path, content) => {
      disk[path] = content;
      return ok({ contentHash: 'h' });
    }),
    searchProject: vi.fn(async () => ok({ files: [] })),
    fsCreateDir: vi.fn(async () => ok('')),
    fsCreateFile: vi.fn(async (root, dir, name) => ok(`${dir}/${name}`)),
    fsTrash: vi.fn(async () => ok(null)),
    openExternalUrl: vi.fn(),
    ...(agent ?? {}),
  };
  const workspace = {
    state: { project: { root: 'D:/p', name: 'p', entrypoint: 'main.typ' } },
    getDocumentPath: () => 'D:/p/main.typ',
    getTabContent: () => null,
    getEditorView: () => null,
    getCompileTarget: () => ({ document: 'D:/p/main.typ', root: 'D:/p' }),
    getOpenTexts: () => [],
    setPreviewOverrides: vi.fn(),
    openDocument: vi.fn(async () => true),
    hasUnsavedChangesIn: () => false,
  };
  const multiFileEdit = {
    apply: vi.fn(async (files) => ({ journal: files.map((f) => ({ ...f })), failure: null, total: files.length, files: files.length })),
    undo: vi.fn(async () => true),
  };
  const dialog = { ask: vi.fn(async () => 'send') };
  const toast = { show: vi.fn() };
  const app = createAiApp({
    workspace,
    backend,
    toast,
    dialog,
    multiFileEdit,
    docsViewer: { open: vi.fn() },
    joinPath: (root, rel) => `${root}/${rel}`,
    relativeToRoot: (root, path) => (path.startsWith(`${root}/`) ? path.slice(root.length + 1) : null),
    registerPanel: (panel) => ({ open: () => panel.classList.remove('hidden'), close: () => panel.classList.add('hidden') }),
    elements: {
      panel: document.getElementById('panel'),
      splitter: document.getElementById('split'),
      toggle: document.getElementById('toggle'),
      appBody: document.querySelector('.app-body'),
      connectPanel: document.getElementById('connect'),
      connectBody: document.getElementById('connect-body'),
      connectClose: document.getElementById('connect-close'),
    },
    initialFile: file,
    getProblems: () => [],
    getOutline: () => [],
    refreshPreview: vi.fn(),
    capturePreviewPage: async () => null,
    typstVersion: () => '0.15.1',
  });
  return { app, backend, workspace, multiFileEdit, dialog, disk, saved, handlers, toast };
}

const ollama = { id: 'o1', name: 'Ollama', provider: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'qwen', hasKey: false, supportsTools: null };
const claudeApi = { ...ollama, id: 'c1', provider: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude' };

beforeEach(() => {
  localStorage.clear();
  setLanguage('es');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('sin IA configurada (RNF-IA.1)', () => {
  it('no se ve ni el conmutador ni el panel', async () => {
    const { app } = setup({ connections: [] });
    await app.onProjectOpened({ root: 'D:/p' });
    expect(document.getElementById('toggle').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('panel').classList.contains('hidden')).toBe(true);
    expect(app.isReady()).toBe(false);
  });
});

describe('modelo directo con herramientas (RF-92, RF-93, RF-94)', () => {
  it('propone un cambio, lo enseña comprobado y aplicarlo pasa por multiFileEdit', async () => {
    const script = [
      { toolCalls: [{ id: 't1', name: 'read_file', arguments: '{"path":"main.typ"}' }] },
      { toolCalls: [{ id: 't2', name: 'propose_changes', arguments: JSON.stringify({ summary: 'Mejora', changes: [{ path: 'main.typ', action: 'edit', search: 'Uno.', replace: 'Uno bis.' }] }) }] },
      { text: 'He mejorado el párrafo.', toolCalls: [] },
    ];
    const { app, backend, multiFileEdit, saved } = setup({ connections: [ollama], script });
    await app.onProjectOpened({ root: 'D:/p' });
    expect(document.getElementById('toggle').classList.contains('hidden')).toBe(false);
    await app.ask('Mejora el párrafo');

    expect(backend.aiChat).toHaveBeenCalledTimes(3);
    const firstRequest = backend.aiChat.mock.calls[0][2];
    expect(firstRequest.messages[0].role).toBe('system');
    expect(firstRequest.tools.map((tool) => tool.name)).toContain('propose_changes');
    const panel = document.getElementById('panel');
    expect(panel.querySelector('.ai-panel__destination').textContent).toMatch(/Local/);
    expect(panel.textContent).toContain('He mejorado el párrafo.');
    const card = panel.querySelector('.ai-review');
    expect(card).not.toBeNull();
    await vi.waitFor(() => expect(card.querySelector('.ai-review__status').textContent).toMatch(/Compila/));
    expect(backend.aiCheckProposal).toHaveBeenCalled();

    [...card.querySelectorAll('button')].find((b) => b.textContent.includes('Aplicar')).click();
    await vi.waitFor(() => expect(multiFileEdit.apply).toHaveBeenCalled());
    const [[files]] = multiFileEdit.apply.mock.calls;
    expect(files[0].path).toBe('D:/p/main.typ');
    expect(files[0].edits[0].newText).toBe('= Hola\n\nUno bis.\n');
    await vi.waitFor(() => expect(saved.at(-1)?.conversations[0].entries.some((e) => e.role === 'assistant')).toBe(true), { timeout: 2000 });
  });

  it('en un documento suelto la IA solo ve y cambia su fichero, aunque la carpeta tenga más (RF-106.7)', async () => {
    const script = [
      { toolCalls: [{ id: 't1', name: 'list_files', arguments: '{}' }] },
      { toolCalls: [{ id: 't2', name: 'read_file', arguments: '{"path":"privado.typ"}' }] },
      { toolCalls: [{ id: 't3', name: 'propose_changes', arguments: JSON.stringify({ changes: [{ path: 'privado.typ', action: 'edit', search: 'secreto', replace: 'x' }] }) }] },
      { text: 'Listo.', toolCalls: [] },
    ];
    const { app, backend, disk } = setup({ connections: [ollama], script });
    disk['D:/p/privado.typ'] = 'secreto';
    backend.listDirectory.mockResolvedValue(ok([
      { name: 'main.typ', path: 'D:/p/main.typ', isDir: false, isTypst: true, isEditable: true },
      { name: 'privado.typ', path: 'D:/p/privado.typ', isDir: false, isTypst: true, isEditable: true },
    ]));
    await app.onProjectOpened({ root: 'D:/p', name: 'main.typ', entrypoint: 'main.typ', isSingleFile: true });
    await app.ask('hola');
    const toolResults = backend.aiChat.mock.calls.at(-1)[2].messages.filter((m) => m.role === 'tool').map((m) => m.content);
    expect(toolResults[0]).toBe('main.typ');
    expect(toolResults[1]).toMatch(/does not exist/);
    expect(toolResults[2]).toMatch(/single loose document/);
    expect(backend.readFile.mock.calls.some(([path]) => path.endsWith('privado.typ'))).toBe(false);
    expect(document.querySelector('.ai-review')).toBeNull();
  });

  it('el razonamiento se ve plegado, pero no vuelve al modelo ni se guarda en la conversación (RF-100.4)', async () => {
    const script = [
      { thinking: 'SECRETO-DEL-RAZONAMIENTO voy a leer', toolCalls: [{ id: 't1', name: 'read_file', arguments: '{"path":"main.typ"}' }] },
      { thinking: 'otro pensamiento', text: 'He mirado el fichero.', toolCalls: [] },
    ];
    const { app, backend, saved } = setup({ connections: [ollama], script });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('mira');
    const panel = document.getElementById('panel');
    const blocks = [...panel.querySelectorAll('.ai-think')];
    expect(blocks).toHaveLength(2);
    expect(blocks.every((block) => block.open === false)).toBe(true);
    expect(panel.querySelector('.ai-think__text').textContent).toContain('SECRETO-DEL-RAZONAMIENTO');
    // La segunda petición (con el resultado de la herramienta) no lleva el razonamiento de la primera.
    expect(backend.aiChat).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(backend.aiChat.mock.calls[1][2])).not.toContain('SECRETO-DEL-RAZONAMIENTO');
    // Y lo que se guarda en disco tampoco.
    await vi.waitFor(() => expect(saved.length).toBeGreaterThan(0), { timeout: 2000 });
    expect(JSON.stringify(saved)).not.toContain('SECRETO-DEL-RAZONAMIENTO');
    expect(JSON.stringify(saved)).not.toContain('otro pensamiento');
  });

  it('devuelve al modelo la firma de pensamiento de Gemini 3 con su llamada a la herramienta (si no, la API da un 400)', async () => {
    const script = [
      { toolCalls: [{ id: 't1', name: 'read_file', arguments: '{"path":"main.typ"}', thoughtSignature: 'FIRMA-OPACA' }, { id: 't2', name: 'list_files', arguments: '{}' }] },
      { text: 'Listo.', toolCalls: [] },
    ];
    const { app, backend } = setup({ connections: [{ ...ollama, id: 'g1', provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' }], script });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('mira');
    expect(backend.aiChat).toHaveBeenCalledTimes(2);
    const assistant = backend.aiChat.mock.calls[1][2].messages.find((m) => m.role === 'assistant' && m.toolCalls.length);
    expect(assistant.toolCalls[0]).toMatchObject({ id: 't1', name: 'read_file', thoughtSignature: 'FIRMA-OPACA' });
    expect(assistant.toolCalls[1].thoughtSignature).toBeUndefined();
  });

  it('muestra los tokens por segundo y sugiere mirar la GPU una sola vez con un modelo local lento (RF-102)', async () => {
    const slow = { usage: { input: 10, output: 100, evalMs: 50000 } };
    const script = [{ text: 'Uno.', ...slow }, { text: 'Dos.', ...slow }];
    const { app } = setup({ connections: [ollama], script });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('primero');
    const panel = document.getElementById('panel');
    expect(panel.querySelector('.ai-panel__speed').textContent).toBe('2 tokens/s · 50 s');
    expect(panel.textContent).toContain('comprueba que cabe en la GPU');
    await app.ask('segundo');
    expect(panel.textContent.split('comprueba que cabe en la GPU')).toHaveLength(2);
  });

  it('con una IA en la nube lenta no se habla de la GPU (RF-102.2)', async () => {
    const script = [{ text: 'Uno.', usage: { input: 10, output: 100, evalMs: 50000 } }];
    const { app } = setup({ connections: [claudeApi], script });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('primero');
    expect(document.getElementById('panel').textContent).not.toContain('GPU');
  });

  it('avisa en el panel de un modelo local pequeño con el contexto corto, y no de uno grande (RF-103.1)', async () => {
    const small = setup({ connections: [ollama] });
    small.backend.aiModelInfo.mockResolvedValue(ok({ parameterSize: '3.1B', contextLength: 32768, capabilities: ['completion', 'tools'] }));
    await small.app.onProjectOpened({ root: 'D:/p' });
    const warnings = () => [...document.querySelectorAll('#panel .ai-advice')].map((node) => node.textContent);
    await vi.waitFor(() => expect(warnings()).toHaveLength(2));
    expect(warnings()[0]).toContain('modelo pequeño (3.1B)');
    expect(warnings()[1]).toMatch(/4[. ]?096 tokens/);

    const big = setup({ connections: [{ ...ollama, contextTokens: 16384 }] });
    big.backend.aiModelInfo.mockResolvedValue(ok({ parameterSize: '14.8B', contextLength: 40960, capabilities: ['completion', 'tools', 'thinking'] }));
    await big.app.onProjectOpened({ root: 'D:/p' });
    await vi.waitFor(() => expect(big.backend.aiModelInfo).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warnings()).toEqual([]);
  });

  it('con una IA en la nube no se pregunta por el modelo ni se avisa de tamaño (RF-103.1)', async () => {
    const { app, backend } = setup({ connections: [claudeApi] });
    await app.onProjectOpened({ root: 'D:/p' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(backend.aiModelInfo).not.toHaveBeenCalled();
    expect(document.querySelectorAll('#panel .ai-advice')).toHaveLength(0);
  });

  it('si el modelo no admite herramientas, repite en modo conversación y lo recuerda (RF-94.4)', async () => {
    const block = '```dbv-edit path="main.typ"\n<<<<<<< SEARCH\nUno.\n=======\nUno corregido.\n>>>>>>> END\n```';
    const script = [{ error: { kind: 'badRequest', message: 'qwen does not support tools' } }, { text: `Aquí va:\n${block}`, toolCalls: [] }];
    const { app, backend } = setup({ connections: [ollama], script });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('Corrige el párrafo');
    expect(backend.aiChat).toHaveBeenCalledTimes(2);
    expect(backend.aiChat.mock.calls[1][2].tools).toEqual([]);
    expect(backend.aiSaveConnection.mock.calls[0][0].supportsTools).toBe(false);
    expect(document.querySelector('.ai-review .ai-file__path').textContent).toBe('main.typ');
  });

  it('cerrar el proyecto con una propuesta sin revisar la descarta y lo avisa (RF-93.6)', async () => {
    const script = [
      { toolCalls: [{ id: 't1', name: 'propose_changes', arguments: JSON.stringify({ changes: [{ path: 'main.typ', action: 'edit', search: 'Uno.', replace: 'Dos.' }] }) }] },
      { text: 'Hecho.', toolCalls: [] },
    ];
    const { app, toast, multiFileEdit } = setup({ connections: [ollama], script });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('cambia');
    app.onProjectClosed();
    expect(toast.show.mock.calls.some(([message]) => /sin revisar/.test(message))).toBe(true);
    expect(multiFileEdit.apply).not.toHaveBeenCalled();
  });

  it('abrir otro proyecto detiene la respuesta en curso sin avisos de error', async () => {
    const { app, backend } = setup({ connections: [ollama] });
    backend.aiChat.mockImplementation(async () => ok(null)); // nunca responde
    await app.onProjectOpened({ root: 'D:/p' });
    const pending = app.ask('hola');
    await vi.waitFor(() => expect(backend.aiChat).toHaveBeenCalled());
    await app.onProjectOpened({ root: 'D:/otro' });
    await pending;
    expect(backend.aiCancel).toHaveBeenCalled();
    expect(document.querySelector('.ai-note--error')).toBeNull();
  });

  it('un error del proveedor se explica en la conversación', async () => {
    const { app } = setup({ connections: [ollama], script: [{ error: { kind: 'network', message: 'connection refused' } }] });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('hola');
    expect(document.querySelector('.ai-note--error').textContent).toContain('connection refused');
  });
});

describe('nube (RNF-IA.4)', () => {
  it('pregunta una vez por proyecto y proveedor; si se rechaza, no se envía nada', async () => {
    const { app, backend, dialog } = setup({ connections: [claudeApi] });
    await app.onProjectOpened({ root: 'D:/p' });
    dialog.ask.mockResolvedValueOnce('cancel');
    await app.ask('hola');
    expect(backend.aiChat).not.toHaveBeenCalled();
    await app.ask('hola otra vez');
    await app.ask('y otra');
    expect(dialog.ask).toHaveBeenCalledTimes(2);
    expect(backend.aiChat).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.ai-panel__destination').textContent).toMatch(/Anthropic/);
  });
});

describe('agente por ACP (RF-91)', () => {
  it('abre sesión, pide permiso con el diff, responde lo elegido y enseña los cambios en disco', async () => {
    let acpHandler = null;
    const agent = {
      acpStop: vi.fn(async () => ok(null)),
      acpStart: vi.fn(async () => ok(null)),
      acpSnapshot: vi.fn(async () => ok(1)),
      acpChanges: vi.fn(async () => ok([{ path: 'main.typ', before: '= Hola\n\nUno.\n', after: '= Hola\n\nUno, agente.\n' }])),
      acpNotify: vi.fn(async () => ok(null)),
      acpRespond: vi.fn(async () => ok(null)),
      acpRequest: vi.fn(async (method) => {
        if (method === 'initialize') return ok({ agentInfo: { name: 'claude' }, agentCapabilities: { promptCapabilities: { image: true } } });
        if (method === 'session/new') return ok({ sessionId: 's1' });
        // Durante el turno, el agente pide permiso y espera la respuesta.
        await acpHandler({
          kind: 'request',
          id: 0,
          method: 'session/request_permission',
          params: {
            sessionId: 's1',
            toolCall: { title: 'Edit main.typ', kind: 'edit', content: [{ type: 'diff', path: 'D:/p/main.typ', oldText: 'Uno.', newText: 'Uno, agente.' }] },
            options: [{ optionId: 'allow', kind: 'allow_once', name: 'Allow' }, { optionId: 'reject', kind: 'reject_once', name: 'Reject' }],
          },
        });
        await acpHandler({ kind: 'notification', method: 'session/update', params: { sessionId: 's1', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hecho.' } } } });
        return ok({ stopReason: 'end_turn', usage: { inputTokens: 20, outputTokens: 4 } });
      }),
    };
    const agentConnection = { id: 'a1', name: 'Claude Code', provider: 'agent', baseUrl: 'acp:claude', model: 'claude', hasKey: false };
    const { app, backend, handlers, disk } = setup({ connections: [agentConnection], agent });
    backend.on.mockImplementation(async (event, handler) => {
      handlers[event] = handler;
      if (event === 'acp-message') acpHandler = handler;
      return () => {};
    });
    // Elige la primera opción (permitir) en cuanto aparece la tarjeta.
    const observer = new MutationObserver(() => {
      const button = document.querySelector('.ai-permission .button--primary');
      if (button && !button.dataset.clicked) {
        button.dataset.clicked = '1';
        queueMicrotask(() => button.click());
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('Cambia el párrafo');
    observer.disconnect();

    expect(agent.acpStart).toHaveBeenCalledWith({ id: 'claude', command: null }, 'D:/p');
    const prompt = agent.acpRequest.mock.calls.find(([method]) => method === 'session/prompt')[1];
    expect(prompt.prompt[0].text).toContain('C:/datos/typst-docs/0.15.1');
    expect(document.querySelector('.ai-permission .ai-hunk__add').textContent).toContain('Uno, agente.');
    expect(agent.acpRespond).toHaveBeenCalledWith(0, { outcome: { outcome: 'selected', optionId: 'allow' } }, null);
    expect(document.getElementById('panel').textContent).toContain('Hecho.');
    expect(document.getElementById('panel').textContent).toMatch(/cambió 1 ficheros/);

    // Deshacer no pisa un fichero que cambió después de que lo escribiera el agente.
    const undo = [...document.querySelectorAll('.ai-review button')].find((b) => b.textContent === 'Deshacer');
    undo.click();
    await vi.waitFor(() => expect(undo.disabled).toBe(false));
    expect(backend.writeFile).not.toHaveBeenCalled();
    disk['D:/p/main.typ'] = '= Hola\n\nUno, agente.\n';
    undo.click();
    await vi.waitFor(() => expect(backend.writeFile).toHaveBeenCalledWith('D:/p/main.typ', '= Hola\n\nUno.\n', 'ai'));
  });
});
