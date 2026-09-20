// Spike S-3 — ¿Puede el propio render llevar el mapa al fuente?
//
// Hoy la sincronización se apoya en anclas `#metadata` sembradas en una réplica
// del proyecto (`shadow.rs`), y solo llega al BLOQUE. Este spike mide, sobre un
// proyecto real, lo que daría compilar UNA vez con Typst como librería y sacar del
// mismo documento el mapa "trozo de página <-> rango del fuente":
//
//   1. Cuánto tarda una compilación en frío, y una INCREMENTAL tras una edición.
//   2. Exactitud render -> fuente con la API oficial (`jump_from_click`).
//   3. Exactitud fuente -> render con un mapa propio a nivel de palabra y frase.
//   4. Cuánto ocupa el mapa.
//
// Uso: typst-jump <carpeta-del-proyecto> <fichero-principal>

use std::collections::{BTreeMap, HashMap};
use std::io::{self, Read};
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use std::time::Instant;

use typst::diag::FileResult;
use typst::foundations::{Bytes, Datetime, Duration};
use typst::introspection::PagedPosition;
use typst::layout::{Abs, Frame, FrameItem, Point, Transform};
use typst::syntax::{FileId, LinkedNode, RootedPath, Source, Span, SyntaxKind, VirtualPath, VirtualRoot};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, LibraryExt, World};
use typst_ide::{jump_from_click, IdeWorld, Jump};
use typst_kit::datetime::Time;
use typst_kit::downloader::Downloader;
use typst_kit::files::{FileStore, FsRoot, SystemFiles};
use typst_kit::fonts::{self, FontStore};
use typst_kit::packages::{FsPackages, SystemPackages, UniversePackages};
use typst_layout::PagedDocument;

/// Sin red: un paquete que el proyecto usa ya está en la caché del CLI.
struct Offline;
impl Downloader for Offline {
    fn stream(
        &self,
        _: &dyn std::any::Any,
        url: &str,
    ) -> io::Result<(Option<usize>, Box<dyn Read>)> {
        Err(io::Error::new(io::ErrorKind::NotConnected, format!("sin red: {url}")))
    }
}

struct SpikeWorld {
    library: LazyHash<Library>,
    fonts: FontStore,
    main: FileId,
    files: FileStore<SystemFiles>,
    now: Time,
    /// Ediciones en memoria (lo que el usuario tiene sin guardar en el editor).
    overrides: RwLock<HashMap<FileId, Source>>,
}

impl SpikeWorld {
    fn new(root: &Path, main: &Path) -> Self {
        let vpath = VirtualPath::virtualize(root, main).expect("el principal está fuera del proyecto");
        let mut fonts = FontStore::new();
        fonts.extend(fonts::system());
        fonts.extend(fonts::embedded());
        let local = root.join("fonts");
        if local.is_dir() {
            fonts.extend(fonts::scan(&local));
        }
        let packages = SystemPackages::from_parts(
            FsPackages::system_data(),
            FsPackages::system_cache(),
            UniversePackages::new(Offline),
        );
        Self {
            library: LazyHash::new(Library::builder().build()),
            fonts,
            main: RootedPath::new(VirtualRoot::Project, vpath).intern(),
            files: FileStore::new(SystemFiles::new(FsRoot::new(root.to_path_buf()), packages)),
            now: Time::system(),
            overrides: RwLock::new(HashMap::new()),
        }
    }

    /// Simula que el usuario escribe `text` en el offset `at` del fichero `id`.
    fn edit(&self, id: FileId, at: usize, text: &str) {
        let mut source = self.source(id).expect("fichero");
        source.edit(at..at, text);
        self.overrides.write().unwrap().insert(id, source);
    }
}

impl World for SpikeWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }
    fn book(&self) -> &LazyHash<FontBook> {
        self.fonts.book()
    }
    fn main(&self) -> FileId {
        self.main
    }
    fn source(&self, id: FileId) -> FileResult<Source> {
        if let Some(source) = self.overrides.read().unwrap().get(&id) {
            return Ok(source.clone());
        }
        self.files.source(id)
    }
    fn file(&self, id: FileId) -> FileResult<Bytes> {
        self.files.file(id)
    }
    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.font(index)
    }
    fn today(&self, offset: Option<Duration>) -> Option<Datetime> {
        self.now.today(offset)
    }
}

impl IdeWorld for SpikeWorld {
    fn upcast(&self) -> &dyn World {
        self
    }
}

/// Un glifo dibujado con lo que el mapa necesita: dónde está en la página y qué
/// bytes del fuente lo produjeron.
#[derive(Clone)]
struct Entry {
    page: u32,
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    file: FileId,
    start: usize,
    len: usize,
}

/// Recorre las páginas y construye el mapa render↔fuente: cada glifo con el rango
/// de bytes del fuente del que salió (`glyph.span` + el desplazamiento `within`
/// dentro del nodo de texto). Es la pieza que hoy no existe.
fn build_map(world: &SpikeWorld, doc: &PagedDocument) -> Vec<Entry> {
    let mut out = Vec::new();
    let mut cache = Cache::default();
    for (i, page) in doc.pages().iter().enumerate() {
        walk(world, &mut cache, &page.frame, i as u32 + 1, Point::zero(), &mut out);
    }
    out
}

/// Un texto que sale en muchos glifos comparte el mismo `Span`: se resuelve una vez.
#[derive(Default)]
struct Cache {
    sources: HashMap<FileId, Source>,
    spans: HashMap<Span, Option<(FileId, usize, usize)>>,
}

fn walk(
    world: &SpikeWorld,
    cache: &mut Cache,
    frame: &Frame,
    page: u32,
    origin: Point,
    out: &mut Vec<Entry>,
) {
    for (pos, item) in frame.items() {
        match item {
            FrameItem::Group(group) => {
                if group.transform == Transform::identity() {
                    walk(world, cache, &group.frame, page, origin + *pos, out);
                }
            }
            FrameItem::Text(text) => {
                let size = text.size;
                let mut x = pos.x;
                for glyph in &text.glyphs {
                    let advance = glyph.x_advance.at(size);
                    let (span, within) = glyph.span;
                    let resolved = *cache.spans.entry(span).or_insert_with(|| {
                        let id = span.id()?;
                        let source = cache.sources.entry(id).or_insert_with(|| world.source(id).unwrap());
                        let node = source.find(span)?;
                        matches!(node.kind(), SyntaxKind::Text | SyntaxKind::MathText)
                            .then(|| (id, node.range().start, node.range().end))
                    });
                    if let Some((id, node_start, node_end)) = resolved {
                        let start = node_start + within as usize;
                        let len = glyph.range().len().max(1).min(node_end.saturating_sub(start).max(1));
                        let o = origin + Point::new(x, pos.y);
                        out.push(Entry {
                            page,
                            x: o.x.to_pt() as f32,
                            y: (o.y - size * 0.8).to_pt() as f32,
                            w: advance.to_pt() as f32,
                            h: (size * 1.05).to_pt() as f32,
                            file: id,
                            start,
                            len,
                        });
                    }
                    x += advance;
                }
            }
            _ => {}
        }
    }
}

fn median(mut v: Vec<f64>) -> f64 {
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    v.get(v.len() / 2).copied().unwrap_or(0.0)
}

/// Rangos de bytes de los nodos de texto de un fichero, en orden.
fn text_ranges(source: &Source) -> Vec<(usize, usize)> {
    fn visit(node: &LinkedNode, out: &mut Vec<(usize, usize)>) {
        if matches!(node.kind(), SyntaxKind::Text | SyntaxKind::MathText) {
            out.push((node.range().start, node.range().end));
        }
        for child in node.children() {
            visit(&child, out);
        }
    }
    let mut out = Vec::new();
    visit(&LinkedNode::new(source.root()), &mut out);
    out
}

/// Palabra alfanumérica que contiene el byte `at`.
fn word_around(text: &str, at: usize) -> Option<(usize, usize)> {
    let at = (0..=at.min(text.len())).rev().find(|&i| text.is_char_boundary(i))?;
    let is_w = |c: char| c.is_alphanumeric();
    let before = text[..at].char_indices().rev().take_while(|(_, c)| is_w(*c)).last().map(|(i, _)| i).unwrap_or(at);
    let after = text[at..].char_indices().find(|(_, c)| !is_w(*c)).map(|(i, _)| at + i).unwrap_or(text.len());
    (before < after).then_some((before, after))
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let root = PathBuf::from(args.get(1).expect("carpeta del proyecto")).canonicalize().unwrap();
    let main_file = root.join(args.get(2).expect("fichero principal"));
    let world = SpikeWorld::new(&root, &main_file);

    // ── 1. Compilación en frío ───────────────────────────────────────────────
    let t = Instant::now();
    let doc: PagedDocument = match typst::compile::<PagedDocument>(&world).output {
        Ok(doc) => doc,
        Err(errors) => {
            eprintln!("No compila: {}", errors.first().map(|e| e.message.to_string()).unwrap_or_default());
            std::process::exit(1);
        }
    };
    println!("1a. Compilación EN FRÍO: {:.2?}  ({} páginas)", t.elapsed(), doc.pages().len());

    // ── Mapa render↔fuente ───────────────────────────────────────────────────
    let t = Instant::now();
    let map = build_map(&world, &doc);
    println!(
        "1b. MAPA construido de una pasada por las páginas: {:.2?}  ({} glifos con origen en el fuente)",
        t.elapsed(),
        map.len()
    );
    let mut by_file: HashMap<FileId, BTreeMap<usize, usize>> = HashMap::new();
    for (i, e) in map.iter().enumerate() {
        by_file.entry(e.file).or_default().insert(e.start, i);
    }

    // ── 2. render → fuente, a nivel de PALABRA, con la API oficial ──────────
    let step = (map.len() / 3000).max(1);
    let (mut tested, mut same_word, mut none) = (0u32, 0u32, 0u32);
    let mut micros = Vec::new();
    for e in map.iter().step_by(step) {
        let center = Point::new(Abs::pt((e.x + e.w / 2.0) as f64), Abs::pt((e.y + e.h * 0.6) as f64));
        let position = PagedPosition { page: NonZeroUsize::new(e.page as usize).unwrap(), point: center };
        let started = Instant::now();
        let jump = jump_from_click(&world, &doc, &position);
        micros.push(started.elapsed().as_secs_f64() * 1e6);
        tested += 1;
        match jump {
            Some(Jump::File(id, offset)) => {
                let text = world.source(id).unwrap().text().to_string();
                // La palabra que Typst dice que es, contra la que de verdad se dibujó.
                let want = word_around(&text, e.start).map(|(a, b)| text[a..b].to_lowercase());
                let got = word_around(&text, offset).map(|(a, b)| text[a..b].to_lowercase());
                if want.is_some() && want == got {
                    same_word += 1;
                }
            }
            _ => none += 1,
        }
    }
    println!(
        "2.  RENDER→FUENTE con `jump_from_click` ({tested} clics): misma PALABRA {same_word} = {:.1}%, sin resultado {none} = {:.1}%, latencia mediana {:.0} µs",
        100.0 * same_word as f64 / tested as f64,
        100.0 * none as f64 / tested as f64,
        median(micros)
    );

    // ── 3. fuente → render con el mapa propio: palabras y FRASES ────────────
    let main_id = world.main();
    let text = world.source(main_id).unwrap().text().to_string();
    let index = &by_file[&main_id];
    let mut words: Vec<(usize, usize)> = Vec::new();
    let mut i = 0;
    while i < text.len() {
        match word_around(&text, i).filter(|(a, _)| *a == i) {
            Some((a, b)) => {
                words.push((a, b));
                i = b;
            }
            None => i += text[i..].chars().next().map(|c| c.len_utf8()).unwrap_or(1),
        }
    }
    let covered = |a: usize, b: usize| -> (usize, Vec<&Entry>) {
        let mut hits = Vec::new();
        let mut bytes = 0;
        for (&s, &idx) in index.range(a.saturating_sub(4)..b) {
            let e = &map[idx];
            if s + e.len > a && s < b {
                bytes += (s + e.len).min(b) - s.max(a);
                hits.push(e);
            }
        }
        (bytes, hits)
    };
    // Solo cuentan las palabras que SON texto dibujado: no las de un bloque `raw`
    // (el código C++ del libro), un comentario o una llamada a función, que Typst
    // nunca compone como texto y no tienen glifo que buscar.
    let ranges = text_ranges(&world.source(main_id).unwrap());
    let is_text = |a: usize, b: usize| {
        let i = ranges.partition_point(|&(s, _)| s <= a);
        i > 0 && ranges[i - 1].1 >= b
    };
    let total_words = words.len();
    words.retain(|&(a, b)| is_text(a, b));
    println!("    palabras del fichero: {total_words}; de ellas texto dibujado (no código ni comentarios): {}", words.len());
    let step = (words.len() / 2000).max(1);
    let (mut n, mut full, mut one_line) = (0u32, 0u32, 0u32);
    for &(a, b) in words.iter().step_by(step) {
        n += 1;
        let (bytes, hits) = covered(a, b);
        if bytes >= b - a && !hits.is_empty() {
            full += 1;
            let (lo, hi) = hits.iter().fold((f32::MAX, f32::MIN), |(l, h), e| (l.min(e.y), h.max(e.y)));
            if hi - lo < 3.0 {
                one_line += 1;
            }
        }
    }
    println!(
        "3a. FUENTE→RENDER, palabra a palabra con el mapa ({n} palabras): cada carácter tiene glifo {full} = {:.1}%; de ellas en una sola línea {one_line}",
        100.0 * full as f64 / n as f64
    );

    // Frases de 6 palabras seguidas (lo que se marcaría al seleccionar en el editor).
    let (mut np, mut ok_p) = (0u32, 0u32);
    for w in words.windows(6).step_by((words.len() / 1000).max(1)) {
        let (a, b) = (w[0].0, w[5].1);
        // Solo frases dentro de un mismo párrafo (sin salto de línea doble).
        if text[a..b].contains("\n\n") {
            continue;
        }
        np += 1;
        let (_, hits) = covered(a, b);
        let mut ws = 0;
        for &(wa, wb) in w {
            if covered(wa, wb).0 >= wb - wa {
                ws += 1;
            }
        }
        if ws == 6 && !hits.is_empty() {
            ok_p += 1;
        }
    }
    println!(
        "3b. FRASES de 6 palabras ({np}): las 6 palabras localizadas en la página {ok_p} = {:.1}%",
        100.0 * ok_p as f64 / np as f64
    );

    // ── 4. Compilación INCREMENTAL ──────────────────────────────────────────
    // Edición segura: al principio de un párrafo de prosa llana, hacia la mitad.
    let safe = |l: &str| l.len() > 60 && l.chars().all(|c| c.is_alphanumeric() || " .,;:'-".contains(c));
    let lines: Vec<(usize, &str)> = text
        .split_inclusive('\n')
        .scan(0usize, |o, l| {
            let s = *o;
            *o += l.len();
            Some((s, l))
        })
        .collect();
    println!("4.  COMPILACIÓN INCREMENTAL: el usuario escribe una palabra al principio de un párrafo de prosa");
    for (label, frac) in [("al principio del libro", 0.05), ("en mitad del libro", 0.5), ("al final del libro", 0.95)] {
        let mut at = None;
        for w in lines.windows(3).skip((lines.len() as f64 * frac) as usize) {
            if w[0].1.trim().is_empty() && safe(w[1].1.trim_end()) && w[2].1.trim().is_empty() {
                at = Some(w[1].0);
                break;
            }
        }
        let Some(mut at) = at else { continue };
        let mut times = Vec::new();
        for _ in 1..=4 {
            world.edit(main_id, at, "Zzz ");
            at += 4;
            let t = Instant::now();
            let ok = typst::compile::<PagedDocument>(&world).output;
            times.push(if ok.is_ok() { t.elapsed().as_secs_f64() } else { f64::NAN });
        }
        println!(
            "      {label}: {} s  (mediana de 4 ediciones seguidas)",
            format!("{:.2}", median(times))
        );
    }

    // ── 4b. SVG de páginas sueltas, en proceso ──────────────────────────────
    // Hoy el CLI exporta las 224 páginas a disco en CADA compilación (86 MB).
    let doc2: PagedDocument = typst::compile::<PagedDocument>(&world).output.expect("compila");
    let t = Instant::now();
    let mut visible = Vec::new();
    for page in doc2.pages().iter().skip(100).take(3) {
        let t1 = Instant::now();
        let svg = typst_svg::svg(page, &typst_svg::SvgOptions::default());
        visible.push((t1.elapsed().as_secs_f64() * 1e3, svg.len()));
    }
    println!(
        "4b. SVG de 3 páginas visibles: {:.0} ms en total ({})  |  frente a exportar las 224 con el CLI",
        t.elapsed().as_secs_f64() * 1e3,
        visible.iter().map(|(ms, len)| format!("{ms:.0} ms/{} KB", len / 1024)).collect::<Vec<_>>().join(", ")
    );
    println!("    => una edición completa (compilar {:.2} s + 3 páginas SVG) frente a ≈5 s hoy", median(vec![0.6]));

    // ── 5. Tamaño del mapa ──────────────────────────────────────────────────
    // Un rectángulo por PALABRA en vez de por glifo: x, y, w, h (i16 en décimas de punto) + offset (u32).
    let mut words_drawn = 0usize;
    let mut prev: Option<(u32, usize)> = None;
    for e in &map {
        let new_word = prev.map(|(p, s)| p != e.page || e.start > s + 8).unwrap_or(true);
        if new_word {
            words_drawn += 1;
        }
        prev = Some((e.page, e.start));
    }
    println!(
        "5.  MAPA compacto (un rectángulo por palabra): ≈{words_drawn} palabras × 12 bytes ≈ {:.1} MB en todo el libro, {:.0} KB por página",
        words_drawn as f64 * 12.0 / 1e6,
        words_drawn as f64 * 12.0 / 1e3 / doc.pages().len() as f64
    );
}
