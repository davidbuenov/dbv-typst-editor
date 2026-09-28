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
import { hoverTooltip, keymap, showTooltip, ViewPlugin } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';
import {
  insertCompletionText,
  pickedCompletion,
  snippet,
  startCompletion,
} from '@codemirror/autocomplete';
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
 * Inversa de `pathToUri`: `file:///C:/a%20b/x.typ` → `C:/a b/x.typ` y
 * `file:///tmp/x.typ` → `/tmp/x.typ`. Tinymist devuelve las URIs codificadas.
 * @param {string} uri
 * @returns {string}
 */
export function uriToPath(uri) {
  let path = String(uri ?? '').replace(/^file:\/\//, '');
  try {
    path = decodeURIComponent(path);
  } catch {
    // Un `%` suelto no es una secuencia válida: se deja tal cual.
  }
  return /^\/[A-Za-z]:/.test(path) ? path.slice(1) : path;
}

/**
 * Respuesta de `definition`/`references` → `[{path, range}]`. Tinymist devuelve
 * `LocationLink` (con `targetUri`/`targetSelectionRange`) o `Location`
 * (`uri`/`range`), suelto o en lista; `null` si no hay destino.
 * @param {any} result
 * @returns {Array<{path: string, range: {start: {line: number, character: number}, end: {line: number, character: number}}}>}
 */
export function normalizeLocations(result) {
  const list = Array.isArray(result) ? result : result ? [result] : [];
  return list
    .map((item) => {
      const uri = item.targetUri ?? item.uri;
      const range = item.targetSelectionRange ?? item.targetRange ?? item.range;
      return uri && range ? { path: uriToPath(uri), range } : null;
    })
    .filter(Boolean);
}

/**
 * Clave para comparar URIs `file://` venidas de sitios distintos (RF-85).
 *
 * Tinymist devuelve las rutas codificadas (`proj%205` para «proj 5») aunque se
 * le abriera el documento con la URI sin codificar de `pathToUri`, y en
 * Windows la letra de unidad puede llegar en mayúscula o minúscula. Dos URIs
 * del mismo fichero dan la misma clave.
 * @param {string | null | undefined} uri
 * @returns {string}
 */
export function uriKey(uri) {
  let key = uri ?? '';
  try {
    key = decodeURIComponent(key);
  } catch {
    // Un `%` suelto no es una secuencia válida: se compara tal cual.
  }
  key = key.replace(/\\/g, '/').replace(/^file:\/\/\/([A-Za-z]):/, (_, drive) => `file:///${drive.toLowerCase()}:`);
  return key;
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
 * Caracteres tras los que se pregunta a Tinymist aunque no haya palabra
 * escrita. Son los `triggerCharacters` que anuncia Tinymist en `initialize`:
 * sin `(` y `,`, escribir `#box(` no ofrecía los parámetros (`width:`,
 * `fill:`…) como sí hace VS Code.
 */
export const COMPLETION_TRIGGER_CHARS = '#(<,.:/"@';

/** Disparadores de la ayuda de firma (`signatureHelpProvider` de Tinymist). */
export const SIGNATURE_TRIGGER_CHARS = '(,:';

/**
 * ¿Merece la pena pedir sugerencias en esta posición?
 * @param {import('@codemirror/autocomplete').CompletionContext} context
 * @returns {boolean}
 */
export function shouldRequestCompletion(context) {
  if (context.explicit) return true;
  const wordRange = getCompletionWordRange(context);
  if (wordRange.isTrigger || wordRange.from < wordRange.to) return true;
  const before = context.state.sliceDoc(Math.max(0, context.pos - 1), context.pos);
  return before !== '' && COMPLETION_TRIGGER_CHARS.includes(before);
}

/**
 * Traduce un snippet LSP (sintaxis TextMate) a la de `snippet()` de CodeMirror.
 *
 * No son compatibles: CodeMirror no entiende `$1` sin llaves, ni `${1|a,b|}`,
 * ni variables (`$TM_SELECTED_TEXT`), ni placeholders anidados; y trata TODA
 * llave como posible campo (`#{…}` es un campo para CodeMirror y un bloque de
 * código para Typst), así que las llaves literales se escapan con `\`.
 * @param {string} src
 * @returns {string}
 */
export function lspSnippetToCodeMirror(src) {
  let i = 0;
  const esc = (s) => s.replace(/[{}]/g, (c) => `\\${c}`);

  // Devuelve el texto convertido (`cm`) y el texto plano sin campos (`plain`),
  // que se usa como valor por defecto al aplanar placeholders anidados.
  function parse(stopAtBrace) {
    let cm = '';
    let plain = '';
    while (i < src.length) {
      const c = src[i];
      if (c === '\\' && i + 1 < src.length && '$}\\,|'.includes(src[i + 1])) {
        const ch = src[i + 1];
        i += 2;
        cm += esc(ch);
        plain += ch;
        continue;
      }
      if (stopAtBrace && c === '}') break;
      if (c === '$') {
        const r = parseDollar();
        if (r) {
          cm += r.cm;
          plain += r.plain;
          continue;
        }
      }
      cm += esc(c);
      plain += c;
      i++;
    }
    return { cm, plain };
  }

  function parseDollar() {
    const start = i;
    const rest = src.slice(i);
    let m = /^\$(\d+)/.exec(rest);
    if (m) {
      i += m[0].length;
      return { cm: `\${${m[1]}}`, plain: '' };
    }
    m = /^\$[A-Za-z_]\w*/.exec(rest);
    if (m) {
      i += m[0].length;
      return { cm: '', plain: '' };
    }
    m = /^\$\{(\d+|[A-Za-z_]\w*)/.exec(rest);
    if (!m) return null;
    i += m[0].length;
    const id = m[1];
    let text = '';
    if (src[i] === '}') {
      i++;
    } else if (src[i] === ':') {
      i++;
      text = parse(true).plain;
      if (src[i] === '}') i++;
    } else if (src[i] === '|') {
      const end = src.indexOf('|}', i + 1);
      if (end < 0) {
        i = start;
        return null;
      }
      text = src.slice(i + 1, end).split(',')[0];
      i = end + 2;
    } else {
      i = start;
      return null;
    }
    if (!/^\d+$/.test(id)) return { cm: esc(text), plain: text };
    // CodeMirror no admite llaves ni saltos de línea dentro del nombre del
    // campo: el valor queda como texto normal y el campo, vacío, delante.
    if (/[{}\n\r]/.test(text)) return { cm: `\${${id}}${esc(text)}`, plain: text };
    return { cm: `\${${id}:${text}}`, plain: text };
  }

  return parse(false).cm;
}

/**
 * Texto de la documentación de un item/parámetro LSP (string o MarkupContent).
 * @param {unknown} doc
 * @returns {string}
 */
function docText(doc) {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  if (typeof doc === 'object' && typeof doc.value === 'string') return doc.value;
  return '';
}

/**
 * Prepara la respuesta de `textDocument/signatureHelp` para pintarla: la firma
 * activa, el tramo del parámetro activo dentro de ella y su documentación.
 * @param {any} help
 * @returns {{label: string, activeStart: number, activeEnd: number, doc: string} | null}
 */
export function formatSignature(help) {
  const signatures = help?.signatures;
  if (!Array.isArray(signatures) || signatures.length === 0) return null;
  const sig = signatures[help.activeSignature ?? 0] ?? signatures[0];
  if (!sig?.label) return null;
  const label = sig.label;
  const active = sig.activeParameter ?? help.activeParameter;
  const param = typeof active === 'number' ? sig.parameters?.[active] : null;

  let activeStart = -1;
  let activeEnd = -1;
  if (Array.isArray(param?.label)) {
    [activeStart, activeEnd] = param.label;
  } else if (typeof param?.label === 'string' && param.label) {
    // Se busca tras el `(` y en frontera de palabra: `text(text: str, …)`
    // tiene "text" en el nombre de la función, y `fill:` no debe casar dentro
    // de otro parámetro que lo contenga.
    let from = label.indexOf('(') + 1;
    while (from > 0 && from < label.length) {
      const idx = label.indexOf(param.label, from);
      if (idx < 0) break;
      if (/[(\s,]/.test(label[idx - 1] ?? '(')) {
        activeStart = idx;
        activeEnd = idx + param.label.length;
        // Se extiende hasta el final del parámetro (su tipo incluido).
        const next = label.indexOf(', ', activeEnd);
        const close = label.lastIndexOf(')');
        activeEnd = next >= 0 && next < close ? next : close >= activeEnd ? close : activeEnd;
        break;
      }
      from = idx + 1;
    }
  }

  const doc = docText(param?.documentation).split(/\n\s*\n/)[0].trim();
  return { label, activeStart, activeEnd, doc: doc.length > 300 ? `${doc.slice(0, 300)}…` : doc };
}

/** Recorta el `detail` que CodeMirror pinta junto a la etiqueta (las firmas son enormes). */
function shortDetail(text, max = 60) {
  if (!text) return undefined;
  const oneLine = String(text).replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/**
 * ¿Hay que reabrir la lista tras aceptar una sugerencia? Como hace VS Code con
 * Tinymist: aceptar `box` deja el cursor en `box(|)` y enseguida aparecen los
 * parámetros; aceptar `fill` deja `fill: |` y aparecen los valores.
 * @param {import('@codemirror/state').EditorState} state
 */
function shouldRetrigger(state) {
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const before = state.sliceDoc(Math.max(0, sel.head - 2), sel.head);
  return /[(,]$/.test(before) || /:\s?$/.test(before);
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
 * @param {(update: {uri: string, diagnostics: any[]}) => void} [deps.onDiagnostics]
 * @param {(msg: string, tone?: 'info'|'error') => void} [deps.notify]
 * @param {(status: 'offline'|'idle'|'starting'|'ready'|'error') => void} [deps.onStatusChange]
 */
export function createLspClient({ onDiagnostics: initialOnDiagnostics, notify, onStatusChange } = {}) {
  let active = false;
  let isStarting = false;
  /**
   * Documento activo: el que recibe `didChange` al escribir y sobre el que se
   * piden completados, hover y formato.
   * @type {null | {path: string, uri: string, version: number, text: string}}
   */
  let currentDoc = null;
  let pendingDoc = null;
  /**
   * Documentos que Tinymist tiene abiertos (RF-79, R-L5), por `uriKey`: uno por
   * pestaña Typst. `text` es lo último que se le mandó, para no reenviar un
   * documento que no ha cambiado al volver a su pestaña.
   * @type {Map<string, {path: string, uri: string, version: number, text: string}>}
   */
  const openDocs = new Map();
  let unlistenNotif = null;
  let onDiagnostics = initialOnDiagnostics;
  /**
   * Últimos diagnósticos publicados por fichero (RF-85). Tinymist los publica
   * de TODOS los ficheros del proyecto, no solo del abierto, y solo cuando
   * cambian: hay que guardarlos para pintarlos al abrir ese fichero después.
   * @type {Map<string, any[]>}
   */
  const diagnosticsByUri = new Map();
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
                const uri = msg.params?.uri ?? '';
                const diagnostics = msg.params?.diagnostics ?? [];
                if (diagnostics.length > 0) diagnosticsByUri.set(uriKey(uri), diagnostics);
                else diagnosticsByUri.delete(uriKey(uri));
                onDiagnostics?.({ uri, diagnostics });
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
    openDocs.clear();
    diagnosticsByUri.clear();
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

  /** Envía el texto completo de un documento ya abierto en Tinymist. */
  async function sendFullText(doc, text) {
    doc.version++;
    doc.text = text;
    try {
      await tinymistSendNotification('textDocument/didChange', {
        textDocument: { uri: doc.uri, version: doc.version },
        contentChanges: [{ text }],
      });
    } catch {}
  }

  /**
   * Hace activo un documento (abrir un fichero o volver a su pestaña). Si
   * Tinymist ya lo tiene abierto solo le reenvía el texto si cambió; si no,
   * `didOpen`. Varios documentos pueden estar abiertos a la vez (RF-79).
   */
  async function openDocument(path, text) {
    const uri = pathToUri(path);
    const key = uriKey(uri);
    const big = text.length > LSP_AUTOSTART_MAX_CHARS;

    // Con el LSP ya en marcha, pasar a un documento enorme lo detiene: cada
    // pulsación le costaría a Tinymist recompilar cientos de páginas.
    if (active && big && !forced) {
      await stop({ status: 'idle' });
    }

    const known = openDocs.get(key);
    currentDoc = known ?? { path, uri, version: 1, text };
    if (!active) {
      pendingDoc = { path, uri, text };
      // Arranque perezoso: un documento pequeño lo arranca; uno grande espera.
      if (projectRoot && !isStarting && !disabled && !failed && (forced || !big)) {
        start(projectRoot).catch(console.error);
      }
      return;
    }
    pendingDoc = null;

    if (known) {
      if (known.text !== text) await sendFullText(known, text);
      return;
    }
    openDocs.set(key, currentDoc);
    try {
      await tinymistSendNotification('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId: 'typst',
          version: currentDoc.version,
          text,
        },
      });
    } catch {}
  }

  /**
   * Actualiza en Tinymist un documento abierto que no es el activo (una
   * pestaña de fondo editada por RF-70 o por un reemplazo en el proyecto), para
   * que un renombrado posterior no calcule posiciones sobre texto viejo.
   */
  async function updateDocument(path, text) {
    const doc = openDocs.get(uriKey(pathToUri(path)));
    if (active && doc && doc.text !== text) await sendFullText(doc, text);
  }

  /** La pestaña se cerró: Tinymist vuelve a leer ese fichero del disco. */
  async function closeDocument(path) {
    const key = uriKey(pathToUri(path));
    const doc = openDocs.get(key);
    openDocs.delete(key);
    if (currentDoc && uriKey(currentDoc.uri) === key) currentDoc = null;
    if (pendingDoc && uriKey(pendingDoc.uri) === key) pendingDoc = null;
    if (active && doc) {
      try {
        await tinymistSendNotification('textDocument/didClose', { textDocument: { uri: doc.uri } });
      } catch {}
    }
  }

  /** El fichero se renombró o movió (RF-69.10): se cierra la URI vieja y se abre la nueva. */
  async function renameDocument(oldPath, newPath, text) {
    await closeDocument(oldPath);
    await openDocument(newPath, text);
  }

  async function changeDocument(text) {
    if (!active || !currentDoc) return;
    currentDoc.version++;
    currentDoc.text = text;

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
        context: { triggerKind: 1 },
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
        // `InsertReplaceEdit` trae `insert`/`replace` en vez de `range`.
        const range = item.textEdit?.range ?? item.textEdit?.insert ?? null;
        // Para filtrar se usa `filterText`; si la etiqueta va entre comillas
        // (`"a4"`) pero se inserta sin ellas (el cursor ya está dentro de la
        // cadena), se filtra por lo que se inserta.
        let filterLabel = item.filterText || item.label;
        if (!item.filterText && /^".*"$/.test(item.label) && !apply.startsWith('"')) {
          filterLabel = item.label.slice(1, -1);
        }
        const documentation = docText(item.documentation);
        const typeHint = item.labelDetails?.description;
        return {
          label: item.label,
          filterLabel,
          detail: item.detail,
          shortDetail: shortDetail(typeHint || item.detail),
          info: documentation || (item.detail && item.detail.length > 60 ? item.detail : undefined),
          type: mapLspKind(item.kind),
          sortText: item.sortText,
          apply,
          rawApply: apply,
          isSnippet,
          textEdit: item.textEdit,
          range,
        };
      });
    } catch {
      return null;
    }
  }

  async function getSignatureHelp(lineNum, charPos) {
    if (!active || !currentDoc) return null;

    try {
      const res = await tinymistSendRequest('textDocument/signatureHelp', {
        textDocument: { uri: currentDoc.uri },
        position: { line: lineNum, character: charPos },
      });
      if (!res.ok || !res.value?.signatures?.length) return null;
      return res.value;
    } catch {
      return null;
    }
  }

  /**
   * Pide a Tinymist algo sobre la posición del documento activo (definición,
   * referencias, renombrar…). `null` si no está listo o no responde.
   */
  async function requestAt(method, lineNum, charPos, extra = {}) {
    if (!active || !currentDoc) return null;
    try {
      const res = await tinymistSendRequest(method, {
        textDocument: { uri: currentDoc.uri },
        position: { line: lineNum, character: charPos },
        ...extra,
      });
      return res.ok ? (res.value ?? null) : null;
    } catch {
      return null;
    }
  }

  /** Ir a la definición (RF-77.1): destinos normalizados. */
  async function getDefinition(lineNum, charPos) {
    return normalizeLocations(await requestAt('textDocument/definition', lineNum, charPos));
  }

  /** Acciones de código de un rango del documento activo (RF-77.5). */
  async function getCodeActions(range) {
    if (!active || !currentDoc) return null;
    try {
      const res = await tinymistSendRequest('textDocument/codeAction', {
        textDocument: { uri: currentDoc.uri },
        range,
        context: { diagnostics: [] },
      });
      return res.ok && Array.isArray(res.value) ? res.value : null;
    } catch {
      return null;
    }
  }

  /** Buscar referencias (RF-77.3), incluida la declaración. */
  async function getReferences(lineNum, charPos) {
    return normalizeLocations(
      await requestAt('textDocument/references', lineNum, charPos, { context: { includeDeclaration: true } })
    );
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
    updateDocument,
    closeDocument,
    renameDocument,
    changeDocument,
    getCompletions,
    getSignatureHelp,
    getHover,
    getDefinition,
    getReferences,
    getCodeActions,
    requestAt,
    formatDocument,
    setDiagnosticsHandler(handler) {
      onDiagnostics = handler;
    },
    /**
     * Diagnósticos de Tinymist de un fichero concreto (RF-85), en formato LSP.
     * @param {string | null | undefined} path
     * @returns {any[]}
     */
    getDiagnostics(path) {
      return path ? (diagnosticsByUri.get(uriKey(pathToUri(path))) ?? []) : [];
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
    if (!shouldRequestCompletion(context)) return null;
    const wordRange = getCompletionWordRange(context);

    const { doc } = context.state;
    const requestPos = context.pos;
    const line = doc.lineAt(requestPos);
    const lineNumber = line.number - 1;
    const character = requestPos - line.from;

    const items = await lspClient.getCompletions(requestPos, lineNumber, character);
    if (!items || items.length === 0) return null;

    // El tramo que Tinymist reemplaza (`textEdit.range`) manda sobre el que
    // calculamos nosotros: tras `, ` inserta ` fill:` sin tocar nada, y en
    // `#box(w` reemplaza solo la `w`.
    const rangeOf = (item) => {
      if (!item.range) return { from: wordRange.from, to: requestPos };
      return {
        from: Math.min(posFromLsp(doc, item.range.start), requestPos),
        to: Math.max(posFromLsp(doc, item.range.end), requestPos),
      };
    };
    const resultFrom = rangeOf(items[0]).from;

    const options = items.map((item) => {
      const { from: itemFrom, to: itemTo } = rangeOf(item);
      // Desplazamientos relativos: CodeMirror remapea `from`/`to` si el
      // documento cambia antes de aceptar, y hay que aplicar lo mismo aquí.
      const deltaFrom = itemFrom - resultFrom;
      const extraTo = itemTo - requestPos;
      let template = null;
      if (item.isSnippet) {
        try {
          template = snippet(lspSnippetToCodeMirror(item.rawApply));
        } catch {
          template = null;
        }
      }
      const text = item.isSnippet ? item.rawApply.replace(/\$\{?\d+(:[^}]*)?\}?/g, (m) => m.match(/:([^}]*)/)?.[1] ?? '') : item.rawApply;
      return {
        label: item.filterLabel ?? item.label,
        displayLabel: item.label,
        detail: item.shortDetail,
        info: item.info,
        type: item.type,
        sortText: item.sortText,
        apply: (view, completion, from, to) => {
          const f = Math.max(0, from + deltaFrom);
          const t = Math.min(view.state.doc.length, Math.max(f, to + extraTo));
          if (template) {
            template(view, completion, f, t);
          } else {
            view.dispatch({
              ...insertCompletionText(view.state, text, f, t),
              annotations: pickedCompletion.of(completion),
            });
          }
          if (shouldRetrigger(view.state)) setTimeout(() => startCompletion(view), 0);
        },
      };
    });

    return {
      from: resultFrom,
      options,
      filter: true,
    };
  };
}

/**
 * Ayuda de firma (Signature Help): al escribir `(` o `,` dentro de una llamada
 * muestra la firma de la función encima del cursor con el parámetro actual
 * resaltado, y la sigue actualizando mientras el cursor siga dentro.
 * @param {ReturnType<typeof createLspClient>} lspClient
 */
export function createLspSignatureHelp(lspClient) {
  const setSignature = StateEffect.define();

  const signatureField = StateField.define({
    create: () => null,
    update(value, tr) {
      for (const e of tr.effects) if (e.is(setSignature)) return e.value;
      if (value && tr.docChanged) return { ...value, pos: tr.changes.mapPos(value.pos) };
      return value;
    },
    // `create` se conserva entre actualizaciones para que CodeMirror reutilice
    // el tooltip (solo lo recoloca) en vez de recrearlo en cada pulsación.
    provide: (f) =>
      showTooltip.from(f, (v) => (v ? { pos: v.pos, above: true, strictSide: true, create: v.create } : null)),
  });

  function render(sig) {
    const dom = document.createElement('div');
    dom.className = 'cm-lsp-signature-tooltip';
    const code = document.createElement('div');
    code.className = 'cm-lsp-signature-label';
    if (sig.activeStart >= 0) {
      const strong = document.createElement('span');
      strong.className = 'cm-lsp-signature-active';
      strong.textContent = sig.label.slice(sig.activeStart, sig.activeEnd);
      code.append(sig.label.slice(0, sig.activeStart), strong, sig.label.slice(sig.activeEnd));
    } else {
      code.textContent = sig.label;
    }
    dom.append(code);
    if (sig.doc) {
      const doc = document.createElement('div');
      doc.className = 'cm-lsp-signature-doc';
      doc.textContent = sig.doc;
      dom.append(doc);
    }
    return { dom };
  }

  const plugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
        this.seq = 0;
        this.timer = null;
      }

      update(u) {
        if (!u.docChanged && !u.selectionSet) return;
        const open = u.state.field(signatureField) != null;
        if (!open) {
          const sel = u.state.selection.main;
          const before = sel.empty ? u.state.sliceDoc(Math.max(0, sel.head - 1), sel.head) : '';
          const typed = u.transactions.some((tr) => tr.isUserEvent('input'));
          if (!typed || !before || !SIGNATURE_TRIGGER_CHARS.includes(before)) return;
        }
        clearTimeout(this.timer);
        const id = ++this.seq;
        this.timer = setTimeout(() => this.request(id), 80);
      }

      async request(id) {
        const { view } = this;
        let help = null;
        const head = view.state.selection.main.head;
        if (lspClient.isActive() && lspClient.getCurrentUri() && view.state.selection.main.empty) {
          const line = view.state.doc.lineAt(head);
          help = await lspClient.getSignatureHelp(line.number - 1, head - line.from);
        }
        if (id !== this.seq) return;
        const sig = formatSignature(help);
        const current = view.state.field(signatureField);
        if (!sig && !current) return;
        const value = sig ? { pos: head, create: () => render(sig) } : null;
        try {
          view.dispatch({ effects: setSignature.of(value) });
        } catch {
          // La vista ya no existe (se cerró el fichero mientras llegaba la respuesta).
        }
      }

      destroy() {
        clearTimeout(this.timer);
        this.seq++;
      }
    }
  );

  const closeKeymap = keymap.of([
    {
      key: 'Escape',
      run: (view) => {
        if (view.state.field(signatureField, false)) view.dispatch({ effects: setSignature.of(null) });
        // `false`: Escape sigue llegando al autocompletado y a los snippets.
        return false;
      },
    },
  ]);

  return [signatureField, plugin, closeKeymap];
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
