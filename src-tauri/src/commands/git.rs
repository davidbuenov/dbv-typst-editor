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
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_ASKPASS", "");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd
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
            if let Some(path) = trimmed.split_whitespace().last() {
                modified_files.push(path.to_string());
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
}
