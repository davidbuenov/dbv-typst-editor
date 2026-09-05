= Análisis

El cuerpo del informe. Una tabla de datos, lista para sustituir:

#figure(
  table(
    columns: 3,
    align: (left, right, right),
    table.header([Indicador], [Valor], [Objetivo]),
    [Disponibilidad], [99,2 %], [99,5 %],
    [Tiempo de respuesta], [180 ms], [150 ms],
  ),
  caption: [Indicadores clave del periodo analizado.],
)

Y una figura con pie:

#figure(
  rect(width: 60%, height: 3cm, stroke: 0.5pt),
  caption: [Sustituye este rectángulo por `image("../images/diagrama.png")`.],
)
