// =============================================================================
// DBV Typst Editor — Integración con Git CLI (RF-19)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Proporciona comandos no bloqueantes para inspeccionar el estado de Git,
// realizar commits, push y pull sin colgar la interfaz ante peticiones de
// credenciales interactivas (GIT_TERMINAL_PROMPT=0).

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
    pub is_repo: bool,
    pub branch: String,
    pub ahead: u32,
    pub behind: u32,
    pub modified_files: Vec<String>,
    pub untracked_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommandResult {
    pub success: bool,
    pub message: String,
}

/// Comprueba si el ejecutable `git` está disponible en el PATH del sistema.
pub fn is_git_available() -> bool {
    let mut cmd = Command::new("git");
    cmd.arg("--version");
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd.output().map(|o| o.status.success()).unwrap_or(false)
}

/// Construye un comando base de Git seguro y no interactivo.
fn git_command<P: AsRef<Path>>(project_path: P) -> Command {
    let mut cmd = Command::new("git");
    cmd.current_dir(project_path.as_ref())
        // `core.quotePath` viene activado de fábrica y escapa en octal todo lo
        // que no sea ASCII: `sección.typ` llegaba como `"secci\303\263n.typ"`,
        // comillas incluidas. Comprobado contra el git real. En un editor cuyos
        // usuarios escriben en español, casi cualquier nombre de capítulo cae en
        // ese caso, así que se desactiva y las rutas llegan en UTF-8 tal cual.
        .args(["-c", "core.quotePath=false"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd
}

/// Ruta de una línea de entrada ordinaria (`1 `) o de renombrado (`2 `) de
/// `git status --porcelain=v2`, cuyos formatos son:
///
/// ```text
/// 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <ruta>
/// 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <Xpuntuación> <ruta>\t<ruta original>
/// ```
///
/// Existe porque el parser hacía `split_whitespace().last()`, y eso rompía dos
/// casos comprobados contra el git real: un fichero llamado `mi documento.typ`
/// aparecía como `documento.typ` (solo la última palabra), y un renombrado
/// mostraba el nombre VIEJO, porque en las líneas `2 ` va después del tabulador.
fn parse_entry_path(line: &str) -> Option<String> {
    let campos_previos = if line.starts_with("2 ") { 9 } else { 8 };

    let mut resto = line;
    for _ in 0..campos_previos {
        let (_, siguiente) = resto.split_once(' ')?;
        resto = siguiente.trim_start_matches(' ');
    }

    // En un renombrado, la ruta nueva va ANTES del tabulador; la vieja, después.
    let ruta = resto.split('\t').next()?.trim();
    if ruta.is_empty() {
        None
    } else {
        Some(ruta.to_string())
    }
}

/// Parsea la salida de `git status --porcelain=v2 --branch`.
pub fn parse_git_status_output(output: &str) -> GitStatusResult {
    let mut branch = String::new();
    let mut ahead = 0;
    let mut behind = 0;
    let mut modified_files = Vec::new();
    let mut untracked_files = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("# branch.head ") {
            branch = trimmed.trim_start_matches("# branch.head ").to_string();
        } else if trimmed.starts_with("# branch.ab ") {
            let ab_part = trimmed.trim_start_matches("# branch.ab ");
            let parts: Vec<&str> = ab_part.split_whitespace().collect();
            for part in parts {
                if part.starts_with('+') {
                    ahead = part[1..].parse::<u32>().unwrap_or(0);
                } else if part.starts_with('-') {
                    behind = part[1..].parse::<u32>().unwrap_or(0);
                }
            }
        } else if trimmed.starts_with("1 ") || trimmed.starts_with("2 ") {
            if let Some(path) = parse_entry_path(trimmed) {
                modified_files.push(path);
            }
        } else if trimmed.starts_with("? ") {
            let path = trimmed[2..].trim();
            if !path.is_empty() {
                untracked_files.push(path.to_string());
            }
        }
    }

    GitStatusResult {
        is_repo: true,
        branch: if branch.is_empty() { "HEAD".to_string() } else { branch },
        ahead,
        behind,
        modified_files,
        untracked_files,
    }
}

/// Obtiene el estado actual del repositorio Git en el proyecto dado.
#[tauri::command]
pub async fn git_status(project_path: String) -> Result<GitStatusResult, AppError> {
    let root = PathBuf::from(&project_path);
    if !root.is_dir() {
        return Err(AppError::InvalidPath(project_path));
    }

    if !is_git_available() {
        return Ok(GitStatusResult {
            is_repo: false,
            branch: String::new(),
            ahead: 0,
            behind: 0,
            modified_files: Vec::new(),
            untracked_files: Vec::new(),
        });
    }

    let output = git_command(&root)
        .args(["status", "--porcelain=v2", "--branch"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let text = String::from_utf8_lossy(&out.stdout);
            Ok(parse_git_status_output(&text))
        }
        _ => Ok(GitStatusResult {
            is_repo: false,
            branch: String::new(),
            ahead: 0,
            behind: 0,
            modified_files: Vec::new(),
            untracked_files: Vec::new(),
        }),
    }
}

/// Añade los cambios y crea un commit con el mensaje especificado.
#[tauri::command]
pub async fn git_commit(
    project_path: String,
    message: String,
) -> Result<GitCommandResult, AppError> {
    let root = PathBuf::from(&project_path);
    if !root.is_dir() {
        return Err(AppError::InvalidPath(project_path));
    }

    // 1. git add -A
    let add_out = git_command(&root)
        .args(["add", "-A"])
        .output()
        .map_err(|e| AppError::Io(format!("Fallo al ejecutar git add: {e}")))?;

    if !add_out.status.success() {
        let err = String::from_utf8_lossy(&add_out.stderr);
        return Ok(GitCommandResult {
            success: false,
            message: format!("Error en git add: {err}"),
        });
    }

    // 2. git commit -m <message>
    let commit_out = git_command(&root)
        .args(["commit", "-m", &message])
        .output()
        .map_err(|e| AppError::Io(format!("Fallo al ejecutar git commit: {e}")))?;

    let stdout = String::from_utf8_lossy(&commit_out.stdout);
    let stderr = String::from_utf8_lossy(&commit_out.stderr);
    let success = commit_out.status.success();
    let message = if success { stdout.to_string() } else { stderr.to_string() };

    Ok(GitCommandResult { success, message })
}

/// Realiza un git push con flags no interactivos.
#[tauri::command]
pub async fn git_push(project_path: String) -> Result<GitCommandResult, AppError> {
    let root = PathBuf::from(&project_path);
    if !root.is_dir() {
        return Err(AppError::InvalidPath(project_path));
    }

    let push_out = git_command(&root)
        .args(["push"])
        .output()
        .map_err(|e| AppError::Io(format!("Fallo al ejecutar git push: {e}")))?;

    let stdout = String::from_utf8_lossy(&push_out.stdout);
    let stderr = String::from_utf8_lossy(&push_out.stderr);
    let success = push_out.status.success();
    let message = if success { stdout.to_string() } else { stderr.to_string() };

    Ok(GitCommandResult { success, message })
}

/// Realiza un git pull con flags no interactivos.
#[tauri::command]
pub async fn git_pull(project_path: String) -> Result<GitCommandResult, AppError> {
    let root = PathBuf::from(&project_path);
    if !root.is_dir() {
        return Err(AppError::InvalidPath(project_path));
    }

    let pull_out = git_command(&root)
        .args(["pull"])
        .output()
        .map_err(|e| AppError::Io(format!("Fallo al ejecutar git pull: {e}")))?;

    let stdout = String::from_utf8_lossy(&pull_out.stdout);
    let stderr = String::from_utf8_lossy(&pull_out.stderr);
    let success = pull_out.status.success();
    let message = if success { stdout.to_string() } else { stderr.to_string() };

    Ok(GitCommandResult { success, message })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_git_status_output_extrae_rama_y_estados() {
        let sample = r#"# branch.oid 280b8b5d226abf572f35d35dae6dd335d7de4510
# branch.head master
# branch.upstream origin/master
# branch.ab +2 -1
1 .M N... 100644 100644 100644 6350979 6350979 main.typ
1 M. N... 100644 100644 100644 342b0f9 342b0f9 capitulo1.typ
? nuevo.typ
"#;
        let parsed = parse_git_status_output(sample);
        assert!(parsed.is_repo);
        assert_eq!(parsed.branch, "master");
        assert_eq!(parsed.ahead, 2);
        assert_eq!(parsed.behind, 1);
        assert_eq!(parsed.modified_files, vec!["main.typ", "capitulo1.typ"]);
        assert_eq!(parsed.untracked_files, vec!["nuevo.typ"]);
    }

    #[test]
    fn parse_git_status_output_con_repositorio_limpio() {
        let sample = r#"# branch.oid 280b8b5d226abf572f35d35dae6dd335d7de4510
# branch.head feature/diagrams
# branch.ab +0 -0
"#;
        let parsed = parse_git_status_output(sample);
        assert!(parsed.is_repo);
        assert_eq!(parsed.branch, "feature/diagrams");
        assert_eq!(parsed.ahead, 0);
        assert_eq!(parsed.behind, 0);
        assert!(parsed.modified_files.is_empty());
        assert!(parsed.untracked_files.is_empty());
    }

    // Las tres líneas de abajo están COPIADAS de una ejecución real de
    // `git status --porcelain=v2 --branch` sobre un repositorio de prueba con
    // esos nombres exactos, no escritas de memoria. Es la disciplina que este
    // proyecto ya aplicó al resolver el outline y el `typst init` de Universe:
    // comprobar el formato contra la herramienta antes de escribir el parser.
    #[test]
    fn parse_conserva_los_espacios_de_una_ruta() {
        // El parser hacía `split_whitespace().last()`, así que este fichero
        // aparecía en la interfaz como "documento.typ": el usuario veía un
        // fichero modificado que no existe con ese nombre.
        let salida = "# branch.head master\n\
1 .M N... 100644 100644 100644 587be6b4 587be6b4 mi documento.typ\n";

        let estado = parse_git_status_output(salida);
        assert_eq!(estado.modified_files, vec!["mi documento.typ"]);
    }

    #[test]
    fn parse_de_un_renombrado_devuelve_el_nombre_nuevo_no_el_viejo() {
        // En una línea `2 ` la ruta nueva va antes del tabulador y la vieja
        // después, así que `.last()` devolvía justo la que ya no existe.
        let salida = "# branch.head master\n\
2 R. N... 100644 100644 100644 b6802534 b6802534 R100 renombrado con espacios.typ\tnormal.typ\n";

        let estado = parse_git_status_output(salida);
        assert_eq!(estado.modified_files, vec!["renombrado con espacios.typ"]);
    }

    #[test]
    fn parse_acepta_una_ruta_con_acentos_sin_escapar() {
        // Solo llega así porque `git_command` desactiva `core.quotePath`; con el
        // valor de fábrica, git entrega `"secci\303\263n.typ"`, comillas
        // incluidas. En un editor para escribir en español eso es el caso
        // normal, no el raro.
        let salida = "# branch.head master\n\
1 .M N... 100644 100644 100644 975fbec8 975fbec8 sección.typ\n";

        let estado = parse_git_status_output(salida);
        assert_eq!(estado.modified_files, vec!["sección.typ"]);
    }

    #[test]
    fn parse_distingue_modificados_de_no_seguidos_con_espacios() {
        let salida = "# branch.head master\n\
1 .M N... 100644 100644 100644 587be6b4 587be6b4 mi documento.typ\n\
? otro fichero.typ\n";

        let estado = parse_git_status_output(salida);
        assert_eq!(estado.modified_files, vec!["mi documento.typ"]);
        assert_eq!(estado.untracked_files, vec!["otro fichero.typ"]);
    }

    #[test]
    fn parse_lee_el_adelanto_y_el_retraso_respecto_al_remoto() {
        let salida = "# branch.head main\n# branch.ab +3 -2\n";

        let estado = parse_git_status_output(salida);
        assert_eq!(estado.branch, "main");
        assert_eq!(estado.ahead, 3);
        assert_eq!(estado.behind, 2);
    }

    #[test]
    fn parse_degrada_a_head_cuando_no_hay_rama() {
        // `git status` en un HEAD desacoplado no emite `# branch.head` con un
        // nombre utilizable; la interfaz no debe quedarse con la etiqueta vacía.
        let estado = parse_git_status_output("# branch.oid 6e662644\n");
        assert_eq!(estado.branch, "HEAD");
    }

    #[test]
    fn parse_ignora_una_linea_truncada_en_vez_de_inventarse_una_ruta() {
        // Una línea a medias (proceso interrumpido, salida cortada) no debe
        // producir una entrada con una ruta falsa en la lista de modificados.
        let estado = parse_git_status_output("# branch.head master\n1 .M N... 100644\n");
        assert!(estado.modified_files.is_empty());
    }
}
