// Currículum de una página. Los datos de contacto los rellenó el asistente de
// DBV Typst Editor; el resto lo escribes tú.

#import "estilo.typ": cv, entrada

#show: cv.with(
  nombre: "{{autor}}",
  titular: "{{titulo}}",
  correo: "{{correo}}",
  telefono: "{{telefono}}",
  web: "{{web}}",
)

= Perfil

Dos o tres líneas que resuman quién eres profesionalmente y qué buscas. Es lo
único que mucha gente lee entero, así que merece la pena reescribirlo para cada
candidatura.

= Experiencia

#entrada(
  puesto: "Puesto más reciente",
  lugar: "Empresa u organización",
  fechas: "2023 — actualidad",
)[
  - Logro concreto, con una cifra si la tienes.
  - Responsabilidad principal.
]

#entrada(
  puesto: "Puesto anterior",
  lugar: "Empresa u organización",
  fechas: "2020 — 2023",
)[
  - Qué hiciste y con qué resultado.
]

= Formación

#entrada(
  puesto: "Titulación",
  lugar: "Universidad o centro",
  fechas: "2016 — 2020",
)[]

= Competencias

*Técnicas:* lista separada por comas. \
*Idiomas:* español (nativo), inglés (B2).
