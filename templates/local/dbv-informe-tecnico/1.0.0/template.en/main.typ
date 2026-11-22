// Main document of the Technical report.
// The details below were filled in by the DBV Typst Editor wizard; you can
// change them here whenever you like, they are plain text.

#import "style.typ": report

#show: report.with(
  title: "{{titulo}}",
  author: "{{autor}}",
  department: "{{departamento}}",
  email: "{{correo}}",
  summary: "{{resumen}}",
)

#include "sections/01-introduction.typ"
#include "sections/02-analysis.typ"
#include "sections/03-conclusions-and-recommendations.typ"
