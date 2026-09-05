= Recursos del proyecto <sec-recursos>

Este capítulo usa una imagen de la carpeta `images/`. Es la comprobación de que
las rutas relativas se resuelven bien también durante la vista previa en vivo,
incluso con cambios sin guardar.

#figure(
  image("../images/grafico.png", width: 45%),
  caption: [Imagen cargada desde `images/`, referenciada desde un capítulo.],
) <fig-grafico>

La figura @fig-grafico y la sección @sec-recursos se referencian solas.

== Qué probar aquí

+ *Añadir un fichero a la carpeta desde fuera* (por ejemplo, copiar otra imagen
  en `images/`): el árbol de la izquierda debe refrescarse solo.
+ *Editar `main.typ` desde otro editor* mientras lo tienes abierto aquí: si no
  tienes cambios locales, se recarga solo; si los tienes, debe preguntarte.

#pagebreak()

= Documento largo

Esta página existe para que el documento tenga varias páginas y se pueda
comprobar el desplazamiento y el zoom de la vista previa.

#lorem(120)

#lorem(120)
