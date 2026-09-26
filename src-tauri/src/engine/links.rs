// =============================================================================
// DBV Typst Editor — Enlaces de la vista previa (RF-72)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La vista previa es SVG, y `typst-svg` 0.15.1 solo pone `href` a los enlaces
// externos; los internos (índice, `@ref`, citas, notas al pie) salen sin
// destino. Pero el documento maquetado sí lo sabe todo: cada enlace es un
// `FrameItem::Link(destino, tamaño)` y el introspector resuelve un destino
// interno a su página y posición. Aquí se sacan los enlaces de UNA página
// (se piden cuando la página se pinta, igual que su SVG) con su rectángulo ya
// transformado, y el frontend hace la prueba de puntería (sin capa DOM encima
// del SVG, para no romper la selección ni el doble clic de RF-57).

use serde::Serialize;
use typst::layout::{Abs, Frame, FrameItem, Transform};
use typst::model::Destination;
use typst_layout::PagedDocument;

use super::map::bounding_box;

/// Un enlace de una página: su rectángulo (pt, desde la esquina superior
/// izquierda) y su destino — una URL, o un punto del documento.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Link {
    pub x_pt: f64,
    pub y_pt: f64,
    pub w_pt: f64,
    pub h_pt: f64,
    /// Enlace externo. Se valida en el backend al abrirlo (`open_document_link`).
    pub url: Option<String>,
    /// Enlace interno: página (1-indexada) y punto de destino.
    pub target_page: Option<u32>,
    pub target_x_pt: Option<f64>,
    pub target_y_pt: Option<f64>,
}

/// Enlaces de la página `index` (0-indexada) de `document`.
pub fn page_links(document: &PagedDocument, index: usize) -> Vec<Link> {
    let Some(page) = document.pages().get(index) else { return Vec::new() };
    let mut out = Vec::new();
    walk(document, &page.frame, Transform::identity(), &mut out);
    out
}

fn walk(document: &PagedDocument, frame: &Frame, ts: Transform, out: &mut Vec<Link>) {
    for (pos, item) in frame.items() {
        match item {
            FrameItem::Group(group) => {
                let inner = ts.pre_concat(Transform::translate(pos.x, pos.y).pre_concat(group.transform));
                walk(document, &group.frame, inner, out);
            }
            FrameItem::Link(destination, size) => {
                let [x, y, w, h] = bounding_box(ts, *pos, Abs::zero(), Abs::zero(), size.x, size.y);
                let mut link = Link {
                    x_pt: f64::from(x),
                    y_pt: f64::from(y),
                    w_pt: f64::from(w),
                    h_pt: f64::from(h),
                    url: None,
                    target_page: None,
                    target_x_pt: None,
                    target_y_pt: None,
                };
                let internal = match destination {
                    Destination::Url(url) => {
                        link.url = Some(url.as_str().to_string());
                        None
                    }
                    Destination::Position(position) => Some(*position),
                    // El introspector paginado ya da la posición en página.
                    Destination::Location(location) => document.introspector().position(*location),
                };
                if let Some(position) = internal {
                    link.target_page = u32::try_from(position.page.get()).ok();
                    link.target_x_pt = Some(position.point.x.to_pt());
                    link.target_y_pt = Some(position.point.y.to_pt());
                }
                if link.url.is_some() || link.target_page.is_some() {
                    out.push(link);
                }
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::world::EngineWorld;
    use std::fs;

    fn compile(files: &[(&str, &str)]) -> (tempfile::TempDir, PagedDocument) {
        let dir = tempfile::tempdir().unwrap();
        for (name, text) in files {
            fs::write(dir.path().join(name), text).unwrap();
        }
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();
        world.begin_compile();
        let document = typst::compile::<PagedDocument>(&*world).output.expect("debe compilar");
        (dir, document)
    }

    /// Verificación del hallazgo 2 de `/plan`: cada tipo de enlace llega como
    /// `FrameItem::Link` con su destino resuelto.
    #[test]
    fn saca_enlaces_externos_referencias_notas_citas_e_indice() {
        let bib = "@book{knuth, title={The Art of Computer Programming}, author={Knuth, Donald}, year={1968}}";
        let main = r#"#set heading(numbering: "1.")
#outline()
#pagebreak()
= Introducción <intro>
Web: #link("https://typst.app")[Typst]. Ver @intro. Nota#footnote[Una nota.]. Cita @knuth.
#pagebreak()
#bibliography("refs.bib")
"#;
        let (_dir, document) = compile(&[("main.typ", main), ("refs.bib", bib)]);

        let first = page_links(&document, 0);
        assert!(
            first.iter().any(|link| link.target_page == Some(2)),
            "la entrada del índice debe llevar a la página 2: {first:?}"
        );

        let second = page_links(&document, 1);
        assert!(second.iter().any(|link| link.url.as_deref() == Some("https://typst.app")), "{second:?}");
        // @intro y la marca de la nota apuntan a la propia página 2.
        assert!(second.iter().filter(|link| link.target_page == Some(2)).count() >= 2, "{second:?}");
        // La cita lleva a la bibliografía, en la página 3.
        assert!(second.iter().any(|link| link.target_page == Some(3)), "{second:?}");
        for link in &second {
            assert!(link.w_pt > 0.0 && link.h_pt > 0.0, "{link:?}");
        }
    }

    #[test]
    fn un_enlace_dentro_de_un_bloque_desplazado_lleva_su_desplazamiento() {
        let main = "#move(dx: 100pt, dy: 50pt)[#link(\"https://a.b\")[aquí]]";
        let (_dir, document) = compile(&[("main.typ", main)]);
        let plain = compile(&[("main.typ", "#link(\"https://a.b\")[aquí]")]).1;
        let moved = &page_links(&document, 0)[0];
        let base = &page_links(&plain, 0)[0];
        assert!((moved.x_pt - base.x_pt - 100.0).abs() < 0.5, "{moved:?} vs {base:?}");
        assert!((moved.y_pt - base.y_pt - 50.0).abs() < 0.5, "{moved:?} vs {base:?}");
    }

    #[test]
    fn una_pagina_que_no_existe_no_tiene_enlaces() {
        let (_dir, document) = compile(&[("main.typ", "Sin enlaces.")]);
        assert!(page_links(&document, 0).is_empty());
        assert!(page_links(&document, 7).is_empty());
    }
}
