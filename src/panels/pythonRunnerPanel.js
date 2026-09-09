// =============================================================================
// DBV Typst Editor — Panel de ejecución de scripts Python y figuras (RF-22)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import {
  checkPythonStatus,
  executePythonScript,
  setupSharedPythonEnv,
} from '../services/backend.js';
import { t } from '../i18n/i18n.js';

export const PRESET_PLOT = `import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

# Carpeta images/ del proyecto
Path("images").mkdir(exist_ok=True)

x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.figure(figsize=(6, 3.5), dpi=150)
plt.plot(x, y, label="sen(x)", color="#2563eb", linewidth=2)
plt.title("Gráfica generada con Python y Matplotlib")
plt.xlabel("Eje X")
plt.ylabel("Eje Y")
plt.grid(True, linestyle="--", alpha=0.6)
plt.legend()
plt.tight_layout()

# Guardar figura en images/
output_path = "images/grafica_python.png"
plt.savefig(output_path)
print(f"Figura guardada con éxito en {output_path}")
`;

export const PRESET_DATA = `import csv
from pathlib import Path

Path("data").mkdir(exist_ok=True)
data = [
    ["id", "muestra", "valor"],
    [1, "Control", 12.4],
    [2, "Tratamiento A", 18.9],
    [3, "Tratamiento B", 24.1],
]

with open("data/muestras.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerows(data)

print("Datos exportados a data/muestras.csv")
`;

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panelEl
 * @param {HTMLTextAreaElement} deps.codeEl
 * @param {HTMLButtonElement} deps.runBtn
 * @param {HTMLElement} deps.statusEl
 * @param {HTMLElement} deps.outputContainerEl
 * @param {HTMLElement} deps.stdoutEl
 * @param {HTMLElement} deps.imagesContainerEl
 * @param {HTMLButtonElement} deps.closeBtn
 * @param {HTMLButtonElement} deps.presetPlotBtn
 * @param {HTMLButtonElement} deps.presetDataBtn
 * @param {HTMLElement} [deps.envBadgeEl]
 * @param {HTMLButtonElement} [deps.setupEnvBtn]
 * @param {HTMLElement} [deps.noticeEl]
 * @param {() => string|null} deps.getProjectPath
 * @param {(imagePath: string) => void} deps.onInsertFigure
 * @param {(msg: string, tone?: 'info'|'error') => void} deps.notify
 */
export function createPythonRunnerPanel({
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
  envBadgeEl,
  setupEnvBtn,
  noticeEl,
  getProjectPath,
  onInsertFigure,
  notify,
}) {
  let running = false;
  let currentStatus = null;

  const badge = envBadgeEl || panelEl?.querySelector('#python-env-badge');
  const setupBtn = setupEnvBtn || panelEl?.querySelector('#python-setup-env');
  const notice = noticeEl || panelEl?.querySelector('#python-notice');

  function setRunning(state) {
    running = state;
    runBtn.disabled = state;
    codeEl.disabled = state;
    if (state) {
      statusEl.textContent = t('python.running');
      statusEl.className = 'python-panel__status python-panel__status--running';
    }
  }

  async function refreshStatus() {
    if (!badge) return;
    try {
      const res = await checkPythonStatus(getProjectPath());
      if (!res.ok) {
        badge.textContent = 'Estado de Python desconocido';
        badge.setAttribute('data-tone', 'warning');
        return;
      }
      currentStatus = res.value;

      if (!currentStatus.installed) {
        badge.textContent = '⚠ Python no detectado';
        badge.setAttribute('data-tone', 'error');
        runBtn.disabled = true;
        if (notice) {
          notice.classList.remove('hidden');
          notice.innerHTML = `
            <span>${t('python.notInstalled')}</span>
            <a href="https://www.python.org/downloads/" target="_blank" rel="noopener">${t('python.download')}</a>
          `;
        }
        if (setupBtn) setupBtn.classList.add('hidden');
      } else {
        runBtn.disabled = running;
        if (notice) notice.classList.add('hidden');

        let kindLabel = t('python.envSystem');
        if (currentStatus.interpreterKind === 'project_venv') {
          kindLabel = t('python.envProject');
        } else if (currentStatus.interpreterKind === 'shared_env') {
          kindLabel = t('python.envShared');
        }

        const ver = currentStatus.version ? ` (${currentStatus.version})` : '';
        badge.textContent = `🐍 ${kindLabel}${ver}`;
        badge.title = currentStatus.interpreterPath || '';

        if (currentStatus.hasMatplotlib) {
          badge.setAttribute('data-tone', 'success');
          if (setupBtn) setupBtn.classList.add('hidden');
        } else {
          badge.setAttribute('data-tone', 'warning');
          if (setupBtn) {
            setupBtn.classList.remove('hidden');
            setupBtn.textContent = t('python.setupEnv');
            setupBtn.onclick = async () => {
              setupBtn.disabled = true;
              setupBtn.textContent = t('python.setupEnvInstalling');
              const setupRes = await setupSharedPythonEnv();
              if (setupRes.ok) {
                notify(t('python.setupEnvDone'));
              } else {
                notify(`Error: ${setupRes.error?.message || 'Fallo en instalación'}`, 'error');
              }
              setupBtn.disabled = false;
              await refreshStatus();
            };
          }
        }
      }
    } catch {
      // Ignorar fallo en consulta
    }
  }

  async function run() {
    if (running) return;
    const projectPath = getProjectPath();
    if (!projectPath) {
      notify(t('python.noProject'), 'error');
      return;
    }

    const code = codeEl.value.trim();
    if (!code) return;

    setRunning(true);
    outputContainerEl.classList.remove('hidden');
    stdoutEl.textContent = '...';
    imagesContainerEl.replaceChildren();

    try {
      const result = await executePythonScript({
        projectPath,
        code,
        timeoutSeconds: 30,
      });

      if (!result.ok) {
        statusEl.textContent = result.error?.message || t('python.failed');
        statusEl.className = 'python-panel__status python-panel__status--error';
        stdoutEl.textContent = result.error?.message || '';
        return;
      }

      const { success, stdout, stderr, generatedImages } = result.value;

      if (success) {
        statusEl.textContent = t('python.success');
        statusEl.className = 'python-panel__status python-panel__status--success';
      } else {
        statusEl.textContent = t('python.failed');
        statusEl.className = 'python-panel__status python-panel__status--error';
      }

      const fullOutput = [stdout, stderr].filter(Boolean).join('\n');
      stdoutEl.textContent = fullOutput || '(Sin salida de texto)';

      if (generatedImages && generatedImages.length > 0) {
        renderImages(generatedImages);
      }
    } catch (err) {
      statusEl.textContent = err.message || t('python.failed');
      statusEl.className = 'python-panel__status python-panel__status--error';
      stdoutEl.textContent = err.message || '';
    } finally {
      setRunning(false);
    }
  }

  function renderImages(images) {
    imagesContainerEl.replaceChildren();
    for (const imgPath of images) {
      const card = document.createElement('div');
      card.className = 'python-panel__image-item';

      const pathText = document.createElement('span');
      pathText.className = 'python-panel__image-path';
      pathText.textContent = imgPath;
      card.appendChild(pathText);

      const insertBtn = document.createElement('button');
      insertBtn.type = 'button';
      insertBtn.className = 'button button--compact button--primary';
      insertBtn.textContent = t('python.insertFigure');
      insertBtn.addEventListener('click', () => {
        onInsertFigure(imgPath);
      });
      card.appendChild(insertBtn);

      imagesContainerEl.appendChild(card);
    }
  }

  presetPlotBtn.addEventListener('click', () => {
    codeEl.value = PRESET_PLOT;
    codeEl.focus();
  });

  presetDataBtn.addEventListener('click', () => {
    codeEl.value = PRESET_DATA;
    codeEl.focus();
  });

  runBtn.addEventListener('click', run);

  // Cargar preset por defecto si está vacío
  if (!codeEl.value.trim()) {
    codeEl.value = PRESET_PLOT;
  }

  refreshStatus();

  return {
    run,
    setCode: (code) => {
      codeEl.value = code;
    },
    focus: () => {
      codeEl.focus();
    },
    refreshStatus,
  };
}
