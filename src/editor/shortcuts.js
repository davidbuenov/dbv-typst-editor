// =============================================================================
// DBV Typst Editor — Registro único de atajos de teclado (RF-80)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Una sola fuente para los atajos: los keymaps de la aplicación se construyen
// desde `APP_SHORTCUTS` y la sección «Atajos de teclado» de la ayuda se genera
// desde aquí, así que no pueden desfasarse (RF-80.2).
//
// Los atajos que ya trae CodeMirror se describen en `BUILTIN_SHORTCUTS`, POR
// COMBINACIÓN y no por nombre de función: Vite minimiza los nombres en
// producción, así que `binding.run.name` no sirve fuera de los tests. Un test
// recorre los keymaps reales de CodeMirror y exige que cada combinación esté
// descrita aquí o en `BASIC_NAVIGATION` (cursores, borrar, Intro…), que la
// ayuda no enumera por obvia.
//
// Notación: la de CodeMirror (`Mod-Shift-k`, `Alt-ArrowUp`). `Mod` es Ctrl en
// Windows y Linux y Cmd en macOS. `mac` solo aparece si la combinación cambia.

/** @typedef {{es: string, en: string}} Bilingual */

/**
 * @typedef {object} Shortcut
 * @property {string} id
 * @property {'editor'|'tree'|'preview'|'app'} scope Dónde actúa.
 * @property {string} [key] Combinación en notación de CodeMirror.
 * @property {string} [mac] Combinación en macOS, si es distinta.
 * @property {Bilingual} [display] Texto de la combinación cuando no es una
 *   tecla (un clic con modificador, la rueda del ratón…).
 * @property {Bilingual} label Qué hace.
 * @property {boolean} [overridesBuiltin] Tapa a propósito un atajo de CodeMirror.
 */

/** Ámbitos en el orden en que se muestran en la ayuda. */
export const SHORTCUT_SCOPES = [
  { id: 'editor', title: { es: 'Editor', en: 'Editor' } },
  { id: 'tree', title: { es: 'Árbol de archivos', en: 'File tree' } },
  { id: 'preview', title: { es: 'Vista previa', en: 'Preview' } },
  { id: 'app', title: { es: 'Ventana', en: 'Window' } },
];

/**
 * Atajos propios de la aplicación. Los de ámbito `editor` con `key` se
 * registran en CodeMirror desde aquí (`shortcutKey`); el resto los atiende el
 * componente de su ámbito y aquí solo se documentan.
 * @type {Shortcut[]}
 */
export const APP_SHORTCUTS = [
  // Formato y estructura (RF-13): barra de herramientas.
  { id: 'bold', scope: 'editor', key: 'Mod-b', label: { es: 'Negrita', en: 'Bold' } },
  {
    id: 'italic',
    scope: 'editor',
    key: 'Mod-i',
    label: { es: 'Cursiva', en: 'Italic' },
    // CodeMirror usa Mod-i para «ampliar selección», que se recupera en
    // `expandSelection` (RF-80.3). La cursiva gana, como en cualquier editor.
    overridesBuiltin: true,
  },
  { id: 'code', scope: 'editor', key: 'Mod-e', label: { es: 'Código en línea', en: 'Inline code' } },
  { id: 'link', scope: 'editor', key: 'Mod-k', label: { es: 'Enlace', en: 'Link' } },
  { id: 'heading1', scope: 'editor', key: 'Mod-Shift-1', label: { es: 'Encabezado de nivel 1', en: 'Heading level 1' } },
  { id: 'heading2', scope: 'editor', key: 'Mod-Shift-2', label: { es: 'Encabezado de nivel 2', en: 'Heading level 2' } },
  { id: 'heading3', scope: 'editor', key: 'Mod-Shift-3', label: { es: 'Encabezado de nivel 3', en: 'Heading level 3' } },
  { id: 'save', scope: 'editor', key: 'Mod-s', label: { es: 'Guardar', en: 'Save' } },
  {
    id: 'format',
    scope: 'editor',
    key: 'Shift-Alt-f',
    label: { es: 'Formatear el documento (Typstyle, con Tinymist activo)', en: 'Format the document (Typstyle, with Tinymist running)' },
  },
  {
    id: 'expandSelection',
    scope: 'editor',
    // Mayús+Alt+→ (la de VS Code) es `selectSyntaxRight` en CodeMirror, y en
    // macOS Ctrl+Mayús+↑ es «seleccionar una página arriba»: decisión 1 del
    // plan de la 0.12.0, comprobada contra todos los keymaps por un test.
    key: 'Ctrl-Shift-ArrowUp',
    mac: 'Ctrl-Cmd-ArrowUp',
    label: { es: 'Ampliar la selección al elemento que la contiene', en: 'Expand the selection to the enclosing element' },
  },
  {
    id: 'acceptCompletion',
    scope: 'editor',
    key: 'Tab',
    label: { es: 'Aceptar la sugerencia abierta (sin lista, indenta)', en: 'Accept the open suggestion (with no list, indents)' },
    overridesBuiltin: true,
  },
  { id: 'goToDefinition', scope: 'editor', key: 'F12', label: { es: 'Ir a la definición (con Tinymist)', en: 'Go to definition (with Tinymist)' } },
  {
    id: 'goToDefinitionClick',
    scope: 'editor',
    display: { es: 'Ctrl/Cmd + clic', en: 'Ctrl/Cmd + click' },
    label: { es: 'Ir a la definición de lo que hay bajo el puntero', en: 'Go to the definition of what is under the pointer' },
  },
  { id: 'findReferences', scope: 'editor', key: 'Shift-F12', label: { es: 'Buscar las referencias (con Tinymist)', en: 'Find references (with Tinymist)' } },
  { id: 'renameSymbol', scope: 'editor', key: 'F2', label: { es: 'Renombrar el símbolo en todo el proyecto (con Tinymist)', en: 'Rename the symbol across the project (with Tinymist)' } },
  { id: 'codeActions', scope: 'editor', key: 'Mod-.', label: { es: 'Acciones de código de este punto (con Tinymist)', en: 'Code actions at this point (with Tinymist)' } },
  { id: 'aiInline', scope: 'editor', key: 'Mod-Shift-i', label: { es: 'IA sobre la selección o el párrafo (con una IA conectada)', en: 'AI on the selection or paragraph (with an AI connected)' } },
  {
    id: 'addCursorClick',
    scope: 'editor',
    display: { es: 'Alt + clic', en: 'Alt + click' },
    label: { es: 'Añadir un cursor', en: 'Add a cursor' },
  },
  {
    id: 'editorFontSize',
    scope: 'editor',
    display: { es: 'Ctrl/Cmd + +/−/0, o Ctrl + rueda', en: 'Ctrl/Cmd + +/−/0, or Ctrl + wheel' },
    label: { es: 'Tamaño de la letra del editor (con el cursor dentro)', en: 'Editor font size (with the cursor inside it)' },
  },

  // Árbol de archivos (RF-69).
  { id: 'treeRename', scope: 'tree', key: 'F2', label: { es: 'Renombrar el elemento', en: 'Rename the item' } },
  { id: 'treeDelete', scope: 'tree', key: 'Delete', label: { es: 'Eliminar la selección', en: 'Delete the selection' } },
  {
    id: 'treeToggleSelect',
    scope: 'tree',
    display: { es: 'Ctrl/Cmd + clic', en: 'Ctrl/Cmd + click' },
    label: { es: 'Añadir o quitar de la selección', en: 'Add to or remove from the selection' },
  },
  {
    id: 'treeRangeSelect',
    scope: 'tree',
    display: { es: 'Mayús + clic', en: 'Shift + click' },
    label: { es: 'Seleccionar un rango', en: 'Select a range' },
  },
  { id: 'treeCancel', scope: 'tree', key: 'Escape', label: { es: 'Cancelar el arrastre o la edición del nombre', en: 'Cancel the drag or the name editing' } },

  // Vista previa.
  {
    id: 'previewSync',
    scope: 'preview',
    display: { es: 'Doble clic', en: 'Double click' },
    label: { es: 'Ir al código de ese punto', en: 'Jump to the source of that spot' },
  },
  { id: 'previewFind', scope: 'preview', key: 'Mod-f', label: { es: 'Buscar en el documento renderizado (con el foco en la vista previa)', en: 'Find in the rendered document (with focus in the preview)' } },
  {
    id: 'previewSelect',
    scope: 'preview',
    display: { es: 'Arrastrar sobre el texto', en: 'Drag over the text' },
    label: { es: 'Seleccionar texto (motor rápido)', en: 'Select text (fast engine)' },
  },
  { id: 'previewCopy', scope: 'preview', key: 'Mod-c', label: { es: 'Copiar el texto seleccionado', en: 'Copy the selected text' } },
  {
    id: 'previewZoom',
    scope: 'preview',
    display: { es: 'Ctrl/Cmd + +/−/0, o Ctrl + rueda', en: 'Ctrl/Cmd + +/−/0, or Ctrl + wheel' },
    label: { es: 'Zoom (con el ratón encima)', en: 'Zoom (with the pointer over it)' },
  },

  // Ventana.
  { id: 'closePanel', scope: 'app', key: 'Escape', label: { es: 'Cerrar el panel abierto', en: 'Close the open panel' } },

  // Buscar en el proyecto (RF-78).
  { id: 'searchProject', scope: 'app', key: 'Mod-Shift-f', label: { es: 'Buscar y reemplazar en todo el proyecto', en: 'Find and replace across the project' } },

  // Pestañas (RF-79). En macOS, Cmd+W lo atiende el menú nativo («Cerrar pestaña»).
  { id: 'closeTab', scope: 'app', key: 'Mod-w', label: { es: 'Cerrar la pestaña', en: 'Close the tab' } },
  { id: 'nextTab', scope: 'app', key: 'Ctrl-Tab', label: { es: 'Pestaña siguiente', en: 'Next tab' } },
  { id: 'prevTab', scope: 'app', key: 'Ctrl-Shift-Tab', label: { es: 'Pestaña anterior', en: 'Previous tab' } },
  {
    id: 'closeTabMiddle',
    scope: 'app',
    display: { es: 'Clic central en una pestaña', en: 'Middle click on a tab' },
    label: { es: 'Cerrar esa pestaña', en: 'Close that tab' },
  },
  {
    id: 'moveTab',
    scope: 'app',
    display: { es: 'Arrastrar una pestaña', en: 'Drag a tab' },
    label: { es: 'Cambiarla de sitio', en: 'Move it' },
  },
];

/**
 * Atajos de CodeMirror que la ayuda documenta (RF-80.1). `key`/`mac` tal cual
 * los declara CodeMirror; `shift` describe la variante con Mayús cuando la
 * tiene (seleccionar en vez de mover).
 * @type {Array<{key?: string, mac?: string, label: Bilingual, shift?: Bilingual}>}
 */
export const BUILTIN_SHORTCUTS = [
  // Líneas.
  { key: 'Alt-ArrowUp', label: { es: 'Mover la línea arriba', en: 'Move the line up' } },
  { key: 'Alt-ArrowDown', label: { es: 'Mover la línea abajo', en: 'Move the line down' } },
  { key: 'Shift-Alt-ArrowUp', label: { es: 'Duplicar la línea arriba', en: 'Duplicate the line up' } },
  { key: 'Shift-Alt-ArrowDown', label: { es: 'Duplicar la línea abajo', en: 'Duplicate the line down' } },
  { key: 'Shift-Mod-k', label: { es: 'Borrar la línea', en: 'Delete the line' } },
  { key: 'Alt-l', mac: 'Ctrl-l', label: { es: 'Seleccionar la línea', en: 'Select the line' } },
  { key: 'Mod-Enter', label: { es: 'Nueva línea debajo, sin partir la actual', en: 'New line below, without splitting the current one' } },
  { key: 'Mod-[', label: { es: 'Quitar sangría', en: 'Indent less' } },
  { key: 'Mod-]', label: { es: 'Añadir sangría', en: 'Indent more' } },
  { key: 'Mod-Alt-\\', label: { es: 'Reindentar la selección', en: 'Reindent the selection' } },
  { key: 'Tab', shift: { es: 'Quitar sangría', en: 'Indent less' }, label: { es: 'Sangría (sin sugerencias abiertas)', en: 'Indent (with no suggestions open)' } },
  // Comentarios (RF-80.4).
  { key: 'Mod-/', label: { es: 'Comentar o descomentar las líneas (//)', en: 'Comment or uncomment the lines (//)' } },
  { key: 'Alt-A', mac: 'Ctrl-A', label: { es: 'Comentario de bloque (/* */)', en: 'Block comment (/* */)' } },
  // Multicursor y selección.
  { key: 'Mod-Alt-ArrowUp', label: { es: 'Añadir un cursor arriba', en: 'Add a cursor above' } },
  { key: 'Mod-Alt-ArrowDown', label: { es: 'Añadir un cursor abajo', en: 'Add a cursor below' } },
  { key: 'Mod-d', label: { es: 'Seleccionar la siguiente aparición', en: 'Select the next occurrence' } },
  { key: 'Mod-Shift-l', label: { es: 'Seleccionar todas las apariciones', en: 'Select all occurrences' } },
  { key: 'Escape', label: { es: 'Volver a un solo cursor', en: 'Back to a single cursor' } },
  {
    key: 'Alt-ArrowLeft',
    mac: 'Ctrl-ArrowLeft',
    label: { es: 'Saltar al elemento sintáctico anterior', en: 'Jump to the previous syntax element' },
    shift: { es: 'Seleccionar hasta el elemento sintáctico anterior', en: 'Select up to the previous syntax element' },
  },
  {
    key: 'Alt-ArrowRight',
    mac: 'Ctrl-ArrowRight',
    label: { es: 'Saltar al elemento sintáctico siguiente', en: 'Jump to the next syntax element' },
    shift: { es: 'Seleccionar hasta el elemento sintáctico siguiente', en: 'Select up to the next syntax element' },
  },
  { key: 'Shift-Mod-\\', label: { es: 'Ir al paréntesis o llave que empareja', en: 'Go to the matching bracket' } },
  // Buscar e ir a.
  { key: 'Mod-f', label: { es: 'Buscar y reemplazar en el fichero', en: 'Find and replace in the file' } },
  { key: 'F3', shift: { es: 'Coincidencia anterior', en: 'Previous match' }, label: { es: 'Coincidencia siguiente', en: 'Next match' } },
  { key: 'Mod-g', shift: { es: 'Coincidencia anterior', en: 'Previous match' }, label: { es: 'Coincidencia siguiente', en: 'Next match' } },
  { key: 'Mod-Alt-g', label: { es: 'Ir a la línea…', en: 'Go to line…' } },
  // Plegar.
  { key: 'Ctrl-Shift-[', mac: 'Cmd-Alt-[', label: { es: 'Plegar el bloque', en: 'Fold the block' } },
  { key: 'Ctrl-Shift-]', mac: 'Cmd-Alt-]', label: { es: 'Desplegar el bloque', en: 'Unfold the block' } },
  { key: 'Ctrl-Alt-[', label: { es: 'Plegar todo', en: 'Fold all' } },
  { key: 'Ctrl-Alt-]', label: { es: 'Desplegar todo', en: 'Unfold all' } },
  // Deshacer.
  { key: 'Mod-z', label: { es: 'Deshacer', en: 'Undo' } },
  { key: 'Mod-y', mac: 'Mod-Shift-z', label: { es: 'Rehacer', en: 'Redo' } },
  { key: 'Mod-u', label: { es: 'Deshacer el último cambio de selección', en: 'Undo the last selection change' } },
  { key: 'Alt-u', mac: 'Mod-Shift-u', label: { es: 'Rehacer el cambio de selección', en: 'Redo the selection change' } },
  // Sugerencias.
  { key: 'Ctrl-Space', label: { es: 'Pedir sugerencias', en: 'Ask for suggestions' } },
  // Accesibilidad.
  {
    key: 'Ctrl-m',
    mac: 'Shift-Alt-m',
    label: { es: 'Alternar el modo «Tab mueve el foco» (accesibilidad)', en: 'Toggle "Tab moves focus" mode (accessibility)' },
  },
];

/**
 * Combinaciones de CodeMirror que la ayuda no enumera: mover el cursor,
 * seleccionar con Mayús, borrar, Intro y los atajos tipo Emacs de macOS. Van
 * en notación normalizada (`normalizeCombo`) para que el test las compare.
 */
export const BASIC_NAVIGATION = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End',
  'Shift-ArrowLeft', 'Shift-ArrowRight', 'Shift-ArrowUp', 'Shift-ArrowDown', 'Shift-PageUp', 'Shift-PageDown', 'Shift-Home', 'Shift-End',
  'Ctrl-ArrowLeft', 'Ctrl-ArrowRight', 'Ctrl-Shift-ArrowLeft', 'Ctrl-Shift-ArrowRight',
  'Ctrl-Home', 'Ctrl-End', 'Ctrl-Shift-Home', 'Ctrl-Shift-End',
  'Alt-ArrowLeft', 'Alt-ArrowRight', 'Alt-Shift-ArrowLeft', 'Alt-Shift-ArrowRight',
  'Cmd-ArrowLeft', 'Cmd-ArrowRight', 'Cmd-ArrowUp', 'Cmd-ArrowDown',
  'Shift-Cmd-ArrowLeft', 'Shift-Cmd-ArrowRight', 'Shift-Cmd-ArrowUp', 'Shift-Cmd-ArrowDown',
  'Ctrl-ArrowUp', 'Ctrl-ArrowDown', 'Ctrl-Shift-ArrowUp', 'Ctrl-Shift-ArrowDown',
  'Cmd-Home', 'Cmd-End', 'Shift-Cmd-Home', 'Shift-Cmd-End',
  'Enter', 'Shift-Enter', 'Backspace', 'Shift-Backspace', 'Delete',
  'Ctrl-Backspace', 'Ctrl-Delete', 'Alt-Backspace', 'Alt-Delete', 'Cmd-Backspace', 'Cmd-Delete',
  'Ctrl-a', 'Cmd-a',
  // macOS, estilo Emacs.
  'Ctrl-b', 'Ctrl-f', 'Ctrl-p', 'Ctrl-n', 'Ctrl-e', 'Ctrl-d', 'Ctrl-h', 'Ctrl-k', 'Ctrl-o', 'Ctrl-t', 'Ctrl-v',
  'Ctrl-Alt-h', 'Ctrl-Shift-b', 'Ctrl-Shift-f', 'Ctrl-Shift-p', 'Ctrl-Shift-n', 'Ctrl-Shift-a', 'Ctrl-Shift-e',
  // Lista de sugerencias abierta: moverse por ella, aceptar y cerrar.
  'Escape', 'Alt-`', 'Alt-i',
]);

const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Cmd'];

/**
 * Normaliza una combinación de CodeMirror para una plataforma: `Mod` pasa a
 * Ctrl o Cmd, `Meta` a Cmd y los modificadores quedan en un orden fijo, así
 * que `Shift-Mod-k` y `Mod-Shift-k` son la misma combinación.
 * @param {string} combo
 * @param {boolean} isMac
 * @returns {string}
 */
export function normalizeCombo(combo, isMac) {
  const parts = combo.split(/-(?!$)/);
  const key = parts.pop() ?? '';
  const mods = new Set(
    parts.map((part) => {
      if (part === 'Mod') return isMac ? 'Cmd' : 'Ctrl';
      if (part === 'Meta') return 'Cmd';
      if (part === 'Control') return 'Ctrl';
      return part;
    })
  );
  const ordered = MODIFIER_ORDER.filter((mod) => mods.has(mod));
  return [...ordered, key].join('-');
}

/**
 * Combinación de un atajo para una plataforma (sin normalizar).
 * @param {{key?: string, mac?: string}} shortcut
 * @param {boolean} isMac
 * @returns {string | undefined}
 */
export function comboFor(shortcut, isMac) {
  return isMac ? (shortcut.mac ?? shortcut.key) : shortcut.key;
}

/**
 * Combinación registrada de un atajo propio, para construir su keymap.
 * @param {string} id
 * @returns {{key: string, mac?: string}}
 */
export function shortcutKey(id) {
  const shortcut = APP_SHORTCUTS.find((item) => item.id === id);
  if (!shortcut?.key) throw new Error(`Atajo sin combinación registrada: ${id}`);
  return shortcut.mac ? { key: shortcut.key, mac: shortcut.mac } : { key: shortcut.key };
}

const KEY_NAMES = {
  ArrowUp: { es: '↑', en: '↑' },
  ArrowDown: { es: '↓', en: '↓' },
  ArrowLeft: { es: '←', en: '←' },
  ArrowRight: { es: '→', en: '→' },
  Escape: { es: 'Esc', en: 'Esc' },
  Enter: { es: 'Intro', en: 'Enter' },
  Delete: { es: 'Supr', en: 'Delete' },
  Backspace: { es: 'Retroceso', en: 'Backspace' },
  Space: { es: 'Espacio', en: 'Space' },
  Tab: { es: 'Tab', en: 'Tab' },
  PageUp: { es: 'RePág', en: 'Page Up' },
  PageDown: { es: 'AvPág', en: 'Page Down' },
  Home: { es: 'Inicio', en: 'Home' },
  End: { es: 'Fin', en: 'End' },
};

const MODIFIER_NAMES = {
  Ctrl: { es: 'Ctrl', en: 'Ctrl', mac: '⌃' },
  Alt: { es: 'Alt', en: 'Alt', mac: '⌥' },
  Shift: { es: 'Mayús', en: 'Shift', mac: '⇧' },
  Cmd: { es: 'Cmd', en: 'Cmd', mac: '⌘' },
};

/**
 * Texto legible de una combinación: «Ctrl + Mayús + K» o, en macOS, «⇧⌘K».
 * @param {string} combo Notación de CodeMirror.
 * @param {'es'|'en'} lang
 * @param {boolean} isMac
 * @returns {string}
 */
export function formatCombo(combo, lang, isMac) {
  const parts = normalizeCombo(combo, isMac).split(/-(?!$)/);
  const key = parts.pop() ?? '';
  const keyName = KEY_NAMES[key]?.[lang] ?? (key.length === 1 ? key.toUpperCase() : key);
  const text = isMac
    ? [...parts.map((mod) => MODIFIER_NAMES[mod]?.mac ?? mod), keyName].join('')
    : [...parts.map((mod) => MODIFIER_NAMES[mod]?.[lang] ?? mod), keyName].join(' + ');
  return text;
}

/**
 * Filas de la sección «Atajos de teclado» de la ayuda, agrupadas por ámbito
 * (RF-80.1). Los atajos propios van primero dentro de su ámbito; los de
 * CodeMirror, en el del editor.
 * @param {'es'|'en'} lang
 * @param {boolean} isMac
 * @returns {Array<{scope: string, title: string, rows: Array<[string, string]>}>}
 */
export function shortcutHelpGroups(lang, isMac) {
  const pick = (bilingual) => bilingual[lang] ?? bilingual.es;
  const rowsFor = (scope) => {
    const rows = [];
    for (const shortcut of APP_SHORTCUTS.filter((item) => item.scope === scope)) {
      const combo = comboFor(shortcut, isMac);
      rows.push([shortcut.display ? pick(shortcut.display) : formatCombo(combo ?? '', lang, isMac), pick(shortcut.label)]);
    }
    if (scope === 'editor') {
      for (const shortcut of BUILTIN_SHORTCUTS) {
        const combo = comboFor(shortcut, isMac);
        if (!combo) continue;
        rows.push([formatCombo(combo, lang, isMac), pick(shortcut.label)]);
        if (shortcut.shift) rows.push([formatCombo(`Shift-${combo}`, lang, isMac), pick(shortcut.shift)]);
      }
    }
    return rows;
  };
  const groups = SHORTCUT_SCOPES.map((scope) => ({ scope: scope.id, title: pick(scope.title), rows: rowsFor(scope.id) }));
  return groups.filter((group) => group.rows.length > 0);
}

/** ¿Se ejecuta en macOS? (para mostrar las combinaciones de su teclado). */
export function detectMac() {
  const platform = globalThis.navigator?.userAgentData?.platform ?? globalThis.navigator?.platform ?? '';
  return /mac/i.test(platform);
}
