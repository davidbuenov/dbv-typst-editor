// =============================================================================
// DBV Typst Editor — Modelo puro del asistente de diagramas de secuencia (RF-48)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Paquete elegido en `/plan` (implementation_plan.md §1.2) y verificado contra
// el registro real de Typst Universe: `@preview/chronos:0.3.0`. La sintaxis
// de `sequenceToChronosCode` está compilada de humo contra el binario real
// antes de fijarla — `#chronos.diagram({ import chronos: * ; _par(...) ;
// _seq(...) })`, con `_par` para cada participante y `_seq(from, to,
// comment:, dashed:)` para cada mensaje.
//
// Mismo reparto que `diagramModel.js`/`equationModel.js`: funciones puras
// sobre un objeto `sequence` inmutable, sin DOM — `sequenceEditor.js` es el
// cableado fino encima.

import { escapeTypstString } from './typstEscape.js';

const SEQUENCE_SPEC = '@preview/chronos:0.3.0';

export function createEmptySequence() {
  return { participants: [], messages: [] };
}

/** Añade un participante; ignora un nombre vacío o ya existente (los nombres son el identificador). */
export function addParticipant(sequence, name) {
  const trimmed = name.trim();
  if (!trimmed || sequence.participants.includes(trimmed)) return sequence;
  return { ...sequence, participants: [...sequence.participants, trimmed] };
}

/** Retira un participante y cualquier mensaje que lo mencionara — nunca deja un mensaje "huérfano" (mismo criterio que `removeNode` en `diagramModel.js`). */
export function removeParticipant(sequence, name) {
  return {
    participants: sequence.participants.filter((p) => p !== name),
    messages: sequence.messages.filter((m) => m.from !== name && m.to !== name),
  };
}

/** Añade un mensaje; `from`/`to` deben ser participantes ya existentes. */
export function addMessage(sequence, from, to, comment = '', dashed = false) {
  if (!sequence.participants.includes(from) || !sequence.participants.includes(to)) return sequence;
  return { ...sequence, messages: [...sequence.messages, { from, to, comment: comment.trim(), dashed }] };
}

export function removeMessage(sequence, index) {
  return { ...sequence, messages: sequence.messages.filter((_, i) => i !== index) };
}

export function setMessageComment(sequence, index, comment) {
  return {
    ...sequence,
    messages: sequence.messages.map((m, i) => (i === index ? { ...m, comment } : m)),
  };
}

export function setMessageDashed(sequence, index, dashed) {
  return {
    ...sequence,
    messages: sequence.messages.map((m, i) => (i === index ? { ...m, dashed } : m)),
  };
}

/**
 * Traduce el modelo a un bloque `chronos.diagram({ ... })` legible.
 * @returns {string | null} `null` si no hay al menos dos participantes (un diagrama de secuencia sin interacción no aporta nada que insertar).
 */
export function sequenceToChronosCode(sequence) {
  if (sequence.participants.length < 2) return null;

  const pars = sequence.participants.map((name) => `  _par("${escapeTypstString(name)}")`);
  const seqs = sequence.messages.map((message) => {
    const args = [`"${escapeTypstString(message.from)}"`, `"${escapeTypstString(message.to)}"`];
    if (message.comment) args.push(`comment: "${escapeTypstString(message.comment)}"`);
    if (message.dashed) args.push('dashed: true');
    return `  _seq(${args.join(', ')})`;
  });

  return `#chronos.diagram({\n  import chronos: *\n${pars.join('\n')}\n${seqs.join('\n')}\n})`;
}

export function hasChronosImport(docText) {
  return /#import\s+["']@preview\/chronos[:0-9.]*["']/.test(docText);
}

export function chronosImportLine() {
  return `#import "${SEQUENCE_SPEC}"`;
}
