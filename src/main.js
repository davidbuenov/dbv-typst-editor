// =============================================================================
// DBV Typst Editor — Punto de entrada del frontend
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Solo cablea: resuelve el DOM, construye los módulos y conecta los eventos.
// Toda la lógica vive en los módulos (`app/`, `launcher/`, `project-wizard/`,
// `project-explorer/`, `editor/`, `preview/`, `services/`), igual que el
// backend evita el monolito `lib.rs`.

import { createWorkspace } from './app/workspace.js';
import { applyTranslations, getLanguage, t, toggleLanguage } from './i18n/i18n.js';
import { createLauncher } from './launcher/launcher.js';
import { closeAllPanels, registerPanel } from './panels/registerPanel.js';
import { createPreview } from './preview/preview.js';
import { createProjectTree } from './project-explorer/projectTree.js';
import { createWizard } from './project-wizard/wizard.js';
import {
  getAppInfo,
  getTypstVersion,
  pickProjectFolder,
  pickTypstFile,
} from './services/backend.js';
import { createChoiceDialog } from './ui/choiceDialog.js';
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
  const dialog = createChoiceDialog({
    dialogEl: el('choice-dialog'),
    titleEl: el('choice-title'),
    textEl: el('choice-text'),
    actionsEl: el('choice-actions'),
  });

  const tree = createProjectTree(el('project-tree'), {
    onOpenFile: (path) => workspace.openDocument(path),
  });

  const workspace = createWorkspace({
    tree,
    dialog,
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

  const preview = createPreview({
    pagesEl: el('preview-pages'),
    bandEl: el('preview-band'),
    statusEl: el('preview-status'),
    zoomLabelEl: el('preview-zoom-label'),
  });

  // El bucle de vista previa se engancha al workspace en vez de vivir dentro de
  // él: el workspace sabe qué documento está abierto, no cómo se compila.
  workspace.setListener('documentOpened', (doc) =>
    preview.setDocument({
      document: doc.path,
      root: workspace.state.project.root,
      content: doc.content,
    })
  );
  workspace.setListener('documentChanged', (content) => preview.onContentChanged(content));
  workspace.setListener('externalChange', (change) => {
    if (!change.isActiveDocument) preview.onExternalChange();
  });

  const openPath = async (path) => {
    const opened = await workspace.openProjectAt(path);
    if (opened) await launcher.refreshRecent();
  };

  const launcher = createLauncher({
    templatesEl: el('template-grid'),
    recentEl: el('recent-list'),
    onCreateFromTemplate: (template) => wizard.open(template),
    onOpenRecent: openPath,
  });

  const wizard = createWizard({
    dialogEl: el('wizard-dialog'),
    titleEl: el('wizard-title'),
    descriptionEl: el('wizard-description'),
    formEl: el('wizard-form'),
    locationEl: el('wizard-location'),
    browseButton: el('wizard-browse'),
    createButton: el('wizard-create'),
    cancelButton: el('wizard-cancel'),
    errorEl: el('wizard-error'),
    notify: toast.show,
    onCreated: (project) => openPath(project.root),
  });

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
    const closed = await workspace.closeProject();
    if (!closed) return;
    await preview.clear();
    await launcher.refreshRecent();
  });

  // Guardado: botones, Ctrl/Cmd+S desde el editor y refresco de la vista previa.
  workspace.setListener('saveRequested', () => workspace.save());
  workspace.setListener('saved', () => preview.onSaved());
  el('btn-save').addEventListener('click', () => workspace.save());
  el('btn-save-as').addEventListener('click', () => workspace.saveAs());

  el('btn-zoom-in').addEventListener('click', preview.zoomIn);
  el('btn-zoom-out').addEventListener('click', preview.zoomOut);
  el('btn-zoom-reset').addEventListener('click', preview.zoomReset);

  el('tree-filter').addEventListener('input', (event) => tree.filter(event.target.value));

  createSplitter(el('splitter-sidebar'), {
    hostEl: el('workspace-view'),
    cssVariable: '--sidebar-width',
    storageKey: 'dbv-typst-sidebar-width',
    min: 180,
    max: 520,
  });

  createSplitter(el('splitter-preview'), {
    hostEl: el('workspace-view'),
    cssVariable: '--preview-width',
    storageKey: 'dbv-typst-preview-width',
    measureFrom: 'end',
    min: 240,
    max: 1200,
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllPanels();
  });

  // Los textos que los módulos escriben a mano con t() (catálogo, recientes,
  // estado de la vista previa) no llevan `data-i18n`: hay que repintarlos.
  document.addEventListener('dbv-lang-changed', () => {
    launcher.refreshLanguage();
    launcher.refreshRecent();
    workspace.renderDocumentBar();
    preview.refreshStatus();
  });

  await Promise.all([renderAbout(), launcher.load()]);
}

bootstrap();
