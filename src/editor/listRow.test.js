// =============================================================================
// DBV Typst Editor — Test de la fila de lista con botón de quitar
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it, vi } from 'vitest';
import { createListRow, createRemoveButton } from './listRow.js';

describe('createRemoveButton', () => {
  it('crea un botón "✕" que llama a onRemove al pulsarlo', () => {
    const onRemove = vi.fn();
    const button = createRemoveButton(onRemove);

    expect(button.textContent).toBe('✕');
    expect(button.className).toBe('sequence-editor__remove');
    button.click();
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe('createListRow', () => {
  it('crea una fila con el texto dado y un botón de quitar', () => {
    const onRemove = vi.fn();
    const row = createListRow('Alice', onRemove);

    expect(row.className).toBe('sequence-editor__row');
    expect(row.querySelector('.sequence-editor__row-text').textContent).toBe('Alice');
    row.querySelector('.sequence-editor__remove').click();
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
