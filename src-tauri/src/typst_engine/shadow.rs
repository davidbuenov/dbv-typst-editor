// =============================================================================
// DBV Typst Editor — Raíz sombra de compilación (RF-14)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Sustituye al espejo `.dbv-preview.typ` que `compile.rs` escribía DENTRO de la
// carpeta del usuario. Dos razones, en este orden:
//
//   1. Desde RF-14 la vista previa compila el documento raíz, no el fichero
//      abierto. `main.typ` hace `#include "chapters/03.typ"`: incluye al fichero
//      real, nunca a un espejo con otro nombre, así que el contenido sin guardar
//      del capítulo se perdía. Replicando el proyecto y materializando ahí el
//      buffer sucio, el `#include` lo encuentra sin trucos.
//   2. RF-02b promete que abrir un proyecto ajeno "no escribe nada en su
//      carpeta". El espejo lo incumplía. La sombra vive en un temporal.
//
// Verificado contra el binario real antes de escribir esto (obligación 1 del
// Adversarial Architect Review): `testfiles/demo-proyecto` compila desde la
// sombra con las mismas páginas, resolviendo su imagen anclada a la raíz, su
// `#import` local y su `#bibliography`, y el capítulo sucio pasa de 8 a 9
// encabezados en el documento completo sin que el fichero original cambie.

use std::fs;
use std::path::{Path, PathBuf};

use tempfile::TempDir;

use super::TypstError;
use crate::commands::file_io::is_noise_dir;

/// Profundidad máxima de la réplica. Coincide con la del escaneo de imágenes:
/// un proyecto Typst real no anida más, y el límite evita perderse en el árbol
/// de un proyecto ajeno.
const MAX_DEPTH: usize = 6;

/// Techo de seguridad de la réplica. No es un límite de producto sino una red:
/// si una carpeta abierta como proyecto resulta ser algo enorme, es preferible
/// fallar con un mensaje claro que copiar sin freno en cada pausa de escritura.
const MAX_FILES: usize = 5_000;

/// Tamaño a partir del cual un fichero que NO se puede enlazar se omite en vez
/// de copiarse.
///
/// Enlazar es gratis, pero un enlace duro solo existe dentro de un volumen: con
/// el proyecto en `D:` y el temporal en `C:` (o cualquier disco externo), cada
/// pausa de escritura copiaba TODO el proyecto. Caso real (2026-09-19): un
/// `.typ` suelto en la carpeta Descargas —260 ficheros, 59 GB, con zips de 13 GB
/// y una ISO— tardaba casi un minuto en abrirse. Typst no lee de un proyecto
/// ficheros de decenas de MB (una imagen enorme ya sería un problema de
/// maquetación); si alguno lo hiciera, el error de Typst lo dice con claridad.
const MAX_COPY_BYTES: u64 = 32 * 1024 * 1024;

/// Extensiones que Typst puede leer de un `.typ` SUELTO. En ese modelo la raíz
/// es la carpeta contenedora —Descargas, el Escritorio— y casi nada de lo que
/// hay ahí le interesa al documento; replicar solo lo que un documento Typst
/// puede llegar a cargar evita copiar cientos de ficheros ajenos en cada
/// compilación. Una carpeta abierta COMO proyecto sí se replica entera.
///
/// Además de lo que Typst carga por sí mismo (imágenes, fuentes, datos,
/// bibliografías, estilos CSL, temas y sintaxis de `raw`, plugins `.wasm`),
/// entra el código fuente y el texto plano que un documento suele incrustar con
/// `read()` / `raw()` — un curso de programación lee sus propios `.cpp`. Un
/// formato que falte aquí sigue funcionando abriendo la carpeta COMO proyecto.
const FLAT_MODE_EXTENSIONS: &[&str] = &[
    // Documentos y datos
    "typ", "bib", "yml", "yaml", "csv", "tsv", "json", "toml", "xml", "txt", "md", "cbor", "html",
    "csl", "tex", "ini", "log",
    // Imágenes
    "png", "jpg", "jpeg", "gif", "svg", "webp", "pdf",
    // Fuentes
    "ttf", "otf", "ttc", "otc", "woff", "woff2",
    // Temas y sintaxis de `raw`, plugins
    "tmtheme", "sublime-syntax", "wasm",
    // Código fuente que se incrusta con `read()` / `raw()`
    "c", "h", "cc", "cpp", "hpp", "cs", "java", "kt", "py", "js", "ts", "rs", "go", "rb", "php",
    "sh", "ps1", "sql", "r", "m", "swift", "lua", "css",
];

/// True si `name` es un fichero que un `.typ` suelto puede necesitar.
fn is_flat_mode_relevant(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            FLAT_MODE_EXTENSIONS
                .iter()
                .any(|candidate| candidate.eq_ignore_ascii_case(extension))
        })
}

/// Etiqueta de las anclas de sincronización (RF-16). Un nombre improbable a
/// propósito: si el documento del usuario ya la usara, sus elementos se
/// mezclarían con los nuestros en el `query`.
pub const SYNC_LABEL: &str = "dbv-sync";

/// Ficheros que la aplicación puede reescribir dentro de la sombra y que por
/// tanto deben COPIARSE, nunca enlazarse: un enlace duro comparte los datos con
/// el fichero real del usuario, así que escribir sobre él corrompería su
/// proyecto. Todo lo demás (imágenes, fuentes) se enlaza, que es gratis.
const ALWAYS_COPY: [&str; 2] = ["typ", "bib"];

/// Réplica temporal del proyecto donde sí se puede escribir.
///
/// El directorio se borra al soltar la estructura, así que quien la construya
/// debe mantenerla viva mientras el compilador la esté usando.
pub struct ShadowRoot {
    dir: TempDir,
}

impl ShadowRoot {
    /// Raíz de la réplica, la que se le pasa a `--root`.
    pub fn root(&self) -> &Path {
        self.dir.path()
    }

    /// Traduce una ruta del proyecto real a su equivalente dentro de la sombra.
    /// Una ruta que no cuelgue del proyecto se devuelve tal cual: es el caso del
    /// `.typ` suelto que se abre desde fuera de cualquier proyecto.
    pub fn translate(&self, project_root: &Path, path: &Path) -> PathBuf {
        match path.strip_prefix(project_root) {
            Ok(relative) => self.dir.path().join(relative),
            Err(_) => path.to_path_buf(),
        }
    }
}

/// Siembra `source` con anclas de sincronización entre bloques (RF-16).
///
/// **El número de línea es el del fichero ORIGINAL, no el del sembrado.** Es el
/// punto donde este diseño falla en silencio si se hace mal: el texto resultante
/// tiene más líneas que el de partida, así que numerar sobre él llevaría el
/// cursor a un sitio cada vez más desplazado según se avanza en el documento.
/// De ahí que se numere mientras se recorre la entrada, antes de insertar nada.
///
/// Las anclas van **entre bloques** —la primera línea no vacía tras una línea en
/// blanco— porque el Spike S-2 midió que ahí el SVG sale byte a byte idéntico:
/// sembrar no cambia una coma de lo que ve el usuario.
///
/// **Excepción, encontrada con un TFG real (2026-09-12): un encabezado de
/// nivel 1 va DESPUÉS, en su propia línea, no antes.** Muchas plantillas de
/// tesis llevan `show heading.where(level: 1): it => { pagebreak(weak: true)
/// .. }` para que cada capítulo empiece en página nueva. Un ancla insertada
/// como hermano ANTERIOR al encabezado se compone (con posición y todo) antes
/// de que ese salto de página se dispare — el salto vive dentro del propio
/// `show` del encabezado, así que solo afecta a lo que viene DESPUÉS de él.
/// El síntoma en la aplicación: el ancla de "Introducción" reportaba la
/// ÚLTIMA página del capítulo anterior, y como esa es la búsqueda por
/// "ancla más cercana por delante", un doble clic en cualquier parte del
/// primer capítulo (toda la mitad inferior de esa página) resolvía al
/// encabezado del capítulo SIGUIENTE en vez de quedarse en el que se veía.
/// Comprobado contra el TFG real que lo reportó: moviendo el ancla a
/// DESPUÉS del encabezado (todavía como hermano suyo, no dentro de su
/// cuerpo — ver la nota de `<label>` más abajo) aterriza ya en la página
/// nueva, y las 19 páginas del documento salen byte a byte idénticas.
///
/// Nota aparte, del mismo hallazgo: un `<dbv-sync>` puesto DENTRO del cuerpo
/// de un encabezado (`= #metadata(..)<dbv-sync>Título`) NO etiqueta el
/// `metadata` — Typst reasigna esa etiqueta al propio encabezado, que es la
/// forma oficial de escribir `= Título <label>`. La consulta pierde entonces
/// el valor `f`/`l` ("heading does not have field \"value\""). Por eso el
/// ancla de un encabezado tiene que ser un hermano SEPARADO, nunca texto
/// inyectado en su interior.
pub fn seed_anchors(source: &str, file: &str) -> String {
    // La ruta viaja dentro de una cadena Typst: se normaliza a `/` y se quitan
    // las comillas, que la cerrarían a media construcción.
    let safe_file = file.replace('\\', "/").replace('"', "");
    let mut seeded = String::with_capacity(source.len() + source.len() / 8);
    let mut after_blank = true;
    let mut depth = Depth::default();

    for (index, line) in source.lines().enumerate() {
        // Solo se ancla en markup de nivel superior. Dentro de un bloque de
        // código un `#metadata(...)` no compila —"the character `#` is not valid
        // in code"—, y eso rompería cualquier proyecto con un fichero de estilo
        // (`#let documento(..) = { .. }`), que es justo lo que traen las 8
        // plantillas curadas. Descubierto compilando `testfiles/demo-proyecto`
        // contra el binario real, no en el spike, cuyos fixtures eran markup puro.
        //
        // Ídem dentro de un bloque de código fuente (```` ``` ````, típico de
        // un apéndice con listados): el mismo TFG real que destapó el fallo
        // del encabezado trae uno con Python/R/C++/SQL/Bash, y sin que `Depth`
        // reconociera la valla de comillas invertidas, la línea sembrada se
        // colaba como texto LITERAL dentro del listado — visible en el PDF, y
        // encima desplazando el resto del documento una página entera.
        if after_blank && depth.at_top_level() && !line.trim().is_empty() && !is_invisible(line) {
            let anchor = format!("#metadata((f: \"{safe_file}\", l: {}))<{SYNC_LABEL}>", index + 1);
            if is_heading(line) {
                // Encabezado: el texto no se toca, el ancla es un hermano que
                // va JUSTO DESPUÉS — ver la nota de arriba.
                seeded.push_str(line);
                seeded.push('\n');
                seeded.push_str(&anchor);
                seeded.push('\n');
            } else {
                seeded.push_str(&anchor);
                seeded.push('\n');
                seeded.push_str(line);
                seeded.push('\n');
            }
        } else {
            seeded.push_str(line);
            seeded.push('\n');
        }
        // Una línea invisible (comentario/import de nivel superior) no
        // produce ningún píxel y nunca recibe ancla, así que no debe
        // "gastar" el `after_blank` de la línea visible que la precedía: si
        // se la deja marcar `after_blank = false`, un encabezado o párrafo
        // pegado justo debajo de ella (sin línea en blanco de por medio) se
        // queda sin ancla del todo — la misma familia de fallo (doble clic
        // aterriza en el capítulo equivocado) que el resto de esta función
        // ya corrige, por una tercera vía: "invisible seguido de visible sin
        // blanco", no cubierta por los dos casos de arriba.
        after_blank = if depth.at_top_level() && is_invisible(line) {
            after_blank
        } else {
            line.trim().is_empty()
        };
        depth.consume(line);
    }
    seeded
}

/// True si `line`, tal cual está, no puede producir NI UN PÍXEL en el render:
/// un comentario, o un `#import`. Ninguno de los dos tiene un clic posible al
/// que corresponder, y son precisamente el patrón de "preámbulo" que trae
/// CADA capítulo de esta plantilla (cabecera de comentario + `#import` antes
/// del `= Título`) — así que sin esto vuelve a aparecer la misma familia de
/// fallo que el encabezado "después" de arriba, por una vía distinta:
///
/// **Hallazgo real (2026-09-12, el mismo TFG, un capítulo más adentro): un
/// doble clic sobre el bloque de ecuaciones de "2.2 Métricas" —al final del
/// capítulo 2— saltaba al capítulo 3.** El encabezado `= Métodos` del
/// capítulo 3 ya aterrizaba bien (con el arreglo de arriba), pero las CINCO
/// líneas de comentario y el `#import` que lo PRECEDEN dentro de
/// `03-metodos.typ` seguían anclándose ANTES de ellas mismas — el patrón
/// normal, correcto para contenido visible. Como esas líneas no producen
/// ningún trazo, Typst las compone en la posición que hubiera antes de
/// llegar al `pagebreak(weak: true)` del encabezado: la ÚLTIMA posición de
/// la página anterior, EXACTAMENTE igual que le pasaba al encabezado mismo.
/// Esa página anterior es la página 7, donde también vive el final del
/// capítulo 2 — y el bloque de ecuaciones de "Métricas" es lo bastante alto
/// como para alcanzar esa posición fantasma. La solución no es "después",
/// como con el encabezado (no tiene sentido posponer un comentario: no hay
/// ningún contenido después de él dentro del que insertarlo con seguridad
/// sin arriesgarse a acabar DENTRO del propio encabezado) — es no anclarlo
/// en absoluto.
fn is_invisible(line: &str) -> bool {
    let trimmed = line.trim_start();
    trimmed.starts_with("//") || trimmed.starts_with("/*") || is_import_statement(trimmed)
}

/// True si `trimmed` (ya sin espacio inicial) es el principio de un
/// `#import ...`. Comprueba que sea la palabra completa, no un prefijo
/// casual de otra función (`#importante(..)` no cuenta, aunque sea un caso
/// improbable).
fn is_import_statement(trimmed: &str) -> bool {
    trimmed
        .strip_prefix("#import")
        .is_some_and(|rest| rest.is_empty() || rest.starts_with(|c: char| c.is_whitespace() || c == '"'))
}

/// True si `line` es un encabezado (`=`, `==`... seguido de espacio o
/// tabulador). No valida que sea un encabezado "de verdad" (un `=` escapado
/// al principio de un párrafo también lo daría, un caso tan raro que no
/// compensa complicar el escaneo por él) — mismo criterio que `Depth`: un
/// escaneo ligero, no un parser completo.
fn is_heading(line: &str) -> bool {
    let trimmed = line.trim_start();
    let marker_len = trimmed.bytes().take_while(|&b| b == b'=').count();
    if marker_len == 0 {
        return false;
    }
    // Typst exige al menos un espacio (o tabulador) tras los "=" para que
    // cuente como encabezado; sin él, "==foo" es solo texto.
    matches!(trimmed.as_bytes().get(marker_len), Some(b' ' | b'\t'))
}

/// Profundidad de anidamiento de un fichero Typst, contada por líneas.
///
/// No es un parser: solo cuenta delimitadores fuera de cadenas y comentarios,
/// que es cuanto hace falta para saber si el principio de una línea está en
/// markup de nivel superior. Mismo criterio que el resto del proyecto ante
/// Typst —escaneo ligero antes que parser completo (ARCHITECTURE.md §275)—,
/// porque equivocarse aquí debe costar solo un ancla de menos, nunca un
/// documento roto. Esa garantía exige que el error sea siempre "de más":
/// contar de menos (un cierre suelto que baja el contador de cero) sembraba
/// anclas DENTRO de llamadas de código y rompía la compilación — de ahí el
/// `.max(0)` de `consume`. Un contador que se queda alto (un `(` suelto) solo
/// pierde anclas, que es el fallo tolerable.
#[derive(Default)]
struct Depth {
    open: i32,
    in_block_comment: bool,
    /// Nº de comillas invertidas que abrieron el tramo `raw` en curso —
    /// inline (`` `code` ``) o de bloque (```` ```lang ````) — o 0 si no hay
    /// ninguno abierto. Hace falta el número, no solo un booleano: Typst
    /// cierra un tramo `raw` con una tanda de AL MENOS ese mismo número de
    /// comillas, nunca con menos.
    ///
    /// Encontrado con un TFG real (2026-09-12): un apéndice de "fragmentos de
    /// código" con listados ```` ```python ```` no lo tenía en cuenta, así
    /// que una línea cualquiera DENTRO del listado (código, no markup) se
    /// tomaba por markup de nivel superior — el ancla sembrada se colaba
    /// como texto LITERAL dentro del código, visible en el PDF.
    raw_fence_len: usize,
}

impl Depth {
    fn at_top_level(&self) -> bool {
        self.open <= 0 && !self.in_block_comment && self.raw_fence_len == 0
    }

    fn consume(&mut self, line: &str) {
        let bytes: Vec<char> = line.chars().collect();
        let mut index = 0;
        let mut in_string = false;
        while index < bytes.len() {
            let current = bytes[index];
            let next = bytes.get(index + 1).copied();

            if self.raw_fence_len > 0 {
                if current == '`' {
                    let run = run_length(&bytes, index, '`');
                    if run >= self.raw_fence_len {
                        self.raw_fence_len = 0;
                    }
                    index += run;
                    continue;
                }
                index += 1;
                continue;
            }
            if self.in_block_comment {
                if current == '*' && next == Some('/') {
                    self.in_block_comment = false;
                    index += 2;
                    continue;
                }
                index += 1;
                continue;
            }
            if in_string {
                // Una barra invertida escapa el carácter siguiente, comillas incluidas.
                if current == '\\' {
                    index += 2;
                    continue;
                }
                if current == '"' {
                    in_string = false;
                }
                index += 1;
                continue;
            }
            if current == '`' {
                self.raw_fence_len = run_length(&bytes, index, '`');
                index += self.raw_fence_len;
                continue;
            }
            match (current, next) {
                ('/', Some('/')) => break, // Comentario de línea: el resto no cuenta.
                ('/', Some('*')) => {
                    self.in_block_comment = true;
                    index += 2;
                    continue;
                }
                ('"', _) => in_string = true,
                ('{' | '[' | '(', _) => self.open += 1,
                // Un cierre de más NO puede dejar el contador por debajo de cero:
                // un `)` suelto en texto plano ("Missing )" en una celda, una
                // carita ":)") lo dejaba en -1, y el siguiente `#table(` lo
                // devolvía a 0 — "nivel superior" DENTRO de la llamada. El ancla
                // sembrada caía entre argumentos y Typst daba un error que el
                // documento no tiene ("the character `#` is not valid in code"),
                // repetido en cada recompilación. Hallado en /test (2026-09-19)
                // reproduciendo el caso de un usuario del 2026-09-15.
                ('}' | ']' | ')', _) => self.open = (self.open - 1).max(0),
                _ => {}
            }
            index += 1;
        }
    }
}

/// Cuántos caracteres `target` seguidos hay en `chars` a partir de `start`.
fn run_length(chars: &[char], start: usize, target: char) -> usize {
    chars[start..].iter().take_while(|&&c| c == target).count()
}

/// True si `name` debe copiarse en vez de enlazarse.
fn must_copy(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            ALWAYS_COPY
                .iter()
                .any(|candidate| candidate.eq_ignore_ascii_case(extension))
        })
}

/// Replica un fichero: enlace duro cuando se puede (no cuesta espacio), copia
/// cuando el destino debe poder reescribirse o cuando el sistema de ficheros no
/// admite enlaces (otro volumen, FAT, un temporal en otra unidad).
fn replicate_file(
    source: &Path,
    destination: &Path,
    name: &str,
    relative: &Path,
    seed: bool,
) -> Result<(), TypstError> {
    // Los `.typ` se siembran al copiarlos: es el único momento en que se conoce
    // a la vez su contenido y su ruta relativa dentro del proyecto.
    let is_typst = name.to_ascii_lowercase().ends_with(".typ");
    if seed && is_typst {
        let original = fs::read_to_string(source)
            .map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;
        let seeded = seed_anchors(&original, &relative.to_string_lossy());
        return fs::write(destination, seeded)
            .map_err(|error| TypstError::ExecutionFailed(error.to_string()));
    }

    let linkable = !must_copy(name) && fs::hard_link(source, destination).is_ok();
    if linkable {
        return Ok(());
    }
    // Sin enlace posible, copiar un fichero enorme es lo que más cuesta: se
    // omite (ver `MAX_COPY_BYTES`). Los `.typ`/`.bib` no pasan por aquí con
    // tamaños así, y de todos modos siempre se copian.
    if !must_copy(name) && fs::metadata(source).is_ok_and(|meta| meta.len() > MAX_COPY_BYTES) {
        return Ok(());
    }
    fs::copy(source, destination)
        .map(|_| ())
        .map_err(|error| TypstError::ExecutionFailed(error.to_string()))
}

/// Copia el contenido de `source` en `destination`, descendiendo si `recursive`.
#[allow(clippy::too_many_arguments)]
fn replicate_dir(
    source: &Path,
    destination: &Path,
    relative: &Path,
    recursive: bool,
    seed: bool,
    depth: usize,
    budget: &mut usize,
) -> Result<(), TypstError> {
    if depth > MAX_DEPTH {
        return Ok(());
    }
    fs::create_dir_all(destination).map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;

    let entries =
        fs::read_dir(source).map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if path.is_dir() {
            if recursive && !is_noise_dir(name) && !name.starts_with('.') {
                replicate_dir(
                    &path,
                    &destination.join(name),
                    &relative.join(name),
                    true,
                    seed,
                    depth + 1,
                    budget,
                )?;
            }
            continue;
        }
        // Un `.typ` suelto solo arrastra lo que un documento Typst puede leer.
        if !recursive && !is_flat_mode_relevant(name) {
            continue;
        }
        if *budget == 0 {
            return Err(TypstError::ExecutionFailed(format!(
                "el proyecto supera los {MAX_FILES} ficheros que la vista previa puede replicar"
            )));
        }
        *budget -= 1;
        replicate_file(
            &path,
            &destination.join(name),
            name,
            &relative.join(name),
            seed,
        )?;
    }
    Ok(())
}

/// Construye la réplica de `project_root` y materializa en ella el contenido sin
/// guardar, si lo hay.
///
/// `flat` distingue los dos modelos de proyecto de RF-02b: una carpeta abierta
/// como proyecto se replica entera, pero un `.typ` suelto tiene como raíz la
/// carpeta que lo contiene —que puede ser el Escritorio del usuario— y ahí solo
/// se replica ese primer nivel. Sin esa distinción, previsualizar un fichero
/// suelto copiaría en cada pausa de escritura todo lo que hubiera al lado.
///
/// `dirty` es `(ruta real del fichero en edición, su contenido en el editor)`.
/// La aplicación garantiza que a lo sumo hay uno: cambiar de documento con
/// cambios pendientes obliga antes a guardar o descartar.
pub fn build(
    project_root: &Path,
    flat: bool,
    seed: bool,
    dirty: Option<(&Path, &str)>,
) -> Result<ShadowRoot, TypstError> {
    if !project_root.is_dir() {
        return Err(TypstError::ExecutionFailed(format!(
            "{} no es una carpeta de proyecto",
            project_root.display()
        )));
    }

    let dir = tempfile::tempdir().map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;
    let mut budget = MAX_FILES;
    replicate_dir(
        project_root,
        dir.path(),
        Path::new(""),
        !flat,
        seed,
        0,
        &mut budget,
    )?;

    let shadow = ShadowRoot { dir };
    if let Some((path, content)) = dirty {
        let destination = shadow.translate(project_root, path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;
        }
        // El buffer sucio se siembra igual que su gemelo de disco: si no, el
        // fichero que el usuario está editando sería justo el único sin anclas.
        let relative = path.strip_prefix(project_root).unwrap_or(path);
        let text = if seed && path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("typ")) {
            seed_anchors(content, &relative.to_string_lossy())
        } else {
            content.to_string()
        };
        fs::write(&destination, text)
            .map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;
    }
    Ok(shadow)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Proyecto de prueba con la forma de los reales: raíz, capítulo e imagen.
    fn project() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("chapters")).unwrap();
        fs::create_dir_all(dir.path().join("images")).unwrap();
        fs::write(dir.path().join("main.typ"), "#include \"chapters/01.typ\"\n").unwrap();
        fs::write(dir.path().join("chapters/01.typ"), "= Capítulo\n").unwrap();
        fs::write(dir.path().join("images/foto.png"), b"bytes-de-imagen").unwrap();
        fs::write(dir.path().join("refs.bib"), "@book{a, title={A}}\n").unwrap();
        dir
    }

    #[test]
    fn replica_el_arbol_completo_del_proyecto() {
        let dir = project();

        let shadow = build(dir.path(), false, false, None).unwrap();

        assert!(shadow.root().join("main.typ").is_file());
        assert!(shadow.root().join("chapters/01.typ").is_file());
        assert!(shadow.root().join("images/foto.png").is_file());
        assert!(shadow.root().join("refs.bib").is_file());
    }

    #[test]
    fn el_contenido_sin_guardar_sustituye_al_de_disco_en_la_sombra() {
        let dir = project();
        let sucio = dir.path().join("chapters/01.typ");

        let shadow = build(dir.path(), false, false, Some((&sucio, "= Capítulo sin guardar\n"))).unwrap();

        let en_sombra = fs::read_to_string(shadow.root().join("chapters/01.typ")).unwrap();
        assert_eq!(en_sombra, "= Capítulo sin guardar\n");
    }

    #[test]
    fn escribir_en_la_sombra_nunca_toca_el_fichero_del_usuario() {
        // R-11: el riesgo del enlace duro. Los `.typ` se copian justamente para
        // que esto no pueda pasar.
        let dir = project();
        let original = dir.path().join("chapters/01.typ");

        let shadow = build(dir.path(), false, false, Some((&original, "= Otra cosa\n"))).unwrap();

        assert_eq!(fs::read_to_string(&original).unwrap(), "= Capítulo\n");
        assert_ne!(
            fs::read_to_string(shadow.root().join("chapters/01.typ")).unwrap(),
            "= Capítulo\n"
        );
    }

    #[test]
    fn un_parentesis_suelto_en_texto_no_siembra_anclas_dentro_de_una_llamada() {
        // Caso real: el documento original compila, pero con un `)` suelto la
        // réplica sembrada ponía un ancla entre los argumentos de `#table(` y
        // Typst fallaba con un error que el usuario no podía corregir.
        let source = "= Titulo

Texto con un ) suelto aqui.

#table(
  columns: 2,

  [a], [b],
)

Fin.
";

        let seeded = seed_anchors(source, "main.typ");

        // La línea 8 (`[a], [b],`) está DENTRO de la llamada: sin ancla.
        assert!(!seeded.contains("l: 8"), "ancla dentro de #table(...):
{seeded}");
        // Lo que sí está en nivel superior sigue anclado, antes y después.
        assert!(seeded.contains("l: 3"), "{seeded}");
        assert!(seeded.contains("l: 11"), "{seeded}");
    }

    #[test]
    fn varios_cierres_sueltos_seguidos_tampoco_desincronizan_la_profundidad() {
        let source = "Cara :) :) ]] }}

#figure(
  caption: [x],

  [y],
)
";

        let seeded = seed_anchors(source, "a.typ");

        assert!(!seeded.contains("l: 6"), "{seeded}");
    }

    #[test]
    fn un_fichero_suelto_solo_replica_lo_que_typst_puede_leer() {
        // Descargas real: zips, ISOs y ejecutables no los lee ningún documento.
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("informe.typ"), "= Hola").unwrap();
        fs::write(dir.path().join("logo.PNG"), b"png").unwrap();
        fs::write(dir.path().join("datos.csv"), "a,b").unwrap();
        fs::write(dir.path().join("instalador.exe"), b"exe").unwrap();
        fs::write(dir.path().join("copia.zip"), b"zip").unwrap();
        fs::write(dir.path().join("pelicula.mp4"), b"mp4").unwrap();

        let shadow = build(dir.path(), true, false, None).unwrap();

        assert!(shadow.root().join("informe.typ").is_file());
        assert!(shadow.root().join("logo.PNG").is_file());
        assert!(shadow.root().join("datos.csv").is_file());
        assert!(!shadow.root().join("instalador.exe").exists());
        assert!(!shadow.root().join("copia.zip").exists());
        assert!(!shadow.root().join("pelicula.mp4").exists());
    }

    #[test]
    fn una_carpeta_de_proyecto_si_replica_extensiones_no_listadas() {
        // El filtro por extensión es solo del modelo de `.typ` suelto: un
        // proyecto puede leer cualquier cosa con `read()` (p. ej. un `.cpp`).
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("main.typ"), "= Hola").unwrap();
        fs::write(dir.path().join("prog.cpp"), "int main(){}").unwrap();

        let shadow = build(dir.path(), false, false, None).unwrap();

        assert!(shadow.root().join("prog.cpp").is_file());
    }

    #[test]
    fn un_fichero_enorme_que_no_se_puede_enlazar_se_omite_en_vez_de_copiarse() {
        // Sin enlace duro posible (otro volumen) copiar decenas de MB en cada
        // pausa de escritura era lo que hacía tardar un minuto. Se fuerza el
        // fallo del enlace con un destino que ya existe.
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("grande.png");
        let destination = dir.path().join("destino.png");
        let file = fs::File::create(&source).unwrap();
        file.set_len(MAX_COPY_BYTES + 1).unwrap();
        fs::write(&destination, b"previo").unwrap();

        replicate_file(&source, &destination, "grande.png", Path::new("grande.png"), false).unwrap();

        // Ni enlazado (ya existía) ni copiado: el destino queda como estaba.
        assert_eq!(fs::read(&destination).unwrap(), b"previo");
    }

    #[test]
    fn un_fichero_pequeno_que_no_se_puede_enlazar_si_se_copia() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("pequena.png");
        let destination = dir.path().join("destino.png");
        fs::write(&source, b"contenido").unwrap();
        fs::write(&destination, b"previo").unwrap();

        replicate_file(&source, &destination, "pequena.png", Path::new("pequena.png"), false).unwrap();

        assert_eq!(fs::read(&destination).unwrap(), b"contenido");
    }

    #[test]
    fn is_flat_mode_relevant_acepta_lo_que_un_documento_suele_incrustar() {
        // Un curso de programación lee sus propios `.cpp` con `read()`; un
        // documento estilizado trae `.csl`, un tema `.tmTheme` y quizá un plugin.
        for name in ["prog.cpp", "estilo.csl", "oscuro.tmTheme", "lenguaje.sublime-syntax", "plugin.wasm", "script.PY"] {
            assert!(is_flat_mode_relevant(name), "{name}");
        }
    }

    #[test]
    fn is_flat_mode_relevant_ignora_mayusculas_y_rechaza_lo_ajeno() {
        assert!(is_flat_mode_relevant("Foto.JPG"));
        assert!(is_flat_mode_relevant("refs.bib"));
        assert!(!is_flat_mode_relevant("setup.exe"));
        assert!(!is_flat_mode_relevant("sinextension"));
    }

    #[test]
    fn un_fichero_suelto_no_arrastra_las_subcarpetas_de_su_carpeta() {
        // La raíz de un `.typ` suelto es la carpeta que lo contiene, que puede
        // ser el Escritorio: replicarla entera sería inaceptable.
        let dir = project();

        let shadow = build(dir.path(), true, false, None).unwrap();

        assert!(shadow.root().join("main.typ").is_file());
        assert!(shadow.root().join("refs.bib").is_file());
        assert!(!shadow.root().join("chapters").exists());
        assert!(!shadow.root().join("images").exists());
    }

    #[test]
    fn se_salta_el_ruido_de_repositorio_y_las_carpetas_ocultas() {
        let dir = project();
        fs::create_dir_all(dir.path().join(".git/objects")).unwrap();
        fs::write(dir.path().join(".git/objects/x"), b"basura").unwrap();
        fs::create_dir_all(dir.path().join("node_modules/p")).unwrap();
        fs::write(dir.path().join("node_modules/p/index.js"), b"x").unwrap();

        let shadow = build(dir.path(), false, false, None).unwrap();

        assert!(!shadow.root().join(".git").exists());
        assert!(!shadow.root().join("node_modules").exists());
    }

    #[test]
    fn translate_lleva_una_ruta_del_proyecto_a_su_gemela_en_la_sombra() {
        let dir = project();
        let shadow = build(dir.path(), false, false, None).unwrap();

        let traducida = shadow.translate(dir.path(), &dir.path().join("chapters/01.typ"));

        assert_eq!(traducida, shadow.root().join("chapters/01.typ"));
    }

    #[test]
    fn translate_deja_intacta_una_ruta_ajena_al_proyecto() {
        let dir = project();
        let shadow = build(dir.path(), false, false, None).unwrap();
        let fuera = Path::new("/otro/sitio/suelto.typ");

        assert_eq!(shadow.translate(dir.path(), fuera), fuera);
    }

    #[test]
    fn must_copy_distingue_lo_reescribible_de_lo_enlazable() {
        assert!(must_copy("main.typ"));
        assert!(must_copy("REFS.BIB"));
        assert!(!must_copy("foto.png"));
        assert!(!must_copy("Inter.ttf"));
        assert!(!must_copy("sin-extension"));
    }

    #[test]
    fn rechaza_una_raiz_que_no_es_carpeta() {
        let dir = project();

        let result = build(&dir.path().join("main.typ"), false, false, None);

        assert!(result.is_err());
    }

    // ─── RF-16: siembra de anclas ────────────────────────────────────────────

    #[test]
    fn seed_anchors_numera_sobre_el_texto_original_no_sobre_el_sembrado() {
        // R-12, el fallo silencioso más probable de todo el diseño: el texto
        // sembrado tiene MÁS líneas, así que numerar sobre él desplazaría el
        // cursor cada vez más según avanza el documento.
        let source = "= Uno\n\n= Dos\n\n= Tres\n";

        let seeded = seed_anchors(source, "cap.typ");

        assert!(seeded.contains("l: 1))"), "{seeded}");
        assert!(seeded.contains("l: 3))"), "{seeded}");
        assert!(seeded.contains("l: 5))"), "{seeded}");
        // Y NO las líneas que ocuparían en el fichero sembrado (2, 5, 8...).
        assert!(!seeded.contains("l: 8))"), "{seeded}");
    }

    #[test]
    fn seed_anchors_ancla_solo_al_principio_de_cada_bloque() {
        // Entre bloques es donde el Spike S-2 midió SVG byte a byte idéntico.
        let source = "Primera línea\nsegunda del mismo párrafo\n\nOtro bloque\n";

        let seeded = seed_anchors(source, "cap.typ");

        assert_eq!(seeded.matches("<dbv-sync>").count(), 2);
        assert!(seeded.contains("l: 1))"));
        assert!(seeded.contains("l: 4))"));
        assert!(!seeded.contains("l: 2))"));
    }

    #[test]
    fn seed_anchors_conserva_el_texto_intacto() {
        let source = "= Título\n\nCuerpo con #emph[énfasis].\n";

        let seeded = seed_anchors(source, "cap.typ");

        let sin_anclas: String = seeded
            .lines()
            .filter(|line| !line.contains("<dbv-sync>"))
            .map(|line| format!("{line}\n"))
            .collect();
        assert_eq!(sin_anclas, source);
    }

    #[test]
    fn seed_anchors_normaliza_la_ruta_y_no_rompe_la_cadena_typst() {
        let seeded = seed_anchors("= Hola\n", r"chapters\01.typ");

        assert!(seeded.contains("f: \"chapters/01.typ\""), "{seeded}");
    }

    #[test]
    fn seed_anchors_de_un_fichero_vacio_no_produce_anclas() {
        assert_eq!(seed_anchors("", "cap.typ"), "");
    }

    #[test]
    fn seed_anchors_no_entra_en_un_bloque_de_codigo() {
        // El fallo que destapó compilar `testfiles/demo-proyecto` contra el
        // binario real: un `#metadata` dentro de código da "the character `#` is
        // not valid in code" y rompe TODO proyecto con fichero de estilo, que es
        // lo que traen las 8 plantillas curadas.
        let source = concat!(
            "#let documento(titulo: \"\") = {\n",
            "\n",
            "  set page(paper: \"a4\")\n",
            "\n",
            "  heading(titulo)\n",
            "}\n",
            "\n",
            "= Fuera del bloque\n",
        );

        let seeded = seed_anchors(source, "estilo.typ");

        assert_eq!(seeded.matches("<dbv-sync>").count(), 2, "{seeded}");
        assert!(seeded.contains("l: 1))"), "{seeded}");
        assert!(seeded.contains("l: 8))"), "{seeded}");
        // Nada dentro del cuerpo del `#let`.
        assert!(!seeded.contains("l: 3))"), "{seeded}");
        assert!(!seeded.contains("l: 5))"), "{seeded}");
    }

    #[test]
    fn seed_anchors_ancla_un_encabezado_despues_no_antes() {
        // El fallo real (2026-09-12, TFG con `show heading.where(level: 1):
        // it => { pagebreak(weak: true) .. }`): un ancla ANTES del
        // encabezado se compone antes de que su propio salto de página se
        // dispare, así que reporta la página VIEJA. Puesta después, hereda
        // la página nueva. Aquí solo se comprueba el orden en el texto
        // sembrado — la página real solo se ve compilando (verificado a
        // mano contra el TFG del usuario, no reproducible en un test unitario
        // sin el binario).
        let seeded = seed_anchors("= Introducción\n\nTexto.\n", "cap.typ");

        let heading_at = seeded.find("= Introducción").unwrap();
        let anchor_at = seeded.find("<dbv-sync>").unwrap();
        assert!(anchor_at > heading_at, "{seeded}");
    }

    #[test]
    fn seed_anchors_encabezado_no_se_confunde_con_una_asignacion() {
        // "=" sin espacio detrás no es un encabezado Typst — no debe activar
        // el camino "después".
        let seeded = seed_anchors("=x\n\nSiguiente.\n", "cap.typ");

        let heading_at = seeded.find("=x").unwrap();
        let anchor_at = seeded.find("<dbv-sync>").unwrap();
        assert!(anchor_at < heading_at, "{seeded}");
    }

    #[test]
    fn seed_anchors_encabezado_de_cualquier_nivel_va_despues() {
        let seeded = seed_anchors("=== Subsección\n\nTexto.\n", "cap.typ");

        let heading_at = seeded.find("=== Subsección").unwrap();
        let anchor_at = seeded.find("<dbv-sync>").unwrap();
        assert!(anchor_at > heading_at, "{seeded}");
    }

    #[test]
    fn seed_anchors_no_entra_en_un_bloque_de_codigo_con_vallas() {
        // El segundo fallo del mismo TFG real: un apéndice de "fragmentos de
        // código" con listados ```python ...``` no estaba cubierto por
        // `Depth`, así que una línea de código cualquiera se tomaba por
        // markup de nivel superior — el ancla sembrada se colaba como texto
        // LITERAL dentro del listado, visible en el PDF compilado.
        let source = concat!(
            "Antes del listado.\n",
            "\n",
            "```python\n",
            "# esto es código, no un comentario Typst\n",
            "\n",
            "from typing import Tuple\n",
            "```\n",
            "\n",
            "Después del listado.\n",
        );

        let seeded = seed_anchors(source, "cap.typ");

        // La línea que ABRE la valla sí recibe ancla — es markup de nivel
        // superior de verdad, el principio del bloque de código, ni distinto
        // ni más peligroso que anclar delante de un `#figure(`. Lo único que
        // no debe pasar es que algo de DENTRO reciba una.
        assert_eq!(seeded.matches("<dbv-sync>").count(), 3, "{seeded}");
        assert!(seeded.contains("l: 1))"), "{seeded}"); // "Antes del listado."
        assert!(seeded.contains("l: 3))"), "{seeded}"); // "```python"
        assert!(seeded.contains("l: 9))"), "{seeded}"); // "Después del listado."
        // Nada dentro de la valla, ni en la línea en blanco de en medio.
        assert!(!seeded.contains("l: 4))"), "{seeded}");
        assert!(!seeded.contains("l: 6))"), "{seeded}");
        // Y el propio listado no se ha tocado ni una coma.
        assert!(seeded.contains("from typing import Tuple\n```"), "{seeded}");
    }

    #[test]
    fn seed_anchors_una_valla_que_no_se_cierra_en_la_misma_linea_sigue_abierta() {
        // La guarda que hace falta de verdad: una línea en blanco DENTRO del
        // listado, seguida de una línea de código — sin recordar cuántas
        // comillas invertidas siguen abiertas entre líneas, esa combinación
        // (línea en blanco + no vacía) es indistinguible de un bloque nuevo.
        let source = "```\nprimera\n\nsegunda\n```\n\nFuera.\n";

        let seeded = seed_anchors(source, "cap.typ");

        assert_eq!(seeded.matches("<dbv-sync>").count(), 2, "{seeded}");
        assert!(seeded.contains("l: 1))"), "{seeded}"); // "```" (abre la valla)
        assert!(seeded.contains("l: 7))"), "{seeded}"); // "Fuera."
        assert!(!seeded.contains("l: 2))"), "{seeded}");
        assert!(!seeded.contains("l: 4))"), "{seeded}"); // la línea tras el hueco en blanco
    }

    #[test]
    fn seed_anchors_un_codigo_en_linea_no_desbalancea_los_corchetes_de_despues() {
        // `` `array[i` `` con un corchete sin cerrar, DENTRO de comillas
        // invertidas, no debe dejar `Depth` creyendo que sigue dentro de un
        // corchete para el resto del fichero.
        let source = "Con `array[i` código en línea.\n\nSiguiente bloque.\n";

        let seeded = seed_anchors(source, "cap.typ");

        assert_eq!(seeded.matches("<dbv-sync>").count(), 2, "{seeded}");
        assert!(seeded.contains("l: 3))"), "{seeded}");
    }

    #[test]
    fn seed_anchors_no_se_confunde_con_llaves_dentro_de_cadenas_ni_comentarios() {
        let source = concat!(
            "#let x = \"una { llave suelta\"\n",
            "\n",
            "// otro { comentario\n",
            "\n",
            "= Sigue siendo nivel superior\n",
        );

        let seeded = seed_anchors(source, "cap.typ");

        // Si las llaves de la cadena o del comentario contaran, el nivel se
        // quedaría abierto y el resto del fichero no recibiría ni un ancla.
        // Dos, no tres: el comentario de la línea 3 ya no se ancla (ver
        // `is_invisible`) — sigue demostrando que sus llaves no cierran nada,
        // el encabezado de la línea 5 recibe su ancla igual.
        assert_eq!(seeded.matches("<dbv-sync>").count(), 2, "{seeded}");
        assert!(seeded.contains("l: 5))"), "{seeded}");
    }

    #[test]
    fn seed_anchors_un_comentario_o_import_no_recibe_ancla() {
        // Segundo fallo del mismo TFG real (2026-09-12), un capítulo más
        // adentro: CADA capítulo de la plantilla empieza con una cabecera de
        // comentario y un `#import` antes del `= Título`. Ninguno de los dos
        // produce ni un píxel, así que anclarlos ANTES los deja compuestos en
        // la posición vieja, previa al `pagebreak` del encabezado que viene
        // detrás — exactamente el mismo síntoma que el encabezado sin
        // arreglar, pero un paso antes en el fichero. Un doble clic sobre el
        // final visible del capítulo ANTERIOR (que comparte esa página física)
        // resolvía al capítulo siguiente.
        let source = concat!(
            "// Cabecera del capítulo.\n",
            "// Segunda línea de la cabecera.\n",
            "\n",
            "#import \"../estilo.typ\": (\n",
            "  definicion, teorema,\n",
            ")\n",
            "\n",
            "= Métodos\n",
            "\n",
            "Cuerpo real.\n",
        );

        let seeded = seed_anchors(source, "cap.typ");

        // Solo dos anclas: el encabezado (después de él) y el cuerpo. Nada
        // para el comentario ni para el `#import`, multilínea incluido.
        assert_eq!(seeded.matches("<dbv-sync>").count(), 2, "{seeded}");
        assert!(seeded.contains("l: 8))"), "{seeded}"); // "= Métodos"
        assert!(seeded.contains("l: 10))"), "{seeded}"); // "Cuerpo real."
        assert!(!seeded.contains("l: 1))"), "{seeded}");
        assert!(!seeded.contains("l: 4))"), "{seeded}");
        // Y el encabezado sigue yendo DESPUÉS, no antes.
        let heading_at = seeded.find("= Métodos").unwrap();
        let anchor_at = seeded.find("l: 8))").unwrap();
        assert!(anchor_at > heading_at, "{seeded}");
    }

    #[test]
    fn seed_anchors_un_encabezado_pegado_a_un_comentario_sin_linea_en_blanco_si_recibe_ancla() {
        // Variante del hallazgo de 2026-09-12 no cubierta por el test de
        // arriba: allí el comentario y el `#import` tenían una línea en
        // blanco antes del encabezado. Sin ella, el comentario dejaba
        // `after_blank = false` para la línea siguiente y el encabezado se
        // quedaba sin ancla — el mismo síntoma (doble clic cae en el
        // capítulo anterior) por una vía distinta.
        let source = "// nota pegada\n= Introducción\n\nTexto.\n";

        let seeded = seed_anchors(source, "cap.typ");

        assert_eq!(seeded.matches("<dbv-sync>").count(), 2, "{seeded}");
        assert!(seeded.contains("l: 2))"), "{seeded}"); // "= Introducción"
        assert!(seeded.contains("l: 4))"), "{seeded}"); // "Texto."
        assert!(!seeded.contains("l: 1))"), "{seeded}");
    }

    #[test]
    fn seed_anchors_un_import_de_una_sola_linea_tampoco_se_ancla() {
        let seeded = seed_anchors("#import \"a.typ\": cosa\n\nTexto.\n", "cap.typ");

        assert_eq!(seeded.matches("<dbv-sync>").count(), 1, "{seeded}");
        assert!(seeded.contains("l: 3))"), "{seeded}");
    }

    #[test]
    fn seed_anchors_una_funcion_que_empieza_como_import_no_se_confunde() {
        // "#importante(...)" no es un `#import`: la palabra completa importa.
        let seeded = seed_anchors("#importante(true)\n", "cap.typ");

        assert!(seeded.contains("l: 1))"), "{seeded}");
    }

    #[test]
    fn la_replica_siembra_los_typ_y_deja_el_resto_como_esta() {
        let dir = project();

        let shadow = build(dir.path(), false, true, None).unwrap();

        let main = fs::read_to_string(shadow.root().join("main.typ")).unwrap();
        assert!(main.contains("<dbv-sync>"));
        let capitulo = fs::read_to_string(shadow.root().join("chapters/01.typ")).unwrap();
        assert!(capitulo.contains("f: \"chapters/01.typ\""), "{capitulo}");
        // El `.bib` y la imagen no se tocan.
        assert_eq!(
            fs::read_to_string(shadow.root().join("refs.bib")).unwrap(),
            "@book{a, title={A}}\n"
        );
        assert_eq!(
            fs::read(shadow.root().join("images/foto.png")).unwrap(),
            b"bytes-de-imagen"
        );
    }

    #[test]
    fn el_buffer_sucio_tambien_se_siembra() {
        // Si no, el fichero que el usuario está editando sería justo el único
        // sin anclas: la sincronización fallaría precisamente donde se trabaja.
        let dir = project();
        let sucio = dir.path().join("chapters/01.typ");

        let shadow = build(dir.path(), false, true, Some((&sucio, "= Sin guardar\n"))).unwrap();

        let capitulo = fs::read_to_string(shadow.root().join("chapters/01.typ")).unwrap();
        assert!(capitulo.contains("= Sin guardar"));
        assert!(capitulo.contains("f: \"chapters/01.typ\", l: 1"), "{capitulo}");
    }
}
