= Resultados

Presenta lo obtenido, sin interpretarlo todavía — la discusión va en el
capítulo siguiente o en la sección final de conclusiones.

Una figura con pie y etiqueta, para poder referenciarla luego con @fig-ejemplo:

#figure(
  rect(width: 60%, height: 3cm, stroke: 0.5pt),
  caption: [Sustituye este rectángulo por `image("../images/mi-figura.png")`.],
) <fig-ejemplo>

Y una tabla:

#figure(
  table(
    columns: 3,
    align: (left, right, right),
    table.header([Método], [Precisión], [Tiempo]),
    [Base], [0,81], [12 s],
    [Propuesto], [0,93], [15 s],
  ),
  caption: [Comparativa de resultados.],
)
