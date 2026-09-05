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

import { createBibEntryPanel } from '../bibliography/bibEntryPanel.js';
import { createCitationPicker } from '../editor/citationPicker.js';
import { createEditor } from '../editor/editor.js';
import { createSymbolPicker } from '../editor/symbolPicker.js';
import { createTableDialog } from '../editor/tableDialog.js';
import { createToolbar } from '../editor/toolbar.js';
import { figureActionForPath } from '../editor/toolbarActions.js';
import { t } from '../i18n/i18n.js';
import { getTheme } from '../themes/theme.js';
import { isTypstPath, joinPath } from './paths.js';
import {
  PROJECT_CHANGE_EVENT,
  addRecentProject,
  copyAssetIntoProject,
  exportPdf,
  exportPng as backendExportPng,
  exportProjectArchive,
  fileModifiedMs,
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

/**
 * Ventana durante la que se ignoran los avisos del watcher sobre el documento
 * activo tras un guardado propio. Sin ella, cada `Guardar` se detectaría a sí
 * mismo como "alguien ha modificado el fichero por fuera" — el mismo mecanismo
 * de supresión de auto-eco (`suppressSelfWriteUntil`) de DBV Markdown Reader.
 */
const SELF_WRITE_GRACE_MS = 1500;

// `joinPath`/`isTypstPath`/`baseName` viven en `paths.js` (Beta, §7.11): un
// módulo hoja del que `bibliography/bibEntryPanel.js` puede importar sin
// crear un ciclo (`workspace.js` → `bibEntryPanel.js` → `workspace.js`). Se
// re-exportan aquí para no romper a quien ya las importaba de este fichero.
export { baseName, isTypstPath, joinPath } from './paths.js';

/**
 * @param {object} deps
 * @param {ReturnType<import('../project-explorer/projectTree.js').createProjectTree>} deps.tree
 * @param {Record<string, HTMLElement>} deps.elements
 * @param {(message: string, tone?: 'info'|'error') => void} deps.notify
 * @param {ReturnType<import('../ui/choiceDialog.js').createChoiceDialog>} deps.dialog
 */
export function createWorkspace({ tree, elements, notify, dialog }) {
  // Declarado antes del editor a propósito: `onSelectionChange` se dispara en
  // tiempo de ejecución, no al construir el objeto, así que el cierre puede
  // referenciar `toolbar` aunque todavía no se le haya asignado nada.
  let toolbar;
  let citationPicker;
  let symbolPicker;
  let tableDialog;
  const editor = createEditor(elements.editorHost, {
    theme: getTheme(),
    onChange: (content) => {
      state.dirty = true;
      renderDocumentBar();
      // La vista previa solo se alimenta en vivo si lo que se está editando es
      // el documento que ella compila. Al editar `refs.bib` o un `.toml`, ese
      // contenido no es un documento Typst: mandarlo compilaría la bibliografía
      // como si fuera el documento. Esos ficheros llegan a la vista previa por
      // la vía normal — al guardarlos, el observador dispara la recompilación.
      if (isTypstPath(state.document?.path)) listeners.documentChanged?.(content);
    },
    onSave: () => listeners.saveRequested?.(),
    onSelectionChange: () => toolbar?.refresh(),
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
      // Beta, §7.7.4: vía alternativa a arrastrar y soltar (Slice 19) — un
      // selector nativo de fichero, mismo destino final (`images/` del
      // proyecto) y misma inserción con el hueco en el pie de figura.
      figure: () => insertFigureFromDialog(),
    },
  });

  const state = {
    /** @type {null | {root: string, name: string, entrypoint: string|null, isSingleFile: boolean, hasManifest: boolean}} */
    project: null,
    /** @type {null | {path: string, fileName: string, modifiedMs: number}} */
    document: null,
    dirty: false,
    /** Instante hasta el que se ignora el eco del propio guardado. */
    suppressSelfWriteUntil: 0,
  };

  citationPicker = createCitationPicker({
    panelEl: elements.citationPanel,
    listEl: elements.citationList,
    filterEl: elements.citationFilter,
    newEntryButtonEl: elements.citationNewEntry,
    onCreateNew: () => bibEntryPanel.open(),
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
  };

  function renderDocumentBar() {
    const hasDocument = Boolean(state.document);
    elements.documentName.textContent = hasDocument ? state.document.fileName : '—';
    elements.documentDirty.classList.toggle('hidden', !state.dirty);
    elements.documentPath.textContent = hasDocument ? state.document.path : '';
  }

  function renderProjectBar() {
    const hasProject = Boolean(state.project);
    elements.projectName.textContent = hasProject ? state.project.name : t('project.none');
    elements.workspaceView.classList.toggle('hidden', !hasProject);
    elements.emptyView.classList.toggle('hidden', hasProject);
    elements.projectActions.classList.toggle('hidden', !hasProject);
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
   */
  async function confirmDiscardChanges() {
    if (!state.dirty) return true;
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
    };
    state.dirty = false;
    tree.setActivePath(payload.path);
    renderDocumentBar();

    // Abrir un fichero acompañante (`.bib`, `.toml`) NO cambia lo que compila la
    // vista previa: se sigue viendo el documento, que es lo que el usuario está
    // escribiendo. Solo se le avisa de que el editor ya no está encima de él,
    // para que deje de usar el contenido en vivo y compile lo que hay en disco.
    if (isTypstPath(payload.path)) {
      listeners.documentOpened?.({ ...state.document, content: payload.content });
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
    state.document = null;
    state.dirty = false;
    renderProjectBar();
    renderDocumentBar();

    await tree.setRoot(state.project.root, { force: true });
    // Un `.typ` suelto se reabre por su fichero, no por su carpeta; el separador
    // lo pone `joinPath`, que respeta el de la plataforma.
    await addRecentProject({
      ...state.project,
      path: state.project.isSingleFile
        ? joinPath(state.project.root, state.project.entrypoint)
        : state.project.root,
    });
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
    state.project = null;
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
   * versión antigua del disco que sería una sorpresa desagradable.
   */
  async function exportToPdf(output) {
    if (!state.document || !state.project) return false;

    notify(t('export.working'));
    const result = await exportPdf({
      document: state.document.path,
      root: state.project.root,
      output,
      content: state.dirty ? editor.getContent() : null,
    });

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
    if (!state.document || !state.project) return false;

    notify(t('export.pngWorking'));
    const result = await backendExportPng({
      document: state.document.path,
      root: state.project.root,
      output,
      page,
      content: state.dirty ? editor.getContent() : null,
    });

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
   * Alguien ha modificado por fuera el documento que hay abierto.
   *
   * Tres casos distintos, y la diferencia importa:
   *   · es el eco de nuestro propio guardado → se ignora;
   *   · no hay cambios locales → se recarga en silencio (es lo que espera quien
   *     acaba de hacer `git pull` o de editar en otro programa);
   *   · hay cambios locales → conflicto real, y solo entonces se interrumpe.
   */
  async function handleActiveDocumentChanged() {
    if (Date.now() < state.suppressSelfWriteUntil) return;
    if (!state.document) return;

    if (!state.dirty) {
      await openDocument(state.document.path, { force: true });
      notify(t('conflict.reloaded'));
      return;
    }

    const choice = await dialog.ask({
      titleKey: 'conflict.title',
      textKey: 'conflict.text',
      text: state.document.path,
      choices: [
        { key: 'keep', labelKey: 'conflict.keepMine', tone: 'primary' },
        { key: 'reload', labelKey: 'conflict.reload', tone: 'danger' },
      ],
    });

    if (choice === 'reload') {
      await openDocument(state.document.path, { force: true });
      return;
    }
    // "Conservar lo mío": se actualiza la referencia de disco para que el
    // siguiente `Guardar` no vuelva a preguntar por el mismo cambio ya visto.
    const stamp = await fileModifiedMs(state.document.path);
    if (stamp.ok) state.document.modifiedMs = stamp.value;
  }

  // Un cambio en disco refresca el árbol (ficheros nuevos de un `git pull`, por
  // ejemplo) y se reenvía a la vista previa para que recompile.
  on(PROJECT_CHANGE_EVENT, (change) => {
    listeners.externalChange?.(change);
    if (change.isActiveDocument) handleActiveDocumentChanged();
    else tree.refresh();
  });

  /**
   * Guarda el documento activo (RF-07).
   *
   * Antes de escribir compara la marca de modificación del disco con la que se
   * leyó al abrir: si no coinciden, otro programa ha tocado el fichero y
   * sobrescribirlo sin preguntar destruiría ese trabajo.
   */
  async function save() {
    if (!state.document) return false;

    const stamp = await fileModifiedMs(state.document.path);
    const changedOnDisk = stamp.ok && stamp.value !== state.document.modifiedMs;
    if (changedOnDisk) {
      const choice = await dialog.ask({
        titleKey: 'conflict.title',
        textKey: 'conflict.saveText',
        text: state.document.path,
        choices: [
          { key: 'cancel', labelKey: 'action.cancel' },
          { key: 'reload', labelKey: 'conflict.reload' },
          { key: 'overwrite', labelKey: 'conflict.overwrite', tone: 'danger' },
        ],
      });
      if (choice === 'cancel') return false;
      if (choice === 'reload') {
        await openDocument(state.document.path, { force: true });
        return false;
      }
    }

    const result = await writeFile(state.document.path, editor.getContent());
    if (!result.ok) {
      notify(`${t('doc.saveError')} — ${result.error.message}`, 'error');
      return false;
    }

    // La supresión se arma ANTES de que llegue el evento del watcher.
    state.suppressSelfWriteUntil = Date.now() + SELF_WRITE_GRACE_MS;
    state.document.modifiedMs = result.value;
    state.dirty = false;
    renderDocumentBar();
    listeners.saved?.();
    notify(t('doc.saved'));
    return true;
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

    state.suppressSelfWriteUntil = Date.now() + SELF_WRITE_GRACE_MS;
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

  renderProjectBar();
  renderDocumentBar();

  return {
    state,
    editor,
    openProjectAt,
    openDocument,
    closeProject,
    revealProject,
    save,
    saveAs,
    suggestedPdfName,
    exportPdf: exportToPdf,
    suggestedPngName(page) {
      if (!state.document) return `documento-${page}.png`;
      return `${state.document.fileName.replace(/\.typ$/i, '')}-p${page}.png`;
    },
    exportPng,
    suggestedArchiveName,
    exportArchive,
    confirmDiscardChanges,
    /** @param {'dark'|'light'} theme */
    setTheme(theme) {
      editor.setTheme(theme);
    },
    markSaved(modifiedMs) {
      if (!state.document) return;
      state.document.modifiedMs = modifiedMs;
      state.dirty = false;
      renderDocumentBar();
    },
    /** Registra los ganchos que rellenan los slices 5 y 6. */
    setListener(name, handler) {
      listeners[name] = handler;
    },
    renderDocumentBar,
  };
}
