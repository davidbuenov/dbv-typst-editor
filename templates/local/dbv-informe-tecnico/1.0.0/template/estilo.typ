// =============================================================================
// Plantilla de Informe técnico de DBV Typst Editor — definición de estilo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Este fichero viaja DENTRO del proyecto creado, no se importa como paquete:
// así el documento compila con `typst` a secas, sin depender de DBV Typst
// Editor ni de ningún `--package-path`. Puedes editarlo libremente.
//
// Deliberadamente más ligero que TFG/TFM/Tesis: sin portada institucional a
// toda página, sin índice en página aparte y sin numeración romana previa — un
// informe técnico se lee de un tirón, no se encuaderna.

#let informe(
  titulo: "",
  autor: "",
  departamento: "",
  correo: "",
  resumen: "",
  cuerpo,
) = {
  set document(title: titulo, author: autor)
  set page(
    paper: "a4",
    margin: (top: 2.5cm, bottom: 2.5cm, x: 2.5cm),
    header: context {
      if counter(page).get().first() > 1 [
        #set text(size: 9pt, fill: rgb("#666666"))
        #titulo
        #h(1fr)
        #departamento
      ]
    },
  )
  set text(font: "Libertinus Serif", size: 11pt, lang: "es")
  set par(justify: true, leading: 0.7em)
  set heading(numbering: "1.1")

  show heading.where(level: 1): it => block(above: 1.6em, below: 1em)[
    #set text(size: 16pt, weight: "bold")
    #it
  ]
  show heading.where(level: 2): it => block(above: 1.2em, below: 0.7em)[
    #set text(size: 12.5pt, weight: "bold")
    #it
  ]

  // ─── Cabecera del informe (sin página propia) ────────────────────────────
  block(above: 0pt, below: 1.6em)[
    #line(length: 100%, stroke: 1pt)
    #v(0.4cm)
    #text(size: 20pt, weight: "bold", titulo)
    #v(0.3cm)
    #grid(
      columns: (1fr, 1fr),
      [#text(weight: "bold")[Autor] #h(0.4em) #autor],
      align(right)[#departamento #h(0.4em) #if correo != "" [(#correo)]],
    )
    #v(0.3cm)
    #line(length: 100%, stroke: 0.5pt)
  ]

  if resumen != "" {
    block(fill: rgb("#f3f3f3"), inset: 10pt, radius: 3pt, width: 100%)[
      #text(weight: "bold")[Resumen ejecutivo] \
      #resumen
    ]
    v(0.8em)
  }

  cuerpo
}
