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
