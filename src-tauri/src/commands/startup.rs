// =============================================================================
// DBV Typst Editor — Apertura desde el sistema operativo
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La asociación de fichero `.typ` (RF-12) hace que el SO arranque la aplicación
// con el documento que el usuario ha abierto. Este módulo lo traduce a algo que
// el frontend pueda pedir al arrancar, sin que tenga que saber nada de `argv` ni
// de convenciones de plataforma. Y son dos convenciones distintas
// (NATIVE_DESKTOP_APPS.md §8):
//
// - Windows y Linux pasan la ruta como argumento de línea de comandos.
// - macOS no: Finder entrega la apertura como un Apple Event `kAEOpenDocuments`,
//   que Tauri expone solo vía `RunEvent::Opened { urls }` —y que llega *antes*
//   de que exista ninguna ventana. De ahí `PendingDocument`: guarda la ruta
//   hasta que el frontend está vivo para recogerla.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State, Url};

use crate::commands::file_io::{has_extension, path_to_string, TYPST_EXTENSIONS};

/// True si el sistema puede pedirle a la aplicación que abra `path`: una
/// CARPETA existente (se abre como proyecto) o un fichero Typst existente.
///
/// Es el único criterio de aceptación de las dos vías de entrada (`argv` y
/// Apple Events), para que no puedan divergir. Las carpetas entran para el
/// comando de consola `typs <carpeta>` del Cask de Homebrew; `open_project` ya
/// las trata igual que a un `.typ` suelto, así que el frontend no cambia.
fn is_openable(path: &Path) -> bool {
    path.is_dir() || (has_extension(&path_to_string(path), &TYPST_EXTENSIONS) && path.is_file())
}

/// Primer argumento que parece algo abrible: un documento Typst o una carpeta.
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
        .find(|argument| is_openable(Path::new(argument)));
    found
}

/// Convierte a absolutas, contra `cwd`, las rutas relativas de `args`.
///
/// La segunda ejecución de la aplicación no abre nada: el plugin de instancia
/// única reenvía su `argv` a la PRIMERA, que tiene su propio directorio de
/// trabajo. Sin esto, `typs .` o `typs tesis.typ` desde un terminal, con la app
/// ya abierta, se resolvería contra la carpeta donde arrancó la primera vez. El
/// argumento 0 (el ejecutable) y las banderas no se tocan; un argumento que no
/// fuera una ruta se queda como una ruta inexistente y se descarta después.
pub fn absolutize_arguments<I: IntoIterator<Item = String>>(args: I, cwd: &str) -> Vec<String> {
    args.into_iter()
        .enumerate()
        .map(|(index, argument)| {
            let is_relative_path = index > 0 && !argument.starts_with('-') && Path::new(&argument).is_relative();
            if is_relative_path {
                path_to_string(&Path::new(cwd).join(&argument))
            } else {
                argument
            }
        })
        .collect()
}

/// Primer documento Typst o carpeta de una lista de URLs `file://` (Apple Events
/// de macOS).
///
/// Hermana de `first_document_argument` para el otro camino de entrada, con el
/// mismo criterio de aceptación —extensión y existencia en disco— para que las
/// dos plataformas no puedan divergir en qué consideran abrible. `to_file_path`
/// es lo que deshace el escapado de la URL: sin él, un `tesis de doña.typ`
/// llegaría como `tesis%20de%20do%C3%B1a.typ` y no existiría en disco.
pub fn first_document_url<I: IntoIterator<Item = Url>>(urls: I) -> Option<String> {
    urls.into_iter()
        .filter(|url| url.scheme() == "file")
        .filter_map(|url| url.to_file_path().ok())
        .find(|path| is_openable(path))
        .map(|path| path_to_string(&path))
}

/// Documento que el SO ha pedido abrir por Apple Event antes de que el frontend
/// pudiera escucharlo. Estado gestionado porque `RunEvent::Opened` puede llegar
/// en cualquier momento —incluso antes de que exista la ventana principal.
#[derive(Default)]
pub struct PendingDocument {
    path: Mutex<Option<String>>,
    /// El frontend ya ha llamado a `startup_document`, luego su listener de
    /// `open-document` está registrado y podemos emitirle eventos.
    frontend_ready: AtomicBool,
}

/// Entrega a la interfaz un documento pedido por el sistema: si el frontend ya
/// arrancó se le emite; si no, se guarda para que lo recoja en su llamada
/// inicial a `startup_document`.
pub fn deliver(app: &AppHandle, document: String) {
    let pending = app.state::<PendingDocument>();
    if pending.frontend_ready.load(Ordering::SeqCst) {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
        let _ = app.emit("open-document", document);
    } else if let Ok(mut slot) = pending.path.lock() {
        *slot = Some(document);
    }
}

/// Documento con el que se ha arrancado la aplicación, si lo hay.
///
/// El frontend lo consulta una vez al iniciarse: si viene una ruta, abre ese
/// documento en lugar de mostrar el lanzador. Prevalece lo que haya llegado por
/// Apple Event (macOS); si no hay nada, se mira `argv` (Windows y Linux).
#[tauri::command]
pub fn startup_document(pending: State<PendingDocument>) -> Option<String> {
    pending.frontend_ready.store(true, Ordering::SeqCst);
    let from_event = pending.path.lock().ok().and_then(|mut slot| slot.take());
    from_event.or_else(|| first_document_argument(std::env::args()))
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

    #[test]
    fn devuelve_una_carpeta_existente_pasada_por_argumento() {
        // `typs .` / `typs tesis/` desde la consola: la carpeta se abre como
        // proyecto, igual que desde el lanzador.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_string_lossy().to_string();

        let resultado = first_document_argument(args(&["app.exe", &path]));
        assert_eq!(resultado, Some(path));
    }

    #[test]
    fn descarta_una_carpeta_que_no_existe() {
        assert_eq!(first_document_argument(args(&["app.exe", "no-existe-dbv-carpeta"])), None);
    }

    #[test]
    fn una_carpeta_no_se_confunde_con_una_bandera() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().to_string_lossy().to_string();

        let resultado = first_document_argument(args(&["app.exe", "--verbose", &path]));
        assert_eq!(resultado, Some(path));
    }

    #[test]
    fn absolutize_resuelve_lo_relativo_contra_el_directorio_de_trabajo() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("tesis.typ");
        std::fs::write(&file, "= Hola").unwrap();
        let cwd = dir.path().to_string_lossy().to_string();

        let absolutas = absolutize_arguments(args(&["app.exe", "tesis.typ"]), &cwd);

        assert_eq!(first_document_argument(absolutas), Some(path_to_string(&file)));
    }

    #[test]
    fn absolutize_no_toca_el_ejecutable_ni_las_banderas_ni_lo_ya_absoluto() {
        let dir = tempfile::tempdir().unwrap();
        let absoluta = dir.path().to_string_lossy().to_string();

        let resultado = absolutize_arguments(args(&["app.exe", "--verbose", &absoluta]), "/otro/sitio");

        assert_eq!(resultado, vec!["app.exe".to_string(), "--verbose".to_string(), absoluta]);
    }

    #[test]
    fn absolutize_permite_abrir_la_carpeta_actual_con_un_punto() {
        // `typs .` desde la carpeta del proyecto.
        let dir = tempfile::tempdir().unwrap();
        let cwd = dir.path().to_string_lossy().to_string();

        let resultado = first_document_argument(absolutize_arguments(args(&["app.exe", "."]), &cwd));

        assert!(resultado.is_some(), "la carpeta actual debe ser abrible");
    }

    // ─── Apple Events (macOS) ────────────────────────────────────────────────

    fn escribir(dir: &Path, nombre: &str) -> std::path::PathBuf {
        let file = dir.join(nombre);
        std::fs::write(&file, "= Hola").unwrap();
        file
    }

    #[test]
    fn devuelve_el_documento_de_una_url_file() {
        let dir = tempfile::tempdir().unwrap();
        let file = escribir(dir.path(), "tesis.typ");
        let url = Url::from_file_path(&file).unwrap();

        assert_eq!(first_document_url([url]), Some(path_to_string(&file)));
    }

    #[test]
    fn decodifica_espacios_y_acentos_de_la_url() {
        // Finder escapa la ruta: `tesis de doña.typ` viaja como
        // `tesis%20de%20do%C3%B1a.typ`. Sin decodificar, no existe en disco.
        let dir = tempfile::tempdir().unwrap();
        let file = escribir(dir.path(), "tesis de doña.typ");
        let url = Url::from_file_path(&file).unwrap();
        assert!(url.as_str().contains("%20"), "la URL debería venir escapada");

        assert_eq!(first_document_url([url]), Some(path_to_string(&file)));
    }

    #[test]
    fn toma_el_primer_typ_de_una_seleccion_multiple() {
        let dir = tempfile::tempdir().unwrap();
        let notas = dir.path().join("notas.md");
        std::fs::write(&notas, "# no").unwrap();
        let file = escribir(dir.path(), "tesis.typ");

        let urls = [
            Url::from_file_path(&notas).unwrap(),
            Url::from_file_path(&file).unwrap(),
        ];
        assert_eq!(first_document_url(urls), Some(path_to_string(&file)));
    }

    #[test]
    fn devuelve_la_carpeta_de_una_url_file() {
        // `open -a "DBV Typst Editor" carpeta` llega como Apple Event con la URL
        // de la carpeta.
        let dir = tempfile::tempdir().unwrap();
        let url = Url::from_directory_path(dir.path()).unwrap();

        let resultado = first_document_url([url]).expect("una carpeta existente es abrible");
        assert_eq!(Path::new(&resultado), dir.path());
    }

    #[test]
    fn descarta_una_url_a_un_typ_inexistente() {
        let dir = tempfile::tempdir().unwrap();
        let url = Url::from_file_path(dir.path().join("no-existe-dbv.typ")).unwrap();
        assert_eq!(first_document_url([url]), None);
    }

    #[test]
    fn descarta_urls_que_no_son_file() {
        let url = Url::parse("https://typst.app/tesis.typ").unwrap();
        assert_eq!(first_document_url([url]), None);
    }

    #[test]
    fn sin_urls_no_hay_documento() {
        assert_eq!(first_document_url([]), None);
    }
}
