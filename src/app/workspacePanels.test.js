// =============================================================================
// DBV Typst Editor — Tests de los paneles del espacio de trabajo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { PANELS, getPanelState, initPanels, togglePanel } from './workspacePanels.js';

describe('togglePanel / getPanelState', () => {
  beforeEach(() => {
    localStorage.clear();
    // Vuelve al estado por defecto (los tres visibles) reactivando lo que un
    // test anterior haya podido apagar.
    const el = document.createElement('div');
    for (const panel of PANELS) {
      if (!getPanelState()[panel]) togglePanel(panel, el);
    }
  });

  it('empieza con los tres paneles visibles', () => {
    expect(getPanelState()).toEqual({ sidebar: true, editor: true, preview: true });
  });

  it('alterna un panel y lo refleja en dataset', () => {
    const el = document.createElement('div');
    togglePanel('sidebar', el);
    expect(getPanelState().sidebar).toBe(false);
    expect(el.dataset.panelSidebar).toBe('hide');
    expect(el.dataset.panelEditor).toBe('show');
    expect(el.dataset.panelPreview).toBe('show');
  });

  it('no permite ocultar el último panel visible', () => {
    const el = document.createElement('div');
    togglePanel('sidebar', el);
    togglePanel('preview', el);
    // Solo queda 'editor' visible: intentar ocultarlo no debe hacer nada.
    togglePanel('editor', el);
    expect(getPanelState()).toEqual({ sidebar: false, editor: true, preview: false });
  });

  it('persiste el estado en localStorage', () => {
    const el = document.createElement('div');
    togglePanel('preview', el);
    expect(JSON.parse(localStorage.getItem('dbv-typst-workspace-panels'))).toEqual({
      sidebar: true,
      editor: true,
      preview: false,
    });
  });

  it('ignora un panel desconocido', () => {
    const el = document.createElement('div');
    togglePanel('otro', el);
    expect(getPanelState()).toEqual({ sidebar: true, editor: true, preview: true });
  });

  it('initPanels aplica el estado actual sin cambiarlo', () => {
    const el = document.createElement('div');
    togglePanel('editor', el);
    const other = document.createElement('div');
    initPanels(other);
    expect(other.dataset.panelEditor).toBe('hide');
  });
});
