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
import { PANELS, getPanelState, initPanels, togglePanel } from './app/workspacePanels.js';
import { figureActionForPath, jogsAction } from './editor/toolbarActions.js';
import { clampEditorFontSize, EDITOR_FONT_DEFAULT, stepEditorFontSize } from './editor/fontSize.js';
import { decideImageDrop, pathsWithExtension } from './app/dropTarget.js';
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
import { createWizard } from './project-wizard/wizard.js';
import {
  copyAssetIntoProject,
  copyFontIntoProject,
  engineSetMode,
  gitAdd,
  gitClone,
  getAppInfo,
  savePastedImage,
  listDirectory,
  readFile,
  writeFile,
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
import { createChangeTracker } from './preview/changeTracker.js';
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

/**
 * Ayuda bilingüe (contenido en `help/helpContent.js`). Además del botón "?"
 * de la cabecera, registra en `helpTrigger.js` la función que abren los
 * botones "?" de cada asistente (RF-52) — `registerPanel.js` no importa
 * `help.js` directamente para evitar un ciclo de imports.
 */
function wireHelpPanel() {
  const help = createHelp({ contentEl: el('help-content'), navEl: el('help-nav') });
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
        lspStatusEl.title = 'Language Server Tinymist activo. Pulsa para desactivarlo';
      } else if (status === 'idle') {
        lspStatusEl.textContent = '○ Activar Tinymist';
        lspStatusEl.title = 'Tinymist está desactivado (autocompletado, hover y formateo). Pulsa para activarlo';
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
    if (currentLspStatus === 'idle') {
      lspClient.enable();
    } else if (currentLspStatus === 'ready') {
      lspClient.disable();
      toast.show('Tinymist desactivado. Pulsa la insignia para volver a activarlo.');
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
    onSetEntrypoint: (path) => applyEntrypoint(path),
  });

  // Nuevo fichero .typ en la raíz del proyecto: el hueco real que destapó
  // RF-33 (clonar un repositorio VACÍO deja un proyecto abierto sin ningún
  // fichero, y hasta ahora no había ninguna vía para crear el primero — los
  // asistentes de plantilla siempre crean una carpeta nueva, nunca añaden a
  // una ya abierta). Fila de creación inline en vez de `window.prompt`
  // (`verify:frontend` lo prohíbe): Intro crea, Escape cancela.
  const newFileRow = el('tree-new-file-row');
  const newFileInput = el('tree-new-file-input');
  const openNewFileRow = () => {
    newFileRow.classList.remove('hidden');
    newFileInput.value = '';
    newFileInput.focus();
  };
  const closeNewFileRow = () => {
    newFileRow.classList.add('hidden');
    newFileInput.value = '';
  };
  el('tree-new-file').addEventListener('click', () => {
    if (newFileRow.classList.contains('hidden')) openNewFileRow();
    else closeNewFileRow();
  });
  newFileInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape') {
      closeNewFileRow();
      return;
    }
    if (event.key !== 'Enter') return;

    const root = tree.getRoot();
    const name = newFileInput.value.trim();
    if (!root) return;
    if (!name || !name.toLowerCase().endsWith('.typ') || name.includes('/') || name.includes('\\')) {
      toast.show(t('tree.newFileInvalid'), 'error');
      return;
    }

    const listing = await listDirectory(root);
    const exists = listing.ok && listing.value.some((entry) => entry.name === name);
    if (exists) {
      toast.show(t('tree.newFileExists'), 'error');
      return;
    }

    const target = joinPath(root, name);
    const created = await writeFile(target, '');
    if (!created.ok) {
      toast.show(`${t('tree.newFileError')} — ${created.error.message}`, 'error');
      return;
    }

    closeNewFileRow();
    await tree.refresh();
    await workspace.openDocument(target);
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
      // El editor de diagramas busca sus propios controles dentro del panel
      // por `data-diagram`, así que aquí basta con el panel.
      diagramPanel: el('diagram-panel'),
      equationPanel: el('equation-panel'),
      sequencePanel: el('sequence-panel'),
      ganttPanel: el('gantt-panel'),
      kanbanPanel: el('kanban-panel'),
      dotPanel: el('dot-panel'),
      documentName: el('document-name'),
      documentDirty: el('document-dirty'),
      documentPath: el('document-path'),
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

  wireImageDrop(workspace, el('editor-host'), toast.show, getAssetExtensions);
  wireImagePaste(workspace, el('editor-host'), toast.show);
  wireFontDrop(workspace, toast.show, getAssetExtensions);

  const staleEl = el('preview-stale');
  // Posiciones del texto compilado ↔ texto actual del editor (RF-57.5).
  const tracker = createChangeTracker();
  workspace.setListener('editorChanges', (changes) => tracker.record(changes));
  const preview = createPreview({
    pagesEl: el('preview-pages'),
    bandEl: el('preview-band'),
    bandSplitterEl: el('splitter-band'),
    statusEl: el('preview-status'),
    zoomLabelEl: el('preview-zoom-label'),
    getTarget: () => workspace.getCompileTarget(),
    onStaleChange: (stale) => staleEl.classList.toggle('hidden', !stale),
    onCompileStart: () => tracker.start(workspace.getCursorSource()?.docLength ?? 0),
    onRendered: (id) => tracker.rendered(id),
    onCompiled: (result) => {
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
    // Las posiciones de la compilación anterior no valen para otro documento.
    tracker.reset();
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
    engineButton.textContent = t(engineMode === 'inproc' ? 'preview.engineInproc' : 'preview.engineClassic');
  }

  // Motor de la vista previa (RF-56). El clásico es el de serie hasta que el
  // rápido se valide en una ventana real (ADR-MOTOR-002).
  const ENGINE_STORAGE_KEY = 'dbv-typst-preview-engine';
  const engineButton = el('btn-preview-engine');
  let engineMode = 'classic';
  try {
    if (localStorage.getItem(ENGINE_STORAGE_KEY) === 'inproc') engineMode = 'inproc';
  } catch {
    // Sin almacenamiento se queda el clásico.
  }
  async function applyEngineMode(mode) {
    engineMode = mode;
    try {
      localStorage.setItem(ENGINE_STORAGE_KEY, mode);
    } catch {
      // Es solo una comodidad: se pierde al reiniciar.
    }
    await engineSetMode(mode);
    refreshPreviewControls();
  }
  engineSetMode(engineMode);
  engineButton.addEventListener('click', async () => {
    await applyEngineMode(engineMode === 'inproc' ? 'classic' : 'inproc');
    preview.restart();
  });

  scopeButton.addEventListener('click', () => {
    workspace.setPreviewScope(workspace.getPreviewScope() === 'document' ? 'file' : 'document');
    refreshPreviewControls();
    lastTargetDocument = workspace.getCompileTarget()?.document ?? null;
    preview.restart();
    outline.restart();
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
    preview.restart();
    outline.restart();
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
  el('preview-pages').addEventListener('dblclick', async (event) => {
    const source = await preview.sourceAt(event.clientX, event.clientY);
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
  });

  /** Rango del texto actual del editor que corresponde al de lo compilado. */
  function mapToCurrent(source) {
    const open = workspace.getCursorSource();
    const raw = { from: source.from, to: source.to };
    if (!open || open.file !== source.file || !tracker.has(preview.getRenderedStart())) return raw;
    const mapped = tracker.toCurrent(preview.getRenderedStart(), source.from, source.to);
    if (!mapped) return raw;
    return mapped.collapsed ? 'deleted' : { from: mapped.from, to: mapped.to };
  }

  // Dirección contraria, como acción explícita: seguir el cursor de forma
  // continua obligaría a recalcular la tabla de anclas sin parar.
  async function syncPreviewToCursor() {
    const cursor = workspace.getCursorSource();
    if (!cursor) return;
    if (preview.getEngine() === 'inproc') {
      // Motor en proceso: la palabra o selección exacta, llevada al texto que se
      // compiló con lo tecleado desde entonces.
      const id = preview.getRenderedStart();
      const mapped = tracker.has(id) ? tracker.toRendered(id, cursor.from, cursor.to) : { from: cursor.from, to: cursor.to, collapsed: false };
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
