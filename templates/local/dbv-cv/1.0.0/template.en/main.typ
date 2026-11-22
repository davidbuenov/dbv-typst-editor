// One-page résumé. The contact details were filled in by the DBV Typst Editor
// wizard; you write the rest.

#import "style.typ": cv, entry

#show: cv.with(
  name: "{{autor}}",
  headline: "{{titulo}}",
  email: "{{correo}}",
  phone: "{{telefono}}",
  web: "{{web}}",
)

= Profile

Two or three lines summing up who you are professionally and what you are
looking for. It is the only part many people read in full, so it is worth
rewriting it for each application.

= Experience

#entry(
  role: "Most recent position",
  place: "Company or organisation",
  dates: "2023 — present",
)[
  - A concrete achievement, with a figure if you have one.
  - Main responsibility.
]

#entry(
  role: "Previous position",
  place: "Company or organisation",
  dates: "2020 — 2023",
)[
  - What you did and with what result.
]

= Education

#entry(
  role: "Degree",
  place: "University or school",
  dates: "2016 — 2020",
)[]

= Skills

*Technical:* comma-separated list. \
*Languages:* English (native), Spanish (B2).
