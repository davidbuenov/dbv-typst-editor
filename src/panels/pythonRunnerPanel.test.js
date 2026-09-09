// =============================================================================
// DBV Typst Editor — Tests del panel Python Runner (RF-22)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PRESET_DATA,
  PRESET_PLOT,
  createPythonRunnerPanel,
} from './pythonRunnerPanel.js';
import * as backend from '../services/backend.js';

describe('pythonRunnerPanel', () => {
  let panelEl;
  let codeEl;
  let runBtn;
  let statusEl;
  let outputContainerEl;
  let stdoutEl;
  let imagesContainerEl;
  let closeBtn;
  let presetPlotBtn;
  let presetDataBtn;
  let insertedFigure = null;
  let notification = null;

  beforeEach(() => {
    panelEl = document.createElement('div');
    codeEl = document.createElement('textarea');
    runBtn = document.createElement('button');
    statusEl = document.createElement('span');
    outputContainerEl = document.createElement('div');
    outputContainerEl.className = 'hidden';
    stdoutEl = document.createElement('pre');
    imagesContainerEl = document.createElement('div');
    closeBtn = document.createElement('button');
    presetPlotBtn = document.createElement('button');
    presetDataBtn = document.createElement('button');

    insertedFigure = null;
    notification = null;
  });

  function createPanel(projectPath = '/mi/proyecto') {
    return createPythonRunnerPanel({
      panelEl,
      codeEl,
      runBtn,
      statusEl,
      outputContainerEl,
      stdoutEl,
      imagesContainerEl,
      closeBtn,
      presetPlotBtn,
      presetDataBtn,
      getProjectPath: () => projectPath,
      onInsertFigure: (path) => {
        insertedFigure = path;
      },
      notify: (msg) => {
        notification = msg;
      },
    });
  }

  it('carga el preset de gráfica por defecto al inicializar', () => {
    createPanel();
    expect(codeEl.value).toBe(PRESET_PLOT);
  });

  it('permite alternar entre los presets de gráfica y datos CSV', () => {
    createPanel();
    presetDataBtn.click();
    expect(codeEl.value).toBe(PRESET_DATA);

    presetPlotBtn.click();
    expect(codeEl.value).toBe(PRESET_PLOT);
  });

  it('rechaza ejecutar si no hay proyecto activo', async () => {
    const panel = createPanel(null);
    await panel.run();
    expect(notification).toBeTruthy();
  });

  it('ejecuta el script, muestra la salida y renderiza botones de figuras generadas', async () => {
    vi.spyOn(backend, 'executePythonScript').mockResolvedValue({
      ok: true,
      value: {
        success: true,
        stdout: 'Figura guardada con éxito',
        stderr: '',
        exit_code: 0,
        generatedImages: ['images/grafica_python.png'],
      },
    });

    const panel = createPanel('/ruta/proyecto');
    await panel.run();

    expect(outputContainerEl.classList.contains('hidden')).toBe(false);
    expect(stdoutEl.textContent).toContain('Figura guardada con éxito');
    expect(statusEl.className).toContain('python-panel__status--success');

    // Botón de inserción
    const insertBtn = imagesContainerEl.querySelector('button');
    expect(insertBtn).toBeTruthy();
    insertBtn.click();
    expect(insertedFigure).toBe('images/grafica_python.png');
  });

  it('muestra el estado de error cuando el script falla', async () => {
    vi.spyOn(backend, 'executePythonScript').mockResolvedValue({
      ok: true,
      value: {
        success: false,
        stdout: '',
        stderr: 'ZeroDivisionError: division by zero',
        exit_code: 1,
        generatedImages: [],
      },
    });

    const panel = createPanel('/ruta/proyecto');
    await panel.run();

    expect(statusEl.className).toContain('python-panel__status--error');
    expect(stdoutEl.textContent).toContain('ZeroDivisionError');
  });

  it('detecta cuando Python no esta instalado y muestra advertencia', async () => {
    vi.spyOn(backend, 'checkPythonStatus').mockResolvedValue({
      ok: true,
      value: {
        installed: false,
        version: null,
        interpreterPath: null,
        interpreterKind: 'none',
        hasMatplotlib: false,
        os: 'windows',
      },
    });

    const envBadge = document.createElement('span');
    envBadge.id = 'python-env-badge';
    panelEl.appendChild(envBadge);

    const noticeEl = document.createElement('div');
    noticeEl.id = 'python-notice';
    noticeEl.className = 'hidden';
    panelEl.appendChild(noticeEl);

    createPanel('/ruta/proyecto');
    await new Promise((r) => setTimeout(r, 10));

    expect(envBadge.textContent).toContain('no detectado');
    expect(runBtn.disabled).toBe(true);
    expect(noticeEl.classList.contains('hidden')).toBe(false);
  });

  it('ofrece boton de configuracion de entorno compartido si falta matplotlib', async () => {
    vi.spyOn(backend, 'checkPythonStatus').mockResolvedValue({
      ok: true,
      value: {
        installed: true,
        version: 'Python 3.12.3',
        interpreterPath: 'C:\\Python\\python.exe',
        interpreterKind: 'system',
        hasMatplotlib: false,
        os: 'windows',
      },
    });
    const setupSpy = vi.spyOn(backend, 'setupSharedPythonEnv').mockResolvedValue({
      ok: true,
      value: null,
    });

    const envBadge = document.createElement('span');
    envBadge.id = 'python-env-badge';
    panelEl.appendChild(envBadge);

    const setupBtn = document.createElement('button');
    setupBtn.id = 'python-setup-env';
    setupBtn.className = 'hidden';
    panelEl.appendChild(setupBtn);

    createPanel('/ruta/proyecto');
    await new Promise((r) => setTimeout(r, 10));

    expect(setupBtn.classList.contains('hidden')).toBe(false);
    setupBtn.click();
    expect(setupSpy).toHaveBeenCalled();
  });
});
