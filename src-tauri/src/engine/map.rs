// =============================================================================
// DBV Typst Editor — Mapa render ↔ fuente del motor en proceso (RF-57)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El SVG que exporta el CLI lleva solo `<use>` de glifos: ni texto ni origen en el
// fuente (`ADR-SYNC-001`), y por eso la sincronización de la v0.8.x llega al bloque
// y no más. El documento COMPUESTO en memoria sí sabe de dónde salió cada glifo:
// lleva el `Span` del nodo de fuente que lo produjo y el desplazamiento dentro de
// él. Este módulo recorre las páginas UNA vez y guarda, por glifo, dónde está en la
// página y qué bytes del fuente lo escribieron. Con eso se responden las dos
// preguntas exactas:
//
//   · `locate` (render → fuente): ¿qué palabra escribí en este punto de la página?
//   · `reveal` (fuente → render): ¿dónde se dibuja esta palabra o esta frase?
//
// Medido en el Spike S-3 sobre un libro de 224 páginas y 370.000 glifos: construir
// el mapa cuesta 0,33 s (con una caché por `Span`: sin ella eran 6,5 s), un clic se
// resuelve en decenas de microsegundos.
//
// Casos que NO se resuelven por el glifo (RF-57.2):
//   · Referencias y citas (`@sec-x`, "Sección 2"): el texto se compone a partir del
//     DESTINO, no de lo escrito, así que responden con la referencia tal como se
//     escribió. Se detectan por las etiquetas de inicio y fin que Typst deja en el
//     marco, no por el glifo.
//   · Texto generado sin fuente propio (numeración, "Figura 1:", marcador de nota
//     al pie): responde con el elemento al que pertenece.
//   · Imágenes y formas: el elemento que las produjo.
//
// Las posiciones cruzan la frontera en UTF-16 (línea y columna, 1-indexadas):
// Typst cuenta bytes UTF-8 y CodeMirror unidades UTF-16, y mezclarlos desplazaría
// el salto en cuanto aparezca una tilde o un emoji (ADR-MOTOR-002, decisión 3).

use std::collections::HashMap;
use std::ops::Range;

use serde::Serialize;
use typst::introspection::{Location, Tag};
use typst::layout::{Abs, Frame, FrameItem, Point, Transform};
use typst::model::{CiteElem, RefElem};
use typst::syntax::{FileId, Source, Span, SyntaxKind};
use typst_layout::PagedDocument;

/// Un rectángulo en una página, en puntos desde su esquina superior izquierda.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Rect {
    /// Página, 1-indexada.
    pub page: u32,
    pub x_pt: f64,
    pub y_pt: f64,
    pub w_pt: f64,
    pub h_pt: f64,
}

/// Lo que se escribió bajo un punto de la página: fichero y rango, en UTF-16
/// (línea y columna 1-indexadas).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Located {
    /// Ruta relativa a la raíz del proyecto, con `/`.
    pub file: String,
    pub start_line: u32,
    pub start_column: u32,
    pub end_line: u32,
    pub end_column: u32,
    /// El mismo rango como desplazamientos UTF-16 desde el inicio del fichero. Son
    /// lo que permite reasignarlo con los cambios que el editor tiene pendientes
    /// desde esa compilación sin conocer el texto compilado.
    pub from: usize,
    pub to: usize,
}

/// Un glifo (o una forma, o una imagen) dibujado, con sus bytes de origen.
#[derive(Clone)]
struct Cell {
    page: u32,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    file: FileId,
    /// Byte de inicio en el fuente.
    start: usize,
    /// Longitud en bytes de lo que produjo (un carácter, o el elemento entero).
    len: usize,
    /// True si `start..start+len` es un ELEMENTO entero (referencia, texto
    /// generado, forma, imagen) y no un carácter suelto: se devuelve tal cual, sin
    /// extenderlo a la palabra.
    whole: bool,
}

/// Cómo resolver un fichero de Typst a su texto y a su ruta de proyecto.
pub type SourceLookup<'a> = &'a dyn Fn(FileId) -> Option<Source>;
pub type RelativeLookup<'a> = &'a dyn Fn(FileId) -> Option<String>;

/// Mapa de un documento compuesto.
pub struct SourceMap {
    cells: Vec<Cell>,
    /// Rango de `cells` de cada página (0-indexada).
    pages: Vec<Range<usize>>,
    /// Índices de `cells` por fichero, ordenados por byte de inicio.
    by_file: HashMap<FileId, Vec<usize>>,
    /// Las versiones del fuente con las que se compiló: los bytes del mapa solo
    /// valen contra ellas.
    sources: HashMap<FileId, Source>,
    files: HashMap<String, FileId>,
}

/// Cómo se clasifica el nodo de fuente al que apunta un `Span`.
#[derive(Clone, Copy)]
enum Class {
    /// Texto o texto de fórmula: el glifo cae en `inicio + desplazamiento`.
    Text,
    /// Cadena dentro de una fórmula: cuenta desde dentro de la comilla.
    Str,
    /// Cualquier otro nodo: se responde con el nodo entero.
    Other,
}

#[derive(Clone, Copy)]
struct Resolved {
    id: FileId,
    start: usize,
    end: usize,
    class: Class,
}

struct Builder<'a> {
    source_of: SourceLookup<'a>,
    relative_of: RelativeLookup<'a>,
    sources: HashMap<FileId, Source>,
    files: HashMap<String, FileId>,
    spans: HashMap<Span, Option<Resolved>>,
    cells: Vec<Cell>,
}

/// Un elemento abierto por su etiqueta de inicio y todavía no cerrado.
struct Open {
    location: Option<Location>,
    span: Span,
    reference: bool,
}

impl<'a> Builder<'a> {
    fn source(&mut self, id: FileId) -> Option<Source> {
        if let Some(source) = self.sources.get(&id) {
            return Some(source.clone());
        }
        let source = (self.source_of)(id)?;
        self.sources.insert(id, source.clone());
        Some(source)
    }

    /// Resuelve un `Span` al nodo de fuente al que apunta. Solo los ficheros del
    /// PROYECTO tienen mapa: lo que sale de un paquete no es del usuario.
    fn resolve(&mut self, span: Span) -> Option<Resolved> {
        if let Some(known) = self.spans.get(&span) {
            return *known;
        }
        let resolved = self.resolve_uncached(span);
        self.spans.insert(span, resolved);
        resolved
    }

    fn resolve_uncached(&mut self, span: Span) -> Option<Resolved> {
        let id = span.id()?;
        let relative = (self.relative_of)(id)?;
        let source = self.source(id)?;
        let node = source.find(span)?;
        self.files.entry(relative).or_insert(id);
        let range = node.range();
        let class = match node.kind() {
            SyntaxKind::Text | SyntaxKind::MathText => Class::Text,
            SyntaxKind::Str => Class::Str,
            _ => Class::Other,
        };
        Some(Resolved { id, start: range.start, end: range.end, class })
    }

    /// Rango de bytes del elemento entero al que apunta `span`.
    fn element(&mut self, span: Span) -> Option<(FileId, usize, usize)> {
        let resolved = self.resolve(span)?;
        Some((resolved.id, resolved.start, resolved.end))
    }

    fn push(&mut self, page: u32, rect: [f32; 4], file: FileId, start: usize, len: usize, whole: bool) {
        self.cells.push(Cell { page, x: rect[0], y: rect[1], w: rect[2], h: rect[3], file, start, len, whole });
    }

    fn walk(&mut self, frame: &Frame, page: u32, ts: Transform, open: &mut Vec<Open>) {
        for (pos, item) in frame.items() {
            match item {
                FrameItem::Tag(Tag::Start(content, _)) => open.push(Open {
                    location: content.location(),
                    span: content.span(),
                    // Un grupo de citas no es una cita: dentro de él cada cita
                    // sigue respondiendo por su propio texto.
                    reference: content.is::<RefElem>() || content.is::<CiteElem>(),
                }),
                FrameItem::Tag(Tag::End(location, ..)) => {
                    if let Some(at) = open.iter().rposition(|o| o.location == Some(*location)) {
                        open.truncate(at);
                    }
                }
                // Se entra siempre en los grupos, también en los que no tienen
                // glifos, para que las etiquetas de dentro mantengan bien la lista
                // de elementos abiertos.
                FrameItem::Group(group) => {
                    let inner = ts.pre_concat(Transform::translate(pos.x, pos.y).pre_concat(group.transform));
                    self.walk(&group.frame, page, inner, open);
                }
                FrameItem::Text(text) => self.text(text, *pos, page, ts, open),
                FrameItem::Shape(shape, span) if shape.fill.is_some() => {
                    let bbox = shape.bbox(false);
                    let rect = bounding_box(ts, *pos, bbox.min.x, bbox.min.y, bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y);
                    if let Some((file, start, end)) = self.element(*span) {
                        self.push(page, rect, file, start, end - start, true);
                    }
                }
                FrameItem::Image(_, size, span) => {
                    let rect = bounding_box(ts, *pos, Abs::zero(), Abs::zero(), size.x, size.y);
                    if let Some((file, start, end)) = self.element(*span) {
                        self.push(page, rect, file, start, end - start, true);
                    }
                }
                _ => {}
            }
        }
    }

    fn text(&mut self, text: &typst::text::TextItem, pos: Point, page: u32, ts: Transform, open: &[Open]) {
        let size = text.size;
        let mut x = Abs::zero();
        for glyph in &text.glyphs {
            let advance = glyph.x_advance.at(size);
            // El rectángulo del glifo, desde la línea base: una `size` por encima y
            // un cuarto por debajo, que es lo que cubre los huecos entre letras
            // que para el ojo son parte de la palabra.
            let rect = bounding_box(ts, pos, x + glyph.x_offset.at(size), -size, advance, size * 1.25);
            self.glyph(text, glyph, rect, page, open);
            x += advance;
        }
    }

    fn glyph(&mut self, text: &typst::text::TextItem, glyph: &typst::text::Glyph, rect: [f32; 4], page: u32, open: &[Open]) {
        // 1. Dentro de una referencia o una cita: responde la referencia entera.
        if let Some(reference) = open.iter().rev().find(|o| o.reference) {
            if let Some((file, start, end)) = self.element(reference.span) {
                self.push(page, rect, file, start, end - start, true);
                return;
            }
        }
        // 2. El glifo apunta a un nodo de fuente.
        let (span, within) = glyph.span;
        if let Some(resolved) = self.resolve(span) {
            match resolved.class {
                Class::Text | Class::Str => {
                    let inside = usize::from(within) + usize::from(matches!(resolved.class, Class::Str));
                    let start = (resolved.start + inside).min(resolved.end);
                    let len = self.chars_len(resolved.id, start, text.text[glyph.range()].chars().count());
                    self.push(page, rect, resolved.id, start, len, false);
                }
                Class::Other => {
                    self.push(page, rect, resolved.id, resolved.start, resolved.end - resolved.start, true);
                }
            }
            return;
        }
        // 3. Sin fuente propio (numeración, "Figura 1:"): el elemento al que
        //    pertenece, el más interior con un origen conocido.
        for element in open.iter().rev() {
            if let Some((file, start, end)) = self.element(element.span) {
                self.push(page, rect, file, start, end - start, true);
                return;
            }
        }
    }

    /// Longitud en bytes de `chars` caracteres del fuente a partir de `start`.
    fn chars_len(&mut self, id: FileId, start: usize, chars: usize) -> usize {
        let Some(source) = self.source(id) else { return 1 };
        let text = source.text();
        let Some(rest) = text.get(start..) else { return 1 };
        let taken: usize = rest.chars().take(chars.max(1)).map(char::len_utf8).sum();
        taken.max(1)
    }
}

/// Caja envolvente, en la página, de un rectángulo (`dx`, `dy`, `w`, `h`) situado
/// en `pos` dentro de un marco con la transformación acumulada `ts`. Con grupos
/// girados o escalados la caja es la envolvente de las cuatro esquinas.
pub(crate) fn bounding_box(ts: Transform, pos: Point, dx: Abs, dy: Abs, w: Abs, h: Abs) -> [f32; 4] {
    let corners = [
        Point::new(pos.x + dx, pos.y + dy),
        Point::new(pos.x + dx + w, pos.y + dy),
        Point::new(pos.x + dx, pos.y + dy + h),
        Point::new(pos.x + dx + w, pos.y + dy + h),
    ]
    .map(|corner| corner.transform(ts));
    let (mut min_x, mut min_y, mut max_x, mut max_y) = (f64::MAX, f64::MAX, f64::MIN, f64::MIN);
    for corner in corners {
        min_x = min_x.min(corner.x.to_pt());
        min_y = min_y.min(corner.y.to_pt());
        max_x = max_x.max(corner.x.to_pt());
        max_y = max_y.max(corner.y.to_pt());
    }
    [min_x as f32, min_y as f32, (max_x - min_x) as f32, (max_y - min_y) as f32]
}

impl SourceMap {
    /// Recorre las páginas de `document` y construye el mapa.
    ///
    /// `source_of` da el texto (con la versión con la que se compiló) y
    /// `relative_of` la ruta de proyecto de un fichero, o `None` para los de un
    /// paquete, que no tienen mapa.
    pub fn build(document: &PagedDocument, source_of: SourceLookup<'_>, relative_of: RelativeLookup<'_>) -> Self {
        let mut builder = Builder {
            source_of,
            relative_of,
            sources: HashMap::new(),
            files: HashMap::new(),
            spans: HashMap::new(),
            cells: Vec::new(),
        };
        let mut pages = Vec::with_capacity(document.pages().len());
        for (index, page) in document.pages().iter().enumerate() {
            let first = builder.cells.len();
            let mut open = Vec::new();
            builder.walk(&page.frame, index as u32 + 1, Transform::identity(), &mut open);
            pages.push(first..builder.cells.len());
        }

        let mut by_file: HashMap<FileId, Vec<usize>> = HashMap::new();
        for (index, cell) in builder.cells.iter().enumerate() {
            by_file.entry(cell.file).or_default().push(index);
        }
        for indices in by_file.values_mut() {
            indices.sort_by_key(|&index| builder.cells[index].start);
        }
        Self { cells: builder.cells, pages, by_file, sources: builder.sources, files: builder.files }
    }

    /// Número de glifos, formas e imágenes con origen en el fuente.
    pub fn len(&self) -> usize {
        self.cells.len()
    }

    pub fn is_empty(&self) -> bool {
        self.cells.is_empty()
    }

    /// Qué se escribió en el punto `(x, y)` de la página `page` (1-indexada), en
    /// puntos desde la esquina superior izquierda.
    pub fn locate(&self, page: usize, x: f64, y: f64) -> Option<Located> {
        let range = self.pages.get(page.checked_sub(1)?)?.clone();
        // Un doble clic cae dentro de una palabra pero no siempre dentro de la caja
        // de un glifo: el hueco entre dos letras, o un punto justo bajo la línea
        // base, es parte de la palabra para el ojo y de ningún glifo para la
        // maquetación. Unos pocos puntos cercanos lo resuelven sin llegar a la
        // palabra vecina.
        let cell = [(0.0, 0.0), (-1.5, 0.0), (1.5, 0.0), (0.0, 2.0), (0.0, -2.0)]
            .iter()
            .find_map(|&(dx, dy)| self.cell_at(&range, x + dx, y + dy))?;
        self.located(cell)
    }

    /// La caja que contiene el punto; entre varias, la última dibujada (la de encima).
    fn cell_at(&self, range: &Range<usize>, x: f64, y: f64) -> Option<&Cell> {
        self.cells[range.clone()].iter().rev().find(|cell| {
            let (cx, cy) = (f64::from(cell.x), f64::from(cell.y));
            cx <= x && x <= cx + f64::from(cell.w) && cy <= y && y <= cy + f64::from(cell.h)
        })
    }

    fn located(&self, cell: &Cell) -> Option<Located> {
        let source = self.sources.get(&cell.file)?;
        let file = self.files.iter().find(|(_, id)| **id == cell.file)?.0.clone();
        let (start, end) = if cell.whole {
            (cell.start, cell.start + cell.len)
        } else {
            word_range(source.text(), cell.start)
        };
        let (start_line, start_column) = line_column(source, start)?;
        let (end_line, end_column) = line_column(source, end)?;
        let lines = source.lines();
        let (from, to) = (lines.byte_to_utf16(start)?, lines.byte_to_utf16(end)?);
        Some(Located { file, start_line, start_column, end_line, end_column, from, to })
    }

    /// Dónde se dibuja lo escrito entre `from` y `to` (UTF-16, desde el inicio del
    /// fichero) de `file`. Con `from == to` (un cursor sin selección) se toma la
    /// palabra bajo el cursor. Devuelve una caja por línea dibujada.
    pub fn reveal(&self, file: &str, from: usize, to: usize) -> Vec<Rect> {
        let Some(id) = self.files.get(file) else { return Vec::new() };
        let Some(source) = self.sources.get(id) else { return Vec::new() };
        let lines = source.lines();
        let (Some(a), Some(b)) = (lines.utf16_to_byte(from), lines.utf16_to_byte(to)) else { return Vec::new() };
        let (start, end) = if a == b { word_at_cursor(source.text(), a) } else { (a.min(b), a.max(b)) };
        if start >= end {
            return Vec::new();
        }

        let overlapping: Vec<usize> = self
            .by_file
            .get(id)
            .into_iter()
            .flatten()
            .copied()
            .filter(|&index| {
                let cell = &self.cells[index];
                cell.start < end && cell.start + cell.len > start
            })
            .collect();
        // Los glifos exactos mandan. Un elemento ENTERO (una referencia, el número
        // generado de un encabezado) solo cuenta si cae dentro del rango, o si no
        // hay nada más: revelar "capítulo" en un encabezado no debe pintar también
        // el "1." ni extender la caja a toda la línea del título.
        let exact: Vec<usize> = overlapping.iter().copied().filter(|&i| !self.cells[i].whole).collect();
        let inside: Vec<usize> = overlapping
            .iter()
            .copied()
            .filter(|&i| {
                let cell = &self.cells[i];
                cell.whole && cell.start >= start && cell.start + cell.len <= end
            })
            .collect();
        let mut hits = if exact.is_empty() && inside.is_empty() { overlapping } else { [exact, inside].concat() };
        // En orden de dibujo, que es el orden de lectura dentro de cada línea.
        hits.sort_unstable();
        merge_lines(hits.iter().map(|&index| &self.cells[index]))
    }
}

/// Une celdas consecutivas de una misma línea en una sola caja.
fn merge_lines<'a>(cells: impl Iterator<Item = &'a Cell>) -> Vec<Rect> {
    let mut rects: Vec<Rect> = Vec::new();
    for cell in cells {
        let (x, y, w, h) = (f64::from(cell.x), f64::from(cell.y), f64::from(cell.w), f64::from(cell.h));
        if let Some(last) = rects.last_mut() {
            let same_page = last.page == cell.page;
            // Misma línea: las cajas se solapan más de la mitad en vertical; y
            // pegadas en horizontal (un hueco mayor que una línea es otra columna).
            let overlap = (last.y_pt + last.h_pt).min(y + h) - last.y_pt.max(y);
            let same_line = overlap > 0.5 * last.h_pt.min(h);
            let close = x <= last.x_pt + last.w_pt + h && x + w >= last.x_pt - h;
            if same_page && same_line && close {
                let right = (last.x_pt + last.w_pt).max(x + w);
                let bottom = (last.y_pt + last.h_pt).max(y + h);
                last.x_pt = last.x_pt.min(x);
                last.y_pt = last.y_pt.min(y);
                last.w_pt = right - last.x_pt;
                last.h_pt = bottom - last.y_pt;
                continue;
            }
        }
        rects.push(Rect { page: cell.page, x_pt: x, y_pt: y, w_pt: w, h_pt: h });
    }
    rects
}

fn is_word_char(c: char) -> bool {
    // Letras, cifras y `_`, y las marcas combinantes que acompañan a una letra.
    c.is_alphanumeric() || c == '_' || ('\u{0300}'..='\u{036F}').contains(&c)
}

/// Rango de bytes de la palabra que contiene el byte `at`. Si en `at` no hay una
/// letra (un signo de puntuación), es ese único carácter.
fn word_range(text: &str, at: usize) -> (usize, usize) {
    let at = (0..=at.min(text.len())).rev().find(|&i| text.is_char_boundary(i)).unwrap_or(0);
    let Some(current) = text[at..].chars().next() else { return (at, at) };
    if !is_word_char(current) {
        return (at, at + current.len_utf8());
    }
    let start = text[..at]
        .char_indices()
        .rev()
        .take_while(|(_, c)| is_word_char(*c))
        .last()
        .map_or(at, |(i, _)| i);
    let end = text[at..]
        .char_indices()
        .find(|(_, c)| !is_word_char(*c))
        .map_or(text.len(), |(i, _)| at + i);
    (start, end)
}

/// La palabra a la que apunta un cursor: la que empieza en él o, si está justo al
/// final de una, esa (un cursor "después de la palabra" sigue siendo de la palabra).
fn word_at_cursor(text: &str, at: usize) -> (usize, usize) {
    let at = (0..=at.min(text.len())).rev().find(|&i| text.is_char_boundary(i)).unwrap_or(0);
    let on_word = text[at..].chars().next().is_some_and(is_word_char);
    if on_word {
        return word_range(text, at);
    }
    match text[..at].chars().next_back() {
        Some(previous) if is_word_char(previous) => word_range(text, at - previous.len_utf8()),
        _ => (at, at),
    }
}

/// Línea y columna (1-indexadas, columna en UTF-16) de un byte.
fn line_column(source: &Source, byte: usize) -> Option<(u32, u32)> {
    let lines = source.lines();
    let line = lines.byte_to_line(byte)?;
    let line_start = lines.line_to_byte(line)?;
    let column = lines.byte_to_utf16(byte)? - lines.byte_to_utf16(line_start)?;
    Some((line as u32 + 1, column as u32 + 1))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::worker::{Outcome, Request, Worker};
    use crate::engine::world::EngineWorld;
    use std::fs;
    use std::sync::{mpsc::channel, Arc, Mutex};
    use std::time::Duration;

    struct Fixture {
        _dir: tempfile::TempDir,
        map: SourceMap,
        pages: Vec<(f64, f64)>,
        /// Texto del fichero principal, para comprobar qué palabra se devolvió.
        main: String,
    }

    fn fixture(files: &[(&str, &str)]) -> Fixture {
        let dir = tempfile::tempdir().unwrap();
        for (name, text) in files {
            let path = dir.path().join(name);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, text).unwrap();
        }
        let world = EngineWorld::new(dir.path(), &dir.path().join(files[0].0)).unwrap();
        let (tx, rx) = channel();
        let tx = Mutex::new(tx);
        let worker = Worker::spawn(world.clone(), Arc::new(move |result| {
            let _ = tx.lock().unwrap().send(result);
        }));
        worker.submit(Request { generation: 1, overrides: Vec::new() });
        let document = match rx.recv_timeout(Duration::from_secs(60)).unwrap().outcome {
            Outcome::Compiled { document, .. } => document,
            Outcome::Failed { errors, .. } => panic!("no compila: {}", errors[0].message),
            Outcome::Panicked(message) => panic!("pánico: {message}"),
        };
        let lookup_world = world.clone();
        let relative_world = world.clone();
        let map = SourceMap::build(
            &document,
            &move |id| typst::World::source(&*lookup_world, id).ok(),
            &move |id| relative_world.relative_path(id),
        );
        let pages = crate::engine::pages::geometry(&document).iter().map(|p| (p.width_pt, p.height_pt)).collect();
        Fixture { _dir: dir, map, pages, main: files[0].1.to_string() }
    }

    /// Texto que `Located` cubre dentro del fichero principal (una sola línea).
    fn covered(fixture: &Fixture, located: &Located) -> String {
        let lines: Vec<&str> = fixture.main.lines().collect();
        let line = lines[(located.start_line - 1) as usize];
        let utf16: Vec<u16> = line.encode_utf16().collect();
        if located.start_line != located.end_line {
            return line.to_string();
        }
        String::from_utf16_lossy(&utf16[(located.start_column - 1) as usize..(located.end_column - 1) as usize])
    }

    fn center(rect: &Rect) -> (f64, f64) {
        (rect.x_pt + rect.w_pt / 2.0, rect.y_pt + rect.h_pt * 0.6)
    }

    /// Offset UTF-16 de la primera aparición de `word` COMO PALABRA entera (no como
    /// parte de otra: "sin" no es "sincronizacion").
    fn utf16_of_word(text: &str, word: &str) -> (usize, usize) {
        let byte = text
            .match_indices(word)
            .map(|(i, _)| i)
            .find(|&i| {
                let before = text[..i].chars().next_back().is_none_or(|c| !c.is_alphanumeric());
                let after = text[i + word.len()..].chars().next().is_none_or(|c| !c.is_alphanumeric());
                before && after
            })
            .unwrap_or_else(|| panic!("{word:?} no aparece como palabra"));
        let from = text[..byte].encode_utf16().count();
        (from, from + word.encode_utf16().count())
    }

    /// Offset UTF-16 del inicio de `needle` dentro de `text`.
    fn utf16_of(text: &str, needle: &str) -> (usize, usize) {
        let byte = text.find(needle).unwrap_or_else(|| panic!("{needle:?} no está en el fuente"));
        let from = text[..byte].encode_utf16().count();
        (from, from + needle.encode_utf16().count())
    }

    #[test]
    fn un_clic_sobre_una_palabra_devuelve_esa_palabra() {
        let f = fixture(&[("main.typ", "Hola mundo cruel.")]);
        let (from, to) = utf16_of(&f.main, "mundo");
        let rect = f.map.reveal("main.typ", from, to)[0];

        let (x, y) = center(&rect);
        let located = f.map.locate(1, x, y).expect("debe resolver");

        assert_eq!(located.file, "main.typ");
        assert_eq!(covered(&f, &located), "mundo");
    }

    #[test]
    fn ida_y_vuelta_palabra_a_palabra_en_prosa() {
        let text = "La sincronizacion exacta lleva del render al fuente y del fuente al render. \
                    Cada palabra debe volver a si misma sin confundirse con otra parecida, \
                    aunque se repita la palabra palabra palabra varias veces seguidas.";
        let f = fixture(&[("main.typ", text)]);
        let (mut total, mut ok) = (0, 0);
        let mut failed = Vec::new();
        for word in text.split(|c: char| !c.is_alphanumeric()).filter(|w| w.len() > 2) {
            // Se toma la PRIMERA aparición de cada palabra distinta.
            let (from, to) = utf16_of_word(text, word);
            let rects = f.map.reveal("main.typ", from, to);
            total += 1;
            let Some(rect) = rects.first() else { continue };
            let (x, y) = center(rect);
            let back = f.map.locate(1, x, y).map(|l| covered(&f, &l));
            if back.as_deref() == Some(word) {
                ok += 1;
            } else {
                failed.push(format!("{word} -> {back:?}"));
            }
        }
        assert_eq!(ok, total, "todas las palabras deben volver a sí mismas ({ok}/{total}): {failed:?}");
    }

    #[test]
    fn un_texto_de_un_fichero_incluido_apunta_a_ese_fichero() {
        let f = fixture(&[("main.typ", "#include \"cap.typ\"\n"), ("cap.typ", "Contenido del capitulo.")]);
        let rect = f.map.reveal("cap.typ", 0, 9)[0];

        let (x, y) = center(&rect);
        let located = f.map.locate(1, x, y).unwrap();

        assert_eq!(located.file, "cap.typ");
        assert_eq!((located.start_line, located.start_column), (1, 1));
    }

    #[test]
    fn las_columnas_utf16_cuentan_los_emoji_como_dos_unidades() {
        // "😀" ocupa 2 unidades UTF-16 y 4 bytes: la columna no debe desplazarse.
        let text = "ñandú 😀 palabra final";
        let f = fixture(&[("main.typ", text)]);
        let (from, to) = utf16_of(text, "palabra");
        let rect = f.map.reveal("main.typ", from, to)[0];

        let (x, y) = center(&rect);
        let located = f.map.locate(1, x, y).unwrap();

        assert_eq!(located.start_column as usize, from + 1);
        assert_eq!(located.end_column as usize, to + 1);
        assert_eq!(covered(&f, &located), "palabra");
    }

    #[test]
    fn locate_devuelve_tambien_los_desplazamientos_utf16_desde_el_inicio_del_fichero() {
        let text = "ñandú 😀 palabra final";
        let f = fixture(&[("main.typ", text)]);
        let (from, to) = utf16_of(text, "palabra");
        let rect = f.map.reveal("main.typ", from, to)[0];

        let (x, y) = center(&rect);
        let located = f.map.locate(1, x, y).unwrap();

        assert_eq!((located.from, located.to), (from, to));
    }

    #[test]
    fn reveal_con_el_cursor_sin_seleccion_marca_la_palabra_bajo_el_cursor() {
        let text = "uno dos tres";
        let f = fixture(&[("main.typ", text)]);
        let (from, _) = utf16_of(text, "dos");

        let sin_seleccion = f.map.reveal("main.typ", from + 1, from + 1);
        let palabra = f.map.reveal("main.typ", from, from + 3);

        assert!(!sin_seleccion.is_empty());
        assert_eq!(sin_seleccion, palabra);
    }

    #[test]
    fn un_cursor_justo_despues_de_la_palabra_sigue_siendo_de_esa_palabra() {
        let text = "uno dos tres";
        let f = fixture(&[("main.typ", text)]);
        let (from, to) = utf16_of(text, "dos");

        assert_eq!(f.map.reveal("main.typ", to, to), f.map.reveal("main.typ", from, to));
    }

    #[test]
    fn una_frase_que_ocupa_varias_lineas_da_una_caja_por_linea() {
        let text = "#set page(width: 140pt, margin: 10pt)\n\
                    Esta es una frase bastante larga que tiene que partirse en varias lineas de la pagina estrecha.";
        let f = fixture(&[("main.typ", text)]);
        let (from, to) = utf16_of(text, "frase bastante larga que tiene que partirse");

        let rects = f.map.reveal("main.typ", from, to);

        assert!(rects.len() >= 2, "debía partirse en varias líneas: {rects:?}");
        assert!(rects.windows(2).all(|w| w[1].y_pt > w[0].y_pt), "una caja por línea, de arriba abajo");
    }

    #[test]
    fn dos_columnas_no_mezclan_las_cajas_de_una_frase() {
        let text = "#set page(width: 200pt, height: 120pt, columns: 2, margin: 10pt)\n\
                    Primera columna llena de texto que sigue y sigue hasta rebosar la altura de la pagina \
                    y pasar a la segunda columna donde continua el parrafo entero sin cortarse nunca mas.";
        let f = fixture(&[("main.typ", text)]);
        let (from, to) = utf16_of(text, "Primera columna");
        let rects = f.map.reveal("main.typ", from, to);
        // Ida y vuelta de una palabra de la segunda columna.
        let (w_from, w_to) = utf16_of(text, "continua");
        let word = f.map.reveal("main.typ", w_from, w_to)[0];

        let (x, y) = center(&word);
        let located = f.map.locate(1, x, y).unwrap();

        assert_eq!(covered(&f, &located), "continua");
        assert!(!rects.is_empty());
    }

    #[test]
    fn una_referencia_responde_con_lo_escrito_no_con_el_destino() {
        let text = "#set heading(numbering: \"1.\")\n= Introduccion <intro>\nComo se vio en @intro, todo encaja.";
        let f = fixture(&[("main.typ", text)]);
        let (from, to) = utf16_of(text, "@intro");
        let rects = f.map.reveal("main.typ", from, to);

        // El texto de la referencia ("Sección 1") se compone del destino.
        assert!(!rects.is_empty(), "la referencia debe tener caja en la página");
        let (x, y) = center(&rects[0]);
        let located = f.map.locate(1, x, y).unwrap();

        assert_eq!(covered(&f, &located), "@intro");
    }

    #[test]
    fn la_numeracion_de_un_encabezado_responde_con_el_encabezado() {
        let text = "#set heading(numbering: \"1.\")\n= Titulo del capitulo\nTexto.";
        let f = fixture(&[("main.typ", text)]);
        // La caja del texto del título, y a su izquierda el "1." generado.
        let (from, to) = utf16_of(text, "Titulo");
        let title = f.map.reveal("main.typ", from, to)[0];

        let located = f.map.locate(1, title.x_pt - 12.0, title.y_pt + title.h_pt * 0.6);

        // El número generado no tiene fuente propio: lleva al encabezado (línea 2).
        let located = located.expect("el número debe resolver al encabezado");
        assert_eq!(located.start_line, 2);
    }

    #[test]
    fn una_ecuacion_resuelve_a_nivel_de_simbolo() {
        let text = "Sea $ x^2 + y $ la ecuacion.";
        let f = fixture(&[("main.typ", text)]);
        let (from, to) = utf16_of(text, "y");
        // La `y` dentro de `$ … $` (la primera `y` del texto es la de `y`, no la de "ecuacion").
        let rects = f.map.reveal("main.typ", from, to);
        assert!(!rects.is_empty());

        let (x, y) = center(&rects[0]);
        let located = f.map.locate(1, x, y).unwrap();

        assert_eq!(covered(&f, &located), "y");
    }

    #[test]
    fn el_texto_de_una_nota_al_pie_apunta_a_la_nota() {
        let text = "Cuerpo del texto#footnote[Contenido de la nota] y mas cuerpo.";
        let f = fixture(&[("main.typ", text)]);
        let (from, to) = utf16_of(text, "Contenido");
        let rects = f.map.reveal("main.typ", from, to);
        assert!(!rects.is_empty(), "la nota se dibuja al pie de la página");

        // Hay una caja en el cuerpo (el marcador) solo si el rango cubre la nota
        // entera; para la palabra "Contenido" la única caja es la del pie.
        let bottom = rects.last().unwrap();
        assert!(bottom.y_pt > 700.0, "la nota se dibuja al pie de la página: {bottom:?}");

        let (x, y) = center(bottom);
        let located = f.map.locate(1, x, y).unwrap();

        assert_eq!(covered(&f, &located), "Contenido");
    }

    #[test]
    fn el_texto_girado_se_resuelve_por_su_caja_envolvente() {
        let text = "#rotate(90deg)[Girado]";
        let f = fixture(&[("main.typ", text)]);
        let (from, to) = utf16_of(text, "Girado");
        let rects = f.map.reveal("main.typ", from, to);
        assert!(!rects.is_empty(), "el texto girado también tiene caja");

        let (x, y) = center(&rects[0]);
        let located = f.map.locate(1, x, y).unwrap();

        assert_eq!(covered(&f, &located), "Girado");
    }

    #[test]
    fn el_texto_de_derecha_a_izquierda_vuelve_a_su_palabra() {
        let text = "#set text(lang: \"he\")\nשלום עולם";
        let f = fixture(&[("main.typ", text)]);
        let (from, to) = utf16_of(text, "עולם");
        let rects = f.map.reveal("main.typ", from, to);
        assert!(!rects.is_empty());

        let (x, y) = center(&rects[0]);
        let located = f.map.locate(1, x, y).unwrap();

        assert_eq!(covered(&f, &located), "עולם");
    }

    #[test]
    fn una_forma_con_relleno_responde_con_su_elemento() {
        let text = "#rect(width: 60pt, height: 20pt, fill: red)";
        let f = fixture(&[("main.typ", text)]);

        // El margen por defecto de una página A4 es de ≈ 70,9 pt: el rectángulo
        // ocupa de (70,9; 70,9) a (130,9; 90,9).
        let located = f.map.locate(1, 100.0, 80.0).expect("la forma debe resolver");
        assert_eq!(located.start_line, 1);
        // El nodo de la llamada no incluye el `#` que la introduce.
        assert_eq!(covered(&f, &located), &text[1..]);
    }

    #[test]
    fn un_punto_donde_no_hay_nada_no_resuelve() {
        let f = fixture(&[("main.typ", "Hola.")]);
        let (width, height) = f.pages[0];

        assert!(f.map.locate(1, width - 2.0, height - 2.0).is_none());
    }

    #[test]
    fn una_pagina_que_no_existe_no_resuelve_ni_da_error() {
        let f = fixture(&[("main.typ", "Hola.")]);

        assert!(f.map.locate(0, 10.0, 10.0).is_none());
        assert!(f.map.locate(9, 10.0, 10.0).is_none());
    }

    #[test]
    fn revelar_un_fichero_que_no_esta_en_el_mapa_da_una_lista_vacia() {
        let f = fixture(&[("main.typ", "Hola.")]);

        assert!(f.map.reveal("otro.typ", 0, 3).is_empty());
    }

    #[test]
    fn un_rango_que_no_produjo_texto_dibujado_no_da_cajas() {
        let text = "// solo un comentario\nHola.";
        let f = fixture(&[("main.typ", text)]);
        let (from, to) = utf16_of(text, "solo un comentario");

        assert!(f.map.reveal("main.typ", from, to).is_empty());
    }

    #[test]
    fn las_paginas_siguientes_tienen_su_propio_indice() {
        let text = "Primera.\n#pagebreak()\nSegunda pagina.";
        let f = fixture(&[("main.typ", text)]);
        let (from, to) = utf16_of(text, "Segunda");
        let rect = f.map.reveal("main.typ", from, to)[0];

        assert_eq!(rect.page, 2);
        let (x, y) = center(&rect);
        assert!(f.map.locate(1, x, y).is_none() || covered(&f, &f.map.locate(1, x, y).unwrap()) != "Segunda");
        assert_eq!(covered(&f, &f.map.locate(2, x, y).unwrap()), "Segunda");
    }

    #[test]
    fn word_range_extiende_a_la_palabra_y_deja_la_puntuacion_sola() {
        let text = "hola, mundo_1!";
        assert_eq!(word_range(text, 1), (0, 4));
        assert_eq!(word_range(text, 4), (4, 5), "la coma es un solo carácter");
        assert_eq!(word_range(text, 8), (6, 13), "el guion bajo y las cifras son de la palabra");
    }

    #[test]
    fn word_range_no_rompe_un_caracter_multibyte() {
        let text = "ñandú";
        assert_eq!(word_range(text, 1), (0, text.len()), "el byte 1 cae dentro de la ñ");
    }

    #[test]
    fn word_at_cursor_prefiere_la_palabra_que_termina_en_el_cursor() {
        assert_eq!(word_at_cursor("uno dos", 3), (0, 3));
        assert_eq!(word_at_cursor("uno dos", 4), (4, 7));
        assert_eq!(word_at_cursor("a  b", 2), (2, 2), "entre dos espacios no hay palabra");
    }

    #[test]
    fn merge_lines_une_solo_lo_que_esta_en_la_misma_linea() {
        let cell = |x: f32, y: f32| Cell { page: 1, x, y, w: 5.0, h: 10.0, file: dummy_id(), start: 0, len: 1, whole: false };
        let cells = [cell(0.0, 0.0), cell(5.0, 0.0), cell(10.0, 0.0), cell(0.0, 20.0), cell(5.0, 20.0)];

        let rects = merge_lines(cells.iter());

        assert_eq!(rects.len(), 2);
        assert_eq!((rects[0].x_pt, rects[0].w_pt), (0.0, 15.0));
        assert_eq!(rects[1].y_pt, 20.0);
    }

    fn dummy_id() -> FileId {
        typst::syntax::RootedPath::new(
            typst::syntax::VirtualRoot::Project,
            typst::syntax::VirtualPath::new("x.typ").unwrap(),
        )
        .intern()
    }

}
