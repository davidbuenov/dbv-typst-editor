// =============================================================================
// DBV Typst Editor — Atajo de «Nuevo .typ vacío» (RF-106.1)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

/**
 * ¿Es Ctrl+Alt+N? En macOS lo atiende el menú nativo (Cmd+Opción+N), así que aquí
 * se descarta `metaKey` para no abrir el diálogo dos veces.
 * @param {{key: string, ctrlKey: boolean, metaKey: boolean, shiftKey: boolean, altKey: boolean}} event
 */
export function isNewDocumentShortcut(event) {
  return event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === 'n';
}

/**
 * «Nuevo .typ vacío…» (RF-106): se elige dónde guardarlo (en la última carpeta usada), se crea VACÍO y
 * se abre como documento suelto, igual que con «Abrir documento .typ».
 * @param {object} deps
 * @param {(defaultName: string, filterName: string, extensions: string[], directory: string|null) => Promise<{ok: boolean, value?: string|null}>} deps.pickSaveTarget
 * @param {(path: string) => Promise<{ok: boolean, value?: string, error?: {kind: string, message: string}}>} deps.createEmptyDocument
 * @param {(path: string) => Promise<unknown>} deps.openPath
 * @param {() => string|null} deps.getLastDocumentDir
 * @param {(path: string) => void} deps.rememberDocumentPath
 * @param {(message: string, tone?: string) => void} deps.notify
 * @param {(key: string) => string} deps.t
 */
export function createNewDocumentFlow({ pickSaveTarget, createEmptyDocument, openPath, getLastDocumentDir, rememberDocumentPath, notify, t }) {
  return async function newDocument() {
    const picked = await pickSaveTarget('documento.typ', 'Typst', ['typ'], getLastDocumentDir());
    if (!picked.ok || !picked.value) return;
    const created = await createEmptyDocument(picked.value);
    if (!created.ok) {
      // `denied`: la ruta final ya existe con contenido (el comando no pisa nada).
      const exists = created.error.kind === 'denied';
      notify(exists ? t('action.newDocumentExists') : `${t('action.newDocumentError')} — ${created.error.message}`, 'error');
      return;
    }
    rememberDocumentPath(created.value);
    await openPath(created.value);
  };
}
