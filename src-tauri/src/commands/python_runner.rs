// =============================================================================
// DBV Typst Editor — Runner de scripts Python y generador de figuras (RF-22)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Permite ejecutar scripts de análisis, matemáticas o ciencia de datos en Python
// de forma asíncrona dentro del proyecto, configurando automáticamente el backend
// sin interfaz gráfica (MPLBACKEND=Agg) y detectando las imágenes generadas
// en la carpeta `images/` para su inserción directa en Typst.
// Gestiona entornos virtuales locales (.venv) o un entorno compartido en AppData
// para evitar duplicar paquetes científicos en cada documento.

use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant, SystemTime};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::error::AppError;

const DEFAULT_TIMEOUT_SECS: u64 = 15;
const MAX_TIMEOUT_SECS: u64 = 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonRunResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub generated_images: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PythonStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub interpreter_path: Option<String>,
    pub interpreter_kind: String, // "project_venv" | "shared_env" | "system_venv" | "system" | "none"
    pub has_matplotlib: bool,
    pub os: String, // "windows" | "macos" | "linux"
}

/// Detecta el ejecutable de Python disponible en el PATH del sistema.
pub fn find_python_executable() -> Option<String> {
    let candidates = if cfg!(windows) {
        vec!["python", "python3", "py"]
    } else {
        vec!["python3", "python"]
    };

    for candidate in candidates {
        let mut cmd = Command::new(candidate);
        cmd.arg("--version");
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                return Some(candidate.to_string());
            }
        }
    }
    None
}

/// Devuelve el ejecutable python dentro de una carpeta virtualenv según el SO.
pub fn get_venv_python(venv_dir: &Path) -> Option<PathBuf> {
    if !venv_dir.is_dir() {
        return None;
    }
    let candidate = if cfg!(windows) {
        venv_dir.join("Scripts").join("python.exe")
    } else {
        venv_dir.join("bin").join("python")
    };
    if candidate.is_file() {
        Some(candidate)
    } else {
        None
    }
}

/// Resuelve el mejor intérprete de Python siguiendo la jerarquía:
/// 1. venv local del proyecto (.venv o venv)
/// 2. entorno compartido de DBV Typst Editor en app_data_dir
/// 3. venv activo en la sesión (VIRTUAL_ENV o CONDA_PREFIX)
/// 4. Python en el PATH del sistema
pub fn resolve_python_interpreter(
    app: Option<&AppHandle>,
    project_root: Option<&Path>,
) -> (Option<PathBuf>, String) {
    // 1. Proyecto local .venv
    if let Some(root) = project_root {
        if let Some(p) = get_venv_python(&root.join(".venv")) {
            return (Some(p), "project_venv".to_string());
        }
        if let Some(p) = get_venv_python(&root.join("venv")) {
            return (Some(p), "project_venv".to_string());
        }
    }

    // 2. Entorno compartido en app_data_dir
    if let Some(app_handle) = app {
        if let Ok(app_dir) = app_handle.path().app_data_dir() {
            let shared = app_dir.join("python-env");
            if let Some(p) = get_venv_python(&shared) {
                return (Some(p), "shared_env".to_string());
            }
        }
    }

    // 3. Variable VIRTUAL_ENV o CONDA_PREFIX
    if let Ok(v) = std::env::var("VIRTUAL_ENV") {
        if let Some(p) = get_venv_python(Path::new(&v)) {
            return (Some(p), "system_venv".to_string());
        }
    }
    if let Ok(v) = std::env::var("CONDA_PREFIX") {
        if let Some(p) = get_venv_python(Path::new(&v)) {
            return (Some(p), "system_venv".to_string());
        }
    }

    // 4. Intérprete del sistema
    if let Some(p) = find_python_executable() {
        return (Some(PathBuf::from(p)), "system".to_string());
    }

    (None, "none".to_string())
}

/// Comprueba el estado de Python y sus librerías de forma síncrona.
pub fn get_status_sync(
    app: Option<&AppHandle>,
    project_root: Option<&Path>,
) -> Result<PythonStatus, String> {
    let (interpreter, kind) = resolve_python_interpreter(app, project_root);
    let os = if cfg!(target_os = "windows") {
        "windows".to_string()
    } else if cfg!(target_os = "macos") {
        "macos".to_string()
    } else {
        "linux".to_string()
    };

    if let Some(interp) = interpreter {
        let mut ver_cmd = Command::new(&interp);
        ver_cmd.arg("--version");
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            ver_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        let version = ver_cmd.output().ok().and_then(|o| {
            if o.status.success() {
                let out = String::from_utf8_lossy(&o.stdout).trim().to_string();
                if out.is_empty() {
                    Some(String::from_utf8_lossy(&o.stderr).trim().to_string())
                } else {
                    Some(out)
                }
            } else {
                None
            }
        });

        let mut test_cmd = Command::new(&interp);
        test_cmd.args(["-c", "import matplotlib, numpy; print('OK')"]);
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            test_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        let has_matplotlib = test_cmd
            .output()
            .map(|o| o.status.success() && String::from_utf8_lossy(&o.stdout).contains("OK"))
            .unwrap_or(false);

        Ok(PythonStatus {
            installed: true,
            version,
            interpreter_path: Some(interp.to_string_lossy().to_string()),
            interpreter_kind: kind,
            has_matplotlib,
            os,
        })
    } else {
        Ok(PythonStatus {
            installed: false,
            version: None,
            interpreter_path: None,
            interpreter_kind: "none".to_string(),
            has_matplotlib: false,
            os,
        })
    }
}

/// Obtiene el mapa de imágenes existentes en `images/` y sus timestamps de modificación.
fn snapshot_images(images_dir: &Path) -> HashMap<String, SystemTime> {
    let mut map = HashMap::new();
    if !images_dir.is_dir() {
        return map;
    }
    if let Ok(entries) = fs::read_dir(images_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ["png", "svg", "pdf", "jpg", "jpeg"].contains(&ext_lower.as_str()) {
                        let mtime = entry
                            .metadata()
                            .and_then(|m| m.modified())
                            .unwrap_or(SystemTime::UNIX_EPOCH);
                        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                            map.insert(name.to_string(), mtime);
                        }
                    }
                }
            }
        }
    }
    map
}

/// Ejecuta de forma síncrona el script en un hilo dedicado con timeout.
pub fn run_python_sync(
    root: PathBuf,
    interpreter: Option<PathBuf>,
    code: String,
    timeout: Duration,
) -> Result<PythonRunResult, AppError> {
    let python = interpreter
        .or_else(|| find_python_executable().map(PathBuf::from))
        .ok_or_else(|| {
            AppError::NotFound("Python no está instalado o no se encuentra en el PATH.".to_string())
        })?;

    let images_dir = root.join("images");
    let _ = fs::create_dir_all(&images_dir);
    let before_images = snapshot_images(&images_dir);

    let script_path = root.join(".dbv-python-run.tmp.py");
    fs::write(&script_path, &code).map_err(|e| AppError::Io(e.to_string()))?;

    let mut cmd = Command::new(&python);
    cmd.arg(&script_path)
        .current_dir(&root)
        .env("MPLBACKEND", "Agg")
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUNBUFFERED", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| {
        let _ = fs::remove_file(&script_path);
        AppError::Io(format!("Fallo al iniciar subproceso Python: {e}"))
    })?;

    // Las tuberías se vacían en hilos aparte MIENTRAS el hijo corre, no después.
    // Leerlas al final parecía equivalente y no lo era: el búfer de una tubería
    // ronda los 64 KB, así que un script que imprime más que eso se bloqueaba al
    // llenarlo, no terminaba nunca, y el bucle de abajo agotaba el timeout
    // entero. El usuario veía "tiempo de ejecución excedido" en un script
    // perfectamente correcto — un `print` de un DataFrame grande o una
    // compilación verbosa llegan a ese tamaño sin esfuerzo.
    //
    // `read_to_string` termina solo cuando el hijo cierra su extremo, así que
    // estos hilos acaban también si el proceso muere por el timeout.
    let mut salida = child.stdout.take();
    let mut errores = child.stderr.take();
    let hilo_stdout = std::thread::spawn(move || {
        let mut texto = String::new();
        if let Some(pipe) = salida.as_mut() {
            let _ = pipe.read_to_string(&mut texto);
        }
        texto
    });
    let hilo_stderr = std::thread::spawn(move || {
        let mut texto = String::new();
        if let Some(pipe) = errores.as_mut() {
            let _ = pipe.read_to_string(&mut texto);
        }
        texto
    });

    let start = Instant::now();
    let mut timed_out = false;
    let mut exit_code = None;

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                exit_code = status.code();
                break;
            }
            Ok(None) => {
                if start.elapsed() >= timeout {
                    timed_out = true;
                    let _ = child.kill();
                    let _ = child.wait();
                    break;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                let _ = fs::remove_file(&script_path);
                return Err(AppError::Io(format!("Error en subproceso: {e}")));
            }
        }
    }

    let _ = fs::remove_file(&script_path);

    // Recoger lo que los hilos hayan leído. Si uno entrase en pánico, se pierde
    // ese flujo pero no la ejecución entera: el resultado sigue siendo útil.
    let stdout = hilo_stdout.join().unwrap_or_default();
    let stderr = hilo_stderr.join().unwrap_or_default();

    if timed_out {
        return Ok(PythonRunResult {
            success: false,
            stdout,
            stderr: format!(
                "Tiempo de ejecución excedido (límite de {}s)",
                timeout.as_secs()
            ),
            exit_code: None,
            generated_images: Vec::new(),
        });
    }

    let after_images = snapshot_images(&images_dir);
    let mut generated_images = Vec::new();
    for (name, mtime) in after_images {
        match before_images.get(&name) {
            Some(prev_mtime) => {
                if mtime > *prev_mtime {
                    generated_images.push(format!("images/{name}"));
                }
            }
            None => {
                generated_images.push(format!("images/{name}"));
            }
        }
    }
    generated_images.sort();

    let success = exit_code == Some(0);

    Ok(PythonRunResult {
        success,
        stdout,
        stderr,
        exit_code,
        generated_images,
    })
}

/// Comando Tauri para comprobar el estado de Python y librerías científicas.
#[tauri::command]
pub async fn check_python_status(
    app: AppHandle,
    project_root: Option<String>,
) -> Result<PythonStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = project_root.map(PathBuf::from);
        get_status_sync(Some(&app), root.as_deref())
    })
    .await
    .map_err(|e| format!("Fallo en tarea: {e}"))?
}

/// Comando Tauri para configurar el entorno virtual compartido en AppData.
#[tauri::command]
pub async fn setup_shared_python_env(app: AppHandle) -> Result<PythonStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let app_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("No se pudo resolver app_data_dir: {e}"))?;
        let shared_env_dir = app_dir.join("python-env");
        fs::create_dir_all(&app_dir).map_err(|e| format!("Fallo al crear directorio de app: {e}"))?;

        let sys_python = find_python_executable()
            .ok_or_else(|| "Python no está instalado en el sistema.".to_string())?;

        let python_bin = match get_venv_python(&shared_env_dir) {
            Some(p) => p,
            None => {
                let mut venv_cmd = Command::new(&sys_python);
                venv_cmd.args(["-m", "venv"]).arg(&shared_env_dir);
                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    venv_cmd.creation_flags(0x08000000);
                }
                let status = venv_cmd
                    .status()
                    .map_err(|e| format!("Fallo al ejecutar venv: {e}"))?;
                if !status.success() {
                    return Err("Error al crear el entorno virtual compartido.".to_string());
                }
                get_venv_python(&shared_env_dir)
                    .ok_or_else(|| "No se encontró el ejecutable de Python en el nuevo venv.".to_string())?
            }
        };

        // Comprobar si `uv` está disponible en el PATH para instalación ultrarrápida
        let mut has_uv = false;
        if let Ok(uv_out) = Command::new("uv").arg("--version").output() {
            if uv_out.status.success() {
                has_uv = true;
            }
        }

        if has_uv {
            let mut uv_cmd = Command::new("uv");
            uv_cmd
                .args(["pip", "install", "--python"])
                .arg(&python_bin)
                .args(["matplotlib", "numpy", "pandas"]);
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                uv_cmd.creation_flags(0x08000000);
            }
            let _ = uv_cmd.status();
        } else {
            let mut pip_cmd = Command::new(&python_bin);
            pip_cmd.args(["-m", "pip", "install", "matplotlib", "numpy", "pandas"]);
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                pip_cmd.creation_flags(0x08000000);
            }
            let _ = pip_cmd.status();
        }

        get_status_sync(Some(&app), None)
    })
    .await
    .map_err(|e| format!("Fallo en tarea: {e}"))?
}

/// Comando Tauri para ejecutar un script Python en segundo plano.
#[tauri::command]
pub async fn execute_python_script(
    app: AppHandle,
    project_path: String,
    code: String,
    timeout_seconds: Option<u64>,
) -> Result<PythonRunResult, AppError> {
    let root = PathBuf::from(&project_path);
    if !root.is_dir() {
        return Err(AppError::InvalidPath(project_path));
    }

    let timeout = Duration::from_secs(
        timeout_seconds
            .unwrap_or(DEFAULT_TIMEOUT_SECS)
            .clamp(1, MAX_TIMEOUT_SECS),
    );

    let (interpreter, _kind) = resolve_python_interpreter(Some(&app), Some(&root));

    tauri::async_runtime::spawn_blocking(move || run_python_sync(root, interpreter, code, timeout))
        .await
        .map_err(|e| AppError::Io(format!("Error en tarea asíncrona: {e}")))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn find_python_executable_detecta_o_degrada_limpiamente() {
        let _ = find_python_executable();
    }

    #[test]
    fn get_venv_python_reconoce_carpeta_inexistente() {
        let fake = PathBuf::from("ruta/inexistente/venv");
        assert!(get_venv_python(&fake).is_none());
    }

    #[test]
    fn run_python_sync_ejecuta_y_captura_stdout() {
        if find_python_executable().is_none() {
            return;
        }
        let temp = TempDir::new().unwrap();
        let result = run_python_sync(
            temp.path().to_path_buf(),
            None,
            "print('hola desde python')".to_string(),
            Duration::from_secs(5),
        )
        .unwrap();

        assert!(result.success);
        assert_eq!(result.exit_code, Some(0));
        assert!(result.stdout.contains("hola desde python"));
        assert!(result.stderr.is_empty());
    }

    #[test]
    fn run_python_sync_detecta_imagenes_generadas() {
        if find_python_executable().is_none() {
            return;
        }
        let temp = TempDir::new().unwrap();
        let script = r#"
from pathlib import Path
images_dir = Path("images")
images_dir.mkdir(exist_ok=True)
(images_dir / "grafica.png").write_bytes(b"\x89PNG\r\n\x1a\n")
print("Imagen escrita")
"#;
        let result = run_python_sync(
            temp.path().to_path_buf(),
            None,
            script.to_string(),
            Duration::from_secs(5),
        )
        .unwrap();

        assert!(result.success);
        assert_eq!(result.generated_images, vec!["images/grafica.png"]);
    }

    #[test]
    fn run_python_sync_captura_errores_en_stderr() {
        if find_python_executable().is_none() {
            return;
        }
        let temp = TempDir::new().unwrap();
        let result = run_python_sync(
            temp.path().to_path_buf(),
            None,
            "raise ValueError('error intencional')".to_string(),
            Duration::from_secs(5),
        )
        .unwrap();

        assert!(!result.success);
        assert_ne!(result.exit_code, Some(0));
        assert!(result.stderr.contains("ValueError: error intencional"));
    }

    #[test]
    fn run_python_sync_aplica_timeout() {
        if find_python_executable().is_none() {
            return;
        }
        let temp = TempDir::new().unwrap();
        let result = run_python_sync(
            temp.path().to_path_buf(),
            None,
            "import time\ntime.sleep(5)".to_string(),
            Duration::from_secs(1),
        )
        .unwrap();

        assert!(!result.success);
        assert!(result.stderr.contains("Tiempo de ejecución excedido"));
    }

    // Las tuberías del sistema operativo tienen un búfer de unos 64 KB. Si el
    // padre no las vacía mientras el hijo escribe, el hijo se BLOQUEA al llenar
    // ese búfer y nunca termina: la ejecución agota el timeout entero y el
    // usuario ve "tiempo excedido" en un script que funcionaba. Un `print` de un
    // DataFrame grande o una compilación verbosa lo alcanzan sin esfuerzo.
    #[test]
    fn run_python_sync_no_se_bloquea_con_una_salida_grande() {
        if find_python_executable().is_none() {
            return;
        }
        let temp = TempDir::new().unwrap();
        let inicio = Instant::now();

        let result = run_python_sync(
            temp.path().to_path_buf(),
            None,
            "print('x' * 300000)".to_string(),
            Duration::from_secs(30),
        )
        .unwrap();

        assert!(result.success, "stderr: {}", result.stderr);
        assert!(
            result.stdout.len() >= 300_000,
            "salida truncada: {} bytes",
            result.stdout.len()
        );
        assert!(
            inicio.elapsed() < Duration::from_secs(15),
            "tardó {:?}: se está agotando el timeout en vez de terminar",
            inicio.elapsed()
        );
    }
}
