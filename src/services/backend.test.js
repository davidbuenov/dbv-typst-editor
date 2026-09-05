// =============================================================================
// DBV Typst Editor — Tests del contrato Result de la capa de acceso al backend
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Este módulo es el único punto del frontend que llama a `invoke`, y su promesa
// es que NUNCA lanza: todo fallo sale como `{ok: false, error: {kind, message}}`.
// Si esa promesa se rompe, cada módulo de UI se queda sin su try/catch y la
// ventana muere en silencio — exactamente el modo de fallo que ya costó una
// sesión entera en este proyecto.

import { describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args) => invoke(...args) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

const { call, readFile } = await import('./backend.js');

/**
 * Hace que el puente falle con `motivo`.
 *
 * No se usa `mockRejectedValue`: crea la promesa rechazada en el momento de
 * configurar el mock, antes de que nadie la espere, y el runner la contabiliza
 * como rechazo no gestionado. Una función async que lanza reproduce además con
 * más fidelidad cómo falla `invoke` de verdad.
 */
function elPuenteFalla(motivo) {
  invoke.mockImplementation(async () => {
    throw motivo;
  });
}

// `restoreMocks: true` (vitest.config.js) ya limpia `invoke` entre tests; un
// `beforeEach(() => invoke.mockReset())` adicional aquí duplica ese reset justo
// antes de que la implementación async-que-lanza del siguiente test se registre,
// y Vitest confunde el resultado con un rechazo no gestionado en vez de
// dejarlo resolverse dentro del try/catch de `call()`. Aviso para quien añada
// más tests: no reintroducir un reset manual de `invoke` en este fichero.
describe('call', () => {

  it('envuelve el valor devuelto en un Result correcto', async () => {
    invoke.mockResolvedValue({ paginas: 3 });
    await expect(call('typst_compile_preview')).resolves.toEqual({ ok: true, value: { paginas: 3 } });
  });

  it('pasa el comando y los argumentos tal cual al puente', async () => {
    invoke.mockResolvedValue(null);
    await readFile('D:/tesis/main.typ');
    expect(invoke).toHaveBeenCalledWith('read_file', { path: 'D:/tesis/main.typ' });
  });

  it('conserva el error tipado que devuelve el backend Rust', async () => {
    elPuenteFalla({ kind: 'compile', message: 'unknown variable: x' });
    await expect(call('typst_compile_preview')).resolves.toEqual({
      ok: false,
      error: { kind: 'compile', message: 'unknown variable: x' },
    });
  });

  it('etiqueta como `bridge` un fallo del propio puente', async () => {
    // Comando inexistente o argumento mal nombrado: llega como cadena suelta.
    elPuenteFalla('Command not_a_command not found');
    await expect(call('not_a_command')).resolves.toEqual({
      ok: false,
      error: { kind: 'bridge', message: 'Command not_a_command not found' },
    });
  });

  it('etiqueta como `bridge` una excepción de JavaScript', async () => {
    elPuenteFalla(new TypeError('x is not a function'));
    const result = await call('app_info');
    expect(result.ok).toBe(false);
    expect(result.error.kind).toBe('bridge');
    expect(result.error.message).toContain('x is not a function');
  });

  it('rellena el mensaje con el kind cuando el backend no lo manda', async () => {
    elPuenteFalla({ kind: 'io' });
    await expect(call('read_file')).resolves.toEqual({
      ok: false,
      error: { kind: 'io', message: 'io' },
    });
  });

  it('nunca lanza, pase lo que pase', async () => {
    elPuenteFalla(undefined);
    const result = await call('app_info');
    expect(result.ok).toBe(false);
    expect(typeof result.error.message).toBe('string');
  });
});
