// =============================================================================
// DBV Typst Editor — Asistente "Nueva entrada bibliográfica" (Beta, §7.11)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Genera BibTeX, no el formato Hayagriva nativo de Typst: las 8 plantillas
// curadas y el asistente de citas (Slice 16) ya usan `refs.bib`, y cambiar de
// formato tocaría ambos para un beneficio incierto. BibTeX sigue siendo,
// además, el formato que cualquier gestor de referencias externo exporta.
//
// Deliberadamente en la dirección opuesta a la pregunta pendiente de
// `SPECIFICATIONS.md` §9 ("qué crate de parseo BibTeX usar"): esa pregunta es
// sobre LEER campos de entradas ajenas para un panel visual; este asistente
// solo ESCRIBE entradas nuevas con una plantilla propia, sin parsear nada.
//
// Tipos y campos deliberadamente acotados a lo que un usuario académico
// escribe el 95% de las veces — no los ~20 tipos y 40 campos que admite el
// estándar BibTeX completo. `misc` cubre el resto como vía de escape.

/**
 * @typedef {object} BibField
 * @property {string} key Nombre del campo BibTeX (`author`, `title`...).
 * @property {string} i18nKey
 * @property {boolean} [required]
 */

/**
 * @typedef {object} BibEntryType
 * @property {string} id Tipo BibTeX (`@article`, `@book`...).
 * @property {string} i18nKey
 * @property {BibField[]} fields
 */

const AUTHOR = { key: 'author', i18nKey: 'bibEntry.field.author', required: true };
const TITLE = { key: 'title', i18nKey: 'bibEntry.field.title', required: true };
const YEAR = { key: 'year', i18nKey: 'bibEntry.field.year', required: true };

/** @type {BibEntryType[]} */
export const BIB_ENTRY_TYPES = [
  {
    id: 'article',
    i18nKey: 'bibEntry.type.article',
    fields: [
      AUTHOR,
      TITLE,
      { key: 'journal', i18nKey: 'bibEntry.field.journal', required: true },
      YEAR,
      { key: 'volume', i18nKey: 'bibEntry.field.volume' },
      { key: 'pages', i18nKey: 'bibEntry.field.pages' },
    ],
  },
  {
    id: 'book',
    i18nKey: 'bibEntry.type.book',
    fields: [AUTHOR, TITLE, { key: 'publisher', i18nKey: 'bibEntry.field.publisher', required: true }, YEAR],
  },
  {
    id: 'inproceedings',
    i18nKey: 'bibEntry.type.inproceedings',
    fields: [
      AUTHOR,
      TITLE,
      { key: 'booktitle', i18nKey: 'bibEntry.field.booktitle', required: true },
      YEAR,
      { key: 'pages', i18nKey: 'bibEntry.field.pages' },
    ],
  },
  {
    id: 'phdthesis',
    i18nKey: 'bibEntry.type.phdthesis',
    fields: [AUTHOR, TITLE, { key: 'school', i18nKey: 'bibEntry.field.school', required: true }, YEAR],
  },
  {
    id: 'mastersthesis',
    i18nKey: 'bibEntry.type.mastersthesis',
    fields: [AUTHOR, TITLE, { key: 'school', i18nKey: 'bibEntry.field.school', required: true }, YEAR],
  },
  {
    id: 'misc',
    i18nKey: 'bibEntry.type.misc',
    fields: [
      { ...AUTHOR, required: false },
      TITLE,
      { key: 'year', i18nKey: 'bibEntry.field.year' },
      { key: 'url', i18nKey: 'bibEntry.field.url' },
      { key: 'note', i18nKey: 'bibEntry.field.note' },
    ],
  },
];

/**
 * Sugiere una clave a partir del primer autor y el año — `"Bueno, David"`
 * o `"David Bueno"`, 2026 → `"bueno2026"`. El usuario siempre puede
 * cambiarla antes de guardar; esto es solo un punto de partida razonable.
 * Función pura, sin acceso a las claves ya existentes — comprobar que no
 * colisiona con una entrada real es responsabilidad de quien la use
 * (`bibliography_keys` ya existe para eso, Slice 16).
 */
export function suggestBibKey(author, year) {
  const firstAuthor = (author ?? '').split(/\s+and\s+/i)[0] ?? '';
  const surname = firstAuthor.includes(',')
    ? firstAuthor.split(',')[0]
    : firstAuthor.trim().split(/\s+/).pop() ?? '';

  const normalized = surname
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // marcas diacríticas tras NFD (tildes, diéresis...)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  return `${normalized || 'ref'}${(year ?? '').trim()}`;
}

/**
 * Serializa una entrada BibTeX. Los campos vacíos se omiten en vez de
 * escribirse como `campo = {}` — una entrada real nunca debería tener un
 * campo declarado y vacío, confundiría a cualquier lector de BibTeX.
 */
export function serializeBibEntry(typeId, key, values) {
  const type = BIB_ENTRY_TYPES.find((candidate) => candidate.id === typeId);
  if (!type) throw new Error(`tipo de entrada BibTeX desconocido: ${typeId}`);

  const lines = type.fields
    .map((field) => [field.key, (values[field.key] ?? '').trim()])
    .filter(([, value]) => value !== '')
    .map(([fieldKey, value]) => `  ${fieldKey} = {${value}}`);

  return `@${type.id}{${key},\n${lines.join(',\n')}\n}\n`;
}

/** Claves de los campos obligatorios sin rellenar — vacío si todo está bien. */
export function validateBibFields(typeId, values) {
  const type = BIB_ENTRY_TYPES.find((candidate) => candidate.id === typeId);
  if (!type) return [];
  return type.fields.filter((field) => field.required && !(values[field.key] ?? '').trim()).map((field) => field.key);
}
