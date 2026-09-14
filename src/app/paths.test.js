// =============================================================================
// DBV Typst Editor — Test de utilidades de ruta (RF-44)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { truncateParentPath } from './paths.js';

describe('truncateParentPath', () => {
  it('devuelve los dos últimos tramos de la carpeta padre, con marca de recorte', () => {
    const path =
      'D:\\bueno\\Documents\\UMA\\Investigacion\\Proyectos\\2025 Consultoria Knosulting\\XuntaGalicia-CPI-SICLE\\OTA SICLE\\Reuniones\\Glosario';
    expect(truncateParentPath(path)).toBe('…\\OTA SICLE\\Reuniones');
  });

  it('respeta separadores estilo Unix', () => {
    expect(truncateParentPath('/home/david/tesis/capitulos/main.typ')).toBe('…/tesis/capitulos');
  });

  it('no antepone la marca de recorte si ya se ven todos los tramos', () => {
    expect(truncateParentPath('/home/tesis')).toBe('/home');
    expect(truncateParentPath('D:\\Proyectos\\tesis')).toBe('D:\\Proyectos');
  });

  it('acepta un número de segmentos distinto de 2', () => {
    expect(truncateParentPath('/a/b/c/d/proyecto', 3)).toBe('…/b/c/d');
  });

  it('una ruta de un solo tramo no tiene padre que mostrar', () => {
    expect(truncateParentPath('proyecto')).toBe('');
  });
});
