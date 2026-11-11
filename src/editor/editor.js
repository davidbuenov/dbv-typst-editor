// =============================================================================
// DBV Typst Editor — Editor de documento (CodeMirror 6)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// RF-05 / ADR-EDITOR-001. Sustituye al `<textarea>` del Slice 3 conservando
// exactamente el mismo contrato (`setDocument`/`getContent`/`onChange`/`focus`),
// que es justo el motivo por el que el Slice 3 lo definió como fachada.
//
// Modo de lenguaje (riesgo R-02 del plan, resuelto por el spike del Slice 4):
// se usa el parser Lezer nativo de `codemirror-lang-typst` (`typst_lezer`), NO
// su variante por WASM. Motivos: no arrastra un binario WebAssembly al bundle
// —lo que contradiría el argumento de instalador ligero—, y aun así da árbol
// sintáctico real de Typst 0.15, plegado, indentación y autocompletado de las
// funciones y símbolos integrados. El plan B (gramática propia mínima) queda
// descartado: habría sido estrictamente peor.

import {
  acceptCompletion,
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  selectParentSyntax,
} from '@codemirror/commands';
import {
  HighlightStyle,
  Language,
  LanguageSupport,
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  languageDataProp,
  syntaxHighlighting,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { isTypstPath } from '../app/paths.js';
import { isDarkTheme } from '../themes/theme.js';
import { detectLanguage, loadLanguageExtension } from './languageSupport.js';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState, Prec } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import {
  TypstLezerParser,
  typstLezerFoldService,
  typstLezerFolding,
  typstLezerHighlighting,
  typstLezerIndentService,
  typstLezerIndentation,
  typstLezerLanguageData,
  typstLezerListKeymap,
  typstTags,
} from 'codemirror-lang-typst/lezer';
import { buildToolbarKeymap } from './toolbarActions.js';
import { detectMac, shortcutKey } from './shortcuts.js';
import { applySnippetTemplate, createSnippetCompletionSource } from '../snippets/completion.js';
import { createLspCompletionSource, createLspHover, createLspSignatureHelp } from './lspClient.js';
import { createUniverseHover } from './universeHover.js';
import { syncFlashField } from './syncFlash.js';
import { getPref, onPrefsChanged } from '../app/prefs.js';

const LSP_CHANGE_DEBOUNCE_MS = 180;

/**
 * Construye el soporte de lenguaje Typst sobre el parser Lezer nativo SIN
 * inyectar `TypstHighlightSytle` ni `typstLezerLinter` (RF-121): los diagnósticos
 * reales ya llegan del motor Typst y Tinymist, evitando un recorrido extra del AST
 * en cada pulsación.
 */
export function buildTypstLanguageSupport() {
  const parser = new TypstLezerParser(
    languageDataProp.add((type) => (type.isTop ? typstLezerLanguageData : undefined)),
    typstLezerHighlighting,
    typstLezerIndentation,
    typstLezerFolding
  );
  return new LanguageSupport(
    new Language(typstLezerLanguageData, parser, [], 'typst'),
    [typstLezerIndentService, typstLezerFoldService]
  );
}

/**
 * Resaltado sintáctico conectado íntegramente a los tokens `--code-*` de
 * `tokens.css` (RF-122): sustituye `TypstHighlightSytle` de claro fijo.
 */
export const typstTokenHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.null, tags.atom], color: 'var(--code-keyword)' },
  { tag: [tags.string, typstTags.mathDelimiter], color: 'var(--code-string)' },
  { tag: tags.comment, color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.link], color: 'var(--code-function)' },
  { tag: [tags.number, tags.bool], color: 'var(--code-number)' },
  { tag: [tags.tagName, tags.escape, tags.labelName], color: 'var(--code-tag)' },
  { tag: [tags.className, tags.typeName, tags.propertyName, typstTags.interpolated, typstTags.listMarker], color: 'var(--code-class)' },
  { tag: [tags.operator, tags.punctuation], color: 'var(--code-operator)' },
  { tag: tags.heading, color: 'var(--accent)', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.monospace, color: 'var(--text-secondary)' },
  { tag: tags.invalid, color: 'var(--status-error)', textDecoration: 'underline wavy' },
]);

/**
 * Tema del editor construido sobre los tokens CSS de la aplicación
 * (`themes/tokens.css`): al cambiar de claro a oscuro no hay que redefinir
 * colores aquí, basta con reconfigurar el flag `dark` que CodeMirror usa para
 * sus propios ajustes internos (cursor, selección, gutter activo).
 */
function buildTheme(isDark) {
  return EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        // RF-42: variable con respaldo, no un valor fijo — así Ctrl++/Ctrl+-
        // ajustan el tamaño desde fuera (`--editor-font-size` en `#editor-host`,
        // que hereda hacia abajo) sin tener que reconfigurar este compartimento
        // de tema en cada pulsación.
        fontSize: 'var(--editor-font-size, 13px)',
      },
      '.cm-scroller': {
        fontFamily: 'var(--font-mono)',
        lineHeight: '1.6',
        overflow: 'auto',
      },
      '.cm-content': { padding: '12px 0', caretColor: 'var(--accent)' },
      '.cm-gutters': {
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-muted)',
        border: 'none',
        borderRight: '1px solid var(--border)',
      },
      '.cm-activeLine': { backgroundColor: 'var(--quote-bg)' },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-secondary)',
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'var(--bg-tertiary)',
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
      '.cm-panels': {
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        borderColor: 'var(--border)',
      },
      '.cm-panels input, .cm-panels button': {
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        fontFamily: 'inherit',
        padding: '2px 6px',
      },
      '.cm-searchMatch': { backgroundColor: 'var(--quote-bg)', outline: '1px solid var(--accent)' },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--bg-tertiary)' },
      '.cm-tooltip': {
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: 'var(--accent)',
        color: '#fff',
      },
    },
    { dark: isDark }
  );
}

/**
 * Lista completa de extensiones del editor.
 *
 * Se exporta a propósito, separada de `createEditor`: `EditorState.create()`
 * resuelve y valida esta lista **sin necesidad de DOM**, así que
 * `npm run verify:editor` puede comprobarla en Node y detectar una extensión
 * mal formada antes de que aparezca como una ventana en blanco.
 *
 * Es exactamente el fallo que se coló en el Slice 4: `typstLezerListKeymap` se
 * usó como si fuera un array de atajos (`...typstLezerListKeymap`) cuando el
 * paquete lo exporta ya como extensión, y el `TypeError` solo salió al abrir la
 * aplicación — el build de Vite y los tests de Rust pasaban en verde.
 *
 * @param {object} deps
 * @param {import('@codemirror/state').Compartment} deps.themeCompartment
 * @param {import('@codemirror/state').Compartment} deps.readOnlyCompartment
 * @param {import('@codemirror/state').Compartment} deps.historyCompartment
 * @param {import('@codemirror/state').Compartment} deps.languageCompartment Lenguaje del fichero abierto (RF-60).
 * @param {import('@codemirror/state').Compartment} deps.lineNumbersCompartment Números de línea optativos (RF-63.2).
 * @param {import('@codemirror/state').Extension} deps.saveKeymap
 * @param {import('@codemirror/state').Extension} deps.updateListener
 * @param {boolean} deps.isDark
 * @param {boolean} deps.showLineNumbers Valor inicial del compartimento anterior.
 * @param {ReturnType<import('./lspClient.js').createLspClient>} [deps.lspClient]
 * @param {() => string | null} [deps.getCurrentPath] Ruta del fichero abierto
 *   AHORA MISMO (RF-61): `lspClient.formatDocument` la necesita para negarse
 *   con un fichero que no es Typst, sin depender de su propio `currentDoc`
 *   (que solo se actualiza para Typst, ver el comentario en `lspClient.js`).
 * @param {() => void} [deps.onBlur] El editor pierde el foco (RF-64.1).
 * @param {(view: EditorView) => void} [deps.onGoToDefinition] F12 / Ctrl+clic (RF-77.1).
 * @param {(view: EditorView) => void} [deps.onFindReferences] Mayús+F12 (RF-77.3).
 * @param {(view: EditorView) => void} [deps.onRenameSymbol] F2 (RF-77.4).
 * @param {(view: EditorView) => void} [deps.onCodeActions] Ctrl+. (RF-77.5).
 */
/** Construye la extensión de números de línea (absolutos o relativos, RF-120). */
export function buildLineNumbersExtension(show, relative = false) {
  if (!show) return [];
  if (!relative) return lineNumbers();
  return lineNumbers({
    formatNumber(lineNo, state) {
      const cursorLine = state.doc.lineAt(state.selection.main.head).number;
      return String(lineNo === cursorLine ? lineNo : Math.abs(lineNo - cursorLine));
    },
  });
}

/** Formatea línea, columna y longitud seleccionada para `#editor-statusbar`. */
export function formatCursorStatus(state, translate = (k) => k) {
  const main = state.selection.main;
  const line = state.doc.lineAt(main.head);
  const base = translate('statusbar.cursor')
    .replace('{line}', String(line.number))
    .replace('{col}', String(main.head - line.from + 1));
  const selectedChars = Math.abs(main.to - main.from);
  if (selectedChars === 0) return base;
  return `${base} ${translate('statusbar.selection').replace('{chars}', String(selectedChars))}`;
}

/**
 * Devuelve la etiqueta corta del modo Vim actual (`NORMAL`, `INSERT`, `VISUAL`,
 * `V-LINE`, `V-BLOCK`, `REPLACE`) o `null` si Vim no está activo.
 */
export function formatVimModeBadge(cm) {
  const vim = cm?.state?.vim;
  if (!vim) return null;
  if (vim.insertMode) return 'INSERT';
  if (vim.visualMode) {
    if (vim.visualBlock) return 'V-BLOCK';
    if (vim.visualLine) return 'V-LINE';
    return 'VISUAL';
  }
  if (vim.mode === 'replace') return 'REPLACE';
  return 'NORMAL';
}

/**
 * Decide si una pulsación de `Escape` debe cerrar paneles flotantes globales.
 * Evita cerrar paneles mientras Vim sale de modo Inserción/Visual/Reemplazo o
 * cancela un cuadro `:` / `/`.
 */
export function shouldClosePanelsOnEscape(event, view) {
  if (!event || event.defaultPrevented) return false;
  if (!view?.dom) return true;
  const target = event.target;
  const insideEditor = target instanceof Node && view.dom.contains(target);
  if (!insideEditor) return true;
  const vimState = view.cm?.state?.vim;
  if (!vimState) return true;
  if (vimState.insertMode || vimState.visualMode || vimState.mode === 'replace' || vimState.exMode) {
    return false;
  }
  if (view.dom.querySelector('.cm-vim-panel')) return false;
  return true;
}

let vimModulePromise = null;
let loadedVimModule = null;
let vimSaveRegistered = false;
const vimSaveHandlers = new WeakMap();

async function loadVimModule() {
  if (loadedVimModule) return loadedVimModule;
  if (!vimModulePromise) {
    vimModulePromise = import('@replit/codemirror-vim').then((mod) => {
      loadedVimModule = mod;
      return mod;
    });
  }
  return vimModulePromise;
}

export function buildExtensions({
  themeCompartment,
  readOnlyCompartment,
  historyCompartment,
  languageCompartment,
  lineNumbersCompartment,
  vimCompartment,
  snippetKeymapCompartment,
  saveKeymap,
  updateListener,
  isDark,
  showLineNumbers,
  relativeLineNumbers = false,
  vimExtension = [],
  lspClient,
  getCurrentPath,
  onBlur,
  onGoToDefinition,
  onFindReferences,
  onRenameSymbol,
  onCodeActions,
}) {
  const toolbarKeymap = buildToolbarKeymap();
  // `syncFlashField`: marca del bloque al que salta la sincronización (RF-16).
  // `domEventHandlers` va suelto (no en un Compartment): no cambia en la vida
  // del editor, solo el callback al que reenvía (`onBlur`, capturado por
  // cierre desde `createEditor`).
  const extraExtensions = [createUniverseHover(), syncFlashField, EditorView.domEventHandlers({ blur: () => onBlur?.() })];
  let autocompleteExt;
  // RF-81: los snippets del usuario se suman a Tinymist y funcionan sin él.
  const snippetSource = createSnippetCompletionSource(undefined, () => getCurrentPath?.() ?? null);
  if (lspClient) {
    autocompleteExt = autocompletion({ override: [createLspCompletionSource(lspClient), snippetSource] });
    extraExtensions.push(createLspHover(lspClient));
    extraExtensions.push(createLspSignatureHelp(lspClient));
    extraExtensions.push(
      keymap.of([
        {
          ...shortcutKey('format'),
          run: (v) => {
            lspClient.formatDocument(v, getCurrentPath?.());
            return true;
          },
        },
      ])
    );
  } else {
    // Sin Tinymist no hay `override`: los completados del lenguaje Typst siguen
    // ahí y los snippets entran como un origen más de `languageData`.
    autocompleteExt = [autocompletion(), EditorState.languageData.of(() => [{ autocomplete: snippetSource }])];
  }

  return [
    // RF-63.2 / RF-120: números de línea (absolutos o relativos) en un
    // compartimento propio para alternarlos en caliente sin perder cursor.
    lineNumbersCompartment.of(buildLineNumbersExtension(showLineNumbers, relativeLineNumbers)),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    historyCompartment.of(history()),
    foldGutter(),
    drawSelection(),
    rectangularSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    // Tab acepta la sugerencia abierta, como en VS Code. `Prec.highest` para
    // ganar al Tab de los campos de snippet (que se añaden con esa misma
    // precedencia pero después); sin lista abierta `acceptCompletion` devuelve
    // false y Tab sigue saltando de campo o indentando.
    Prec.highest(keymap.of([{ ...shortcutKey('acceptCompletion'), run: acceptCompletion }])),
    highlightSelectionMatches(),
    search({ top: true }),
    autocompleteExt,
    lintGutter(),
    EditorView.lineWrapping,
    languageCompartment.of(buildTypstLanguageSupport()),
    syntaxHighlighting(typstTokenHighlightStyle),
    // Para los ficheros de código (RF-60): donde no haya regla específica, fallback.
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    // `typstLezerListKeymap` NO es un array de atajos: el paquete lo exporta ya
    // como extensión con su propia precedencia, así que va suelto en la lista y
    // no dentro de un `keymap.of([...])`. Continúa las listas de Typst al pulsar
    // Intro, y por eso debe ir ANTES del keymap general: si `defaultKeymap`
    // atendiera Intro primero, no llegaría hasta aquí.
    typstLezerListKeymap,
    // El orden importa: el atajo de guardado y los de la barra de herramientas
    // (RF-13) van antes que el keymap general para que ganen a cualquier
    // binding por defecto que pudiera capturar la misma combinación.
    saveKeymap,
    toolbarKeymap,
    // RF-80.3: «ampliar selección» (`selectParentSyntax`), que CodeMirror trae
    // en Mod-i y la cursiva tapa, recuperado en una combinación libre.
    keymap.of([{ ...shortcutKey('expandSelection'), preventDefault: true, run: selectParentSyntax }]),
    ...navigationExtensions({ onGoToDefinition, onFindReferences, onRenameSymbol, onCodeActions }),
    ...extraExtensions,
    snippetKeymapCompartment ? snippetKeymapCompartment.of([]) : [],
    vimCompartment ? vimCompartment.of(vimExtension) : [],
    keymap.of([
      ...closeBracketsKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...defaultKeymap,
      indentWithTab,
    ]),
    themeCompartment.of(buildTheme(isDark)),
    readOnlyCompartment.of(EditorState.readOnly.of(false)),
    updateListener,
  ];
}

/**
 * Navegación con Tinymist (RF-77): F12 y Mayús+F12, y Ctrl+clic (Cmd+clic en
 * macOS) para ir a la definición. Añadir un cursor pasa a Alt+clic (RF-77.2),
 * como en VS Code; la selección rectangular sigue con Alt+arrastrar.
 * F2 renombra el símbolo y Ctrl+. pide las acciones de código (RF-77.4-5).
 * @param {{onGoToDefinition?: (view: EditorView) => void, onFindReferences?: (view: EditorView) => void, onRenameSymbol?: (view: EditorView) => void, onCodeActions?: (view: EditorView) => void}} handlers
 */
function navigationExtensions({ onGoToDefinition, onFindReferences, onRenameSymbol, onCodeActions }) {
  const isMac = detectMac();
  const run = (handler) => (view) => {
    handler?.(view);
    return Boolean(handler);
  };
  return [
    keymap.of([
      { ...shortcutKey('goToDefinition'), preventDefault: true, run: run(onGoToDefinition) },
      { ...shortcutKey('findReferences'), preventDefault: true, run: run(onFindReferences) },
      { ...shortcutKey('renameSymbol'), preventDefault: true, run: run(onRenameSymbol) },
      { ...shortcutKey('codeActions'), preventDefault: true, run: run(onCodeActions) },
    ]),
    EditorView.clickAddsSelectionRange.of((event) => event.altKey),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        const modifier = isMac ? event.metaKey : event.ctrlKey;
        if (!onGoToDefinition || event.button !== 0 || !modifier || event.altKey || event.shiftKey) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return false;
        event.preventDefault();
        view.dispatch({ selection: { anchor: pos } });
        onGoToDefinition(view);
        return true;
      },
    }),
  ];
}

/**
 * @param {HTMLElement} hostEl Contenedor donde se monta el editor.
 * @param {object} [options]
 * @param {(content: string) => void} [options.onChange] Cambio hecho por el usuario.
 * @param {(changes: import('@codemirror/state').ChangeSet) => void} [options.onChanges]
 *   Los cambios (ChangeSet) de cada edición, para reasignar posiciones (RF-57.5).
 * @param {() => void} [options.onSave] Atajo de guardado (Ctrl/Cmd+S).
 * @param {(view: EditorView) => void} [options.onSelectionChange] Cursor o
 *   selección movidos — lo usa la barra de herramientas (RF-13) para refrescar
 *   la sensibilidad al contexto (dentro/fuera de una ecuación, §7.7.3.3).
 * @param {() => void} [options.onBlur] El editor pierde el foco (RF-64.1: el
 *   guardado automático también se dispara aquí, no solo tras la pausa).
 * @param {(mode: string | null) => void} [options.onVimModeChange] Cambio de modo Vim (`RF-120`).
 * @param {'dark'|'light'|'sepia'} [options.theme] Tema inicial.
 * @param {ReturnType<import('./lspClient.js').createLspClient>} [options.lspClient]
 * @param {(view: EditorView) => void} [options.onGoToDefinition]
 * @param {(view: EditorView) => void} [options.onFindReferences]
 * @param {(view: EditorView) => void} [options.onRenameSymbol]
 * @param {(view: EditorView) => void} [options.onCodeActions]
 */
export function createEditor(
  hostEl,
  {
    onChange,
    onModified,
    onChanges,
    onSave,
    onSelectionChange,
    onBlur,
    onVimModeChange,
    theme = 'dark',
    lspClient,
    lspDebounceMs = LSP_CHANGE_DEBOUNCE_MS,
    onGoToDefinition,
    onFindReferences,
    onRenameSymbol,
    onCodeActions,
  } = {}
) {
  if (!(hostEl instanceof HTMLElement)) {
    throw new TypeError('createEditor: hostEl debe ser un HTMLElement');
  }

  const themeCompartment = new Compartment();
  const readOnlyCompartment = new Compartment();
  // Historial de deshacer. Cada documento tiene el suyo porque vive en su
  // `EditorState` (RF-79): abrir otro fichero crea un estado nuevo, así que
  // un Ctrl+Z no puede llegar al documento anterior y escribirlo encima.
  const historyCompartment = new Compartment();
  // Lenguaje del fichero abierto (RF-60): Typst, un paquete de código o nada.
  const languageCompartment = new Compartment();
  // Números de línea optativos (RF-63.2).
  const lineNumbersCompartment = new Compartment();
  // Modo Vim optativo y bajo demanda (RF-120b).
  const vimCompartment = new Compartment();
  // Atajos dinámicos de snippets (RF-119b).
  const snippetKeymapCompartment = new Compartment();

  let currentPath = null;
  let currentSnippetBindings = [];
  // Valores vigentes de lo que es de la ventana y no del fichero (R-T2): al
  // volver a una pestaña, su `EditorState` guardado trae la configuración de
  // cuando se guardó, y hay que reponer la actual.
  let currentTheme = theme;
  // Cada apertura invalida la carga de lenguaje anterior: si el usuario cambia de
  // fichero antes de que llegue el paquete, el resaltado tardío no debe pisar al nuevo.
  let languageToken = 0;
  let vimToken = 0;
  let destroyed = false;
  const boundVimCms = new WeakSet();
  // Distingue "el usuario ha escrito" de "hemos cargado un documento": sin esta
  // bandera, abrir un fichero lo marcaría inmediatamente como modificado.
  let loading = false;

  let lspChangeTimer = null;
  let lspPendingChange = false;
  let view = null;

  function cancelPendingLspChange() {
    if (lspChangeTimer) {
      clearTimeout(lspChangeTimer);
      lspChangeTimer = null;
    }
    lspPendingChange = false;
  }

  function flushPendingLspChange() {
    if (!lspPendingChange) return;
    if (lspChangeTimer) {
      clearTimeout(lspChangeTimer);
      lspChangeTimer = null;
    }
    lspPendingChange = false;
    if (view && isTypstPath(currentPath)) {
      lspClient?.changeDocument?.(view.state.doc.toString());
    }
  }

  function scheduleLspChange() {
    if (!isTypstPath(currentPath) || !lspClient) return;
    if (typeof lspClient.isActive === 'function' && !lspClient.isActive()) return;
    if (lspDebounceMs <= 0) {
      lspPendingChange = false;
      lspClient.changeDocument?.(view.state.doc.toString());
      return;
    }
    lspPendingChange = true;
    if (lspChangeTimer) clearTimeout(lspChangeTimer);
    lspChangeTimer = setTimeout(flushPendingLspChange, lspDebounceMs);
  }

  const withFlush = (fn) => (fn ? (...args) => {
    flushPendingLspChange();
    return fn(...args);
  } : undefined);

  // Tinymist solo entiende Typst: con un `.cpp` delante se le apaga el editor,
  // o devolvería completados y hovers del documento Typst anterior. Toda consulta
  // vacia antes los cambios pendientes debunceados para no responder con offsets viejos.
  const typstOnlyLsp = lspClient
    ? {
        ...lspClient,
        isActive: () => lspClient.isActive() && isTypstPath(currentPath),
        getCompletions: withFlush(lspClient.getCompletions?.bind(lspClient)),
        getHover: withFlush(lspClient.getHover?.bind(lspClient)),
        getSignatureHelp: withFlush(lspClient.getSignatureHelp?.bind(lspClient)),
        formatDocument: withFlush(lspClient.formatDocument?.bind(lspClient)),
      }
    : undefined;

  const saveKeymap = keymap.of([
    {
      ...shortcutKey('save'),
      preventDefault: true,
      run: () => {
        onSave?.();
        return true;
      },
    },
  ]);

  // Las mismas extensiones para todos los documentos: cada pestaña (RF-79)
  // tiene su propio `EditorState`, creado con ellas.
  const extensions = buildExtensions({
    themeCompartment,
    readOnlyCompartment,
    historyCompartment,
    languageCompartment,
    lineNumbersCompartment,
    vimCompartment,
    snippetKeymapCompartment,
    saveKeymap,
    isDark: isDarkTheme(theme),
    showLineNumbers: getPref('showLineNumbers'),
    relativeLineNumbers: getPref('relativeLineNumbers'),
    vimExtension: getPref('vimMode') && loadedVimModule ? loadedVimModule.vim({ status: false }) : [],
    lspClient: typstOnlyLsp,
    getCurrentPath: () => currentPath,
    onBlur,
    onGoToDefinition,
    onFindReferences,
    onRenameSymbol,
    onCodeActions,
    updateListener: EditorView.updateListener.of((update) => {
      if (loading) return;
      if (update.docChanged) {
        if (isTypstPath(currentPath)) scheduleLspChange();
        onChanges?.(update.changes);
        onModified?.();
        if (onChange) onChange(update.state.doc.toString());
      }
      if (update.docChanged || update.selectionSet) onSelectionChange?.(update.view);
    }),
  });
  view = new EditorView({ parent: hostEl, state: EditorState.create({ doc: '', extensions }) });

  function buildSnippetKeymapExtension(bindings) {
    if (!bindings?.length) return [];
    const specs = bindings.map((binding) => ({
      key: binding.key,
      preventDefault: true,
      run: (targetView) => {
        if (targetView.state.readOnly) return false;
        applySnippetTemplate(targetView, binding.snippet, { path: currentPath });
        return true;
      },
    }));
    return keymap.of(specs);
  }

  function setSnippetKeybindings(bindings = []) {
    currentSnippetBindings = bindings;
    view.dispatch({
      effects: snippetKeymapCompartment.reconfigure(buildSnippetKeymapExtension(currentSnippetBindings)),
    });
  }

  // Reacciona en caliente al menú Preferencias (RF-63.2 / RF-120): reconfigurar
  // el compartimento no pierde ni el cursor ni el historial de deshacer.
  const unsubscribeLineNumbers = onPrefsChanged(({ key }) => {
    if (key !== 'showLineNumbers' && key !== 'relativeLineNumbers') return;
    view.dispatch({
      effects: lineNumbersCompartment.reconfigure(
        buildLineNumbersExtension(getPref('showLineNumbers'), getPref('relativeLineNumbers'))
      ),
    });
  });

  function bindVimAdapter(vimMod) {
    const cm = vimMod?.getCM(view);
    if (!cm) {
      onVimModeChange?.(null);
      return;
    }
    if (!vimSaveRegistered && vimMod.Vim?.defineEx) {
      vimSaveRegistered = true;
      vimMod.Vim.defineEx('write', 'w', (targetCm) => vimSaveHandlers.get(targetCm)?.());
    }
    vimSaveHandlers.set(cm, () => onSave?.());
    if (!boundVimCms.has(cm)) {
      boundVimCms.add(cm);
      cm.on('vim-mode-change', () => onVimModeChange?.(formatVimModeBadge(cm)));
    }
    onVimModeChange?.(formatVimModeBadge(cm));
  }

  async function syncVimMode(enabled) {
    vimToken += 1;
    const token = vimToken;
    if (!enabled) {
      view.dispatch({ effects: vimCompartment.reconfigure([]) });
      onVimModeChange?.(null);
      return;
    }
    const apply = (vimMod) => {
      if (destroyed || token !== vimToken || !getPref('vimMode')) return;
      view.dispatch({ effects: vimCompartment.reconfigure(vimMod.vim({ status: false })) });
      bindVimAdapter(vimMod);
    };
    if (loadedVimModule) apply(loadedVimModule);
    else apply(await loadVimModule());
  }

  const unsubscribeVimMode = onPrefsChanged(({ key, value }) => {
    if (key === 'vimMode') syncVimMode(Boolean(value));
  });
  if (getPref('vimMode')) {
    syncVimMode(true);
  }

  /** Pone el resaltado del fichero: el de Typst al momento, el de código cuando llegue su paquete. */
  function applyLanguage(path) {
    languageToken += 1;
    const token = languageToken;
    const language = detectLanguage(path);
    if (language.kind === 'typst') {
      view.dispatch({ effects: languageCompartment.reconfigure(buildTypstLanguageSupport()) });
      return;
    }
    view.dispatch({ effects: languageCompartment.reconfigure([]) });
    loadLanguageExtension(language).then((extension) => {
      if (extension && token === languageToken) {
        view.dispatch({ effects: languageCompartment.reconfigure(extension) });
      }
    });
  }

  /**
   * Vuelve a una pestaña con el estado que guardó `snapshot()`. Su historial
   * y su lenguaje son del fichero y se conservan; el tema y los números de
   * línea son de la ventana y se reponen con el valor actual (R-T2). La solo
   * lectura es de la pestaña (un paquete abierto desde «Ir a la definición»).
   * @param {string | null} path
   * @param {{state: EditorState, scroll?: import('@codemirror/state').StateEffect<unknown>}} saved
   * @param {{readOnly?: boolean}} [options]
   */
  function activate(path, saved, { readOnly = false } = {}) {
    flushPendingLspChange();
    loading = true;
    view.setState(saved.state);
    const effects = [
      themeCompartment.reconfigure(buildTheme(isDarkTheme(currentTheme))),
      lineNumbersCompartment.reconfigure(
        buildLineNumbersExtension(getPref('showLineNumbers'), getPref('relativeLineNumbers'))
      ),
      vimCompartment.reconfigure(
        getPref('vimMode') && loadedVimModule ? loadedVimModule.vim({ status: false }) : []
      ),
      snippetKeymapCompartment.reconfigure(buildSnippetKeymapExtension(currentSnippetBindings)),
      readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
    ];
    if (saved.scroll) effects.push(saved.scroll);
    view.dispatch({ effects });
    if (getPref('vimMode')) {
      if (loadedVimModule) bindVimAdapter(loadedVimModule);
      else syncVimMode(true);
    } else {
      onVimModeChange?.(null);
    }
    currentPath = path ?? null;
    if (isTypstPath(currentPath)) lspClient?.openDocument(currentPath, view.state.doc.toString());
    applyLanguage(currentPath);
    loading = false;
    // `setState` no pasa por el oyente de cambios: la barra de herramientas
    // (dentro o fuera de una ecuación) se refresca a mano.
    onSelectionChange?.(view);
  }

  return {
    /**
     * Carga un documento sin disparar `onChange`, en un `EditorState` NUEVO:
     * historial vacío (deshacer no puede llegar al documento anterior) y sin
     * pliegues ni diagnósticos del fichero anterior. Si el anterior era una
     * pestaña, se guardó antes con `snapshot()`.
     */
    setDocument(content, path, { readOnly = false } = {}) {
      activate(path, { state: EditorState.create({ doc: content, extensions }) }, { readOnly });
    },
    /**
     * Cambia la ruta del documento abierto SIN tocar su contenido ni su
     * historial de deshacer (RF-69.10): renombrar o mover el fichero desde el
     * árbol no es abrir otro documento. El lenguaje se recalcula (la
     * extensión pudo cambiar) y Tinymist recibe el documento con su URI nueva.
     */
    setPath(path) {
      if (path === currentPath) return;
      flushPendingLspChange();
      const previous = currentPath;
      currentPath = path ?? null;
      const text = view.state.doc.toString();
      if (isTypstPath(previous) && isTypstPath(currentPath)) lspClient?.renameDocument(previous, currentPath, text);
      else if (isTypstPath(previous)) lspClient?.closeDocument(previous);
      else if (isTypstPath(currentPath)) lspClient?.openDocument(currentPath, text);
      applyLanguage(currentPath);
    },
    /** Envía al LSP cualquier cambio pendiente del debounce (RF-121). */
    flush: flushPendingLspChange,
    /**
     * Estado completo del documento que se está editando (texto, cursor,
     * selección, historial de deshacer, pliegues, diagnósticos) y su scroll,
     * para guardarlo al cambiar de pestaña (RF-79). `EditorState` es inmutable:
     * lo que se devuelve no cambia aunque se siga editando otra cosa.
     */
    snapshot() {
      return { state: view.state, scroll: view.scrollSnapshot() };
    },
    activate,
    /** La pestaña de `path` se cerró: Tinymist deja de tenerlo abierto. */
    closeDocument(path) {
      if (path === currentPath) cancelPendingLspChange();
      if (isTypstPath(path)) lspClient?.closeDocument(path);
    },
    formatDocument: () => {
      flushPendingLspChange();
      return lspClient?.formatDocument(view, currentPath);
    },
    setDiagnostics(diagnostics) {
      view.dispatch(setDiagnostics(view.state, diagnostics));
    },
    getContent: () => view.state.doc.toString(),
    getPath: () => currentPath,
    /** Acceso a la `EditorView` real, para la barra de herramientas (RF-13). */
    getView: () => view,
    /** Indica si Vim está montado actualmente en la vista (RF-120b). */
    isVimActive: () => Boolean(view?.cm?.state?.vim),
    /** Actualiza los atajos de teclado asignados a snippets de usuario (RF-119b). */
    setSnippetKeybindings,
    setReadOnly(readOnly) {
      view.dispatch({
        effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
      });
    },
    /** @param {string} nextTheme */
    setTheme(nextTheme) {
      currentTheme = nextTheme;
      view.dispatch({
        effects: themeCompartment.reconfigure(buildTheme(isDarkTheme(nextTheme))),
      });
    },
    focus() {
      view.focus();
    },
    /** Inserta texto en la posición del cursor (asistentes de inserción, Beta). */
    insertAtCursor(text) {
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      });
      view.focus();
    },
    destroy() {
      destroyed = true;
      cancelPendingLspChange();
      unsubscribeLineNumbers();
      unsubscribeVimMode();
      view.destroy();
    },
  };
}
