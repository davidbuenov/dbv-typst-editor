// Spike S-1 — banco de pruebas de migración LaTeX → Typst con Tylax 0.3.7
// Uso: cargo run -- <fichero.tex | carpeta-del-proyecto>
//
// Mide lo que decide el informe LATEX_MIGRATION_RESEARCH.md:
//   · qué detecta del proyecto (clase, paquetes, ficheros, bibliografía, figuras)
//   · qué diagnósticos da el motor, con línea y sugerencia
//   · si resuelve él los \input/\include o lo tenemos que hacer nosotros
//   · qué Typst produce (para intentar compilarlo después con nuestro 0.15.1)

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use tylax::diagnostics::{check_latex, DiagnosticLevel};
use tylax::files::find_latex_includes;

fn main() {
    let arg = std::env::args().nth(1).expect("uso: spike-s1 <fichero.tex|carpeta>");
    let target = PathBuf::from(&arg);

    let (main_file, project_dir) = if target.is_dir() {
        (find_main_tex(&target), target.clone())
    } else {
        (Some(target.clone()), target.parent().unwrap_or(Path::new(".")).to_path_buf())
    };

    let Some(main_file) = main_file else {
        println!("❌ No se ha encontrado ningún .tex con \\documentclass en {}", project_dir.display());
        return;
    };

    let source = fs::read_to_string(&main_file).expect("no se puede leer el fichero principal");

    println!("═══════════════════════════════════════════════════════════════");
    println!(" PROYECTO   {}", project_dir.display());
    println!(" PRINCIPAL  {}", main_file.file_name().unwrap().to_string_lossy());
    println!("═══════════════════════════════════════════════════════════════\n");

    // ── 1. Inventario del proyecto ───────────────────────────────────────
    let inventory = inventory(&project_dir);
    println!("── INVENTARIO ─────────────────────────────────────────────────");
    println!("  .tex          {}", inventory.tex);
    println!("  .bib          {}", inventory.bib);
    println!("  figuras       {} (pdf {}, eps {}, png/jpg {}, svg {})",
        inventory.fig_total, inventory.pdf, inventory.eps, inventory.raster, inventory.svg);
    println!("  fuentes       {}", inventory.fonts);

    // ── 2. Identidad: clase y paquetes ───────────────────────────────────
    let class = extract_braced(&source, "\\documentclass");
    let packages = extract_packages(&source);
    println!("\n── IDENTIDAD ──────────────────────────────────────────────────");
    println!("  \\documentclass  {}", class.as_deref().unwrap_or("(no encontrada)"));
    println!("  \\usepackage     {} distintos", packages.len());
    if !packages.is_empty() {
        println!("     {}", packages.iter().cloned().collect::<Vec<_>>().join(", "));
    }

    // ── 3. Multi-fichero: ¿lo resuelve Tylax? ────────────────────────────
    let includes = find_latex_includes(&source);
    println!("\n── MULTI-FICHERO ──────────────────────────────────────────────");
    println!("  \\input/\\include detectados por Tylax: {}", includes.len());
    for (_, _, cmd) in includes.iter().take(12) {
        println!("     → {}", cmd.path());
    }

    // ── 4. Diagnósticos del motor ────────────────────────────────────────
    let check = check_latex(&source);
    println!("\n── DIAGNÓSTICOS DEL MOTOR ─────────────────────────────────────");
    println!("  errores {} · avisos {} · info {}", check.errors, check.warnings, check.infos);

    let mut shown = 0;
    for diag in &check.diagnostics {
        if diag.level == DiagnosticLevel::Info || shown >= 15 {
            continue;
        }
        shown += 1;
        let loc = diag.line.map(|l| format!("línea {l}")).unwrap_or_else(|| "sin línea".into());
        println!("  [{}] {} — {}", diag.level, loc, diag.message);
        if let Some(s) = &diag.suggestion {
            println!("        sugerencia: {s}");
        }
    }
    let con_linea = check.diagnostics.iter().filter(|d| d.line.is_some()).count();
    let con_sugerencia = check.diagnostics.iter().filter(|d| d.suggestion.is_some()).count();
    println!("  → con línea: {}/{} · con sugerencia: {}/{}",
        con_linea, check.diagnostics.len(), con_sugerencia, check.diagnostics.len());

    // ── 5. Conversión, con reparación a ambos lados ──────────────────────
    // Es el hallazgo del spike: Tylax solo no produce un documento que
    // compile. La conversión tiene que ser un BUCLE (pre → convertir →
    // post → compilar → verificar), no un paso.
    let (pre, pre_fixes) = prepass(&source);
    let raw = tylax::latex_document_to_typst(&pre);
    let bib = first_bib(&project_dir);
    let (typst, post_fixes) = postpass(&raw, bib.as_deref());

    if !pre_fixes.is_empty() || !post_fixes.is_empty() {
        println!("\n── REPARACIONES APLICADAS ─────────────────────────────────────");
        for f in pre_fixes.iter().chain(post_fixes.iter()) {
            println!("  · {f}");
        }
    }

    let out = project_dir.join("_spike_salida.typ");
    fs::write(&out, &typst).expect("no se puede escribir la salida");

    let src_lines = source.lines().count();
    let out_lines = typst.lines().count();
    let leftover = count_leftover_latex(&typst);

    println!("\n── CONVERSIÓN ─────────────────────────────────────────────────");
    println!("  entrada       {src_lines} líneas");
    println!("  salida        {out_lines} líneas → {}", out.display());
    println!("  restos LaTeX  {leftover} secuencias \\comando sin convertir");
    println!("\n  Primeras 25 líneas del resultado:");
    println!("  ┌─────────────────────────────────────────────────────────────");
    for line in typst.lines().take(25) {
        println!("  │ {line}");
    }
    println!("  └─────────────────────────────────────────────────────────────");
}

// ─────────────────────────────────────────────────────────────────────────
// Reparaciones. Cada una nace de un fallo REAL observado en un proyecto real.

/// Antes de convertir: neutraliza patrones que hacen que Tylax pierda datos.
fn prepass(latex: &str) -> (String, Vec<String>) {
    let mut fixes = Vec::new();
    let mut out = latex.to_string();

    // Tylax 0.3.7 convierte `\section*{Texto}` en `== *` y baja el texto a la
    // línea siguiente: el título deja de ser encabezado (desaparece del
    // esquema) y el `*` suelto es un delimitador sin cerrar que Typst rechaza.
    // Quitar el asterisco cuesta solo la supresión de numeración; conservarlo
    // cuesta la estructura del documento Y la compilación.
    for cmd in ["subsubsection", "subsection", "section"] {
        let starred = format!("\\{cmd}*{{");
        let plain = format!("\\{cmd}{{");
        let hits = out.matches(&starred).count();
        if hits > 0 {
            out = out.replace(&starred, &plain);
            fixes.push(format!(
                "{hits}× \\{cmd}*{{...}} → \\{cmd}{{...}} (Tylax perdía el título; se pierde solo la supresión de numeración)"
            ));
        }
    }
    (out, fixes)
}

/// Después de convertir: repara lo que el motor deja sin conectar.
fn postpass(typst: &str, bib: Option<&str>) -> (String, Vec<String>) {
    let mut fixes = Vec::new();
    let mut lines: Vec<String> = typst.lines().map(str::to_string).collect();

    // Tylax vuelca `\bibliographystyle`/`\bibliography` como comentarios y
    // además estropea el nombre del estilo (`IEEEtran_Jenui` → `IEEEtran_(J)enui`,
    // subrayado sin cerrar). La bibliografía queda desconectada pese a que el
    // `.bib` está ahí al lado y Typst lo lee nativamente.
    if let Some(bib) = bib {
        for line in lines.iter_mut() {
            if line.contains("\\bibliography") || line.contains("/* \\bibliographystyle */") {
                *line = format!("#bibliography(\"{bib}\", style: \"ieee\")");
                fixes.push(format!(
                    "bibliografía reconectada → #bibliography(\"{bib}\") (el .bib migra intacto; el .bst NO tiene equivalente: se mapea a un estilo CSL)"
                ));
                break;
            }
        }
    }

    // En Typst `@clave` es una CITA. Un correo (`david.bueno@uma.es`) se
    // convierte por tanto en una referencia a una etiqueta inexistente y el
    // documento no compila. Afecta a casi cualquier artículo académico, que
    // lleva los correos de los autores en la cabecera.
    // Discriminante: se escapa la arroba cuando el carácter anterior es parte
    // de un nombre o de un correo compartido entre autores — `}` y `)` cubren
    // ese segundo caso, `{jmgn,eva}@lcc.uma.es` (hallado en el proyecto 3).
    // Todo lo demás (espacio, principio de línea...) se deja tal cual: ahí sí
    // puede ser una cita real.
    let mut emails = 0;
    let joined = lines.join("\n");
    let mut repaired = String::with_capacity(joined.len());
    let mut prev: Option<char> = None;
    for c in joined.chars() {
        if c == '@' && matches!(prev, Some(p) if p.is_alphanumeric() || matches!(p, '.' | '_' | '-' | '}' | ')' | ']')) {
            repaired.push('\\'); // escapa la arroba: deja de ser una cita
            emails += 1;
        }
        repaired.push(c);
        prev = Some(c);
    }
    if emails > 0 {
        fixes.push(format!(
            "{emails}× arroba escapada en correos (en Typst `@algo` es una cita: sin esto el documento no compila)"
        ));
    }

    (repaired, fixes)
}

fn first_bib(dir: &Path) -> Option<String> {
    let mut found = None;
    walk(dir, &mut |path| {
        if found.is_none() && path.extension().and_then(|e| e.to_str()) == Some("bib") {
            found = path.file_name().map(|n| n.to_string_lossy().to_string());
        }
    });
    found
}

struct Inventory {
    tex: usize,
    bib: usize,
    fig_total: usize,
    pdf: usize,
    eps: usize,
    raster: usize,
    svg: usize,
    fonts: usize,
}

fn inventory(dir: &Path) -> Inventory {
    let mut inv = Inventory { tex: 0, bib: 0, fig_total: 0, pdf: 0, eps: 0, raster: 0, svg: 0, fonts: 0 };
    walk(dir, &mut |path| {
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
        match ext.as_str() {
            "tex" => inv.tex += 1,
            "bib" => inv.bib += 1,
            "pdf" => { inv.pdf += 1; inv.fig_total += 1; }
            "eps" | "ps" => { inv.eps += 1; inv.fig_total += 1; }
            "png" | "jpg" | "jpeg" | "gif" | "webp" => { inv.raster += 1; inv.fig_total += 1; }
            "svg" => { inv.svg += 1; inv.fig_total += 1; }
            "ttf" | "otf" | "ttc" => inv.fonts += 1,
            _ => {}
        }
    });
    inv
}

fn walk(dir: &Path, visit: &mut impl FnMut(&Path)) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "node_modules" {
            continue;
        }
        if path.is_dir() {
            walk(&path, visit);
        } else {
            visit(&path);
        }
    }
}

/// Fichero de la raíz que contiene `\documentclass` — misma heurística que Overleaf.
fn find_main_tex(dir: &Path) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("tex") {
                if let Ok(text) = fs::read_to_string(&path) {
                    if text.contains("\\documentclass") {
                        candidates.push(path);
                    }
                }
            }
        }
    }
    // `main.tex` gana si existe; si no, el primero por orden alfabético.
    candidates.sort();
    candidates
        .iter()
        .find(|p| p.file_name().and_then(|n| n.to_str()) == Some("main.tex"))
        .cloned()
        .or_else(|| candidates.first().cloned())
}

/// Contenido entre `{` y `}` que sigue a la posición `at` de `source`, como
/// rango absoluto. Único sitio que sabe buscar llaves tras un comando: antes
/// `extract_braced` y `extract_packages` lo hacían cada una a su manera, con
/// el manejo de bordes ligeramente distinto entre ellas.
fn braced_after(source: &str, at: usize) -> Option<(usize, usize)> {
    let rest = &source[at..];
    let open = rest.find('{')?;
    let close = rest[open..].find('}')?;
    Some((at + open + 1, at + open + close))
}

fn extract_braced(source: &str, command: &str) -> Option<String> {
    let at = source.find(command)?;
    let (start, end) = braced_after(source, at)?;
    Some(source[start..end].trim().to_string())
}

fn extract_packages(source: &str) -> BTreeSet<String> {
    let mut found = BTreeSet::new();
    for (at, _) in source.match_indices("\\usepackage") {
        let Some((start, end)) = braced_after(source, at) else { continue };
        for name in source[start..end].split(',') {
            let name = name.trim();
            if !name.is_empty() {
                found.insert(name.to_string());
            }
        }
    }
    found
}

/// Secuencias `\algo` que siguen en la salida: resto de LaTeX no convertido.
fn count_leftover_latex(typst: &str) -> usize {
    let bytes = typst.as_bytes();
    let mut count = 0;
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'\\' && i + 1 < bytes.len() && bytes[i + 1].is_ascii_alphabetic() {
            count += 1;
            i += 2;
            while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
                i += 1;
            }
        } else {
            i += 1;
        }
    }
    count
}
