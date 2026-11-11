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
import { getLanguage } from '../i18n/i18n.js';
import {
  contextMenuSnippets,
  parseKeybindingsFile,
  resolveSnippetKeybindings,
} from './keybindings.js';
import { snippetStore } from './model.js';

/** ¿Es un fichero de snippets del proyecto (`.vscode/*.code-snippets`)? */
export function isProjectSnippetFile(path) {
  return /[\\/]\.vscode[\\/][^\\/]+\.code-snippets$/i.test(path ?? '');
}

/** ¿Es un fichero de atajos de proyecto (`.vscode/keybindings.json`)? */
export function isProjectKeybindingsFile(path) {
  return /[\\/]\.vscode[\\/]keybindings\.json$/i.test(path ?? '');
}

/**
 * @param {object} deps
 * @param {{readFile: Function, snippetsGlobalPath: Function, snippetsProjectFiles: Function, snippetsKeybindingsPaths?: Function}} deps.backend
 * @param {(message: string, tone?: string) => void} deps.notify
 * @param {(key: string) => string} deps.t
 * @param {ReturnType<import('./model.js').createSnippetStore>} [deps.store]
 */
export function createSnippetLoader({ backend, notify, t, store = snippetStore }) {
  let globalPath = null;
  let globalKeybindingsPath = null;
  let projectKeybindingsPath = null;
  let globalKeybindings = [];
  let projectKeybindings = [];
  let resolvedBindings = [];
  let reportedConflicts = new Set();
  const listeners = new Set();

  function emitChanged() {
    for (const listener of listeners) listener(resolvedBindings, getContextSnippets());
  }

  function getContextSnippets() {
    return contextMenuSnippets(store.all());
  }

  function recomputeKeybindings({ announceConflicts = true } = {}) {
    const result = resolveSnippetKeybindings({
      snippets: store.all(),
      globalBindings: globalKeybindings,
      projectBindings: projectKeybindings,
    });
    resolvedBindings = result.bindings;
    if (announceConflicts) {
      const lang = getLanguage?.() ?? 'es';
      for (const c of result.conflicts) {
        const sig = `${c.type}:${c.key}:${c.snippetName ?? c.dropped ?? ''}`;
        if (reportedConflicts.has(sig)) continue;
        reportedConflicts.add(sig);
        if (c.type === 'app') {
          const action = typeof c.appLabel === 'string' ? c.appLabel : (c.appLabel?.[lang] ?? c.appLabel?.es ?? '');
          notify(t('snippets.keyConflictApp').replace('{key}', c.key).replace('{action}', action), 'warning');
        } else if (c.type === 'duplicate') {
          notify(t('snippets.keyConflictDup').replace('{key}', c.key).replace('{winner}', c.winner).replace('{dropped}', c.dropped), 'warning');
        }
      }
    }
    emitChanged();
  }

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

  async function loadKeybindingsFile(path, origin, text = null) {
    if (!path) return;
    let content = text;
    if (content === null) {
      const read = await backend.readFile(path);
      if (!read.ok) {
        if (origin === 'global') globalKeybindings = [];
        else projectKeybindings = [];
        return;
      }
      content = read.value.content;
    }
    const parsed = parseKeybindingsFile(content, origin);
    report(path, parsed);
    if (parsed.errors.length === 0) {
      if (origin === 'global') globalKeybindings = parsed.entries;
      else projectKeybindings = parsed.entries;
    }
  }

  const isGlobal = (path) => Boolean(globalPath) && pathKey(path) === pathKey(globalPath);
  const isGlobalKeybindings = (path) => Boolean(globalKeybindingsPath) && pathKey(path) === pathKey(globalKeybindingsPath);

  return {
    /** Snippets globales (al arrancar y al volver el foco a la ventana). */
    async loadGlobal() {
      const located = await backend.snippetsGlobalPath();
      if (located.ok) {
        globalPath = located.value;
        await loadFile(globalPath, 'global');
      }
      if (typeof backend.snippetsKeybindingsPaths === 'function') {
        const kb = await backend.snippetsKeybindingsPaths(null);
        if (kb?.ok && kb.value?.global) {
          globalKeybindingsPath = kb.value.global;
          await loadKeybindingsFile(globalKeybindingsPath, 'global');
        }
      }
      reportedConflicts.clear();
      recomputeKeybindings();
    },
    /** Snippets del proyecto recién abierto (o ninguno, sin proyecto). */
    async loadProject(root) {
      store.clear('project');
      projectKeybindings = [];
      projectKeybindingsPath = null;
      reportedConflicts.clear();
      if (!root) {
        recomputeKeybindings({ announceConflicts: false });
        return;
      }
      const files = await backend.snippetsProjectFiles(root);
      for (const path of files.ok ? files.value : []) await loadFile(path, 'project');
      if (typeof backend.snippetsKeybindingsPaths === 'function') {
        const kb = await backend.snippetsKeybindingsPaths(root);
        if (kb?.ok && kb.value) {
          if (kb.value.global && !globalKeybindingsPath) globalKeybindingsPath = kb.value.global;
          if (kb.value.project) {
            projectKeybindingsPath = kb.value.project;
            await loadKeybindingsFile(projectKeybindingsPath, 'project');
          }
        }
      }
      recomputeKeybindings();
    },
    /**
     * Un fichero cambió (guardado desde la app, con su texto, o aviso del
     * observador). Devuelve si era un fichero de snippets o keybindings.
     */
    async handleChanged(path, text = null) {
      const origin = isGlobal(path) ? 'global' : isProjectSnippetFile(path) ? 'project' : null;
      if (origin) {
        await loadFile(path, origin, text);
        reportedConflicts.clear();
        recomputeKeybindings();
        return true;
      }
      const kbOrigin = isGlobalKeybindings(path)
        ? 'global'
        : isProjectKeybindingsFile(path) || (projectKeybindingsPath && pathKey(path) === pathKey(projectKeybindingsPath))
          ? 'project'
          : null;
      if (kbOrigin) {
        await loadKeybindingsFile(path, kbOrigin, text);
        reportedConflicts.clear();
        recomputeKeybindings();
        return true;
      }
      return false;
    },
    getGlobalPath: () => globalPath,
    getKeybindings: () => resolvedBindings,
    getContextSnippets,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
