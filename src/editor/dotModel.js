// =============================================================================
// DBV Typst Editor — Modelo puro del asistente de DOT/Graphviz (RF-51)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Paquete elegido en `/spec` (SPECIFICATIONS.md §5g v1.9) y verificado contra
// el registro real de Typst Universe: `@preview/diagraph:0.3.7` (licencia
// MIT). Su API real es una única función, `render(dot_string)` — quien usa
// este requisito ya tiene o ya sabe escribir el DOT (Sección XI del artículo
// de referencia lo describe así), así que no hay piezas que combinar como en
// `equationModel.js`: el propio texto DOT del usuario ES el contenido.
//
// Mismo reparto que el resto de asistentes de esta versión: funciones puras
// sin DOM — `dotEditor.js` es el cableado fino encima, con vista previa en
// vivo reutilizando el patrón de `equationEditor.js` (RF-46).

import { escapeTypstString } from './typstEscape.js';

const DIAGRAPH_SPEC = '@preview/diagraph:0.3.7';

/**
 * Envuelve el texto DOT en la llamada de inserción — SIN el `#import`, que se
 * añade aparte y solo si el documento no lo tiene ya (mismo criterio que el
 * resto de asistentes).
 * @returns {string | null} `null` si `dot` está vacío.
 */
export function wrapDotForInsert(dot) {
  const trimmed = dot.trim();
  if (!trimmed) return null;
  return `#render("${escapeTypstString(trimmed)}")`;
}

export function hasDiagraphImport(docText) {
  return /#import\s+["']@preview\/diagraph[:0-9.]*["']/.test(docText);
}

export function diagraphImportLine() {
  return `#import "${DIAGRAPH_SPEC}": render`;
}
