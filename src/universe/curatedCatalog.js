// =============================================================================
// DBV Typst Editor — Catálogo curado de Typst Universe
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Typst Universe tiene 4.675 paquetes, 2.266 de ellos plantillas. Ofrecerlos
// todos sin filtro sería pedirle al usuario que juzgue por su cuenta código de
// terceros que se descarga y ejecuta en su máquina — una decisión editorial que
// este producto sí toma (ARCHITECTURE.md §6, riesgo de cadena de suministro).
//
// La política acordada con el usuario: **lista revisada + campo libre**. Aquí
// está la lista revisada; quien sepa lo que hace puede pegar cualquier
// identificador en el campo, que es una decisión suya y consciente.
//
// TODOS los nombres, versiones y licencias de este fichero se comprobaron
// contra `packages.typst.org/preview/index.json` el 2026-09-05, no de memoria
// — en la primera pasada, uno de los candidatos ni siquiera existía con el
// nombre que parecía obvio. Al actualizar este catálogo, volver a comprobarlo:
// una versión inventada produce un error de descarga en la cara del usuario.

/** Plantillas: crean un proyecto nuevo (`typst init`). */
export const CURATED_TEMPLATES = [
  {
    spec: '@preview/charged-ieee:0.1.4',
    title: 'IEEE — artículo de congreso o revista',
    titleEn: 'IEEE — conference or journal paper',
    description: 'Formato IEEE para ingeniería e informática. Mantenida por el equipo de Typst.',
    descriptionEn: 'IEEE format for engineering and computer science. Maintained by the Typst team.',
    license: 'MIT-0',
  },
  {
    spec: '@preview/faithful-acmart:0.1.0',
    title: 'ACM — todos los formatos de acmart',
    titleEn: 'ACM — every acmart format',
    description: 'Reproduce fielmente la clase LaTeX acmart de ACM.',
    descriptionEn: 'Faithfully reproduces ACM’s acmart LaTeX class.',
    license: 'MIT AND MIT-0',
  },
  {
    spec: '@preview/springer-spaniel:0.1.0',
    title: 'Springer — capítulo de libro',
    titleEn: 'Springer — book chapter',
    description: 'Recreación de la plantilla de capítulo contribuido de Springer.',
    descriptionEn: 'Recreation of the Springer contributed chapter template.',
    license: 'Unlicense',
  },
  {
    spec: '@preview/ilm:2.1.1',
    title: 'ilm — libro, informe o apuntes',
    titleEn: 'ilm — book, report or class notes',
    description: 'Plantilla minimalista y versátil para escritura de no ficción.',
    descriptionEn: 'Minimal, versatile template for non-fiction writing.',
    license: 'MIT-0',
  },
  {
    spec: '@preview/modern-cv:0.10.0',
    title: 'modern-cv — currículum',
    titleEn: 'modern-cv — resume',
    description: 'Currículum moderno, basado en la plantilla Awesome-CV de LaTeX.',
    descriptionEn: 'Modern resume based on the Awesome-CV LaTeX template.',
    license: 'MIT',
  },
  {
    spec: '@preview/appreciated-letter:0.1.0',
    title: 'Carta formal',
    titleEn: 'Formal letter',
    description: 'Carta para correspondencia profesional. Mantenida por el equipo de Typst.',
    descriptionEn: 'Letter for business correspondence. Maintained by the Typst team.',
    license: 'MIT-0',
  },
];

/** Paquetes: se importan en un documento que ya existe (`#import`). */
export const CURATED_PACKAGES = [
  {
    spec: '@preview/cetz:0.5.2',
    title: 'cetz — dibujo y diagramas',
    titleEn: 'cetz — drawing and diagrams',
    description: 'Dibujar con Typst, con una API inspirada en TikZ.',
    descriptionEn: 'Drawing with Typst, with an API inspired by TikZ.',
    license: 'LGPL-3.0-or-later',
  },
  {
    spec: '@preview/fletcher:0.5.8',
    title: 'fletcher — diagramas de nodos y flechas',
    titleEn: 'fletcher — node and arrow diagrams',
    description: 'Diagramas con nodos y flechas, sobre cetz.',
    descriptionEn: 'Diagrams with nodes and arrows, built on cetz.',
    license: 'MIT',
  },
  {
    spec: '@preview/chronos:0.3.0',
    title: 'chronos — diagramas de secuencia',
    titleEn: 'chronos — sequence diagrams',
    description: 'Diagramas de secuencia (actores, mensajes, ciclo de vida) construidos sobre cetz.',
    descriptionEn: 'Sequence diagrams (actors, messages, lifelines) built on top of cetz.',
    license: 'Apache-2.0',
  },
  {
    spec: '@preview/touying:0.7.4',
    title: 'touying — presentaciones',
    titleEn: 'touying — presentations',
    description: 'Diapositivas con animaciones y varios temas visuales.',
    descriptionEn: 'Slides with animations and several visual themes.',
    license: 'MIT',
  },
  {
    spec: '@preview/quick-maths:0.2.1',
    title: 'quick-maths — atajos matemáticos',
    titleEn: 'quick-maths — maths shorthands',
    description: 'Abreviaturas para escribir ecuaciones más rápido.',
    descriptionEn: 'Shorthands for writing equations faster.',
    license: 'MIT',
  },
  {
    spec: '@preview/physica:0.9.8',
    title: 'physica — física e ingeniería',
    titleEn: 'physica — physics and engineering',
    description: 'Derivadas, diferenciales, campos vectoriales, tensores y notación de Dirac.',
    descriptionEn: 'Derivatives, differentials, vector fields, tensors and Dirac notation.',
    license: 'MIT',
  },
  {
    spec: '@preview/codly:1.3.0',
    title: 'codly — bloques de código',
    titleEn: 'codly — code blocks',
    description: 'Código con numeración de líneas, resaltado y sangrado inteligente.',
    descriptionEn: 'Code with line numbers, highlighting and smart indentation.',
    license: 'MIT',
  },
  {
    spec: '@preview/zebraw:0.6.3',
    title: 'zebraw — código ligero',
    titleEn: 'zebraw — lightweight code',
    description: 'Alternativa ligera y rápida para bloques de código con líneas numeradas.',
    descriptionEn: 'Lightweight, fast alternative for code blocks with line numbers.',
    license: 'MIT',
  },
  {
    spec: '@preview/showybox:2.0.4',
    title: 'showybox — cajas destacadas',
    titleEn: 'showybox — callout boxes',
    description: 'Cajas de color personalizables para avisos, definiciones o teoremas.',
    descriptionEn: 'Customizable colored boxes for notes, definitions or theorems.',
    license: 'MIT',
  },
  {
    spec: '@preview/tablem:0.3.0',
    title: 'tablem — tablas al estilo Markdown',
    titleEn: 'tablem — Markdown-style tables',
    description: 'Escribir tablas con la sintaxis de Markdown, sin `table(...)`.',
    descriptionEn: 'Write tables with Markdown syntax instead of `table(...)`.',
    license: 'MIT',
  },
  {
    spec: '@preview/subpar:0.2.2',
    title: 'subpar — subfiguras',
    titleEn: 'subpar — subfigures',
    description: 'Figuras con subfiguras (a), (b), (c) y su numeración.',
    descriptionEn: 'Figures with (a), (b), (c) subfigures and their numbering.',
    license: 'MIT',
  },
  {
    spec: '@preview/lovelace:0.3.1',
    title: 'lovelace — pseudocódigo',
    titleEn: 'lovelace — pseudocode',
    description: 'Algoritmos en pseudocódigo, flexible y sin imponer estilo.',
    descriptionEn: 'Algorithms in pseudocode, flexible and unopinionated.',
    license: 'MIT',
  },
  {
    spec: '@preview/glossarium:0.5.10',
    title: 'glossarium — glosario',
    titleEn: 'glossarium — glossary',
    description: 'Glosario de términos y acrónimos, con referencias cruzadas.',
    descriptionEn: 'Glossary of terms and acronyms, with cross-references.',
    license: 'MIT',
  },
  {
    spec: '@preview/unify:0.8.1',
    title: 'unify — números y unidades',
    titleEn: 'unify — numbers and units',
    description: 'Formatea números, unidades y rangos correctamente.',
    descriptionEn: 'Formats numbers, units and ranges correctly.',
    license: 'MIT',
  },
  {
    spec: '@preview/wordometer:0.1.5',
    title: 'wordometer — recuento de palabras',
    titleEn: 'wordometer — word count',
    description: 'Cuenta palabras y da estadísticas del documento.',
    descriptionEn: 'Counts words and reports document statistics.',
    license: 'MIT',
  },
];

/** Nombre de paquete (sin versión) de cada entrada curada, para el badge de RF-34. */
const CURATED_NAMES = new Set(
  [...CURATED_TEMPLATES, ...CURATED_PACKAGES].map((entry) => entry.spec.split('/')[1].split(':')[0])
);

/**
 * RF-34: ¿este nombre de paquete está en la whitelist curada de DBV? Modelo
 * de dos niveles del Universe Browser completo — la lista curada conserva el
 * badge "verificado"; cualquier otro paquete del catálogo sin filtrar se
 * marca como "comunidad, sin revisar", mismo aviso de terceros que ya usa la
 * pestaña "Dirección" de la galería (RF-26.5), sin inventar un lenguaje de
 * confianza nuevo.
 * @param {string} name Nombre de paquete sin `@preview/` ni versión.
 */
export function isCuratedPackageName(name) {
  return CURATED_NAMES.has(name);
}

/**
 * Adapta una entrada cruda de `fetch_universe_index` (name/version/
 * description/authors/license) a la forma de tarjeta que ya consume
 * `universePanel.js` (spec/title/description/license) — sin duplicar el
 * componente de tarjeta para el catálogo completo.
 * @param {{name: string, version: string, description: string, authors: string[], license: string}} entry
 */
export function universeIndexEntryToCard(entry) {
  const spec = `@preview/${entry.name}:${entry.version}`;
  return {
    spec,
    title: entry.name,
    titleEn: entry.name,
    description: entry.description || '',
    descriptionEn: entry.description || '',
    license: entry.license || '—',
    verified: isCuratedPackageName(entry.name),
    // El catálogo completo mezcla paquetes y plantillas en la MISMA lista de
    // `index.json` (casi la mitad son plantillas — ver la cabecera del
    // fichero). `isTemplate` decide en `universePanel.js` si "Usar" importa
    // el paquete en el documento abierto o crea un proyecto nuevo — sin esto,
    // una plantilla como `campanile` (tesis de Berkeley) se insertaba como
    // `#import`, que no es cómo se usa (hallazgo del usuario, 2026-09-12).
    isTemplate: Boolean(entry.isTemplate),
  };
}

/**
 * Filtro de búsqueda sobre el catálogo completo (RF-34): substring sin
 * distinguir mayúsculas sobre nombre y descripción. Función pura, sin acceso
 * a red — el índice ya llegó cacheado desde `fetch_universe_index`.
 * @param {Array<{name: string, description: string}>} entries
 * @param {string} query
 */
export function filterUniverseIndexEntries(entries, query) {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];

  return entries.filter(
    (entry) =>
      entry.name.toLowerCase().includes(needle) || (entry.description ?? '').toLowerCase().includes(needle)
  );
}
