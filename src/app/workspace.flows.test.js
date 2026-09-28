// =============================================================================
// DBV Typst Editor — Tests de los flujos del espacio de trabajo (v0.11.0)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Hasta la 0.10.0, `createWorkspace` no se probaba montado: arrastra el editor,
// la barra, una docena de paneles y el backend. Aquí se monta de verdad con
// todo eso simulado, porque la lógica que más importa de la 0.11.0 vive en él:
// el cambio externo decidido por contenido (RF-68), su aplazamiento durante un
// guardado, la coherencia tras mover o borrar (RF-69) y la copia al historial
// antes de recargar (RF-73).

import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Objeto que responde a cualquier método con un `vi.fn()` (salvo `then`, para no parecer una promesa). */
const stub = () =>
  new Proxy(
    {},
    {
      get(target, key) {
        if (key === 'then') return undefined;
        if (!(key in target)) target[key] = vi.fn();
        return target[key];
      },
    },
  );
const factory = () => vi.fn(() => stub());

vi.mock('@codemirror/search', () => ({ openSearchPanel: vi.fn() }));
vi.mock('../bibliography/bibEntryPanel.js', () => ({ createBibEntryPanel: factory() }));
vi.mock('../editor/citationPicker.js', () => ({ createCitationPicker: factory() }));
vi.mock('../editor/imagePicker.js', () => ({ createImagePicker: factory() }));
vi.mock('../editor/symbolPicker.js', () => ({ createSymbolPicker: factory() }));
vi.mock('../editor/tableDialog.js', () => ({ createTableDialog: factory() }));
vi.mock('../editor/cetzAssistant.js', () => ({ createCetzAssistant: factory() }));
vi.mock('../editor/diagramEditor.js', () => ({ createDiagramEditor: factory() }));
vi.mock('../editor/equationEditor.js', () => ({ createEquationEditor: factory() }));
vi.mock('../editor/sequenceEditor.js', () => ({ createSequenceEditor: factory() }));
vi.mock('../editor/ganttEditor.js', () => ({ createGanttEditor: factory() }));
vi.mock('../editor/kanbanEditor.js', () => ({ createKanbanEditor: factory() }));
vi.mock('../editor/dotEditor.js', () => ({ createDotEditor: factory() }));
vi.mock('../editor/toolbar.js', () => ({ createToolbar: factory() }));
vi.mock('../editor/toolbarActions.js', () => ({ figureActionForPath: vi.fn() }));
vi.mock('../editor/lspClient.js', () => ({ posFromLsp: vi.fn() }));
vi.mock('../editor/languageSupport.js', () => ({ detectLanguage: () => 'typst' }));
vi.mock('../editor/diagnosticsModel.js', () => ({ mergeDiagnostics: () => [], toEditorDiagnostics: () => [] }));
vi.mock('../editor/syncFlash.js', () => ({ revealAndFlash: vi.fn(), revealRangeAndFlash: vi.fn() }));

// ── Editor simulado: un texto, una ruta y un `view.dispatch` que aplica cambios ──
const fake = { content: '', path: null, options: null };
const fakeView = {
  get state() {
    return {
      doc: { length: fake.content.length, toString: () => fake.content },
      selection: { main: { from: 0, to: 0, empty: true } },
    };
  },
  dispatch({ changes }) {
    const list = Array.isArray(changes) ? changes : [changes];
    for (const change of [...list].sort((a, b) => b.from - a.from)) {
      fake.content = fake.content.slice(0, change.from) + change.insert + fake.content.slice(change.to ?? change.from);
    }
    fake.options.onChange(fake.content);
  },
};
vi.mock('../editor/editor.js', () => ({
  createEditor: (host, options) => {
    fake.options = options;
    const editor = stub();
    editor.setDocument = (content, path) => {
      fake.content = content;
      fake.path = path;
    };
    editor.setPath = vi.fn((path) => {
      fake.path = path;
    });
    editor.getContent = () => fake.content;
    editor.getPath = () => fake.path;
    editor.getView = () => fakeView;
    return editor;
  },
}));

// ── Backend simulado ───────────────────────────────────────────────────────────
const handlers = {};
const backend = {
  PROJECT_CHANGE_EVENT: 'project-file-changed',
  on: (event, handler) => {
    handlers[event] = handler;
    return () => {};
  },
  addRecentProject: vi.fn(async () => ({ ok: true })),
  copyAssetIntoProject: vi.fn(),
  exportPdf: vi.fn(),
  exportPng: vi.fn(),
  exportProjectArchive: vi.fn(),
  fileFingerprint: vi.fn(),
  fileModifiedMs: vi.fn(async () => ({ ok: true, value: 1 })),
  historyConfigure: vi.fn(async () => ({ ok: true })),
  historySnapshot: vi.fn(async () => ({ ok: true, value: true })),
  openProject: vi.fn(),
  pickImageFile: vi.fn(),
  pickSaveTarget: vi.fn(),
  readFile: vi.fn(),
  revealInFileManager: vi.fn(),
  setProjectEntrypoint: vi.fn(async () => ({ ok: true, value: {} })),
  clearProjectEntrypoint: vi.fn(async () => ({ ok: true, value: null })),
  unwatchProject: vi.fn(async () => ({ ok: true })),
  watchProject: vi.fn(async () => ({ ok: true })),
  writeFile: vi.fn(),
};
vi.mock('../services/backend.js', () => backend);

const { createWorkspace } = await import('./workspace.js');
const { setPref } = await import('./prefs.js');

const ROOT = 'D:/libro';
const MAIN = `${ROOT}/main.typ`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const onDisk = (contentHash) => ({ ok: true, value: { missing: false, modifiedMs: 5, contentHash } });

function mount({ lspClient } = {}) {
  const elements = new Proxy(
    { projectMenuItems: [] },
    {
      get(target, key) {
        if (!(key in target)) target[key] = document.createElement('div');
        return target[key];
      },
    },
  );
  const tree = stub();
  tree.getKnownFiles = () => [];
  const dialog = { ask: vi.fn(async () => 'keep') };
  const notify = vi.fn();
  const workspace = createWorkspace({ tree, elements, notify, dialog, lspClient });
  return { workspace, tree, dialog, notify };
}

/** Workspace con `main.typ` abierto, cuya huella en disco es `h1`. */
async function openedWorkspace(options) {
  const mounted = mount(options);
  backend.openProject.mockResolvedValue({
    ok: true,
    value: { root: ROOT, name: 'libro', entrypoint: 'main.typ', isSingleFile: false, hasManifest: false },
  });
  backend.readFile.mockResolvedValue({
    ok: true,
    value: { path: MAIN, fileName: 'main.typ', content: '= Libro', modifiedMs: 1, contentHash: 'h1' },
  });
  await mounted.workspace.openProjectAt(ROOT);
  return mounted;
}

/** Simula un aviso del observador sobre el documento abierto. */
async function watcherEvent() {
  handlers['project-file-changed']({ path: MAIN, isActiveDocument: true });
  await settle();
}

beforeEach(() => {
  for (const value of Object.values(backend)) if (typeof value === 'function' && 'mockClear' in value) value.mockClear();
  localStorage.clear();
  setPref('autoSave', false);
  setPref('localHistory', true);
});

describe('cambio externo decidido por contenido (RF-68)', () => {
  it('un aviso con el mismo contenido no pregunta ni recarga, aunque haya cambios sin guardar', async () => {
    const { dialog } = await openedWorkspace();
    fakeView.dispatch({ changes: { from: 7, to: 7, insert: ' nuevo' } });
    backend.readFile.mockClear();
    backend.fileFingerprint.mockResolvedValue(onDisk('h1'));

    await watcherEvent();

    expect(dialog.ask).not.toHaveBeenCalled();
    expect(backend.readFile).not.toHaveBeenCalled();
  });

  it('un cambio real con cambios locales pregunta UNA vez, aunque lleguen más avisos con el diálogo abierto', async () => {
    const { dialog } = await openedWorkspace();
    fakeView.dispatch({ changes: { from: 0, to: 0, insert: 'x' } });
    backend.fileFingerprint.mockResolvedValue(onDisk('h2'));
    let answer;
    dialog.ask.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));

    await watcherEvent();
    await watcherEvent();
    await watcherEvent();
    expect(dialog.ask).toHaveBeenCalledTimes(1);

    answer('keep');
    await settle();
    // «Conservar lo mío»: el mismo cambio ya visto no vuelve a preguntar.
    await watcherEvent();
    expect(dialog.ask).toHaveBeenCalledTimes(1);
  });

  it('un cambio real sin cambios locales recarga en silencio', async () => {
    const { dialog } = await openedWorkspace();
    backend.readFile.mockClear();
    backend.fileFingerprint.mockResolvedValue(onDisk('h2'));
    await watcherEvent();
    expect(dialog.ask).not.toHaveBeenCalled();
    expect(backend.readFile).toHaveBeenCalledWith(MAIN);
  });

  it('un aviso que llega en pleno guardado se aplaza y, si era el eco de ese guardado, no pregunta (R-C1)', async () => {
    const { workspace, dialog } = await openedWorkspace();
    fakeView.dispatch({ changes: { from: 0, to: 0, insert: 'x' } });
    backend.fileFingerprint.mockResolvedValueOnce(onDisk('h1'));
    let finishWrite;
    backend.writeFile.mockImplementationOnce(() => new Promise((resolve) => (finishWrite = resolve)));

    const saving = workspace.save();
    await settle();
    // El disco ya tiene lo nuevo (h2) y aún no conocemos esa huella.
    backend.fileFingerprint.mockResolvedValue(onDisk('h2'));
    await watcherEvent();
    expect(dialog.ask).not.toHaveBeenCalled();

    finishWrite({ ok: true, value: { modifiedMs: 9, contentHash: 'h2' } });
    await saving;
    await settle();
    expect(dialog.ask).not.toHaveBeenCalled();
  });

  it('si el fichero desaparece, avisa una vez y deja el texto como modificado', async () => {
    const { notify, dialog } = await openedWorkspace();
    backend.fileFingerprint.mockResolvedValue({ ok: true, value: { missing: true, modifiedMs: 0, contentHash: null } });
    await watcherEvent();
    await watcherEvent();
    expect(notify.mock.calls.filter(([, tone]) => tone === 'error')).toHaveLength(1);
    expect(dialog.ask).not.toHaveBeenCalled();
    expect(fake.content).toBe('= Libro');
  });

  it('Guardar no pregunta si solo cambió la fecha, y dice al historial si es automático', async () => {
    const { workspace, dialog } = await openedWorkspace();
    fakeView.dispatch({ changes: { from: 0, to: 0, insert: 'x' } });
    backend.fileFingerprint.mockResolvedValue({ ok: true, value: { missing: false, modifiedMs: 999, contentHash: 'h1' } });
    backend.writeFile.mockResolvedValue({ ok: true, value: { modifiedMs: 10, contentHash: 'h3' } });

    await workspace.save();
    expect(dialog.ask).not.toHaveBeenCalled();
    expect(backend.writeFile).toHaveBeenLastCalledWith(MAIN, 'x= Libro', 'save');

    fakeView.dispatch({ changes: { from: 0, to: 0, insert: 'y' } });
    backend.fileFingerprint.mockResolvedValue(onDisk('h3'));
    await workspace.save({ auto: true });
    expect(backend.writeFile).toHaveBeenLastCalledWith(MAIN, 'yx= Libro', 'auto');
  });
});

describe('coherencia tras mover o borrar (RF-69)', () => {
  it('mover el documento abierto (y principal) cambia su ruta sin recargarlo ni perder los cambios', async () => {
    const { workspace, tree } = await openedWorkspace();
    fakeView.dispatch({ changes: { from: 0, to: 0, insert: 'sin guardar ' } });
    backend.readFile.mockClear();
    const moved = [{ from: MAIN, to: `${ROOT}/libro.typ` }];

    await workspace.applyPathMoves(moved);

    expect(workspace.getDocumentPath()).toBe(`${ROOT}/libro.typ`);
    expect(fake.path).toBe(`${ROOT}/libro.typ`);
    expect(fake.content).toBe('sin guardar = Libro');
    expect(workspace.isDirty()).toBe(true);
    expect(backend.readFile).not.toHaveBeenCalled();
    expect(backend.watchProject).toHaveBeenLastCalledWith(ROOT, `${ROOT}/libro.typ`);
    expect(workspace.getEntrypoint()).toBe('libro.typ');
    expect(tree.setEntrypointPath).toHaveBeenLastCalledWith(`${ROOT}/libro.typ`);
  });

  it('el aviso del observador por la ruta vieja, tras mover, no es un cambio externo', async () => {
    const { workspace, dialog, notify } = await openedWorkspace();
    await workspace.applyPathMoves([{ from: MAIN, to: `${ROOT}/libro.typ` }]);
    backend.fileFingerprint.mockResolvedValue(onDisk('h1'));
    await watcherEvent();
    expect(dialog.ask).not.toHaveBeenCalled();
    expect(notify.mock.calls.filter(([, tone]) => tone === 'error')).toHaveLength(0);
  });

  it('una operación propia en curso silencia el «ya no existe»', async () => {
    const { workspace, notify } = await openedWorkspace();
    backend.fileFingerprint.mockResolvedValue({ ok: true, value: { missing: true, modifiedMs: 0, contentHash: null } });
    await workspace.runOwnOperation([MAIN], async () => {
      await watcherEvent();
    });
    expect(notify.mock.calls.filter(([, tone]) => tone === 'error')).toHaveLength(0);
  });

  it('borrar la carpeta que contiene el documento abierto lo cierra y quita la marca de principal', async () => {
    const { workspace, tree } = await openedWorkspace();
    await workspace.handleDeletedPaths([ROOT + '/']);
    expect(workspace.getDocumentPath()).toBe(null);
    expect(workspace.getEntrypoint()).toBe(null);
    expect(tree.setEntrypointPath).toHaveBeenLastCalledWith(null);
  });
});

describe('historial local (RF-73)', () => {
  it('«Recargar desde disco» con cambios guarda antes el contenido del editor', async () => {
    const { dialog } = await openedWorkspace();
    fakeView.dispatch({ changes: { from: 0, to: 0, insert: 'mío ' } });
    backend.fileFingerprint.mockResolvedValue(onDisk('h2'));
    dialog.ask.mockResolvedValueOnce('reload');

    await watcherEvent();
    await settle();

    expect(backend.historySnapshot).toHaveBeenCalledWith(MAIN, 'mío = Libro', 'reload');
    expect(backend.historySnapshot.mock.invocationCallOrder[0]).toBeLessThan(backend.readFile.mock.invocationCallOrder.at(-1));
  });

  it('con el historial apagado no se guarda nada antes de recargar', async () => {
    setPref('localHistory', false);
    const { dialog } = await openedWorkspace();
    fakeView.dispatch({ changes: { from: 0, to: 0, insert: 'mío ' } });
    backend.fileFingerprint.mockResolvedValue(onDisk('h2'));
    dialog.ask.mockResolvedValueOnce('reload');
    await watcherEvent();
    await settle();
    expect(backend.historySnapshot).not.toHaveBeenCalled();
  });

  it('abrir un proyecto le dice al historial cuál es y si está activo', async () => {
    await openedWorkspace();
    expect(backend.historyConfigure).toHaveBeenCalledWith(ROOT, true);
  });

  it('restaurar una versión la pone en el editor como cambio sin guardar, sin escribir', async () => {
    const { workspace } = await openedWorkspace();
    await workspace.restoreVersion(MAIN, '= Versión antigua');
    expect(fake.content).toBe('= Versión antigua');
    expect(workspace.isDirty()).toBe(true);
    expect(backend.writeFile).not.toHaveBeenCalled();
  });
});

describe('diagnósticos de Tinymist en su fichero (RF-85)', () => {
  // Respuesta capturada de Tinymist 0.15.8 (sonda 5): con solo `main.typ`
  // abierto, publica el error de `cap/uno.typ`.
  const CAP = `${ROOT}/cap/uno.typ`;
  const capDiagnostic = { message: 'unexpected argument: widht', range: { start: { line: 2, character: 5 }, end: { line: 2, character: 15 } }, severity: 1, source: 'typst' };

  function fakeLsp() {
    const byPath = new Map();
    const lsp = stub();
    lsp.setProjectRoot = vi.fn(async () => {});
    lsp.getDiagnostics = (path) => byPath.get(path) ?? [];
    lsp.setDiagnosticsHandler = (handler) => {
      lsp.publish = (path, diagnostics) => {
        byPath.set(path, diagnostics);
        handler();
      };
    };
    return lsp;
  }

  it('un error de otro fichero no se pinta ni se cuenta en el documento abierto', async () => {
    const lspClient = fakeLsp();
    const { workspace } = await openedWorkspace({ lspClient });
    const counts = [];
    workspace.setListener('diagnosticsUpdated', (list) => counts.push(list.length));

    lspClient.publish(CAP, [capDiagnostic]);
    expect(counts.at(-1)).toBe(0);

    backend.readFile.mockResolvedValueOnce({
      ok: true,
      value: { path: CAP, fileName: 'uno.typ', content: '= Uno\nTexto.\n#box(widht: 1cm)[x]\n', modifiedMs: 1, contentHash: 'c1' },
    });
    await workspace.openDocument(CAP);
    expect(counts.at(-1)).toBe(1);
  });
});

describe('documento principal en el manifiesto (RF-83)', () => {
  const LIBRO = `${ROOT}/libro.typ`;

  /** Abre el proyecto con el principal y su origen que devolvería el backend. */
  async function openWith(entrypoint, entrypointSource) {
    const mounted = mount();
    backend.openProject.mockResolvedValue({
      ok: true,
      value: { root: ROOT, name: 'libro', entrypoint, entrypointSource, isSingleFile: false, hasManifest: entrypointSource === 'manifest' },
    });
    backend.readFile.mockImplementation(async (path) => ({
      ok: true,
      value: { path, fileName: path.split('/').pop(), content: '= x', modifiedMs: 1, contentHash: 'h1' },
    }));
    await mounted.workspace.openProjectAt(ROOT);
    return mounted;
  }

  it('al abrir, el principal del manifiesto manda sobre la elección guardada en este equipo', async () => {
    localStorage.setItem(`dbv-typst-entrypoint:${ROOT}`, 'otro.typ');
    const { workspace } = await openWith('libro.typ', 'manifest');
    expect(workspace.getEntrypoint()).toBe('libro.typ');
    expect(workspace.getDocumentPath()).toBe(LIBRO);
  });

  it('sin principal en el manifiesto, la elección guardada en este equipo manda sobre la heurística', async () => {
    localStorage.setItem(`dbv-typst-entrypoint:${ROOT}`, 'libro.typ');
    const { workspace } = await openWith('main.typ', 'heuristic');
    expect(workspace.getEntrypoint()).toBe('libro.typ');
  });

  it('marcar el principal lo escribe en el manifiesto y en este equipo', async () => {
    const { workspace, notify } = await openWith('main.typ', 'heuristic');
    expect(workspace.setEntrypoint(LIBRO)).toBe('libro.typ');
    await workspace.whenEntrypointSaved();
    expect(backend.setProjectEntrypoint).toHaveBeenCalledWith(ROOT, 'libro.typ');
    expect(localStorage.getItem(`dbv-typst-entrypoint:${ROOT}`)).toBe('libro.typ');
    expect(notify.mock.calls.filter(([, tone]) => tone === 'error')).toHaveLength(0);
  });

  it('si el manifiesto no se puede escribir, avisa una sola vez y queda recordado en este equipo', async () => {
    const { workspace, notify } = await openWith('main.typ', 'heuristic');
    backend.setProjectEntrypoint.mockResolvedValue({ ok: false, error: { kind: 'denied', message: 'settings' } });
    workspace.setEntrypoint(LIBRO);
    await workspace.whenEntrypointSaved();
    workspace.setEntrypoint(MAIN);
    await workspace.whenEntrypointSaved();
    expect(notify.mock.calls.filter(([, tone]) => tone === 'error')).toHaveLength(1);
    expect(workspace.getEntrypoint()).toBe('main.typ');
    expect(localStorage.getItem(`dbv-typst-entrypoint:${ROOT}`)).toBe('main.typ');
    backend.setProjectEntrypoint.mockResolvedValue({ ok: true, value: {} });
  });

  it('renombrar el principal declarado en el manifiesto lo actualiza allí', async () => {
    const { workspace } = await openWith('libro.typ', 'manifest');
    await workspace.applyPathMoves([{ from: LIBRO, to: `${ROOT}/tomo.typ` }]);
    expect(backend.setProjectEntrypoint).toHaveBeenCalledWith(ROOT, 'tomo.typ');
  });

  it('renombrar un principal que solo era heurístico no crea manifiesto', async () => {
    const { workspace } = await openWith('main.typ', 'heuristic');
    await workspace.applyPathMoves([{ from: MAIN, to: LIBRO }]);
    expect(workspace.getEntrypoint()).toBe('libro.typ');
    expect(backend.setProjectEntrypoint).not.toHaveBeenCalled();
  });

  it('eliminar el principal declarado en el manifiesto lo quita de allí', async () => {
    const { workspace } = await openWith('libro.typ', 'manifest');
    await workspace.handleDeletedPaths([LIBRO]);
    expect(backend.clearProjectEntrypoint).toHaveBeenCalledWith(ROOT);
    expect(workspace.getEntrypoint()).toBe(null);
  });
});
