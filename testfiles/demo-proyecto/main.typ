// =============================================================================
// DBV Typst Editor — Proyecto de prueba (multi-fichero)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Ábrelo con "Abrir carpeta de proyecto" apuntando a `testfiles/demo-proyecto`.
// NO trae `settings/dbv-project.toml` a propósito: así se comporta igual que un
// repositorio clonado o un proyecto Typst hecho a mano (RF-02b), y la etiqueta
// de la cabecera debe decir "proyecto externo".

#import "estilo.typ": documento

#show: documento.with(
  titulo: "Proyecto de prueba de DBV Typst Editor",
  autor: "Equipo de pruebas",
)

#include "chapters/01-estructura.typ"
#include "chapters/02-recursos.typ"

#bibliography("refs.bib", title: [Bibliografía], style: "ieee")
