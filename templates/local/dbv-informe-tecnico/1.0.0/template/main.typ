// Documento principal del Informe técnico.
// Los datos de abajo los rellenó el asistente de DBV Typst Editor; puedes
// cambiarlos aquí cuando quieras, son texto normal.

#import "estilo.typ": informe

#show: informe.with(
  titulo: "{{titulo}}",
  autor: "{{autor}}",
  departamento: "{{departamento}}",
  correo: "{{correo}}",
  resumen: "{{resumen}}",
)

#include "sections/01-introduccion.typ"
#include "sections/02-analisis.typ"
#include "sections/03-conclusiones-y-recomendaciones.typ"
