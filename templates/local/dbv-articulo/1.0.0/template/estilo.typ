// =============================================================================
// Plantilla de artículo académico de DBV Typst Editor — definición de estilo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Viaja dentro del proyecto creado: el documento compila con `typst` a secas,
// sin depender de DBV Typst Editor. Edítalo libremente.

#let articulo(
  titulo: "",
  autor: "",
  institucion: "",
  correo: "",
  resumen: "",
  palabras-clave: "",
  cuerpo,
) = {
  set document(title: titulo, author: autor)
  set page(paper: "a4", margin: 2.2cm, numbering: "1", number-align: center)
  // Solo fuentes que vienen dentro del compilador Typst (ver plantilla TFG).
  set text(font: "Libertinus Serif", size: 10pt, lang: "es")
  set par(justify: true, leading: 0.62em)
  set heading(numbering: "1.1")

  show heading.where(level: 1): it => block(above: 1.4em, below: 0.7em)[
    #set text(size: 11pt, weight: "bold")
    #it
  ]
  show heading.where(level: 2): it => block(above: 1.1em, below: 0.6em)[
    #set text(size: 10pt, weight: "bold", style: "italic")
    #it
  ]

  // Cabecera a una columna: el título y la autoría cruzan todo el ancho, y solo
  // el cuerpo se reparte en dos columnas — la convención habitual en papers.
  align(center)[
    #block(width: 100%)[
      #text(size: 17pt, weight: "bold", titulo)
      #v(0.7em)
      #text(size: 11pt, autor)
      #if institucion != [] and institucion != "" [
        \
        #text(size: 9.5pt, style: "italic", institucion)
      ]
      #if correo != [] and correo != "" [
        \
        #text(size: 9pt, raw(correo))
      ]
    ]
  ]

  v(1em)

  block(width: 100%, inset: (x: 1.6cm))[
    #set par(justify: true)
    #text(weight: "bold", size: 9pt)[Resumen. ]
    #text(size: 9pt, resumen)
    #if palabras-clave != "" [
      #v(0.5em)
      #text(weight: "bold", size: 9pt)[Palabras clave: ]
      #text(size: 9pt, style: "italic", palabras-clave)
    ]
  ]

  v(1.2em)

  columns(2, gutter: 1.2em, cuerpo)
}
