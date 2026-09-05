// =============================================================================
// Plantilla de Tesis doctoral de DBV Typst Editor — definición de estilo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Este fichero viaja DENTRO del proyecto creado, no se importa como paquete:
// así el documento compila con `typst` a secas, sin depender de DBV Typst
// Editor ni de ningún `--package-path`. Puedes editarlo libremente.
//
// A diferencia de TFG/TFM, una tesis trae el aparato normativo completo:
// dedicatoria y agradecimientos (opcionales, en páginas propias), resumen en
// español y un abstract en inglés, y un apéndice numerado aparte de los
// capítulos. El `abstract` en inglés no es un campo del asistente (el
// formulario ya tiene siete campos; añadir un octavo de texto largo en el
// mismo paso empezaba a ser demasiado) — se deja como párrafo de ejemplo en el
// propio documento para que el doctorando lo traduzca cuando quiera.

#let tesis(
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
  set text(font: "Libertinus Serif", size: 12pt, lang: "es")
  set par(justify: true, leading: 0.75em, first-line-indent: 1.2em)
  set heading(numbering: "1.1")

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
    #text(size: 12pt, style: "italic")[Tesis doctoral]
    #v(1fr)
    #grid(
      columns: (1fr, 1fr),
      align: (left, right),
      [
        #text(weight: "bold")[Doctorando/a] \
        #autor
      ],
      [
        #text(weight: "bold")[Director/a] \
        #tutor
      ],
    )
    #v(1cm)
    #text(size: 11pt, curso)
    #v(1cm)
  ]

  // ─── Dedicatoria ──────────────────────────────────────────────────────────
  // Página propia, sin numerar ni contar para el índice: es tradición, no
  // contenido académico, así que no debe competir por espacio en el outline.
  page(numbering: none, header: none, footer: none)[
    #v(1fr)
    #set align(center)
    #set text(style: "italic", size: 12pt)
    A quien corresponda.

    Sustituye este párrafo por tu propia dedicatoria, o borra esta página
    entera si prefieres no incluirla.
    #v(2fr)
  ]

  // ─── Agradecimientos ──────────────────────────────────────────────────────
  page(numbering: none, header: none, footer: none)[
    #heading(level: 1, numbering: none, outlined: false)[Agradecimientos]
    Escribe aquí tus agradecimientos. Como la dedicatoria, esta página es
    opcional: bórrala si no la necesitas.
  ]

  // ─── Resumen y Abstract ───────────────────────────────────────────────────
  set page(numbering: "i", number-align: center)
  counter(page).update(1)

  if resumen != "" {
    heading(level: 1, numbering: none, outlined: false)[Resumen]
    par(first-line-indent: 0pt, resumen)
  }

  pagebreak(weak: true)
  heading(level: 1, numbering: none, outlined: false)[Abstract]
  set text(lang: "en")
  par(first-line-indent: 0pt)[
    Write the English abstract of your thesis here — a short version of the
    Spanish summary above, not a literal translation of every sentence.
  ]
  set text(lang: "es")

  outline(title: [Índice], indent: auto, depth: 3)

  // ─── Cuerpo ───────────────────────────────────────────────────────────────
  set page(numbering: "1", number-align: center)
  counter(page).update(1)
  cuerpo
}

/// Portada del apéndice: numeración propia ("A", "B"...) separada de los
/// capítulos, como pide cualquier normativa de tesis.
#let apendice(cuerpo) = {
  set heading(numbering: "A.1")
  counter(heading).update(0)
  cuerpo
}
