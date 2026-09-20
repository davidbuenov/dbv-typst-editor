// =============================================================================
// DBV Typst Editor — Reasignación de posiciones con los cambios pendientes (RF-57.5)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El mapa render↔fuente pertenece a UNA compilación: sus posiciones son
// desplazamientos en el texto que se compiló. Pero el usuario sigue escribiendo
// mientras compila (4 s en un libro grande) o con el refresco en manual (RF-15):
// cuando llega el resultado, el texto del editor ya no es ese. Sin corregirlo, un
// doble clic aterrizaría desplazado tantos caracteres como se hayan tecleado
// desde entonces, sin avisar.
//
// Aquí se acumulan, por cada compilación lanzada, los cambios que el editor ha
// aplicado DESDE que empezó (un `ChangeSet` de CodeMirror, que sabe componerse y
// invertirse), y con ellos se traduce una posición del texto compilado al actual
// y al revés. Nunca se descarta en silencio: si el trozo se borró, el resultado
// lo dice (`collapsed`) y quien llama avisa.

import { ChangeSet } from '@codemirror/state';

/**
 * @typedef {object} MappedRange
 * @property {number} from
 * @property {number} to
 * @property {boolean} collapsed El trozo se borró: el rango es solo el punto vecino.
 * @property {boolean} clean No hubo ningún cambio desde esa compilación.
 */

export function createChangeTracker() {
  let nextId = 1;
  /** @type {Map<number, ChangeSet>} */
  const since = new Map();

  /** Traduce un rango con la función de mapeo dada. */
  function mapRange(changes, from, to, mapPos) {
    const mappedFrom = mapPos(from, 1);
    // Con `-1` el extremo final no se arrastra hacia lo que se insertó justo
    // detrás: el rango solo crece si se escribe DENTRO de él.
    const mappedTo = Math.max(mappedFrom, mapPos(to, -1));
    return {
      from: mappedFrom,
      to: mappedTo,
      collapsed: to > from && mappedTo === mappedFrom,
      clean: changes.empty,
    };
  }

  return {
    /**
     * Una compilación empieza ahora, sobre un texto de `docLength` unidades.
     * @returns {number} Su identificador.
     */
    start(docLength) {
      const id = nextId;
      nextId += 1;
      since.set(id, ChangeSet.empty(docLength));
      return id;
    },

    /** El editor acaba de aplicar `changes`: cuentan para toda compilación en marcha. */
    record(changes) {
      for (const [id, accumulated] of since) since.set(id, accumulated.compose(changes));
    },

    /** Se pintó el resultado de la compilación `id`: las anteriores ya no hacen falta. */
    rendered(id) {
      for (const key of [...since.keys()]) {
        if (key < id) since.delete(key);
      }
    },

    /** Se cambió de documento: las posiciones de antes no valen para el nuevo. */
    reset() {
      since.clear();
    },

    /** ¿Se conoce esta compilación? */
    has: (id) => since.has(id),

    /**
     * Traduce un rango del texto ACTUAL del editor al texto que se compiló.
     * @returns {MappedRange | null} `null` si esa compilación no se conoce.
     */
    toRendered(id, from, to) {
      const accumulated = since.get(id);
      if (!accumulated) return null;
      const inverse = accumulated.desc.invertedDesc;
      return mapRange(accumulated, from, to, (pos, assoc) => inverse.mapPos(pos, assoc));
    },

    /**
     * Traduce un rango del texto que se compiló al texto ACTUAL del editor.
     * @returns {MappedRange | null}
     */
    toCurrent(id, from, to) {
      const accumulated = since.get(id);
      if (!accumulated) return null;
      return mapRange(accumulated, from, to, (pos, assoc) => accumulated.mapPos(pos, assoc));
    },
  };
}
