// =============================================================================
// DBV Typst Editor — Tests del diálogo «Servidor MCP…» (RF-113.6)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildConfigs, createMcpDialog, shellQuote } from './mcpDialog.js';

describe('configuración para copiar', () => {
  it('cita lo que tiene espacios y no lo que no', () => {
    expect(shellQuote('C:/Program Files/dbv.exe')).toBe('"C:/Program Files/dbv.exe"');
    expect(shellQuote('dbv-typst-editor.exe')).toBe('dbv-typst-editor.exe');
    expect(shellQuote('D:/Mis "docs"')).toBe('"D:/Mis \\"docs\\""');
  });

  it('da el comando de Claude Code y de Codex con la ruta real y el proyecto', () => {
    const configs = buildConfigs({ command: 'C:/Program Files/DBV/dbv.exe', project: 'D:/Mi Tesis' });
    expect(configs.find((c) => c.id === 'claude-code').text).toBe('claude mcp add dbv -- "C:/Program Files/DBV/dbv.exe" --mcp --project "D:/Mi Tesis"');
    expect(configs.find((c) => c.id === 'codex').text).toBe('codex mcp add dbv -- "C:/Program Files/DBV/dbv.exe" --mcp --project "D:/Mi Tesis"');
  });

  it('el JSON es válido y lleva servidor, comando y argumentos', () => {
    const json = JSON.parse(buildConfigs({ command: 'dbv-typst-editor.exe', project: 'D:/p' }).find((c) => c.id === 'json').text);
    expect(json).toEqual({ mcpServers: { dbv: { command: 'dbv-typst-editor.exe', args: ['--mcp', '--project', 'D:/p'] } } });
  });

  it('sin proyecto abierto deja un marcador que hay que sustituir', () => {
    expect(buildConfigs({ command: 'dbv', project: null })[0].text).toContain('<carpeta-del-proyecto>');
  });
});

describe('diálogo «Servidor MCP…»', () => {
  let body;
  beforeEach(() => {
    body = document.createElement('div');
  });

  function make({ info = { ok: true, value: { command: 'C:/dbv.exe', store: false, appimage: false } }, project = 'D:/p', shared = false, copy = vi.fn(async () => {}) } = {}) {
    const setShared = vi.fn();
    const notify = vi.fn();
    const dialog = createMcpDialog({ body, backend: { mcpLaunchInfo: async () => info }, getProject: () => project, copy, notify, isShared: () => shared, setShared });
    return { dialog, setShared, notify, copy };
  }

  it('enseña qué aporta, que el agente del panel ya lo tiene y una configuración por agente', async () => {
    await make().dialog.open();
    expect(body.textContent).toContain('Claude Code');
    expect(body.textContent).toContain('Codex');
    expect(body.querySelectorAll('.mcp__block')).toHaveLength(3);
    expect(body.querySelector('.mcp__code').textContent).toContain('--project D:/p');
  });

  it('copiar manda el texto exacto al portapapeles y lo avisa', async () => {
    const { dialog, copy, notify } = make();
    await dialog.open();
    body.querySelector('.mcp__block button').click();
    await vi.waitFor(() => expect(notify).toHaveBeenCalled());
    expect(copy).toHaveBeenCalledWith(body.querySelector('.mcp__code').textContent);
  });

  it('si el portapapeles falla lo dice', async () => {
    const { dialog, notify } = make({ copy: vi.fn(async () => { throw new Error('x'); }) });
    await dialog.open();
    body.querySelector('.mcp__block button').click();
    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith(expect.any(String), 'error'));
  });

  it('el ajuste de compartir el estado refleja la preferencia y la cambia', async () => {
    const { dialog, setShared } = make({ shared: true });
    await dialog.open();
    const box = body.querySelector('.mcp__share input');
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    expect(setShared).toHaveBeenCalledWith(false);
  });

  it('avisa del alias de la Store y del AppImage, y de que no hay información si falla', async () => {
    await make({ info: { ok: true, value: { command: 'dbv-typst-editor.exe', store: true, appimage: false } } }).dialog.open();
    expect(body.textContent).toMatch(/alias/i);
    await make({ info: { ok: false } }).dialog.open();
    expect(body.querySelector('.is-error')).not.toBeNull();
    expect(body.querySelectorAll('.mcp__block')).toHaveLength(0);
  });
});
