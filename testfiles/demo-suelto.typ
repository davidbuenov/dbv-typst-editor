// =============================================================================
// DBV Typst Editor — Documento suelto de prueba
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Ábrelo con "Abrir documento .typ". Sirve para comprobar el caso de RF-02b:
// un `.typ` suelto se trata como un proyecto de un solo fichero, sin manifiesto
// y sin que la aplicación escriba nada en su carpeta.

#set page(paper: "a4", margin: 2.5cm, numbering: "1")
#set text(font: "Libertinus Serif", size: 11pt, lang: "es")
#set par(justify: true)
#set heading(numbering: "1.1")

= Documento suelto de prueba

Este fichero no pertenece a ningún proyecto: es un `.typ` por su cuenta. Si lo
ves aquí con el resaltado de sintaxis a la izquierda y la página compuesta a la
derecha, el camino más corto de la aplicación funciona.

== Qué probar con este fichero

+ *Escribir.* Añade una línea y espera un instante: la vista previa se rehace
  sola, sin guardar ni compilar a mano.
+ *Romper la sintaxis a propósito.* Escribe `#figure(` y déjalo sin cerrar. La
  página NO debe quedarse en blanco: se conserva la última vista buena y el
  error aparece abajo, en una banda.
+ *Arreglarlo.* Al borrar el error, la banda desaparece sola.
+ *Guardar* con Ctrl+S y comprobar que el aviso de "sin guardar" se va.
+ *Exportar PDF* y abrirlo fuera: debe coincidir con lo que ves.

== Elementos que ejercitan el compilador

Una fórmula, para ver la tipografía matemática:

$ integral_0^oo e^(-x^2) dif x = sqrt(pi) / 2 $

Una tabla:

#figure(
  table(
    columns: 3,
    align: (left, right, right),
    table.header([Fase], [Duración], [Estado]),
    [Análisis], [2 semanas], [Cerrada],
    [Construcción], [6 semanas], [Cerrada],
    [Pruebas], [3 semanas], [En curso],
  ),
  caption: [Una tabla con cabecera y alineaciones distintas por columna.],
)

Y un bloque de código, que en un documento técnico es tan habitual como la
bibliografía en uno académico:

```rust
fn main() {
    println!("Hola desde un bloque de código");
}
```

== Salto de página

Lo de abajo empieza en la página 2, para poder comprobar que la vista previa
pagina bien y que el desplazamiento no salta al recompilar.

#pagebreak()

= Segunda página

Si estás leyendo esto en la página 2 de la vista previa, la paginación y la
carga de páginas bajo demanda funcionan.

#lorem(80)
