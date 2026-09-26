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
import { baseName, isTypstPath, joinPath, relativeToRoot, remapMovedPath } from './paths.js';
import { buildCompileTarget, hasRootDocument } from './compileTarget.js';
import {
  decideAutoSaveAttempt,
  decideAutoSaveConflict,
  decideUnsavedChangesAction,
  stillDirtyAfterSave,
} from './autoSave.js';
import { changedOnDiskBeforeSave, decideExternalChange, isWithinAny } from './externalChange.js';
import { shortPathLabel } from './pathLabel.js';
import { getPref, onPrefsChanged } from './prefs.js';
import {
  PROJECT_CHANGE_EVENT,
  addRecentProject,
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
      save({ auto: true });
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
    if (!getPref('autoSave') || !state.dirty) return;
    cancelScheduledAutoSave();
    save({ auto: true });
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
  });

  // Diagnósticos (RF-59): los de Tinymist y los del motor en proceso se
  // guardan por separado y se combinan al pintar, sin duplicar. Así el subrayado
  // sigue funcionando con Tinymist apagado.
  let tinymistDiagnostics = [];
  let engineDiagnostics = [];

  function applyDiagnostics() {
    const view = editor.getView();
    if (!view) return;
    const file = state.project && state.document ? relativeToRoot(state.project.root, state.document.path) : null;
    const own = toEditorDiagnostics(engineDiagnostics, file, view.state.doc);
    editor.setDiagnostics(mergeDiagnostics(own, tinymistDiagnostics));
  }

  lspClient?.setDiagnosticsHandler?.((diagnostics) => {
    const view = editor.getView();
    if (!view) return;
    const cmDiagnostics = diagnostics.map((d) => {
      const from = posFromLsp(view.state.doc, d.range.start);
      const to = posFromLsp(view.state.doc, d.range.end);
      const severity = d.severity === 1 ? 'error' : d.severity === 2 ? 'warning' : 'info';
      return {
        from,
        to: Math.max(from, to),
        severity,
        message: d.message,
        source: d.source || 'Tinymist',
      };
    });
    tinymistDiagnostics = cmDiagnostics;
    applyDiagnostics();
    listeners.diagnosticsUpdated?.(cmDiagnostics);
  });
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
  function getCompileTarget() {
    const dirtyPath = state.dirty && state.document ? state.document.path : null;
    return buildCompileTarget({
      project: state.project,
      previewDocument: state.previewDocument,
      dirtyPath,
      dirtyContent: dirtyPath ? editor.getContent() : null,
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
    /** @type {null | ((change: {path: string, isActiveDocument: boolean}) => void)} */
    externalChange: null,
    /** @type {null | ((project: object) => void)} */
    projectOpened: null,
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
  };

  function renderDocumentBar() {
    const hasDocument = Boolean(state.document);
    // RF-65: por defecto solo el nombre, ampliado tramo a tramo SOLO si otro
    // fichero del proyecto comparte nombre (`tree.getKnownFiles()`, los ya
    // cargados en el árbol — no hace falta una lista completa para acertar en
    // el caso normal). La ruta completa siempre va en el tooltip, la muestre
    // o no `.document__path` (ajuste "Mostrar ruta completa").
    if (hasDocument) {
      const knownPaths = tree.getKnownFiles().map((f) => f.path);
      elements.documentName.textContent = shortPathLabel(state.document.path, knownPaths);
      elements.documentName.title = state.document.path;
    } else {
      elements.documentName.textContent = '—';
      elements.documentName.title = '';
    }
    // RF-64.3: punto de modificado estilo Mac, no solo color — el texto vive
    // en `title`/`aria-label` (lector de pantalla y tooltip), no en la forma.
    elements.documentDirty.classList.toggle('hidden', !state.dirty);
    elements.documentDirty.title = t('doc.unsaved');
    elements.documentDirty.setAttribute('aria-label', t('doc.unsaved'));
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
  async function confirmDiscardChanges() {
    if (!state.dirty) return true;
    const decision = decideUnsavedChangesAction({ dirty: state.dirty, autoSave: getPref('autoSave') });
    if (decision === 'save-then-continue') {
      cancelScheduledAutoSave();
      await save({ auto: true });
      if (!state.dirty) return true;
    }
    const choice = await dialog.ask({
      titleKey: 'doc.discardTitle',
      textKey: 'doc.discardConfirm',
      text: state.document?.fileName ?? '',
      choices: [
        { key: 'cancel', labelKey: 'action.cancel', tone: 'primary' },
        { key: 'discard', labelKey: 'doc.discardAction', tone: 'danger' },
      ],
    });
    return choice === 'discard';
  }

  /** Abre un documento del proyecto en el editor. */
  async function openDocument(path, { force = false } = {}) {
    if (!force && path !== state.document?.path && !(await confirmDiscardChanges())) return false;
    cancelScheduledAutoSave();

    const result = await readFile(path);
    if (!result.ok) {
      notify(`${t('doc.openError')} — ${result.error.message}`, 'error');
      return false;
    }

    const payload = result.value;
    editor.setDocument(payload.content, payload.path);
    state.document = {
      path: payload.path,
      fileName: payload.fileName,
      modifiedMs: payload.modifiedMs,
      contentHash: payload.contentHash,
    };
    state.dirty = false;
    // Otro documento es otro episodio: el conflicto del anterior, si lo
    // hubiera, ya no aplica.
    autoSaveConflictNotified = false;
    missingNotified = false;
    tree.setActivePath(payload.path);
    renderDocumentBar();

    // Abrir un fichero acompañante (`.bib`, `.toml`) NO cambia lo que compila la
    // vista previa: se sigue viendo el documento, que es lo que el usuario está
    // escribiendo. Solo se le avisa de que el editor ya no está encima de él,
    // para que deje de usar el contenido en vivo y compile lo que hay en disco.
    applyDiagnostics();
    if (isTypstPath(payload.path)) {
      state.previewDocument = payload.path;
      listeners.documentOpened?.();
    } else {
      listeners.documentDetached?.();
    }

    // El watcher debe saber cuál es el documento activo para poder distinguir
    // "recompila" de "aviso de conflicto" (Slice 6).
    if (state.project) {
      await watchProject(state.project.root, payload.path);
    }
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

    state.project = result.value;
    configureHistory();
    // El documento principal elegido a mano manda sobre la heurística, si el
    // fichero sigue existiendo (se comprueba: pudo borrarse o renombrarse).
    const storedEntrypoint = state.project.isSingleFile ? null : readStoredEntrypoint(state.project.root);
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

    if (state.project.entrypoint) {
      await openDocument(joinPath(state.project.root, state.project.entrypoint), { force: true });
    } else {
      await watchProject(state.project.root, null);
      notify(t('project.noEntrypoint'));
    }
    return true;
  }

  async function closeProject() {
    if (!(await confirmDiscardChanges())) return false;
    await unwatchProject();
    lspClient?.stop();
    state.project = null;
    configureHistory();
    state.document = null;
    state.dirty = false;
    renderProjectBar();
    renderDocumentBar();
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

  /**
   * Tras mover o renombrar desde el árbol (RF-69.10, R-F4): el documento
   * abierto, el que compila la vista previa y el documento principal siguen a
   * su fichero. El editor conserva el contenido y el historial de deshacer.
   * @param {Array<{from: string, to: string}>} moved
   */
  async function applyPathMoves(moved) {
    if (!moved.length) return;
    if (state.previewDocument) state.previewDocument = remapMovedPath(state.previewDocument, moved);

    if (state.project?.entrypoint && !state.project.isSingleFile) {
      const before = joinPath(state.project.root, state.project.entrypoint);
      const after = remapMovedPath(before, moved);
      const relative = after !== before ? relativeToRoot(state.project.root, after) : null;
      if (relative) {
        state.project = { ...state.project, entrypoint: relative };
        storeEntrypoint(state.project.root, relative);
        tree.setEntrypointPath(after);
      }
    }

    if (state.document) {
      const after = remapMovedPath(state.document.path, moved);
      if (after !== state.document.path) {
        state.document = { ...state.document, path: after, fileName: baseName(after) };
        editor.setPath(after);
        tree.setActivePath(after);
        renderDocumentBar();
        if (state.project) await watchProject(state.project.root, after);
      }
    }
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
        state.project = { ...state.project, entrypoint: null };
        storeEntrypoint(state.project.root, '');
        tree.setEntrypointPath(null);
      }
    }
    if (state.document && isWithinAny(state.document.path, paths)) {
      cancelScheduledAutoSave();
      state.document = null;
      state.dirty = false;
      editor.setDocument('', null);
      tree.setActivePath(null);
      renderDocumentBar();
      listeners.documentDetached?.();
      if (state.project) await watchProject(state.project.root, null);
    }
    if (state.previewDocument && isWithinAny(state.previewDocument, paths)) state.previewDocument = null;
  }

  // Un cambio en disco refresca el árbol (ficheros nuevos de un `git pull`, por
  // ejemplo) y se reenvía a la vista previa para que recompile.
  on(PROJECT_CHANGE_EVENT, (change) => {
    listeners.externalChange?.(change);
    if (change.isActiveDocument) handleActiveDocumentChanged();
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

    const picked = await pickSaveTarget(state.document.fileName, 'Typst', ['typ']);
    if (!picked.ok || !picked.value) return false;

    const result = await writeFile(picked.value, editor.getContent());
    if (!result.ok) {
      notify(`${t('doc.saveError')} — ${result.error.message}`, 'error');
      return false;
    }

    state.dirty = false;
    // Guardar fuera del proyecto activo convierte el destino en el proyecto
    // nuevo; dentro, basta con seguir editando el fichero recién creado.
    const insideProject = state.project && picked.value.startsWith(state.project.root);
    if (insideProject) {
      await openDocument(picked.value, { force: true });
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
    revealProject,
    save,
    saveAs,
    /** RF-64.1: guardado automático al perder el foco de la VENTANA (main.js escucha `blur`); el del editor ya está cableado dentro de `createEditor`. */
    flushAutoSaveOnBlur,
    suggestedPdfName,
    exportPdf: exportToPdf,
    /** Objetivo de compilación vigente (RF-14), o `null` si no hay nada que compilar. */
    getCompileTarget,
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
     */
    setEntrypoint(targetPath) {
      const project = state.project;
      const relative = resolveEntrypoint(project, targetPath ?? state.document?.path);
      if (!relative) return null;
      state.project = { ...project, entrypoint: relative };
      // Al fijar el principal, el alcance vuelve a "documento": es lo que se
      // pretende al elegirlo.
      state.previewScope = 'document';
      storeEntrypoint(project.root, relative);
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
     * Documento abierto con su contenido ACTUAL (cambios sin guardar
     * incluidos), para que RF-70 lo edite en memoria y nunca en disco.
     * @returns {{path: string, content: string} | null}
     */
    getOpenDocumentSnapshot() {
      if (!state.document || !isTypstPath(state.document.path)) return null;
      return { path: state.document.path, content: editor.getContent() };
    },
    /**
     * Aplica ediciones (posiciones UTF-16 del contenido de la instantánea) al
     * editor en UNA transacción: el documento queda modificado y Ctrl+Z las
     * deshace de una vez (RF-70.5).
     * @param {Array<{from: number, to: number, insert: string}>} edits
     */
    applyBufferEdits(edits) {
      const view = editor.getView();
      if (!view || edits.length === 0) return;
      view.dispatch({ changes: edits.map(({ from, to, insert }) => ({ from, to, insert })) });
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
