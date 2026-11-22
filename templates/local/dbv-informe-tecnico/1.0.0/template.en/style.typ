// =============================================================================
// DBV Typst Editor technical report template — style definition
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// This file travels INSIDE the project you created, it is not imported as a
// package: the document compiles with plain `typst`, without DBV Typst Editor
// or any `--package-path`. You can edit it freely.
//
// Deliberately lighter than a thesis: no full-page institutional cover, no
// table of contents on its own page and no roman-numbered front matter — a
// technical report is read in one go, not bound.

#let report(
  title: "",
  author: "",
  department: "",
  email: "",
  summary: "",
  body,
) = {
  set document(title: title, author: author)
  set page(
    paper: "a4",
    margin: (top: 2.5cm, bottom: 2.5cm, x: 2.5cm),
    header: context {
      if counter(page).get().first() > 1 [
        #set text(size: 9pt, fill: rgb("#666666"))
        #title
        #h(1fr)
        #department
      ]
    },
  )
  set text(font: "Libertinus Serif", size: 11pt, lang: "en")
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

  // ─── Report header (no page of its own) ──────────────────────────────────
  block(above: 0pt, below: 1.6em)[
    #line(length: 100%, stroke: 1pt)
    #v(0.4cm)
    #text(size: 20pt, weight: "bold", title)
    #v(0.3cm)
    #grid(
      columns: (1fr, 1fr),
      [#text(weight: "bold")[Author] #h(0.4em) #author],
      align(right)[#department #h(0.4em) #if email != "" [(#email)]],
    )
    #v(0.3cm)
    #line(length: 100%, stroke: 0.5pt)
  ]

  if summary != "" {
    block(fill: rgb("#f3f3f3"), inset: 10pt, radius: 3pt, width: 100%)[
      #text(weight: "bold")[Executive summary] \
      #summary
    ]
    v(0.8em)
  }

  body
}
