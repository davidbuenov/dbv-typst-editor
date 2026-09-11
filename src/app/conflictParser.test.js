// =============================================================================
// DBV Typst Editor — Tests del parseo de conflictos de fusión Git (RF-19)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { countConflicts, hasConflictMarkers, parseConflictMarkers, resolveConflicts } from './conflictParser.js';

// Copiado de una reproducción real de un conflicto de merge
// (git init + dos commits divergentes + git pull), no escrito de memoria.
const REAL_CONFLICT = [
  '<<<<<<< HEAD',
  'Hola Mundo',
  'Cambio local',
  '=======',
  'Hola Mundowen',
  '>>>>>>> 8a9b24505fa1c64681d1b10b3314030b9ef8e970',
].join('\n');

describe('hasConflictMarkers', () => {
  it('detecta un conflicto real', () => {
    expect(hasConflictMarkers(REAL_CONFLICT)).toBe(true);
  });

  it('no detecta nada en un documento normal', () => {
    expect(hasConflictMarkers('= Documento\n\nTexto normal.\n')).toBe(false);
  });

  it('no confunde una línea de guiones de una tabla Typst con una marca', () => {
    expect(hasConflictMarkers('------- no es una marca de git\n')).toBe(false);
  });
});

describe('parseConflictMarkers', () => {
  it('trocea el conflicto real en un único bloque, sin contexto sobrante', () => {
    const segments = parseConflictMarkers(REAL_CONFLICT);
    expect(segments).toEqual([
      {
        type: 'conflict',
        ours: 'Hola Mundo\nCambio local',
        theirs: 'Hola Mundowen',
        theirsLabel: '8a9b24505fa1c64681d1b10b3314030b9ef8e970',
      },
    ]);
  });

  it('conserva el contexto antes y después del conflicto', () => {
    const text = `= Título\n\n${REAL_CONFLICT}\n\nPie de página.`;
    const segments = parseConflictMarkers(text);
    expect(segments[0]).toEqual({ type: 'context', text: '= Título\n' });
    expect(segments[1].type).toBe('conflict');
    expect(segments[2]).toEqual({ type: 'context', text: '\nPie de página.' });
  });

  it('gestiona varios conflictos en el mismo fichero', () => {
    const text = `${REAL_CONFLICT}\n\nen medio\n\n${REAL_CONFLICT}`;
    const segments = parseConflictMarkers(text);
    expect(countConflicts(segments)).toBe(2);
  });

  it('un documento sin conflictos es un único segmento de contexto', () => {
    const segments = parseConflictMarkers('= Documento\n\nTexto normal.');
    expect(segments).toEqual([{ type: 'context', text: '= Documento\n\nTexto normal.' }]);
  });
});

describe('resolveConflicts', () => {
  it('elegir "ours" reconstruye la versión local', () => {
    const segments = parseConflictMarkers(REAL_CONFLICT);
    expect(resolveConflicts(segments, ['ours'])).toBe('Hola Mundo\nCambio local');
  });

  it('elegir "theirs" reconstruye la versión remota', () => {
    const segments = parseConflictMarkers(REAL_CONFLICT);
    expect(resolveConflicts(segments, ['theirs'])).toBe('Hola Mundowen');
  });

  it('reconstruye el documento completo alrededor de la elección', () => {
    const text = `= Título\n\n${REAL_CONFLICT}\n\nPie.`;
    const segments = parseConflictMarkers(text);
    expect(resolveConflicts(segments, ['theirs'])).toBe('= Título\n\nHola Mundowen\n\nPie.');
  });

  it('sin elección explícita, degrada a "ours" en vez de reventar', () => {
    const segments = parseConflictMarkers(REAL_CONFLICT);
    expect(resolveConflicts(segments, [])).toBe('Hola Mundo\nCambio local');
  });
});
