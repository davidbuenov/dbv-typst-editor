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
import { isTypstPath } from '../app/paths.js';
import { t } from '../i18n/i18n.js';

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
 * Tamaño (en caracteres) a partir del cual Tinymist NO arranca solo.
 *
 * Tinymist compila el documento entero en segundo plano y reenvía el texto
 * completo en cada pulsación (`didChange`). Medido con un libro real de 220
 * páginas (321 kB de fuente, `z6-IPbook`): `typst` solo necesita 4,6 s y 2,3 GB
 * para UNA compilación, y Tinymist la repite mientras se escribe, además de la
 * vista previa propia. En un Mac de un compañero eso fue CPU al 95 % y varios
 * GB de RAM. Por debajo del umbral (capítulos y documentos normales) el LSP
 * sigue arrancando solo, como siempre; por encima espera a que el usuario lo
 * active con la insignia.
 */
export const LSP_AUTOSTART_MAX_CHARS = 100_000;

/** Preferencia global: el usuario apagó Tinymist a mano y no debe arrancar solo. */
const LSP_DISABLED_KEY = 'dbv-typst-lsp-disabled';

function readDisabledPreference() {
  try {
    return localStorage.getItem(LSP_DISABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDisabledPreference(disabled) {
  try {
    if (disabled) localStorage.setItem(LSP_DISABLED_KEY, '1');
    else localStorage.removeItem(LSP_DISABLED_KEY);
  } catch {
    // Sin almacenamiento vale solo para esta sesión.
  }
}

/**
 * Crea la instancia de cliente LSP para comunicarse con Tinymist.
 * @param {object} [deps]
 * @param {(diagnostics: any[]) => void} [deps.onDiagnostics]
 * @param {(msg: string, tone?: 'info'|'error') => void} [deps.notify]
 * @param {(status: 'offline'|'idle'|'starting'|'ready'|'error') => void} [deps.onStatusChange]
 */
export function createLspClient({ onDiagnostics: initialOnDiagnostics, notify, onStatusChange } = {}) {
  let active = false;
  let isStarting = false;
  let currentDoc = null; 
  let pendingDoc = null; 
  let unlistenNotif = null;
  let onDiagnostics = initialOnDiagnostics;
  /** Raíz del proyecto abierto: el LSP se arranca contra ella, cuando toque. */
  let projectRoot = null;
  /** True si el usuario lo activó a mano: entonces el umbral de tamaño no aplica. */
  let forced = false;
  /** True si el usuario lo apagó: no arranca solo hasta que lo active de nuevo. */
  let disabled = readDisabledPreference();
  /**
   * True si el último arranque falló. Sin esto, cada documento que se abre
   * volvería a lanzar un proceso que ya sabemos que no arranca (Tinymist ausente
   * o roto), con la insignia parpadeando "Conectando…" ↔ "error". Solo lo
   * limpian un proyecto nuevo o una activación manual.
   */
  let failed = false;

  function setStatus(s) {
    onStatusChange?.(s);
  }

  async function start(root) {
    projectRoot = root;
    failed = false;
    isStarting = true;
    setStatus('starting');
    try {
      const res = await tinymistStart(root);
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
      failed = true;
      isStarting = false;
      setStatus('error');
      return false;
    } catch (e) {
      console.warn('[LSP] Excepción al iniciar Tinymist:', e);
      active = false;
      failed = true;
      isStarting = false;
      setStatus('error');
      return false;
    }
  }

  async function stop({ status = 'offline' } = {}) {
    active = false;
    isStarting = false;
    currentDoc = null;
    pendingDoc = null;
    setStatus(status);
    if (unlistenNotif) {
      try {
        unlistenNotif();
      } catch {
      }
      unlistenNotif = null;
    }
    await tinymistStop();
  }

  /** Registra el proyecto abierto SIN arrancar Tinymist: lo decide `openDocument`. */
  async function setProjectRoot(root) {
    if (active || isStarting) await stop();
    projectRoot = root;
    forced = false;
    failed = false;
    setStatus(root ? 'idle' : 'offline');
  }

  /** Apagado manual (insignia): detiene Tinymist y lo recuerda entre sesiones. */
  async function disable() {
    disabled = true;
    forced = false;
    writeDisabledPreference(true);
    if (active || isStarting) await stop({ status: 'idle' });
    else setStatus(projectRoot ? 'idle' : 'offline');
  }

  /** Activación manual (insignia): arranca aunque el documento supere el umbral. */
  async function enable() {
    disabled = false;
    writeDisabledPreference(false);
    if (!projectRoot || active || isStarting) return false;
    forced = true;
    return start(projectRoot);
  }

  async function openDocument(path, text) {
    const uri = pathToUri(path);
    const big = text.length > LSP_AUTOSTART_MAX_CHARS;

    // Con el LSP ya en marcha, pasar a un documento enorme lo detiene: cada
    // pulsación le costaría a Tinymist recompilar cientos de páginas.
    if (active && big && !forced) {
      await stop({ status: 'idle' });
    }

    currentDoc = { path, uri, version: 1 };
    if (!active) {
      pendingDoc = { path, uri, text };
      // Arranque perezoso: un documento pequeño lo arranca; uno grande espera.
      if (projectRoot && !isStarting && !disabled && !failed && (forced || !big)) {
        start(projectRoot).catch(console.error);
      }
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

  /**
   * Formatea el documento activo con Typstyle vía Tinymist (RF-61).
   *
   * La guarda de tipo de fichero vive AQUÍ, no en el llamador — y compara
   * contra `activePath`, no solo contra `currentDoc.path`. Antes de este
   * arreglo, `editor.js` envolvía el cliente en `typstOnlyLsp` para
   * sobrescribir `isActive` con un `.cpp`/`.bib` delante, pero copiaba esta
   * función con `...lspClient`, que conservaba el `currentDoc` real de este
   * cierre. Y `currentDoc` SOLO se actualiza en `openDocument`, que
   * `editor.js` únicamente llama para ficheros Typst (RF-60.2: los demás no
   * tocan Tinymist) — así que con un `.bib` abierto, `currentDoc` seguía
   * apuntando al ÚLTIMO `.typ` visto, y ese era el que se formateaba, con las
   * ediciones resultantes aplicadas al buffer equivocado. Por eso la
   * comprobación correcta no es "¿`currentDoc` es Typst?" (siempre lo es)
   * sino "¿`currentDoc` es EL FICHERO QUE ESTÁ ABIERTO AHORA MISMO?".
   *
   * @param {import('@codemirror/view').EditorView} view
   * @param {string | null} activePath Ruta del fichero realmente abierto en el
   *   editor en este momento (la pasa el llamador: `lspClient` no la conoce
   *   por sí solo cuando ese fichero no es Typst).
   * @returns {Promise<{status: 'formatted'|'unchanged'|'lsp-off'|'starting'|'not-typst'|'error', message?: string}>}
   */
  async function formatDocument(view, activePath) {
    if (!isTypstPath(activePath) || !currentDoc || currentDoc.path !== activePath) {
      // Sin aviso: el botón debe estar deshabilitado en este caso (RF-61.2), y
      // avisar aquí sería alarmar por una carrera de UI, no por un fallo real.
      return { status: 'not-typst' };
    }
    if (isStarting) {
      notify?.(t('format.starting'));
      return { status: 'starting' };
    }
    if (!active) {
      notify?.(t('format.lspOff'));
      return { status: 'lsp-off' };
    }
    if (!view) return { status: 'error' };

    try {
      const res = await tinymistSendRequest('textDocument/formatting', {
        textDocument: { uri: currentDoc.uri },
        options: { tabSize: 2, insertSpaces: true },
      });

      if (!res.ok) {
        notify?.(`${t('format.error')}${res.error?.message ? ` — ${res.error.message}` : ''}`, 'error');
        return { status: 'error', message: res.error?.message };
      }
      if (!Array.isArray(res.value) || res.value.length === 0) {
        notify?.(t('format.unchanged'));
        return { status: 'unchanged' };
      }

      const edits = res.value;
      const changes = edits.map((edit) => {
        const from = posFromLsp(view.state.doc, edit.range.start);
        const to = posFromLsp(view.state.doc, edit.range.end);
        return { from, to, insert: edit.newText };
      });

      view.dispatch({ changes });
      notify?.(t('format.formatted'));
      return { status: 'formatted' };
    } catch (e) {
      notify?.(`${t('format.error')} — ${e?.message ?? e}`, 'error');
      return { status: 'error', message: e?.message ?? String(e) };
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
    setProjectRoot,
    enable,
    disable,
    isDisabled: () => disabled,
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
