// =============================================================================
// DBV Typst Editor — Herramientas › «Servidor MCP…» (RF-113.6)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Explica qué le da el servidor MCP de DBV a un agente y enseña, LISTA PARA COPIAR, la configuración de cada agente con
// la ruta real de este ejecutable y el proyecto abierto. El agente del panel de IA de DBV no necesita nada de esto: DBV
// se lo ofrece solo. Todo el texto entra por `textContent`.

import { t } from '../i18n/i18n.js';

const PLACEHOLDER = '<carpeta-del-proyecto>';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Entre comillas dobles si hace falta: vale igual en PowerShell, CMD, bash y zsh. */
export function shellQuote(text) {
  return /[\s"']/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

/**
 * La configuración de cada familia de agentes.
 * @param {{command: string, project: string|null}} options
 * @returns {Array<{id: string, title: string, hint: string, text: string}>}
 */
export function buildConfigs({ command, project }) {
  const folder = project || PLACEHOLDER;
  const args = ['--mcp', '--project', folder];
  const line = `${shellQuote(command)} ${args.map(shellQuote).join(' ')}`;
  const json = JSON.stringify({ mcpServers: { dbv: { command, args } } }, null, 2);
  return [
    { id: 'claude-code', title: 'Claude Code', hint: t('mcp.hintTerminal'), text: `claude mcp add dbv -- ${line}` },
    { id: 'codex', title: 'Codex', hint: t('mcp.hintTerminal'), text: `codex mcp add dbv -- ${line}` },
    { id: 'json', title: 'Claude Desktop, Cursor, Gemini CLI…', hint: t('mcp.hintJson'), text: json },
  ];
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.body
 * @param {{mcpLaunchInfo: () => Promise<{ok: boolean, value?: {command: string, store: boolean, appimage: boolean}}>}} deps.backend
 * @param {() => string|null} deps.getProject Raíz del proyecto abierto.
 * @param {(text: string) => Promise<void>} deps.copy
 * @param {(message: string, tone?: string) => void} deps.notify
 * @param {() => boolean} deps.isShared El ajuste «compartir el estado del editor».
 * @param {(value: boolean) => void} deps.setShared
 */
export function createMcpDialog({ body, backend, getProject, copy, notify, isShared, setShared }) {
  async function open() {
    const info = await backend.mcpLaunchInfo();
    const project = getProject();
    body.replaceChildren();

    body.append(el('p', 'ai-template__intro', t('mcp.intro')));
    const gives = el('ul', 'mcp__list');
    for (const key of ['mcp.gives.compile', 'mcp.gives.render', 'mcp.gives.docs', 'mcp.gives.universe', 'mcp.gives.install']) gives.append(el('li', '', t(key)));
    body.append(gives);
    body.append(el('p', 'mcp__note', t('mcp.panelAgent')));

    if (!info.ok) {
      body.append(el('p', 'ai-template__status is-error', t('mcp.unavailable')));
    } else {
      body.append(el('h3', 'mcp__heading', t('mcp.connectTitle')));
      body.append(el('p', 'mcp__note', project ? t('mcp.forProject').replace('{project}', project) : t('mcp.noProject')));
      for (const config of buildConfigs({ command: info.value.command, project })) {
        const block = el('div', 'mcp__block');
        block.append(el('h4', 'mcp__agent', config.title), el('p', 'mcp__hint', config.hint));
        const pre = el('pre', 'mcp__code');
        pre.append(el('code', '', config.text));
        const button = el('button', 'button button--compact', t('mcp.copy'));
        button.type = 'button';
        button.addEventListener('click', async () => {
          try {
            await copy(config.text);
            notify(t('mcp.copied').replace('{agent}', config.title));
          } catch {
            notify(t('mcp.copyFailed'), 'error');
          }
        });
        block.append(pre, button);
        body.append(block);
      }
      if (info.value.store) body.append(el('p', 'mcp__note', t('mcp.storeNote')));
      if (info.value.appimage) body.append(el('p', 'mcp__note', t('mcp.appimageNote')));
    }

    const share = el('label', 'mcp__share');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = isShared();
    box.addEventListener('change', () => setShared(box.checked));
    share.append(box, el('span', '', t('mcp.shareState')));
    body.append(el('h3', 'mcp__heading', t('mcp.privacyTitle')), share, el('p', 'mcp__note', t('mcp.privacy')));
  }

  return { open };
}
