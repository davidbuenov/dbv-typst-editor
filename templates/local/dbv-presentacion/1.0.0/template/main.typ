// Documento principal de la Presentación.
// Los datos de abajo los rellenó el asistente de DBV Typst Editor; puedes
// cambiarlos aquí cuando quieras, son texto normal.

#import "estilo.typ": diapositiva, diapositivas, portada

#show: diapositivas.with(titulo: "{{titulo}}", autor: "{{autor}}")

#portada(
  "{{titulo}}",
  subtitulo: "{{subtitulo}}",
  autor: "{{autor}}",
  institucion: "{{institucion}}",
  fecha: "{{curso}}",
)

#include "slides/01-indice.typ"
#include "slides/02-contenido.typ"
#include "slides/03-cierre.typ"
