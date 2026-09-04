// =============================================================================
// DBV Typst Editor — Apertura desde el sistema operativo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La asociación de fichero `.typ` (RF-12) hace que el SO arranque la aplicación
// pasándole la ruta del documento como argumento. Este módulo lo traduce a algo
// que el frontend pueda pedir al arrancar, sin que tenga que saber nada de
// `argv` ni de convenciones de plataforma.

use std::path::Path;

use crate::commands::file_io::{has_extension, TYPST_EXTENSIONS};

/// Primer argumento que parece un documento Typst.
///
/// Función pura sobre un iterador de argumentos —no sobre `std::env::args()`
/// directamente— para poder testear los casos que en la práctica rompen esto:
/// el argumento 0 es el propio ejecutable, y en desarrollo Tauri añade sus
/// propias banderas (`--no-default-features`, `--`, rutas del proyecto…).
pub fn first_document_argument<I: IntoIterator<Item = String>>(args: I) -> Option<String> {
    let found = args
        .into_iter()
        .skip(1)
        .filter(|argument| !argument.starts_with('-'))
        .find(|argument| has_extension(argument, &TYPST_EXTENSIONS) && Path::new(argument).is_file());
    found
}

/// Documento con el que se ha arrancado la aplicación, si lo hay.
///
/// El frontend lo consulta una vez al iniciarse: si viene una ruta, abre ese
/// documento en lugar de mostrar el lanzador.
#[tauri::command]
pub fn startup_document() -> Option<String> {
    first_document_argument(std::env::args())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|item| item.to_string()).collect()
    }

    #[test]
    fn ignora_el_ejecutable_aunque_se_llame_como_un_typ() {
        // El argumento 0 nunca es el documento, ni siquiera si la ruta encaja.
        assert_eq!(first_document_argument(args(&["main.typ"])), None);
    }

    #[test]
    fn ignora_las_banderas_del_entorno_de_desarrollo() {
        let resultado = first_document_argument(args(&["app.exe", "--no-default-features", "-v"]));
        assert_eq!(resultado, None);
    }

    #[test]
    fn devuelve_el_documento_existente_pasado_por_el_sistema() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("tesis.typ");
        std::fs::write(&file, "= Hola").unwrap();
        let path = file.to_string_lossy().to_string();

        let resultado = first_document_argument(args(&["app.exe", &path]));
        assert_eq!(resultado, Some(path));
    }

    #[test]
    fn descarta_una_ruta_typ_que_no_existe_en_disco() {
        // Un argumento con pinta de documento pero inexistente abriría la app
        // con un error en la cara en vez de con su lanzador.
        assert_eq!(
            first_document_argument(args(&["app.exe", "no-existe-dbv.typ"])),
            None
        );
    }

    #[test]
    fn descarta_ficheros_que_no_son_typst() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("notas.md");
        std::fs::write(&file, "# no").unwrap();

        let resultado = first_document_argument(args(&["app.exe", &file.to_string_lossy()]));
        assert_eq!(resultado, None);
    }
}
