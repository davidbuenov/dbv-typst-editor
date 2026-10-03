// =============================================================================
// DBV Typst Editor — Ficheros de estilo y separación de presentación (RF-105)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Funciones PURAS. La IA debe poner el aspecto (`#set`, `#show`, tipografías,
// márgenes…) en ficheros de estilo y dejar los de contenido limpios. Aquí se
// detecta qué ficheros de un proyecto son de estilo (para decírselo a la IA) y
// se mide si un cambio respetó la separación (para el eval, RF-105.7).

/** Nombres habituales de un fichero de estilo (el nombre base, sin carpeta). */
const STYLE_NAME = /^(?:estilos?|styles?|template|plantilla|config|conf|tema|theme)\.typ$/i;

/**
 * Líneas que son reglas de estilo: `#set`/`#show` al principio de línea, o
 * `set`/`show` con sangría dentro de un bloque de código (`#let f(doc) = { set … }`).
 * `#show: plantilla` NO cuenta: es aplicar el estilo, justo lo que el principal debe hacer.
 */
const RULE_LINE = /^(?:[ \t]*#(?:set\b|show\b(?!\s*:))|[ \t]{2,}(?:set|show)\b)/gm;

/** Cuántas reglas de estilo hay en un texto Typst. */
export function countStyleRules(text) {
  return (String(text ?? '').match(RULE_LINE) ?? []).length;
}

const baseName = (path) => String(path).split('/').at(-1);

/** ¿El nombre es el de un fichero de estilo habitual? */
export function isStyleFileName(path) {
  return STYLE_NAME.test(baseName(path));
}

/**
 * Ficheros que el documento principal importa o incluye (`#import "x.typ"`, `#include "x.typ"`),
 * como rutas relativas a la carpeta del principal.
 */
export function importedFiles(text) {
  const found = new Set();
  for (const match of String(text ?? '').matchAll(/#(?:import|include)\s+"([^"]+\.typ)"/g)) found.add(match[1].replace(/^\.\//, ''));
  return [...found];
}

/** Línea que NO es contenido: directiva, comentario, cierre o código con sangría. */
const NON_CONTENT = /^(?:#(?:let|set|show|import|include)\b|\/\/|[)}\]]|[ \t]+\S)/;

/** ¿Un fichero tiene solo reglas y funciones, sin texto de contenido? */
export function looksLikeStyleFile(text) {
  const lines = String(text ?? '').split('\n').filter((line) => line.trim());
  return lines.length > 0 && lines.every((line) => NON_CONTENT.test(line)) && /^\s*(?:#(?:let|set|show)\b|\s{2,}(?:set|show)\b)/m.test(text);
}

/**
 * Qué ficheros del proyecto son de estilo: los que se llaman como tal, y los
 * que el documento principal importa y solo contienen reglas y funciones
 * (cuando se conoce su texto).
 * @param {{files: string[], entrypointText?: string|null, texts?: Record<string, string|null>}} options
 * @returns {string[]}
 */
export function detectStyleFiles({ files, entrypointText = null, texts = {} }) {
  const known = new Set(files);
  const byName = files.filter(isStyleFileName);
  const imported = importedFiles(entrypointText).filter((path) => known.has(path) && texts[path] != null && looksLikeStyleFile(texts[path]));
  return [...new Set([...byName, ...imported])].sort();
}

/**
 * ¿El cambio respetó la separación? Compara el proyecto antes y después:
 *  · `contentKept`: los ficheros de contenido no ganaron reglas de estilo;
 *  · `styleChanged`: algún fichero de estilo (creado o modificado) cambió.
 * @param {{before: Record<string, string>, after: Record<string, string>, contentFiles?: string[]}} options
 *   `before`/`after`: ruta → texto; `contentFiles`: los ficheros de contenido (por defecto `main.typ`).
 */
export function separationChecks({ before, after, contentFiles = ['main.typ'] }) {
  const isContent = (path) => contentFiles.includes(path);
  const rules = (files) =>
    Object.entries(files)
      .filter(([path]) => path.endsWith('.typ') && isContent(path))
      .reduce((sum, [, text]) => sum + countStyleRules(text), 0);
  return {
    contentKept: rules(after) <= rules(before),
    // Cambiar un valor existente (`2cm` → `3cm`) no añade reglas, pero sí cambia el fichero.
    styleChanged: Object.entries(after).some(([path, text]) => path.endsWith('.typ') && !isContent(path) && before[path] !== text),
  };
}
