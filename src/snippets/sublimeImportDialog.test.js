// =============================================================================
// DBV Typst Editor — Tests del diálogo de importar snippets de Sublime (RF-112)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage, t } from '../i18n/i18n.js';
import { parseSnippetFile } from './model.js';
import { createSublimeImportDialog } from './sublimeImportDialog.js';

const ok = (value) => ({ ok: true, value });
const snippet = ({ trigger = 'hola', scope = '', content = 'Hola ${1:esto}', description = 'Un saludo' } = {}) =>
  `<snippet><content><![CDATA[\n${content}\n]]></content>${trigger ? `<tabTrigger>${trigger}</tabTrigger>` : ''}${scope ? `<scope>${scope}</scope>` : ''}<description>${description}</description></snippet>`;

const SOURCES = [
  { name: 'saludo.sublime-snippet', content: snippet() },
  { name: 'figura.sublime-snippet', content: snippet({ trigger: 'fig', content: '#figure($SELECTION)', description: 'Figura' }) },
  { name: 'python.sublime-snippet', content: snippet({ trigger: 'def', scope: 'source.python' }) },
];

function setup({ root = 'D:/p', existing = null, sources = SOURCES, picked = ['C:/Sublime/User'], write = null } = {}) {
  document.body.innerHTML = '<div id="panel"><div id="body"></div></div>';
  const backend = {
    snippetsPickSublime: vi.fn(async () => ok(picked)),
    snippetsReadSublime: vi.fn(async () => ok({ sources, truncated: false })),
    snippetsImportTarget: vi.fn(async (destination) => ok({ path: `${destination}-file.code-snippets`, exists: existing !== null, content: existing })),
    snippetsWriteImported: write ?? vi.fn(async (destination) => ok(`D:/p/.vscode/${destination}-file.code-snippets`)),
  };
  const events = { close: vi.fn(), notify: vi.fn(), onImported: vi.fn(async () => {}) };
  const dialog = createSublimeImportDialog({
    elements: { panel: document.getElementById('panel'), body: document.getElementById('body') },
    backend,
    t,
    getProjectRoot: () => root,
    ...events,
  });
  dialog.open();
  const body = document.getElementById('body');
  const button = (text) => [...body.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  return { backend, events, body, button };
}

async function choose(ctx, label = 'Elegir ficheros…', { expectTarget = true } = {}) {
  ctx.button(label).click();
  await vi.waitFor(() => expect(ctx.body.querySelector('.snippet-import__summary').textContent).not.toBe(''));
  // Sin nada convertible no hay destino que mirar.
  if (expectTarget) await vi.waitFor(() => expect(ctx.backend.snippetsImportTarget).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => setLanguage('es'));

describe('elegir y ver el resumen ANTES de escribir nada', () => {
  it('con ficheros: «N convertidos, M omitidos», con el motivo de cada omisión, y no se escribe nada', async () => {
    const ctx = setup();
    await choose(ctx);
    expect(ctx.backend.snippetsPickSublime).toHaveBeenCalledWith(false);
    expect(ctx.backend.snippetsReadSublime).toHaveBeenCalledWith(['C:/Sublime/User']);
    expect(ctx.body.querySelector('.snippet-import__summary').textContent).toBe('2 convertido(s), 1 omitido(s).');
    expect(ctx.body.querySelector('.snippet-import__skipped').textContent).toContain('python.sublime-snippet — es de otro lenguaje (source.python)');
    expect(ctx.backend.snippetsWriteImported).not.toHaveBeenCalled();
  });

  it('«Elegir carpeta…» pide una carpeta', async () => {
    const ctx = setup();
    await choose(ctx, 'Elegir carpeta…');
    expect(ctx.backend.snippetsPickSublime).toHaveBeenCalledWith(true);
  });

  it('cancelar el selector no cambia nada', async () => {
    const ctx = setup();
    ctx.backend.snippetsPickSublime.mockResolvedValue(ok(null));
    ctx.button('Elegir ficheros…').click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ctx.backend.snippetsReadSublime).not.toHaveBeenCalled();
    expect(ctx.body.querySelector('.snippet-import__summary').textContent).toBe('');
    expect(ctx.button('Importar').disabled).toBe(true);
  });

  it('si no hay ningún .sublime-snippet lo dice y no deja importar', async () => {
    const ctx = setup({ sources: [] });
    ctx.button('Elegir ficheros…').click();
    await vi.waitFor(() => expect(ctx.body.textContent).toContain('No se encontró ningún fichero .sublime-snippet'));
    expect(ctx.button('Importar').disabled).toBe(true);
  });

  it('enseña por qué se omite cada caso, también un XML con entidades (seguridad)', async () => {
    const xxe = '<?xml version="1.0"?><!DOCTYPE s [<!ENTITY x SYSTEM "file:///etc/passwd">]><snippet><content>&x;</content><tabTrigger>x</tabTrigger></snippet>';
    const ctx = setup({ sources: [{ name: 'xxe.sublime-snippet', content: xxe }, { name: 'sin.sublime-snippet', content: snippet({ trigger: '' }) }, { name: 'grande.sublime-snippet', error: 'tooBig' }, { name: 'var.sublime-snippet', content: snippet({ content: '$TM_FULLNAME' }) }] });
    await choose(ctx, 'Elegir ficheros…', { expectTarget: false });
    const skipped = ctx.body.querySelector('.snippet-import__skipped').textContent;
    expect(skipped).toContain('declara entidades o un DOCTYPE');
    expect(skipped).toContain('no tiene tabTrigger');
    expect(skipped).toContain('es más grande de 1 MB');
    expect(skipped).toContain('usa variables que DBV no admite ($TM_FULLNAME)');
    expect(ctx.button('Importar').disabled).toBe(true);
  });

  it('avisa de los prefijos repetidos del propio lote sin omitirlos', async () => {
    const ctx = setup({ sources: [{ name: 'a.sublime-snippet', content: snippet({ trigger: 'x' }) }, { name: 'b.sublime-snippet', content: snippet({ trigger: 'x' }) }] });
    await choose(ctx);
    expect(ctx.body.querySelector('.snippet-import__summary').textContent).toBe('2 convertido(s), 0 omitido(s).');
    expect(ctx.body.textContent).toContain('b — comparte prefijo con otro snippet del lote (x)');
  });
});

describe('el destino y escribir', () => {
  it('por defecto el PROYECTO si lo hay; sin proyecto (o con un documento suelto) solo el global', async () => {
    const withProject = setup();
    await choose(withProject);
    expect(withProject.body.querySelector('input[value="project"]').checked).toBe(true);

    const none = setup({ root: null });
    await choose(none);
    expect(none.body.querySelector('input[value="project"]').disabled).toBe(true);
    expect(none.body.querySelector('input[value="global"]').checked).toBe(true);
  });

  it('importar en un destino nuevo escribe un fichero que DBV lee sin avisos, sin sobrescribir nada', async () => {
    const ctx = setup();
    await choose(ctx);
    ctx.button('Importar').click();
    await vi.waitFor(() => expect(ctx.backend.snippetsWriteImported).toHaveBeenCalled());
    const [destination, root, text, overwrite] = ctx.backend.snippetsWriteImported.mock.calls[0];
    expect([destination, root, overwrite]).toEqual(['project', 'D:/p', false]);
    const parsed = parseSnippetFile(text, 'project');
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.snippets.map((s) => [s.prefix, s.body])).toEqual([['hola', 'Hola ${1:esto}'], ['fig', '#figure($TM_SELECTED_TEXT)']]);
    await vi.waitFor(() => expect(ctx.events.close).toHaveBeenCalled());
    expect(ctx.events.onImported).toHaveBeenCalledWith('D:/p/.vscode/project-file.code-snippets', text, 'project');
    expect(ctx.events.notify).toHaveBeenCalledWith('2 snippet(s) importados en project-file.code-snippets.');
  });

  it('si el fichero ya existe pregunta; por defecto AÑADE y conserva sus comentarios y sus snippets, y solo entonces sobrescribe', async () => {
    const existing = '{\n  // los míos\n  "Mío": { "prefix": "mio", "body": "x" }\n}\n';
    const ctx = setup({ existing });
    await choose(ctx);
    expect(ctx.body.querySelector('.snippet-import__mode').classList.contains('hidden')).toBe(false);
    expect(ctx.body.querySelector('input[value="add"]').checked).toBe(true);
    expect(ctx.backend.snippetsWriteImported).not.toHaveBeenCalled();
    ctx.button('Importar').click();
    await vi.waitFor(() => expect(ctx.backend.snippetsWriteImported).toHaveBeenCalled());
    const [, , text, overwrite] = ctx.backend.snippetsWriteImported.mock.calls[0];
    expect(overwrite).toBe(true);
    expect(text).toContain('// los míos');
    expect(parseSnippetFile(text, 'project').snippets.map((s) => s.prefix).sort()).toEqual(['fig', 'hola', 'mio']);
  });

  it('«Reemplazar» escribe un fichero nuevo con solo lo importado', async () => {
    const ctx = setup({ existing: '{ "Mío": { "prefix": "mio", "body": "x" } }' });
    await choose(ctx);
    ctx.body.querySelector('input[value="replace"]').click();
    ctx.button('Importar').click();
    await vi.waitFor(() => expect(ctx.backend.snippetsWriteImported).toHaveBeenCalled());
    const [, , text, overwrite] = ctx.backend.snippetsWriteImported.mock.calls[0];
    expect(overwrite).toBe(true);
    expect(parseSnippetFile(text, 'project').snippets.map((s) => s.prefix)).toEqual(['hola', 'fig']);
  });

  it('en el fichero GLOBAL no se ofrece reemplazar: es el de sus snippets propios', async () => {
    const ctx = setup({ root: null, existing: '{ "Mío": { "prefix": "mio", "body": "x" } }' });
    await choose(ctx);
    expect(ctx.body.querySelector('input[value="add"]')).not.toBeNull();
    expect(ctx.body.querySelector('input[value="replace"]')).toBeNull();
  });

  it('avisa de los prefijos que ya existen en el destino', async () => {
    const ctx = setup({ existing: '{ "Mío": { "prefix": "hola", "body": "x" } }' });
    await choose(ctx);
    expect(ctx.body.querySelector('.snippet-import__message').textContent).toContain('Ya tienes snippets con estos prefijos: hola');
  });

  it('si el fichero existente no es JSON válido no lo rompe: lo dice y no escribe', async () => {
    const ctx = setup({ existing: '{ esto no es json' });
    await choose(ctx);
    ctx.button('Importar').click();
    await vi.waitFor(() => expect(ctx.body.querySelector('.snippet-import__message').textContent).toContain('no es un JSON válido'));
    expect(ctx.backend.snippetsWriteImported).not.toHaveBeenCalled();
    expect(ctx.button('Importar').disabled).toBe(false);
  });

  it('si escribir falla lo dice y deja reintentar', async () => {
    const write = vi.fn(async () => ({ ok: false, error: { kind: 'io', message: 'disco lleno' } }));
    const ctx = setup({ write });
    await choose(ctx);
    ctx.button('Importar').click();
    await vi.waitFor(() => expect(ctx.body.querySelector('.snippet-import__message').textContent).toContain('disco lleno'));
    expect(ctx.events.close).not.toHaveBeenCalled();
    expect(ctx.button('Importar').disabled).toBe(false);
  });

  it('Cancelar cierra sin escribir', async () => {
    const ctx = setup();
    await choose(ctx);
    ctx.button('Cancelar').click();
    expect(ctx.events.close).toHaveBeenCalled();
    expect(ctx.backend.snippetsWriteImported).not.toHaveBeenCalled();
  });

  it('cambiar de destino vuelve a mirar si el fichero existe', async () => {
    const ctx = setup();
    await choose(ctx);
    const calls = ctx.backend.snippetsImportTarget.mock.calls.length;
    const global = ctx.body.querySelector('input[value="global"]');
    global.click();
    global.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(ctx.backend.snippetsImportTarget.mock.calls.length).toBeGreaterThan(calls));
    expect(ctx.backend.snippetsImportTarget).toHaveBeenLastCalledWith('global', 'D:/p');
  });
});
