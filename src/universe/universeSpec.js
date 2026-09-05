// =============================================================================
// DBV Typst Editor — Identificadores de Typst Universe (frontend)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Espejo en el frontend de `universe.rs::parse_universe_spec`. La validación de
// verdad, la que protege, es la de Rust —es la que decide qué llega a un
// proceso hijo—; esta existe para no mandar al backend algo que ya se sabe mal
// y poder decírselo al usuario mientras escribe.
//
// Duplicar una regla en dos lenguajes es una decisión, no un descuido: la
// alternativa (un viaje al backend por cada tecla) sería peor. Ambas tienen sus
// propios tests, y si divergieran el síntoma sería un mensaje de error algo
// menos amable, nunca un fallo de seguridad.

const SPEC_PATTERN = /^@preview\/([A-Za-z0-9_-]+):(\d+\.\d+\.\d+)$/;

/**
 * @param {string} raw
 * @returns {{ok: true, name: string, version: string, spec: string} | {ok: false, reason: string}}
 */
export function parseUniverseSpec(raw) {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') return { ok: false, reason: 'empty' };

  const match = SPEC_PATTERN.exec(trimmed);
  if (!match) return { ok: false, reason: 'format' };

  const [, name, version] = match;
  return { ok: true, name, version, spec: trimmed };
}

/** Nombre legible de un identificador, para títulos y tarjetas. */
export function specName(spec) {
  const parsed = parseUniverseSpec(spec);
  return parsed.ok ? parsed.name : spec;
}

/**
 * Transacción de CodeMirror que añade el `#import` de un paquete al documento.
 *
 * Va SIEMPRE al principio del fichero, después de los `#import` que ya haya:
 * Typst resuelve las importaciones en orden y ponerlo donde esté el cursor
 * dejaría el paquete sin definir en todo lo escrito por encima — un error
 * confuso ("unknown variable") que no señala a la importación.
 *
 * Función pura sobre el estado, como el resto de acciones del editor
 * (`toolbarActions.js`): testeable sin DOM.
 *
 * @param {string} spec Identificador ya validado, p. ej. `@preview/cetz:0.5.2`.
 */
export function importPackageAction(spec) {
  return (state) => {
    const line = `#import "${spec}": *`;
    const doc = state.doc;

    // Si ya está importado, no se duplica: insertar dos veces el mismo import
    // no es un error de Typst, pero ensucia el documento y confunde.
    if (doc.toString().includes(`#import "${spec}"`)) return null;

    // Se busca la última línea de importación del bloque inicial. Solo se
    // recorre la cabecera: un `#import` a mitad de documento (dentro de un
    // bloque, por ejemplo) no debe mover el punto de inserción.
    let insertAt = 0;
    for (let number = 1; number <= doc.lines; number += 1) {
      const text = doc.line(number).text.trim();
      if (text.startsWith('#import ') || text.startsWith('#include ')) {
        insertAt = doc.line(number).to;
        continue;
      }
      if (text === '') continue;
      break;
    }

    const insert = insertAt === 0 ? `${line}\n` : `\n${line}`;
    return {
      changes: { from: insertAt, to: insertAt, insert },
      selection: { anchor: insertAt + insert.length },
    };
  };
}
