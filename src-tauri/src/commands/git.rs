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
    /// Ficheros con un conflicto de fusión sin resolver todavía (marcas
    /// `<<<<<<<`/`=======`/`>>>>>>>` dentro). Verificado contra un pull real
    /// que sí deja conflicto (`spikes/git-conflict-sandbox/`, 2026-09-11):
    /// `git status --porcelain=v2` los reporta en una línea `u `, no en las
    /// `1 `/`2 ` que ya cubre `parse_entry_path` — sin este campo, un
    /// fichero en conflicto no aparecía en ningún lado del panel de Git.
    pub conflicted_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommandResult {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCloneResult {
    pub success: bool,
    pub message: String,
    pub path: Option<String>,
}

/// Deriva el nombre de carpeta destino a partir de una URL de remoto Git,
/// igual que hace el propio `git clone` sin segundo argumento: el último
/// segmento de la ruta, sin `.git` final ni barras sobrantes.
fn derive_clone_destination_name(url: &str) -> Option<String> {
    let sin_barra_final = url.trim_end_matches('/');
    let ultimo_segmento = sin_barra_final
        .rsplit(['/', ':'])
        .next()
        .unwrap_or("")
        .trim();
    let nombre = ultimo_segmento.strip_suffix(".git").unwrap_or(ultimo_segmento);

    if nombre.is_empty() {
        None
    } else {
        Some(nombre.to_string())
    }
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

/// Ruta de una línea de entrada ordinaria (`1 `), de renombrado (`2 `) o sin
/// fusionar (`u `) de `git status --porcelain=v2`, cuyos formatos son:
///
/// ```text
/// 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <ruta>
/// 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <Xpuntuación> <ruta>\t<ruta original>
/// u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <ruta>
/// ```
///
/// Existe porque el parser hacía `split_whitespace().last()`, y eso rompía dos
/// casos comprobados contra el git real: un fichero llamado `mi documento.typ`
/// aparecía como `documento.typ` (solo la última palabra), y un renombrado
/// mostraba el nombre VIEJO, porque en las líneas `2 ` va después del tabulador.
/// El formato `u ` (conflicto de fusión sin resolver) se comprobó reproduciendo
/// un conflicto real, no de memoria (`spikes/git-conflict-sandbox/`).
fn parse_entry_path(line: &str) -> Option<String> {
    let campos_previos = if line.starts_with("2 ") {
        9
    } else if line.starts_with("u ") {
        10
    } else {
        8
    };

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
    let mut conflicted_files = Vec::new();

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
        } else if trimmed.starts_with("u ") {
            if let Some(path) = parse_entry_path(trimmed) {
                conflicted_files.push(path);
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
        conflicted_files,
    }
}

/// Estado "sin repo"/degradado, reutilizado en los dos caminos de fallo de
/// `git_status` para no repetir los siete campos vacíos dos veces.
fn not_a_repo_status() -> GitStatusResult {
    GitStatusResult {
        is_repo: false,
        branch: String::new(),
        ahead: 0,
        behind: 0,
        modified_files: Vec::new(),
        untracked_files: Vec::new(),
        conflicted_files: Vec::new(),
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
        return Ok(not_a_repo_status());
    }

    let output = git_command(&root)
        .args(["status", "--porcelain=v2", "--branch"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let text = String::from_utf8_lossy(&out.stdout);
            Ok(parse_git_status_output(&text))
        }
        _ => Ok(not_a_repo_status()),
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

/// Clona un repositorio remoto por URL dentro de `parent_dir` (RF-33). El
/// nombre de carpeta se deriva de la URL, igual que el propio `git clone`, y
/// nunca sobrescribe un destino ya existente y no vacío: es la misma regla de
/// "nunca se sobrescribe silenciosamente" que RF-19 aplica a los conflictos de
/// guardado (§5e.1 de SPECIFICATIONS.md).
#[tauri::command]
pub async fn git_clone(url: String, parent_dir: String) -> Result<GitCloneResult, AppError> {
    let parent = PathBuf::from(&parent_dir);
    if !parent.is_dir() {
        return Err(AppError::InvalidPath(parent_dir));
    }

    if !is_git_available() {
        return Ok(GitCloneResult {
            success: false,
            message: "Git no está disponible en el PATH del sistema.".to_string(),
            path: None,
        });
    }

    let Some(nombre_destino) = derive_clone_destination_name(&url) else {
        return Err(AppError::InvalidPath(url));
    };

    let destino = parent.join(&nombre_destino);
    if destino.exists() {
        let no_vacio = destino
            .read_dir()
            .map(|mut entradas| entradas.next().is_some())
            .unwrap_or(true);
        if no_vacio {
            return Err(AppError::Denied(format!(
                "Ya existe una carpeta no vacía en {}",
                destino.display()
            )));
        }
    }

    let clone_out = git_command(&parent)
        .args(["clone", "--", &url, &nombre_destino])
        .output()
        .map_err(|e| AppError::Io(format!("Fallo al ejecutar git clone: {e}")))?;

    let stderr = String::from_utf8_lossy(&clone_out.stderr);
    let success = clone_out.status.success();

    Ok(GitCloneResult {
        success,
        message: if success { destino.display().to_string() } else { stderr.to_string() },
        path: if success { Some(destino.display().to_string()) } else { None },
    })
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
    fn parse_detecta_un_fichero_con_conflicto_de_fusion_sin_resolver() {
        // Copiado de una reproducción real de un conflicto de merge
        // (`spikes/git-conflict-sandbox/`, 2026-09-11): `git status
        // --porcelain=v2` reporta los ficheros sin fusionar en una línea `u `,
        // con 4 modos y 3 hashes antes de la ruta (no 3 modos + 2 hashes como
        // las líneas `1 `) — sin este caso, un fichero en conflicto real no
        // aparecía ni como modificado ni como no seguido: desaparecía del todo.
        let salida = "# branch.head master\n\
# branch.ab +1 -1\n\
u UU N... 100644 100644 100644 100644 22c02951195e38dc2a602ed78dfec38f184f462c c02709edd9236e3339697d5a892abefd7fe2a08f e6969483ba83f4fa88144b388158fde87bcc4b51 main.typ\n";

        let estado = parse_git_status_output(salida);
        assert_eq!(estado.conflicted_files, vec!["main.typ"]);
        assert!(estado.modified_files.is_empty());
    }

    #[test]
    fn parse_conserva_espacios_en_la_ruta_de_un_conflicto() {
        let salida = "# branch.head master\n\
u UU N... 100644 100644 100644 100644 aaaa bbbb cccc mi capitulo.typ\n";

        let estado = parse_git_status_output(salida);
        assert_eq!(estado.conflicted_files, vec!["mi capitulo.typ"]);
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

    #[test]
    fn deriva_el_nombre_de_una_url_https_con_sufijo_git() {
        let nombre = derive_clone_destination_name("https://github.com/davidbuenov/dbv-typst-editor.git");
        assert_eq!(nombre, Some("dbv-typst-editor".to_string()));
    }

    #[test]
    fn deriva_el_nombre_de_una_url_https_sin_sufijo_git() {
        let nombre = derive_clone_destination_name("https://gitlab.com/usuario/mi-tfg");
        assert_eq!(nombre, Some("mi-tfg".to_string()));
    }

    #[test]
    fn deriva_el_nombre_de_una_url_ssh() {
        let nombre = derive_clone_destination_name("git@codeberg.org:usuario/repo.git");
        assert_eq!(nombre, Some("repo".to_string()));
    }

    #[test]
    fn deriva_el_nombre_ignorando_una_barra_final() {
        let nombre = derive_clone_destination_name("https://github.com/davidbuenov/dbv-typst-editor/");
        assert_eq!(nombre, Some("dbv-typst-editor".to_string()));
    }

    #[test]
    fn deriva_ninguno_de_una_url_vacia_o_sin_segmento() {
        assert_eq!(derive_clone_destination_name(""), None);
        assert_eq!(derive_clone_destination_name("/"), None);
    }
}
