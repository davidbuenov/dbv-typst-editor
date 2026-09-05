// =============================================================================
// DBV Typst Editor — Tests de la validación del asistente de creación
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// `validateFields` es la regla de negocio de RF-03: decide si el botón "Crear
// proyecto" puede pulsarse. Se probó a mano en el Slice 7; aquí queda fijada,
// incluido el caso que ninguna prueba manual cubre — una plantilla comunitaria
// sin sidecar `dbv-template.toml`, que no trae bloque `validation`.

import { describe, expect, it } from 'vitest';
import { validateFields } from './wizard.js';

const REQUERIDO = { key: 'titulo', validation: { required: true } };
const CON_LIMITE = { key: 'autor', validation: { maxLength: 10 } };
const SIN_REGLAS = { key: 'notas' };

describe('validateFields', () => {
  it('acepta un formulario completo', () => {
    expect(validateFields([REQUERIDO, CON_LIMITE], { titulo: 'Mi TFG', autor: 'David' })).toEqual([]);
  });

  it('rechaza un campo obligatorio vacío', () => {
    expect(validateFields([REQUERIDO], { titulo: '' })).toEqual(['titulo']);
  });

  it('rechaza un campo obligatorio que solo tiene espacios', () => {
    // El usuario que pulsa la barra espaciadora no ha rellenado nada.
    expect(validateFields([REQUERIDO], { titulo: '   ' })).toEqual(['titulo']);
  });

  it('rechaza un campo obligatorio ausente del todo', () => {
    expect(validateFields([REQUERIDO], {})).toEqual(['titulo']);
  });

  it('rechaza un valor que excede maxLength', () => {
    expect(validateFields([CON_LIMITE], { autor: 'Nombre demasiado largo' })).toEqual(['autor']);
  });

  it('acepta un valor justo en el límite', () => {
    expect(validateFields([CON_LIMITE], { autor: '0123456789' })).toEqual([]);
  });

  it('no exige nada a un campo sin bloque validation (plantilla sin sidecar)', () => {
    expect(validateFields([SIN_REGLAS], {})).toEqual([]);
  });

  it('acumula todas las claves inválidas, no solo la primera', () => {
    const invalidas = validateFields([REQUERIDO, CON_LIMITE], { titulo: '', autor: 'x'.repeat(50) });
    expect(invalidas).toEqual(['titulo', 'autor']);
  });

  it('no cuenta los espacios de los extremos para maxLength', () => {
    expect(validateFields([CON_LIMITE], { autor: '  David  ' })).toEqual([]);
  });

  it('acepta un formulario sin campos', () => {
    expect(validateFields([], {})).toEqual([]);
  });
});
