// =============================================================================
// DBV Typst Editor — Esquema del documento desde el motor en proceso (RF-89)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Hasta la 0.12.0 el esquema lo calculaba el sidecar con `typst eval` sobre la
// réplica del proyecto (`typst_engine/outline.rs`): una segunda compilación y,
// sobre todo, una dependencia del sidecar que en algunos Mac falla y dejaba el
// panel vacío como si el documento no tuviera encabezados. El documento que ya
// ha compuesto el motor en proceso lo sabe todo: su introspector da cada
// encabezado con su nivel y su posición en página.
//
// Solo se listan los encabezados que irían en el índice (`outlined`), igual que
// `#outline()` (decisión del usuario, RF-89.3). El respaldo por CLI aplica el
// mismo filtro, para que el esquema no cambie según qué motor compiló.

use typst::foundations::NativeElement;
use typst::introspection::Introspector;
use typst::model::{HeadingElem, Outlinable};
use typst_layout::PagedDocument;

use crate::typst_engine::outline::OutlineEntry;

/// Encabezados de `document` que irían en su índice, en orden de aparición.
///
/// Un encabezado sin posición en página (no debería darse en un documento
/// paginado) se omite: el panel no podría llevar a ninguna parte.
pub fn headings(document: &PagedDocument) -> Vec<OutlineEntry> {
    let introspector = document.introspector();
    introspector
        .query(&HeadingElem::ELEM.select())
        .iter()
        .filter_map(|content| {
            let heading = content.to_packed::<HeadingElem>()?;
            if !heading.outlined() {
                return None;
            }
            let position = introspector.position(content.location()?)?;
            Some(OutlineEntry {
                level: u32::try_from(heading.level().get()).unwrap_or(u32::MAX),
                text: heading.body.plain_text().to_string(),
                page: u32::try_from(position.page.get()).unwrap_or(u32::MAX),
                y_pt: position.point.y.to_pt(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::world::EngineWorld;
    use std::fs;

    fn compile(files: &[(&str, &str)]) -> (tempfile::TempDir, PagedDocument) {
        let dir = tempfile::tempdir().unwrap();
        for (name, text) in files {
            let path = dir.path().join(name);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, text).unwrap();
        }
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();
        world.begin_compile();
        let document = typst::compile::<PagedDocument>(&*world).output.expect("debe compilar");
        (dir, document)
    }

    fn summary(entries: &[OutlineEntry]) -> Vec<(u32, &str, u32)> {
        entries.iter().map(|entry| (entry.level, entry.text.as_str(), entry.page)).collect()
    }

    #[test]
    fn lista_niveles_texto_y_pagina_en_orden() {
        let main = "= Uno\nTexto.\n== Uno punto uno\n#pagebreak()\n= Dos\n=== Hondo\n";
        let (_dir, document) = compile(&[("main.typ", main)]);
        let entries = headings(&document);
        assert_eq!(
            summary(&entries),
            vec![(1, "Uno", 1), (2, "Uno punto uno", 1), (1, "Dos", 2), (3, "Hondo", 2)]
        );
        // Posición real en la página: el segundo encabezado está más abajo que el primero.
        assert!(entries[0].y_pt > 0.0 && entries[1].y_pt > entries[0].y_pt, "{entries:?}");
    }

    #[test]
    fn el_texto_es_plano_aunque_el_encabezado_mezcle_estilos() {
        let (_dir, document) = compile(&[("main.typ", "= Resultados *destacados* y _otros_\n")]);
        assert_eq!(headings(&document)[0].text, "Resultados destacados y otros");
    }

    #[test]
    fn omite_los_encabezados_que_no_irian_en_el_indice() {
        let main = "#outline()\n= Visible\n#heading(outlined: false)[Oculto]\n#set heading(outlined: false)\n= También oculto\n";
        let (_dir, document) = compile(&[("main.typ", main)]);
        // Tampoco sale el título del propio `#outline()`, que es `outlined: false`.
        assert_eq!(summary(&headings(&document)), vec![(1, "Visible", 1)]);
    }

    #[test]
    fn el_nivel_respeta_offset_y_depth() {
        let main = "#set heading(offset: 1)\n= Con offset\n#heading(depth: 2)[Profundo]\n";
        let (_dir, document) = compile(&[("main.typ", main)]);
        assert_eq!(summary(&headings(&document)), vec![(2, "Con offset", 1), (3, "Profundo", 1)]);
    }

    #[test]
    fn incluye_los_encabezados_de_los_ficheros_incluidos() {
        let main = "= Portada\n#pagebreak()\n#include \"cap/uno.typ\"\n";
        let uno = "= Capítulo uno\n== Sección\n";
        let (_dir, document) = compile(&[("main.typ", main), ("cap/uno.typ", uno)]);
        assert_eq!(
            summary(&headings(&document)),
            vec![(1, "Portada", 1), (1, "Capítulo uno", 2), (2, "Sección", 2)]
        );
    }

    #[test]
    fn un_documento_sin_encabezados_da_una_lista_vacia() {
        let (_dir, document) = compile(&[("main.typ", "Solo texto.")]);
        assert!(headings(&document).is_empty());
    }
}
