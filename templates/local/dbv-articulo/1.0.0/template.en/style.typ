// =============================================================================
// DBV Typst Editor academic paper template — style definition
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Travels inside the project you created: the document compiles with plain
// `typst`, without DBV Typst Editor. Edit it freely.

#let paper(
  title: "",
  author: "",
  affiliation: "",
  email: "",
  abstract: "",
  keywords: "",
  body,
) = {
  set document(title: title, author: author)
  set page(paper: "a4", margin: 2.2cm, numbering: "1", number-align: center)
  // Only fonts bundled with the Typst compiler.
  set text(font: "Libertinus Serif", size: 10pt, lang: "en")
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

  // Single-column header: title and authorship span the full width, and only
  // the body is split into two columns, as is usual in papers.
  align(center)[
    #block(width: 100%)[
      #text(size: 17pt, weight: "bold", title)
      #v(0.7em)
      #text(size: 11pt, author)
      #if affiliation != [] and affiliation != "" [
        \
        #text(size: 9.5pt, style: "italic", affiliation)
      ]
      #if email != [] and email != "" [
        \
        #text(size: 9pt, raw(email))
      ]
    ]
  ]

  v(1em)

  block(width: 100%, inset: (x: 1.6cm))[
    #set par(justify: true)
    #text(weight: "bold", size: 9pt)[Abstract. ]
    #text(size: 9pt, abstract)
    #if keywords != "" [
      #v(0.5em)
      #text(weight: "bold", size: 9pt)[Keywords: ]
      #text(size: 9pt, style: "italic", keywords)
    ]
  ]

  v(1.2em)

  columns(2, gutter: 1.2em, body)
}
