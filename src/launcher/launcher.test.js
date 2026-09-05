// =============================================================================
// DBV Typst Editor — Tests de la localización de plantillas del lanzador
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// R-MVP-1: el lanzador consume `TemplateInfo`, no ficheros. `localizeTemplate`
// es la frontera entre ese dato y lo que ve el usuario, y tiene que degradar
// limpiamente cuando la plantilla no trae la capa DBV — el caso de las
// plantillas comunitarias que llegarán en Beta.

import { describe, expect, it } from 'vitest';
import { localizeTemplate } from './launcher.js';

const CON_LOCALIZACION = {
  name: 'dbv-tfg',
  description: 'Bachelor thesis template',
  dbv: {
    localization: {
      es: { name: 'TFG', description: 'Plantilla de Trabajo Fin de Grado' },
      en: { name: 'Bachelor Thesis', description: 'Bachelor thesis template' },
    },
  },
};

describe('localizeTemplate', () => {
  it('devuelve el nombre y la descripción del idioma pedido', () => {
    expect(localizeTemplate(CON_LOCALIZACION, 'es')).toEqual({
      name: 'TFG',
      description: 'Plantilla de Trabajo Fin de Grado',
    });
  });

  it('cae al dato oficial del typst.toml si falta ese idioma', () => {
    expect(localizeTemplate(CON_LOCALIZACION, 'fr')).toEqual({
      name: 'dbv-tfg',
      description: 'Bachelor thesis template',
    });
  });

  it('degrada limpiamente en una plantilla sin capa DBV', () => {
    // Principio Universe-First: `dbv-template.toml` es opcional y aditivo.
    const comunitaria = { name: 'charged-ieee', description: 'IEEE conference paper' };
    expect(localizeTemplate(comunitaria, 'es')).toEqual({
      name: 'charged-ieee',
      description: 'IEEE conference paper',
    });
  });

  it('ignora una traducción vacía en vez de mostrar un hueco en blanco', () => {
    const parcial = { name: 'dbv-cv', description: 'CV', dbv: { localization: { es: { name: '' } } } };
    expect(localizeTemplate(parcial, 'es')).toEqual({ name: 'dbv-cv', description: 'CV' });
  });
});
