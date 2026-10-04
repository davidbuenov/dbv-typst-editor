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
import { createAiApp, isToolsUnsupported } from './aiApp.js';
import { setLanguage } from '../i18n/i18n.js';

const ok = (value) => ({ ok: true, value });

function setup({ connections, script = [], agent = null, modelInfo = null } = {}) {
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
        handlers['ai-stream']({ requestId, type: 'done', stopReason: next.stopReason ?? (next.toolCalls?.length ? 'toolCalls' : 'stop') });
      });
      return ok(null);
    }),
    aiCancel: vi.fn(async () => ok(null)),
    aiCheckProposal: vi.fn(async () => ok({ diagnostics: [], missingPackages: [] })),
    aiUniverseInfo: vi.fn(async (ids) => ok(ids.map((id) => ({ id, known: true, license: 'MIT-0', description: 'Una plantilla', repository: null, isTemplate: true })))),
    aiUniverseInstall: vi.fn(async (id) => ok({ id, alreadyInstalled: false })),
    openUniversePackagePage: vi.fn(),
    aiProjectStateLoad: vi.fn(async () => ok(null)),
    aiProjectStateSave: vi.fn(async (root, value) => {
      saved.push(JSON.parse(JSON.stringify(value)));
      return ok(null);
    }),
    // Lo que sabe Ollama del modelo. Se pasa a `setup` porque la app lo pregunta al construirse, antes de que un test pueda cambiarlo.
    aiModelInfo: vi.fn(typeof modelInfo === 'function' ? modelInfo : async () => ok(modelInfo)),
    aiProviders: vi.fn(async () => ok([{ provider: 'ollama', contextTokens: 4096, cloud: false, baseUrl: 'http://localhost:11434/v1' }])),
    aiRelease: vi.fn(async () => ok(null)),
    aiSaveConnection: vi.fn(async (connection) => {
      file = { ...file, connections: file.connections.map((c) => (c.id === connection.id ? connection : c)) };
      return ok({ file, keyStorage: null });
    }),
    aiSetPreferences: vi.fn(async () => ok(file)),
    aiConnections: vi.fn(async () => ok(file)),
    aiDetect: vi.fn(async () => ok({ servers: [], tools: [] })),
    aiUniverseSearch: vi.fn(async () => ok({ status: 'noCatalog', hits: [], fetchedAt: null, unavailable: [] })),
    aiUniverseRefresh: vi.fn(async () => ok(null)),
    aiUniverseCheck: vi.fn(async () => ok([])),
    aiUniversePackageDocs: vi.fn(async (id) => ok(`# ${id} — README`)),
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

describe('¿el modelo no admite herramientas? (RF-94.4)', () => {
  const bad = (message) => ({ kind: 'badRequest', message });

  it('lo dice cuando el proveedor afirma que no las admite', () => {
    for (const message of [
      '"llama3:latest" does not support tools',
      'registry.ollama.ai/library/llama3:latest does not support tools',
      'qwen does not support tools',
      'Tool use is not supported for this model',
      'This model does not support function calling',
      'function calling is not supported',
      'tools are not available for this model',
      'Unsupported parameter: tools',
    ]) expect(isToolsUnsupported(bad(message)), message).toBe(true);
  });

  it('NO lo dice cuando el error solo nombra las herramientas por otra razón (el 400 de Gemini 3 sin su firma)', () => {
    for (const message of [
      'Function call is missing a thought_signature in functionCall parts. This is required for tools to work correctly, and missing thought_signature may lead to degraded model performance.',
      'Invalid JSON payload: tools[0].function.parameters is not valid',
      'model not found',
      'context length exceeded',
      'The function name is invalid',
      '',
    ]) expect(isToolsUnsupported(bad(message)), message).toBe(false);
  });

  it('solo si es un error de petición, y también con el formato del mensaje del bucle', () => {
    expect(isToolsUnsupported({ kind: 'server', message: 'does not support tools' })).toBe(false);
    expect(isToolsUnsupported({ role: 'error', kind: 'badRequest', content: 'x does not support tools' })).toBe(true);
    expect(isToolsUnsupported(null)).toBe(false);
  });
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
    const small = setup({ connections: [ollama], modelInfo: { parameterSize: '3.1B', contextLength: 32768, capabilities: ['completion', 'tools'] } });
    await small.app.onProjectOpened({ root: 'D:/p' });
    const warnings = () => [...document.querySelectorAll('#panel .ai-advice')].map((node) => node.textContent);
    await vi.waitFor(() => expect(warnings()).toHaveLength(2));
    expect(warnings()[0]).toContain('modelo pequeño (3.1B)');
    expect(warnings()[1]).toMatch(/4[. ]?096 tokens/);

    const big = setup({ connections: [{ ...ollama, contextTokens: 16384 }], modelInfo: { parameterSize: '14.8B', contextLength: 40960, capabilities: ['completion', 'tools', 'thinking'] } });
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

  it('un 400 que nombra las herramientas por otra razón NO deja la conexión sin herramientas (el de Gemini 3)', async () => {
    const message = 'Function call is missing a thought_signature in functionCall parts. This is required for tools to work correctly.';
    const { app, backend } = setup({ connections: [ollama], script: [{ error: { kind: 'badRequest', message } }] });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('mira');
    expect(backend.aiChat).toHaveBeenCalledTimes(1);
    expect(backend.aiSaveConnection).not.toHaveBeenCalled();
    expect(document.getElementById('panel').textContent).toContain('thought_signature');
  });

  it('un error de «no admite herramientas» con las herramientas ya en marcha no cambia la conexión', async () => {
    const script = [
      { toolCalls: [{ id: 't1', name: 'read_file', arguments: '{"path":"main.typ"}' }] },
      { error: { kind: 'badRequest', message: 'this model does not support tools' } },
    ];
    const { app, backend } = setup({ connections: [ollama], script });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('mira');
    expect(backend.aiChat).toHaveBeenCalledTimes(2);
    expect(backend.aiSaveConnection).not.toHaveBeenCalled();
  });

  it('en modo conversación, un diff en un formato que DBV no entiende se avisa y no ofrece insertarlo (RF-94.4)', async () => {
    const diff = '```\n<<< main.typ\n#box(width: 100pt, body: "x")\n===\n#box(width: 100pt)[x]\n>>>\n```';
    const script = [{ error: { kind: 'badRequest', message: 'qwen does not support tools' } }, { text: `Lo he corregido:\n${diff}`, toolCalls: [] }];
    const { app } = setup({ connections: [ollama], script });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('arregla');
    const panel = document.getElementById('panel');
    expect(panel.textContent).toContain('formato que DBV no entiende');
    expect(panel.querySelector('.ai-review')).toBeNull();
    const buttons = [...panel.querySelectorAll('.md button')].map((b) => b.textContent);
    expect(buttons).toContain('Copiar');
    expect(buttons).not.toContain('Insertar en el cursor');
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

  it('una respuesta vacía se avisa y se reintenta una vez; si llega, no hay error (RF-107.3)', async () => {
    const { app, backend } = setup({ connections: [ollama], script: [{ text: '' }, { text: 'Ahora sí.' }] });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('hola');
    expect(backend.aiChat).toHaveBeenCalledTimes(2);
    const panel = document.getElementById('panel');
    expect(panel.querySelector('.ai-note--info').textContent).toContain('sin texto ni llamada');
    expect(panel.querySelector('.ai-note--error')).toBeNull();
    expect(panel.textContent).toContain('Ahora sí.');
    // El recordatorio viaja como mensaje del usuario y de la respuesta vacía no se guarda nada.
    const retry = backend.aiChat.mock.calls[1][2].messages;
    expect(retry.at(-1)).toMatchObject({ role: 'user' });
    expect(retry.filter((m) => m.role === 'assistant')).toHaveLength(0);
  });

  it('dos respuestas vacías seguidas no son un bucle: un aviso de error y nada más (RF-107.3)', async () => {
    const { app, backend } = setup({ connections: [ollama], script: [{ text: '' }, { text: '' }, { text: 'no debería llegar' }] });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('hola');
    expect(backend.aiChat).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.ai-note--error').textContent).toContain('volvió a responder sin nada');
  });

  it('una llamada cortada por el tope no se ejecuta: se avisa del máximo y se pide más breve (RF-107.3)', async () => {
    const script = [
      { stopReason: 'length', toolCalls: [{ id: 't1', name: 'propose_changes', arguments: '{"changes":[{"path":"main.typ","action":"replace_all","content":"= Corto' }] },
      { text: 'Más corto.' },
    ];
    const { app, backend } = setup({ connections: [ollama], script });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('hazlo');
    expect(document.querySelector('.ai-note--info').textContent).toContain('máximo de tokens por respuesta');
    expect(document.querySelector('.ai-review')).toBeNull();
    expect(JSON.stringify(backend.aiChat.mock.calls[1][2].messages.at(-1))).toContain('much shorter');
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
    // El principio de separar presentación y contenido también llega al agente (RF-105.6).
    expect(prompt.prompt[0].text).toContain('Keep presentation separate from content');
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

describe('avisos del modo conversación (RF-94.4)', () => {
  it('una respuesta normal sin diff no genera el aviso de formato no entendido', async () => {
    const script = [{ error: { kind: 'badRequest', message: 'qwen does not support tools' } }, { text: 'Para esto usa `#strong[texto]`, no hace falta cambiar nada más.', toolCalls: [] }];
    const { app } = setup({ connections: [ollama], script });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('¿cómo pongo negrita?');
    const panel = document.getElementById('panel');
    expect(panel.textContent).toContain('#strong[texto]');
    expect(panel.textContent).not.toContain('formato que DBV no entiende');
  });
});

describe('documento suelto: falla cerrado y no recorre la carpeta (RF-106.7)', () => {
  it('si por lo que sea no se sabe el nombre del fichero, la IA no ve ni puede cambiar NADA', async () => {
    const script = [
      { toolCalls: [{ id: 't1', name: 'list_files', arguments: '{}' }] },
      { toolCalls: [{ id: 't2', name: 'read_file', arguments: '{"path":"main.typ"}' }] },
      { toolCalls: [{ id: 't3', name: 'propose_changes', arguments: JSON.stringify({ changes: [{ path: 'main.typ', action: 'edit', search: 'Uno.', replace: 'x' }] }) }] },
      { text: 'Listo.', toolCalls: [] },
    ];
    const { app, backend } = setup({ connections: [ollama], script });
    await app.onProjectOpened({ root: 'D:/p', isSingleFile: true });
    await app.ask('hola');
    const results = backend.aiChat.mock.calls.at(-1)[2].messages.filter((m) => m.role === 'tool').map((m) => m.content);
    expect(results[0]).not.toContain('main.typ');
    expect(results[1]).toMatch(/does not exist/);
    expect(results[2]).toMatch(/single loose document/);
    expect(document.querySelector('.ai-review')).toBeNull();
  });

  it('la búsqueda se pide solo para su fichero, no para toda la carpeta', async () => {
    const script = [{ toolCalls: [{ id: 't1', name: 'search_project', arguments: '{"query":"Uno"}' }] }, { text: 'Listo.', toolCalls: [] }];
    const { app, backend } = setup({ connections: [ollama], script });
    await app.onProjectOpened({ root: 'D:/p', name: 'main.typ', entrypoint: 'main.typ', isSingleFile: true });
    await app.ask('busca');
    expect(backend.searchProject).toHaveBeenCalled();
    expect(backend.searchProject.mock.calls[0][2].include).toBe('main.typ');
  });

  it('en un proyecto normal la búsqueda sigue siendo de todo el proyecto', async () => {
    const script = [{ toolCalls: [{ id: 't1', name: 'search_project', arguments: '{"query":"Uno"}' }] }, { text: 'Listo.', toolCalls: [] }];
    const { app, backend } = setup({ connections: [ollama], script });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('busca');
    expect(backend.searchProject.mock.calls[0][2].include).toBe('');
  });
});

describe('avisos del modelo en el panel: no se recuerdan los fallos (RF-103.1)', () => {
  it('si Ollama estaba apagado, no se recuerda el fallo: al volver a abrir se pregunta de nuevo y avisa', async () => {
    let encendido = false;
    const info = { parameterSize: '3.1B', contextLength: 32768, capabilities: ['completion', 'tools'] };
    const modelInfo = async () => (encendido ? ok(info) : { ok: false, error: { kind: 'network', message: 'sin conexión' } });
    const { app, backend } = setup({ connections: [ollama], modelInfo });
    await app.onProjectOpened({ root: 'D:/p' });
    const warnings = () => [...document.querySelectorAll('#panel .ai-advice')].map((node) => node.textContent);
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Sin respuesta de Ollama no se sabe el tamaño (el aviso de contexto corto sí sale, no depende de ella).
    expect(warnings().some((text) => text.includes('modelo pequeño'))).toBe(false);

    encendido = true;
    await app.onProjectOpened({ root: 'D:/p' });
    await vi.waitFor(() => expect(warnings().some((text) => text.includes('modelo pequeño (3.1B)'))).toBe(true));
    const asked = backend.aiModelInfo.mock.calls.length;

    // Ya se supo: no se vuelve a preguntar.
    await app.onProjectOpened({ root: 'D:/p' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(backend.aiModelInfo).toHaveBeenCalledTimes(asked);
  });

  it('una respuesta buena se recuerda: no se vuelve a preguntar', async () => {
    const { app, backend } = setup({ connections: [ollama], modelInfo: { parameterSize: '14.8B', contextLength: 40960, capabilities: ['completion'] } });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.onProjectOpened({ root: 'D:/p' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Una sola pregunta aunque haya varios refrescos (al construir la app, al abrir el proyecto, al llegar los proveedores).
    expect(backend.aiModelInfo).toHaveBeenCalledTimes(1);
  });
});

describe('Typst Universe para la IA (RF-108, RNF-IA.9)', () => {
  const NOW = Math.floor(Date.now() / 1000);
  const hit = { id: '@preview/cetz:0.5.2', name: 'cetz', version: '0.5.2', description: 'Drawing with Typst', kind: 'package', categories: [], license: 'LGPL-3.0-or-later', updated: '2025-10-09', newerIncompatible: null };
  const search = (call) => ({ toolCalls: [{ id: 'u1', name: 'search_universe', arguments: JSON.stringify(call) }] });
  const toolMessages = (backend) => backend.aiChat.mock.calls.at(-1)[2].messages.filter((m) => m.role === 'tool').map((m) => m.content);

  it('con una conexión LOCAL solo lee lo que hay en disco: nunca descarga, aunque no haya catálogo (RNF-IA.9.3)', async () => {
    const { app, backend } = setup({ connections: [ollama], script: [search({ query: 'cetz' }), { text: 'No hay catálogo.' }] });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('dibuja con cetz');
    expect(backend.aiUniverseSearch).toHaveBeenCalledWith('cetz', 'any', 8);
    expect(backend.aiUniverseRefresh).not.toHaveBeenCalled();
    expect(toolMessages(backend)[0]).toMatch(/not available yet/);
  });

  it('con una conexión en la NUBE y sin catálogo, lo descarga una vez, lo dice en el panel y busca de nuevo', async () => {
    const { app, backend } = setup({ connections: [claudeApi], script: [search({ query: 'cetz', kind: 'package' }), { text: 'Usa cetz.' }] });
    backend.aiUniverseSearch.mockResolvedValueOnce(ok({ status: 'noCatalog', hits: [], fetchedAt: null, unavailable: [] }));
    backend.aiUniverseSearch.mockResolvedValue(ok({ status: 'ok', hits: [hit], fetchedAt: NOW, unavailable: [] }));
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('dibuja con cetz');
    expect(backend.aiUniverseRefresh).toHaveBeenCalledTimes(1);
    expect(backend.aiUniverseSearch).toHaveBeenCalledTimes(2);
    expect(document.getElementById('panel').textContent).toContain('Descargando el catálogo de Typst Universe');
    expect(toolMessages(backend)[0]).toContain('@preview/cetz:0.5.2');
  });

  it('con la nube y un catálogo de hace más de una semana lo refresca; con uno reciente, no', async () => {
    const stale = setup({ connections: [claudeApi], script: [search({ query: 'cetz' }), { text: 'ok' }] });
    stale.backend.aiUniverseSearch.mockResolvedValue(ok({ status: 'ok', hits: [hit], fetchedAt: NOW - 8 * 24 * 3600, unavailable: [] }));
    await stale.app.onProjectOpened({ root: 'D:/p' });
    await stale.app.ask('cetz');
    expect(stale.backend.aiUniverseRefresh).toHaveBeenCalledTimes(1);

    const fresh = setup({ connections: [claudeApi], script: [search({ query: 'cetz' }), { text: 'ok' }] });
    fresh.backend.aiUniverseSearch.mockResolvedValue(ok({ status: 'ok', hits: [hit], fetchedAt: NOW - 3600, unavailable: [] }));
    await fresh.app.onProjectOpened({ root: 'D:/p' });
    await fresh.app.ask('cetz');
    expect(fresh.backend.aiUniverseRefresh).not.toHaveBeenCalled();
  });

  it('si la descarga falla (sin red), sigue con lo que hubiera en disco', async () => {
    const { app, backend } = setup({ connections: [claudeApi], script: [search({ query: 'cetz' }), { text: 'ok' }] });
    backend.aiUniverseSearch.mockResolvedValue(ok({ status: 'ok', hits: [hit], fetchedAt: NOW - 30 * 24 * 3600, unavailable: [] }));
    backend.aiUniverseRefresh.mockResolvedValue({ ok: false, error: { kind: 'network', message: 'sin red' } });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('cetz');
    expect(toolMessages(backend)[0]).toContain('@preview/cetz:0.5.2');
  });

  it('las instrucciones del sistema piden usar solo identificadores devueltos, con herramientas y no sin ellas', async () => {
    const tools = setup({ connections: [ollama], script: [{ text: 'Hola' }] });
    await tools.app.onProjectOpened({ root: 'D:/p' });
    await tools.app.ask('hola');
    const system = tools.backend.aiChat.mock.calls[0][2].messages[0].content;
    expect(system).toContain('search_universe');
    expect(system).toMatch(/NEVER write a package name or a version from memory/);
    expect(tools.backend.aiChat.mock.calls[0][2].tools.map((t) => t.name)).toContain('search_universe');

    const chat = setup({ connections: [{ ...ollama, supportsTools: false }], script: [{ text: 'Hola' }] });
    await chat.app.onProjectOpened({ root: 'D:/p' });
    await chat.app.ask('hola');
    expect(chat.backend.aiChat.mock.calls[0][2].messages[0].content).not.toContain('search_universe');
  });

  it('en modo conversación, si se habla de paquetes o plantillas, se adelantan los candidatos al contexto (RF-108.5)', async () => {
    const { app, backend } = setup({ connections: [{ ...ollama, supportsTools: false }], script: [{ text: 'Usa esta plantilla.' }] });
    backend.aiUniverseSearch.mockResolvedValue(ok({ status: 'ok', hits: [{ ...hit, id: '@preview/charged-ieee:0.1.4', kind: 'template', description: 'An IEEE-style paper template' }], fetchedAt: NOW, unavailable: [] }));
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('quiero una plantilla ieee');
    expect(backend.aiUniverseSearch).toHaveBeenCalledWith('quiero una plantilla ieee', 'any', 3);
    const context = backend.aiChat.mock.calls[0][2].messages.find((m) => m.content.startsWith('# Context')).content;
    expect(context).toContain('Typst Universe candidates');
    expect(context).toContain('@preview/charged-ieee:0.1.4 — template');
    expect(backend.aiUniverseRefresh).not.toHaveBeenCalled();
  });

  it('en modo conversación, una petición que no habla de paquetes no consulta el catálogo', async () => {
    const { app, backend } = setup({ connections: [{ ...ollama, supportsTools: false }], script: [{ text: 'Hecho.' }] });
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('corrige la ortografía del primer párrafo');
    expect(backend.aiUniverseSearch).not.toHaveBeenCalled();
  });

  it('leer la documentación de un paquete: con una nube puede descargar; con una local, solo lo ya instalado (RNF-IA.9.3)', async () => {
    const read = { toolCalls: [{ id: 'd1', name: 'read_package_docs', arguments: JSON.stringify({ id: '@preview/cetz:0.5.2' }) }] };
    const cloud = setup({ connections: [claudeApi], script: [read, { text: 'ok' }] });
    cloud.backend.aiUniverseCheck.mockResolvedValue(ok([{ id: '@preview/cetz:0.5.2', status: 'ok' }]));
    await cloud.app.onProjectOpened({ root: 'D:/p' });
    await cloud.app.ask('usa cetz');
    expect(cloud.backend.aiUniversePackageDocs).toHaveBeenCalledWith('@preview/cetz:0.5.2', true);
    expect(toolMessages(cloud.backend)[0]).toContain('README');

    const local = setup({ connections: [ollama], script: [read, { text: 'ok' }] });
    local.backend.aiUniverseCheck.mockResolvedValue(ok([{ id: '@preview/cetz:0.5.2', status: 'ok' }]));
    local.backend.aiUniversePackageDocs.mockResolvedValue({ ok: false, error: { kind: 'notFound', message: 'no está instalado y esta conexión no descarga nada' } });
    await local.app.onProjectOpened({ root: 'D:/p' });
    await local.app.ask('usa cetz');
    expect(local.backend.aiUniversePackageDocs).toHaveBeenCalledWith('@preview/cetz:0.5.2', false);
    expect(toolMessages(local.backend)[0]).toMatch(/^error: .*no descarga nada/);
  });

  it('un paquete inventado en una propuesta vuelve al modelo con el aviso y la propuesta sigue siendo revisable', async () => {
    const proposal = { toolCalls: [{ id: 'p1', name: 'propose_changes', arguments: JSON.stringify({ changes: [{ path: 'main.typ', action: 'edit', search: 'Uno.', replace: 'Uno.\n#import "@preview/inventado:1.0.0": *' }] }) }] };
    const { app, backend } = setup({ connections: [ollama], script: [proposal, { text: 'Lo corrijo.' }] });
    backend.aiUniverseCheck.mockResolvedValue(ok([{ id: '@preview/inventado:1.0.0', status: 'unknownPackage', latest: null, compiler: null }]));
    await app.onProjectOpened({ root: 'D:/p' });
    await app.ask('añade un paquete');
    expect(backend.aiUniverseCheck).toHaveBeenCalledWith(['@preview/inventado:1.0.0']);
    expect(toolMessages(backend)[0]).toContain('Never invent a package');
    expect(document.querySelector('.ai-review')).not.toBeNull();
  });
});

describe('paquetes sin instalar en la revisión (RF-109.2)', () => {
  const ID = '@preview/charged-ieee:0.1.4';
  const propose = { toolCalls: [{ id: 'p1', name: 'propose_changes', arguments: JSON.stringify({ changes: [{ path: 'main.typ', action: 'edit', search: 'Uno.', replace: `#import "${ID}": ieee\nUno.` }] }) }] };
  const buttonByText = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(text));

  /** La comprobación dice que falta el paquete hasta que el usuario lo instala. */
  async function setupMissing() {
    const context = setup({ connections: [ollama], script: [propose, { text: 'Hecha la propuesta.' }] });
    const state = { installed: false };
    context.state = state;
    context.backend.aiCheckProposal.mockImplementation(async (root, main, files) => {
      const proposed = files.some((f) => f.content.includes('@preview/charged-ieee'));
      return ok({ diagnostics: [], missingPackages: proposed && !state.installed ? [ID] : [] });
    });
    await context.app.onProjectOpened({ root: 'D:/p' });
    await context.app.ask('adapta al IEEE');
    const card = document.querySelector('.ai-review');
    await vi.waitFor(() => expect(card.querySelector('.ai-review__status').textContent).toMatch(/No se pudo comprobar del todo/));
    return { ...context, card };
  }

  it('no se descarga nada por sí sola: enseña el paquete, su licencia y su ficha y espera el clic', async () => {
    const { backend, card } = await setupMissing();
    const box = card.querySelector('.ai-review__packages');
    expect(box.classList.contains('hidden')).toBe(false);
    expect(box.textContent).toContain('Paquetes que se descargarán');
    expect(box.textContent).toContain(ID);
    await vi.waitFor(() => expect(box.textContent).toContain('licencia: MIT-0'));
    expect(box.textContent).toContain('código de terceros');
    expect(card.querySelector('.ai-review__status').classList.contains('ai-review__status--warn')).toBe(true);
    expect(card.querySelector('.ai-review__status').textContent).not.toMatch(/Compila|Introduce/);
    expect(backend.aiUniverseInstall).not.toHaveBeenCalled();

    buttonByText(box, 'Ficha').click();
    expect(backend.openUniversePackagePage).toHaveBeenCalledWith(ID);
    expect(backend.aiUniverseInstall).not.toHaveBeenCalled();
  });

  it('«Descargar y comprobar» instala solo ese paquete y repite la comprobación, que ahora compila', async () => {
    const { backend, card, state } = await setupMissing();
    backend.aiUniverseInstall.mockImplementation(async (id) => {
      state.installed = true;
      return ok({ id, alreadyInstalled: false });
    });
    buttonByText(card, 'Descargar y comprobar').click();
    await vi.waitFor(() => expect(card.querySelector('.ai-review__status').textContent).toMatch(/Compila sin errores nuevos/));
    expect(backend.aiUniverseInstall).toHaveBeenCalledTimes(1);
    expect(backend.aiUniverseInstall).toHaveBeenCalledWith(ID);
    expect(card.querySelector('.ai-review__packages').classList.contains('hidden')).toBe(true);
  });

  it('si la descarga falla lo dice, no da nada por comprobado y deja reintentar', async () => {
    const { backend, card } = await setupMissing();
    backend.aiUniverseInstall.mockResolvedValue({ ok: false, error: { kind: 'network', message: 'sin conexión' } });
    buttonByText(card, 'Descargar y comprobar').click();
    await vi.waitFor(() => expect(card.querySelector('.ai-review__status').textContent).toContain(`No se pudo descargar ${ID}: sin conexión`));
    expect(buttonByText(card, 'Descargar y comprobar').disabled).toBe(false);
    expect(card.querySelector('.ai-review__status').textContent).not.toMatch(/Compila/);
  });

  it('«No descargar» no descarga nada y la propuesta se puede revisar y aplicar igualmente, sabiendo que no está comprobada', async () => {
    const { backend, card, multiFileEdit } = await setupMissing();
    buttonByText(card, 'No descargar').click();
    expect(card.querySelector('.ai-review__packages').textContent).toContain('No se descargará');
    expect(buttonByText(card, 'Descargar y comprobar')).toBeUndefined();
    expect(backend.aiUniverseInstall).not.toHaveBeenCalled();
    buttonByText(card, 'Aplicar').click();
    await vi.waitFor(() => expect(multiFileEdit.apply).toHaveBeenCalled());
  });

  it('el modelo recibe que NO debe quitar el import, y la comprobación sigue siendo la misma de siempre sin paquetes que falten', async () => {
    const { backend } = await setupMissing();
    const toolResult = backend.aiChat.mock.calls.at(-1)[2].messages.filter((m) => m.role === 'tool').map((m) => m.content)[0];
    expect(toolResult).toContain('Do NOT remove the import');
    expect(toolResult).toContain(ID);
  });
});
