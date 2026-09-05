// =============================================================================
// DBV Typst Editor — Project Archive (.dbvt)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// RF-11 / ARCHITECTURE.md §7.12, diferido a v0.2 en el recorte de alcance del
// MVP. `.dbvt` es un ZIP normal con el árbol completo del proyecto más un
// `manifest.json` propio en la raíz del archivo — solo para checks de
// compatibilidad al importar, NUNCA para decidir cómo compilar (eso sigue
// siendo responsabilidad exclusiva de Typst).
//
// Mitigación de seguridad obligatoria (riesgo registrado en ARCHITECTURE.md
// §6): un ZIP puede traer entradas con `../` o rutas absolutas (zip-slip) que,
// sin comprobación, escribirían fuera de la carpeta de destino elegida por el
// usuario. `import_project_archive` se apoya en `enclosed_name()` de la propia
// crate `zip` (que ya rechaza esas rutas) y añade una segunda comprobación
// independiente antes de escribir nada a disco — defensa en profundidad, no
// confiar en una sola capa para algo que puede escribir fuera del proyecto.

use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::commands::file_io::is_noise;
use crate::error::AppError;
use crate::project::{self, Project};
use crate::typst_engine;

/// Nombre de la entrada propia dentro del ZIP — nunca colisiona con contenido
/// real de un proyecto Typst (que no tiene ningún fichero llamado así en su raíz).
const MANIFEST_ENTRY_NAME: &str = "manifest.json";

/// Metadatos de compatibilidad del archivo, no de compilación.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveManifest {
    pub app_version: String,
    #[serde(default)]
    pub typst_version: Option<String>,
    #[serde(default)]
    pub template_id: Option<String>,
    pub exported_at_ms: u64,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0)
}

/// Añade recursivamente el contenido de `dir` al ZIP, con rutas relativas a
/// `root` y saltando el mismo ruido de repositorio que el explorador de
/// proyecto (`.git`, `node_modules`, el espejo transitorio de vista previa...).
fn add_dir_to_zip<W: Write + std::io::Seek>(
    writer: &mut ZipWriter<W>,
    root: &Path,
    dir: &Path,
    options: SimpleFileOptions,
) -> Result<(), AppError> {
    let entries = fs::read_dir(dir).map_err(|error| AppError::Io(error.to_string()))?;
    for entry in entries {
        let entry = entry.map_err(|error| AppError::Io(error.to_string()))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if is_noise(&name) {
            continue;
        }

        let path = entry.path();
        let relative = path
            .strip_prefix(root)
            .map_err(|error| AppError::Io(error.to_string()))?;
        // Windows usa `\` en `Path`, pero el formato ZIP exige `/` en sus
        // nombres de entrada — sin esto, el archivo se abriría con carpetas
        // rotas en cualquier lector de ZIP estándar, incluida esta misma app.
        let entry_name = relative.to_string_lossy().replace('\\', "/");

        if path.is_dir() {
            add_dir_to_zip(writer, root, &path, options)?;
        } else {
            writer
                .start_file(entry_name, options)
                .map_err(|error| AppError::Io(error.to_string()))?;
            let contents = fs::read(&path).map_err(|error| AppError::Io(error.to_string()))?;
            writer
                .write_all(&contents)
                .map_err(|error| AppError::Io(error.to_string()))?;
        }
    }
    Ok(())
}

/// Selector nativo de un `.dbvt` a importar.
#[tauri::command]
pub async fn pick_archive_dialog(app: AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .add_filter("DBV Typst Archive", &["dbvt"])
        .blocking_pick_file()
        .map(|file| file.to_string())
}

/// Exporta `project_dir` a `output_path` como Project Archive `.dbvt`.
#[tauri::command]
pub async fn export_project_archive(
    app: AppHandle,
    project_dir: String,
    output_path: String,
) -> Result<(), AppError> {
    let root = PathBuf::from(&project_dir);
    if !root.is_dir() {
        return Err(AppError::InvalidPath(project_dir));
    }

    let template_id = project::read_project_manifest(project_dir.clone())
        .ok()
        .flatten()
        .and_then(|manifest| manifest.template_id);
    // Un fallo del sidecar no debe impedir exportar: el campo queda vacío y el
    // resto del manifiesto (lo que de verdad se usa al importar) sigue siendo válido.
    let typst_version = typst_engine::typst_version(app).await.ok();

    let manifest = ArchiveManifest {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        typst_version,
        template_id,
        exported_at_ms: now_ms(),
    };
    let manifest_json =
        serde_json::to_vec_pretty(&manifest).map_err(|error| AppError::Io(error.to_string()))?;

    let file = File::create(&output_path).map_err(|error| AppError::Io(error.to_string()))?;
    let mut writer = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    writer
        .start_file(MANIFEST_ENTRY_NAME, options)
        .map_err(|error| AppError::Io(error.to_string()))?;
    writer
        .write_all(&manifest_json)
        .map_err(|error| AppError::Io(error.to_string()))?;

    add_dir_to_zip(&mut writer, &root, &root, options)?;
    writer.finish().map_err(|error| AppError::Io(error.to_string()))?;
    Ok(())
}

/// Importa `archive_path` en `target_dir` (creada si no existe) y devuelve el
/// proyecto resultante, listo para abrir — mismo tipo que `open_project`.
#[tauri::command]
pub fn import_project_archive(archive_path: String, target_dir: String) -> Result<Project, AppError> {
    let archive_file = File::open(&archive_path).map_err(|error| AppError::Io(error.to_string()))?;
    let mut archive =
        ZipArchive::new(archive_file).map_err(|error| AppError::Parse(error.to_string()))?;

    let target_root = PathBuf::from(&target_dir);
    fs::create_dir_all(&target_root).map_err(|error| AppError::Io(error.to_string()))?;
    let canonical_root =
        fs::canonicalize(&target_root).map_err(|error| AppError::Io(error.to_string()))?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| AppError::Parse(error.to_string()))?;
        let entry_name = entry.name().to_string();
        // El manifiesto propio del archivo no es contenido del proyecto: no se
        // escribe dentro de la carpeta destino.
        if entry_name == MANIFEST_ENTRY_NAME {
            continue;
        }

        // `enclosed_name()` ya rechaza rutas con `..` o absolutas (protección
        // de zip-slip de la propia crate `zip`).
        let Some(relative) = entry.enclosed_name() else {
            return Err(AppError::Denied(format!(
                "entrada de archivo insegura: {entry_name}"
            )));
        };

        let dest_path = canonical_root.join(&relative);
        // Segunda comprobación, independiente de la anterior: la ruta
        // resultante debe seguir dentro de `canonical_root` — defensa en
        // profundidad, no confiar en una sola capa para algo que escribe en disco.
        if !dest_path.starts_with(&canonical_root) {
            return Err(AppError::Denied(format!(
                "entrada fuera del destino: {entry_name}"
            )));
        }

        if entry.is_dir() {
            fs::create_dir_all(&dest_path).map_err(|error| AppError::Io(error.to_string()))?;
        } else {
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent).map_err(|error| AppError::Io(error.to_string()))?;
            }
            let mut out_file =
                File::create(&dest_path).map_err(|error| AppError::Io(error.to_string()))?;
            std::io::copy(&mut entry, &mut out_file).map_err(|error| AppError::Io(error.to_string()))?;
        }
    }

    project::describe(&canonical_root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::file_io::path_to_string;

    fn write_temp(dir: &Path, relative: &str, contents: &str) -> PathBuf {
        let path = dir.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&path, contents).unwrap();
        path
    }

    /// Construye un `.dbvt` de prueba directamente con la crate `zip`, sin
    /// pasar por `export_project_archive` (que necesita un `AppHandle` real):
    /// exactamente lo que produciría un export, más una entrada maliciosa.
    fn build_archive_with_entries(entries: &[(&str, &str)]) -> PathBuf {
        let dir = tempfile::tempdir().unwrap();
        let archive_path = dir.path().join("proyecto.dbvt");
        let file = File::create(&archive_path).unwrap();
        let mut writer = ZipWriter::new(file);
        let options = SimpleFileOptions::default();
        for (name, contents) in entries {
            writer.start_file(*name, options).unwrap();
            writer.write_all(contents.as_bytes()).unwrap();
        }
        writer.finish().unwrap();
        // El TempDir se libera al salir de esta función; hay que persistir la
        // ruta antes de que eso ocurra, dejando el fichero suelto en el temp
        // del sistema (limpieza del propio SO, igual que otros scripts del
        // proyecto que ya asumen esto para fixtures de un solo uso).
        std::mem::forget(dir);
        archive_path
    }

    #[test]
    fn export_e_import_reproducen_el_arbol_del_proyecto() {
        let source = tempfile::tempdir().unwrap();
        write_temp(source.path(), "main.typ", "= Título\n");
        write_temp(source.path(), "chapters/01.typ", "Contenido");
        fs::create_dir_all(source.path().join(".git")).unwrap();
        write_temp(source.path(), ".git/HEAD", "ref: refs/heads/master");

        let archive_path = build_archive_with_entries(&[
            (MANIFEST_ENTRY_NAME, r#"{"appVersion":"0.1.0","exportedAtMs":0}"#),
            ("main.typ", "= Título\n"),
            ("chapters/01.typ", "Contenido"),
        ]);

        let target = tempfile::tempdir().unwrap();
        let imported = import_project_archive(
            path_to_string(&archive_path),
            path_to_string(&target.path().join("nuevo")),
        )
        .unwrap();

        assert_eq!(imported.entrypoint.as_deref(), Some("main.typ"));
        assert!(!target.path().join("nuevo").join(MANIFEST_ENTRY_NAME).exists());
        assert_eq!(
            fs::read_to_string(target.path().join("nuevo/chapters/01.typ")).unwrap(),
            "Contenido"
        );
    }

    #[test]
    fn export_ignora_el_ruido_de_repositorio() {
        let source = tempfile::tempdir().unwrap();
        write_temp(source.path(), "main.typ", "= Título");
        fs::create_dir_all(source.path().join(".git")).unwrap();
        write_temp(source.path(), ".git/HEAD", "ref: refs/heads/master");
        fs::create_dir_all(source.path().join("node_modules")).unwrap();
        write_temp(source.path(), "node_modules/paquete.js", "");

        // El `.dbvt` de salida vive FUERA del árbol que se empaqueta: si
        // estuviera dentro, `add_dir_to_zip` se incluiría a sí mismo a medio
        // escribir.
        let output_dir = tempfile::tempdir().unwrap();
        let output = output_dir.path().join("salida.dbvt");
        let file = File::create(&output).unwrap();
        let mut writer = ZipWriter::new(file);
        let options = SimpleFileOptions::default();
        add_dir_to_zip(&mut writer, source.path(), source.path(), options).unwrap();
        writer.finish().unwrap();

        let mut archive = ZipArchive::new(File::open(&output).unwrap()).unwrap();
        let names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_string())
            .collect();
        assert_eq!(names, vec!["main.typ".to_string()]);
    }

    #[test]
    fn export_incluye_las_fuentes_propias_del_proyecto() {
        // Media función de `fonts/` (typst_engine::font_path_args) depende de
        // esto: si el `.dbvt` no se las llevara, el proyecto seguiría sin
        // componerse igual en la máquina de destino, que es justo lo que la
        // carpeta existe para resolver.
        let source = tempfile::tempdir().unwrap();
        write_temp(source.path(), "main.typ", "= Título");
        write_temp(source.path(), "fonts/MiFuente.ttf", "binario de prueba");

        let output_dir = tempfile::tempdir().unwrap();
        let output = output_dir.path().join("salida.dbvt");
        let file = File::create(&output).unwrap();
        let mut writer = ZipWriter::new(file);
        add_dir_to_zip(
            &mut writer,
            source.path(),
            source.path(),
            SimpleFileOptions::default(),
        )
        .unwrap();
        writer.finish().unwrap();

        let mut archive = ZipArchive::new(File::open(&output).unwrap()).unwrap();
        let names: Vec<String> = (0..archive.len())
            .map(|i| archive.by_index(i).unwrap().name().to_string())
            .collect();
        assert!(
            names.iter().any(|name| name == "fonts/MiFuente.ttf"),
            "las fuentes del proyecto deben viajar en el .dbvt, entradas: {names:?}"
        );
    }

    #[test]
    fn import_rechaza_una_entrada_con_recorrido_de_directorio() {
        let archive_path = build_archive_with_entries(&[
            (MANIFEST_ENTRY_NAME, "{}"),
            ("../fuera-del-proyecto.typ", "malicioso"),
        ]);
        let target = tempfile::tempdir().unwrap();

        let result = import_project_archive(
            path_to_string(&archive_path),
            path_to_string(&target.path().join("nuevo")),
        );
        assert!(matches!(result, Err(AppError::Denied(_))));
        assert!(!target.path().join("fuera-del-proyecto.typ").exists());
    }

    #[test]
    fn import_crea_la_carpeta_destino_si_no_existe() {
        let archive_path = build_archive_with_entries(&[
            (MANIFEST_ENTRY_NAME, "{}"),
            ("main.typ", "= Título"),
        ]);
        let target = tempfile::tempdir().unwrap();
        let destino = target.path().join("no-existe-todavia");

        let imported = import_project_archive(path_to_string(&archive_path), path_to_string(&destino)).unwrap();
        assert_eq!(imported.root, path_to_string(&fs::canonicalize(&destino).unwrap()));
    }

    #[test]
    fn el_manifiesto_del_archivo_serializa_en_camel_case() {
        let manifest = ArchiveManifest {
            app_version: "0.1.0".to_string(),
            typst_version: Some("0.15.1".to_string()),
            template_id: Some("dbv-tfg".to_string()),
            exported_at_ms: 1_700_000_000_000,
        };
        let json = serde_json::to_string(&manifest).unwrap();
        assert!(json.contains(r#""appVersion":"0.1.0""#));
        assert!(json.contains(r#""typstVersion":"0.15.1""#));
        assert!(json.contains(r#""exportedAtMs":1700000000000"#));
    }

    #[test]
    fn manifest_sin_campos_opcionales_se_deserializa() {
        let manifest: ArchiveManifest =
            serde_json::from_str(r#"{"appVersion":"0.1.0","exportedAtMs":0}"#).unwrap();
        assert_eq!(manifest.typst_version, None);
        assert_eq!(manifest.template_id, None);
    }
}
