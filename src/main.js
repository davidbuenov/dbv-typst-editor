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
import { createUpdater } from './app/updater.js';
import { PANELS, getPanelState, initPanels, togglePanel } from './app/workspacePanels.js';
import { figureActionForPath } from './editor/toolbarActions.js';
import { decideImageDrop, pathsWithExtension } from './app/dropTarget.js';
import { applyTranslations, getLanguage, setLanguage, t } from './i18n/i18n.js';
import { createHelp } from './help/help.js';
import { createUniversePanel } from './universe/universePanel.js';
import { getCuratedUniverseTemplatesCatalog } from './universe/universeThumbnails.js';
import { importPackageAction } from './universe/universeSpec.js';
import { createAlwaysOnTop } from './app/alwaysOnTop.js';
import { createLauncher } from './launcher/launcher.js';
import { createTemplateGalleryModal } from './launcher/templateGalleryModal.js';
import { createOutline } from './outline/outline.js';
import { makeDraggable } from './panels/draggablePanel.js';
import { closeAllPanels, registerPanel } from './panels/registerPanel.js';
import { createPreview } from './preview/preview.js';
import { createTerminal } from './terminal/terminal.js';
import { createPythonRunnerPanel } from './panels/pythonRunnerPanel.js';
import { createDiffModal } from './editor/diffModal.js';
import { createGitManager } from './app/gitManager.js';
import { createLspClient } from './editor/lspClient.js';
import { createProjectTree } from './project-explorer/projectTree.js';
import { createWizard } from './project-wizard/wizard.js';
import {
  copyAssetIntoProject,
  copyFontIntoProject,
  getAppInfo,
  isPackagedApp,
  getStartupDocument,
  getSupportedAssetExtensions,
  getTypstVersion,
  importProjectArchive,
  on,
  openUniversePackagePage,
  previewUniverseTemplate,
  pickArchiveFile,
  pickProjectFolder,
  pickSaveTarget,
  pickTypstFile,
} from './services/backend.js';
import { createChoiceDialog } from './ui/choiceDialog.js';
import { createSplitter } from './ui/splitter.js';
import { createToast } from './ui/toast.js';
import { cycleTheme, getTheme, initTheme, setTheme } from './themes/theme.js';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';

const el = (id) => document.getElementById(id);

/** Rellena la ficha "Acerca de" con la versión de la app y del compilador. */
async function renderAbout() {
  const [appInfo, typstVersion, packaged] = await Promise.all([getAppInfo(), getTypstVersion(), isPackagedApp()]);

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

  // Auto-actualización (Beta, ADR-ACTUALIZADOR-001): en una instalación de
  // Microsoft Store el botón no se muestra —la Store ya actualiza— y en el
  // resto se comprueba solo cuando el usuario lo pide. Si la detección de
  // origen fallara, se asume instalación manual: ofrecer el botón de más es
  // preferible a ocultárselo a quien sí lo necesita.
  createUpdater({
    buttonEl: el('btn-check-update'),
    statusEl: el('about-update-status'),
    isPackaged: packaged.ok && packaged.value,
  });
}

/**
 * Selector segmentado Claro/Oscuro/Sepia. Cada botón fija su propio tema
 * directamente (no hay "alternar" con tres opciones); `cycle()` sí hace falta
 * para el atajo del menú nativo de macOS (Slice 24), que solo puede pedir
 * "el siguiente", no uno concreto.
 */
function wireThemeSwitcher(onThemeChanged) {
  const buttons = {
    dark: el('btn-theme-dark'),
    light: el('btn-theme-light'),
    sepia: el('btn-theme-sepia'),
  };
  function refresh(theme) {
    for (const [name, button] of Object.entries(buttons)) {
      button.classList.toggle('active', name === theme);
    }
  }
  function apply(theme) {
    setTheme(theme);
    refresh(theme);
    onThemeChanged(theme);
  }
  for (const [name, button] of Object.entries(buttons)) {
    button.addEventListener('click', () => apply(name));
  }
  refresh(getTheme());
  return { cycle: () => apply(cycleTheme()) };
}

/** Paneles del espacio de trabajo (Beta, §7.9): tres interruptores independientes. */
function wirePanelSwitcher(workspaceEl) {
  const buttons = new Map(
    PANELS.map((panel) => [panel, document.querySelector(`.mode-switcher__button[data-panel="${panel}"]`)])
  );

  function refreshPressed() {
    const state = getPanelState();
    for (const [panel, button] of buttons) {
      button?.setAttribute('aria-pressed', String(state[panel]));
    }
  }

  for (const [panel, button] of buttons) {
    button?.addEventListener('click', () => {
      togglePanel(panel, workspaceEl);
      refreshPressed();
    });
  }

  initPanels(workspaceEl);
  refreshPressed();
}

/**
 * Pestañas Archivos/Esquema del panel lateral (Beta, §7.8, rediseñado): antes
 * el esquema era un panel flotante aparte, disparado por un botón junto al
 * árbol; ahora es la segunda pestaña del mismo panel, como en dbv-md-reader
 * (`filetree.js` → `setActiveTab`) — un único interruptor "P" en la cabecera
 * (`wirePanelSwitcher`) sigue controlando el panel entero, con las dos
 * pestañas dentro.
 */
function wireSidebarTabs(workspaceEl) {
  const tabs = { files: el('tab-files'), outline: el('tab-outline') };
  const panels = { files: el('files-panel'), outline: el('outline-panel') };

  function setActiveTab(name) {
    for (const key of Object.keys(tabs)) {
      tabs[key].classList.toggle('active', key === name);
      panels[key].classList.toggle('hidden', key !== name);
    }
  }

  tabs.files.addEventListener('click', () => setActiveTab('files'));
  tabs.outline.addEventListener('click', () => setActiveTab('outline'));
  setActiveTab('files');

  return {
    /** Usado por el menú nativo de macOS (`menu-outline`): pestaña + panel visible. */
    showOutline() {
      if (!getPanelState().sidebar) {
        togglePanel('sidebar', workspaceEl);
        document.querySelector('.mode-switcher__button[data-panel="sidebar"]')?.setAttribute('aria-pressed', 'true');
      }
      setActiveTab('outline');
    },
  };
}

/**
 * Gestión de imágenes por arrastre (Beta, ARCHITECTURE.md §7.10; RF-18).
 *
 * Se usa el evento de ventana propio de Tauri, no el `drop` del DOM: el `File`
 * del navegador nunca expone una ruta absoluta del sistema (por diseño de la
 * API web), y en Tauri v2 el drop nativo de ficheros intercepta además el
 * evento del DOM por defecto — `getCurrentWebview().onDragDropEvent()` es la
 * única vía fiable para obtener la ruta real del fichero soltado.
 *
 * RF-18: la imagen se copia caiga donde caiga en la ventana, igual que ya hacían
 * las fuentes; el panel del editor solo decide si además se INSERTA la figura en
 * el cursor. Antes, soltarla sobre el explorador de proyecto no hacía nada y no
 * lo decía, que es el peor modo de fallo posible.
 */
function wireImageDrop(workspace, editorHostEl, notify, getExtensions) {
  async function handleDrop(imagePath, insert) {
    const result = await copyAssetIntoProject(workspace.state.project.root, imagePath);
    if (!result.ok) {
      notify(`${t('asset.copyFailed')} — ${result.error.message}`, 'error');
      return;
    }
    if (!insert) {
      notify(`${t('asset.imageAdded')} ${result.value}`);
      return;
    }
    const view = workspace.editor.getView();
    view.dispatch(figureActionForPath(result.value)(view.state));
    view.focus();
  }

  getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== 'drop') return;

    const { position, paths } = event.payload;
    const [imagePath] = pathsWithExtension(paths, getExtensions().images);
    if (!imagePath) return;

    if (!workspace.state.project) {
      notify(t('asset.needsProject'), 'error');
      return;
    }

    const rect = editorHostEl?.getBoundingClientRect() ?? null;
    const { insert } = decideImageDrop(position, rect, window.devicePixelRatio);
    handleDrop(imagePath, insert);
  });
}

/**
 * Arrastrar una fuente al proyecto (petición de sesión de uso real): mismo
 * mecanismo que `wireImageDrop`, pero sin insertar nada en el documento — una
 * fuente no se "usa" en el punto donde se suelta, solo queda disponible para
 * `set text(font: "...")` en cualquier parte del proyecto, así que no importa
 * dónde de la ventana caiga ni cuántos ficheros vengan en el mismo soltado.
 */
function wireFontDrop(workspace, notify, getExtensions) {
  async function handleDrop(fontPaths) {
    const added = [];
    for (const fontPath of fontPaths) {
      const result = await copyFontIntoProject(workspace.state.project.root, fontPath);
      if (result.ok) added.push(result.value);
    }
    if (added.length === 0) {
      notify(t('asset.fontCopyFailed'), 'error');
      return;
    }
    const label = added.length === 1 ? t('asset.fontAdded') : t('asset.fontsAdded');
    notify(`${label} ${added.join(', ')}`);
  }

  getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== 'drop') return;

    const fontPaths = pathsWithExtension(event.payload.paths, getExtensions().fonts);
    if (fontPaths.length === 0) return;

    if (!workspace.state.project) {
      notify(t('asset.needsProject'), 'error');
      return;
    }
    handleDrop(fontPaths);
  });
}

/** Selector segmentado ES/EN — mismo patrón que `wireThemeSwitcher`. */
function wireLanguageSwitcher() {
  const buttons = { es: el('btn-lang-es'), en: el('btn-lang-en') };
  function refresh(language) {
    for (const [name, button] of Object.entries(buttons)) {
      button.classList.toggle('active', name === language);
    }
  }
  for (const [name, button] of Object.entries(buttons)) {
    button.addEventListener('click', () => {
      setLanguage(name);
      refresh(name);
    });
  }
  refresh(getLanguage());
}

/** Ayuda bilingüe (contenido en `help/helpContent.js`). */
function wireHelpPanel() {
  createHelp({ contentEl: el('help-content'), navEl: el('help-nav') });
  const { close } = registerPanel(el('help-panel'), {
    trigger: el('btn-help'),
    toggle: true,
  });
  el('btn-help-close').addEventListener('click', close);
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
  wireLanguageSwitcher();
  wireAboutPanel();
  wireHelpPanel();

  const toast = createToast(el('toast'));
  const dialog = createChoiceDialog({
    dialogEl: el('choice-dialog'),
    titleEl: el('choice-title'),
    textEl: el('choice-text'),
    actionsEl: el('choice-actions'),
  });

  const diffModal = createDiffModal({
    dialogEl: el('diff-dialog'),
    localEl: el('diff-local'),
    diskEl: el('diff-disk'),
    keepMineBtn: el('diff-keep-mine'),
    reloadDiskBtn: el('diff-reload-disk'),
    cancelBtn: el('diff-cancel'),
  });

  const lspStatusEl = el('lsp-status');
  let currentLspStatus = 'offline';
  const updateLspStatus = (status) => {
    if (!lspStatusEl) return;
    currentLspStatus = status;
    if (status === 'offline') {
      lspStatusEl.classList.add('hidden');
    } else {
      lspStatusEl.classList.remove('hidden');
      lspStatusEl.setAttribute('data-status', status);
      if (status === 'ready') {
        lspStatusEl.textContent = '● Tinymist LSP';
        lspStatusEl.title = 'Language Server Tinymist activo';
      } else if (status === 'starting') {
        lspStatusEl.textContent = '○ Conectando LSP...';
        lspStatusEl.title = 'Iniciando Language Server Tinymist...';
      } else if (status === 'error') {
        lspStatusEl.textContent = '⚠ LSP error';
        lspStatusEl.title = 'Tinymist no disponible';
      }
    }
  };

  lspStatusEl?.addEventListener('click', () => {
    if (currentLspStatus === 'ready') {
      toast.show('Tinymist LSP activo: autocompletado en vivo (#, @, <), hover con documentación y formateo con Typstyle (Shift+Alt+F)');
    } else if (currentLspStatus === 'starting') {
      toast.show('Tinymist LSP está iniciando...', 'info');
    } else if (currentLspStatus === 'error') {
      toast.show('Tinymist LSP no disponible. Revisa la consola o reinicia la app.', 'error');
    }
  });

  const lspClient = createLspClient({
    notify: toast.show,
    onStatusChange: updateLspStatus,
  });

  const tree = createProjectTree(el('project-tree'), {
    onOpenFile: (path) => workspace.openDocument(path),
  });

  const workspace = createWorkspace({
    tree,
    dialog,
    diffModal,
    lspClient,
    notify: toast.show,
    elements: {
      editorHost: el('editor-host'),
      editorToolbar: el('editor-toolbar'),
      citationPanel: el('citation-panel'),
      citationList: el('citation-list'),
      citationFilter: el('citation-filter'),
      citationNewEntry: el('citation-new-entry'),
      imagePanel: el('image-panel'),
      imageList: el('image-list'),
      imageFilter: el('image-filter'),
      imageBrowse: el('image-browse'),
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
      cetzPanel: el('cetz-panel'),
      documentName: el('document-name'),
      documentDirty: el('document-dirty'),
      documentPath: el('document-path'),
      projectName: el('project-name'),
      projectKind: el('project-kind'),
      projectActions: el('project-actions'),
      workspaceView: el('workspace-view'),
      emptyView: el('empty-view'),
      universeButton: el('btn-universe'),
      projectMenuItems: [el('btn-export-archive'), el('btn-reveal'), el('btn-close-project')],
    },
  });

  // Gestor de control de versiones Git (RF-19)
  const gitManager = createGitManager({
    indicatorEl: el('git-indicator'),
    triggerBtn: el('git-btn'),
    branchEl: el('git-branch'),
    summaryEl: el('git-status-summary'),
    panelEl: el('git-popover'),
    popoverBranchEl: el('git-popover-branch'),
    popoverAbEl: el('git-popover-ab'),
    filesEl: el('git-popover-files'),
    commitInputEl: el('git-commit-msg'),
    commitBtn: el('git-commit-btn'),
    pushBtn: el('git-push-btn'),
    pullBtn: el('git-pull-btn'),
    getProjectPath: () => workspace.state.project?.root ?? null,
    notify: toast.show,
  });

  // El editor (CodeMirror) necesita reconfigurar su tema, no solo heredar CSS.
  const themeSwitcher = wireThemeSwitcher((theme) => workspace.setTheme(theme));
  wirePanelSwitcher(el('workspace-view'));
  // Extensiones aceptadas por arrastre: las decide Rust (RF-18), no el
  // frontend. Se piden una vez y se cachean; hasta que llegue la respuesta, un
  // soltado no encuentra nada que copiar, que es preferible a mantener aquí una
  // segunda lista que vuelva a desincronizarse de la de `assets.rs`.
  let assetExtensions = { images: [], fonts: [] };
  getSupportedAssetExtensions().then((result) => {
    if (result.ok) assetExtensions = result.value;
  });
  const getAssetExtensions = () => assetExtensions;

  wireImageDrop(workspace, el('editor-host'), toast.show, getAssetExtensions);
  wireFontDrop(workspace, toast.show, getAssetExtensions);

  const staleEl = el('preview-stale');
  const preview = createPreview({
    pagesEl: el('preview-pages'),
    bandEl: el('preview-band'),
    bandSplitterEl: el('splitter-band'),
    statusEl: el('preview-status'),
    zoomLabelEl: el('preview-zoom-label'),
    getTarget: () => workspace.getCompileTarget(),
    onStaleChange: (stale) => staleEl.classList.toggle('hidden', !stale),
  });
  createSplitter(el('splitter-band'), {
    hostEl: el('workspace-view').querySelector('.preview'),
    cssVariable: '--preview-band-height',
    storageKey: 'dbv-typst-preview-band-height',
    axis: 'y',
    measureFrom: 'end',
    min: 60,
    max: 500,
  });

  // Outline (Beta, ARCHITECTURE.md §7.8): mismo documento en vivo que la vista
  // previa, así que comparte exactamente sus mismos ganchos del workspace —
  // de ahí que cada `setListener` de abajo llame a los dos, no a uno solo.
  const outline = createOutline({
    listEl: el('outline-list'),
    onNavigate: (entry) => preview.scrollToPage(entry.page, entry.yPt),
    getTarget: () => workspace.getCompileTarget(),
  });

  let lastTargetDocument = null;

  // El bucle de vista previa se engancha al workspace en vez de vivir dentro de
  // él: el workspace sabe qué documento está abierto, no cómo se compila.
  // Solo se reinicia la vista previa y el outline si el documento objetivo ha
  // cambiado (RF-14). En modo 'document', abrir otro capítulo no cambia el
  // documento raíz compilado (main.typ): reiniciar aquí reseteaba el scroll a
  // la página 1 y rompía la experiencia del doble clic (RF-16).
  workspace.setListener('documentOpened', () => {
    refreshPreviewControls();
    const target = workspace.getCompileTarget();
    const targetDoc = target?.document ?? null;
    if (targetDoc !== lastTargetDocument) {
      lastTargetDocument = targetDoc;
      preview.restart();
      outline.restart();
    }
  });
  // Abrir un fichero acompañante (`.bib`, `.toml`) no cambia el documento
  // objetivo, pero sí puede cambiar el render: un `.bib` editado en vivo afecta
  // a la bibliografía, así que se recompila igual que con cualquier cambio.
  workspace.setListener('documentDetached', () => {
    preview.onContentChanged();
    outline.onContentChanged();
  });
  workspace.setListener('documentChanged', () => {
    preview.onContentChanged();
    outline.onContentChanged();
  });
  workspace.setListener('externalChange', (change) => {
    if (!change.isActiveDocument) preview.onExternalChange();
    gitManager.refresh();
  });

  const sidebarTabs = wireSidebarTabs(el('workspace-view'));

  // Terminal avanzado (Beta, §7.14): oculto por defecto, vía de escape para
  // subcomandos directos del CLI de Typst — no sustituye a ningún flujo guiado.
  const terminal = createTerminal({
    outputEl: el('terminal-output'),
    inputEl: el('terminal-input'),
    // Se lee en cada comando, no se captura una vez: el proyecto abierto puede
    // cambiar con el panel de terminal ya creado.
    getRoot: () => workspace.state.project?.root,
  });
  const terminalPanel = registerPanel(el('terminal-panel'), {
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
  el('terminal-close').addEventListener('click', terminalPanel.close);
  el('terminal-clear').addEventListener('click', terminal.clear);
  makeDraggable(el('terminal-panel'), el('terminal-header'));

  // Python Runner (RF-22): ejecución de scripts locales y figuras dinámicas.
  const pythonRunner = createPythonRunnerPanel({
    panelEl: el('python-panel'),
    codeEl: el('python-code'),
    runBtn: el('python-run'),
    statusEl: el('python-status'),
    outputContainerEl: el('python-output-container'),
    stdoutEl: el('python-stdout'),
    imagesContainerEl: el('python-images'),
    closeBtn: el('python-close'),
    presetPlotBtn: el('python-preset-plot'),
    presetDataBtn: el('python-preset-data'),
    getProjectPath: () => workspace.state.project?.root ?? null,
    onInsertFigure: (imagePath) => {
      workspace.insertFigureForPath(imagePath);
      toast.show(t('python.insertFigure'));
    },
    notify: toast.show,
  });
  const pythonPanel = registerPanel(el('python-panel'), {
    trigger: el('btn-python'),
    toggle: true,
    onOpen: () => {
      const hint = workspace.state.project
        ? workspace.state.project.root
        : t('python.hint');
      el('python-panel').querySelector('.terminal__hint').textContent = hint;
      pythonRunner.refreshStatus();
      pythonRunner.focus();
    },
  });
  el('python-close').addEventListener('click', pythonPanel.close);
  makeDraggable(el('python-panel'), el('python-header'));

  // Typst Universe (Beta, §7.6): plantillas que crean proyecto y paquetes que
  // se importan en el documento abierto. La plantilla reutiliza el asistente
  // normal (solo pedirá nombre y ubicación: las de Universe no traen
  // formulario); el paquete es una transacción del editor.
  const openPath = async (path) => {
    const opened = await workspace.openProjectAt(path);
    if (opened) {
      await launcher.refreshRecent();
      await gitManager.refresh();
    }
  };

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

  const getFullGalleryCatalog = () => {
    const local = launcher ? launcher.getCatalog() : [];
    const universe = getCuratedUniverseTemplatesCatalog();
    return [...local, ...universe];
  };

  const templateGallery = createTemplateGalleryModal({
    dialogEl: el('template-gallery-dialog'),
    listEl: el('template-gallery-list'),
    previewEl: el('template-gallery-preview'),
    searchEl: el('template-gallery-search'),
    useBtnEl: el('template-gallery-use'),
    cancelBtnEl: el('template-gallery-cancel'),
    metaEl: el('template-gallery-meta'),
    onSelectTemplate: (template) => wizard.open(template),
    tabsEl: el('template-gallery-tabs'),
    sidebarEl: el('template-gallery-sidebar'),
    specPanelEl: el('template-gallery-spec'),
    specInputEl: el('template-gallery-spec-input'),
    specErrorEl: el('template-gallery-spec-error'),
    specPreviewBtnEl: el('template-gallery-spec-preview'),
    onPreviewSpec: (spec) => previewUniverseTemplate(spec),
    zoomEl: el('template-gallery-zoom'),
    zoomContentEl: el('template-gallery-zoom-content'),
    zoomCloseEl: el('template-gallery-zoom-close'),
  });

  el('template-gallery-close-x')?.addEventListener('click', () => templateGallery.close());
  // Única vía de creación desde plantilla del lanzador (RF-25).
  el('btn-launcher-new')?.addEventListener('click', () => {
    templateGallery.open(null, getFullGalleryCatalog());
  });

  // Typst Universe (§7.6), solo paquetes desde RF-26: las plantillas viven en
  // la galería, que es la única puerta de entrada a la creación de documentos.
  // Un paquete es una transacción sobre el documento abierto, así que este panel
  // pertenece al editor y su botón se apaga mientras no haya documento.
  const universePanel = registerPanel(el('universe-panel'), {
    trigger: el('btn-universe'),
    toggle: true,
  });
  el('btn-universe-close').addEventListener('click', universePanel.close);
  createUniversePanel({
    packagesEl: el('universe-packages'),
    specInputEl: el('universe-spec'),
    specButtonEl: el('universe-spec-apply'),
    errorEl: el('universe-error'),
    onUsePackage: (spec) => {
      const view = workspace.editor.getView();
      if (!workspace.state.document || !view) {
        toast.show(t('universe.needDocument'), 'error');
        return;
      }
      const transaction = importPackageAction(spec)(view.state);
      if (!transaction) {
        toast.show(t('universe.alreadyImported'));
        return;
      }
      view.dispatch(transaction);
      view.focus();
      universePanel.close();
      toast.show(`${t('universe.imported')} ${spec}`);
    },
    onViewPackage: async (spec) => {
      const result = await openUniversePackagePage(spec);
      if (!result.ok) toast.show(t('universe.viewOnlineFailed'), 'error');
    },
  });

  const launcher = createLauncher({
    recentEl: el('recent-list'),
    onOpenRecent: openPath,
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

  // Menú Archivo (RF-30). `registerPanel` ya cierra al pulsar fuera y con
  // Escape; aquí solo falta cerrarlo al elegir algo, porque si no el menú se
  // queda abierto encima del diálogo del sistema que acaba de abrirse.
  const fileMenu = registerPanel(el('file-menu'), {
    trigger: el('btn-file-menu'),
    toggle: true,
  });
  el('file-menu').addEventListener('click', (event) => {
    if (event.target.closest('.menu-item')) fileMenu.close();
  });

  el('btn-open-folder').addEventListener('click', openFolder);
  el('btn-empty-open-folder').addEventListener('click', openFolder);
  el('btn-open-file').addEventListener('click', openFile);
  el('btn-empty-open-file').addEventListener('click', openFile);
  el('btn-import-archive').addEventListener('click', importArchive);
  el('btn-menu-import-archive').addEventListener('click', importArchive);
  el('btn-reveal').addEventListener('click', workspace.revealProject);
  el('btn-export-archive').addEventListener('click', async () => {
    const picked = await pickSaveTarget(workspace.suggestedArchiveName(), 'DBV Typst Archive', ['dbvt']);
    if (picked.ok && picked.value) await workspace.exportArchive(picked.value);
  });
  const closeProject = async () => {
    const closed = await workspace.closeProject();
    if (!closed) return;
    lastTargetDocument = null;
    await preview.clear();
    outline.clear();
    await launcher.refreshRecent();
    await gitManager.refresh();
  };
  el('btn-close-project').addEventListener('click', closeProject);

  // Guardado: botones, Ctrl/Cmd+S desde el editor y refresco de la vista previa.
  workspace.setListener('saveRequested', () => workspace.save());
  workspace.setListener('saved', () => {
    preview.onContentChanged();
    outline.onContentChanged();
    gitManager.refresh();
  });
  el('btn-save').addEventListener('click', () => workspace.save());
  el('btn-save-as').addEventListener('click', () => workspace.saveAs());

  // Exportación PDF (RF-10): el artefacto final que se comparte, no la vista previa.
  el('btn-export-pdf').addEventListener('click', async () => {
    const picked = await pickSaveTarget(workspace.suggestedPdfName(), 'PDF', ['pdf']);
    if (picked.ok && picked.value) await workspace.exportPdf(picked.value);
  });

  // Formateo de documento con Typstyle / Tinymist (RF-21)
  el('btn-format-doc')?.addEventListener('click', () => workspace.formatDocument());

  // Actualización de estado de diagnósticos en la barra de documento
  workspace.setListener('diagnosticsUpdated', (diagnostics) => {
    if (!lspStatusEl || currentLspStatus !== 'ready') return;
    if (diagnostics.length === 0) {
      lspStatusEl.textContent = '● Tinymist LSP';
      lspStatusEl.title = 'Language Server Tinymist activo (documento correcto)';
      lspStatusEl.setAttribute('data-status', 'ready');
    } else {
      const errCount = diagnostics.filter((d) => d.severity === 'error').length;
      const warnCount = diagnostics.length - errCount;
      const parts = [];
      if (errCount > 0) parts.push(`${errCount} err`);
      if (warnCount > 0) parts.push(`${warnCount} aviso`);
      lspStatusEl.textContent = `● Tinymist (${parts.join(', ')})`;
      lspStatusEl.title = `Tinymist activo — ${diagnostics.length} problema(s) detectado(s) en el documento`;
      lspStatusEl.setAttribute('data-status', errCount > 0 ? 'error' : 'starting');
    }
  });

  // Exportación PNG (Beta, §7.12) — alcance de este slice: solo la página que
  // se está leyendo ahora en la vista previa, no rango ni documento completo.
  el('btn-export-png').addEventListener('click', async () => {
    const page = preview.getCurrentPage();
    const picked = await pickSaveTarget(workspace.suggestedPngName(page), 'PNG', ['png']);
    if (picked.ok && picked.value) await workspace.exportPng(picked.value, page);
  });

  // Alcance (RF-14) y refresco (RF-15). El botón "Refrescar" solo existe en modo
  // manual: en automático no tendría nada que hacer que la pausa no haga ya.
  const scopeButton = el('btn-preview-scope');
  const refreshModeButton = el('btn-preview-refresh-mode');
  const refreshButton = el('btn-preview-refresh');

  function refreshPreviewControls() {
    const scope = workspace.getPreviewScope();
    const canUseRoot = workspace.hasRootDocument();
    scopeButton.textContent = t(scope === 'file' || !canUseRoot ? 'preview.scopeFile' : 'preview.scopeDocument');
    // Un `.typ` suelto no tiene documento raíz distinto: el conmutador sobra.
    scopeButton.classList.toggle('hidden', !canUseRoot);

    const mode = preview.getRefreshMode();
    refreshModeButton.textContent = t(mode === 'manual' ? 'preview.refreshManual' : 'preview.refreshAuto');
    refreshButton.classList.toggle('hidden', mode !== 'manual');
  }

  scopeButton.addEventListener('click', () => {
    workspace.setPreviewScope(workspace.getPreviewScope() === 'document' ? 'file' : 'document');
    refreshPreviewControls();
    lastTargetDocument = workspace.getCompileTarget()?.document ?? null;
    preview.restart();
    outline.restart();
  });
  refreshModeButton.addEventListener('click', () => {
    preview.toggleRefreshMode();
    refreshPreviewControls();
  });
  refreshButton.addEventListener('click', () => preview.refreshNow());
  refreshPreviewControls();

  // ── Sincronización editor ↔ vista previa (RF-16) ──────────────────────────
  // Doble clic en el render: se resuelve el ancla y se lleva el cursor al
  // fuente, abriendo el capítulo que corresponda si no es el que está delante.
  // Typst no da la posición de origen (ADR-SYNC-001), así que esto se apoya en
  // las anclas sembradas por `shadow.rs`.
  el('preview-pages').addEventListener('dblclick', async (event) => {
    const source = await preview.sourceAt(event.clientX, event.clientY);
    if (!source) {
      toast.show(t('sync.notFound'));
      return;
    }
    await workspace.goToSource(source.file, source.line);
  });

  // Dirección contraria, como acción explícita: seguir el cursor de forma
  // continua obligaría a recalcular la tabla de anclas sin parar.
  async function syncPreviewToCursor() {
    const cursor = workspace.getCursorSource();
    if (!cursor) return;
    const found = await preview.scrollToSource(cursor.file, cursor.line);
    if (!found) toast.show(t('sync.notFound'));
  }
  el('btn-sync-preview').addEventListener('click', syncPreviewToCursor);

  el('btn-zoom-in').addEventListener('click', preview.zoomIn);
  el('btn-zoom-out').addEventListener('click', preview.zoomOut);
  el('btn-zoom-reset').addEventListener('click', preview.zoomReset);
  const btnZoomFit = el('btn-zoom-fit');
  btnZoomFit.setAttribute('aria-pressed', String(preview.isFitWidth()));
  btnZoomFit.classList.toggle('active', preview.isFitWidth());
  btnZoomFit.addEventListener('click', () => {
    const active = preview.toggleFitWidth();
    btnZoomFit.classList.toggle('active', active);
    btnZoomFit.setAttribute('aria-pressed', String(active));
  });

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
    templateGallery.refreshLanguage();
    workspace.renderDocumentBar();
    preview.refreshStatus();
    refreshPreviewControls();
    alwaysOnTop.refreshLanguage();
  });

  await Promise.all([renderAbout(), launcher.load()]);

  // Doble clic sobre un `.typ` en el explorador del SO (asociación de fichero,
  // RF-12): se abre ese documento en vez del lanzador.
  const startup = await getStartupDocument();
  if (startup.ok && startup.value) await openPath(startup.value);

  // Chincheta de ventana encima (RF-28), portada de DBV Markdown Reader. La
  // ventana se inyecta en vez de importarse dentro del módulo para que este se
  // pueda probar sin Tauri.
  const alwaysOnTop = createAlwaysOnTop({
    buttonEl: el('btn-always-on-top'),
    appWindow: getCurrentWindow(),
    onError: (message) => toast.show(`${t('action.alwaysOnTop')}: ${message}`, 'error'),
  });

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
  on('menu-toggle-theme', () => themeSwitcher.cycle());
  on('menu-outline', () => sidebarTabs.showOutline());
  on('menu-terminal', () => el('btn-terminal').click());
}

bootstrap();
