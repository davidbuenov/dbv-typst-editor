// =============================================================================
// DBV Typst Editor — Tests de las preferencias del usuario (v0.10.0)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPref, getPrefs, onPrefsChanged, reloadPrefsForTests, setPref, togglePref } from './prefs.js';

describe('prefs', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadPrefsForTests();
  });

  it('los valores por defecto no cambian el comportamiento de la 0.9.0', () => {
    // Ocultos apagado y ruta completa apagada son los ÚNICOS dos que invierten
    // el "true por defecto" de los otros dos — a propósito, para no sorprender
    // a nadie que actualice sin tocar ningún ajuste.
    expect(getPrefs()).toEqual({
      showHiddenFiles: false,
      showLineNumbers: true,
      autoSave: false,
      showFullPath: false,
    });
  });

  it('setPref guarda y togglePref invierte', () => {
    setPref('autoSave', true);
    expect(getPref('autoSave')).toBe(true);

    togglePref('autoSave');
    expect(getPref('autoSave')).toBe(false);
  });

  it('ignora una clave desconocida o un valor que no es booleano', () => {
    setPref('noExiste', true);
    expect(getPrefs().noExiste).toBeUndefined();

    setPref('autoSave', 'si');
    expect(getPref('autoSave')).toBe(false);
  });

  it('sobrevive a reiniciar: se lee de localStorage', () => {
    setPref('showHiddenFiles', true);
    reloadPrefsForTests();

    expect(getPref('showHiddenFiles')).toBe(true);
  });

  it('un valor corrupto en localStorage no invalida el resto — cae a los defectos', () => {
    localStorage.setItem('dbv-typst-prefs', JSON.stringify({ autoSave: 'no-es-booleano', showLineNumbers: false }));
    reloadPrefsForTests();

    expect(getPrefs()).toEqual({
      showHiddenFiles: false,
      showLineNumbers: false,
      autoSave: false,
      showFullPath: false,
    });
  });

  it('localStorage.getItem que lanza no rompe la lectura', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    reloadPrefsForTests();
    expect(getPrefs().autoSave).toBe(false);

    spy.mockRestore();
  });

  it('no notifica si el valor no cambia', () => {
    setPref('autoSave', false); // ya es el valor por defecto
    const listener = vi.fn();
    onPrefsChanged(listener);

    setPref('autoSave', false);
    expect(listener).not.toHaveBeenCalled();

    setPref('autoSave', true);
    expect(listener).toHaveBeenCalledWith({ key: 'autoSave', value: true });
  });

  it('onPrefsChanged devuelve una función para dejar de escuchar', () => {
    const listener = vi.fn();
    const unsubscribe = onPrefsChanged(listener);

    unsubscribe();
    setPref('showLineNumbers', false);

    expect(listener).not.toHaveBeenCalled();
  });
});
