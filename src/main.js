// =============================================================================
// DBV Typst Editor — Punto de entrada del frontend
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Solo cablea: resuelve el DOM, construye los módulos y conecta los eventos.
// Toda la lógica vive en los módulos (`app/`, `project-explorer/`, `editor/`,
// `services/`), igual que el backend evita el monolito `lib.rs`.

import { createWorkspace, baseName } from './app/workspace.js';
import { applyTranslations, getLanguage, t, toggleLanguage } from './i18n/i18n.js';
import { closeAllPanels, registerPanel } from './panels/registerPanel.js';
import { createProjectTree } from './project-explorer/projectTree.js';
import {
  getAppInfo,
  getRecentProjects,
  getTypstVersion,
  pickProjectFolder,
  pickTypstFile,
} from './services/backend.js';
import { createSplitter } from './ui/splitter.js';
import { createToast } from './ui/toast.js';
import { initTheme, toggleTheme } from './themes/theme.js';

const el = (id) => document.getElementById(id);

/** Rellena la ficha "Acerca de" con la versión de la app y del compilador. */
async function renderAbout() {
  const [appInfo, typstVersion] = await Promise.all([getAppInfo(), getTypstVersion()]);

  if (appInfo.ok) {
    el('fact-app-version').textContent = appInfo.value.version;
    el('fact-platform').textContent = appInfo.value.platform;
  }

  const typstEl = el('fact-typst');
  if (typstVersion.ok) {
    typstEl.textContent = `${typstVersion.value} ${t('typst.embedded')}`;
  } else {
    typstEl.textContent = `${t('typst.fail')} — ${typstVersion.error.message}`;
    typstEl.style.color = 'var(--code-tag)';
  }
}

/** Pinta la lista de proyectos recientes del estado sin proyecto (RF-02c). */
async function renderRecentProjects(hostEl, onOpen) {
  const result = await getRecentProjects();
  const projects = result.ok ? result.value : [];

  if (projects.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'recent-list__empty';
    empty.textContent = t('recent.empty');
    hostEl.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const project of projects) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'recent-item';

    const name = document.createElement('span');
    name.className = 'recent-item__name';
    name.textContent = project.name || baseName(project.path);
    item.append(name);

    const path = document.createElement('span');
    path.className = 'recent-item__path';
    path.textContent = project.path;
    item.append(path);

    item.addEventListener('click', () => onOpen(project.path));
    fragment.append(item);
  }
  hostEl.replaceChildren(fragment);
}

function wireThemeToggle(onThemeChanged) {
  const icon = el('btn-theme-icon');
  el('btn-theme').addEventListener('click', () => {
    const theme = toggleTheme();
    icon.textContent = theme === 'dark' ? '◐' : '◑';
    onThemeChanged(theme);
  });
}

function wireLanguageToggle() {
  const label = el('btn-lang-label');
  label.textContent = getLanguage().toUpperCase();
  el('btn-lang').addEventListener('click', () => {
    label.textContent = toggleLanguage().toUpperCase();
  });
}

function wireAboutPanel() {
  const { close } = registerPanel(el('about-panel'), {
    trigger: el('btn-about'),
    toggle: true,
    closeOnOutsideClick: true,
  });
  el('btn-about-close').addEventListener('click', close);
}

async function bootstrap() {
  initTheme();
  applyTranslations();
  wireLanguageToggle();
  wireAboutPanel();

  const toast = createToast(el('toast'));
  const recentListEl = el('recent-list');

  const tree = createProjectTree(el('project-tree'), {
    onOpenFile: (path) => workspace.openDocument(path),
  });

  const workspace = createWorkspace({
    tree,
    notify: toast.show,
    elements: {
      editorHost: el('editor-host'),
      documentName: el('document-name'),
      documentDirty: el('document-dirty'),
      documentPath: el('document-path'),
      projectName: el('project-name'),
      projectKind: el('project-kind'),
      projectActions: el('project-actions'),
      workspaceView: el('workspace-view'),
      emptyView: el('empty-view'),
    },
  });

  // El editor (CodeMirror) necesita reconfigurar su tema, no solo heredar CSS.
  wireThemeToggle((theme) => workspace.setTheme(theme));

  const openPath = async (path) => {
    const opened = await workspace.openProjectAt(path);
    if (opened) await renderRecentProjects(recentListEl, openPath);
  };

  const openFolder = async () => {
    const picked = await pickProjectFolder();
    if (picked.ok && picked.value) await openPath(picked.value);
  };

  const openFile = async () => {
    const picked = await pickTypstFile();
    if (picked.ok && picked.value) await openPath(picked.value);
  };

  el('btn-open-folder').addEventListener('click', openFolder);
  el('btn-empty-open-folder').addEventListener('click', openFolder);
  el('btn-open-file').addEventListener('click', openFile);
  el('btn-empty-open-file').addEventListener('click', openFile);
  el('btn-reveal').addEventListener('click', workspace.revealProject);
  el('btn-close-project').addEventListener('click', async () => {
    await workspace.closeProject();
    await renderRecentProjects(recentListEl, openPath);
  });

  el('tree-filter').addEventListener('input', (event) => tree.filter(event.target.value));

  createSplitter(el('splitter-sidebar'), {
    hostEl: el('workspace-view'),
    cssVariable: '--sidebar-width',
    storageKey: 'dbv-typst-sidebar-width',
    min: 180,
    max: 520,
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllPanels();
  });

  // Los textos escritos a mano con t() (lista de recientes, etiqueta de tipo de
  // proyecto) no llevan `data-i18n`: hay que repintarlos al cambiar de idioma.
  document.addEventListener('dbv-lang-changed', () => {
    renderRecentProjects(recentListEl, openPath);
    workspace.renderDocumentBar();
  });

  await Promise.all([renderAbout(), renderRecentProjects(recentListEl, openPath)]);
}

bootstrap();
