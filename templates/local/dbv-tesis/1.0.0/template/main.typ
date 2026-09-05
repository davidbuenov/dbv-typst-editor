// Documento principal de la Tesis doctoral.
// Los datos de abajo los rellenó el asistente de DBV Typst Editor; puedes
// cambiarlos aquí cuando quieras, son texto normal.

#import "estilo.typ": apendice, tesis

#show: tesis.with(
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
#include "chapters/02-marco-teorico.typ"
#include "chapters/03-metodologia.typ"
#include "chapters/04-resultados.typ"
#include "chapters/05-conclusiones.typ"

#bibliography("refs.bib", title: [Bibliografía], style: "ieee")

// El apéndice lleva numeración propia (A, B...), separada de los capítulos.
#show: apendice
#include "appendix/a-material-adicional.typ"
