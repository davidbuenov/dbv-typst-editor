// =============================================================================
// DBV Typst Editor — Lenguaje del fichero abierto (RF-60)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El editor abre, además de `.typ`, ficheros de código y de texto (`.cpp`,
// `.java`, `.py`…) que un documento incrusta con `read()`. Cada uno se resalta con
// su paquete de lenguaje de CodeMirror, cargado BAJO DEMANDA: `@codemirror/language-data`
// solo trae descriptores y cada paquete se importa dinámicamente al abrir el primer
// fichero de ese lenguaje, así el arranque no paga por los treinta que no se usan.
//
// Un fichero sin lenguaje conocido se edita como texto plano, sin resaltado.

import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { isTypstPath } from '../app/paths.js';
import { bibtexLanguageDescription } from './bibtexLanguage.js';

/** Nombre del lenguaje que se enseña en la insignia del documento. */
export const TYPST_LABEL = 'Typst';

/** True si `path` es un fichero de bibliografía BibTeX (RF-62). */
function isBibPath(path) {
  return /\.bib$/i.test(path ?? '');
}

/**
 * Qué lenguaje corresponde a `path`. Función pura: no carga nada.
 *
 * @param {string | null | undefined} path
 * @returns {{kind: 'typst' | 'code' | 'text', name: string, description: LanguageDescription | null}}
 */
export function detectLanguage(path) {
  if (!path) return { kind: 'text', name: 'Texto', description: null };
  if (isTypstPath(path)) return { kind: 'typst', name: TYPST_LABEL, description: null };
  // BibTeX no viene en `@codemirror/language-data` (RF-62): se resuelve antes
  // de consultarla, con la misma forma de resultado que el resto de lenguajes
  // de código para que `applyLanguage`/`loadLanguageExtension` no distingan.
  if (isBibPath(path)) {
    return { kind: 'code', name: bibtexLanguageDescription.name, description: bibtexLanguageDescription };
  }
  const fileName = path.split(/[\\/]/).pop() ?? path;
  const description = LanguageDescription.matchFilename(languages, fileName);
  if (description) return { kind: 'code', name: description.name, description };
  return { kind: 'text', name: 'Texto', description: null };
}

/**
 * Carga el paquete del lenguaje. Devuelve `null` si no lo hay o si la carga
 * falla (sin red no aplica: va empaquetado; un fallo aquí no debe impedir editar).
 *
 * @param {{description: LanguageDescription | null}} language
 * @returns {Promise<import('@codemirror/state').Extension | null>}
 */
export async function loadLanguageExtension(language) {
  if (!language.description) return null;
  try {
    return await language.description.load();
  } catch (error) {
    console.warn('[editor] no se pudo cargar el lenguaje', language.name, error);
    return null;
  }
}
