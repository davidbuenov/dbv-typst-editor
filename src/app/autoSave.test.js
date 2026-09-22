// =============================================================================
// DBV Typst Editor — Tests de las decisiones de guardado automático (RF-64)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  decideAutoSaveAttempt,
  decideAutoSaveConflict,
  decideUnsavedChangesAction,
  stillDirtyAfterSave,
} from './autoSave.js';

describe('decideAutoSaveAttempt', () => {
  it('no escribe en disco lo que ya está en disco', () => {
    expect(decideAutoSaveAttempt({ dirty: false })).toBe('skip');
  });

  it('sigue adelante si hay cambios sin guardar', () => {
    expect(decideAutoSaveAttempt({ dirty: true })).toBe('proceed');
  });
});

describe('decideAutoSaveConflict', () => {
  it('avisa la primera vez de un episodio de conflicto', () => {
    expect(decideAutoSaveConflict({ alreadyNotified: false })).toEqual({ shouldNotify: true });
  });

  it('no repite el aviso mientras el conflicto sigue sin resolverse', () => {
    expect(decideAutoSaveConflict({ alreadyNotified: true })).toEqual({ shouldNotify: false });
  });
});

describe('stillDirtyAfterSave', () => {
  it('queda limpio si nadie escribió durante el guardado', () => {
    expect(stillDirtyAfterSave({ snapshot: '= Hola', currentContent: '= Hola' })).toBe(false);
  });

  it('sigue sucio si se escribió MIENTRAS el guardado estaba en vuelo (R-A2)', () => {
    expect(stillDirtyAfterSave({ snapshot: '= Hola', currentContent: '= Hola mundo' })).toBe(true);
  });
});

describe('decideUnsavedChangesAction (cambiar de fichero, cerrar proyecto o cerrar la ventana — RF-64.5/RF-64.6)', () => {
  it('sin cambios sin guardar, se sigue sin más', () => {
    expect(decideUnsavedChangesAction({ dirty: false, autoSave: true })).toBe('allow');
    expect(decideUnsavedChangesAction({ dirty: false, autoSave: false })).toBe('allow');
  });

  it('con cambios y guardado automático encendido, guarda antes sin preguntar', () => {
    expect(decideUnsavedChangesAction({ dirty: true, autoSave: true })).toBe('save-then-continue');
  });

  it('con cambios y guardado automático apagado, pregunta — nunca se pierde trabajo en silencio', () => {
    expect(decideUnsavedChangesAction({ dirty: true, autoSave: false })).toBe('confirm');
  });
});
