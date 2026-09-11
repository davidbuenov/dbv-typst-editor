// =============================================================================
// DBV Typst Editor — Gestor de estado e integración Git (RF-19)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { gitCommit, gitPull, gitPush, gitStatus } from '../services/backend.js';
import { registerPanel } from '../panels/registerPanel.js';
import { t } from '../i18n/i18n.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.indicatorEl Contenedor del indicador en cabecera
 * @param {HTMLButtonElement} deps.triggerBtn Botón que abre el popover
 * @param {HTMLElement} deps.branchEl Texto de la rama
 * @param {HTMLElement} deps.summaryEl Resumen (modificados, ab)
 * @param {HTMLElement} deps.panelEl Panel popover
 * @param {HTMLElement} deps.popoverBranchEl
 * @param {HTMLElement} deps.popoverAbEl
 * @param {HTMLElement} deps.filesEl Lista de ficheros modificados
 * @param {HTMLInputElement} deps.commitInputEl
 * @param {HTMLButtonElement} deps.commitBtn
 * @param {HTMLButtonElement} deps.pushBtn
 * @param {HTMLButtonElement} deps.pullBtn
 * @param {() => string | null} deps.getProjectPath
 * @param {(msg: string, tone?: 'info'|'error') => void} deps.notify
 */
export function createGitManager({
  indicatorEl,
  triggerBtn,
  branchEl,
  summaryEl,
  panelEl,
  popoverBranchEl,
  popoverAbEl,
  filesEl,
  commitInputEl,
  commitBtn,
  pushBtn,
  pullBtn,
  getProjectPath,
  notify,
}) {
  let busy = false;

  const panel = registerPanel(panelEl, {
    trigger: triggerBtn,
    toggle: true,
    onOpen: () => {
      refresh();
    },
  });

  async function refresh() {
    const projectPath = getProjectPath();
    if (!projectPath) {
      indicatorEl.classList.add('hidden');
      return;
    }

    try {
      const res = await gitStatus(projectPath);
      if (!res.ok || !res.value.isRepo) {
        indicatorEl.classList.add('hidden');
        return;
      }

      const status = res.value;
      indicatorEl.classList.remove('hidden');

      branchEl.textContent = status.branch;
      popoverBranchEl.textContent = `Rama: ${status.branch}`;

      const totalMod = status.modifiedFiles.length + status.untrackedFiles.length;
      let summaryText = '';
      if (totalMod > 0) {
        summaryText = `${totalMod} ${t('git.modified')}`;
      } else {
        summaryText = t('git.clean');
      }

      if (status.ahead > 0 || status.behind > 0) {
        summaryText += ` · ↑${status.ahead} ↓${status.behind}`;
        popoverAbEl.textContent = `↑${status.ahead} adelantado, ↓${status.behind} atrasado`;
      } else {
        popoverAbEl.textContent = '';
      }

      summaryEl.textContent = summaryText;

      // Lista de archivos en el popover
      filesEl.replaceChildren();
      const allFiles = [
        ...status.modifiedFiles.map((f) => ({ path: f, type: 'M' })),
        ...status.untrackedFiles.map((f) => ({ path: f, type: '?' })),
      ];

      if (allFiles.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'git-popover__empty';
        empty.textContent = t('git.clean');
        filesEl.appendChild(empty);
      } else {
        for (const file of allFiles) {
          const item = document.createElement('div');
          item.className = 'git-popover__file-item';

          const badge = document.createElement('span');
          badge.className = `git-popover__badge git-popover__badge--${file.type}`;
          badge.textContent = file.type;

          const name = document.createElement('span');
          name.className = 'git-popover__file-name';
          name.textContent = file.path;

          item.appendChild(badge);
          item.appendChild(name);
          filesEl.appendChild(item);
        }
      }
    } catch {
      indicatorEl.classList.add('hidden');
    }
  }

  commitBtn.addEventListener('click', async () => {
    if (busy) return;
    const projectPath = getProjectPath();
    const msg = commitInputEl.value.trim();
    if (!msg) return;

    busy = true;
    commitBtn.disabled = true;
    try {
      const res = await gitCommit({ projectPath, message: msg });
      if (res.ok && res.value.success) {
        notify(t('git.commitSuccess'));
        commitInputEl.value = '';
        await refresh();
      } else {
        notify(res.value?.message || res.error?.message || 'Error en commit', 'error');
      }
    } finally {
      busy = false;
      commitBtn.disabled = false;
    }
  });

  pushBtn.addEventListener('click', async () => {
    if (busy) return;
    const projectPath = getProjectPath();
    busy = true;
    pushBtn.disabled = true;
    try {
      const res = await gitPush(projectPath);
      if (res.ok && res.value.success) {
        notify(t('git.pushSuccess'));
        await refresh();
      } else {
        notify(res.value?.message || res.error?.message || 'Error en push', 'error');
      }
    } finally {
      busy = false;
      pushBtn.disabled = false;
    }
  });

  pullBtn.addEventListener('click', async () => {
    if (busy) return;
    const projectPath = getProjectPath();
    busy = true;
    pullBtn.disabled = true;
    try {
      const res = await gitPull(projectPath);
      if (res.ok && res.value.success) {
        notify(t('git.pullSuccess'));
        await refresh();
      } else {
        const rawMessage = res.value?.message || res.error?.message || 'Error en pull';
        // Git rechaza el pull ENTERO si hay cambios sin confirmar que chocarían
        // con lo que trae — no es un conflicto de fusión real (eso pasaría
        // DESPUÉS de empezar a fusionar), así que no hace falta un diff: basta
        // con decir qué hacer y dónde. El cuadro de commit está en este mismo
        // popover, justo debajo. Detectado por el texto porque Git no da un
        // código de error propio para este caso — verificado contra el mensaje
        // real (`git pull` con cambios locales sin confirmar).
        if (/would be overwritten by merge/i.test(rawMessage)) {
          notify(t('git.pullBlockedByLocalChanges'), 'error');
        } else {
          notify(rawMessage, 'error');
        }
      }
    } finally {
      busy = false;
      pullBtn.disabled = false;
    }
  });

  return {
    refresh,
    close: panel.close,
  };
}
