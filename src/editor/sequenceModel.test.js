// =============================================================================
// DBV Typst Editor — Test del modelo de diagramas de secuencia (RF-48)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  addMessage,
  addParticipant,
  chronosImportLine,
  createEmptySequence,
  hasChronosImport,
  removeMessage,
  removeParticipant,
  sequenceToChronosCode,
} from './sequenceModel.js';

describe('addParticipant', () => {
  it('añade un participante nuevo', () => {
    const seq = addParticipant(createEmptySequence(), 'Alice');
    expect(seq.participants).toEqual(['Alice']);
  });

  it('ignora un nombre vacío', () => {
    const seq = addParticipant(createEmptySequence(), '   ');
    expect(seq.participants).toEqual([]);
  });

  it('ignora un nombre ya existente', () => {
    let seq = addParticipant(createEmptySequence(), 'Alice');
    seq = addParticipant(seq, 'Alice');
    expect(seq.participants).toEqual(['Alice']);
  });
});

describe('removeParticipant', () => {
  it('retira al participante y cualquier mensaje que lo mencionara', () => {
    let seq = addParticipant(createEmptySequence(), 'Alice');
    seq = addParticipant(seq, 'Bob');
    seq = addMessage(seq, 'Alice', 'Bob', 'hola');

    seq = removeParticipant(seq, 'Alice');

    expect(seq.participants).toEqual(['Bob']);
    expect(seq.messages).toEqual([]);
  });
});

describe('addMessage', () => {
  it('añade un mensaje entre dos participantes existentes', () => {
    let seq = addParticipant(createEmptySequence(), 'Alice');
    seq = addParticipant(seq, 'Bob');
    seq = addMessage(seq, 'Alice', 'Bob', 'hola', false);

    expect(seq.messages).toEqual([{ from: 'Alice', to: 'Bob', comment: 'hola', dashed: false }]);
  });

  it('ignora un mensaje hacia un participante que no existe', () => {
    const seq = addParticipant(createEmptySequence(), 'Alice');
    const updated = addMessage(seq, 'Alice', 'Fantasma', 'hola');
    expect(updated.messages).toEqual([]);
  });
});

describe('removeMessage', () => {
  it('retira el mensaje del índice indicado', () => {
    let seq = addParticipant(createEmptySequence(), 'Alice');
    seq = addParticipant(seq, 'Bob');
    seq = addMessage(seq, 'Alice', 'Bob', 'uno');
    seq = addMessage(seq, 'Bob', 'Alice', 'dos');

    seq = removeMessage(seq, 0);

    expect(seq.messages).toEqual([{ from: 'Bob', to: 'Alice', comment: 'dos', dashed: false }]);
  });
});

describe('sequenceToChronosCode', () => {
  it('con menos de dos participantes no hay nada que insertar', () => {
    expect(sequenceToChronosCode(createEmptySequence())).toBeNull();
    expect(sequenceToChronosCode(addParticipant(createEmptySequence(), 'Alice'))).toBeNull();
  });

  it('emite _par por cada participante y _seq por cada mensaje, en orden', () => {
    let seq = addParticipant(createEmptySequence(), 'Alice');
    seq = addParticipant(seq, 'Bob');
    seq = addMessage(seq, 'Alice', 'Bob', 'hola');
    seq = addMessage(seq, 'Bob', 'Alice', 'hola de vuelta', true);

    const code = sequenceToChronosCode(seq);
    expect(code).toContain('#chronos.diagram({');
    expect(code).toContain('import chronos: *');
    expect(code).toContain('_par("Alice")');
    expect(code).toContain('_par("Bob")');
    expect(code).toContain('_seq("Alice", "Bob", comment: "hola")');
    expect(code).toContain('_seq("Bob", "Alice", comment: "hola de vuelta", dashed: true)');
  });

  it('escapa comillas dentro de un nombre o comentario', () => {
    let seq = addParticipant(createEmptySequence(), 'Alice "la jefa"');
    seq = addParticipant(seq, 'Bob');
    seq = addMessage(seq, 'Alice "la jefa"', 'Bob', 'di "hola"');

    const code = sequenceToChronosCode(seq);
    expect(code).toContain('_par("Alice \\"la jefa\\"")');
    expect(code).toContain('comment: "di \\"hola\\""');
  });
});

describe('hasChronosImport / chronosImportLine', () => {
  it('detecta el import ya presente', () => {
    expect(hasChronosImport('#import "@preview/chronos:0.3.0"\n\n#chronos.diagram({})')).toBe(true);
  });

  it('no confunde otro paquete', () => {
    expect(hasChronosImport('#import "@preview/cetz:0.5.2"')).toBe(false);
  });

  it('devuelve la línea de import esperada', () => {
    expect(chronosImportLine()).toBe('#import "@preview/chronos:0.3.0"');
  });
});
