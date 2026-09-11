// =============================================================================
// DBV Typst Editor — Parseo de marcas de conflicto de fusión Git (RF-19)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Un `git pull` que fusiona pero no puede resolver un fichero solo deja las
// marcas de conflicto dentro (`<<<<<<< HEAD` / `=======` / `>>>>>>> <hash>`) y
// termina con código de error — verificado reproduciendo un conflicto real
// contra el git del sistema, no de memoria. Sin ayuda, el usuario se
// encuentra el texto crudo de las marcas en su documento y tiene que saber
// qué son para poder hacer algo con ellas.
//
// Funciones puras sobre el texto del fichero, sin backend ni DOM — mismo
// patrón que `toolbarActions.js`/`diagramModel.js`: se testean solas, y la UI
// que las usa (`gitManager.js`/`main.js`) solo las aplica.

/** ¿El texto contiene al menos una marca de conflicto sin resolver? */
export function hasConflictMarkers(text) {
  return /^<{7} /m.test(text);
}

/**
 * Trocea el texto en segmentos de contexto (sin conflicto) y de conflicto
 * (con la versión propia y la remota). El orden de los segmentos reconstruye
 * el fichero completo si se concatenan con `\n`.
 * @param {string} text
 * @returns {Array<
 *   | {type: 'context', text: string}
 *   | {type: 'conflict', ours: string, theirs: string, theirsLabel: string}
 * >}
 */
export function parseConflictMarkers(text) {
  const lines = text.split('\n');
  const segments = [];
  let contextBuf = [];
  let i = 0;

  const flushContext = () => {
    if (contextBuf.length > 0) {
      segments.push({ type: 'context', text: contextBuf.join('\n') });
      contextBuf = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith('<<<<<<< ')) {
      contextBuf.push(line);
      i += 1;
      continue;
    }

    flushContext();
    i += 1;
    const oursLines = [];
    while (i < lines.length && !lines[i].startsWith('=======')) {
      oursLines.push(lines[i]);
      i += 1;
    }
    i += 1; // salta la línea `=======`
    const theirsLines = [];
    while (i < lines.length && !lines[i].startsWith('>>>>>>> ')) {
      theirsLines.push(lines[i]);
      i += 1;
    }
    const theirsLabel = lines[i]?.slice('>>>>>>> '.length) ?? '';
    i += 1; // salta la línea `>>>>>>> <hash>`

    segments.push({
      type: 'conflict',
      ours: oursLines.join('\n'),
      theirs: theirsLines.join('\n'),
      theirsLabel,
    });
  }

  flushContext();
  return segments;
}

/**
 * Reconstruye el texto resuelto a partir de los segmentos y una elección por
 * cada bloque de conflicto, en el mismo orden en que aparecen.
 * @param {ReturnType<typeof parseConflictMarkers>} segments
 * @param {Array<'ours'|'theirs'>} choices
 * @returns {string}
 */
export function resolveConflicts(segments, choices) {
  let choiceIndex = 0;
  const parts = [];
  for (const segment of segments) {
    if (segment.type === 'context') {
      parts.push(segment.text);
      continue;
    }
    const choice = choices[choiceIndex] ?? 'ours';
    choiceIndex += 1;
    parts.push(choice === 'theirs' ? segment.theirs : segment.ours);
  }
  return parts.join('\n');
}

/** Cuántos bloques de conflicto hay que resolver en total. */
export function countConflicts(segments) {
  return segments.filter((segment) => segment.type === 'conflict').length;
}
