// =============================================================================
// Plantilla TFG de DBV Typst Editor — definición de estilo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Este fichero viaja DENTRO del proyecto creado, no se importa como paquete:
// así el documento compila con `typst` a secas, sin depender de DBV Typst
// Editor ni de ningún `--package-path`. Puedes editarlo libremente.

#let tfg(
  titulo: "",
  autor: "",
  tutor: "",
  institucion: "",
  titulacion: "",
  curso: "",
  resumen: "",
  cuerpo,
) = {
  set document(title: titulo, author: autor)
  set page(paper: "a4", margin: (top: 3cm, bottom: 3cm, x: 3cm))
  // Solo fuentes que vienen dentro del compilador Typst: el documento se ve
  // exactamente igual en cualquier maquina, sin conexion y sin instalar nada.
  set text(font: "Libertinus Serif", size: 12pt, lang: "es")
  set par(justify: true, leading: 0.75em, first-line-indent: 1.2em)
  set heading(numbering: "1.1")

  // Los títulos de capítulo empiezan en página nueva, como pide cualquier
  // normativa de TFG; los de nivel inferior no rompen el flujo de lectura.
  show heading.where(level: 1): it => {
    pagebreak(weak: true)
    block(above: 0pt, below: 1.4em)[
      #set text(size: 20pt, weight: "bold")
      #it
    ]
  }
  show heading.where(level: 2): it => block(above: 1.6em, below: 0.9em)[
    #set text(size: 14pt, weight: "bold")
    #it
  ]

  // ─── Portada ──────────────────────────────────────────────────────────────
  page(numbering: none, header: none, footer: none)[
    #set align(center)
    #v(2cm)
    #text(size: 14pt, weight: "bold", upper(institucion))
    #v(0.4cm)
    #text(size: 12pt, titulacion)
    #v(3.5cm)
    #line(length: 60%, stroke: 0.6pt)
    #v(0.8cm)
    #text(size: 22pt, weight: "bold", titulo)
    #v(0.8cm)
    #line(length: 60%, stroke: 0.6pt)
    #v(1.2cm)
    #text(size: 12pt, style: "italic")[Trabajo de Fin de Grado]
    #v(1fr)
    #grid(
      columns: (1fr, 1fr),
      align: (left, right),
      [
        #text(weight: "bold")[Autor] \
        #autor
      ],
      [
        #text(weight: "bold")[Tutor] \
        #tutor
      ],
    )
    #v(1cm)
    #text(size: 11pt, curso)
    #v(1cm)
  ]

  // ─── Resumen e índice ─────────────────────────────────────────────────────
  set page(numbering: "i", number-align: center)
  counter(page).update(1)

  if resumen != "" {
    heading(level: 1, numbering: none, outlined: false)[Resumen]
    par(first-line-indent: 0pt, resumen)
  }

  outline(title: [Índice], indent: auto, depth: 3)

  // ─── Cuerpo ───────────────────────────────────────────────────────────────
  set page(numbering: "1", number-align: center)
  counter(page).update(1)
  cuerpo
}
