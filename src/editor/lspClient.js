// =============================================================================
// DBV Typst Editor — Cliente LSP para Tinymist (RF-21)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import {
  on,
  tinymistSendNotification,
  tinymistSendRequest,
  tinymistStart,
  tinymistStatus,
  tinymistStop,
} from '../services/backend.js';
import { hoverTooltip } from '@codemirror/view';
import { snippet } from '@codemirror/autocomplete';

/**
 * Convierte una ruta del sistema a un URI file:// según el formato LSP.
 * @param {string} path
 * @returns {string}
 */
export function pathToUri(path) {
  if (!path) return '';
  const clean = path.replace(/\\/g, '/');
  if (clean.startsWith('/')) {
    return `file://${clean}`;
  }
  return `file:///${clean}`;
}

/**
 * Convierte un tipo LSP CompletionItemKind a un tipo comprensible por CodeMirror.
 * @param {number} [kind]
 * @returns {string}
 */
export function mapLspKind(kind) {
  switch (kind) {
    case 1:
      return 'text';
    case 2:
      return 'method';
    case 3:
      return 'function';
    case 4:
      return 'constructor';
    case 5:
      return 'field';
    case 6:
      return 'variable';
    case 7:
      return 'class';
    case 8:
      return 'interface';
    case 9:
      return 'module';
    case 10:
      return 'property';
    case 11:
      return 'unit';
    case 12:
      return 'value';
    case 13:
      return 'enum';
    case 14:
      return 'keyword';
    case 15:
      return 'snippet';
    case 16:
      return 'color';
    case 17:
      return 'file';
    case 18:
      return 'reference';
    case 19:
      return 'folder';
    case 20:
      return 'enumMember';
    case 21:
      return 'constant';
    case 22:
      return 'struct';
    case 23:
      return 'event';
    case 24:
      return 'operator';
    case 25:
      return 'typeParameter';
    default:
      return 'text';
  }
}

/**
 * Convierte una posición {line, character} devuelta por LSP a un offset absoluto en el doc de CodeMirror.
 * @param {import('@codemirror/state').Text} doc
 * @param {{line: number, character: number}} lspPos
 * @returns {number}
 */
export function posFromLsp(doc, lspPos) {
  const lineNum = Math.min(Math.max(1, lspPos.line + 1), doc.lines);
  const line = doc.line(lineNum);
  return Math.min(line.from + lspPos.character, line.to);
}

/**
 * Determina el rango y prefijo del token a autocompletar, distinguiendo disparadores de Typst (#, @, ., :).
 * @param {import('@codemirror/autocomplete').CompletionContext} context
 * @returns {{from: number, to: number, isTrigger: boolean}}
 */
export function getCompletionWordRange(context) {
  const hashMatch = context.matchBefore(/#[\w-]*/);
  if (hashMatch) {
    return {
      from: hashMatch.from + 1,
      to: context.pos,
      isTrigger: true,
    };
  }

  const atMatch = context.matchBefore(/@[\w-]*/);
  if (atMatch) {
    return {
      from: atMatch.from + 1,
      to: context.pos,
      isTrigger: true,
    };
  }

  const dotMatch = context.matchBefore(/[.:][\w-]*/);
  if (dotMatch) {
    return {
      from: dotMatch.from + 1,
      to: context.pos,
      isTrigger: true,
    };
  }

  const labelMatch = context.matchBefore(/<[\w-]*/);
  if (labelMatch) {
    return {
      from: labelMatch.from + 1,
      to: context.pos,
      isTrigger: true,
    };
  }

  const wordMatch = context.matchBefore(/[\w-]+/);
  if (wordMatch) {
    return {
      from: wordMatch.from,
      to: context.pos,
      isTrigger: false,
    };
  }

  return { from: context.pos, to: context.pos, isTrigger: false };
}

/**
 * Crea la instancia de cliente LSP para comunicarse con Tinymist.
 * @param {object} [deps]
 * @param {(diagnostics: any[]) => void} [deps.onDiagnostics]
 * @param {(msg: string, tone?: 'info'|'error') => void} [deps.notify]
 * @param {(status: 'offline'|'starting'|'ready'|'error') => void} [deps.onStatusChange]
 */
export function createLspClient({ onDiagnostics: initialOnDiagnostics, notify, onStatusChange } = {}) {
  let active = false;
  let isStarting = false;
  let currentDoc = null; 
  let pendingDoc = null; 
  let unlistenNotif = null;
  let onDiagnostics = initialOnDiagnostics;

  function setStatus(s) {
    onStatusChange?.(s);
  }

  async function start(projectRoot) {
    isStarting = true;
    setStatus('starting');
    try {
      const res = await tinymistStart(projectRoot);
      if (res.ok) {
        active = true;
        isStarting = false;
        setStatus('ready');
        if (!unlistenNotif) {
          try {
            unlistenNotif = await on('tinymist:notification', (msg) => {
              if (msg.method === 'textDocument/publishDiagnostics') {
                onDiagnostics?.(msg.params?.diagnostics ?? []);
              }
            });
          } catch {
          }
        }

        if (pendingDoc) {
          const docToOpen = pendingDoc;
          pendingDoc = null;
          await openDocument(docToOpen.path, docToOpen.text);
        }

        return true;
      }
      console.warn('[LSP] Fallo al iniciar Tinymist:', res.error);
      active = false;
      isStarting = false;
      setStatus('error');
      return false;
    } catch (e) {
      console.warn('[LSP] Excepción al iniciar Tinymist:', e);
      active = false;
      isStarting = false;
      setStatus('error');
      return false;
    }
  }

  async function stop() {
    active = false;
    isStarting = false;
    currentDoc = null;
    pendingDoc = null;
    setStatus('offline');
    if (unlistenNotif) {
      try {
        unlistenNotif();
      } catch {
      }
      unlistenNotif = null;
    }
    await tinymistStop();
  }

  async function openDocument(path, text) {
    const uri = pathToUri(path);
    currentDoc = { path, uri, version: 1 };
    if (!active) {
      pendingDoc = { path, uri, text };
      return;
    }
    pendingDoc = null;

    try {
      await tinymistSendNotification('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: 'typst',
          version: 1,
          text,
        },
      });
    } catch {}
  }

  async function changeDocument(text) {
    if (!active || !currentDoc) return;
    currentDoc.version++;

    try {
      await tinymistSendNotification('textDocument/didChange', {
        textDocument: {
          uri: currentDoc.uri,
          version: currentDoc.version,
        },
        contentChanges: [{ text }],
      });
    } catch {}
  }

  async function getCompletions(pos, lineNum, charPos) {
    if (!active || !currentDoc) return null;

    try {
      const res = await tinymistSendRequest('textDocument/completion', {
        textDocument: { uri: currentDoc.uri },
        position: { line: lineNum, character: charPos },
      });

      if (!res.ok || !res.value) return null;
      const raw = res.value.items || res.value || [];
      if (!Array.isArray(raw) || raw.length === 0) return null;

      return raw.map((item) => {
        let apply = item.insertText || item.label;
        if (item.textEdit?.newText) {
          apply = item.textEdit.newText;
        }
        const isSnippet = item.insertTextFormat === 2;
        return {
          label: item.label,
          detail: item.detail,
          info: item.documentation?.value || item.documentation,
          type: mapLspKind(item.kind),
          apply,
          rawApply: apply,
          isSnippet,
          textEdit: item.textEdit,
        };
      });
    } catch {
      return null;
    }
  }

  async function getHover(lineNum, charPos) {
    if (!active || !currentDoc) return null;

    try {
      const res = await tinymistSendRequest('textDocument/hover', {
        textDocument: { uri: currentDoc.uri },
        position: { line: lineNum, character: charPos },
      });

      if (!res.ok || !res.value || !res.value.contents) return null;
      const contents = res.value.contents;
      if (typeof contents === 'string') return contents;
      if (typeof contents === 'object' && contents.value) return contents.value;
      return null;
    } catch {
      return null;
    }
  }

  async function formatDocument(view) {
    if (!active || !currentDoc || !view) return false;

    try {
      const res = await tinymistSendRequest('textDocument/formatting', {
        textDocument: { uri: currentDoc.uri },
        options: { tabSize: 2, insertSpaces: true },
      });

      if (!res.ok || !Array.isArray(res.value) || res.value.length === 0) return false;

      const edits = res.value;
      const changes = edits.map((edit) => {
        const from = posFromLsp(view.state.doc, edit.range.start);
        const to = posFromLsp(view.state.doc, edit.range.end);
        return { from, to, insert: edit.newText };
      });

      view.dispatch({ changes });
      notify?.('Documento formateado con Typstyle');
      return true;
    } catch {
      return false;
    }
  }

  return {
    start,
    stop,
    openDocument,
    changeDocument,
    getCompletions,
    getHover,
    formatDocument,
    setDiagnosticsHandler(handler) {
      onDiagnostics = handler;
    },
    isActive: () => active,
    getStatus: () => (active ? 'ready' : isStarting ? 'starting' : 'offline'),
    getCurrentUri: () => currentDoc?.uri ?? null,
  };
}

/**
 * Crea la fuente de autocompletado para CodeMirror integrada con Tinymist.
 * @param {ReturnType<typeof createLspClient>} lspClient
 */
export function createLspCompletionSource(lspClient) {
  return async (context) => {
    if (!lspClient.isActive() || !lspClient.getCurrentUri()) return null;
    const wordRange = getCompletionWordRange(context);
    if (!context.explicit && !wordRange.isTrigger && wordRange.from === wordRange.to) return null;

    const line = context.state.doc.lineAt(context.pos);
    const lineNumber = line.number - 1;
    const character = context.pos - line.from;

    const items = await lspClient.getCompletions(context.pos, lineNumber, character);
    if (!items || items.length === 0) return null;

    const options = items.map((item) => {
      let apply = item.rawApply;
      if (item.isSnippet) {
        try {
          apply = snippet(item.rawApply);
        } catch {
          apply = item.rawApply;
        }
      }
      return {
        label: item.label,
        detail: item.detail,
        info: item.info,
        type: item.type,
        apply,
      };
    });

    return {
      from: wordRange.from,
      options,
      filter: true,
    };
  };
}

/**
 * Crea la extensión de hover tooltip de CodeMirror integrada con Tinymist.
 * @param {ReturnType<typeof createLspClient>} lspClient
 */
export function createLspHover(lspClient) {
  return hoverTooltip(async (view, pos) => {
    if (!lspClient.isActive() || !lspClient.getCurrentUri()) return null;
    const line = view.state.doc.lineAt(pos);
    const lineNumber = line.number - 1;
    const character = pos - line.from;

    const hoverText = await lspClient.getHover(lineNumber, character);
    if (!hoverText || !hoverText.trim()) return null;

    return {
      pos,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'cm-lsp-hover-tooltip';
        dom.textContent = hoverText;
        return { dom };
      },
    };
  });
}
