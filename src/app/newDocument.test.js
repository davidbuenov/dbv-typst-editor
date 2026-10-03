// =============================================================================
// DBV Typst Editor — Tests del atajo de «Nuevo .typ vacío» (RF-106.1)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { isNewDocumentShortcut } from './newDocument.js';

const event = (over) => ({ key: 'n', ctrlKey: true, metaKey: false, shiftKey: false, altKey: true, ...over });

describe('atajo de Nuevo .typ vacío', () => {
  it('Ctrl+Alt+N lo dispara, con cualquier mayúscula', () => {
    expect(isNewDocumentShortcut(event({}))).toBe(true);
    expect(isNewDocumentShortcut(event({ key: 'N' }))).toBe(true);
  });

  it('no se confunde con otras combinaciones', () => {
    expect(isNewDocumentShortcut(event({ altKey: false }))).toBe(false);
    expect(isNewDocumentShortcut(event({ ctrlKey: false }))).toBe(false);
    expect(isNewDocumentShortcut(event({ shiftKey: true }))).toBe(false);
    expect(isNewDocumentShortcut(event({ key: 'm' }))).toBe(false);
  });

  it('en macOS lo atiende el menú nativo, no el teclado de la página', () => {
    expect(isNewDocumentShortcut(event({ ctrlKey: false, metaKey: true }))).toBe(false);
  });
});
