// =============================================================================
// DBV Typst Editor CV template — style definition
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Travels inside the project you created: it compiles with plain `typst`. Edit it.

#let cv(name: "", headline: "", email: "", phone: "", web: "", body) = {
  set document(title: [CV — #name], author: name)
  set page(paper: "a4", margin: (top: 1.8cm, bottom: 1.8cm, x: 2cm))
  // Only fonts bundled with the Typst compiler: the CV prints the same on any
  // machine and no "font not found" warnings appear.
  set text(font: "New Computer Modern", size: 10pt, lang: "en")
  set par(leading: 0.62em)

  // A rule under each section: it separates without clutter, which is what a
  // one-page CV needs.
  show heading.where(level: 1): it => block(above: 1.3em, below: 0.6em)[
    #set text(size: 11pt, weight: "bold", tracking: 0.06em)
    #upper(it.body)
    #v(0.25em)
    #line(length: 100%, stroke: 0.5pt + luma(150))
  ]

  block[
    #text(size: 20pt, weight: "bold", name)
    #if headline != "" [
      \
      #text(size: 11pt, fill: luma(90), headline)
    ]
  ]

  v(0.4em)
  // Empty contact details leave no stray separators.
  let contact = ((email, phone, web).filter(item => item != "")).join("  ·  ")
  if contact != none [
    #text(size: 9.5pt, fill: luma(90), contact)
  ]

  body
}

/// An experience or education entry: role/degree on the left, dates on the
/// right, and the detail below.
#let entry(role: "", place: "", dates: "", detail) = {
  block(above: 0.9em, below: 0.2em)[
    #grid(
      columns: (1fr, auto),
      align: (left, right),
      [
        #text(weight: "bold", role)
        #if place != "" [ — #text(style: "italic", place)]
      ],
      text(size: 9pt, fill: luma(110), dates),
    )
  ]
  detail
}
