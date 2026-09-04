// Documento principal del Trabajo de Fin de Grado.
// Los datos de abajo los rellenó el asistente de DBV Typst Editor; puedes
// cambiarlos aquí cuando quieras, son texto normal.

#import "estilo.typ": tfg

#show: tfg.with(
  titulo: "{{titulo}}",
  autor: "{{autor}}",
  tutor: "{{tutor}}",
  institucion: "{{institucion}}",
  titulacion: "{{titulacion}}",
  curso: "{{curso}}",
  resumen: "{{resumen}}",
)

// Cada capítulo vive en su propio fichero: en un documento largo eso es la
// diferencia entre poder trabajar y no poder. Añade los que necesites.
#include "chapters/01-introduccion.typ"
#include "chapters/02-desarrollo.typ"
#include "chapters/03-conclusiones.typ"

#bibliography("refs.bib", title: [Bibliografía], style: "ieee")
