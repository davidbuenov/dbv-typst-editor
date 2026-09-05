// =============================================================================
// Plantilla de Presentación de DBV Typst Editor — definición de estilo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Este fichero viaja DENTRO del proyecto creado, no se importa como paquete:
// así el documento compila con `typst` a secas, sin depender de DBV Typst
// Editor ni de ningún `--package-path`.
//
// Sin `polylux` ni ningún otro paquete de diapositivas: Typst trae de fábrica
// el tamaño de página "presentation-16-9", y con eso basta para un sistema de
// diapositivas mínimo — coherente con que las 4 plantillas curadas de v0.1 ya
// eran autocontenidas (Slice 7, ARCHITECTURE.md §7.6.3). Si en el futuro se
// quiere paginación de constructos ("aparece paso a paso"), transiciones o
// notas de orador, ahí sí compensa depender de un paquete de Typst Universe —
// pero eso es Beta, no la plantilla base.

#let diapositivas(titulo: "", autor: "", cuerpo) = {
  set document(title: titulo, author: autor)
  set page(paper: "presentation-16-9", margin: 1.8cm)
  set text(font: "Libertinus Serif", size: 20pt, lang: "es")
  cuerpo
}

/// Diapositiva de título — la primera del documento, sin llamar a `diapositiva()`
/// porque no lleva el título en la misma posición que el resto.
#let portada(titulo, subtitulo: "", autor: "", institucion: "", fecha: "") = {
  set align(horizon + center)
  block(text(size: 34pt, weight: "bold", titulo))
  if subtitulo != "" {
    v(0.5cm)
    block(text(size: 20pt, style: "italic", subtitulo))
  }
  v(1.5cm)
  set text(size: 16pt)
  block[
    #autor
    #if institucion != "" [ · #institucion ]
    #if fecha != "" [ · #fecha ]
  ]
}

/// Diapositiva de contenido normal: salto de página + título arriba + cuerpo.
#let diapositiva(titulo, cuerpo) = {
  pagebreak(weak: true)
  block(width: 100%, text(size: 26pt, weight: "bold", titulo))
  v(0.6cm)
  set text(size: 20pt)
  cuerpo
}
