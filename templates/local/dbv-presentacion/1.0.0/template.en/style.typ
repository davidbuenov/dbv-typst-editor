// =============================================================================
// DBV Typst Editor presentation template — style definition
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// This file travels INSIDE the project you created, it is not imported as a
// package: the document compiles with plain `typst`, without DBV Typst Editor
// or any `--package-path`.
//
// No `polylux` or any other slides package: Typst ships the
// "presentation-16-9" page size, and that is enough for a minimal slide
// system. If you later want step-by-step reveals, transitions or speaker
// notes, that is when a Typst Universe package pays off.

#let slides(title: "", author: "", body) = {
  set document(title: title, author: author)
  set page(paper: "presentation-16-9", margin: 1.8cm)
  set text(font: "Libertinus Serif", size: 20pt, lang: "en")
  body
}

/// Title slide — the first of the document, without calling `slide()` because
/// its title does not sit in the same place as on the others.
#let title-slide(title, subtitle: "", author: "", institution: "", date: "") = {
  set align(horizon + center)
  block(text(size: 34pt, weight: "bold", title))
  if subtitle != "" {
    v(0.5cm)
    block(text(size: 20pt, style: "italic", subtitle))
  }
  v(1.5cm)
  set text(size: 16pt)
  block[
    #author
    #if institution != "" [ · #institution ]
    #if date != "" [ · #date ]
  ]
}

/// Regular content slide: page break + title at the top + body.
#let slide(title, body) = {
  pagebreak(weak: true)
  block(width: 100%, text(size: 26pt, weight: "bold", title))
  v(0.6cm)
  set text(size: 20pt)
  body
}
