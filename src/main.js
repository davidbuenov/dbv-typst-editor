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

import { createWorkspace, joinPath } from './app/workspace.js';
import { createUpdater } from './app/updater.js';
import { tabShortcutAction } from './app/tabBar.js';
import { PANELS, getPanelState, initPanels, togglePanel } from './app/workspacePanels.js';
import { figureActionForPath, jogsAction } from './editor/toolbarActions.js';
import { clampEditorFontSize, EDITOR_FONT_DEFAULT, stepEditorFontSize } from './editor/fontSize.js';
import { decideImageDrop, pathsWithExtension } from './app/dropTarget.js';
import { relativeToRoot } from './app/paths.js';
import { pickImageFromClipboard, readFileAsBase64 } from './app/clipboardImage.js';
import { applyTranslations, getLanguage, setLanguage, t } from './i18n/i18n.js';
import { createHelp } from './help/help.js';
import { setHelpTrigger } from './help/helpTrigger.js';
import { createUniversePanel } from './universe/universePanel.js';
import { getCuratedUniverseTemplatesCatalog } from './universe/universeThumbnails.js';
import { importPackageAction } from './universe/universeSpec.js';
import { createAlwaysOnTop } from './app/alwaysOnTop.js';
import { createLauncher } from './launcher/launcher.js';
import { createTemplateGalleryModal } from './launcher/templateGalleryModal.js';
import { createOutline } from './outline/outline.js';
import { createEngineNotice } from './preview/engineNotice.js';
import { closeAllPanels, registerPanel } from './panels/registerPanel.js';
import { createPreview } from './preview/preview.js';
import { createTerminal } from './terminal/terminal.js';
import { createPythonRunnerPanel } from './panels/pythonRunnerPanel.js';
import { createDiffModal } from './editor/diffModal.js';
import { createGitManager } from './app/gitManager.js';
import { createConflictResolver } from './app/conflictResolver.js';
import { hasConflictMarkers } from './app/conflictParser.js';
import { createLspClient } from './editor/lspClient.js';
import { createProjectTree } from './project-explorer/projectTree.js';
import { createFileOperations } from './project-explorer/fileOperations.js';
import { dropTargetDir } from './project-explorer/treeDrag.js';
import { createReferenceUpdater } from './project-explorer/referenceUpdates.js';
import { createChapterDialog, createChapterFlow } from './project-explorer/chapters.js';
import { createHistoryPanel } from './history/historyPanel.js';
import { createWizard } from './project-wizard/wizard.js';
import {
  copyAssetIntoProject,
  copyFontIntoProject,
  engineDiagnostics,
  engineSetMode,
  fileFingerprint,
  fsCopyInto,
  fsCreateDir,
  pickDataFile,
  searchProject,
  snippetsEnsureGlobal,
  snippetsEnsureProject,
  snippetsGlobalPath,
  snippetsImportTarget,
  snippetsPickSublime,
  snippetsProjectFiles,
  snippetsReadSublime,
  snippetsWriteImported,
  gitAdd,
  gitClone,
  getAppInfo,
  savePastedImage,
  openDocumentLink,
  historyClear,
  readFile,
  writeFile,
  isPackagedApp,
  getStartupDocument,
  getSupportedAssetExtensions,
  getTypstVersion,
  importProjectArchive,
  on,
  mcpBridgeConfigure,
  mcpStateReply,
  openUniversePackagePage,
  previewUniverseTemplate,
  pickArchiveFile,
  pickProjectFolder,
  createEmptyDocument,
  pickSaveTarget,
  pickTypstFile,
  docsInfo,
  docsPage,
  docsSearch,
  openExternalUrl,
} from './services/backend.js';
import { createChoiceDialog } from './ui/choiceDialog.js';
import { countProblems, toProblemList } from './editor/diagnosticsModel.js';
import { createProblemsPanel, parseCliDiagnostics } from './problems/problemsPanel.js';
import { createDocsViewer, wordAt } from './docs/docsViewer.js';
import { createCsvViewer } from './data/csvViewer.js';
import { initAi, isAiInlineShortcut } from './ai/entry.js';
import * as backendModule from './services/backend.js';
import { createEditorContextMenu } from './editor/editorContextMenu.js';
import { createNavigation } from './editor/navigation.js';
import { createRefactor } from './editor/refactor.js';
import { createMultiFileEdit } from './app/multiFileEdit.js';
import { createResultsView } from './search/resultsView.js';
import { createProjectSearch, isSearchProjectShortcut } from './search/projectSearch.js';
import { createSnippetLoader } from './snippets/loader.js';
import { addSnippetToText, createSnippetDialog, selectionToBody } from './snippets/saveSelection.js';
import { createPreviewContextMenu } from './preview/previewContextMenu.js';
import { rangeForEditor, rangeForRender } from './preview/syncRange.js';
import { createChangeTracker } from './preview/changeTracker.js';
import { createSplitter } from './ui/splitter.js';
import { createToast } from './ui/toast.js';
import { cycleTheme, getTheme, initTheme, setTheme } from './themes/theme.js';
import { getLastDocumentDir, rememberDocumentPath } from './app/lastDocumentDir.js';
import { createNewDocumentFlow, isNewDocumentShortcut } from './app/newDocument.js';
import { getPref, onPrefsChanged, setPref, togglePref } from './app/prefs.js';
import { initMcpBridge } from './mcp/mcpBridge.js';
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
  const tabs = { files: el('tab-files'), outline: el('tab-outline'), search: el('tab-search'), problems: el('tab-problems') };
  const panels = { files: el('files-panel'), outline: el('outline-panel'), search: el('search-panel'), problems: el('problems-panel') };

  function setActiveTab(name) {
    for (const key of Object.keys(tabs)) {
      tabs[key].classList.toggle('active', key === name);
      panels[key].classList.toggle('hidden', key !== name);
    }
  }

  tabs.files.addEventListener('click', () => setActiveTab('files'));
  tabs.outline.addEventListener('click', () => setActiveTab('outline'));
  tabs.search.addEventListener('click', () => setActiveTab('search'));
  tabs.problems.addEventListener('click', () => setActiveTab('problems'));
  setActiveTab('files');

  /** Pestaña `name` con el panel lateral visible. */
  function show(name) {
    if (!getPanelState().sidebar) {
      togglePanel('sidebar', workspaceEl);
      document.querySelector('.mode-switcher__button[data-panel="sidebar"]')?.setAttribute('aria-pressed', 'true');
    }
    setActiveTab(name);
  }

  return {
    /** Usado por el menú nativo de macOS (`menu-outline`): pestaña + panel visible. */
    showOutline: () => show('outline'),
    /** Referencias (RF-77.3) y búsqueda en el proyecto (RF-78). */
    showSearch: () => show('search'),
    /** Panel de Problemas (RF-97): lo abre la insignia de la barra del documento. */
    showProblems: () => show('problems'),
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
function wireImageDrop(workspace, editorHostEl, notify, getExtensions, isOverTree) {
  async function handleDrop(imagePath, insert) {
    try {
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
    } catch (error) {
      // handleDrop se llama sin `await` desde el oyente de `onDragDropEvent`
      // (no puede ser async): sin este `catch`, un fallo aquí (p. ej. el
      // `FileReader`/IPC de `copyAssetIntoProject`) sería una promesa
      // rechazada sin capturar, silenciosa para el usuario.
      notify(`${t('asset.copyFailed')} — ${error.message}`, 'error');
    }
  }

  getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== 'drop') return;

    const { position, paths } = event.payload;
    // RF-69.6: sobre el árbol, la soltada es para copiar a esa carpeta.
    if (isOverTree(position)) return;
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
 * Pegar una imagen del portapapeles (RF-39).
 *
 * Hermano de `wireImageDrop`, con dos diferencias que obligan a un camino
 * propio: un recorte de pantalla no tiene ruta de fichero (llega en bytes, de
 * ahí `savePastedImage` en vez de `copyAssetIntoProject`), y el criterio de
 * "insertar o solo copiar" no es dónde cayó el puntero sino dónde está el
 * foco — un pegado no tiene coordenadas.
 *
 * El oyente va en `document` y en fase de captura para que un pegado sobre el
 * editor no lo procese antes CodeMirror; se llama a `preventDefault()` solo
 * cuando el portapapeles trae imagen de verdad, así que pegar texto sigue
 * funcionando exactamente igual que antes.
 */
function wireImagePaste(workspace, editorHostEl, notify) {
  async function handlePaste(file, extension, insert) {
    try {
      const base64Data = await readFileAsBase64(file);
      const result = await savePastedImage(workspace.state.project.root, base64Data, extension);
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
    } catch (error) {
      // handlePaste se llama sin `await` desde el oyente de `paste`: sin
      // este `catch`, un fallo del `FileReader` (`readFileAsBase64`) al leer
      // un recorte del portapapeles era una promesa rechazada sin capturar
      // — el pegado parecía no hacer nada, sin ningún aviso al usuario.
      notify(`${t('asset.copyFailed')} — ${error.message}`, 'error');
    }
  }

  document.addEventListener(
    'paste',
    (event) => {
      const image = pickImageFromClipboard(event.clipboardData);
      if (!image) return;

      event.preventDefault();
      if (!workspace.state.project) {
        notify(t('asset.needsProject'), 'error');
        return;
      }

      const insert = Boolean(editorHostEl?.contains(document.activeElement));
      handlePaste(image.file, image.extension, insert);
    },
    true,
  );
}

/**
 * Arrastrar una fuente al proyecto (petición de sesión de uso real): mismo
 * mecanismo que `wireImageDrop`, pero sin insertar nada en el documento — una
 * fuente no se "usa" en el punto donde se suelta, solo queda disponible para
 * `set text(font: "...")` en cualquier parte del proyecto, así que no importa
 * dónde de la ventana caiga ni cuántos ficheros vengan en el mismo soltado.
 */
function wireFontDrop(workspace, notify, getExtensions, isOverTree) {
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

    if (isOverTree(event.payload.position)) return;
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

/**
 * Ayuda bilingüe (contenido en `help/helpContent.js`). Además del botón "?"
 * de la cabecera, registra en `helpTrigger.js` la función que abren los
 * botones "?" de cada asistente (RF-52) — `registerPanel.js` no importa
 * `help.js` directamente para evitar un ciclo de imports.
 */
function wireHelpPanel(docsViewer) {
  const help = createHelp({ contentEl: el('help-content'), navEl: el('help-nav') });
  el('btn-help-docs').addEventListener('click', () => docsViewer.open());
  const { open, close } = registerPanel(el('help-panel'), {
    trigger: el('btn-help'),
    toggle: true,
  });
  el('btn-help-close').addEventListener('click', close);

  setHelpTrigger((sectionId) => {
    open();
    help.scrollToSection(sectionId);
  });
}

/**
 * RF-98: visor de datos CSV/TSV. Se abre desde Herramientas (un fichero
 * cualquiera; si está fuera del proyecto, se ofrece copiarlo a `data/`) y desde
 * el botón «Tabla» de la barra del documento con un `.csv` abierto (con su
 * contenido del editor, aunque no esté guardado).
 */
function wireDataViewer({ workspace, notify, dialog, getLastTyp }) {
  const { open } = registerPanel(el('data-panel'), { toggle: false });
  el('btn-data-close').addEventListener('click', () => el('data-panel').classList.add('hidden'));
  const ids = {
    title: 'data-title', header: 'data-header', delimiter: 'data-delimiter', filter: 'data-filter',
    filterColumn: 'data-filter-column', count: 'data-count', scroller: 'data-scroller', head: 'data-head',
    body: 'data-body', asFigure: 'data-as-figure', caption: 'data-caption', label: 'data-label',
    insert: 'data-insert', copyStatic: 'data-copy-static',
  };
  const root = () => workspace.state.project?.root ?? null;
  const viewer = createCsvViewer({
    elements: Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, el(id)])),
    show: open,
    getTargetTyp: () => {
      const typ = getLastTyp();
      return typ && root() ? relativeToRoot(root(), typ) : null;
    },
    insertIntoDocument: async (code) => {
      const typ = getLastTyp();
      if (!typ || !(await workspace.openDocument(typ))) return false;
      const view = workspace.getEditorView();
      if (!view) return false;
      view.dispatch(view.state.replaceSelection(code), { scrollIntoView: true, userEvent: 'input' });
      view.focus();
      return true;
    },
    copy: (text) => navigator.clipboard.writeText(text),
    notify,
  });

  async function openPath(path) {
    const projectRoot = root();
    let target = path;
    let relative = projectRoot ? relativeToRoot(projectRoot, path) : null;
    if (projectRoot && !relative) {
      const choice = await dialog.ask({
        titleKey: 'data.copyTitle',
        textKey: 'data.copyIntoProject',
        choices: [
          { key: 'view', labelKey: 'data.viewOnly' },
          { key: 'copy', labelKey: 'data.copyAction', tone: 'primary' },
        ],
      });
      if (choice === 'copy') {
        await fsCreateDir(projectRoot, projectRoot, 'data');
        const copied = await fsCopyInto(projectRoot, [path], joinPath(projectRoot, 'data'));
        if (copied.ok && copied.value[0]) {
          target = copied.value[0];
          relative = relativeToRoot(projectRoot, target);
        } else if (!copied.ok) notify(`${t('data.readError')} — ${copied.error.message}`, 'error');
      }
    }
    const read = await readFile(target);
    if (!read.ok) {
      notify(`${t('data.readError')} — ${read.error.message}`, 'error');
      return;
    }
    viewer.open({ text: read.value.content, path: target, relative });
  }

  el('btn-tools-data').addEventListener('click', async () => {
    const picked = await pickDataFile();
    if (picked.ok && picked.value) await openPath(picked.value);
  });
  el('btn-doc-table').addEventListener('click', () => {
    const path = workspace.getDocumentPath();
    if (!path) return;
    viewer.open({ text: workspace.getTabContent(path) ?? '', path, relative: root() ? relativeToRoot(root(), path) : null });
  });
  return viewer;
}

/** RF-96.6: visor de la documentación de Typst sin conexión. */
function wireDocsPanel() {
  const { open, close } = registerPanel(el('docs-panel'), { toggle: false });
  el('btn-docs-close').addEventListener('click', close);
  return createDocsViewer({
    elements: {
      panel: el('docs-panel'),
      title: el('docs-title'),
      input: el('docs-query'),
      results: el('docs-results'),
      content: el('docs-content'),
      back: el('docs-back'),
    },
    backend: { docsSearch, docsPage, docsInfo, openExternalUrl },
    show: open,
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
  wireLanguageSwitcher();
  wireAboutPanel();
  const docsViewer = wireDocsPanel();
  wireHelpPanel(docsViewer);

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

  const conflictResolver = createConflictResolver({
    dialogEl: el('conflict-dialog'),
    titleEl: el('conflict-dialog-title'),
    blocksEl: el('conflict-blocks'),
    hintEl: el('conflict-progress'),
    applyBtn: el('conflict-apply'),
    cancelBtn: el('conflict-cancel'),
  });

  const lspStatusEl = el('lsp-status');
  let currentLspStatus = 'offline';
  // Textos de la insignia por estado (issue #2: iban escritos en español
  // incluso con la interfaz en inglés).
  const LSP_BADGE = {
    ready: ['lsp.badgeReady', 'lsp.titleReady'],
    idle: ['lsp.badgeIdle', 'lsp.titleIdle'],
    starting: ['lsp.badgeStarting', 'lsp.titleStarting'],
    error: ['lsp.badgeError', 'lsp.titleError'],
  };
  const updateLspStatus = (status) => {
    if (!lspStatusEl) return;
    currentLspStatus = status;
    if (status === 'offline') {
      lspStatusEl.classList.add('hidden');
      return;
    }
    lspStatusEl.classList.remove('hidden');
    lspStatusEl.setAttribute('data-status', status);
    const keys = LSP_BADGE[status];
    if (keys) {
      lspStatusEl.textContent = t(keys[0]);
      lspStatusEl.title = t(keys[1]);
    }
  };
  document.addEventListener('dbv-lang-changed', () => updateLspStatus(currentLspStatus));

  lspStatusEl?.addEventListener('click', () => {
    if (currentLspStatus === 'idle') {
      lspClient.enable();
    } else if (currentLspStatus === 'ready') {
      lspClient.disable();
      toast.show(t('lsp.disabledToast'));
    } else if (currentLspStatus === 'starting') {
      toast.show(t('lsp.startingToast'), 'info');
    } else if (currentLspStatus === 'error') {
      toast.show(t('lsp.errorToast'), 'error');
    }
  });

  const lspClient = createLspClient({
    notify: toast.show,
    onStatusChange: updateLspStatus,
  });

  // El árbol y sus operaciones se necesitan mutuamente: los callbacks se
  // enlazan tarde, cuando `fileOps` ya existe (se crea tras el workspace).
  let fileOps = null;
  const tree = createProjectTree(el('project-tree'), {
    onOpenFile: (path) => workspace.openDocument(path),
    onSetEntrypoint: (path) => applyEntrypoint(path),
    onCommitName: (request) => fileOps.commitName(request),
    onAction: (action, context) => fileOps.handleAction(action, context),
    onMove: (paths, destDir) => fileOps.move(paths, destDir),
    features: { chapter: true, history: true },
  });

  // Cabecera del panel Archivos (RF-69.1): nuevo fichero, nueva carpeta y
  // refrescar, en la carpeta de la selección. Sustituye al "+" de RF-33, que
  // solo creaba `.typ` en la raíz.
  el('tree-new-file').addEventListener('click', () => tree.startCreate('file'));
  el('tree-new-folder').addEventListener('click', () => tree.startCreate('dir'));
  el('tree-refresh').addEventListener('click', () => tree.refresh());

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
      // El editor de diagramas busca sus propios controles dentro del panel
      // por `data-diagram`, así que aquí basta con el panel.
      diagramPanel: el('diagram-panel'),
      equationPanel: el('equation-panel'),
      sequencePanel: el('sequence-panel'),
      ganttPanel: el('gantt-panel'),
      kanbanPanel: el('kanban-panel'),
      dotPanel: el('dot-panel'),
      documentTabs: el('document-tabs'),
      documentPath: el('document-path'),
      documentLanguage: el('document-language'),
      formatButton: el('btn-format-doc'),
      projectName: el('project-name'),
      projectKind: el('project-kind'),
      projectActions: el('project-actions'),
      workspaceView: el('workspace-view'),
      emptyView: el('empty-view'),
      universeButton: el('btn-universe'),
      // RF-43: Guardar/Guardar como/Exportar PDF/Exportar PNG se unen aquí al
      // moverse del `.document__bar` (siempre habilitado mientras hubiera un
      // documento cargado, sin comprobación propia) al menú Archivo (visible
      // incluso sin proyecto abierto, desde el lanzador) — sin esto, pulsarlos
      // en el estado "Sin proyecto" no tendría documento sobre el que actuar.
      projectMenuItems: [
        el('btn-save'),
        el('btn-save-as'),
        el('btn-set-entrypoint'),
        el('btn-new-chapter'),
        el('btn-export-pdf'),
        el('btn-export-png'),
        el('btn-export-archive'),
        el('btn-reveal'),
        el('btn-close-project'),
      ],
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
    onResolveConflict: async (relativePath) => {
      const root = workspace.state.project?.root;
      if (!root) return;
      const target = joinPath(root, relativePath);

      const read = await readFile(target);
      if (!read.ok) {
        toast.show(`${t('doc.openError')} — ${read.error.message}`, 'error');
        return;
      }
      if (!hasConflictMarkers(read.value.content)) {
        // Se resolvió por otra vía (editado a mano, git add manual…) entre
        // el refresco del popover y el clic: no hay nada que mostrar.
        gitManager.refresh();
        return;
      }

      const result = await conflictResolver.open({ fileName: relativePath, content: read.value.content });
      if (result.action !== 'apply') return;

      const written = await writeFile(target, result.content);
      if (!written.ok) {
        toast.show(`${t('tree.newFileError')} — ${written.error.message}`, 'error');
        return;
      }

      // Sin esto, git status sigue reportando el fichero como "en conflicto"
      // (viene del índice, no del árbol de trabajo) hasta el próximo commit
      // -- el popover no reflejaría que ya se ha resuelto. Best-effort: si
      // falla, el commit posterior lo arregla igual con su propio `add -A`.
      await gitAdd({ projectPath: root, relativePath });

      toast.show(t('git.conflictResolved'));
      await gitManager.refresh();
      // Si el fichero resuelto es el que está abierto en el editor, refleja
      // el resultado ahí también — si no, no lo abre solo, sería sorprender
      // al usuario con un cambio de documento que no pidió.
      if (workspace.state.document?.path === target) {
        await workspace.openDocument(target, { force: true });
      }
    },
  });
  el('git-popover-close').addEventListener('click', gitManager.close);

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

  const referenceUpdater = createReferenceUpdater({ tree, workspace, dialog, notify: toast.show });
  const chapterFlow = createChapterFlow({
    tree,
    workspace,
    notify: toast.show,
    dialog: createChapterDialog({
      dialogEl: el('chapter-dialog'),
      formEl: el('chapter-form'),
      headingEl: el('chapter-heading'),
      fileEl: el('chapter-file'),
      folderEl: el('chapter-folder'),
      errorEl: el('chapter-error'),
      cancelEl: el('chapter-cancel'),
    }),
  });
  el('btn-new-chapter').addEventListener('click', () => chapterFlow.newChapter());
  const historyPanel = createHistoryPanel({
    dialogEl: el('history-dialog'),
    fileEl: el('history-file'),
    listEl: el('history-list'),
    closeEl: el('history-close'),
    diffModal,
    workspace,
    notify: toast.show,
  });
  const showHistory = (path) => {
    if (!getPref('localHistory')) {
      toast.show(t('history.disabled'));
      return;
    }
    historyPanel.open(path);
  };
  el('pref-clear-history').addEventListener('click', async () => {
    const choice = await dialog.ask({
      titleKey: 'history.clearTitle',
      textKey: 'history.clearText',
      choices: [
        { key: 'cancel', labelKey: 'action.cancel' },
        { key: 'clear', labelKey: 'prefs.clearHistory', tone: 'danger' },
      ],
    });
    if (choice !== 'clear') return;
    const cleared = await historyClear();
    toast.show(cleared.ok ? t('history.cleared') : `${t('history.readError')} — ${cleared.error.message}`, cleared.ok ? 'info' : 'error');
  });
  fileOps = createFileOperations({
    tree,
    workspace,
    dialog,
    notify: toast.show,
    afterMove: (moved) => referenceUpdater.afterMove(moved),
    onNewChapter: (context) => chapterFlow.newChapter({ dirPath: context.dirPath }),
    onHistory: (entry) => showHistory(entry.path),
  });

  // Punto de una soltada nativa (píxeles físicos) → ¿cae sobre el árbol?
  const treeDropPoint = (position) => {
    const ratio = window.devicePixelRatio || 1;
    return { x: position.x / ratio, y: position.y / ratio };
  };
  const isOverTree = (position) => {
    if (!position || !workspace.state.project) return false;
    const { x, y } = treeDropPoint(position);
    return tree.containsPoint(x, y);
  };
  // RF-69.6: ficheros del sistema soltados sobre una carpeta del árbol se
  // copian allí (cualquier tipo, sin sobrescribir).
  getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type !== 'drop' || !isOverTree(event.payload.position)) return;
    const { x, y } = treeDropPoint(event.payload.position);
    const destDir = dropTargetDir(tree.entryAtPoint(x, y), tree.getRoot());
    fileOps.copyFromSystem(event.payload.paths, destDir);
  });

  wireImageDrop(workspace, el('editor-host'), toast.show, getAssetExtensions, isOverTree);
  wireImagePaste(workspace, el('editor-host'), toast.show);
  wireFontDrop(workspace, toast.show, getAssetExtensions, isOverTree);

  const staleEl = el('preview-stale');
  // Aviso «motor clásico» (RF-87.4): el camino de vuelta al motor rápido.
  const engineNotice = createEngineNotice({
    button: el('btn-engine-retry'),
    setMode: engineSetMode,
    restart: () => preview.restart(),
  });
  // Problemas de la compilación (RF-59, RF-97): subrayado en el editor, chip con
  // el recuento y panel de Problemas en la barra lateral. Con el motor en
  // proceso llegan con rango; con el clásico, se extraen del texto del CLI.
  const problemsChip = el('problems-chip');
  const problemsPanel = createProblemsPanel({
    elements: {
      list: el('problems-list'),
      errors: el('problems-errors'),
      warnings: el('problems-warnings'),
      onlyActive: el('problems-active'),
      summary: el('problems-summary'),
    },
    goTo: (file, line) => workspace.goToSource(file, line),
    getActiveFile: () => {
      const root = workspace.state.project?.root;
      const path = workspace.getDocumentPath();
      return root && path ? relativeToRoot(root, path) : null;
    },
    getLine: async (file, line) => {
      const root = workspace.state.project?.root;
      if (!root) return null;
      const path = joinPath(root, file);
      const content = workspace.getTabContent(path) ?? (await readFile(path).then((r) => (r.ok ? r.value.content : null)));
      return content?.split(/\r?\n/)[line - 1] ?? null;
    },
    onShowDocs: (problem) => docsViewer.open({ query: problem.message }),
  });
  async function refreshProblems(result) {
    let list = [];
    if (!result.ok || result.engine === 'inproc') {
      const report = await engineDiagnostics();
      list = report.ok ? report.value.diagnostics : [];
    }
    workspace.setEngineDiagnostics(list);
    let problems = toProblemList(list);
    // Motor clásico (RF-97.4): los mensajes del CLI, con fichero y línea si los trae.
    if (!list.length && (result.engine === 'classic' || !result.ok)) {
      problems = parseCliDiagnostics(result.ok ? result.warnings : result.error?.message);
    }
    problemsPanel.setProblems(problems);
    const { errors, warnings } = countProblems(problems);
    problemsChip.classList.toggle('hidden', problems.length === 0);
    problemsChip.dataset.status = errors > 0 ? 'error' : 'starting';
    problemsChip.textContent = `${errors > 0 ? '✖ ' + errors : ''}${errors > 0 && warnings > 0 ? ' · ' : ''}${warnings > 0 ? '⚠ ' + warnings : ''}`;
  }
  problemsChip.addEventListener('click', () => sidebarTabs.showProblems());
  // Posiciones del texto compilado ↔ texto actual del editor (RF-57.5).
  const tracker = createChangeTracker();
  // RF-78.3: los resultados de la búsqueda en el proyecto se recalculan al editar.
  let projectSearch = null;
  /** RF-81.7: se define más abajo, junto al diálogo. */
  let saveSelectionAsSnippet = null;
  workspace.setListener('editorChanges', (changes) => {
    tracker.record(changes);
    projectSearch?.refreshSoon();
  });
  // Outline (ARCHITECTURE.md §7.8, RF-89): sigue a cada compilación de la vista
  // previa (`onCompiled`), así que no tiene ganchos propios en el workspace. Se
  // crea antes que la vista previa, que es quien lo alimenta.
  const outline = createOutline({
    listEl: el('outline-list'),
    onNavigate: (entry) => preview.scrollToPage(entry.page, entry.yPt),
    getTarget: () => workspace.getCompileTarget(),
  });
  const preview = createPreview({
    findElements: {
      bar: el('preview-find'),
      input: el('preview-find-input'),
      count: el('preview-find-count'),
      caseToggle: el('preview-find-case'),
      prev: el('preview-find-prev'),
      next: el('preview-find-next'),
      close: el('preview-find-close'),
    },
    pagesEl: el('preview-pages'),
    bandEl: el('preview-band'),
    bandSplitterEl: el('splitter-band'),
    statusEl: el('preview-status'),
    zoomLabelEl: el('preview-zoom-label'),
    getTarget: () => workspace.getCompileTarget(),
    // RF-72: enlace externo pulsado en la vista previa.
    onOpenLink: async (url) => {
      const opened = await openDocumentLink(url);
      if (!opened.ok) toast.show(`${t('preview.linkError')} — ${opened.error.message}`, 'error');
    },
    onStaleChange: (stale) => staleEl.classList.toggle('hidden', !stale),
    onCompileStart: () => {
      outline.onCompileStart();
      return tracker.start(workspace.getCursorSource()?.docLength ?? 0);
    },
    onRendered: (id) => tracker.rendered(id),
    onCompiled: (result) => {
      if (result.ok && Array.isArray(result.outline)) lastOutline = result.outline;
      refreshProblems(result);
      outline.onCompiled(result);
      engineNotice.onCompiled(result);
      if (result.ok && result.fallbackReason) {
        toast.show(t('preview.engineFallback').replace('{reason}', result.fallbackReason), 'error');
      }
    },
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

  let lastTargetDocument = null;
  /** RF-94: esquema de la última compilación (herramienta `get_outline`). */
  let lastOutline = [];
  /** Versión de Typst vendorizada (instrucciones del asistente, RF-94.6). */
  let typstVersionText = '0.15.1';
  getTypstVersion().then((result) => {
    const match = result.ok ? String(result.value).match(/\d+\.\d+\.\d+/) : null;
    if (match) typstVersionText = match[0];
  });
  /** IA integrada (v0.13.0); se crea más abajo, cuando existen sus dependencias. */
  let ai = null;
  /** RF-117: estado del editor para agentes MCP; se crea más abajo, con el resto de la IA. */
  let mcpBridge = null;
  /** El backend completo para la IA: lo usa `ai/aiApp.js`, que se carga bajo demanda. */
  const aiBackend = backendModule;
  /** RF-98: último `.typ` abierto, destino de «Insertar como tabla». */
  let lastTypPath = null;

  // El bucle de vista previa se engancha al workspace en vez de vivir dentro de
  // él: el workspace sabe qué documento está abierto, no cómo se compila.
  // Solo se reinicia la vista previa y el outline si el documento objetivo ha
  // cambiado (RF-14). En modo 'document', abrir otro capítulo no cambia el
  // documento raíz compilado (main.typ): reiniciar aquí reseteaba el scroll a
  // la página 1 y rompía la experiencia del doble clic (RF-16).
  workspace.setListener('documentOpened', () => {
    // RF-98: último `.typ` activo (destino de «Insertar como tabla») y botón
    // «Tabla» con un CSV/TSV abierto.
    const openedPath = workspace.getDocumentPath() ?? '';
    if (/\.typ$/i.test(openedPath)) lastTypPath = openedPath;
    el('btn-doc-table').classList.toggle('hidden', !/\.(csv|tsv)$/i.test(openedPath));
    // Las posiciones de la compilación anterior no valen para otro documento.
    tracker.reset();
    refreshPreviewControls();
    const target = workspace.getCompileTarget();
    const targetDoc = target?.document ?? null;
    if (targetDoc !== lastTargetDocument) {
      lastTargetDocument = targetDoc;
      outline.clear();
      preview.restart();
    }
  });
  // Abrir un fichero acompañante (`.bib`, `.toml`) no cambia el documento
  // objetivo, pero sí puede cambiar el render: un `.bib` editado en vivo afecta
  // a la bibliografía, así que se recompila igual que con cualquier cambio.
  workspace.setListener('documentDetached', () => preview.onContentChanged());
  workspace.setListener('documentChanged', () => preview.onContentChanged());
  // Fichero de código o datos sin guardar (RF-60.4): el motor en proceso lo lee
  // de memoria, así que se recompila sin esperar a guardarlo.
  workspace.setListener('companionChanged', () => preview.onContentChanged());
  // RF-81: snippets de usuario. Se recargan al guardarlos, cuando el
  // observador avisa de un cambio en `.vscode` y (el global) al volver el foco.
  const snippetLoader = createSnippetLoader({
    backend: { readFile, snippetsGlobalPath, snippetsProjectFiles },
    notify: toast.show,
    t,
  });
  snippetLoader.loadGlobal();
  window.addEventListener('focus', () => snippetLoader.loadGlobal());
  workspace.setListener('projectOpened', (project) => {
    ai?.onProjectOpened(project);
    mcpBridge?.configure();
    snippetLoader.loadProject(project.isSingleFile ? null : project.root);
    // Cada proyecto empieza con el motor rápido, aunque el anterior lo desactivara.
    engineSetMode('inproc');
  });

  workspace.setListener('projectClosed', () => {
    ai?.onProjectClosed();
    mcpBridge?.configure();
  });

  workspace.setListener('externalChange', (change) => {
    if (!change.isActiveDocument) preview.onExternalChange();
    gitManager.refresh();
    snippetLoader.handleChanged(change.path);
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
      // El propio botón está dentro de `#tools-menu` (RF-32) y frena la
      // propagación de su clic para poder alternarse a sí mismo, así que el
      // cierre del desplegable no puede depender de ese burbujeo — se cierra
      // aquí, explícitamente, al abrirse el panel que reemplaza su contenido.
      toolsMenu.close();
      const hint = workspace.state.project
        ? workspace.state.project.root
        : t('terminal.hint');
      el('terminal-panel').querySelector('.terminal__hint').textContent = hint;
      terminal.focusInput();
    },
  });
  el('terminal-close').addEventListener('click', terminalPanel.close);
  el('terminal-clear').addEventListener('click', terminal.clear);

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
      toolsMenu.close(); // ver comentario equivalente en terminalPanel arriba
      const hint = workspace.state.project
        ? workspace.state.project.root
        : t('python.hint');
      el('python-panel').querySelector('.terminal__hint').textContent = hint;
      pythonRunner.refreshStatus();
      pythonRunner.focus();
    },
  });
  el('python-close').addEventListener('click', pythonPanel.close);

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
    specSearchInputEl: el('template-gallery-spec-search'),
    specSearchResultsEl: el('template-gallery-spec-search-results'),
    specSearchStatusEl: el('template-gallery-spec-search-status'),
    onPreviewSpec: (spec) => previewUniverseTemplate(spec),
    zoomEl: el('template-gallery-zoom'),
    zoomContentEl: el('template-gallery-zoom-content'),
    zoomCloseEl: el('template-gallery-zoom-close'),
  });

  el('template-gallery-close-x')?.addEventListener('click', () => templateGallery.close());
  // Archivo › Nuevo proyecto en blanco: lo mismo que «Usar plantilla» sobre
  // «Proyecto en blanco» en la galería, sin pasar por ella.
  el('btn-new-blank-project').addEventListener('click', async () => {
    const blank = await launcher.getBlankTemplate();
    if (!blank) {
      toast.show(t('action.newBlankProjectUnavailable'), 'error');
      return;
    }
    wizard.open(blank);
  });
  // Herramientas › «Aplicar plantilla…» (RF-116): la MISMA galería, en modo «aplicar» sobre el documento abierto.
  el('btn-apply-template')?.addEventListener('click', () => {
    if (!workspace.state.project) {
      toast.show(t('ai.applyTemplateNoProject'));
      return;
    }
    if (!workspace.getCompileTarget()) {
      toast.show(t('ai.applyTemplateNoMain'));
      return;
    }
    templateGallery.openForApply(getFullGalleryCatalog(), (template) => {
      const id = template.universeSpec || template.id;
      if (id) ai.applyTemplate({ id, description: template.description ?? '' });
    });
  });
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
    searchInputEl: el('universe-search'),
    searchResultsEl: el('universe-search-results'),
    searchStatusEl: el('universe-search-status'),
    tabPackagesEl: el('universe-tab-packages'),
    tabSearchEl: el('universe-tab-search'),
    viewPackagesEl: el('universe-view-packages'),
    viewSearchEl: el('universe-view-search'),
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
    // El buscador del catálogo completo (RF-34) mezcla paquetes y plantillas
    // en la misma lista de Typst Universe — casi la mitad son plantillas. Una
    // plantilla no se importa, se CREA (`typst init`), así que "Usar" sobre
    // una de ellas no toca el documento abierto: cierra este panel y abre la
    // Galería en la pestaña "Dirección" con el identificador ya puesto,
    // listo para "Descargar y previsualizar" (hallazgo del usuario,
    // 2026-09-12 — antes se insertaba como `#import`, que no es cómo se usa).
    onUseTemplate: (spec) => {
      universePanel.close();
      toast.show(`${t('universe.templateRedirected')} ${spec}`);
      templateGallery.openWithSpec(spec, getFullGalleryCatalog());
    },
    onViewPackage: async (spec) => {
      const result = await openUniversePackagePage(spec);
      if (!result.ok) toast.show(t('universe.viewOnlineFailed'), 'error');
    },
  });

  const launcher = createLauncher({
    recentEl: el('recent-list'),
    recentToggleEl: el('btn-recent-toggle'),
    onOpenRecent: openPath,
  });

  const openFolder = async () => {
    const picked = await pickProjectFolder();
    if (picked.ok && picked.value) await openPath(picked.value);
  };

  const openFile = async () => {
    const picked = await pickTypstFile(getLastDocumentDir());
    if (picked.ok && picked.value) {
      rememberDocumentPath(picked.value);
      await openPath(picked.value);
    }
  };

  // «Nuevo .typ vacío…» (RF-106): el flujo vive en `app/newDocument.js` para poder probarlo.
  const newDocument = createNewDocumentFlow({ pickSaveTarget, createEmptyDocument, openPath, getLastDocumentDir, rememberDocumentPath, notify: toast.show, t });

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

  // Clonar repositorio por URL (RF-33): funciona con cualquier remoto Git, no
  // solo GitHub — mismo alcance que RF-19 (§5e.1). La carpeta destino se pide
  // con el mismo diálogo nativo que ya usa `importArchive`, en vez de
  // construir un selector de carpeta propio.
  const cloneError = el('clone-error');
  const showCloneError = (message) => {
    cloneError.textContent = message;
    cloneError.classList.remove('hidden');
  };
  const clonePanel = registerPanel(el('clone-panel'), {
    trigger: [el('btn-clone-repo'), el('btn-tools-clone-repo')],
    toggle: true,
    onOpen: () => {
      toolsMenu.close(); // ver comentario equivalente en terminalPanel arriba
      cloneError.classList.add('hidden');
      el('clone-url').value = '';
      el('clone-url').focus();
    },
  });
  el('btn-clone-close').addEventListener('click', clonePanel.close);
  el('clone-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const url = el('clone-url').value.trim();
    if (!url) {
      showCloneError(t('clone.invalidUrl'));
      return;
    }

    const destination = await pickProjectFolder();
    if (!destination.ok || !destination.value) return;

    cloneError.classList.add('hidden');
    toast.show(t('clone.working'));
    const cloned = await gitClone({ url, parentDir: destination.value });
    if (!cloned.ok || !cloned.value.success) {
      const detail = cloned.ok ? cloned.value.message : cloned.error.message;
      showCloneError(`${t('clone.failed')} — ${detail}`);
      return;
    }
    clonePanel.close();
    await openPath(cloned.value.path);
  });

  // Menú Archivo (RF-30). `registerPanel` ya cierra al pulsar fuera y con
  // Escape; aquí solo falta cerrarlo al elegir algo, porque si no el menú se
  // queda abierto encima del diálogo del sistema que acaba de abrirse.
  const fileMenu = registerPanel(el('file-menu'), {
    trigger: el('btn-file-menu'),
    toggle: true,
    closeOnOutsideClick: true,
  });
  el('file-menu').addEventListener('click', (event) => {
    if (event.target.closest('.menu-item')) fileMenu.close();
  });

  // Menú Herramientas (RF-32): Terminal, Python y Clonar repositorio dejan de
  // ser botones sueltos en la cabecera. Sus propios paneles (terminalPanel,
  // pythonPanel, clonePanel, más abajo) se registran aparte — este menú solo
  // decide cuándo se cierra ÉL, igual que fileMenu con el suyo.
  const toolsMenu = registerPanel(el('tools-menu'), {
    trigger: el('btn-tools-menu'),
    toggle: true,
    closeOnOutsideClick: true,
  });
  el('tools-menu').addEventListener('click', (event) => {
    if (event.target.closest('.menu-item')) toolsMenu.close();
  });

  // Menú Preferencias (v0.10.0, RF-63/RF-64/RF-65). A diferencia de Archivo y
  // Herramientas, NO se cierra al pulsar una casilla: es habitual querer
  // tocar más de un ajuste seguido. `getPref`/`togglePref`/`onPrefsChanged`
  // viven en `app/prefs.js`; aquí solo se pinta `aria-checked` (el CSS del
  // check cuelga de ese atributo, nunca de una clase aparte).
  registerPanel(el('preferences-menu'), {
    trigger: el('btn-preferences-menu'),
    toggle: true,
    closeOnOutsideClick: true,
  });
  const prefCheckboxes = {
    showHiddenFiles: el('pref-show-hidden'),
    showLineNumbers: el('pref-line-numbers'),
    autoSave: el('pref-auto-save'),
    showFullPath: el('pref-full-path'),
    askBeforeUpdatingRefs: el('pref-ask-refs'),
    localHistory: el('pref-local-history'),
    mcpShareState: el('pref-mcp-share'),
  };
  const renderPrefCheckbox = (key) => {
    prefCheckboxes[key]?.setAttribute('aria-checked', String(getPref(key)));
  };
  for (const key of Object.keys(prefCheckboxes)) {
    renderPrefCheckbox(key);
    prefCheckboxes[key].addEventListener('click', () => togglePref(key));
  }
  onPrefsChanged(({ key }) => renderPrefCheckbox(key));

  // Asistente de inserción jogs (RF-38): inyecta #import + plantilla de
  // eval-js, mismo patrón que el asistente de diagramas CeTZ — no un runner
  // con proceso propio como el de Python (RF-22), porque jogs corre DENTRO
  // de la compilación (ver ADR-JOGS-001 en memory.md).
  // RF-45: misma acción que el icono ✎ de la barra de inserción
  // (`specialHandlers.diagram` en `toolbar.js`), ahora también accesible desde
  // el menú Herramientas — dos vías, un solo editor (RF-31).
  el('btn-tools-diagram').addEventListener('click', () => {
    if (!workspace.state.document) {
      toast.show(t('diagram.needDocument'), 'error');
      return;
    }
    workspace.openDiagramEditor(el('btn-tools-diagram'));
  });

  el('btn-tools-equation').addEventListener('click', () => {
    if (!workspace.state.document) {
      toast.show(t('equation.needDocument'), 'error');
      return;
    }
    workspace.openEquationEditor(el('btn-tools-equation'));
  });

  el('btn-tools-sequence').addEventListener('click', () => {
    if (!workspace.state.document) {
      toast.show(t('sequence.needDocument'), 'error');
      return;
    }
    workspace.openSequenceEditor(el('btn-tools-sequence'));
  });

  el('btn-tools-gantt').addEventListener('click', () => {
    if (!workspace.state.document) {
      toast.show(t('gantt.needDocument'), 'error');
      return;
    }
    workspace.openGanttEditor(el('btn-tools-gantt'));
  });

  const dataViewer = wireDataViewer({ workspace, notify: toast.show, dialog, getLastTyp: () => lastTypPath });

  el('btn-tools-kanban').addEventListener('click', () => {
    if (!workspace.state.document) {
      toast.show(t('kanban.needDocument'), 'error');
      return;
    }
    workspace.openKanbanEditor(el('btn-tools-kanban'));
  });

  el('btn-tools-dot').addEventListener('click', () => {
    if (!workspace.state.document) {
      toast.show(t('dot.needDocument'), 'error');
      return;
    }
    workspace.openDotEditor(el('btn-tools-dot'));
  });

  // RF-81.4: editar los ficheros de snippets en el propio editor.
  async function editSnippets(ensure) {
    const located = await ensure();
    if (!located.ok) {
      toast.show(`${t('snippets.openError')} — ${located.error.message}`, 'error');
      return null;
    }
    await workspace.openDocument(located.value);
    await snippetLoader.handleChanged(located.value);
    return located.value;
  }
  el('btn-snippets-global').addEventListener('click', () => editSnippets(snippetsEnsureGlobal));
  el('btn-snippets-project').addEventListener('click', async () => {
    const project = workspace.state.project;
    if (!project || project.isSingleFile) {
      toast.show(t('snippets.needsProject'), 'error');
      return;
    }
    const path = await editSnippets(() => snippetsEnsureProject(project.root));
    if (path) await tree.refresh();
  });

  // RF-112: importar snippets de Sublime Text. El módulo (conversor y diálogo) se carga al pulsar la entrada.
  const sublimePanel = registerPanel(el('sublime-import-panel'), { toggle: false });
  el('btn-sublime-import-close').addEventListener('click', sublimePanel.close);
  let sublimeDialog = null;
  el('btn-snippets-sublime').addEventListener('click', async () => {
    const { createSublimeImportDialog } = await import('./snippets/sublimeImportDialog.js');
    sublimeDialog ??= createSublimeImportDialog({
      elements: { panel: el('sublime-import-panel'), body: el('sublime-import-body') },
      backend: { snippetsPickSublime, snippetsReadSublime, snippetsImportTarget, snippetsWriteImported },
      t,
      // Con un documento suelto no hay `.vscode/` del proyecto donde compartirlos: solo el destino global.
      getProjectRoot: () => {
        const project = workspace.state.project;
        return project && !project.isSingleFile ? project.root : null;
      },
      close: sublimePanel.close,
      notify: (message, tone) => toast.show(message, tone),
      onImported: async (path, text) => {
        await snippetLoader.handleChanged(path, text);
        await tree.refresh();
      },
    });
    sublimePanel.open();
    sublimeDialog.open();
  });

  // RF-81.7: «Guardar selección como snippet…» (menú contextual del editor).
  const snippetDialog = createSnippetDialog({
    elements: {
      dialog: el('snippet-dialog'),
      form: el('snippet-form'),
      name: el('snippet-name'),
      prefix: el('snippet-prefix'),
      description: el('snippet-description'),
      destination: el('snippet-destination'),
      error: el('snippet-error'),
      cancel: el('snippet-cancel'),
    },
    t,
  });
  saveSelectionAsSnippet = async (view) => {
    const { from, to } = view.state.selection.main;
    if (from === to) return;
    const selected = view.state.sliceDoc(from, to);
    const project = workspace.state.project;
    const hasProject = Boolean(project && !project.isSingleFile);
    const answer = await snippetDialog.open({ hasProject });
    if (!answer) return;
    const located = answer.destination === 'project' && hasProject ? await snippetsEnsureProject(project.root) : await snippetsEnsureGlobal();
    if (!located.ok) {
      toast.show(`${t('snippets.openError')} — ${located.error.message}`, 'error');
      return;
    }
    const path = located.value;
    // Si el fichero está abierto en una pestaña, se edita allí (con sus
    // cambios sin guardar); si no, en disco.
    const inTab = workspace.getTabContent(path);
    let current = inTab;
    if (current === null) {
      const read = await readFile(path);
      current = read.ok ? read.value.content : '';
    }
    const added = addSnippetToText(current, { name: answer.name, prefix: answer.prefix, description: answer.description, body: selectionToBody(selected) });
    if (!added.ok) {
      toast.show(t('snippets.invalidFile'), 'error');
      return;
    }
    if (inTab !== null) {
      workspace.applyBufferEdits([{ from: 0, to: inTab.length, insert: added.text }], path);
    } else {
      const written = await writeFile(path, added.text, 'save');
      if (!written.ok) {
        toast.show(`${t('doc.saveError')} — ${written.error.message}`, 'error');
        return;
      }
    }
    await snippetLoader.handleChanged(path, added.text);
    toast.show(t('snippets.saved').replace('{name}', added.name).replace('{prefix}', answer.prefix));
  };

  el('btn-jogs-insert').addEventListener('click', () => {
    const view = workspace.editor.getView();
    if (!workspace.state.document || !view) {
      toast.show(t('jogs.needDocument'), 'error');
      return;
    }
    view.dispatch(jogsAction()(view.state));
    view.focus();
    toast.show(t('jogs.inserted'));
  });

  el('btn-open-folder').addEventListener('click', openFolder);
  el('btn-empty-open-folder').addEventListener('click', openFolder);
  el('btn-new-document').addEventListener('click', newDocument);
  document.addEventListener('keydown', (event) => {
    if (!isNewDocumentShortcut(event)) return;
    event.preventDefault();
    newDocument();
  });
  el('btn-empty-new-document').addEventListener('click', newDocument);
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
  // RF-64 (R-A3): un guardado automático llega cada pausa de 2 s — recompilar
  // y consultar Git ahí, sin más, sería trabajo duplicado. Con el motor en
  // proceso, el contenido en vivo ya compiló al escribir (`documentChanged`),
  // así que solo el guardado explícito recompila. Git se
  // limita a una consulta cada 5 s como mucho durante el autoguardado.
  let lastAutoSaveGitRefreshMs = 0;
  workspace.setListener('saved', (auto) => {
    const savedPath = workspace.getDocumentPath();
    if (savedPath) snippetLoader.handleChanged(savedPath, workspace.getContent());
    if (!auto) preview.onContentChanged();
    const now = Date.now();
    if (!auto || now - lastAutoSaveGitRefreshMs > 5000) {
      lastAutoSaveGitRefreshMs = now;
      gitManager.refresh();
    }
  });
  el('btn-save').addEventListener('click', () => workspace.save());
  el('btn-save-as').addEventListener('click', () => workspace.saveAs());
  // RF-64.1: "…o el editor" cubre la ventana entera perdiendo el foco (Alt+Tab,
  // clic en otra ventana); el blur DEL EDITOR ya está cableado en `editor.js`.
  window.addEventListener('blur', () => workspace.flushAutoSaveOnBlur());

  // RF-64.6: cerrar la ventana con cambios sin guardar queda protegido
  // SIEMPRE — no es deuda técnica pase lo que pase con el guardado
  // automático (petición explícita del usuario). Reutiliza exactamente la
  // misma decisión que cambiar de fichero (`confirmDiscardChanges`): con el
  // guardado automático encendido guarda y cierra sin preguntar; apagado,
  // pregunta con el diálogo de siempre. Cubre Alt+F4, el botón ✕ y el menú
  // del sistema — todos piden el cierre por esta misma vía en Tauri.
  const appWindow = getCurrentWindow();
  await appWindow.onCloseRequested(async (event) => {
    if (!workspace.hasUnsavedChanges()) return; // se deja cerrar tal cual (RF-79: ninguna pestaña con cambios).
    event.preventDefault();
    if (await workspace.confirmDiscardChanges()) await appWindow.destroy();
  });

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

  // Alcance (RF-14) y refresco (RF-15). El botón "Refrescar" (RF-63.3) es
  // siempre visible — antes solo existía en modo manual, y el amigo del
  // usuario que probó la 0.9.0 lo describió como "escondido". En automático
  // sigue teniendo sentido: fuerza una compilación inmediata en vez de
  // esperar a la pausa de escritura (`preview.refreshNow()` no distingue modo).
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
  }

  // Motor de la vista previa (RF-56): siempre el rápido. El clásico sigue como
  // respaldo AUTOMÁTICO cuando el rápido falla, pero ya no se elige a mano: el
  // conmutador no aportaba nada tras validar el rápido y, en macOS, pasar al
  // clásico a mano acababa en "Operation not permitted (os error 1)" (usuario
  // real). Se olvida la elección guardada por versiones anteriores para que
  // nadie se quede atrapado en el clásico sin botón para salir.
  try {
    localStorage.removeItem('dbv-typst-preview-engine');
  } catch {
    // Sin almacenamiento no había nada guardado.
  }
  // `engine_set_mode` borra además una desactivación de sesión del motor rápido
  // (plazo, pánico): se llama aquí, al abrir cada proyecto y desde el aviso
  // «motor clásico» (`preview/engineNotice.js`).
  engineSetMode('inproc');

  scopeButton.addEventListener('click', () => {
    workspace.setPreviewScope(workspace.getPreviewScope() === 'document' ? 'file' : 'document');
    refreshPreviewControls();
    lastTargetDocument = workspace.getCompileTarget()?.document ?? null;
    outline.clear();
    preview.restart();
  });
  el('btn-set-entrypoint').addEventListener('click', () => applyEntrypoint());

  /** Fija el documento principal (por defecto el abierto) y recompila con él. */
  function applyEntrypoint(path) {
    const entrypoint = workspace.setEntrypoint(path);
    if (!entrypoint) {
      toast.show(t('project.entrypointInvalid'), 'error');
      return;
    }
    toast.show(t('project.entrypointSet').replace('{name}', entrypoint));
    refreshPreviewControls();
    lastTargetDocument = workspace.getCompileTarget()?.document ?? null;
    outline.clear();
    preview.restart();
  }
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
  async function goToSourceAt(clientX, clientY) {
    const source = await preview.sourceAt(clientX, clientY);
    if (!source) {
      toast.show(t('sync.notFound'));
      return;
    }
    // Además de marcar el bloque en el editor (lo hace `goToSource`), se marca
    // en la vista previa cuál fue el bloque resuelto: así se ve si el doble clic
    // cayó donde se esperaba.
    if (source.exact) {
      // Motor en proceso: la palabra exacta, corregida con lo tecleado desde
      // que se compiló (RF-57.5), y marcada también en la vista previa.
      await preview.revealSource(source.file, source.from, source.to, { scroll: false });
      const range = mapToCurrent(source);
      if (range === 'deleted') {
        toast.show(t('sync.deleted'));
        return;
      }
      await workspace.goToSource(source.file, source.line, range);
      return;
    }
    preview.flashAnchor(source);
    await workspace.goToSource(source.file, source.line);
  }
  el('preview-pages').addEventListener('dblclick', (event) => goToSourceAt(event.clientX, event.clientY));
  // Menú contextual (RF-58): lo mismo que el doble clic, para quien no lo conoce.
  createPreviewContextMenu({
    hostEl: el('preview-pages'),
    onGoToSource: goToSourceAt,
    t,
    getLinkAt: (clientX, clientY) => preview.linkAt(clientX, clientY),
    getSelectedText: () => preview.getSelectedText(),
    onCopy: () => preview.copySelection(),
  });

  /** Rango del texto actual del editor que corresponde al de lo compilado. */
  function mapToCurrent(source) {
    return rangeForEditor(tracker, preview.getRenderedStart(), workspace.getCursorSource()?.file ?? null, source);
  }

  // Dirección contraria, como acción explícita: seguir el cursor de forma
  // continua obligaría a recalcular la tabla de anclas sin parar.
  async function syncPreviewToCursor() {
    const cursor = workspace.getCursorSource();
    if (!cursor) return;
    if (preview.getEngine() === 'inproc') {
      // Motor en proceso: la palabra o selección exacta, llevada al texto que se
      // compiló con lo tecleado desde entonces.
      const mapped = rangeForRender(tracker, preview.getRenderedStart(), cursor);
      if (mapped.collapsed) {
        toast.show(t('sync.deleted'));
        return;
      }
      if (await preview.revealSource(cursor.file, mapped.from, mapped.to)) return;
      toast.show(t('sync.notFound'));
      return;
    }
    const found = await preview.scrollToSource(cursor.file, cursor.line);
    if (!found) toast.show(t('sync.notFound'));
  }
  el('btn-sync-preview').addEventListener('click', syncPreviewToCursor);

  // Menú contextual del editor (RF-58): "Ir a la vista previa" + portapapeles.
  // Si el panel de la vista previa está oculto, se muestra antes de saltar.
  async function goToPreviewFromEditor() {
    if (!workspace.getCompileTarget()) {
      toast.show(t('sync.notInDocument'));
      return;
    }
    if (!getPanelState().preview) {
      togglePanel('preview', el('workspace-view'));
      document.querySelector('.mode-switcher__button[data-panel="preview"]')?.setAttribute('aria-pressed', 'true');
    }
    await syncPreviewToCursor();
  }
  // RF-77: ir a la definición y buscar referencias con Tinymist. Las
  // referencias se enseñan en la pestaña «Buscar» de la barra lateral.
  const navigation = createNavigation({ lspClient, workspace, readFile, notify: toast.show, t });
  const searchResults = createResultsView({
    containerEl: el('search-results'),
    onOpen: (path, item) => navigation.openAt({ path, range: item.range }),
  });
  navigation.setReferencesView((result) => {
    searchResults.show(result);
    sidebarTabs.showSearch();
  });
  workspace.setListener('goToDefinition', (view) => navigation.goToDefinition(view));
  workspace.setListener('findReferences', (view) => navigation.findReferences(view));

  // RF-77.4-5 y RF-78.4: edición en varios ficheros con vista previa y Deshacer.
  const multiFileEdit = createMultiFileEdit({ workspace, backend: { readFile, writeFile, fileFingerprint }, dialog, notify: toast.show });
  const refactor = createRefactor({
    lspClient,
    workspace,
    multiFileEdit,
    navigation,
    // R-L4: la ruta de un `#include` se renombra en el árbol (RF-69/RF-70).
    renameFile: async (path) => {
      await tree.revealPath(path);
      tree.startRename(path);
    },
    notify: toast.show,
    t,
  });
  workspace.setListener('renameSymbol', (view) => refactor.renameSymbol(view));
  workspace.setListener('codeActions', (view) => refactor.codeActions(view));

  // v0.13.0: IA integrada y OPCIONAL (RNF-IA.1). `entry.js` solo lee la lista
  // de conexiones; el resto (`ai/aiApp.js`) se importa bajo demanda.
  ai = initAi({
    workspace,
    toast,
    dialog,
    multiFileEdit,
    docsViewer,
    joinPath,
    relativeToRoot,
    registerPanel,
    connectButton: el('btn-ai-connect'),
    elements: {
      panel: el('ai-panel'),
      splitter: el('splitter-ai'),
      toggle: el('btn-ai-panel'),
      appBody: document.querySelector('.app-body'),
      connectPanel: el('ai-connect-panel'),
      connectBody: el('ai-connect-body'),
      connectClose: el('btn-ai-connect-close'),
      templatePanel: el('ai-template-panel'),
      templateBody: el('ai-template-body'),
      templateClose: el('btn-ai-template-close'),
    },
    backend: aiBackend,
    getProblems: () => problemsPanel.getProblems(),
    getOutline: () => lastOutline,
    refreshPreview: () => preview.onContentChanged(),
    capturePreviewPage: () => import('./ai/pageCapture.js').then((module) => module.capturePage(el('preview-pages'))),
    typstVersion: () => typstVersionText,
  });
  if (workspace.state.project) ai.onProjectOpened(workspace.state.project);
  mcpBridge = initMcpBridge({
    backend: { on, mcpBridgeConfigure, mcpStateReply },
    workspace,
    relativeToRoot,
    getProblems: () => problemsPanel.getProblems(),
    getOutline: () => lastOutline,
    isShared: () => getPref('mcpShareState'),
    stopSharing: () => setPref('mcpShareState', false),
    badge: el('mcp-agent-badge'),
    confirmInstall: async (id) =>
      (await dialog.ask({
        titleKey: 'mcp.installTitle',
        textKey: 'mcp.installText',
        text: id,
        choices: [
          { key: 'deny', labelKey: 'mcp.installDeny' },
          { key: 'allow', labelKey: 'mcp.installAllow', tone: 'primary' },
        ],
      })) === 'allow',
    installPackage: (id) => backendModule.aiUniverseInstall(id),
  });
  mcpBridge.configure();
  onPrefsChanged(({ key }) => {
    if (key === 'mcpShareState') mcpBridge.configure();
  });
  createSplitter(el('splitter-ai'), {
    hostEl: document.querySelector('.app-body'),
    cssVariable: '--ai-width',
    storageKey: 'dbv-typst-ai-width',
    measureFrom: 'end',
    min: 280,
    max: (hostWidth) => Math.max(320, hostWidth - 520),
  });

  // RF-78: buscar y reemplazar en todo el proyecto, en la pestaña «Buscar».
  projectSearch = createProjectSearch({
    elements: {
      query: el('search-query'),
      replace: el('search-replace'),
      include: el('search-include'),
      exclude: el('search-exclude'),
      caseSensitive: el('search-case'),
      wholeWord: el('search-word'),
      regex: el('search-regex'),
      replaceAll: el('search-replace-all'),
      error: el('search-error'),
      status: el('search-status'),
    },
    workspace,
    searchProject,
    multiFileEdit,
    resultsView: searchResults,
    openAt: navigation.openAt,
    getPref,
    t,
  });
  document.addEventListener(
    'keydown',
    (event) => {
      if (!isSearchProjectShortcut(event) || !workspace.state.project) return;
      event.preventDefault();
      event.stopPropagation();
      sidebarTabs.showSearch();
      const view = workspace.getEditorView();
      const selection = view && !view.state.selection.main.empty ? view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to) : '';
      projectSearch.focus(selection);
    },
    true,
  );

  createEditorContextMenu({
    onSaveSnippet: (view) => saveSelectionAsSnippet?.(view),
    navigation: {
      canNavigate: () => navigation.unavailableReason() === null,
      goToDefinition: navigation.goToDefinition,
      findReferences: navigation.findReferences,
      renameSymbol: refactor.renameSymbol,
      codeActions: refactor.codeActions,
    },
    hostEl: el('editor-host'),
    getView: () => workspace.getEditorView(),
    canGoToPreview: () => Boolean(workspace.getCompileTarget()),
    onGoToPreview: goToPreviewFromEditor,
    notify: toast.show,
    t,
    canShowHistory: () => Boolean(workspace.getDocumentPath()),
    onShowHistory: () => {
      const path = workspace.getDocumentPath();
      if (path) showHistory(path);
    },
    // RF-96.6: «Ver documentación de `x`» sobre una palabra de un `.typ`.
    getExtraItems: (view) => {
      const items = [];
      const path = workspace.getDocumentPath() ?? '';
      const head = view.state.selection.main.head;
      const line = view.state.doc.lineAt(head);
      if (/\.typ$/i.test(path)) {
        const word = wordAt(line.text, head - line.from);
        if (word) items.push({ id: 'showDocs', label: t('editorMenu.showDocs').replace('{word}', word), run: () => docsViewer.openFor(word) });
      }
      // RF-95, RF-92.3 y RF-97.5: solo con una IA conectada y lista.
      const app = ai?.app;
      if (app && path) {
        items.push({ id: 'aiInline', label: t('editorMenu.aiInline'), run: () => app.inline.open() });
        items.push({ id: 'aiAttach', label: t('editorMenu.aiAttach'), run: () => app.attachFile(path) });
        const root = workspace.state.project?.root;
        const relative = root ? relativeToRoot(root, path) : null;
        const problem = problemsPanel.getProblems().find((p) => p.file === relative && p.line === line.number);
        if (problem) items.push({ id: 'aiExplainFix', label: t('editorMenu.aiExplainFix'), run: () => app.explainAndFix(problem) });
      }
      return items;
    },
  });

  // RF-95.1: Ctrl+Mayús+I (Cmd en macOS) abre la IA en línea sobre la selección.
  el('editor-host').addEventListener('keydown', (event) => {
    if (!isAiInlineShortcut(event)) return;
    const app = ai?.app;
    if (!app) return;
    event.preventDefault();
    event.stopPropagation();
    app.inline.open();
  });
  // RF-97.5 y RF-98.7: acciones de la IA en Problemas y en el visor de datos.
  problemsPanel.setActionProvider(
    (problem) => (ai?.app && problem.level === 'error' ? [{ label: t('problems.explainFix'), run: () => ai.app.explainAndFix(problem), primary: true }] : []),
    (all) => (ai?.app ? { label: t('problems.fixAll').replace('{n}', String(all.filter((p) => p.level === 'error').length)), run: () => ai.app.fixAll(all) } : null),
  );
  ai.onLoaded(() => problemsPanel.refresh());
  el('data-ask-ai').addEventListener('click', () => ai?.app?.askAboutData(dataViewer.getSample()));
  const refreshDataAsk = () => el('data-ask-ai').classList.toggle('hidden', !ai?.app);
  el('btn-tools-data').addEventListener('click', refreshDataAsk);
  el('btn-doc-table').addEventListener('click', refreshDataAsk);

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
    // RF-41: reportado por el usuario — al maximizar la ventana, el separador
    // se quedaba "bloqueado" sin llegar más a la izquierda, con hueco de sobra
    // a la derecha del editor. Causa: 1200 era un tope FIJO en píxeles, ajeno
    // al ancho real de la ventana. Ahora es proporcional al ancho del propio
    // `#workspace-view`: hasta dejar 420px para sidebar+editor+separadores, sin
    // techo absoluto — en una ventana maximizada ancha el usuario puede seguir
    // arrastrando hasta donde el espacio disponible se lo permita de verdad.
    max: (hostWidth) => Math.max(240, hostWidth - 420),
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllPanels();
  });

  // RF-79: Ctrl+W cierra la pestaña y Ctrl+Tab / Ctrl+Mayús+Tab las recorren.
  // En captura y con `preventDefault`, para ganar al WebView (R-T7). En macOS
  // Cmd+W lo atiende el menú nativo («Cerrar pestaña»).
  document.addEventListener(
    'keydown',
    (event) => {
      const action = tabShortcutAction(event);
      if (!action || !workspace.state.project) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === 'close') workspace.closeDocument();
      else workspace.cycleTab(action === 'next' ? 1 : -1);
    },
    true,
  );

  // RF-42: Ctrl++/Ctrl+-/Ctrl+0 y Ctrl+rueda ajustan el tamaño de fuente del
  // editor o el zoom de la vista previa según dónde esté el foco, en vez de
  // caer en el zoom nativo del webview de Tauri (que hasta ahora los
  // capturaba a nivel de sistema, sin que la app se enterara).
  const EDITOR_FONT_STORAGE_KEY = 'dbv-typst-editor-font-size';
  const editorHostEl = el('editor-host');
  const previewPagesEl = el('preview-pages');

  function readEditorFontSize() {
    try {
      const stored = Number(localStorage.getItem(EDITOR_FONT_STORAGE_KEY));
      return Number.isFinite(stored) && stored > 0 ? clampEditorFontSize(stored) : EDITOR_FONT_DEFAULT;
    } catch {
      return EDITOR_FONT_DEFAULT;
    }
  }

  function applyEditorFontSize(px) {
    const clamped = clampEditorFontSize(px);
    // En el propio host, no en `:root`: así un tamaño de fuente pensado para
    // el editor no se filtra a ningún otro sitio que por accidente use la
    // misma variable en el futuro.
    editorHostEl.style.setProperty('--editor-font-size', `${clamped}px`);
    try {
      localStorage.setItem(EDITOR_FONT_STORAGE_KEY, String(clamped));
    } catch {
      // Un WebView que bloquee el almacenamiento no debe impedir cambiar el tamaño.
    }
    return clamped;
  }

  let editorFontSize = readEditorFontSize();
  applyEditorFontSize(editorFontSize);

  function stepEditorFont(direction) {
    editorFontSize = stepEditorFontSize(editorFontSize, direction);
    applyEditorFontSize(editorFontSize);
  }

  function resetEditorFont() {
    editorFontSize = EDITOR_FONT_DEFAULT;
    applyEditorFontSize(editorFontSize);
  }

  // El ratón no necesita "foco" para saber sobre qué panel está: se seguiría
  // con `:hover`, pero Ctrl+rueda también debe funcionar sin haber tocado el
  // panel antes con el ratón, así que se necesita saber igualmente dónde
  // ESTÁ el puntero en el momento del gesto — de ahí este seguimiento propio
  // en vez de depender de CSS.
  let pointerOverPreview = false;
  previewPagesEl.addEventListener('mouseenter', () => {
    pointerOverPreview = true;
  });
  previewPagesEl.addEventListener('mouseleave', () => {
    pointerOverPreview = false;
  });

  function isZoomCombo(event) {
    if (!(event.ctrlKey || event.metaKey)) return false;
    return event.key === '+' || event.key === '=' || event.key === '-' || event.key === '0';
  }

  document.addEventListener('keydown', (event) => {
    if (!isZoomCombo(event)) return;
    // Se intercepta SIEMPRE que la combinación coincide, haya o no un panel
    // reconocible con foco — si no, cuando ninguno de los dos aplica cae en
    // el zoom nativo del sistema, justo lo que RF-42 pide evitar.
    event.preventDefault();

    const inEditor = Boolean(editorHostEl.contains(document.activeElement));
    const direction = event.key === '-' ? -1 : event.key === '0' ? 0 : 1;

    if (inEditor) {
      if (direction === 0) resetEditorFont();
      else stepEditorFont(direction);
    } else if (pointerOverPreview) {
      if (direction === 0) preview.zoomReset();
      else if (direction > 0) preview.zoomIn();
      else preview.zoomOut();
    }
    // Ni el editor ni la vista previa: no hace nada perceptible (criterio 5).
  });

  function wheelDirection(event) {
    // Rueda hacia arriba (deltaY negativo) = acercar, igual que Ctrl++;
    // hacia abajo = alejar, igual que Ctrl+-.
    return event.deltaY < 0 ? 1 : -1;
  }

  editorHostEl.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      stepEditorFont(wheelDirection(event));
    },
    { passive: false }
  );

  previewPagesEl.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (wheelDirection(event) > 0) preview.zoomIn();
      else preview.zoomOut();
    },
    { passive: false }
  );

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
  on('menu-close-tab', () => workspace.closeDocument());
  on('menu-open-folder', openFolder);
  on('menu-new-document', newDocument);
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
