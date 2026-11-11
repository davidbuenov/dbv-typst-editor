// =============================================================================
// DBV Typst Editor — Plantilla editorial compartida del Manual de Usuario
// Copyright (c) 2026 David Bueno Vallejo · Licencia MIT
// Compilar desde la raíz del repositorio con:
//   typst compile --root docs docs/manual/manual-es.typ docs/manual/manual-es.pdf
//   typst compile --root docs docs/manual/manual-en.typ docs/manual/manual-en.pdf
// =============================================================================

#let accent = rgb("#1d4ed8")
#let accent-soft = rgb("#eff6ff")
#let accent-border = rgb("#93c5fd")
#let ink = rgb("#0f172a")
#let muted = rgb("#475569")
#let line-gray = rgb("#cbd5e1")
#let card-bg = rgb("#f8fafc")
#let tip-bg = rgb("#ecfdf5")
#let tip-border = rgb("#34d399")
#let warn-bg = rgb("#fffbeb")
#let warn-border = rgb("#f59e0b")

/// Tecla o atajo visual en línea.
#let kbd(combo) = box(
  fill: card-bg,
  stroke: 0.6pt + line-gray,
  radius: 3pt,
  inset: (x: 4pt, y: 1.5pt),
  baseline: 15%,
  text(font: ("Cascadia Mono", "DejaVu Sans Mono", "Consolas"), size: 8.5pt, weight: "medium", fill: ink, combo),
)

/// Caja destacada (note | tip | warn).
#let callout(kind: "note", title: none, body) = {
  let (bg, brd, fg) = if kind == "tip" {
    (tip-bg, tip-border, rgb("#065f46"))
  } else if kind == "warn" {
    (warn-bg, warn-border, rgb("#92400e"))
  } else {
    (accent-soft, accent-border, rgb("#1e3a8a"))
  }
  block(
    width: 100%,
    breakable: true,
    fill: bg,
    stroke: (left: 3pt + brd, rest: 0.5pt + line-gray),
    radius: (right: 4pt),
    inset: (x: 11pt, y: 9pt),
    spacing: 10pt,
  )[
    #if title != none [
      #text(weight: "bold", size: 9.5pt, fill: fg)[#title]
      #v(3pt)
    ]
    #set text(size: 9.5pt, fill: ink)
    #body
  ]
}

/// Captura real de la aplicación con marco discreto.
#let shot(filename, caption: none, width: 92%) = figure(
  box(
    stroke: 0.6pt + line-gray,
    radius: 5pt,
    clip: true,
    fill: white,
    image("../screenshots/" + filename, width: width),
  ),
  caption: caption,
)

/// Tabla homogénea de dos o tres columnas.
#let info-table(columns: (auto, 1fr), headers: (), rows: ()) = {
  set text(size: 9pt)
  table(
    columns: columns,
    inset: (x: 8pt, y: 6pt),
    align: left + horizon,
    stroke: (x, y) => (
      bottom: 0.5pt + line-gray,
      top: if y == 0 { 1pt + accent } else { none },
    ),
    fill: (x, y) => if y == 0 { accent-soft } else if calc.odd(y) { white } else { card-bg },
    table.header(..headers.map(h => text(weight: "bold", fill: ink, h))),
    ..rows.flatten(),
  )
}

/// Estilo principal del documento manual.
#let manual-doc(
  lang: "es",
  title: "DBV Typst Editor",
  subtitle: "",
  version: "v0.15.0",
  badge-label: "Manual de Usuario",
  author-label: "Autor",
  license-label: "Licencia",
  repo-label: "Repositorio",
  toc-title: "Contenido",
  page-word: "Página",
  of-word: "de",
  date-text: "2026",
  body,
) = {
  set document(
    title: title + " — " + badge-label,
    author: "David Bueno Vallejo",
  )

  set text(
    font: ("Inter", "Segoe UI", "Liberation Sans"),
    size: 10pt,
    fill: ink,
    lang: lang,
  )

  show raw: set text(
    font: ("Cascadia Mono", "DejaVu Sans Mono", "Consolas"),
    size: 8.8pt,
  )

  show raw.where(block: true): it => block(
    width: 100%,
    fill: card-bg,
    stroke: 0.5pt + line-gray,
    radius: 4pt,
    inset: 9pt,
    it,
  )

  show link: set text(fill: accent)

  set par(
    justify: true,
    leading: 0.62em,
    spacing: 0.9em,
  )

  set heading(numbering: "1.1.")
  show heading.where(level: 1): it => {
    pagebreak(weak: true)
    v(4pt)
    block(below: 12pt)[
      #text(size: 9pt, weight: "semibold", fill: accent, tracking: 0.04em)[
        #if it.numbering != none { counter(heading).display() }
      ]
      #linebreak()
      #text(size: 17pt, weight: "bold", fill: ink, it.body)
      #v(4pt)
      #line(length: 100%, stroke: 1.2pt + accent)
    ]
  }

  show heading.where(level: 2): it => block(above: 14pt, below: 6pt)[
    #text(size: 12pt, weight: "bold", fill: rgb("#1e293b"))[
      #if it.numbering != none { counter(heading).display() + " " }
      #it.body
    ]
  ]

  show heading.where(level: 3): it => block(above: 10pt, below: 4pt)[
    #text(size: 10.5pt, weight: "semibold", fill: accent, it.body)
  ]

  // ── Portada ────────────────────────────────────────────────────────────────
  page(
    paper: "a4",
    margin: (x: 2.2cm, y: 2.2cm),
    header: none,
    footer: none,
  )[
    #v(1.2cm)
    #box(
      fill: accent-soft,
      stroke: 0.8pt + accent-border,
      radius: 14pt,
      inset: (x: 11pt, y: 5pt),
    )[
      #text(size: 9pt, weight: "bold", fill: accent)[#badge-label · #version]
    ]
    #v(0.8cm)
    #text(size: 30pt, weight: "bold", fill: ink, tracking: -0.02em)[#title]
    #v(0.35cm)
    #text(size: 13pt, fill: muted, weight: "regular")[#subtitle]
    #v(0.8cm)
    #line(length: 4cm, stroke: 2.5pt + accent)
    #v(1cm)

    #box(
      stroke: 0.8pt + line-gray,
      radius: 6pt,
      clip: true,
      image("../screenshots/01-editor-live-preview.png", width: 100%),
    )

    #v(1fr)
    #block(
      width: 100%,
      fill: card-bg,
      stroke: 0.6pt + line-gray,
      radius: 6pt,
      inset: 12pt,
    )[
      #grid(
        columns: (1fr, 1fr),
        row-gutter: 6pt,
        [*#author-label:* David Bueno Vallejo], [*#license-label:* MIT License],
        [*Typst:* 0.15.1 (embebido / bundled)], [*#date-text*],
      )
      #v(4pt)
      *#repo-label:* #link("https://github.com/davidbuenov/dbv-typst-editor")[github.com/davidbuenov/dbv-typst-editor] · #link("https://davidbuenov.github.io/dbv-typst-editor/")[Web]
    ]
  ]

  // ── Índice ─────────────────────────────────────────────────────────────────
  page(
    paper: "a4",
    margin: (x: 2.1cm, top: 2.2cm, bottom: 2.1cm),
    header: none,
    footer: none,
  )[
    #text(size: 18pt, weight: "bold", fill: ink)[#toc-title]
    #v(6pt)
    #line(length: 100%, stroke: 1pt + accent)
    #v(10pt)
    #outline(title: none, depth: 2, indent: auto)
  ]

  // ── Cuerpo paginado ────────────────────────────────────────────────────────
  set page(
    paper: "a4",
    margin: (x: 2.1cm, top: 2.3cm, bottom: 2.1cm),
    header: context [
      #set text(size: 8.5pt, fill: muted)
      #grid(
        columns: (1fr, auto),
        [#title — #badge-label (#version)],
        [#link("https://davidbuenov.github.io/dbv-typst-editor/")[davidbuenov.github.io/dbv-typst-editor]],
      )
      #v(-4pt)
      #line(length: 100%, stroke: 0.4pt + line-gray)
    ],
    footer: context [
      #line(length: 100%, stroke: 0.4pt + line-gray)
      #v(-2pt)
      #set text(size: 8.5pt, fill: muted)
      #grid(
        columns: (1fr, auto),
        [DBV Typst Editor · MIT License],
        [#page-word #counter(page).display() #of-word #counter(page).final().first()],
      )
    ],
  )

  counter(page).update(1)
  body
}
