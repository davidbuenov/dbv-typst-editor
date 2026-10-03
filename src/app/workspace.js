// =============================================================================
// DBV Typst Editor — Espacio de trabajo (proyecto activo + documento activo)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Estado central de la aplicación: qué proyecto está abierto y qué documento se
// está editando. Es el único módulo que conoce ambas cosas a la vez; el árbol,
// el editor y (desde el Slice 5) la vista previa son piezas que él coordina.
//
// Pestañas (RF-79, R-T1): `state.document`/`state.dirty` siguen significando
// «el documento activo», así que el código de un solo documento no cambia de
// sentido. Las pestañas de fondo viven en `background` con su `EditorState`
// guardado, y su orden en `tabs` (modelo puro de `tabs.js`).
//
// Regla de RF-02b / R-MVP-3 que se hace visible aquí: abrir un proyecto NUNCA
// escribe nada en su carpeta. `openProjectAt` solo lee.

import { openSearchPanel } from '@codemirror/search';

import { createBibEntryPanel } from '../bibliography/bibEntryPanel.js';
import { createCitationPicker } from '../editor/citationPicker.js';
import { createImagePicker } from '../editor/imagePicker.js';
import { createEditor } from '../editor/editor.js';
import { createSymbolPicker } from '../editor/symbolPicker.js';
import { createTableDialog } from '../editor/tableDialog.js';
import { createCetzAssistant } from '../editor/cetzAssistant.js';
import { createDiagramEditor } from '../editor/diagramEditor.js';
import { createEquationEditor } from '../editor/equationEditor.js';
import { createSequenceEditor } from '../editor/sequenceEditor.js';
import { createGanttEditor } from '../editor/ganttEditor.js';
import { createKanbanEditor } from '../editor/kanbanEditor.js';
import { createDotEditor } from '../editor/dotEditor.js';
import { createToolbar } from '../editor/toolbar.js';
import { figureActionForPath } from '../editor/toolbarActions.js';
import { posFromLsp } from '../editor/lspClient.js';
import { detectLanguage } from '../editor/languageSupport.js';
import { mergeDiagnostics, toEditorDiagnostics } from '../editor/diagnosticsModel.js';
import { revealAndFlash, revealRangeAndFlash } from '../editor/syncFlash.js';
import { t } from '../i18n/i18n.js';
import { getTheme } from '../themes/theme.js';
import { readStoredEntrypoint, resolveEntrypoint, storeEntrypoint } from './entrypoint.js';
import { baseName, isTypstPath, joinPath, pathKey, relativeToRoot, remapMovedPath } from './paths.js';
import {
  activateTab as activateTabModel,
  closeTab as closeTabModel,
  emptyTabs,
  moveTab as moveTabModel,
  neighbourTab,
  openTab as openTabModel,
  readStoredTabs,
  remapTabPaths,
  restoreTabs,
  storeTabs,
} from './tabs.js';
import { buildCompileTarget, hasRootDocument } from './compileTarget.js';
import {
  decideAutoSaveAttempt,
  decideAutoSaveConflict,
  decideUnsavedChangesAction,
  stillDirtyAfterSave,
} from './autoSave.js';
import { changedOnDiskBeforeSave, decideExternalChange, isWithinAny } from './externalChange.js';
import { shortPathLabel } from './pathLabel.js';
import { createTabBar } from './tabBar.js';
import { getLastDocumentDir, rememberDocumentPath } from './lastDocumentDir.js';
import { getPref, onPrefsChanged } from './prefs.js';
import {
  PROJECT_CHANGE_EVENT,
  addRecentProject,
  clearProjectEntrypoint,
  copyAssetIntoProject,
  exportPdf,
  exportPng as backendExportPng,
  exportProjectArchive,
  fileFingerprint,
  fileModifiedMs,
  historyConfigure,
  historySnapshot,
  on,
  openProject,
  pickImageFile,
  pickSaveTarget,
  readFile,
  revealInFileManager,
  setProjectEntrypoint,
  unwatchProject,
  watchProject,
  writeFile,
} from '../services/backend.js';

// `joinPath`/`isTypstPath`/`baseName` viven en `paths.js` (Beta, §7.11): un
// módulo hoja del que `bibliography/bibEntryPanel.js` puede importar sin
// crear un ciclo (`workspace.js` → `bibEntryPanel.js` → `workspace.js`). Se
// re-exportan aquí para no romper a quien ya las importaba de este fichero.
export { baseName, isTypstPath, joinPath, relativeToRoot } from './paths.js';

/**
 * @param {object} deps
 * @param {ReturnType<import('../project-explorer/projectTree.js').createProjectTree>} deps.tree
 * @param {Record<string, HTMLElement>} deps.elements
 * @param {(message: string, tone?: 'info'|'error') => void} deps.notify
 * @param {ReturnType<import('../ui/choiceDialog.js').createChoiceDialog>} deps.dialog
 * @param {ReturnType<import('../editor/diffModal.js').createDiffModal>} [deps.diffModal]
 * @param {ReturnType<import('../editor/lspClient.js').createLspClient>} [deps.lspClient]
 */
export function createWorkspace({ tree, elements, notify, dialog, diffModal, lspClient }) {
  // Declarado antes del editor a propósito: `onSelectionChange` se dispara en
  // tiempo de ejecución, no al construir el objeto, así que el cierre puede
  // referenciar `toolbar` aunque todavía no se le haya asignado nada.
  let toolbar;
  let citationPicker;
  let imagePicker;
  let symbolPicker;
  let tableDialog;
  let cetzAssistant;
  let diagramEditor;
  let equationEditor;
  let sequenceEditor;
  let ganttEditor;
  let kanbanEditor;
  let dotEditor;
  // Guardado automático (RF-64), opción apagada por defecto. El temporizador
  // se arma en CADA edición y se cancela si llega otra antes de cumplirse —
  // "última gana", igual que el resto de pausas de la aplicación (RNF-MOTOR).
  const AUTO_SAVE_DEBOUNCE_MS = 2000;
  let autoSaveTimer = null;
  // Evita repetir el aviso de conflicto en cada pausa de 2 s mientras el
  // usuario no lo resuelve (recargar o guardar a mano) — decidido en
  // `decideAutoSaveConflict` (`app/autoSave.js`).
  let autoSaveConflictNotified = false;
  // Un solo `save()` a la vez (auto o manual): el diálogo de conflicto le
  // quita el foco al editor, y eso puede disparar un `blur` que intente
  // arrancar OTRO guardado mientras el primero sigue en curso.
  let saveInFlight = false;
  // RF-68: un aviso del observador que llega con un guardado en vuelo se
  // aplaza y se reevalúa al terminar (ver `decideExternalChange`).
  let externalCheckPending = false;
  // Mientras el diálogo de conflicto está abierto, los avisos siguientes no
  // abren otro encima: al responder se toma la huella que haya entonces.
  let conflictDialogOpen = false;
  // El aviso de "el fichero ya no existe" se da una vez por episodio.
  let missingNotified = false;

  function scheduleAutoSave() {
    if (!getPref('autoSave')) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = null;
      autoSaveAll();
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  function cancelScheduledAutoSave() {
    if (!autoSaveTimer) return;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }

  /**
   * Guarda de inmediato al perder el foco (RF-64.1: "…o el editor"), sin
   * esperar a la pausa de 2 s. La llama tanto un `blur` del propio editor
   * como uno de la ventana entera (este último, desde `main.js`).
   */
  function flushAutoSaveOnBlur() {
    if (!getPref('autoSave') || !hasUnsavedChanges()) return;
    cancelScheduledAutoSave();
    autoSaveAll();
  }

  const editor = createEditor(elements.editorHost, {
    theme: getTheme(),
    lspClient,
    onChange: (content) => {
      state.dirty = true;
      renderDocumentBar();
      scheduleAutoSave();
      // La vista previa solo se alimenta en vivo si lo que se está editando es
      // el documento que ella compila. Al editar `refs.bib` o un `.toml`, ese
      // contenido no es un documento Typst: mandarlo compilaría la bibliografía
      // como si fuera el documento. Esos ficheros llegan a la vista previa por
      // la vía normal — al guardarlos, el observador dispara la recompilación.
      if (isTypstPath(state.document?.path)) listeners.documentChanged?.(content);
      // Un `.cpp`, `.csv`… sin guardar que el documento incrusta con `read()`
      // (RF-60.4): el motor en proceso lo sustituye en memoria, así que la vista
      // previa puede seguir lo que se escribe. Quién decide si recompilar es main.js.
      else if (state.project) listeners.companionChanged?.();
    },
    onChanges: (changes) => listeners.editorChanges?.(changes),
    onSave: () => listeners.saveRequested?.(),
    onSelectionChange: () => toolbar?.refresh(),
    onBlur: flushAutoSaveOnBlur,
    onGoToDefinition: (view) => listeners.goToDefinition?.(view),
    onFindReferences: (view) => listeners.findReferences?.(view),
    onRenameSymbol: (view) => listeners.renameSymbol?.(view),
    onCodeActions: (view) => listeners.codeActions?.(view),
  });

  // Diagnósticos (RF-59): los de Tinymist y los del motor en proceso se
  // guardan por separado y se combinan al pintar, sin duplicar. Así el subrayado
  // sigue funcionando con Tinymist apagado.
  //
  // RF-85: Tinymist publica diagnósticos de TODOS los ficheros del proyecto (un
  // error en `cap/uno.typ` llega con `main.typ` abierto). El cliente los guarda
  // por fichero y aquí solo se pintan los del documento abierto; al abrir otro,
  // se pintan los suyos.
  let engineDiagnostics = [];

  function tinymistDiagnosticsFor(doc) {
    const raw = lspClient?.getDiagnostics?.(state.document?.path) ?? [];
    return raw.map((d) => {
      const from = posFromLsp(doc, d.range.start);
      const to = posFromLsp(doc, d.range.end);
      const severity = d.severity === 1 ? 'error' : d.severity === 2 ? 'warning' : 'info';
      return {
        from,
        to: Math.max(from, to),
        severity,
        message: d.message,
        source: d.source || 'Tinymist',
      };
    });
  }

  function applyDiagnostics() {
    const view = editor.getView();
    if (!view) return;
    const file = state.project && state.document ? relativeToRoot(state.project.root, state.document.path) : null;
    const own = toEditorDiagnostics(engineDiagnostics, file, view.state.doc);
    const tinymist = tinymistDiagnosticsFor(view.state.doc);
    editor.setDiagnostics(mergeDiagnostics(own, tinymist));
    // La insignia cuenta los problemas del documento abierto, no del proyecto.
    listeners.diagnosticsUpdated?.(tinymist);
  }

  lspClient?.setDiagnosticsHandler?.(() => applyDiagnostics());
  // RF-13: la barra de herramientas de inserción vive junto al editor que
  // controla, igual que en DBV Markdown Reader (ARCHITECTURE.md §3 fila 19).
  toolbar = createToolbar({
    containerEl: elements.editorToolbar,
    getView: editor.getView,
    // Beta, §7.7.4: estos tres botones abren un asistente con formulario en
    // vez de aplicar directamente la acción simple de `toolbarActions.js`.
    specialHandlers: {
      citation: (button) => citationPicker?.openNear(button),
      symbols: (button) => symbolPicker?.openNear(button),
      table: (button) => tableDialog?.openNear(button),
      cetz: (button) => cetzAssistant?.openNear(button),
      diagram: (button) => diagramEditor?.openNear(button),
      // RF-17: el botón ya no salta al explorador de ficheros, sino que
      // ofrece primero las imágenes que el proyecto ya tiene —coherencia con
      // "Cite"—, dejando el selector nativo como última opción del desplegable.
      figure: (button) => imagePicker?.openNear(button),
      // Beta, §7.7.4: `openSearchPanel` necesita el `EditorView` en vivo y
      // hace su propio dispatch — igual que `figure`, no encaja en
      // `buildTransaction(state) → TransactionSpec`. El atajo Ctrl+F (vía
      // `searchKeymap`, editor.js) ya abría este mismo panel; este botón solo
      // le da un punto de entrada visible a quien no conozca el atajo.
      search: () => {
        const view = editor.getView();
        if (view) openSearchPanel(view);
      },
    },
  });

  const state = {
    /** @type {null | {root: string, name: string, entrypoint: string|null, isSingleFile: boolean, hasManifest: boolean}} */
    project: null,
    /**
     * `contentHash` es la huella del último contenido conocido en disco (RF-68):
     * el que se leyó al abrir o el que se escribió en el último guardado.
     * @type {null | {path: string, fileName: string, modifiedMs: number, contentHash: string}}
     */
    document: null,
    dirty: false,
    /**
     * Último documento Typst abierto (RF-14). No coincide siempre con
     * `document`: abrir `refs.bib` cambia lo que hay en el editor pero no lo que
     * la vista previa debe compilar en el alcance "solo este fichero".
     * @type {string | null}
     */
    previewDocument: null,
    /** Alcance de la compilación (RF-14): 'document' | 'file'. */
    previewScope: 'document',
  };

  /** Clave por proyecto: el alcance es una preferencia de ESE proyecto. */
  const scopeKey = (root) => `dbv-typst-preview-scope:${root}`;

  function readStoredScope(root) {
    try {
      return localStorage.getItem(scopeKey(root)) === 'file' ? 'file' : 'document';
    } catch {
      return 'document';
    }
  }

  /**
   * Objetivo de compilación, compartido por vista previa, outline y exportación
   * (RF-14). La regla vive en `compileTarget.js` como función pura; aquí solo se
   * le pasa el estado. El fichero sucio puede no ser el que se compila —editar
   * un capítulo mientras se previsualiza `main.typ` es el caso que motivó RF-14—
   * y también vale un `.bib` sin guardar, que sí afecta al render.
   *
   * @returns {import('../services/backend.js').CompileTarget | null}
   */
  /** RF-93.3: propuesta de la IA que la vista previa enseña en memoria, o `null`. */
  let previewOverrides = null;

  function getCompileTarget() {
    const dirtyPath = state.dirty && state.document ? state.document.path : null;
    // RF-79: las pestañas de fondo sin guardar también cuentan (un capítulo
    // editado y dejado atrás sigue viéndose en el documento completo).
    const otherDirty = [];
    for (const entry of background.values()) {
      if (entry.dirty && entry.saved) otherDirty.push({ path: entry.document.path, content: entry.saved.state.doc.toString() });
    }
    // Las sustituciones de una propuesta van al final: el motor en proceso se
    // queda con la última de cada ruta, así que ganan a lo que haya sin guardar.
    if (previewOverrides) otherDirty.push(...previewOverrides);
    let dirtyContent = dirtyPath ? editor.getContent() : null;
    const activeOverride = previewOverrides?.find((file) => file.path === dirtyPath);
    if (activeOverride) dirtyContent = activeOverride.content;
    return buildCompileTarget({
      project: state.project,
      previewDocument: state.previewDocument,
      dirtyPath,
      dirtyContent,
      otherDirty,
      scope: state.previewScope,
    });
  }

  citationPicker = createCitationPicker({
    panelEl: elements.citationPanel,
    listEl: elements.citationList,
    filterEl: elements.citationFilter,
    newEntryButtonEl: elements.citationNewEntry,
    onCreateNew: () => bibEntryPanel.open(),
    getRoot: () => state.project?.root ?? null,
    getView: editor.getView,
  });

  imagePicker = createImagePicker({
    panelEl: elements.imagePanel,
    listEl: elements.imageList,
    filterEl: elements.imageFilter,
    browseButtonEl: elements.imageBrowse,
    onBrowse: () => insertFigureFromDialog(),
    getRoot: () => state.project?.root ?? null,
    getView: editor.getView,
  });

  const bibEntryPanel = createBibEntryPanel({
    panelEl: elements.bibEntryPanel,
    typeEl: elements.bibEntryType,
    keyEl: elements.bibEntryKey,
    fieldsEl: elements.bibEntryFields,
    errorEl: elements.bibEntryError,
    saveButtonEl: elements.bibEntrySave,
    cancelButtonEl: elements.bibEntryCancel,
    getRoot: () => state.project?.root ?? null,
    getView: editor.getView,
    notify,
  });

  symbolPicker = createSymbolPicker({
    panelEl: elements.symbolPanel,
    gridEl: elements.symbolGrid,
    filterEl: elements.symbolFilter,
    getView: editor.getView,
  });

  tableDialog = createTableDialog({
    panelEl: elements.tablePanel,
    rowsEl: elements.tableRows,
    colsEl: elements.tableCols,
    headerEl: elements.tableHeader,
    insertButtonEl: elements.tableInsert,
    getView: editor.getView,
  });

  cetzAssistant = createCetzAssistant({
    panelEl: elements.cetzPanel,
    getView: editor.getView,
  });

  diagramEditor = createDiagramEditor({
    panelEl: elements.diagramPanel,
    getView: editor.getView,
  });

  equationEditor = createEquationEditor({
    panelEl: elements.equationPanel,
    getView: editor.getView,
    getRoot: () => state.project?.root ?? null,
  });

  sequenceEditor = createSequenceEditor({
    panelEl: elements.sequencePanel,
    getView: editor.getView,
  });

  ganttEditor = createGanttEditor({
    panelEl: elements.ganttPanel,
    getView: editor.getView,
  });

  kanbanEditor = createKanbanEditor({
    panelEl: elements.kanbanPanel,
    getView: editor.getView,
  });

  dotEditor = createDotEditor({
    panelEl: elements.dotPanel,
    getView: editor.getView,
    getRoot: () => state.project?.root ?? null,
  });

  /** Ganchos que rellenan los slices posteriores (vista previa, guardado). */
  const listeners = {
    /** @type {null | ((content: string) => void)} */
    documentChanged: null,
    /** @type {null | ((change: {path: string, isOpenDocument: boolean, isActiveDocument: boolean}) => void)} */
    externalChange: null,
    /** @type {null | ((project: object) => void)} */
    projectOpened: null,
    /** @type {null | (() => void)} Se cerró el proyecto (la IA libera su estado, RF-92). */
    projectClosed: null,
    /** @type {null | ((doc: object) => void)} */
    documentOpened: null,
    /** @type {null | (() => void)} */
    documentDetached: null,
    /** @type {null | (() => void)} */
    saveRequested: null,
    /** @type {null | (() => void)} */
    saved: null,
    /** @type {null | ((diagnostics: any[]) => void)} */
    diagnosticsUpdated: null,
    /** @type {null | (() => void)} */
    companionChanged: null,
    /** Cambió la lista de pestañas, la activa o el estado de alguna (RF-79). */
    /** @type {null | (() => void)} */
    tabsChanged: null,
    /** F12 / Ctrl+clic y Mayús+F12 en el editor (RF-77). */
    /** @type {null | ((view: import('@codemirror/view').EditorView) => void)} */
    goToDefinition: null,
    /** @type {null | ((view: import('@codemirror/view').EditorView) => void)} */
    findReferences: null,
    /** F2 y Ctrl+. en el editor (RF-77.4-5). */
    /** @type {null | ((view: import('@codemirror/view').EditorView) => void)} */
    renameSymbol: null,
    /** @type {null | ((view: import('@codemirror/view').EditorView) => void)} */
    codeActions: null,
  };

  /**
   * Barra de pestañas (RF-79). RF-65: cada pestaña lleva solo el nombre,
   * ampliado tramo a tramo SOLO si otro fichero conocido (del árbol o de otra
   * pestaña) comparte nombre; la ruta completa va en el tooltip. RF-64.3: el
   * punto de modificado, con su texto para el lector de pantalla.
   */
  function renderTabs() {
    const list = listTabs();
    const known = [...tree.getKnownFiles().map((file) => file.path), ...list.map((tab) => tab.path)];
    tabBar.render(list.map((tab) => ({ ...tab, label: shortPathLabel(tab.path, known) })));
  }

  /** Cambió la lista de pestañas o el estado de alguna. */
  function tabsChanged() {
    renderTabs();
    listeners.tabsChanged?.();
  }

  function renderDocumentBar() {
    const hasDocument = Boolean(state.document);
    renderTabs();
    elements.documentPath.textContent = hasDocument && getPref('showFullPath') ? state.document.path : '';

    // Insignia del lenguaje (RF-60.5): solo para lo que no es Typst, que es
    // lo que el usuario da por supuesto en esta aplicación.
    if (elements.documentLanguage) {
      const language = hasDocument ? detectLanguage(state.document.path) : null;
      const show = language !== null && language.kind !== 'typst';
      elements.documentLanguage.classList.toggle('hidden', !show);
      elements.documentLanguage.textContent = show ? language.name : '';
    }

    // RF-61: Formatear solo tiene sentido en Typst — con un `.bib`/`.cpp`
    // delante, el LSP no tiene forma de formatearlo (Tinymist solo entiende
    // Typst), así que el botón se apaga en vez de fallar en silencio.
    if (elements.formatButton) {
      const isTypst = hasDocument && isTypstPath(state.document.path);
      elements.formatButton.disabled = !isTypst;
      elements.formatButton.title = isTypst ? t('format.buttonTitle') : t('format.buttonTitleDisabled');
    }

    // RF-26.10, a observación del usuario: un paquete se importa EN el documento
    // abierto, así que sin documento la única acción posible del panel acaba en
    // un aviso de error. Ofrecerlo igualmente es ofrecer algo que no puede
    // funcionar; el botón se apaga y dice por qué.
    if (elements.universeButton) {
      elements.universeButton.disabled = !hasDocument;
      elements.universeButton.title = hasDocument
        ? t('action.universe')
        : t('universe.needDocument');
    }
  }

  function renderProjectBar() {
    const hasProject = Boolean(state.project);
    elements.projectName.textContent = hasProject ? state.project.name : t('project.none');
    elements.workspaceView.classList.toggle('hidden', !hasProject);
    elements.emptyView.classList.toggle('hidden', hasProject);
    elements.projectActions.classList.toggle('hidden', !hasProject);
    // RF-30: dentro del menú Archivo, lo que necesita proyecto se deshabilita en
    // vez de desaparecer. Un menú que cambia de tamaño según el contexto obliga
    // a releerlo entero cada vez que se abre; uno estable se recorre de memoria.
    for (const item of elements.projectMenuItems ?? []) {
      item.disabled = !hasProject;
    }
    // El aviso de "proyecto sin manifiesto DBV" es informativo, nunca una
    // degradación (RF-02b): se muestra como etiqueta neutra, no como error.
    elements.projectKind.textContent = !hasProject
      ? ''
      : state.project.isSingleFile
        ? t('project.singleFile')
        : state.project.hasManifest
          ? t('project.dbv')
          : t('project.external');
  }

  /**
   * Pide confirmación antes de perder cambios sin guardar. Portado del
   * `confirmDiscardUnsavedChanges` de DBV Markdown Reader (ARCHITECTURE.md §3
   * fila 17): junto al conflicto externo, es el único punto de la aplicación
   * que interrumpe al usuario, y lo hace porque la alternativa es perder trabajo.
   *
   * Usa el modal propio y NO `window.confirm`: en un WebView de Tauri esa
   * llamada la intercepta el plugin de diálogos y exige el permiso
   * `dialog:allow-confirm`, así que fallaba con "dialog.confirm not allowed".
   * El modal propio además está traducido y sigue el tema de la aplicación.
   *
   * RF-64.5/RF-64.6: con el guardado automático encendido, esto YA NO
   * pregunta — guarda y sigue. Si ese guardado no consigue dejar el
   * documento limpio (conflicto con disco, fallo de escritura), cae al
   * diálogo de siempre: no se descarta nada en silencio solo porque la
   * opción esté activada. Es también el único sitio que decide esto, así que
   * cerrar la VENTANA (main.js, `onCloseRequested`) reutiliza esta misma
   * función en vez de duplicar la regla.
   */
  async function confirmDiscardChanges(onlyPaths = null) {
    // RF-79, R-T5: TODAS las pestañas modificadas, no solo la activa (una de
    // fondo sin guardar se perdería al cerrar la ventana). Con `onlyPaths`,
    // solo esas (cerrar una pestaña).
    const wanted = (tab) => !onlyPaths || onlyPaths.some((path) => pathKey(path) === pathKey(tab.path));
    let pending = dirtyTabs().filter(wanted);
    if (pending.length === 0) return true;
    const decision = decideUnsavedChangesAction({ dirty: true, autoSave: getPref('autoSave') });
    if (decision === 'save-then-continue') {
      cancelScheduledAutoSave();
      for (const tab of pending) await saveTab(tab.path, { auto: true });
      pending = dirtyTabs().filter(wanted);
      if (pending.length === 0) return true;
    }
    const choice = await dialog.ask({
      titleKey: 'doc.discardTitle',
      textKey: 'doc.discardConfirm',
      text: pending.map((tab) => tab.fileName).join(', '),
      choices: [
        { key: 'cancel', labelKey: 'action.cancel', tone: 'primary' },
        { key: 'discard', labelKey: 'doc.discardAction', tone: 'danger' },
      ],
    });
    return choice === 'discard';
  }

  // ── Pestañas (RF-79) ─────────────────────────────────────────────────────
  /** Orden de las pestañas y cuál está activa (`tabs.js`). */
  let tabs = emptyTabs();
  /**
   * Pestañas de fondo, por `pathKey`. `saved` es el `snapshot()` del editor, o
   * `null` si la pestaña se restauró al abrir el proyecto y aún no se ha
   * cargado (se lee del disco al activarla).
   * @type {Map<string, {document: {path: string, fileName: string, modifiedMs?: number, contentHash?: string}, dirty: boolean, saved: null | {state: import('@codemirror/state').EditorState, scroll?: unknown}, readOnly: boolean, conflictNotified: boolean, missingNotified: boolean}>}
   */
  const background = new Map();
  /** Solo lectura de la pestaña activa (paquetes fuera del proyecto, RF-77). */
  let activeReadOnly = false;

  const isActivePath = (path) => Boolean(state.document) && pathKey(state.document.path) === pathKey(path);

  /** Pestañas con cambios sin guardar, la activa incluida. */
  function dirtyTabs() {
    const list = [];
    if (state.document && state.dirty) list.push({ path: state.document.path, fileName: state.document.fileName });
    for (const entry of background.values()) {
      if (entry.dirty) list.push({ path: entry.document.path, fileName: entry.document.fileName });
    }
    return list;
  }

  /** ¿Hay cambios sin guardar en alguna pestaña? (cerrar la ventana, RF-64.6). */
  function hasUnsavedChanges() {
    return dirtyTabs().length > 0;
  }

  /**
   * El observador vigila el proyecto y marca los avisos de las pestañas
   * abiertas (R-T4): un cambio externo en una de fondo también se mira.
   */
  async function watchTabs() {
    if (state.project) await watchProject(state.project.root, [...tabs.paths]);
  }

  function persistTabs() {
    if (state.project) storeTabs(state.project.root, tabs);
    tabsChanged();
  }

  /** Pestañas abiertas en orden, con si están activas, modificadas o en solo lectura. */
  function listTabs() {
    return tabs.paths.map((path) => {
      const active = isActivePath(path);
      const entry = active ? null : background.get(pathKey(path));
      return {
        path,
        fileName: baseName(path),
        active,
        dirty: active ? state.dirty : Boolean(entry?.dirty),
        readOnly: active ? activeReadOnly : Boolean(entry?.readOnly),
      };
    });
  }

  /** Todas las pestañas cargadas con su contenido del editor (las restauradas sin cargar, no). */
  function openTexts() {
    const list = state.document ? [{ path: state.document.path, content: editor.getContent() }] : [];
    for (const entry of background.values()) {
      if (entry.saved) list.push({ path: entry.document.path, content: entry.saved.state.doc.toString() });
    }
    return list;
  }

  /** Reordenar arrastrando (RF-79.3). */
  function moveTab(path, toIndex) {
    tabs = moveTabModel(tabs, path, toIndex);
    persistTabs();
  }

  const tabBar = createTabBar({
    containerEl: elements.documentTabs,
    onActivate: (path) => activateTab(path),
    onClose: (path) => closeTab(path),
    onMove: moveTab,
  });

  /** Guarda la pestaña activa como pestaña de fondo, con su estado del editor. */
  function stashActive() {
    if (!state.document) return;
    background.set(pathKey(state.document.path), {
      document: state.document,
      dirty: state.dirty,
      saved: editor.snapshot(),
      readOnly: activeReadOnly,
      conflictNotified: autoSaveConflictNotified,
      missingNotified,
    });
  }

  /** Tras cambiar de pestaña: árbol, barra, diagnósticos, vista previa y observador. */
  async function presentActive() {
    const path = state.document?.path ?? null;
    tree.setActivePath(path);
    renderDocumentBar();
    applyDiagnostics();
    // Abrir un fichero acompañante (`.bib`, `.toml`) NO cambia lo que compila la
    // vista previa: se sigue viendo el documento, que es lo que el usuario está
    // escribiendo. Solo se le avisa de que el editor ya no está encima de él,
    // para que deje de usar el contenido en vivo y compile lo que hay en disco.
    // Un `.typ` de fuera del proyecto (un paquete abierto desde «Ir a la
    // definición») tampoco: no es algo que se pueda compilar con esta raíz.
    const insideProject = Boolean(state.project) && relativeToRoot(state.project.root, path) !== null;
    if (isTypstPath(path) && insideProject) {
      state.previewDocument = path;
      listeners.documentOpened?.();
    } else {
      listeners.documentDetached?.();
    }
    // El watcher debe saber cuál es el documento activo para poder distinguir
    // "recompila" de "aviso de conflicto" (Slice 6).
    if (state.project) await watchTabs();
    persistTabs();
  }

  /**
   * Pone en el editor una pestaña de fondo (la activa ya se guardó o se cerró).
   * Una pestaña restaurada que aún no se había cargado se lee ahora del disco.
   */
  async function showBackground(key) {
    const entry = background.get(key);
    if (!entry) return false;
    if (!entry.saved) {
      // La activa ya se guardó o se cerró: que `openDocument` no la guarde otra vez.
      background.delete(key);
      state.document = null;
      state.dirty = false;
      const opened = await openDocument(entry.document.path, { force: true });
      // Hallazgo Crítico de /code-simplify: si el fichero ya no se puede leer,
      // la pestaña se quita y se vuelve a la que quede (o el editor se vacía).
      // Sin esto, el editor seguía enseñando la pestaña anterior sin documento
      // asociado, y lo que se escribiera ahí no se podía guardar.
      if (!opened) {
        tabs = closeTabModel(tabs, entry.document.path);
        editor.closeDocument(entry.document.path);
        if (tabs.active && background.has(pathKey(tabs.active))) return showBackground(pathKey(tabs.active));
        await detachDocument();
        persistTabs();
      }
      return opened;
    }
    background.delete(key);
    editor.activate(entry.document.path, entry.saved, { readOnly: entry.readOnly });
    state.document = entry.document;
    state.dirty = entry.dirty;
    activeReadOnly = entry.readOnly;
    autoSaveConflictNotified = entry.conflictNotified;
    missingNotified = entry.missingNotified;
    tabs = activateTabModel(tabs, entry.document.path);
    await presentActive();
    return true;
  }

  /** Activa una pestaña abierta (clic en la barra, Ctrl+Tab). */
  async function activateTab(path) {
    if (isActivePath(path)) return true;
    const key = pathKey(path);
    if (!background.has(key)) return false;
    cancelScheduledAutoSave();
    stashActive();
    state.document = null;
    const shown = await showBackground(key);
    // La que se deja atrás con cambios se guarda ya si el guardado automático
    // está encendido: su temporizador de 2 s era de la pestaña activa.
    if (getPref('autoSave')) autoSaveAll();
    return shown;
  }

  /** Pestaña siguiente (1) o anterior (-1) a la activa, en círculo (Ctrl+Tab). */
  function cycleTab(step) {
    const target = neighbourTab(tabs, step);
    return target ? activateTab(target) : Promise.resolve(false);
  }

  /**
   * Cierra una pestaña, preguntando antes si tiene cambios sin guardar. Si era
   * la activa, pasa a serlo su vecina (o el editor queda vacío).
   * @returns {Promise<boolean>} true si se cerró.
   */
  async function closeTab(path) {
    const key = pathKey(path);
    const active = isActivePath(path);
    if (!active && !background.has(key)) return false;
    if (!(await confirmDiscardChanges([path]))) return false;
    tabs = closeTabModel(tabs, path);
    editor.closeDocument(path);
    if (!active) {
      background.delete(key);
      persistTabs();
      await watchTabs();
    } else if (tabs.active) {
      cancelScheduledAutoSave();
      state.document = null;
      await showBackground(pathKey(tabs.active));
    } else {
      await detachDocument();
    }
    return true;
  }

  /** Cierra todas las pestañas sin preguntar (cambio o cierre de proyecto, ya confirmado). */
  function dropAllTabs() {
    for (const entry of background.values()) editor.closeDocument(entry.document.path);
    if (state.document) editor.closeDocument(state.document.path);
    background.clear();
    tabs = emptyTabs();
    activeReadOnly = false;
  }

  /**
   * Guarda una pestaña de fondo (RF-64: guardado automático de todas las
   * modificadas, y «guardar y seguir» al cerrar). Nunca abre un diálogo: si
   * el disco cambió por fuera, avisa una vez y la deja modificada.
   */
  const backgroundSaving = new Set();
  async function saveBackground(path, { auto = false } = {}) {
    const key = pathKey(path);
    const entry = background.get(key);
    if (!entry?.dirty || !entry.saved || backgroundSaving.has(key)) return false;
    backgroundSaving.add(key);
    try {
      const fingerprint = await fileFingerprint(entry.document.path);
      if (fingerprint.ok && changedOnDiskBeforeSave({ knownHash: entry.document.contentHash, fingerprint: fingerprint.value })) {
        if (!entry.conflictNotified) {
          entry.conflictNotified = true;
          notify(`${t('doc.autoSaveConflict')} — ${entry.document.fileName}`, 'error');
        }
        return false;
      }
      const content = entry.saved.state.doc.toString();
      const result = await writeFile(entry.document.path, content, auto ? 'auto' : 'save');
      if (!result.ok) {
        notify(`${t('doc.saveError')} — ${result.error.message}`, 'error');
        return false;
      }
      // Mientras se escribía, la pestaña pudo pasar a ser la activa.
      if (isActivePath(path)) {
        rememberWritten(result.value);
        state.dirty = stillDirtyAfterSave({ snapshot: content, currentContent: editor.getContent() });
        renderDocumentBar();
      } else {
        const current = background.get(key) ?? entry;
        current.document.modifiedMs = result.value.modifiedMs;
        current.document.contentHash = result.value.contentHash;
        current.conflictNotified = false;
        current.dirty = Boolean(current.saved) && current.saved.state.doc.toString() !== content;
      }
      listeners.saved?.(auto);
      tabsChanged();
      return true;
    } finally {
      backgroundSaving.delete(key);
    }
  }

  /** Guarda la pestaña de `path`, sea la activa o una de fondo. */
  function saveTab(path, options) {
    return isActivePath(path) ? save(options) : saveBackground(path, options);
  }

  /** Guardado automático (RF-64): la activa y todas las de fondo modificadas (R-T5). */
  async function autoSaveAll() {
    await save({ auto: true });
    for (const entry of [...background.values()]) {
      if (entry.dirty) await saveBackground(entry.document.path, { auto: true });
    }
  }

  /**
   * Abre un documento en una pestaña (RF-79). Si ya estaba abierto, solo la
   * activa: sus cambios sin guardar se conservan, así que ya no hay que
   * preguntar nada al cambiar de fichero. `force` lo vuelve a leer del disco
   * (recargar tras un cambio externo o una resolución de conflicto de git).
   * @param {string} path
   * @param {{force?: boolean, readOnly?: boolean}} [options]
   */
  async function openDocument(path, { force = false, readOnly = false } = {}) {
    const alreadyOpen = isActivePath(path) || background.has(pathKey(path));
    if (alreadyOpen && !force) return activateTab(path);
    cancelScheduledAutoSave();

    const result = await readFile(path);
    if (!result.ok) {
      notify(`${t('doc.openError')} — ${result.error.message}`, 'error');
      return false;
    }

    const payload = result.value;
    const leaving = state.document && !isActivePath(payload.path) && state.dirty;
    if (!isActivePath(path)) stashActive();
    background.delete(pathKey(path));
    editor.setDocument(payload.content, payload.path, { readOnly });
    state.document = {
      path: payload.path,
      fileName: payload.fileName,
      modifiedMs: payload.modifiedMs,
      contentHash: payload.contentHash,
    };
    state.dirty = false;
    activeReadOnly = readOnly;
    // Otro documento es otro episodio: el conflicto del anterior, si lo
    // hubiera, ya no aplica.
    autoSaveConflictNotified = false;
    missingNotified = false;
    tabs = openTabModel(tabs, payload.path);
    await presentActive();
    if (leaving && getPref('autoSave')) autoSaveAll();
    return true;
  }

  /**
   * Abre una carpeta de proyecto o un `.typ` suelto. Solo lee: ni crea el
   * manifiesto, ni toca la estructura de la carpeta (R-MVP-3).
   */
  async function openProjectAt(path) {
    if (!(await confirmDiscardChanges())) return false;

    const result = await openProject(path);
    if (!result.ok) {
      notify(`${t('project.openError')} — ${result.error.message}`, 'error');
      return false;
    }

    dropAllTabs();
    state.project = result.value;
    entrypointWarned = false;
    configureHistory();
    // RF-83.3: manda el principal del manifiesto (el backend ya comprobó que
    // existe). Si no declara ninguno, la elección guardada en este equipo
    // (proyectos marcados antes de la 0.12.0) manda sobre la heurística, si el
    // fichero sigue existiendo (pudo borrarse o renombrarse).
    const fromManifest = state.project.entrypointSource === 'manifest';
    const storedEntrypoint = state.project.isSingleFile || fromManifest ? null : readStoredEntrypoint(state.project.root);
    if (storedEntrypoint && (await fileModifiedMs(joinPath(state.project.root, storedEntrypoint))).ok) {
      state.project = { ...state.project, entrypoint: storedEntrypoint };
    }
    state.document = null;
    state.dirty = false;
    state.previewDocument = null;
    state.previewScope = readStoredScope(result.value.root);
    renderProjectBar();
    renderDocumentBar();

    // Antes de pintar el árbol: las filas se etiquetan al construirse.
    tree.setEntrypointPath(
      state.project.entrypoint && !state.project.isSingleFile
        ? joinPath(state.project.root, state.project.entrypoint)
        : null,
    );
    await tree.setRoot(state.project.root, { force: true });
    // Un `.typ` suelto se reabre por su fichero, no por su carpeta; el separador
    // lo pone `joinPath`, que respeta el de la plataforma.
    await addRecentProject({
      ...state.project,
      path: state.project.isSingleFile
        ? joinPath(state.project.root, state.project.entrypoint)
        : state.project.root,
    });
    // Tinymist ya no arranca aquí: `openDocument` lo hace si el documento es
    // pequeño, o el usuario desde la insignia si no (ver `LSP_AUTOSTART_MAX_CHARS`).
    lspClient?.setProjectRoot(state.project.root).catch(console.error);
    listeners.projectOpened?.(state.project);

    // RF-79.5: se restauran las pestañas de la última vez (las que ya no
    // existen se omiten). Solo se lee del disco la activa; las demás, al
    // activarlas. Sin pestañas guardadas se abre el principal, como siempre.
    const restored = await restoreProjectTabs(state.project.root);
    if (restored.active) {
      tabs = restored;
      for (const path of restored.paths) {
        if (pathKey(path) === pathKey(restored.active)) continue;
        background.set(pathKey(path), {
          document: { path, fileName: baseName(path) },
          dirty: false,
          saved: null,
          readOnly: false,
          conflictNotified: false,
          missingNotified: false,
        });
      }
      await openDocument(restored.active, { force: true });
    } else if (state.project.entrypoint) {
      await openDocument(joinPath(state.project.root, state.project.entrypoint), { force: true });
    } else {
      await watchTabs();
      notify(t('project.noEntrypoint'));
    }
    return true;
  }

  /** Pestañas guardadas de `root`, solo las de ficheros que siguen existiendo. */
  async function restoreProjectTabs(root) {
    const raw = readStoredTabs(root);
    const candidates = restoreTabs(raw, root, () => true);
    const existing = new Set();
    for (const path of candidates.paths) {
      if ((await fileModifiedMs(path)).ok) existing.add(pathKey(path));
    }
    return restoreTabs(raw, root, (path) => existing.has(pathKey(path)));
  }

  async function closeProject() {
    if (!(await confirmDiscardChanges())) return false;
    await unwatchProject();
    dropAllTabs();
    lspClient?.stop();
    state.project = null;
    configureHistory();
    state.document = null;
    state.dirty = false;
    renderProjectBar();
    renderDocumentBar();
    listeners.projectClosed?.();
    return true;
  }

  /**
   * Nombre de PDF sugerido: el del documento con extensión cambiada. El usuario
   * espera que "main.typ" se ofrezca como "main.pdf", no como "documento.pdf".
   */
  function suggestedPdfName() {
    if (!state.document) return 'documento.pdf';
    return state.document.fileName.replace(/\.typ$/i, '') + '.pdf';
  }

  /**
   * Exporta el documento a PDF (RF-10).
   *
   * El PDF es el artefacto final que el usuario comparte, así que se exporta el
   * contenido que tiene delante —incluidos los cambios sin guardar— y no una
   * versión antigua del disco que sería una sorpresa desagradable. Desde RF-14
   * usa el MISMO objetivo que la vista previa: exportar el capítulo mientras se
   * ve el documento completo en pantalla sería la peor sorpresa de todas.
   */
  async function exportToPdf(output) {
    const target = getCompileTarget();
    if (!target) return false;

    notify(t('export.working'));
    const result = await exportPdf({ target, output });

    if (!result.ok) {
      notify(`${t('export.failed')} — ${result.error.message}`, 'error');
      return false;
    }
    notify(`${t('export.done')} ${result.value}`);
    return true;
  }

  /**
   * Exporta UNA página del documento a PNG (Beta, §7.12 — alcance de este
   * slice: página actual, no rango ni documento completo). `page` lo calcula
   * quien llama (la vista previa sabe qué página se está leyendo, el workspace
   * no); este método solo aporta el documento/raíz/contenido en vivo, igual
   * que `exportToPdf`.
   */
  async function exportPng(output, page) {
    const target = getCompileTarget();
    if (!target) return false;

    notify(t('export.pngWorking'));
    const result = await backendExportPng({ target, output, page });

    if (!result.ok) {
      notify(`${t('export.pngFailed')} — ${result.error.message}`, 'error');
      return false;
    }
    notify(`${t('export.done')} ${result.value}`);
    return true;
  }

  function revealProject() {
    if (!state.project) return;
    revealInFileManager(state.project.root);
  }

  /** Nombre de archivo sugerido: el del proyecto, con extensión `.dbvt`. */
  function suggestedArchiveName() {
    return `${state.project?.name ?? 'proyecto'}.dbvt`;
  }

  /**
   * Exporta el proyecto activo como Project Archive `.dbvt` (RF-11, v0.2).
   *
   * Empaqueta lo que hay en disco, no lo que se está editando: a diferencia del
   * PDF (que es un artefacto final), un `.dbvt` es un proyecto Typst completo
   * que alguien va a seguir editando, así que primero hay que guardar.
   */
  async function exportArchive(output) {
    if (!state.project) return false;
    if (state.dirty && !(await save())) return false;

    notify(t('archive.exportWorking'));
    const result = await exportProjectArchive(state.project.root, output);
    if (!result.ok) {
      notify(`${t('archive.exportFailed')} — ${result.error.message}`, 'error');
      return false;
    }
    notify(`${t('archive.exportDone')} ${output}`);
    return true;
  }

  /**
   * Asistente "Insertar figura" vía selector nativo (Beta, §7.7.4) — la vía
   * alternativa a arrastrar y soltar (Slice 19) para quien lo prefiera.
   */
  async function insertFigureFromDialog() {
    if (!state.project) return;

    const picked = await pickImageFile();
    if (!picked.ok || !picked.value) return;

    const result = await copyAssetIntoProject(state.project.root, picked.value);
    if (!result.ok) {
      notify(`${t('asset.copyFailed')} — ${result.error.message}`, 'error');
      return;
    }

    const view = editor.getView();
    view.dispatch(figureActionForPath(result.value)(view.state));
    view.focus();
  }

  /**
   * El observador avisa de un cambio en el documento que hay abierto (RF-07,
   * RF-68). El aviso solo dice que "algo" pasó; lo que se hace depende del
   * CONTENIDO del disco, no de cuándo llegó el aviso:
   *   · mismo contenido que el último conocido (nuestro propio guardado, o el
   *     antivirus tocando atributos) → nada;
   *   · contenido nuevo sin cambios locales → recarga silenciosa (lo que espera
   *     quien acaba de hacer `git pull` o de editar en otro programa);
   *   · contenido nuevo con cambios locales → conflicto real, se pregunta;
   *   · el fichero ya no existe → se avisa y el texto se conserva.
   */
  async function handleActiveDocumentChanged() {
    if (!state.document || conflictDialogOpen) return;
    const path = state.document.path;
    const fingerprint = await fileFingerprint(path);
    // Un fallo leyendo (bloqueo transitorio) no es motivo para molestar: el
    // siguiente aviso o el siguiente guardado volverán a mirar.
    if (!fingerprint.ok || state.document?.path !== path) return;

    const action = decideExternalChange({
      knownHash: state.document.contentHash,
      fingerprint: fingerprint.value,
      dirty: state.dirty,
      saving: saveInFlight,
      ownOperation: isOwnOperation(path),
    });

    if (action === 'defer') {
      externalCheckPending = true;
      return;
    }
    if (action === 'ignore') return;
    if (action === 'missing') {
      if (missingNotified) return;
      missingNotified = true;
      // El texto sigue en el editor; marcarlo como modificado hace que Guardar
      // (o el guardado automático) lo vuelva a crear en disco.
      state.dirty = true;
      renderDocumentBar();
      notify(`${t('doc.missingOnDisk')} — ${state.document.fileName}`, 'error');
      return;
    }
    missingNotified = false;
    if (action === 'reload') {
      await openDocument(path, { force: true });
      notify(t('conflict.reloaded'));
      return;
    }

    const choices = [
      { key: 'keep', labelKey: 'conflict.keepMine', tone: 'primary' },
    ];
    if (diffModal) {
      choices.push({ key: 'diff', labelKey: 'conflict.viewDiff' });
    }
    choices.push({ key: 'reload', labelKey: 'conflict.reload', tone: 'danger' });

    conflictDialogOpen = true;
    try {
      let choice = await dialog.ask({
        titleKey: 'conflict.title',
        textKey: 'conflict.text',
        text: path,
        choices,
      });

      if (choice === 'diff' && diffModal) {
        const diskRead = await readFile(path);
        const diskContent = diskRead.ok ? diskRead.value.content : '';
        choice = await diffModal.open({
          localContent: editor.getContent(),
          diskContent,
        });
      }

      if (choice === 'reload') {
        await reloadFromDisk(path);
        return;
      }
      // "Conservar lo mío": la huella del disco pasa a ser la conocida, para que
      // ni el siguiente aviso ni el siguiente `Guardar` pregunten otra vez por
      // el mismo cambio ya visto.
      const latest = await fileFingerprint(path);
      if (latest.ok && latest.value.contentHash && state.document?.path === path) {
        state.document.contentHash = latest.value.contentHash;
        state.document.modifiedMs = latest.value.modifiedMs;
      }
    } finally {
      conflictDialogOpen = false;
    }
  }

  /**
   * Rutas que una operación propia (mover, renombrar, eliminar — RF-69) está
   * tocando ahora mismo: sus avisos del observador no son cambios externos.
   * Es una lista explícita, no una ventana de tiempo.
   * @type {Set<string>}
   */
  const ownOperationPaths = new Set();

  const isOwnOperation = (path) => isWithinAny(path, ownOperationPaths);

  /**
   * Plazo durante el que las rutas de una operación propia siguen marcadas
   * DESPUÉS de terminarla: los avisos del observador llegan con retraso. Solo
   * afecta a esas rutas; además, una vez actualizado el estado, la huella
   * (RF-68) ya reconoce el contenido y los avisos se ignoran de todos modos.
   */
  const OWN_OPERATION_SETTLE_MS = 1500;

  /**
   * Ejecuta `operation` marcando `paths` como operación propia (RF-69.11):
   * mover o borrar el documento abierto no debe verse como "otro programa lo
   * ha cambiado" ni como "el fichero ya no existe".
   * @template T
   * @param {string[]} paths
   * @param {() => Promise<T>} operation
   * @returns {Promise<T>}
   */
  async function runOwnOperation(paths, operation) {
    const marked = paths.filter((path) => !ownOperationPaths.has(path));
    for (const path of marked) ownOperationPaths.add(path);
    try {
      return await operation();
    } finally {
      setTimeout(() => {
        for (const path of marked) ownOperationPaths.delete(path);
      }, OWN_OPERATION_SETTLE_MS);
    }
  }

  /** True si ya se avisó de que el manifiesto no se pudo escribir (RF-83.4: una vez por proyecto). */
  let entrypointWarned = false;
  /** @type {Promise<void>} */
  let pendingEntrypointWrite = Promise.resolve();

  /**
   * Guarda el documento principal (`''` = ninguno) en este equipo y, si
   * `inManifest`, también en `settings/dbv-project.toml` (RF-83). La copia
   * local es el respaldo: si el manifiesto no se puede escribir, se avisa una
   * vez y el principal queda recordado solo aquí, como en la 0.11.0.
   * @param {string} relative
   * @param {boolean} inManifest
   */
  async function persistEntrypoint(relative, inManifest) {
    const project = state.project;
    if (!project) return;
    storeEntrypoint(project.root, relative);
    if (!inManifest) return;
    const result = relative ? await setProjectEntrypoint(project.root, relative) : await clearProjectEntrypoint(project.root);
    if (result.ok && relative && state.project?.root === project.root) {
      state.project = { ...state.project, entrypointSource: 'manifest', hasManifest: true };
    }
    if (!result.ok && !entrypointWarned) {
      entrypointWarned = true;
      notify(t('project.entrypointLocalOnly'), 'error');
    }
  }

  /**
   * Tras mover o renombrar desde el árbol (RF-69.10, R-F4): el documento
   * abierto, el que compila la vista previa y el documento principal siguen a
   * su fichero. El editor conserva el contenido y el historial de deshacer.
   * @param {Array<{from: string, to: string}>} moved
   */
  async function applyPathMoves(moved) {
    if (!moved.length) return;
    if (state.previewDocument) state.previewDocument = remapMovedPath(state.previewDocument, moved);
    // Pestañas de fondo: siguen a su fichero. Tinymist deja la URI vieja; la
    // nueva se le abre al activar la pestaña.
    for (const [key, entry] of [...background.entries()]) {
      const after = remapMovedPath(entry.document.path, moved);
      if (after === entry.document.path) continue;
      editor.closeDocument(entry.document.path);
      background.delete(key);
      entry.document = { ...entry.document, path: after, fileName: baseName(after) };
      background.set(pathKey(after), entry);
    }
    tabs = remapTabPaths(tabs, moved);

    if (state.project?.entrypoint && !state.project.isSingleFile) {
      const before = joinPath(state.project.root, state.project.entrypoint);
      const after = remapMovedPath(before, moved);
      const relative = after !== before ? relativeToRoot(state.project.root, after) : null;
      if (relative) {
        state.project = { ...state.project, entrypoint: relative };
        tree.setEntrypointPath(after);
        // RF-83.5: el manifiesto se actualiza solo si ya declaraba el principal
        // (renombrar `main.typ` en un proyecto ajeno no debe crear uno).
        await persistEntrypoint(relative, state.project.entrypointSource === 'manifest');
      }
    }

    if (state.document) {
      const after = remapMovedPath(state.document.path, moved);
      if (after !== state.document.path) {
        state.document = { ...state.document, path: after, fileName: baseName(after) };
        editor.setPath(after);
        tree.setActivePath(after);
        renderDocumentBar();
        if (state.project) await watchTabs();
      }
    }
    persistTabs();
    await watchTabs();
    listeners.pathsMoved?.(moved);
  }

  /**
   * Tras eliminar desde el árbol (RF-69.10): si el documento abierto estaba
   * entre lo eliminado (o dentro de una carpeta eliminada), se cierra; si era
   * el principal, pierde la marca. Quien llama ya ha confirmado con el
   * usuario, también los cambios sin guardar.
   * @param {string[]} paths
   */
  async function handleDeletedPaths(paths) {
    if (state.project?.entrypoint && !state.project.isSingleFile) {
      const entry = joinPath(state.project.root, state.project.entrypoint);
      if (isWithinAny(entry, paths)) {
        const inManifest = state.project.entrypointSource === 'manifest';
        state.project = { ...state.project, entrypoint: null, entrypointSource: 'heuristic' };
        tree.setEntrypointPath(null);
        await persistEntrypoint('', inManifest);
      }
    }
    for (const [key, entry] of [...background.entries()]) {
      if (!isWithinAny(entry.document.path, paths)) continue;
      editor.closeDocument(entry.document.path);
      background.delete(key);
      tabs = closeTabModel(tabs, entry.document.path);
    }
    if (state.document && isWithinAny(state.document.path, paths)) {
      const gone = state.document.path;
      tabs = closeTabModel(tabs, gone);
      editor.closeDocument(gone);
      if (tabs.active) {
        cancelScheduledAutoSave();
        state.document = null;
        await showBackground(pathKey(tabs.active));
      } else {
        await detachDocument();
      }
    }
    if (state.previewDocument && isWithinAny(state.previewDocument, paths)) state.previewDocument = null;
    persistTabs();
    await watchTabs();
  }

  /** Deja el editor vacío, sin documento, y se lo dice al observador. */
  async function detachDocument() {
    cancelScheduledAutoSave();
    state.document = null;
    state.dirty = false;
    activeReadOnly = false;
    editor.setDocument('', null);
    tree.setActivePath(null);
    renderDocumentBar();
    listeners.documentDetached?.();
    if (state.project) await watchTabs();
  }

  /**
   * Cierra la pestaña activa (Cmd+W en macOS, R-T7), preguntando antes si
   * tiene cambios sin guardar.
   * @returns {Promise<boolean>} true si se cerró.
   */
  async function closeDocument() {
    return state.document ? closeTab(state.document.path) : false;
  }

  /**
   * Un cambio externo en una pestaña de fondo (R-T4): la misma decisión por
   * contenido que la activa (`decideExternalChange`), aplicada a ESA pestaña.
   * Sin cambios locales se recarga en silencio (al activarla se lee del
   * disco); con cambios, se pregunta nombrándola.
   */
  async function handleBackgroundChanged(path) {
    const key = pathKey(path);
    const entry = background.get(key);
    if (!entry?.saved || conflictDialogOpen) return;
    const fingerprint = await fileFingerprint(entry.document.path);
    if (!fingerprint.ok || background.get(key) !== entry) return;
    const action = decideExternalChange({
      knownHash: entry.document.contentHash,
      fingerprint: fingerprint.value,
      dirty: entry.dirty,
      saving: backgroundSaving.has(key),
      ownOperation: isOwnOperation(entry.document.path),
    });
    if (action === 'defer' || action === 'ignore') return;
    if (action === 'missing') {
      if (!entry.missingNotified) {
        entry.missingNotified = true;
        entry.dirty = true;
        notify(`${t('doc.missingOnDisk')} — ${entry.document.fileName}`, 'error');
        tabsChanged();
      }
      return;
    }
    entry.missingNotified = false;
    let reload = action === 'reload';
    if (!reload) {
      conflictDialogOpen = true;
      try {
        const choice = await dialog.ask({
          titleKey: 'conflict.title',
          textKey: 'conflict.text',
          text: entry.document.path,
          choices: [
            { key: 'keep', labelKey: 'conflict.keepMine', tone: 'primary' },
            { key: 'reload', labelKey: 'conflict.reload', tone: 'danger' },
          ],
        });
        reload = choice === 'reload';
        if (!reload && fingerprint.value.contentHash) entry.document.contentHash = fingerprint.value.contentHash;
      } finally {
        conflictDialogOpen = false;
      }
    }
    if (!reload || background.get(key) !== entry) return;
    // RF-73.1: lo que se descarta queda en el historial local.
    if (entry.dirty && getPref('localHistory')) {
      await historySnapshot(entry.document.path, entry.saved.state.doc.toString(), 'reload');
    }
    // Se vuelve a leer del disco al activarla (como una pestaña restaurada).
    entry.saved = null;
    entry.dirty = false;
    tabsChanged();
  }

  // Un cambio en disco refresca el árbol (ficheros nuevos de un `git pull`, por
  // ejemplo) y se reenvía a la vista previa para que recompile.
  on(PROJECT_CHANGE_EVENT, (change) => {
    const isActiveDocument = Boolean(change.isOpenDocument) && isActivePath(change.path);
    listeners.externalChange?.({ ...change, isActiveDocument });
    if (isActiveDocument) handleActiveDocumentChanged();
    else if (change.isOpenDocument) handleBackgroundChanged(change.path);
    else tree.refresh();
  });

  /**
   * Guarda el documento activo (RF-07, RF-64).
   *
   * Antes de escribir compara la huella del disco con la última conocida
   * (RF-68): si no coinciden, otro programa ha cambiado el contenido y
   * sobrescribirlo sin preguntar destruiría ese trabajo. Que solo cambie la
   * fecha (antivirus, indexador) ya no cuenta como cambio.
   *
   * @param {{auto?: boolean}} [options] `auto: true` es un guardado automático
   *   (RF-64): nunca abre un diálogo, nunca sobrescribe un conflicto y no
   *   avisa de "Documento guardado" en cada pausa de 2 s — el punto de
   *   modificado que se apaga ya es la señal.
   */
  async function save({ auto = false } = {}) {
    if (!state.document) return false;
    // Reentrada (encontrado en /code-simplify): un guardado manual que abre
    // el diálogo de conflicto le quita el foco al editor — eso dispara el
    // `blur` de RF-64.1 y, con el guardado automático encendido, arrancaría
    // un SEGUNDO `save()` mientras el primero sigue esperando la respuesta
    // del usuario (dos escrituras a la vez, o un aviso de "en pausa" por
    // encima del propio diálogo). Un guardado a la vez, sea auto o manual.
    if (saveInFlight) return false;
    if (auto && decideAutoSaveAttempt({ dirty: state.dirty }) === 'skip') return false;

    saveInFlight = true;
    try {
      const fingerprint = await fileFingerprint(state.document.path);
      const changedOnDisk =
        fingerprint.ok &&
        changedOnDiskBeforeSave({ knownHash: state.document.contentHash, fingerprint: fingerprint.value });
      if (changedOnDisk) {
        if (auto) {
          const { shouldNotify } = decideAutoSaveConflict({ alreadyNotified: autoSaveConflictNotified });
          if (shouldNotify) {
            autoSaveConflictNotified = true;
            notify(`${t('doc.autoSaveConflict')} — ${state.document.fileName}`, 'error');
          }
          return false;
        }
        const choices = [
          { key: 'cancel', labelKey: 'action.cancel' },
        ];
        if (diffModal) {
          choices.push({ key: 'diff', labelKey: 'conflict.viewDiff' });
        }
        choices.push(
          { key: 'reload', labelKey: 'conflict.reload' },
          { key: 'overwrite', labelKey: 'conflict.overwrite', tone: 'danger' },
        );
        let choice = await dialog.ask({
          titleKey: 'conflict.title',
          textKey: 'conflict.saveText',
          text: state.document.path,
          choices,
        });
        if (choice === 'diff' && diffModal) {
          const diskRead = await readFile(state.document.path);
          const diskContent = diskRead.ok ? diskRead.value.content : '';
          const diffChoice = await diffModal.open({
            localContent: editor.getContent(),
            diskContent,
          });
          if (diffChoice === 'keep') choice = 'overwrite';
          else if (diffChoice === 'reload') choice = 'reload';
          else choice = 'cancel';
        }
        if (choice === 'cancel') return false;
        if (choice === 'reload') {
          await reloadFromDisk(state.document.path);
          return false;
        }
      }

      // R-A2: se guarda una instantánea del contenido ANTES de `writeFile` —
      // si el usuario sigue escribiendo mientras la escritura está en vuelo,
      // lo que llega a disco es esta instantánea, no lo último tecleado.
      const snapshot = editor.getContent();
      const result = await writeFile(state.document.path, snapshot, auto ? 'auto' : 'save');
      if (!result.ok) {
        notify(`${t('doc.saveError')} — ${result.error.message}`, 'error');
        return false;
      }

      rememberWritten(result.value);
      autoSaveConflictNotified = false;
      missingNotified = false;
      state.dirty = stillDirtyAfterSave({ snapshot, currentContent: editor.getContent() });
      renderDocumentBar();
      listeners.saved?.(auto);
      if (!auto) notify(t('doc.saved'));
      return true;
    } finally {
      saveInFlight = false;
      // Un aviso llegado durante la escritura se mira ahora, ya con la huella
      // nueva: si era el eco de este guardado, coincidirá y no pasará nada.
      if (externalCheckPending) {
        externalCheckPending = false;
        handleActiveDocumentChanged();
      }
    }
  }

  /**
   * «Recargar desde disco» descarta lo que hay en el editor: antes se guarda
   * como versión del historial local (RF-73.1), para que un clic por error no
   * pierda trabajo. Solo si había cambios: si no, editor y disco coinciden.
   */
  async function reloadFromDisk(path) {
    if (state.dirty && getPref('localHistory')) {
      await historySnapshot(path, editor.getContent(), 'reload');
    }
    return openDocument(path, { force: true });
  }

  /** El historial sabe qué proyecto está abierto y si está activo (RF-73.7). */
  function configureHistory() {
    historyConfigure(state.project?.root ?? null, getPref('localHistory')).catch(console.error);
  }
  onPrefsChanged(({ key }) => {
    if (key === 'localHistory') configureHistory();
  });

  /**
   * Restaura `content` (una versión del historial) en el editor como cambio
   * sin guardar, sin escribir en disco (RF-73.5). Abre antes el fichero si no
   * es el que está delante. Ctrl+Z lo deshace de una vez.
   * @returns {Promise<boolean>}
   */
  async function restoreVersion(path, content) {
    if (state.document?.path !== path && !(await openDocument(path))) return false;
    const view = editor.getView();
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
    return true;
  }

  /**
   * Único sitio donde se apunta lo que acabamos de escribir en el documento
   * activo (RF-68, R-C2). Cualquier camino que escriba en él —guardar,
   * reescribir referencias, restaurar una versión— pasa por aquí; si alguno no
   * lo hiciera, su propio eco volvería a verse como un cambio externo.
   * @param {{modifiedMs: number, contentHash: string}} receipt
   */
  function rememberWritten(receipt) {
    if (!state.document) return;
    state.document.modifiedMs = receipt.modifiedMs;
    state.document.contentHash = receipt.contentHash;
  }

  /** Guardar como… (RF-07): escribe en un destino nuevo y sigue editándolo. */
  async function saveAs() {
    if (!state.document) return false;

    const picked = await pickSaveTarget(state.document.fileName, 'Typst', ['typ'], getLastDocumentDir());
    if (!picked.ok || !picked.value) return false;
    rememberDocumentPath(picked.value);

    const result = await writeFile(picked.value, editor.getContent());
    if (!result.ok) {
      notify(`${t('doc.saveError')} — ${result.error.message}`, 'error');
      return false;
    }

    state.dirty = false;
    // Guardar fuera del proyecto activo convierte el destino en el proyecto
    // nuevo; dentro, basta con seguir editando el fichero recién creado, que
    // sustituye a la pestaña del original (como en cualquier editor).
    const insideProject = state.project && picked.value.startsWith(state.project.root);
    if (insideProject) {
      const original = state.document.path;
      await openDocument(picked.value, { force: true });
      if (!isActivePath(original)) {
        background.delete(pathKey(original));
        editor.closeDocument(original);
        tabs = closeTabModel(tabs, original);
        persistTabs();
      }
      await tree.refresh();
    } else {
      await openProjectAt(picked.value);
    }
    notify(t('doc.saved'));
    return true;
  }

  // RF-65.2: "Mostrar ruta completa" repinta la barra del documento al
  // vuelo, igual que las demás casillas del menú Preferencias.
  // Apagar el guardado automático a media pausa cancela lo ya programado
  // (encontrado en /code-simplify): sin esto, una pausa de 2 s que ya
  // estaba en marcha se completaba igual justo después de apagar la
  // opción, en contra de lo que el usuario acababa de pedir.
  onPrefsChanged(({ key, value }) => {
    if (key === 'showFullPath') renderDocumentBar();
    if (key === 'autoSave' && !value) cancelScheduledAutoSave();
  });

  renderProjectBar();
  renderDocumentBar();

  return {
    state,
    editor,
    /**
     * Abre el editor de diagramas (RF-31) cerca de `triggerEl`. RF-45: además
     * del icono de la barra de inserción (que llega aquí a través de
     * `specialHandlers.diagram` en `toolbar.js`), el menú Herramientas
     * necesita la MISMA acción desde un botón propio — ambos abren el mismo
     * editor, sin lógica duplicada.
     */
    openDiagramEditor(triggerEl) {
      diagramEditor?.openNear(triggerEl);
    },
    /** Abre el editor visual de ecuaciones (RF-46), mismo patrón que `openDiagramEditor`. */
    openEquationEditor(triggerEl) {
      equationEditor?.openNear(triggerEl);
    },
    /** Abre el asistente de diagramas de secuencia (RF-48), mismo patrón que `openDiagramEditor`. */
    openSequenceEditor(triggerEl) {
      sequenceEditor?.openNear(triggerEl);
    },
    /** Abre el asistente de diagramas de Gantt (RF-49), mismo patrón que `openDiagramEditor`. */
    openGanttEditor(triggerEl) {
      ganttEditor?.openNear(triggerEl);
    },
    /** Abre el asistente de tableros Kanban (RF-50), mismo patrón que `openDiagramEditor`. */
    openKanbanEditor(triggerEl) {
      kanbanEditor?.openNear(triggerEl);
    },
    /** Abre el asistente de DOT/Graphviz (RF-51), mismo patrón que `openDiagramEditor`. */
    openDotEditor(triggerEl) {
      dotEditor?.openNear(triggerEl);
    },
    openProjectAt,
    openDocument,
    /**
     * Lleva el editor a `file:line` (RF-16, render → editor). `file` viene
     * relativo a la raíz del proyecto, que es como lo guardan las anclas, y se
     * abre el fichero si no es el que ya está delante. Con `range` (motor en
     * proceso, RF-57) se selecciona y marca ese rango exacto en vez del bloque.
     */
    async goToSource(file, line, range = null) {
      if (!state.project) return false;

      const absolute = joinPath(state.project.root, file);
      if (absolute !== state.document?.path && !(await openDocument(absolute))) return false;

      const view = editor.getView();
      if (!view) return false;
      // Una línea fuera del documento (el fuente cambió desde la última
      // compilación) se recorta al final en vez de reventar el editor.
      // Centrado y con el bloque resaltado unos segundos: sin marca, en un
      // fichero largo no había forma de ver a qué bloque había saltado.
      if (range) revealRangeAndFlash(view, range.from, range.to);
      else revealAndFlash(view, line);
      view.focus();
      return true;
    },
    /** Fichero abierto y línea del cursor, relativos a la raíz (RF-16). */
    getCursorSource() {
      const view = editor.getView();
      if (!view || !state.project || !state.document) return null;

      const file = relativeToRoot(state.project.root, state.document.path);
      if (file === null) return null;

      return {
        file,
        line: view.state.doc.lineAt(view.state.selection.main.head).number,
        from: view.state.selection.main.from,
        to: view.state.selection.main.to,
        docLength: view.state.doc.length,
        path: state.document.path,
      };
    },
    closeProject,
    closeDocument,
    closeTab,
    activateTab,
    cycleTab,
    /** Pestañas abiertas en orden, con su nombre y si tienen cambios (barra de pestañas). */
    getTabs: listTabs,
    moveTab,
    hasUnsavedChanges,
    /**
     * Contenido actual de una pestaña cargada (con sus cambios sin guardar),
     * o `null` si el fichero no está abierto (o aún no se ha cargado): la
     * edición en varios ficheros (RF-77, RF-78) usa entonces el del disco.
     * @param {string} path
     * @returns {string | null}
     */
    getTabContent(path) {
      if (isActivePath(path)) return editor.getContent();
      const entry = background.get(pathKey(path));
      return entry?.saved ? entry.saved.state.doc.toString() : null;
    },
    /** Raíz del proyecto abierto, o `null`. */
    getRoot: () => state.project?.root ?? null,
    /**
     * Todas las pestañas cargadas (de cualquier tipo) con su contenido del
     * editor: la búsqueda en el proyecto (RF-78.2) las busca ahí, con sus
     * cambios sin guardar, y no en el disco.
     * @returns {Array<{path: string, content: string}>}
     */
    getOpenTexts: () => openTexts(),
    /** ¿La última compilación del motor tuvo errores? (R-L2: las etiquetas no se resuelven). */
    hasEngineErrors: () => engineDiagnostics.some((diagnostic) => diagnostic.level === 'error'),
    /** ¿Tiene cambios sin guardar alguna pestaña de `paths` o de dentro de esas carpetas? */
    hasUnsavedChangesIn(paths) {
      return dirtyTabs().some((tab) => isWithinAny(tab.path, paths));
    },
    revealProject,
    save,
    saveAs,
    /** RF-64.1: guardado automático al perder el foco de la VENTANA (main.js escucha `blur`); el del editor ya está cableado dentro de `createEditor`. */
    flushAutoSaveOnBlur,
    suggestedPdfName,
    exportPdf: exportToPdf,
    /** Objetivo de compilación vigente (RF-14), o `null` si no hay nada que compilar. */
    getCompileTarget,
    /**
     * RF-93.3: la vista previa compila con estos ficheros (`{path, content}`,
     * rutas absolutas) en memoria, sin tocar el disco; `null` vuelve a lo real.
     * Quien llama recompila la vista previa.
     */
    setPreviewOverrides(files) {
      previewOverrides = files?.length ? files : null;
    },
    hasPreviewOverrides: () => previewOverrides !== null,
    /** Alcance actual de la vista previa: 'document' | 'file'. */
    /** Diagnósticos del motor en proceso (RF-59): se subrayan y se combinan con los de Tinymist. */
    setEngineDiagnostics(diagnostics) {
      engineDiagnostics = diagnostics;
      applyDiagnostics();
    },
    /** Vista de CodeMirror del editor (o `null`), para el menú contextual (RF-58). */
    getEditorView: () => editor.getView(),
    getPreviewScope: () => state.previewScope,
    /** Cambia el alcance y lo recuerda para este proyecto. Devuelve el nuevo. */
    setPreviewScope(scope) {
      state.previewScope = scope === 'file' ? 'file' : 'document';
      if (state.project) {
        try {
          localStorage.setItem(scopeKey(state.project.root), state.previewScope);
        } catch {
          // Sin almacenamiento el alcance simplemente no se recuerda; no es
          // motivo para impedir el cambio.
        }
      }
      return state.previewScope;
    },
    /**
     * Marca un `.typ` (por defecto el abierto) como documento principal del
     * proyecto. Devuelve su ruta relativa, o `null` si no se puede (sin
     * proyecto, un `.typ` suelto, o no es un `.typ` de dentro del proyecto).
     * Se guarda en el manifiesto en segundo plano (RF-83): el resultado no
     * cambia lo que se devuelve, solo si se avisa de que quedó en este equipo.
     */
    setEntrypoint(targetPath) {
      const project = state.project;
      const relative = resolveEntrypoint(project, targetPath ?? state.document?.path);
      if (!relative) return null;
      state.project = { ...project, entrypoint: relative };
      // Al fijar el principal, el alcance vuelve a "documento": es lo que se
      // pretende al elegirlo.
      state.previewScope = 'document';
      pendingEntrypointWrite = persistEntrypoint(relative, true);
      try {
        localStorage.setItem(scopeKey(project.root), 'document');
      } catch {
        // Sin almacenamiento vale solo para esta sesión.
      }
      tree.setEntrypointPath(joinPath(project.root, relative));
      return relative;
    },
    /** Documento principal vigente del proyecto (ruta relativa), o `null`. */
    getEntrypoint: () => state.project?.entrypoint ?? null,
    /** Promesa de la última escritura del principal en el manifiesto (para los tests). */
    whenEntrypointSaved: () => pendingEntrypointWrite,
    /** True si el proyecto tiene un documento raíz distinto del fichero abierto. */
    hasRootDocument: () => hasRootDocument(state.project),
    suggestedPngName(page) {
      if (!state.document) return `documento-${page}.png`;
      return `${state.document.fileName.replace(/\.typ$/i, '')}-p${page}.png`;
    },
    exportPng,
    suggestedArchiveName,
    exportArchive,
    confirmDiscardChanges,
    /** @param {'dark'|'light'|'sepia'} theme */
    setTheme(theme) {
      editor.setTheme(theme);
    },
    runOwnOperation,
    restoreVersion,
    /** Contenido actual del editor. */
    getContent: () => editor.getContent(),
    applyPathMoves,
    handleDeletedPaths,
    /** Ruta del documento abierto, o `null`. */
    getDocumentPath: () => state.document?.path ?? null,
    /**
     * Documento activo con su contenido ACTUAL (cambios sin guardar
     * incluidos), para que RF-70 lo edite en memoria y nunca en disco.
     * @returns {{path: string, content: string} | null}
     */
    getOpenDocumentSnapshot() {
      if (!state.document || !isTypstPath(state.document.path)) return null;
      return { path: state.document.path, content: editor.getContent() };
    },
    /**
     * TODAS las pestañas Typst cargadas con su contenido actual (R-T3): RF-70
     * edita su texto en memoria y nunca su disco. Las restauradas que aún no
     * se han cargado no están aquí: su disco es su contenido.
     * @returns {Array<{path: string, content: string}>}
     */
    getOpenDocumentsSnapshot() {
      return openTexts().filter((doc) => isTypstPath(doc.path));
    },
    /**
     * Aplica ediciones (posiciones UTF-16 del contenido de la instantánea) a
     * una pestaña en UNA transacción: queda modificada y Ctrl+Z las deshace de
     * una vez (RF-70.5). Sin `path`, o si es la activa, al editor; si es de
     * fondo, a su `EditorState` guardado (R-T3), y Tinymist recibe el texto.
     * @param {Array<{from: number, to: number, insert: string}>} edits
     * @param {string} [path]
     */
    applyBufferEdits(edits, path) {
      if (edits.length === 0) return;
      const changes = edits.map(({ from, to, insert }) => ({ from, to, insert }));
      if (!path || isActivePath(path)) {
        editor.getView()?.dispatch({ changes });
        return;
      }
      const entry = background.get(pathKey(path));
      if (!entry?.saved) return;
      entry.saved = { ...entry.saved, state: entry.saved.state.update({ changes }).state };
      entry.dirty = true;
      lspClient?.updateDocument?.(entry.document.path, entry.saved.state.doc.toString());
      tabsChanged();
    },
    /** True si el documento abierto tiene cambios sin guardar. */
    isDirty: () => state.dirty,
    /** @param {{modifiedMs: number, contentHash: string}} receipt */
    markSaved(receipt) {
      if (!state.document) return;
      rememberWritten(receipt);
      state.dirty = false;
      renderDocumentBar();
    },
    /** Registra los ganchos que rellenan los slices 5 y 6. */
    setListener(name, handler) {
      listeners[name] = handler;
    },
    renderDocumentBar,
    formatDocument: () => editor.formatDocument?.(),
    insertFigureForPath(path) {
      const view = editor.getView();
      if (!view) return;
      view.dispatch(figureActionForPath(path)(view.state));
      view.focus();
    },
  };
}
