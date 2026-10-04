// =============================================================================
// DBV Typst Editor — Aplicar una plantilla a un documento, lo mecánico (RF-116.2)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// «Aplicar plantilla…» SIN IA: DBV solo hace lo mecánico y seguro, y lo dice en vez de fingir que
// reestructuró el documento. Es lo que haría una persona con la plantilla delante:
//
//   · añade al principio el `#import` del paquete (con el identificador exacto) y el
//     `#show: plantilla.with(…)` del ejemplo de la propia plantilla;
//   · si el documento declara su título con `#set document(title: …)`, lo pone en el parámetro
//     `title:`; el resto de parámetros se quedan con los valores del ejemplo (`authors: ()`, etc.),
//     claramente provisionales, porque el formato de los autores cambia de una plantilla a otra y
//     adivinarlo rompería el documento;
//   · NO toca el contenido ni quita nada. Los `#set`/`#show` del documento que podrían chocar con
//     la plantilla se MARCAN (se listan con su línea) para que el usuario decida (RF-116.2).
//
// Con una IA configurada, el usuario puede pedirle el trabajo completo (RF-110): mover autores,
// resumen y palabras clave y quitar lo que choca.
//
// Puro y sin red: recibe el texto del documento y la documentación del paquete que ya devolvió
// `read_package_docs` (`ai_universe_package_docs`).

/** Reglas de presentación del documento que suelen chocar con una plantilla (RF-105). */
const CLASHING_RULE = /^\s*#(?:set|show)\s+(?:page|text|par|heading|figure|table|bibliography|columns|math\.equation|enum|list)\b/;

/**
 * Lo que `docsText` cuenta de una plantilla: la ruta y el texto de su ejemplo y el nombre y la firma de su función.
 * @returns {{entryPath: string|null, entrySource: string|null, functionName: string|null, signature: string|null}}
 */
export function parseTemplateDocs(docsText) {
  const text = String(docsText ?? '');
  const entry = text.match(/## Template entry point: (\S+)[^\n]*\n```typst\n([\s\S]*?)\n```/);
  const fn = text.match(/## Template function `([^`]+)`[^\n]*\n```typst\n([\s\S]*?)\n```/);
  const fromEntry = entry?.[2].match(/#show:\s*([A-Za-z0-9_-]+)/)?.[1] ?? null;
  return { entryPath: entry?.[1] ?? null, entrySource: entry?.[2] ?? null, functionName: fn?.[1] ?? fromEntry, signature: fn?.[2] ?? null };
}

/** `#show: nombre.with( … )` completo (con los paréntesis equilibrados) o `#show: nombre`, tal como está en `source`. */
export function extractShowBlock(source, name) {
  const head = `#show: ${name}.with(`;
  const start = source.indexOf(head);
  if (start === -1) return source.includes(`#show: ${name}`) ? `#show: ${name}` : null;
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

/** Título que el documento declara con `#set document(title: "…")` o `title: […]`, o `null`. */
export function documentTitle(source) {
  const call = source.match(/#set\s+document\(([\s\S]*?)\)/);
  const title = call?.[1].match(/title:\s*(?:"([^"\n]*)"|\[([^\]\n]*)\])/);
  const value = title?.[1] ?? title?.[2] ?? null;
  return value && value.trim() ? value.trim() : null;
}

/** Pone `title` en la línea `title: …,` del bloque de la plantilla; si el ejemplo no la tiene en una línea, no toca nada. */
export function withTitle(block, title) {
  if (!title) return { block, applied: false };
  const line = /^(\s*title:\s*)(.*?)(,?)\s*$/m;
  if (!line.test(block)) return { block, applied: false };
  const safe = title.replace(/[\[\]\\]/g, (c) => `\\${c}`);
  return { block: block.replace(line, (_, lead, _value, comma) => `${lead}[${safe}]${comma}`), applied: true };
}

/** Las reglas de presentación del documento que podrían chocar con la plantilla, con su línea (desde 1). */
export function clashingRules(source) {
  return source
    .split('\n')
    .map((text, index) => ({ line: index + 1, text: text.trim() }))
    .filter((row) => CLASHING_RULE.test(row.text));
}

/**
 * La propuesta mecánica de aplicar la plantilla `id` al documento `source`.
 * @param {{source: string, docsText: string, id: string}} input
 * @returns {{ok: true, text: string, summary: string, notes: string[], titleApplied: boolean, clashes: Array<{line: number, text: string}>}
 *          | {ok: false, reason: 'noTemplate'|'noExample'|'alreadyApplied'|'badId'}}
 */
export function planTemplate({ source, docsText, id }) {
  const name = String(id ?? '').match(/^@preview\/([A-Za-z0-9_-]+):\d+\.\d+\.\d+$/)?.[1];
  if (!name) return { ok: false, reason: 'badId' };
  if (source.includes(`@preview/${name}:`)) return { ok: false, reason: 'alreadyApplied' };
  const docs = parseTemplateDocs(docsText);
  if (!docs.functionName) return { ok: false, reason: 'noTemplate' };
  const block = docs.entrySource ? extractShowBlock(docs.entrySource, docs.functionName) : null;
  if (!block) return { ok: false, reason: 'noExample' };

  const title = documentTitle(source);
  const filled = withTitle(block, title);
  const header = `#import "${id}": ${docs.functionName}\n${filled.block}\n\n`;
  const clashes = clashingRules(source);
  const notes = [];
  if (!filled.applied) notes.push('title');
  if (clashes.length) notes.push('clashes');
  return { ok: true, text: header + source, summary: id, notes, titleApplied: filled.applied, clashes };
}
