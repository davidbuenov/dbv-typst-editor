// =============================================================================
// DBV Typst Editor — Objetivo de compilación (RF-14)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Qué se compila, sobre qué raíz y con qué contenido sin guardar. Lo deciden el
// proyecto y el alcance elegido, no cada consumidor: la vista previa, el panel
// de navegación estructural y las exportaciones piden todos ESTE objetivo.
//
// La objeción 6 del Adversarial Architect Review: si la vista previa pasa a
// mostrar el documento raíz pero la exportación sigue apuntando al fichero
// abierto, el usuario exporta algo distinto de lo que ve. Función pura para que
// esa regla se pueda comprobar sin montar el espacio de trabajo entero.

import { joinPath } from './paths.js';

/**
 * @param {object} input
 * @param {null | {root: string, entrypoint: string|null, isSingleFile: boolean}} input.project
 * @param {string | null} input.previewDocument Último documento Typst abierto.
 * @param {string | null} input.dirtyPath Fichero con cambios sin guardar, si lo hay.
 * @param {string | null} input.dirtyContent Su contenido en el editor.
 * @param {'document' | 'file'} input.scope
 * @returns {import('../services/backend.js').CompileTarget | null}
 */
export function buildCompileTarget({ project, previewDocument, dirtyPath, dirtyContent, scope }) {
  if (!project || !previewDocument) return null;

  // El documento raíz solo manda si existe y el proyecto es una carpeta: un
  // `.typ` suelto ES su propio documento (RF-02b), no tiene entrypoint aparte.
  const useRoot = scope === 'document' && hasRootDocument(project);

  return {
    document: useRoot ? joinPath(project.root, project.entrypoint) : previewDocument,
    root: project.root,
    singleFile: Boolean(project.isSingleFile),
    // El fichero sucio puede NO ser el que se compila: editar un capítulo
    // mientras se previsualiza `main.typ` es justo el caso que motivó RF-14.
    dirtyPath: dirtyPath ?? null,
    dirtyContent: dirtyPath ? (dirtyContent ?? '') : null,
  };
}

/**
 * True si el proyecto tiene un documento raíz distinto del fichero abierto, y
 * por tanto tiene sentido ofrecer el conmutador de alcance.
 * @param {null | {entrypoint: string|null, isSingleFile: boolean}} project
 */
export function hasRootDocument(project) {
  return Boolean(project?.entrypoint) && !project?.isSingleFile;
}
