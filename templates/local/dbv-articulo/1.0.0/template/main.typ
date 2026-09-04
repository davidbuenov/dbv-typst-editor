// Artículo académico. Los datos de abajo los rellenó el asistente de
// DBV Typst Editor; son texto normal y puedes cambiarlos cuando quieras.

#import "estilo.typ": articulo

#show: articulo.with(
  titulo: "{{titulo}}",
  autor: "{{autor}}",
  institucion: "{{institucion}}",
  correo: "{{correo}}",
  resumen: "{{resumen}}",
  palabras-clave: "{{palabrasClave}}",
)

= Introducción

Plantea el problema, sitúa el trabajo en la literatura y anticipa la
contribución. Las citas se escriben así @knuth1984.

= Método

Describe el procedimiento con detalle suficiente para que otra persona pueda
reproducirlo.

$ hat(theta) = arg max_theta sum_(i=1)^n log p(x_i bar theta) $

= Resultados

#figure(
  table(
    columns: 3,
    align: (left, right, right),
    table.header([Método], [Precisión], [F1]),
    [Base], [0,81], [0,79],
    [Propuesto], [0,93], [0,92],
  ),
  caption: [Resultados sobre el conjunto de prueba.],
) <tab-resultados>

Como muestra @tab-resultados, la propuesta mejora la línea base.

= Discusión

Interpreta los resultados y reconoce las limitaciones del estudio.

= Conclusiones

Cierra con la aportación principal y el trabajo futuro.

#bibliography("refs.bib", title: [Referencias], style: "ieee")
