// Estilo del proyecto de prueba. Importado por ruta relativa desde `main.typ`,
// que es justo lo que hay que verificar: si la vista previa resolviera las rutas
// contra otro directorio, este `#import` fallaría.

#let documento(titulo: "", autor: "", cuerpo) = {
  set document(title: titulo, author: autor)
  set page(paper: "a4", margin: 2.5cm, numbering: "1")
  set text(font: "Libertinus Serif", size: 11pt, lang: "es")
  set par(justify: true)
  set heading(numbering: "1.1")

  align(center)[
    #text(size: 20pt, weight: "bold", titulo)
    #v(0.4em)
    #text(size: 11pt, style: "italic", autor)
  ]
  v(1.5em)

  outline(title: [Índice], depth: 2)
  v(1em)

  cuerpo
}
