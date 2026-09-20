// =============================================================================
// DBV Typst Editor — Modelo de diagnósticos en línea (RF-59)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Los errores y avisos de la compilación del motor en proceso llegan como
// rangos (línea/columna, 1-indexados, columna en UTF-16). Aquí se convierten a
// los desplazamientos que usa CodeMirror y se combinan con los de Tinymist sin
// duplicar: si los dos dicen lo mismo sobre el mismo trozo, se enseña una vez.
// Funciones puras sobre un `doc` con `lines` y `line(n)`, para probarlas sin editor.

/** Origen que se enseña en el subrayado y en la lista de problemas. */
export const ENGINE_SOURCE = 'Typst';

const SEVERITY = { error: 'error', warning: 'warning' };

/**
 * Una posición línea/columna → desplazamiento, recortada al documento (el texto
 * pudo cambiar desde la compilación: nunca debe salir un índice fuera de rango).
 */
export function offsetOf(doc, line, column) {
  const number = Math.min(Math.max(1, line), doc.lines);
  const info = doc.line(number);
  return Math.min(info.from + Math.max(0, column - 1), info.to);
}

/**
 * Diagnósticos del motor que caen en `file` (ruta relativa con `/`), en formato
 * CodeMirror. Los de otros ficheros no se subrayan aquí: van a la lista.
 *
 * @param {Array} diagnostics Los de `engine_diagnostics`.
 * @param {string | null} file Fichero abierto, relativo a la raíz.
 * @param {{lines: number, line: (n: number) => {from: number, to: number}}} doc
 */
export function toEditorDiagnostics(diagnostics, file, doc) {
  if (file === null) return [];
  return diagnostics
    .filter((d) => d.file === file)
    .map((d) => {
      const from = offsetOf(doc, d.startLine, d.startColumn);
      const to = Math.max(from, offsetOf(doc, d.endLine, d.endColumn));
      const hints = d.hints?.length ? `\n${d.hints.map((h) => `• ${h}`).join('\n')}` : '';
      return {
        from,
        to,
        severity: SEVERITY[d.level] ?? 'info',
        message: `${d.message}${hints}`,
        source: ENGINE_SOURCE,
      };
    });
}

/** ¿Se solapan dos rangos (o son el mismo punto)? */
function overlaps(a, b) {
  return a.from <= b.to && b.from <= a.to;
}

/**
 * Quita de los del motor los que Tinymist ya cuenta: misma gravedad y rangos que
 * se solapan. Tinymist gana (es lo que el usuario ya conoce) y su lista no se toca.
 */
export function dedupeAgainstTinymist(engine, tinymist) {
  return engine.filter((e) => !tinymist.some((t) => t.severity === e.severity && overlaps(e, t)));
}

/** Combina las dos listas para el subrayado: Tinymist primero, luego lo que solo ve el motor. */
export function mergeDiagnostics(engine, tinymist) {
  return [...tinymist, ...dedupeAgainstTinymist(engine, tinymist)];
}

/**
 * Lista para el panel de problemas: todos los ficheros, errores primero.
 * @returns {{level: string, message: string, file: string | null, line: number, column: number, from?: number}[]}
 */
export function toProblemList(diagnostics) {
  const rank = (level) => (level === 'error' ? 0 : 1);
  return diagnostics
    .map((d) => ({
      level: d.level,
      message: d.message,
      hints: d.hints ?? [],
      file: d.file,
      line: d.startLine,
      column: d.startColumn,
    }))
    .sort((a, b) => rank(a.level) - rank(b.level));
}

/** Recuento para la etiqueta: `{errors, warnings}`. */
export function countProblems(diagnostics) {
  const errors = diagnostics.filter((d) => d.level === 'error').length;
  return { errors, warnings: diagnostics.length - errors };
}
