// =============================================================================
// DBV Typst Editor — Punto de entrada del frontend
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { invoke } from '@tauri-apps/api/core';

import { applyTranslations, t } from './i18n/i18n.js';
import { closeAllPanels, registerPanel } from './panels/registerPanel.js';
import { initTheme, toggleTheme } from './themes/theme.js';

/**
 * Consulta al backend la información básica de la aplicación.
 *
 * Criterio de aceptación del Slice 1: este `invoke` es la prueba de que Vite
 * (ESM, con bundler) y el puente de Tauri conviven — el riesgo R-04 del plan.
 *
 * @returns {Promise<{ok: true, value: {version: string, platform: string}} | {ok: false, error: string}>}
 */
async function fetchAppInfo() {
  let result;
  try {
    const info = await invoke('app_info');
    result = { ok: true, value: info };
  } catch (error) {
    result = { ok: false, error: String(error) };
  }
  return result;
}

/**
 * Consulta la versión del compilador Typst embebido como sidecar.
 *
 * Criterio de aceptación del Slice 2: prueba de que el binario oficial viaja
 * dentro de la app y se puede invocar desde Rust sin que el WebView tenga
 * permisos de shell.
 *
 * @returns {Promise<{ok: true, value: string} | {ok: false, error: string}>}
 */
async function fetchTypstVersion() {
  let result;
  try {
    const version = await invoke('typst_version');
    result = { ok: true, value: version };
  } catch (error) {
    // El error del backend es tipado: {kind, message}. Se muestra el mensaje
    // legible si viene, y la forma cruda si no, para no ocultar diagnósticos.
    const message = error?.message ?? error?.kind ?? String(error);
    result = { ok: false, error: message };
  }
  return result;
}

/** Pinta en la tarjeta de andamiaje el resultado del puente con el backend. */
function renderAppInfo(result) {
  const versionEl = document.getElementById('fact-app-version');
  const platformEl = document.getElementById('fact-platform');
  const bridgeEl = document.getElementById('fact-bridge');

  if (!result.ok) {
    bridgeEl.textContent = `${t('bridge.fail')} — ${result.error}`;
    bridgeEl.style.color = 'var(--code-tag)';
    return;
  }

  versionEl.textContent = result.value.version;
  platformEl.textContent = result.value.platform;
  bridgeEl.textContent = t('bridge.ok');
  bridgeEl.style.color = 'var(--code-string)';
}

/** Pinta la versión del compilador Typst embebido. */
function renderTypstVersion(result) {
  const el = document.getElementById('fact-typst');
  if (!result.ok) {
    el.textContent = `${t('typst.fail')} — ${result.error}`;
    el.style.color = 'var(--code-tag)';
    return;
  }
  el.textContent = `${result.value} ${t('typst.embedded')}`;
  el.style.color = 'var(--code-string)';
}

function wireThemeToggle() {
  const button = document.getElementById('btn-theme');
  const icon = document.getElementById('btn-theme-icon');
  button.addEventListener('click', () => {
    const theme = toggleTheme();
    icon.textContent = theme === 'dark' ? '◐' : '◑';
  });
}

function wireAboutPanel() {
  const panel = document.getElementById('about-panel');
  const { close } = registerPanel(panel, {
    trigger: document.getElementById('btn-about'),
    toggle: true,
    closeOnOutsideClick: true,
  });
  document.getElementById('btn-about-close').addEventListener('click', close);
}

function wireGlobalShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllPanels();
  });
}

async function bootstrap() {
  initTheme();
  applyTranslations();
  wireThemeToggle();
  wireAboutPanel();
  wireGlobalShortcuts();

  // Ambas consultas son independientes: se lanzan en paralelo para no encadenar
  // el arranque del sidecar detrás del de la información de la app.
  const [appInfo, typstVersion] = await Promise.all([fetchAppInfo(), fetchTypstVersion()]);
  renderAppInfo(appInfo);
  renderTypstVersion(typstVersion);
}

bootstrap();
