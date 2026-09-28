// =============================================================================
// DBV Typst Editor — Carga y recarga de los ficheros de snippets (RF-81.2, 81.5)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Lee el fichero global y los `.vscode/*.code-snippets` del proyecto y los
// vuelve a leer cuando cambian: al guardarlos desde la app, cuando el
// observador avisa de un cambio en `.vscode` (otro programa, un `git pull`) y,
// para el global, al volver el foco a la ventana. Un error de sintaxis se avisa
// con el fichero y la línea, y se siguen usando los snippets anteriores.

import { baseName, pathKey } from '../app/paths.js';
import { snippetStore } from './model.js';

/** ¿Es un fichero de snippets del proyecto (`.vscode/*.code-snippets`)? */
export function isProjectSnippetFile(path) {
  return /[\\/]\.vscode[\\/][^\\/]+\.code-snippets$/i.test(path ?? '');
}

/**
 * @param {object} deps
 * @param {{readFile: Function, snippetsGlobalPath: Function, snippetsProjectFiles: Function}} deps.backend
 * @param {(message: string, tone?: string) => void} deps.notify
 * @param {(key: string) => string} deps.t
 * @param {ReturnType<import('./model.js').createSnippetStore>} [deps.store]
 */
export function createSnippetLoader({ backend, notify, t, store = snippetStore }) {
  let globalPath = null;

  function report(path, result) {
    if (result.errors.length > 0) {
      const [first] = result.errors;
      notify(`${t('snippets.jsonError').replace('{file}', baseName(path)).replace('{line}', String(first.line))} — ${first.message}`, 'error');
    }
    if (result.warnings.length > 0) {
      notify(t('snippets.ignored').replace('{file}', baseName(path)).replace('{names}', result.warnings.join(', ')), 'error');
    }
  }

  /** Lee un fichero (o usa `text`, el contenido recién guardado). Si ya no existe, se quita. */
  async function loadFile(path, origin, text = null) {
    let content = text;
    if (content === null) {
      const read = await backend.readFile(path);
      if (!read.ok) {
        store.remove(path);
        return;
      }
      content = read.value.content;
    }
    report(path, store.load(path, content, origin));
  }

  const isGlobal = (path) => Boolean(globalPath) && pathKey(path) === pathKey(globalPath);

  return {
    /** Snippets globales (al arrancar y al volver el foco a la ventana). */
    async loadGlobal() {
      const located = await backend.snippetsGlobalPath();
      if (!located.ok) return;
      globalPath = located.value;
      await loadFile(globalPath, 'global');
    },
    /** Snippets del proyecto recién abierto (o ninguno, sin proyecto). */
    async loadProject(root) {
      store.clear('project');
      if (!root) return;
      const files = await backend.snippetsProjectFiles(root);
      for (const path of files.ok ? files.value : []) await loadFile(path, 'project');
    },
    /**
     * Un fichero cambió (guardado desde la app, con su texto, o aviso del
     * observador). Devuelve si era un fichero de snippets.
     */
    async handleChanged(path, text = null) {
      const origin = isGlobal(path) ? 'global' : isProjectSnippetFile(path) ? 'project' : null;
      if (origin) await loadFile(path, origin, text);
      return Boolean(origin);
    },
    getGlobalPath: () => globalPath,
  };
}
