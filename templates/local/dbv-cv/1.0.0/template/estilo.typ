// =============================================================================
// Plantilla de CV de DBV Typst Editor — definición de estilo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Viaja dentro del proyecto creado: compila con `typst` a secas. Edítalo.

#let cv(nombre: "", titular: "", correo: "", telefono: "", web: "", cuerpo) = {
  set document(title: [CV — #nombre], author: nombre)
  set page(paper: "a4", margin: (top: 1.8cm, bottom: 1.8cm, x: 2cm))
  // Solo fuentes que vienen dentro del compilador Typst: asi el CV se imprime
  // igual en cualquier maquina y no aparecen avisos de fuente no encontrada.
  set text(font: "New Computer Modern", size: 10pt, lang: "es")
  set par(leading: 0.62em)

  // Regla bajo cada sección: separa sin recargar, que es lo que se le pide a
  // un CV de una página.
  show heading.where(level: 1): it => block(above: 1.3em, below: 0.6em)[
    #set text(size: 11pt, weight: "bold", tracking: 0.06em)
    #upper(it.body)
    #v(0.25em)
    #line(length: 100%, stroke: 0.5pt + luma(150))
  ]

  block[
    #text(size: 20pt, weight: "bold", nombre)
    #if titular != "" [
      \
      #text(size: 11pt, fill: luma(90), titular)
    ]
  ]

  v(0.4em)
  // Los datos de contacto vacíos no dejan separadores sueltos.
  let contacto = ((correo, telefono, web).filter(dato => dato != "")).join("  ·  ")
  if contacto != none [
    #text(size: 9.5pt, fill: luma(90), contacto)
  ]

  cuerpo
}

/// Una entrada de experiencia o formación: puesto/título a la izquierda,
/// fechas a la derecha, y debajo el detalle.
#let entrada(puesto: "", lugar: "", fechas: "", detalle) = {
  block(above: 0.9em, below: 0.2em)[
    #grid(
      columns: (1fr, auto),
      align: (left, right),
      [
        #text(weight: "bold", puesto)
        #if lugar != "" [ — #text(style: "italic", lugar)]
      ],
      text(size: 9pt, fill: luma(110), fechas),
    )
  ]
  detalle
}
