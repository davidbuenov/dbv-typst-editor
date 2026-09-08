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
        if after_blank && depth.at_top_level() && !line.trim().is_empty() {
            seeded.push_str(&format!(
                "#metadata((f: \"{safe_file}\", l: {}))<{SYNC_LABEL}>\n",
                index + 1
            ));
        }
        after_blank = line.trim().is_empty();
        seeded.push_str(line);
        seeded.push('\n');
        depth.consume(line);
    }
    seeded
}

/// Profundidad de anidamiento de un fichero Typst, contada por líneas.
///
/// No es un parser: solo cuenta delimitadores fuera de cadenas y comentarios,
/// que es cuanto hace falta para saber si el principio de una línea está en
/// markup de nivel superior. Mismo criterio que el resto del proyecto ante
/// Typst —escaneo ligero antes que parser completo (ARCHITECTURE.md §275)—,
/// porque equivocarse aquí solo cuesta un ancla de menos, nunca un documento roto.
#[derive(Default)]
struct Depth {
    open: i32,
    in_block_comment: bool,
}

impl Depth {
    fn at_top_level(&self) -> bool {
        self.open <= 0 && !self.in_block_comment
    }

    fn consume(&mut self, line: &str) {
        let bytes: Vec<char> = line.chars().collect();
        let mut index = 0;
        let mut in_string = false;
        while index < bytes.len() {
            let current = bytes[index];
            let next = bytes.get(index + 1).copied();

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
            match (current, next) {
                ('/', Some('/')) => break, // Comentario de línea: el resto no cuenta.
                ('/', Some('*')) => {
                    self.in_block_comment = true;
                    index += 2;
                    continue;
                }
                ('"', _) => in_string = true,
                ('{' | '[' | '(', _) => self.open += 1,
                ('}' | ']' | ')', _) => self.open -= 1,
                _ => {}
            }
            index += 1;
        }
    }
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
        assert_eq!(seeded.matches("<dbv-sync>").count(), 3, "{seeded}");
        assert!(seeded.contains("l: 5))"), "{seeded}");
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
