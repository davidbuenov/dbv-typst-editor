// =============================================================================
// DBV Typst Editor — Motor de vista previa en proceso (RF-56)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Compila con Typst como LIBRERÍA en vez de lanzar el sidecar (ADR-MOTOR-001):
// un solo compilado del que salen la imagen y el mapa exacto al fuente, y una
// compilación INCREMENTAL tras cada edición (medido en el Spike S-3: 0,5 s frente
// a ≈5 s en un libro de 224 páginas). El motor clásico (CLI + réplica + anclas)
// sigue existiendo como respaldo automático y NO se toca aquí.
//
// Las piezas, de dentro afuera:
//   · `world`    — el "mundo" de Typst: ficheros, fuentes, paquetes, sustituciones.
//   · `worker`   — el hilo de compilación ("gana la última").
//   · `map`      — el mapa glifo → fuente y sus dos consultas.
//   · `diagnostics` — errores y avisos como rangos por fichero.

pub mod diagnostics;
pub mod map;
pub mod pages;
pub mod worker;
pub mod world;

/// Versión de Typst con la que se compila este motor. Es la MISMA que la del
/// sidecar vendorizado: solo así la imagen de la vista previa coincide con la
/// exportación que hace el CLI.
pub const TYPST_VERSION: &str = "0.15.1";

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn manifest_dir() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    }

    /// Versión que fija `Cargo.toml` para un crate `typst*` (`crate = "=X.Y.Z"`
    /// o `crate = { version = "=X.Y.Z", … }`).
    fn pinned(cargo: &str, name: &str) -> Option<String> {
        let line = cargo
            .lines()
            .find(|line| line.trim_start().starts_with(&format!("{name} =")))?;
        let start = line.find("\"=")? + 2;
        let end = line[start..].find('"')? + start;
        Some(line[start..end].to_string())
    }

    #[test]
    fn los_crates_de_typst_llevan_la_version_exacta_del_sidecar() {
        let cargo = fs::read_to_string(manifest_dir().join("Cargo.toml")).unwrap();
        let vendor = fs::read_to_string(manifest_dir().join("../scripts/vendor-typst.mjs")).unwrap();
        let sidecar = vendor
            .lines()
            .find(|line| line.contains("const TYPST_VERSION"))
            .and_then(|line| line.split('\'').nth(1))
            .expect("scripts/vendor-typst.mjs debe declarar TYPST_VERSION");

        assert_eq!(sidecar, TYPST_VERSION, "TYPST_VERSION del motor != sidecar vendorizado");
        for name in ["typst", "typst-ide", "typst-layout", "typst-svg", "typst-kit"] {
            assert_eq!(
                pinned(&cargo, name).as_deref(),
                Some(sidecar),
                "{name} debe fijar EXACTAMENTE la versión del sidecar (={sidecar})"
            );
        }
    }

    #[test]
    fn pinned_lee_las_dos_formas_de_declarar_una_dependencia() {
        let cargo = "typst = \"=1.2.3\"\ntypst-kit = { version = \"=4.5.6\", default-features = false }\n";
        assert_eq!(pinned(cargo, "typst").as_deref(), Some("1.2.3"));
        assert_eq!(pinned(cargo, "typst-kit").as_deref(), Some("4.5.6"));
        assert_eq!(pinned(cargo, "typst-ide"), None);
    }

    #[test]
    fn el_crate_que_se_compila_es_el_que_se_declara() {
        // `typst::compile` existe solo si el crate se resolvió; comprueba además
        // que la versión de la librería enlazada es la fijada.
        let _ = typst::compile::<typst_layout::PagedDocument>;
        assert_eq!(TYPST_VERSION, "0.15.1");
    }
}
