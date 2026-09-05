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
import { WRITING_MODES, getWritingMode, setWritingMode } from './app/writingMode.js';
import { figureActionForPath } from './editor/toolbarActions.js';
import { applyTranslations, getLanguage, t, toggleLanguage } from './i18n/i18n.js';
import { createLauncher } from './launcher/launcher.js';
import { createOutline } from './outline/outline.js';
import { closeAllPanels, registerPanel } from './panels/registerPanel.js';
import { createPreview } from './preview/preview.js';
import { createTerminal } from './terminal/terminal.js';
import { createProjectTree } from './project-explorer/projectTree.js';
import { createWizard } from './project-wizard/wizard.js';
import {
  copyAssetIntoProject,
  getAppInfo,
  getStartupDocument,
  getTypstVersion,
  importProjectArchive,
  on,
  pickArchiveFile,
  pickProjectFolder,
  pickSaveTarget,
  pickTypstFile,
} from './services/backend.js';
import { createChoiceDialog } from './ui/choiceDialog.js';
import { createSplitter } from './ui/splitter.js';
import { createToast } from './ui/toast.js';
import { initTheme, toggleTheme } from './themes/theme.js';
import { getCurrentWebview } from '@tauri-apps/api/webview';

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

/** Modos de escritura (Beta, §7.9): preajustes de qué paneles se ven. */
function wireModeSwitcher(workspaceEl) {
  const buttons = new Map(
    WRITING_MODES.map((mode) => [mode, document.querySelector(`.mode-switcher__button[data-mode="${mode}"]`)])
  );

  function applyMode(mode) {
    setWritingMode(mode, workspaceEl);
    for (const [candidate, button] of buttons) {
      button?.setAttribute('aria-pressed', String(candidate === mode));
    }
  }

  for (const [mode, button] of buttons) {
    button?.addEventListener('click', () => applyMode(mode));
  }

  applyMode(getWritingMode());
}

/**
 * Gestión de imágenes por arrastre (Beta, ARCHITECTURE.md §7.10).
 *
 * Se usa el evento de ventana propio de Tauri, no el `drop` del DOM: el `File`
 * del navegador nunca expone una ruta absoluta del sistema (por diseño de la
 * API web), y en Tauri v2 el drop nativo de ficheros intercepta además el
 * evento del DOM por defecto — `getCurrentWebview().onDragDropEvent()` es la
 * única vía fiable para obtener la ruta real del fichero soltado.
 */
function wireImageDrop(workspace, editorHostEl, notify) {
  const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|svg|webp|bmp)$/i;

  async function handleDrop(imagePath) {
    const result = await copyAssetIntoProject(workspace.state.project.root, imagePath);
    if (!result.ok) {
      notify(`${t('asset.copyFailed')} — ${result.error.message}`, 'error');
      return;
    }
    const view = workspace.editor.getView();
    view.dispatch(figureActionForPath(result.value)(view.state));
    view.focus();
  }

  getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== 'drop' || !workspace.state.project) return;

    // `position` llega en píxeles físicos de ventana; `getBoundingClientRect()`
    // en píxeles lógicos — hay que pasar por `devicePixelRatio` para comparar.
    const { position, paths } = event.payload;
    const ratio = window.devicePixelRatio || 1;
    const x = position.x / ratio;
    const y = position.y / ratio;
    const rect = editorHostEl.getBoundingClientRect();
    const droppedOnEditor = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (!droppedOnEditor) return;

    const imagePath = paths.find((path) => IMAGE_EXTENSIONS.test(path));
    if (imagePath) handleDrop(imagePath);
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
      editorToolbar: el('editor-toolbar'),
      citationPanel: el('citation-panel'),
      citationList: el('citation-list'),
      citationFilter: el('citation-filter'),
      citationNewEntry: el('citation-new-entry'),
      bibEntryPanel: el('bib-entry-panel'),
      bibEntryType: el('bib-entry-type'),
      bibEntryKey: el('bib-entry-key'),
      bibEntryFields: el('bib-entry-fields'),
      bibEntryError: el('bib-entry-error'),
      bibEntrySave: el('bib-entry-save'),
      bibEntryCancel: el('bib-entry-cancel'),
      symbolPanel: el('symbol-panel'),
      symbolGrid: el('symbol-grid'),
      symbolFilter: el('symbol-filter'),
      tablePanel: el('table-panel'),
      tableRows: el('table-rows'),
      tableCols: el('table-cols'),
      tableHeader: el('table-header'),
      tableInsert: el('table-insert'),
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
  wireModeSwitcher(el('workspace-view'));
  wireImageDrop(workspace, el('editor-host'), toast.show);

  const preview = createPreview({
    pagesEl: el('preview-pages'),
    bandEl: el('preview-band'),
    statusEl: el('preview-status'),
    zoomLabelEl: el('preview-zoom-label'),
  });

  // Outline (Beta, ARCHITECTURE.md §7.8): mismo documento en vivo que la vista
  // previa, así que comparte exactamente sus mismos ganchos del workspace —
  // de ahí que cada `setListener` de abajo llame a los dos, no a uno solo.
  const outline = createOutline({
    listEl: el('outline-list'),
    onNavigate: (entry) => preview.scrollToPage(entry.page, entry.yPt),
  });

  // El bucle de vista previa se engancha al workspace en vez de vivir dentro de
  // él: el workspace sabe qué documento está abierto, no cómo se compila.
  workspace.setListener('documentOpened', (doc) => {
    const payload = { document: doc.path, root: workspace.state.project.root, content: doc.content };
    preview.setDocument(payload);
    outline.setDocument(payload);
  });
  workspace.setListener('documentDetached', () => {
    preview.detachLiveContent();
    outline.detachLiveContent();
  });
  workspace.setListener('documentChanged', (content) => {
    preview.onContentChanged(content);
    outline.onContentChanged(content);
  });
  workspace.setListener('externalChange', (change) => {
    if (!change.isActiveDocument) preview.onExternalChange();
  });

  registerPanel(el('outline-panel'), {
    trigger: el('btn-outline'),
    toggle: true,
    closeOnOutsideClick: true,
  });

  // Terminal avanzado (Beta, §7.14): oculto por defecto, vía de escape para
  // subcomandos directos del CLI de Typst — no sustituye a ningún flujo guiado.
  const terminal = createTerminal({
    outputEl: el('terminal-output'),
    inputEl: el('terminal-input'),
  });
  registerPanel(el('terminal-panel'), {
    trigger: el('btn-terminal'),
    toggle: true,
    onOpen: () => {
      const hint = workspace.state.project
        ? workspace.state.project.root
        : t('terminal.hint');
      el('terminal-panel').querySelector('.terminal__hint').textContent = hint;
      terminal.focusInput();
    },
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

  // Importar Project Archive (RF-11, v0.2): elegir el .dbvt, elegir dónde
  // desempaquetarlo, y abrir el proyecto resultante como si acabara de crearse.
  const importArchive = async () => {
    const archive = await pickArchiveFile();
    if (!archive.ok || !archive.value) return;

    const destination = await pickProjectFolder();
    if (!destination.ok || !destination.value) return;

    toast.show(t('archive.importWorking'));
    const imported = await importProjectArchive(archive.value, destination.value);
    if (!imported.ok) {
      toast.show(`${t('archive.importFailed')} — ${imported.error.message}`, 'error');
      return;
    }
    await openPath(imported.value.root);
  };

  el('btn-open-folder').addEventListener('click', openFolder);
  el('btn-empty-open-folder').addEventListener('click', openFolder);
  el('btn-open-file').addEventListener('click', openFile);
  el('btn-empty-open-file').addEventListener('click', openFile);
  el('btn-import-archive').addEventListener('click', importArchive);
  el('btn-reveal').addEventListener('click', workspace.revealProject);
  el('btn-export-archive').addEventListener('click', async () => {
    const picked = await pickSaveTarget(workspace.suggestedArchiveName(), 'DBV Typst Archive', ['dbvt']);
    if (picked.ok && picked.value) await workspace.exportArchive(picked.value);
  });
  const closeProject = async () => {
    const closed = await workspace.closeProject();
    if (!closed) return;
    await preview.clear();
    outline.clear();
    await launcher.refreshRecent();
  };
  el('btn-close-project').addEventListener('click', closeProject);

  // Guardado: botones, Ctrl/Cmd+S desde el editor y refresco de la vista previa.
  workspace.setListener('saveRequested', () => workspace.save());
  workspace.setListener('saved', () => {
    preview.onSaved();
    outline.onSaved();
  });
  el('btn-save').addEventListener('click', () => workspace.save());
  el('btn-save-as').addEventListener('click', () => workspace.saveAs());

  // Exportación PDF (RF-10): el artefacto final que se comparte, no la vista previa.
  el('btn-export-pdf').addEventListener('click', async () => {
    const picked = await pickSaveTarget(workspace.suggestedPdfName(), 'PDF', ['pdf']);
    if (picked.ok && picked.value) await workspace.exportPdf(picked.value);
  });

  // Exportación PNG (Beta, §7.12) — alcance de este slice: solo la página que
  // se está leyendo ahora en la vista previa, no rango ni documento completo.
  el('btn-export-png').addEventListener('click', async () => {
    const page = preview.getCurrentPage();
    const picked = await pickSaveTarget(workspace.suggestedPngName(page), 'PNG', ['png']);
    if (picked.ok && picked.value) await workspace.exportPng(picked.value, page);
  });

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

  // Doble clic sobre un `.typ` en el explorador del SO (asociación de fichero,
  // RF-12): se abre ese documento en vez del lanzador.
  const startup = await getStartupDocument();
  if (startup.ok && startup.value) await openPath(startup.value);

  // Instancia única (Beta): un segundo lanzamiento (otro doble clic sobre un
  // `.typ` con la app ya abierta) no crea un proceso nuevo — el backend
  // enfoca esta misma ventana y emite este evento con la ruta a abrir.
  on('open-document', (path) => {
    if (path) openPath(path);
  });

  // Menú nativo de macOS (Beta, macos_menu.rs): cada ítem propio del menú
  // reemite un evento; la lógica de cada acción sigue siendo la misma del
  // botón equivalente, así que aquí solo se reenvía el clic — nunca se
  // reimplementa (`NATIVE_DESKTOP_APPS.md` §6.10). No tiene efecto alguno en
  // Windows/Linux: el backend nunca emite estos eventos ahí, al no montarse
  // el menú.
  on('menu-new-project', closeProject);
  on('menu-close-project', closeProject);
  on('menu-open-folder', openFolder);
  on('menu-open-file', openFile);
  on('menu-save', () => el('btn-save').click());
  on('menu-save-as', () => el('btn-save-as').click());
  on('menu-export-pdf', () => el('btn-export-pdf').click());
  on('menu-reveal', () => el('btn-reveal').click());
  on('menu-toggle-theme', () => el('btn-theme').click());
  on('menu-outline', () => el('btn-outline').click());
  on('menu-terminal', () => el('btn-terminal').click());
}

bootstrap();
