// =============================================================================
// DBV Typst Editor — Guardado automático: decisiones puras (RF-64)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Aísla el "qué hacer" del "cómo hacerlo" (escribir en disco, abrir diálogos,
// tocar el DOM): así se puede comprobar sin montar `createWorkspace` entero,
// que necesita más de una decena de dependencias (editor, árbol, diálogo,
// LSP…) para arrancar. `workspace.js` y `main.js` solo llaman a estas
// funciones y actúan según lo que devuelven.

/**
 * Si un intento de guardado automático debe seguir adelante. No tiene
 * sentido escribir en disco un contenido que ya está en disco.
 * @param {{dirty: boolean}} input
 * @returns {'proceed' | 'skip'}
 */
export function decideAutoSaveAttempt({ dirty }) {
  return dirty ? 'proceed' : 'skip';
}

/**
 * Qué hace un guardado automático que se encuentra el fichero cambiado en
 * disco (RF-64.2): NUNCA sobrescribe ni abre un diálogo — a diferencia del
 * guardado manual, que sí pregunta. Solo avisa la PRIMERA vez de cada
 * episodio de conflicto (`alreadyNotified`), para no repetir el mismo aviso
 * en cada pausa de 2 s mientras el conflicto sigue sin resolverse.
 * @param {{alreadyNotified: boolean}} input
 * @returns {{shouldNotify: boolean}}
 */
export function decideAutoSaveConflict({ alreadyNotified }) {
  return { shouldNotify: !alreadyNotified };
}

/**
 * Si sigue habiendo cambios sin guardar tras una escritura que empezó con
 * `snapshot` (lo que se mandó a `writeFile`) y terminó cuando el editor ya
 * tenía `currentContent` — cubre la carrera de seguir escribiendo mientras el
 * guardado está en vuelo (R-A2): lo que llegó a disco es `snapshot`, no lo
 * último tecleado, así que si difieren el documento sigue modificado.
 * @param {{snapshot: string, currentContent: string}} input
 * @returns {boolean}
 */
export function stillDirtyAfterSave({ snapshot, currentContent }) {
  return snapshot !== currentContent;
}

/**
 * Qué hacer ante cualquier momento en que se perderían cambios sin guardar:
 * cambiar de fichero, cerrar el proyecto, o cerrar la ventana entera
 * (RF-64.5 y RF-64.6 — este último protegido SIEMPRE, sin importar el
 * guardado automático, y no es deuda técnica). Sin cambios se sigue sin más;
 * con guardado automático encendido se guarda antes sin preguntar; apagado,
 * se pregunta con el mismo diálogo de "descartar cambios" de siempre —
 * `confirmDiscardChanges` en `workspace.js` es el único sitio que la usa,
 * así que cambiar de fichero y cerrar la ventana comparten la misma regla.
 * @param {{dirty: boolean, autoSave: boolean}} input
 * @returns {'allow' | 'save-then-continue' | 'confirm'}
 */
export function decideUnsavedChangesAction({ dirty, autoSave }) {
  if (!dirty) return 'allow';
  return autoSave ? 'save-then-continue' : 'confirm';
}
