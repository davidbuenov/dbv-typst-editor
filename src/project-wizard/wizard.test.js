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

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/backend.js', () => ({
  createProject: vi.fn(async () => ({ ok: true, value: { root: '/tmp/p', name: 'p' } })),
  createProjectFromUniverse: vi.fn(),
  pickProjectFolder: vi.fn(async () => ({ ok: true, value: '/tmp' })),
}));

import { createProject } from '../services/backend.js';
import { setLanguage } from '../i18n/i18n.js';
import { createWizard, localizeField, validateFields } from './wizard.js';

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

// RF-126 (Issue #5a): con la interfaz en inglés, el asistente pregunta en inglés y
// crea el proyecto con la variante inglesa de la plantilla.
const CAMPO_TITULO = {
  key: 'titulo',
  label: 'Titulo del articulo',
  placeholder: 'Mi articulo',
  validation: { required: true },
  localization: { en: { label: 'Paper title', placeholder: 'My paper' } },
};

describe('localizeField (RF-126)', () => {
  it('usa la etiqueta y el ejemplo del idioma si existen', () => {
    expect(localizeField(CAMPO_TITULO, 'en')).toEqual({ label: 'Paper title', placeholder: 'My paper' });
  });

  it('en español, o sin localización, deja la etiqueta de siempre', () => {
    expect(localizeField(CAMPO_TITULO, 'es')).toEqual({ label: 'Titulo del articulo', placeholder: 'Mi articulo' });
    expect(localizeField({ key: 'notas' }, 'en')).toEqual({ label: 'notas', placeholder: '' });
  });

  it('no mezcla una etiqueta inglesa con el ejemplo en español', () => {
    const campo = { ...CAMPO_TITULO, localization: { en: { label: 'Paper title' } } };
    expect(localizeField(campo, 'en').placeholder).toBe('');
  });
});

describe('asistente en inglés (RF-126)', () => {
  afterEach(() => setLanguage('es'));

  function montar() {
    document.body.innerHTML = `
      <div id="d" class="hidden"><h2 id="t"></h2><p id="desc"></p><form id="f"></form>
      <span id="loc"></span><button id="b"></button><button id="c"></button><button id="x"></button><p id="e"></p></div>`;
    const $ = (id) => document.getElementById(id);
    return createWizard({
      dialogEl: $('d'), titleEl: $('t'), descriptionEl: $('desc'), formEl: $('f'), locationEl: $('loc'),
      browseButton: $('b'), createButton: $('c'), cancelButton: $('x'), errorEl: $('e'),
      notify: () => {}, onCreated: () => {},
    });
  }

  const ARTICULO = { name: 'dbv-articulo', version: '1.0.0', dbv: { fields: [CAMPO_TITULO], localization: {} } };

  it('muestra las etiquetas en inglés y envía el idioma a createProject', async () => {
    setLanguage('en');
    const wizard = montar();
    wizard.open(ARTICULO);
    const etiquetas = [...document.querySelectorAll('.form-row__label')].map((el) => el.textContent);
    expect(etiquetas).toContain('Paper title');
    expect(etiquetas).not.toContain('Titulo del articulo');

    document.querySelector('input[name="__projectName"]').value = 'paper';
    document.querySelector('input[name="titulo"]').value = 'On things';
    document.getElementById('b').click();
    await vi.waitFor(() => expect(document.getElementById('loc').textContent).toBe('/tmp'));
    document.getElementById('c').click();
    await vi.waitFor(() => expect(createProject).toHaveBeenCalled());
    expect(createProject.mock.calls.at(-1)[0]).toMatchObject({ templateName: 'dbv-articulo', language: 'en' });
  });
});
