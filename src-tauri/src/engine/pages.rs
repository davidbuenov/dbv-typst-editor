// =============================================================================
// DBV Typst Editor — Páginas del documento en proceso (RF-56.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El CLI exporta TODAS las páginas a disco en cada compilación (86 MB en un libro
// de 224 páginas) y el frontend solo pinta las visibles. Aquí el SVG se genera
// SOLO de la página que se pide, del mismo documento compuesto del que sale el
// mapa al fuente: medido en el Spike S-3, 2-5 ms por página frente a exportar las
// 224.
//
// La geometría de todas las páginas sí se devuelve siempre (es lo que permite
// reservar el hueco de cada una y que la barra de desplazamiento no salte), y es
// barata: solo el tamaño de cada marco.

use serde::Serialize;
use typst_layout::PagedDocument;
use typst_svg::SvgOptions;

/// Tamaño de una página, en puntos.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageSize {
    pub width_pt: f64,
    pub height_pt: f64,
}

/// Tamaño de TODAS las páginas, en orden.
pub fn geometry(document: &PagedDocument) -> Vec<PageSize> {
    document
        .pages()
        .iter()
        .map(|page| {
            let size = page.frame.size();
            PageSize { width_pt: size.x.to_pt(), height_pt: size.y.to_pt() }
        })
        .collect()
}

/// SVG de la página `index` (0-indexada), o `None` si no existe.
pub fn svg(document: &PagedDocument, index: usize) -> Option<String> {
    let page = document.pages().get(index)?;
    Some(typst_svg::svg(page, &SvgOptions::default()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::worker::{Outcome, Request, Worker};
    use std::sync::{mpsc::channel, Arc, Mutex};
    use std::time::Duration;

    /// Compila `text` con el motor real y devuelve el documento.
    fn document(text: &str) -> Arc<PagedDocument> {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("main.typ"), text).unwrap();
        let world = crate::engine::world::EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();
        let (tx, rx) = channel();
        let tx = Mutex::new(tx);
        let worker = Worker::spawn(world, Arc::new(move |result| {
            let _ = tx.lock().unwrap().send(result);
        }));
        worker.submit(Request { generation: 1, overrides: Vec::new() });
        match rx.recv_timeout(Duration::from_secs(60)).unwrap().outcome {
            Outcome::Compiled { document, .. } => document,
            _ => panic!("debía compilar"),
        }
    }

    #[test]
    fn la_geometria_da_el_tamano_de_todas_las_paginas() {
        let document = document("#set page(width: 200pt, height: 100pt)\nUna.\n#pagebreak()\nDos.");

        let sizes = geometry(&document);

        assert_eq!(sizes.len(), 2);
        assert_eq!(sizes[0], PageSize { width_pt: 200.0, height_pt: 100.0 });
    }

    #[test]
    fn el_svg_de_una_pagina_es_un_documento_svg_con_sus_medidas() {
        let document = document("#set page(width: 200pt, height: 100pt)\nHola mundo.");

        let svg = svg(&document, 0).expect("la página 0 existe");

        assert!(svg.starts_with("<svg"), "{}", &svg[..svg.len().min(80)]);
        assert!(svg.contains("viewBox=\"0 0 200 100\""), "{}", &svg[..svg.len().min(200)]);
    }

    #[test]
    fn pedir_una_pagina_que_no_existe_da_none() {
        let document = document("Una sola.");

        assert!(svg(&document, 5).is_none());
    }

    #[test]
    fn solo_se_genera_el_svg_de_la_pagina_pedida() {
        let document = document("Uno.\n#pagebreak()\nDos.\n#pagebreak()\nTres.");

        let (first, last) = (svg(&document, 0).unwrap(), svg(&document, 2).unwrap());

        // Cada página es su propio documento SVG, no el libro entero.
        assert_ne!(first, last);
        assert_eq!(first.matches("<svg").count(), 1);
    }
}
