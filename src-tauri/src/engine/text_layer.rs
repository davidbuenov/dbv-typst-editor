// =============================================================================
// DBV Typst Editor — Capa de texto de la vista previa (RF-82)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El SVG de la vista previa solo lleva `<use>` de glifos: no hay texto que
// seleccionar ni en el que buscar. El documento maquetado sí lo tiene: cada
// `TextItem` lleva su texto y el avance de cada glifo. Este módulo recorre las
// páginas UNA vez (el mismo recorrido y la misma caja de `map.rs`) y guarda,
// por página, el texto en el orden del marco con un rectángulo por carácter.
// Con eso se responde a «buscar» (en TODAS las páginas, también las que la
// vista previa aún no ha pintado) y a «copiar» (el texto de una página con sus
// cajas, para que el frontend seleccione arrastrando).
//
// Límites declarados (R-P1, verificados por los tests de este módulo):
//   · el orden es el del marco, el mismo que usan los extractores de PDF: con
//     columnas sale primero la izquierda; las notas al pie, al final de su
//     página;
//   · una ligadura (`fi`) es un glifo para dos caracteres: su rectángulo se
//     reparte a partes iguales;
//   · entre líneas se pone un espacio, así que una frase partida entre dos
//     líneas se encuentra escrita con espacio.

use serde::Serialize;
use typst::layout::{Abs, Frame, FrameItem, Transform};
use typst_layout::PagedDocument;

use super::map::{bounding_box, Rect};

/// Texto de una página y la caja (x, y, ancho, alto en pt) de cada carácter.
/// `text` y `boxes` van a la par por CARÁCTER (punto de código), no por
/// unidad UTF-16: el frontend los recorre con `Array.from(text)`.
#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PageText {
    pub text: String,
    pub boxes: Vec<[f32; 4]>,
}

/// Una coincidencia de la búsqueda: su página (1-indexada) y los rectángulos
/// que la cubren (uno por línea).
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextMatch {
    pub page: u32,
    pub rects: Vec<Rect>,
}

/// Todas las páginas del documento.
#[derive(Debug, Default)]
pub struct TextLayer {
    pages: Vec<PageText>,
}

impl TextLayer {
    pub fn build(document: &PagedDocument) -> Self {
        let pages = document
            .pages()
            .iter()
            .map(|page| {
                let mut out = PageText::default();
                walk(&page.frame, Transform::identity(), &mut out);
                out
            })
            .collect();
        Self { pages }
    }

    /// Texto de la página `index` (0-indexada).
    pub fn page(&self, index: usize) -> Option<&PageText> {
        self.pages.get(index)
    }

    /// Coincidencias de `query` en todas las páginas. Los espacios en blanco
    /// de la consulta y del texto se comparan como uno solo, así que una frase
    /// partida entre dos líneas también se encuentra.
    pub fn search(&self, query: &str, case_sensitive: bool) -> Vec<TextMatch> {
        let fold = |c: char| {
            let c = if c.is_whitespace() { ' ' } else { c };
            if case_sensitive { c } else { c.to_lowercase().next().unwrap_or(c) }
        };
        let needle: Vec<char> = collapse_spaces(query.trim().chars().map(fold));
        let mut out = Vec::new();
        if needle.is_empty() {
            return out;
        }
        for (index, page) in self.pages.iter().enumerate() {
            let chars: Vec<char> = page.text.chars().map(fold).collect();
            let mut start = 0;
            while start < chars.len() {
                match match_at(&chars, start, &needle) {
                    Some(end) => {
                        out.push(TextMatch { page: index as u32 + 1, rects: merge_boxes(&page.boxes[start..end], index as u32 + 1) });
                        start = end;
                    }
                    None => start += 1,
                }
            }
        }
        out
    }
}

/// Quita espacios repetidos (la consulta «gato  duerme» es «gato duerme»).
fn collapse_spaces(chars: impl Iterator<Item = char>) -> Vec<char> {
    let mut out: Vec<char> = Vec::new();
    for c in chars {
        if !(c == ' ' && out.last() == Some(&' ')) {
            out.push(c);
        }
    }
    out
}

/// Si `needle` casa en `chars` desde `start` (varios espacios del texto
/// cuentan como uno), el índice de fin.
fn match_at(chars: &[char], start: usize, needle: &[char]) -> Option<usize> {
    let mut i = start;
    for &wanted in needle {
        if chars.get(i) != Some(&wanted) {
            return None;
        }
        i += 1;
        if wanted == ' ' {
            while chars.get(i) == Some(&' ') {
                i += 1;
            }
        }
    }
    Some(i)
}

/// Une las cajas de caracteres contiguos de una misma línea en un rectángulo.
fn merge_boxes(boxes: &[[f32; 4]], page: u32) -> Vec<Rect> {
    let mut rects: Vec<Rect> = Vec::new();
    for b in boxes.iter().filter(|b| b[2] > 0.0 || b[3] > 0.0) {
        let (x, y, w, h) = (f64::from(b[0]), f64::from(b[1]), f64::from(b[2]), f64::from(b[3]));
        match rects.last_mut() {
            Some(last) if (last.y_pt - y).abs() < h * 0.5 && x >= last.x_pt - 0.5 => {
                let right = (last.x_pt + last.w_pt).max(x + w);
                let top = last.y_pt.min(y);
                let bottom = (last.y_pt + last.h_pt).max(y + h);
                last.w_pt = right - last.x_pt;
                last.y_pt = top;
                last.h_pt = bottom - top;
            }
            _ => rects.push(Rect { page, x_pt: x, y_pt: y, w_pt: w, h_pt: h }),
        }
    }
    rects
}

fn walk(frame: &Frame, ts: Transform, out: &mut PageText) {
    for (pos, item) in frame.items() {
        match item {
            FrameItem::Group(group) => {
                let inner = ts.pre_concat(Transform::translate(pos.x, pos.y).pre_concat(group.transform));
                walk(&group.frame, inner, out);
            }
            FrameItem::Text(text) => {
                let size = text.size;
                let mut x = Abs::zero();
                let mut first = true;
                for glyph in &text.glyphs {
                    let advance = glyph.x_advance.at(size);
                    // La misma caja que `map.rs`: una `size` por encima de la
                    // línea base y un cuarto por debajo.
                    let rect = bounding_box(ts, *pos, x + glyph.x_offset.at(size), -size, advance, size * 1.25);
                    if first {
                        separate(out, rect);
                        first = false;
                    }
                    let chars: Vec<char> = text.text[glyph.range()].chars().collect();
                    // Una ligadura es un glifo para varios caracteres.
                    let part = rect[2] / chars.len().max(1) as f32;
                    for (i, c) in chars.into_iter().enumerate() {
                        out.text.push(c);
                        out.boxes.push([rect[0] + part * i as f32, rect[1], part, rect[3]]);
                    }
                    x += advance;
                }
            }
            _ => {}
        }
    }
}

/// Entre un fragmento de texto y el siguiente, si empieza en otra línea (o
/// muy separado en la misma), un espacio: si no, las palabras de líneas
/// distintas saldrían pegadas.
fn separate(out: &mut PageText, next: [f32; 4]) {
    let Some(last) = out.boxes.last().copied() else { return };
    let other_line = (next[1] - last[1]).abs() > last[3].max(next[3]) * 0.5;
    let gap = next[0] - (last[0] + last[2]);
    let ends_with_space = out.text.ends_with(char::is_whitespace);
    if (other_line || gap > last[3] * 0.3) && !ends_with_space {
        out.text.push(' ');
        out.boxes.push([last[0] + last[2], last[1], 0.0, 0.0]);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::world::EngineWorld;
    use std::fs;

    fn compile(main: &str) -> (tempfile::TempDir, PagedDocument) {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), main).unwrap();
        let world = EngineWorld::new(dir.path(), &dir.path().join("main.typ")).unwrap();
        world.begin_compile();
        let document = typst::compile::<PagedDocument>(&*world).output.expect("debe compilar");
        (dir, document)
    }

    /// Verificación R-P1 del plan, antes de construir nada encima: columnas,
    /// ligadura, matemáticas y nota al pie dan un texto utilizable.
    #[test]
    fn verificacion_el_texto_de_la_pagina_es_utilizable_en_orden_de_lectura() {
        let main = r#"#set page(columns: 2)
La oficina final abre temprano.#footnote[Nota al pie de prueba.]
Una ecuación $x^2 + 1$ en línea.
#colbreak()
Segunda columna aquí.
"#;
        let (_dir, document) = compile(main);
        let layer = TextLayer::build(&document);
        let text = &layer.page(0).unwrap().text;
        assert_eq!(layer.page(0).unwrap().boxes.len(), text.chars().count(), "una caja por carácter");
        assert!(text.contains("oficina final"), "la ligadura «fi» se expande a sus caracteres: {text}");
        assert!(text.contains("Nota al pie de prueba"), "{text}");
        let first = text.find("La oficina").expect("primera columna");
        let second = text.find("Segunda columna").expect("segunda columna");
        assert!(first < second, "la columna izquierda va antes: {text}");
        assert!(text.contains("temprano"), "{text}");
    }

    #[test]
    fn busca_en_todas_las_paginas_sin_distinguir_mayusculas_y_a_traves_de_lineas() {
        let words = "palabra ".repeat(60);
        let main = format!("#set page(width: 8cm, height: 8cm)\nEl gato duerme. {words}\n#pagebreak()\nOtro GATO que \\\nduerme aquí.");
        let (_dir, document) = compile(&main);
        let layer = TextLayer::build(&document);

        let matches = layer.search("gato", false);
        assert_eq!(matches.iter().map(|m| m.page).collect::<Vec<_>>(), vec![1, 3], "{matches:?}");
        assert!(layer.search("gato", true).iter().all(|m| m.page == 1));

        // «que \ duerme» parte la frase en dos líneas: dos rectángulos.
        let split = layer.search("que duerme", false);
        assert_eq!(split.len(), 1, "{split:?}");
        assert_eq!(split[0].rects.len(), 2, "{split:?}");
        for rect in &split[0].rects {
            assert!(rect.w_pt > 0.0 && rect.h_pt > 0.0);
        }
    }

    #[test]
    fn las_cajas_estan_donde_se_dibuja_el_texto() {
        let (_dir, document) = compile("#set page(margin: 2cm)\nHola");
        let layer = TextLayer::build(&document);
        let page = layer.page(0).unwrap();
        let first = page.boxes[0];
        let margin = 2.0 * 72.0 / 2.54;
        assert!((f64::from(first[0]) - margin).abs() < 1.0, "{first:?}");
        assert!(f64::from(first[1]) > margin - 12.0 && f64::from(first[1]) < margin + 12.0, "{first:?}");
        assert!(page.boxes.windows(2).all(|pair| pair[1][0] >= pair[0][0]), "de izquierda a derecha");
    }

    #[test]
    fn una_consulta_vacia_no_encuentra_nada() {
        let (_dir, document) = compile("Hola");
        assert!(TextLayer::build(&document).search("   ", false).is_empty());
    }
}
