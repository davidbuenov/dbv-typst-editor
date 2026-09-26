// =============================================================================
// DBV Typst Editor — «Nuevo capítulo…» (RF-71, frontend)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Crear un capítulo era salir al explorador del sistema, crear un fichero
// vacío, volver y escribir el `#include` a mano. Aquí es un diálogo: título,
// nombre de fichero (derivado del título, editable) y carpeta (la de los
// capítulos que ya hay). El backend (`chapters.rs`) crea el fichero y coloca
// el `#include` tras el último de nivel superior del documento principal.

import { t } from '../i18n/i18n.js';
import { joinPath, relativeToRoot, samePath } from '../app/paths.js';
import { chapterCreate, chapterFolder, chapterLink, readFile } from '../services/backend.js';

/**
 * Nombre de fichero para un capítulo a partir de su título: minúsculas, sin
 * acentos ni espacios, `.typ`. Sin nada aprovechable, `capitulo.typ`.
 * @param {string} title
 * @returns {string}
 */
export function slugifyTitle(title) {
  const slug = (title ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `${slug || 'capitulo'}.typ`;
}

/**
 * Modal del capítulo. `open` resuelve cuando se crea o se cancela; `submit`
 * devuelve un mensaje de error para mostrarlo sin cerrar, o `null` si todo fue bien.
 * @param {{dialogEl: HTMLElement, formEl: HTMLFormElement, headingEl: HTMLInputElement, fileEl: HTMLInputElement, folderEl: HTMLInputElement, errorEl: HTMLElement, cancelEl: HTMLElement}} elements
 */
export function createChapterDialog({ dialogEl, formEl, headingEl, fileEl, folderEl, errorEl, cancelEl }) {
  let fileTouched = false;
  let current = null;

  const showError = (message) => {
    errorEl.textContent = message ?? '';
    errorEl.classList.toggle('hidden', !message);
  };
  const close = () => {
    dialogEl.classList.add('hidden');
    const done = current?.resolve;
    current = null;
    done?.();
  };

  headingEl.addEventListener('input', () => {
    if (!fileTouched) fileEl.value = slugifyTitle(headingEl.value);
  });
  fileEl.addEventListener('input', () => {
    fileTouched = fileEl.value.trim() !== '';
  });
  cancelEl.addEventListener('click', close);
  dialogEl.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && current) {
      event.stopPropagation();
      close();
    }
  });
  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!current || current.busy) return;
    const title = headingEl.value.trim();
    const fileName = fileEl.value.trim() || slugifyTitle(title);
    if (!title) {
      showError(t('chapter.needsTitle'));
      headingEl.focus();
      return;
    }
    current.busy = true;
    const error = await current.submit({
      title,
      fileName: /\.typ$/i.test(fileName) ? fileName : `${fileName}.typ`,
      folder: folderEl.value.trim().replace(/^[\\/]+|[\\/]+$/g, ''),
    });
    if (!current) return;
    current.busy = false;
    if (error) showError(error);
    else close();
  });

  /**
   * @param {{folder: string, submit: (values: {title: string, fileName: string, folder: string}) => Promise<string|null>}} options
   * @returns {Promise<void>}
   */
  function open({ folder, submit }) {
    headingEl.value = '';
    fileEl.value = '';
    folderEl.value = folder;
    fileTouched = false;
    showError(null);
    dialogEl.classList.remove('hidden');
    headingEl.focus();
    return new Promise((resolve) => {
      current = { submit, resolve, busy: false };
    });
  }

  return { open };
}

/**
 * @param {object} deps
 * @param {object} deps.tree       Árbol (`getRoot`, `refresh`, `revealPath`).
 * @param {object} deps.workspace  El de `createWorkspace`.
 * @param {{open: Function}} deps.dialog  El de `createChapterDialog`.
 * @param {(message: string, tone?: string) => void} deps.notify
 */
export function createChapterFlow({ tree, workspace, dialog, notify }) {
  /** Contenido actual del principal: el del editor si está abierto (con sus cambios), si no el del disco. */
  async function mainContent(mainPath) {
    const snapshot = workspace.getOpenDocumentSnapshot();
    if (snapshot && samePath(snapshot.path, mainPath)) return { open: true, content: snapshot.content };
    const read = await readFile(mainPath);
    return { open: false, content: read.ok ? read.value.content : '' };
  }

  /** Enlaza el capítulo en el principal y devuelve si el principal quedó con cambios propios del usuario. */
  async function link(root, mainPath, chapterPath) {
    const main = await mainContent(mainPath);
    const hadOwnChanges = main.open && workspace.isDirty();
    const linked = await chapterLink(root, mainPath, main.open ? main.content : null, chapterPath);
    if (!linked.ok) {
      notify(`${t('chapter.linkError')} — ${linked.error.message}`, 'error');
      return hadOwnChanges;
    }
    if (linked.value.edit) {
      workspace.applyBufferEdits([linked.value.edit]);
      // Si el único cambio es nuestro `#include`, se guarda: así abrir el
      // capítulo no pide descartar nada. Si había cambios del usuario, no se
      // guardan por él.
      if (!hadOwnChanges) await workspace.save();
    }
    return hadOwnChanges;
  }

  /**
   * Abre el diálogo. `dirPath` (desde el menú de una carpeta) fija la carpeta
   * propuesta; sin él se propone la de los capítulos ya incluidos.
   * @param {{dirPath?: string}} [options]
   */
  async function newChapter({ dirPath } = {}) {
    const root = tree.getRoot();
    if (!root) return;
    const entrypoint = workspace.getEntrypoint();
    const mainPath = entrypoint ? joinPath(root, entrypoint) : null;

    let folder = dirPath ? relativeToRoot(root, dirPath) ?? '' : '';
    if (!dirPath && mainPath) {
      const hint = await chapterFolder(root, mainPath, (await mainContent(mainPath)).content);
      if (hint.ok) folder = hint.value;
    }

    await dialog.open({
      folder,
      submit: async ({ title, fileName, folder: chosenFolder }) => {
        const created = await chapterCreate(root, chosenFolder, fileName, title);
        if (!created.ok) return created.error.message;
        const chapterPath = created.value;

        const keepMainOpen = mainPath ? await link(root, mainPath, chapterPath) : false;
        await tree.refresh();
        await tree.revealPath(chapterPath);
        if (!mainPath) {
          notify(t('chapter.noMain'), 'error');
          await workspace.openDocument(chapterPath);
        } else if (keepMainOpen) {
          notify(t('chapter.createdKeepMain'));
        } else {
          await workspace.openDocument(chapterPath);
          notify(t('chapter.created'));
        }
        return null;
      },
    });
  }

  return { newChapter };
}
