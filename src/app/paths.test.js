// =============================================================================
// DBV Typst Editor — Test de utilidades de ruta (RF-44)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { remapMovedPath, truncateParentPath } from './paths.js';

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

describe('remapMovedPath (RF-69/RF-70)', () => {
  const moved = [{ from: 'D:\\libro\\cap1.typ', to: 'D:\\libro\\capitulos\\cap1.typ' }];

  it('sigue a un fichero movido o renombrado', () => {
    expect(remapMovedPath('D:\\libro\\cap1.typ', moved)).toBe('D:\\libro\\capitulos\\cap1.typ');
    expect(remapMovedPath('d:/libro/CAP1.typ', moved)).toBe('D:\\libro\\capitulos\\cap1.typ');
  });

  it('sigue a lo que cuelga de una carpeta movida, con el separador de la ruta nueva', () => {
    const folder = [{ from: 'D:\\libro\\partes', to: 'D:\\libro\\anexos\\partes' }];
    expect(remapMovedPath('D:\\libro\\partes\\uno\\a.typ', folder)).toBe('D:\\libro\\anexos\\partes\\uno\\a.typ');
    expect(remapMovedPath('/home/u/libro/partes/a.typ', [{ from: '/home/u/libro/partes', to: '/home/u/libro/x' }])).toBe(
      '/home/u/libro/x/a.typ',
    );
  });

  it('deja igual lo que no se ha movido, sin confundir un prefijo con una carpeta', () => {
    expect(remapMovedPath('D:\\libro\\cap10.typ', moved)).toBe('D:\\libro\\cap10.typ');
    expect(remapMovedPath('D:\\libro\\partes-viejas\\a.typ', [{ from: 'D:\\libro\\partes', to: 'D:\\x' }])).toBe(
      'D:\\libro\\partes-viejas\\a.typ',
    );
    expect(remapMovedPath(null, moved)).toBe(null);
  });
});
