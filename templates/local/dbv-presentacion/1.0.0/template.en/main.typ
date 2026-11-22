// Main document of the Presentation.
// The details below were filled in by the DBV Typst Editor wizard; you can
// change them here whenever you like, they are plain text.

#import "style.typ": slide, slides, title-slide

#show: slides.with(title: "{{titulo}}", author: "{{autor}}")

#title-slide(
  "{{titulo}}",
  subtitle: "{{subtitulo}}",
  author: "{{autor}}",
  institution: "{{institucion}}",
  date: "{{curso}}",
)

#include "slides/01-outline.typ"
#include "slides/02-content.typ"
#include "slides/03-closing.typ"
