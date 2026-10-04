// =============================================================================
// DBV Typst Editor — Servidor MCP para agentes externos (RF-113)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// `DBV Typst Editor --mcp --project <carpeta>` arranca, en lugar de la ventana, un servidor
// MCP por stdio: lo lanza el agente (Claude Code, Claude Desktop, Cursor…) como proceso hijo, así
// que no hay puerto de red y ningún otro proceso puede conectarse (RF-113.4).
//
// Qué aporta a un agente que YA lee y escribe ficheros del proyecto por su cuenta pero no tiene:
// el compilador exacto de DBV (Typst 0.15.1) y sus diagnósticos, la documentación de esa versión
// offline, el catálogo de Typst Universe (una versión por paquete), el renderizado de páginas, las
// fuentes disponibles y la bibliografía del proyecto (RF-113.1).
//
// Reglas (RF-113, RNF-IA.9):
//   · SOLO LECTURA. No hay herramienta de escritura: el agente escribe sus ficheros y DBV los recoge
//     por el observador. Nada se salta la revisión de RF-93.
//   · Confinado a la carpeta del proyecto con la que se lanzó. Las herramientas no reciben rutas.
//   · SIN RED: lee el catálogo y los paquetes que ya están en disco y nunca descarga (RNF-IA.9.3).
//   · Sin telemetría y sin lanzar programas salvo el propio compilador vendorizado (renderizado).
//
// Decisión del spike S157 (ADR-V0140-003): el servidor es un MODO del propio ejecutable, no un
// crate ni un sidecar aparte; reutiliza el motor, la documentación, Universe, las fuentes y el
// renderizado tal cual.

use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};

use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{CallToolResult, ContentBlock, ServerCapabilities, ServerConfig},
    schemars, tool, tool_handler, tool_router, ErrorData as McpError, ServerHandler, ServiceExt,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::ai::check::{check, CheckWorlds};
use crate::ai::fonts::list_families;
use crate::ai::render::{render_core, RenderSpec};
use crate::ai::universe_packages::installed_package_docs;
use crate::ai::universe_search::{check_id, search as universe_search, Kind, MAX_HITS};
use crate::bibliography::collect_ai_bibliography;
use crate::commands::universe_index::load_cache;
use crate::docs::{citation_styles, DocsIndex};
use crate::engine::diagnostics::Level;
use crate::mcp_bridge::{request_install, InstallAnswer};
use crate::project::describe;
use crate::universe_catalog::{build_catalog, compiler_version};

/// Identificador de la aplicación: la carpeta de datos (catálogo de Universe) cuelga de él.
const IDENTIFIER: &str = "com.davidbuenov.dbv-typst-editor";
const DOCS_RESOURCE: &str = "typst-docs.json.gz";
/// Diagnósticos como mucho por llamada: un agente no necesita 500 líneas iguales.
const MAX_DIAGNOSTICS: usize = 40;
/// Una página de documentación más larga que esto se recorta.
const MAX_DOC_CHARS: usize = 24_000;

// ----------------------------------------------------------------------------------- entorno

/// El proyecto con el que se lanzó el servidor.
#[derive(Debug, Clone)]
pub struct ProjectCtx {
    pub root: PathBuf,
    /// Documento principal (el del manifiesto o el que elige la heurística de DBV), si lo hay.
    pub main: Option<PathBuf>,
    /// Un `.typ` suelto: la IA solo ve ese fichero (RF-106.7), así que no hay bibliografía de la carpeta.
    pub single_file: bool,
}

impl ProjectCtx {
    /// Interpreta `--project` como lo hace la aplicación (`project::describe`): carpeta o `.typ` suelto.
    pub fn open(path: &Path) -> Result<Self, String> {
        let project = describe(path).map_err(|error| format!("{error:?}"))?;
        let root = PathBuf::from(&project.root);
        let main = if project.is_single_file { Some(path.to_path_buf()) } else { project.entrypoint.as_ref().map(|name| root.join(name)) };
        Ok(Self { root, main, single_file: project.is_single_file })
    }
}

/// Todo lo que las herramientas necesitan. Se clona barato: lo pesado va en `Arc`.
#[derive(Clone)]
pub struct McpEnv {
    project: Option<ProjectCtx>,
    data_dir: Option<PathBuf>,
    docs_candidates: Vec<PathBuf>,
    docs: Arc<OnceLock<Result<DocsIndex, String>>>,
    typst: Option<PathBuf>,
    checks: Arc<CheckWorlds>,
}

pub fn app_data_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join(IDENTIFIER))
}

/// Dónde puede estar la documentación empaquetada según la plataforma y la forma de instalar.
fn docs_candidates() -> Vec<PathBuf> {
    let mut found = Vec::new();
    if let Some(dir) = std::env::var_os("DBV_RESOURCES") {
        found.push(PathBuf::from(dir).join(DOCS_RESOURCE));
    }
    if let Some(exe_dir) = std::env::current_exe().ok().and_then(|exe| exe.parent().map(Path::to_path_buf)) {
        for relative in ["resources", ".", "../Resources/resources", "../Resources", "../lib/dbv-typst-editor/resources", "../lib/dbv-typst-editor"] {
            found.push(exe_dir.join(relative).join(DOCS_RESOURCE));
        }
    }
    // En desarrollo, el recurso del repositorio.
    found.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join(DOCS_RESOURCE));
    found
}

/// El compilador vendorizado (el mismo que el sidecar de la aplicación), junto al ejecutable o en `binaries/` en desarrollo.
fn typst_binary() -> Option<PathBuf> {
    let name = if cfg!(windows) { "typst.exe" } else { "typst" };
    let beside = std::env::current_exe().ok().and_then(|exe| exe.parent().map(|dir| dir.join(name)));
    if let Some(path) = beside.filter(|p| p.is_file()) {
        return Some(path);
    }
    let dev = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries");
    std::fs::read_dir(dev).ok()?.flatten().map(|entry| entry.path()).find(|path| path.file_name().is_some_and(|n| n.to_string_lossy().starts_with("typst-")))
}

impl McpEnv {
    /// El entorno real: las rutas de la instalación y de los datos de la aplicación.
    pub fn from_system(project: Option<ProjectCtx>) -> Self {
        Self { project, data_dir: app_data_dir(), docs_candidates: docs_candidates(), docs: Arc::new(OnceLock::new()), typst: typst_binary(), checks: Arc::new(CheckWorlds::default()) }
    }

    fn project(&self) -> Result<&ProjectCtx, String> {
        self.project.as_ref().ok_or_else(|| "no project: launch the server with `--project <folder>`".to_string())
    }

    fn docs(&self) -> Result<&DocsIndex, String> {
        let loaded = self.docs.get_or_init(|| {
            let path = self.docs_candidates.iter().find(|candidate| candidate.is_file()).ok_or("the Typst documentation is not in this installation")?;
            let bytes = std::fs::read(path).map_err(|error| error.to_string())?;
            DocsIndex::from_gzip(&bytes).map_err(|error| format!("{error:?}"))
        });
        loaded.as_ref().map_err(Clone::clone)
    }

    // ---------------------------------------------------------------------- las herramientas

    /// Compila el proyecto con el compilador de DBV y devuelve sus diagnósticos (RF-113.1).
    pub fn compile_project(&self) -> Result<Value, String> {
        let project = self.project()?;
        let main = project.main.as_ref().ok_or("the project has no main document (no main.typ and none declared)")?;
        let outcome = check(&self.checks, &project.root.to_string_lossy(), &main.to_string_lossy(), &[]).map_err(|error| format!("{error:?}"))?;
        let describe_all = |level: Level| -> Vec<Value> {
            outcome
                .diagnostics
                .iter()
                .filter(|d| d.level == level)
                .take(MAX_DIAGNOSTICS)
                .map(|d| json!({ "file": d.file, "line": d.start_line, "column": d.start_column, "message": d.message, "hints": d.hints }))
                .collect()
        };
        let errors = describe_all(Level::Error);
        let warnings = describe_all(Level::Warning);
        let total_errors = outcome.diagnostics.iter().filter(|d| d.level == Level::Error).count();
        let total_warnings = outcome.diagnostics.iter().filter(|d| d.level == Level::Warning).count();
        let incomplete = !outcome.missing_packages.is_empty();
        Ok(json!({
            "compiles": total_errors == 0 && !incomplete,
            "typst": compiler_version().to_string(),
            "main": main.strip_prefix(&project.root).unwrap_or(main).to_string_lossy().replace('\\', "/"),
            "errorCount": total_errors,
            "warningCount": total_warnings,
            "errors": errors,
            "warnings": warnings,
            "missingPackages": outcome.missing_packages,
            "note": if incomplete { "INCOMPLETE: the compiler stops at the first missing package, so other errors may still be hidden. These packages are not installed on this machine; the user can install them from DBV." } else { "" },
        }))
    }

    /// Renderiza páginas a PNG con el compilador vendorizado, sobre una réplica del proyecto (RF-114).
    pub fn render_pages(&self, pages: &[u32]) -> Result<crate::ai::render::RenderResult, String> {
        let project = self.project()?;
        let main = project.main.clone().ok_or("the project has no main document")?;
        let binary = self.typst.clone().ok_or("the Typst compiler is not available in this installation")?;
        let spec = RenderSpec { root: project.root.clone(), main, overrides: Vec::new(), single_file: project.single_file, pages: pages.to_vec() };
        let mut run = move |args: Vec<String>| {
            let output = std::process::Command::new(&binary).args(&args).output().map_err(|error| crate::ai::AiError::Server(error.to_string()))?;
            Ok((output.status.code(), String::from_utf8_lossy(&output.stderr).to_string()))
        };
        render_core(&spec, &mut run).map_err(|error| format!("{error}"))
    }

    /// Busca en la documentación de Typst de la versión exacta del compilador.
    pub fn search_typst_docs(&self, query: &str, limit: usize) -> Result<Value, String> {
        let hits = self.docs()?.search(query, limit.clamp(1, 8));
        Ok(json!({ "typst": compiler_version().to_string(), "results": hits }))
    }

    /// Una página de la documentación, recortada.
    pub fn read_typst_docs(&self, path: &str) -> Result<String, String> {
        let page = self.docs()?.page(path.split('#').next().unwrap_or(path)).ok_or_else(|| format!("no documentation page {path}"))?;
        let text = &page.markdown;
        Ok(if text.chars().count() > MAX_DOC_CHARS { format!("{}\n… (truncated)", text.chars().take(MAX_DOC_CHARS).collect::<String>()) } else { text.clone() })
    }

    /// Busca paquetes y plantillas en el catálogo YA descargado (una versión por paquete). Sin red (RNF-IA.9.3).
    pub fn search_universe(&self, query: &str, kind: Option<&str>) -> Result<Value, String> {
        let Some(cached) = self.data_dir.as_deref().and_then(load_cache) else {
            return Ok(json!({ "status": "noCatalog", "hits": [], "note": "The Typst Universe catalog has not been downloaded on this machine yet: open the Typst Universe gallery in DBV once. Do not guess package names or versions." }));
        };
        let catalog = build_catalog(&cached.entries, compiler_version());
        let hits = universe_search(&catalog, query, Kind::parse(kind), MAX_HITS);
        Ok(json!({
            "status": "ok",
            "fetchedAt": cached.fetched_at,
            "note": "Use ONLY these exact identifiers, with their version. A \"template\" is a package that ships a document template: import it like any package and use it as read_package_docs shows.",
            "hits": hits,
        }))
    }

    /// README, manifiesto y plantilla de un paquete que YA está instalado (nunca descarga).
    pub fn read_package_docs(&self, id: &str) -> Result<String, String> {
        installed_package_docs(id).map_err(|error| match error {
            crate::ai::AiError::NotFound(_) => format!("{id} is not installed on this machine. Call `install_package` with the same identifier: DBV asks the user for permission in its window, downloads it and returns its documentation. If the user is not available, put `#import \"{id}\": *` at the top of the document and DBV downloads it when they approve."),
            other => format!("{other}"),
        })
    }

    /// Instala un paquete de Universe y devuelve su documentación. Nunca instala por sí mismo: pide a DBV que
    /// pregunte al usuario en su ventana (RNF-IA.9.4), y solo acepta identificadores que el catálogo conoce.
    pub async fn install_package(&self, id: &str) -> Result<String, String> {
        let project = self.project()?;
        let Some(cached) = self.data_dir.as_deref().and_then(load_cache) else {
            return Err("The Typst Universe catalog has not been downloaded on this machine yet: open the Typst Universe gallery in DBV once. Do not guess package names or versions.".into());
        };
        let catalog = build_catalog(&cached.entries, compiler_version());
        let verdict = check_id(&cached.entries, &catalog, id);
        if verdict.status != "ok" {
            let better = verdict.latest.map(|latest| format!(" Use {latest} instead.")).unwrap_or_default();
            return Err(format!("{id} is not an installable package for this compiler ({}).{better} Find the exact identifier with `search_universe`.", verdict.status));
        }
        if let Ok(docs) = installed_package_docs(id) {
            return Ok(docs);
        }
        match request_install(self.data_dir.as_deref(), &project.root, id).await {
            InstallAnswer::Installed => installed_package_docs(id).map_err(|error| error.to_string()),
            InstallAnswer::Denied => Err(format!("The user declined installing {id}. Do not insist: tell them what you needed it for and carry on without it.")),
            InstallAnswer::Unavailable(note) => Err(note),
        }
    }

    /// Familias de fuente que el compilador puede usar en este proyecto.
    pub fn list_fonts(&self, query: &str) -> Result<Value, String> {
        let project = self.project()?;
        let families = list_families(&project.root, query);
        let total = families.len();
        Ok(json!({ "total": total, "families": families.into_iter().take(80).collect::<Vec<_>>(), "note": "A font that is not listed compiles with a fallback font and a warning \"unknown font family\"." }))
    }

    /// Referencias del proyecto (`.bib` y `.yml` de Hayagriva). No en un documento suelto (RF-106.7).
    pub fn list_bibliography(&self, query: &str) -> Result<Value, String> {
        let project = self.project()?;
        if project.single_file {
            return Err("a loose document has no project bibliography".into());
        }
        serde_json::to_value(collect_ai_bibliography(&project.root, query)).map_err(|error| error.to_string())
    }

    /// Estilos de cita incluidos en Typst, de la documentación vendorizada.
    pub fn citation_styles(&self, query: &str) -> Result<Value, String> {
        let styles = citation_styles(self.docs()?);
        let needle = query.trim().to_lowercase();
        let chosen: Vec<_> = styles.iter().filter(|s| needle.is_empty() || s.name.to_lowercase().contains(&needle) || s.details.to_lowercase().contains(&needle)).take(30).collect();
        Ok(json!({ "total": styles.len(), "styles": chosen, "usage": "bibliography(\"refs.bib\", style: \"name\")" }))
    }
}

// ----------------------------------------------------------------------------------- herramientas MCP

fn ok_json(value: Value) -> Result<CallToolResult, McpError> {
    Ok(CallToolResult::success(vec![ContentBlock::text(serde_json::to_string_pretty(&value).unwrap_or_default())]))
}

fn tool_error(message: String) -> Result<CallToolResult, McpError> {
    Ok(CallToolResult::error(vec![ContentBlock::text(message)]))
}

/// Cualquier herramienta que solo recibe una consulta opcional.
#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct QueryRequest {
    /// Texto a buscar. Opcional según la herramienta.
    #[serde(default)]
    pub query: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct SearchDocsRequest {
    /// What to look for, in English Typst terms (table, figure, caption, heading…).
    pub query: String,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct ReadDocsRequest {
    /// A documentation page path returned by `search_typst_docs`, e.g. "reference/model/table".
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct SearchUniverseRequest {
    /// Keywords in English ("ieee", "thesis", "drawing", "table").
    pub query: String,
    /// `package`, `template` or `any` (default).
    #[serde(default)]
    pub kind: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct PackageRequest {
    /// An exact `@preview/name:version` identifier returned by `search_universe`.
    pub id: String,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct RenderRequest {
    /// Pages to render: "1", "2-3" or "1,3". At most 3 pages per call.
    #[serde(default)]
    pub pages: Option<String>,
}

/// «1», «2-3», «1,3» → [1], [2, 3], [1, 3]. Lo que no se entiende se ignora; vacío = la primera.
pub fn parse_pages(text: &str) -> Vec<u32> {
    let mut pages = Vec::new();
    for part in text.split(',') {
        let part = part.trim();
        let (first, last) = match part.split_once('-') {
            Some((a, b)) => (a.trim().parse::<u32>(), b.trim().parse::<u32>()),
            None => (part.parse::<u32>(), part.parse::<u32>()),
        };
        if let (Ok(first), Ok(last)) = (first, last) {
            pages.extend(first..=last.min(first.saturating_add(5)));
        }
    }
    if pages.is_empty() {
        pages.push(1);
    }
    pages
}

/// El servidor.
#[derive(Clone)]
pub struct DbvMcp {
    env: McpEnv,
    tool_router: ToolRouter<Self>,
}

impl DbvMcp {
    pub fn new(env: McpEnv) -> Self {
        Self { env, tool_router: Self::tool_router() }
    }

    /// Ejecuta trabajo bloqueante (compilar, renderizar) fuera del hilo del protocolo.
    async fn blocking<T: Send + 'static>(&self, work: impl FnOnce(McpEnv) -> T + Send + 'static) -> Result<T, McpError> {
        let env = self.env.clone();
        tauri::async_runtime::spawn_blocking(move || work(env)).await.map_err(|error| McpError::internal_error(error.to_string(), None))
    }
}

#[tool_router(router = tool_router)]
impl DbvMcp {
    /// Qué es este servidor y con qué proyecto se lanzó.
    #[tool(description = "Information about this server: DBV version, the Typst compiler version and the project it was launched with.")]
    async fn dbv_info(&self) -> Result<CallToolResult, McpError> {
        let project = self.env.project.as_ref();
        ok_json(json!({
            "server": "DBV Typst Editor MCP (read-only, no network)",
            "version": env!("CARGO_PKG_VERSION"),
            "typst": compiler_version().to_string(),
            "project": project.map(|p| p.root.display().to_string()),
            "main": project.and_then(|p| p.main.as_ref()).map(|m| m.display().to_string()),
            "looseDocument": project.map(|p| p.single_file),
        }))
    }

    #[tool(description = "Read-only snapshot of the DBV editor if it is open with this project and the user enabled sharing: open tabs with their UNSAVED text, the active document, cursor, selection, outline and current problems. Otherwise says why it is not available; then work from the files on disk.")]
    async fn editor_state(&self) -> Result<CallToolResult, McpError> {
        let Some(project) = self.env.project.as_ref() else {
            return tool_error("no project: launch the server with `--project <folder>`".into());
        };
        ok_json(crate::mcp_bridge::fetch_state(self.env.data_dir.as_deref(), &project.root).await)
    }

    #[tool(description = "Compile the project with DBV's exact Typst compiler and return its errors and warnings (file, line, message). A package that is not installed is reported separately as incomplete, not as an error.")]
    async fn compile_project(&self) -> Result<CallToolResult, McpError> {
        match self.blocking(|env| env.compile_project()).await? {
            Ok(value) => ok_json(value),
            Err(message) => tool_error(message),
        }
    }

    #[tool(description = "See the rendered page(s) of the project as images (max 3), to judge the layout. Renders what is on disk.")]
    async fn render_page(&self, Parameters(request): Parameters<RenderRequest>) -> Result<CallToolResult, McpError> {
        let pages = parse_pages(request.pages.as_deref().unwrap_or("1"));
        match self.blocking(move |env| env.render_pages(&pages)).await? {
            Ok(rendered) => {
                let shown = rendered.pages.iter().map(|p| p.page.to_string()).collect::<Vec<_>>().join(", ");
                let mut content = vec![ContentBlock::text(format!("Rendered page(s) {shown}{}.", rendered.total_pages.map(|t| format!(" of {t}")).unwrap_or_default()))];
                content.extend(rendered.pages.into_iter().map(|p| ContentBlock::image(p.base64, p.mime)));
                Ok(CallToolResult::success(content))
            }
            Err(message) => tool_error(message),
        }
    }

    #[tool(description = "Search the official Typst documentation of the exact compiler version (offline). Use English Typst terms.")]
    async fn search_typst_docs(&self, Parameters(request): Parameters<SearchDocsRequest>) -> Result<CallToolResult, McpError> {
        match self.blocking(move |env| env.search_typst_docs(&request.query, 5)).await? {
            Ok(value) => ok_json(value),
            Err(message) => tool_error(message),
        }
    }

    #[tool(description = "Read a full page of the Typst documentation, e.g. \"reference/model/table\".")]
    async fn read_typst_docs(&self, Parameters(request): Parameters<ReadDocsRequest>) -> Result<CallToolResult, McpError> {
        match self.blocking(move |env| env.read_typst_docs(&request.path)).await? {
            Ok(text) => Ok(CallToolResult::success(vec![ContentBlock::text(text)])),
            Err(message) => tool_error(message),
        }
    }

    #[tool(description = "Search Typst Universe for packages and document templates (max 8, the latest version this compiler supports, with the exact @preview/name:version). Reads the catalog already on this machine; never downloads. Never write a package or version this tool did not return.")]
    async fn search_universe(&self, Parameters(request): Parameters<SearchUniverseRequest>) -> Result<CallToolResult, McpError> {
        match self.blocking(move |env| env.search_universe(&request.query, request.kind.as_deref())).await? {
            Ok(value) => ok_json(value),
            Err(message) => tool_error(message),
        }
    }

    #[tool(description = "Read the README, manifest and template example of a Typst Universe package that is ALREADY installed on this machine (it never downloads; for one that is not, use `install_package`).")]
    async fn read_package_docs(&self, Parameters(request): Parameters<PackageRequest>) -> Result<CallToolResult, McpError> {
        match self.blocking(move |env| env.read_package_docs(&request.id)).await? {
            Ok(text) => Ok(CallToolResult::success(vec![ContentBlock::text(text)])),
            Err(message) => tool_error(message),
        }
    }

    #[tool(description = "Install a Typst Universe package on this machine and read its documentation. DBV ASKS THE USER for permission in its window first (it never installs by itself); this call waits for the answer. Use the exact identifier from `search_universe`.")]
    async fn install_package(&self, Parameters(request): Parameters<PackageRequest>) -> Result<CallToolResult, McpError> {
        match self.env.install_package(&request.id).await {
            Ok(text) => Ok(CallToolResult::success(vec![ContentBlock::text(text)])),
            Err(message) => tool_error(message),
        }
    }

    #[tool(description = "List the font families the compiler can use in this project (system, built-in and the project's fonts/ folder); optional `query`.")]
    async fn list_fonts(&self, Parameters(request): Parameters<QueryRequest>) -> Result<CallToolResult, McpError> {
        match self.blocking(move |env| env.list_fonts(request.query.as_deref().unwrap_or(""))).await? {
            Ok(value) => ok_json(value),
            Err(message) => tool_error(message),
        }
    }

    #[tool(description = "List the references of the project bibliography (.bib / Hayagriva .yml): key, authors, year, title. Optional `query`. Cite ONLY these keys.")]
    async fn list_bibliography(&self, Parameters(request): Parameters<QueryRequest>) -> Result<CallToolResult, McpError> {
        match self.blocking(move |env| env.list_bibliography(request.query.as_deref().unwrap_or(""))).await? {
            Ok(value) => ok_json(value),
            Err(message) => tool_error(message),
        }
    }

    #[tool(description = "Built-in citation styles of Typst for bibliography(style: \"name\"); optional `query` (e.g. \"ieee\", \"apa\", \"chicago\").")]
    async fn citation_styles(&self, Parameters(request): Parameters<QueryRequest>) -> Result<CallToolResult, McpError> {
        match self.blocking(move |env| env.citation_styles(request.query.as_deref().unwrap_or(""))).await? {
            Ok(value) => ok_json(value),
            Err(message) => tool_error(message),
        }
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for DbvMcp {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(rmcp::model::Implementation::new("dbv-typst-editor", env!("CARGO_PKG_VERSION")))
    }
}

// ----------------------------------------------------------------------------------- arranque

/// Cómo lanza un agente ACP (el del panel de IA) este mismo servidor, en el formato `mcpServers` de `session/new`.
/// En una instalación de la Store el ejecutable vive en `WindowsApps`, donde otro proceso no puede lanzarlo por su
/// ruta: se usa el alias de ejecución del manifiesto (ADR-V0140-003).
pub fn server_spec(exe: &Path, root: &str) -> Value {
    json!({ "name": "dbv", "command": launch_info(exe, None).command, "args": ["--mcp", "--project", root], "env": [] })
}

/// Cómo se invoca este ejecutable desde FUERA de la aplicación (la configuración que se copia a Claude Code, Claude
/// Desktop, Cursor…). En la Store, el alias del manifiesto; en un AppImage, el propio fichero (`$APPIMAGE`: la ruta del
/// ejecutable montado cambia en cada arranque); en el resto, la ruta del ejecutable.
#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchInfo {
    pub command: String,
    /// El comando es el alias de ejecución de la Store, no una ruta.
    pub store: bool,
    /// El comando es el AppImage.
    pub appimage: bool,
}

pub fn launch_info(exe: &Path, appimage: Option<&str>) -> LaunchInfo {
    if let Some(image) = appimage.filter(|path| !path.is_empty()) {
        return LaunchInfo { command: image.to_string(), store: false, appimage: true };
    }
    let packaged = exe.to_string_lossy().to_lowercase().contains(r"\windowsapps\");
    LaunchInfo { command: if packaged { "dbv-typst-editor.exe".to_string() } else { exe.to_string_lossy().into_owned() }, store: packaged, appimage: false }
}

#[tauri::command]
pub fn mcp_launch_info() -> Result<LaunchInfo, String> {
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    Ok(launch_info(&exe, std::env::var("APPIMAGE").ok().as_deref()))
}

/// El servidor de DBV para el agente del panel de IA: así ve el renderizado, compila con el compilador exacto y
/// consulta Universe y la documentación (RF-113). Es el mismo ejecutable, en modo `--mcp`.
#[tauri::command]
pub fn mcp_server_spec(root: String) -> Result<Value, String> {
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    Ok(server_spec(&exe, &root))
}

/// `--project <carpeta>` de los argumentos, si está.
pub fn project_arg(args: &[String]) -> Option<PathBuf> {
    let at = args.iter().position(|arg| arg == "--project")?;
    args.get(at + 1).map(PathBuf::from)
}

/// ¿Se pidió el modo servidor? (`--mcp` como argumento).
pub fn requested(args: &[String]) -> bool {
    args.iter().skip(1).any(|arg| arg == "--mcp")
}

/// Sirve MCP por stdio hasta que el cliente cierra. Devuelve el código de salida del proceso.
pub fn run(args: &[String]) -> i32 {
    let project = match project_arg(args) {
        Some(path) => match ProjectCtx::open(&path) {
            Ok(project) => Some(project),
            Err(error) => {
                // Por stderr: stdout es el canal del protocolo y no debe llevar nada más.
                eprintln!("dbv-typst-editor --mcp: no se pudo abrir el proyecto {}: {error}", path.display());
                return 2;
            }
        },
        None => None,
    };
    let server = DbvMcp::new(McpEnv::from_system(project));
    let outcome = tauri::async_runtime::block_on(async move {
        let service = server.serve(rmcp::transport::stdio()).await?;
        service.waiting().await?;
        Ok::<(), Box<dyn std::error::Error + Send + Sync>>(())
    });
    match outcome {
        Ok(()) => 0,
        Err(error) => {
            eprintln!("dbv-typst-editor --mcp: {error}");
            1
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(files: &[(&str, &str)]) -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        for (name, text) in files {
            let path = dir.path().join(name);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, text).unwrap();
        }
        dir
    }

    /// Un entorno hermético: datos y caché de paquetes propios, y la documentación del repositorio.
    fn env_for(dir: &tempfile::TempDir, data: Option<&Path>) -> McpEnv {
        let mut env = McpEnv::from_system(Some(ProjectCtx::open(dir.path()).unwrap()));
        env.data_dir = data.map(Path::to_path_buf);
        env.checks = Arc::new(CheckWorlds::with_cache(dir.path().join(".paquetes-de-prueba")));
        env
    }

    #[test]
    fn el_proyecto_se_interpreta_como_en_la_aplicacion() {
        let dir = project(&[("main.typ", "= Hola"), ("otro.typ", "x")]);
        let ctx = ProjectCtx::open(dir.path()).unwrap();
        assert_eq!(ctx.main.as_deref().and_then(|m| m.file_name()).map(|n| n.to_string_lossy().to_string()).as_deref(), Some("main.typ"));
        assert!(!ctx.single_file);
        let loose = ProjectCtx::open(&dir.path().join("otro.typ")).unwrap();
        assert!(loose.single_file);
        assert!(ProjectCtx::open(&dir.path().join("no-existe")).is_err());
    }

    #[test]
    fn las_paginas_pedidas_se_leen_con_tolerancia() {
        assert_eq!(parse_pages("1"), vec![1]);
        assert_eq!(parse_pages("2-3"), vec![2, 3]);
        assert_eq!(parse_pages("1, 3"), vec![1, 3]);
        assert_eq!(parse_pages("abc"), vec![1]);
        assert_eq!(parse_pages(""), vec![1]);
        assert!(parse_pages("1-9999").len() <= 6);
    }

    #[test]
    fn compile_project_da_los_errores_con_fichero_y_linea() {
        let dir = project(&[("main.typ", "= Hola\n#no-existe()\n")]);
        let result = env_for(&dir, None).compile_project().unwrap();
        assert_eq!(result["compiles"], false);
        assert_eq!(result["errorCount"], 1);
        assert_eq!(result["errors"][0]["file"], "main.typ");
        assert_eq!(result["errors"][0]["line"], 2);
        assert!(result["errors"][0]["message"].as_str().unwrap().contains("unknown variable"));
        assert_eq!(result["typst"], "0.15.1");
    }

    #[test]
    fn compile_project_de_un_proyecto_que_compila_lo_dice() {
        let dir = project(&[("main.typ", "= Hola\nTexto.")]);
        let result = env_for(&dir, None).compile_project().unwrap();
        assert_eq!(result["compiles"], true);
        assert_eq!(result["errorCount"], 0);
        assert_eq!(result["note"], "");
    }

    #[test]
    fn un_paquete_sin_instalar_es_una_comprobacion_incompleta_no_un_error() {
        let dir = project(&[("main.typ", "#import \"@preview/paquete-que-no-existe-dbv:0.0.1\": f\n#f()")]);
        let result = env_for(&dir, None).compile_project().unwrap();
        assert_eq!(result["compiles"], false);
        assert_eq!(result["errorCount"], 0, "no es un error del documento");
        assert_eq!(result["missingPackages"][0], "@preview/paquete-que-no-existe-dbv:0.0.1");
        assert!(result["note"].as_str().unwrap().starts_with("INCOMPLETE"));
    }

    #[test]
    fn render_page_devuelve_pngs_con_el_compilador_vendorizado() {
        if typst_binary().is_none() {
            return;
        }
        let dir = project(&[("main.typ", "#set page(width: 12cm, height: 8cm)\n= Uno\n#pagebreak()\n= Dos\n")]);
        let rendered = env_for(&dir, None).render_pages(&[1, 2]).unwrap();
        assert_eq!(rendered.pages.iter().map(|p| p.page).collect::<Vec<_>>(), vec![1, 2]);
        assert_eq!(rendered.total_pages, Some(2));
        assert_eq!(rendered.pages[0].mime, "image/png");
    }

    #[test]
    fn la_documentacion_se_busca_y_se_lee_offline() {
        let dir = project(&[("main.typ", "x")]);
        let env = env_for(&dir, None);
        let found = env.search_typst_docs("table header", 5).unwrap();
        assert_eq!(found["typst"], "0.15.1");
        assert!(found["results"][0]["path"].as_str().unwrap().contains("table"));
        let page = env.read_typst_docs("reference/model/table#parameters").unwrap();
        assert!(page.contains("table"));
        assert!(env.read_typst_docs("reference/no/existe").is_err());
    }

    #[test]
    fn el_catalogo_de_universe_se_lee_de_disco_y_sin_catalogo_no_inventa() {
        let dir = project(&[("main.typ", "x")]);
        let data = tempfile::tempdir().unwrap();
        let empty = env_for(&dir, Some(data.path())).search_universe("ieee", None).unwrap();
        assert_eq!(empty["status"], "noCatalog");
        assert_eq!(empty["hits"].as_array().unwrap().len(), 0);

        let index = r#"[
          {"name":"charged-ieee","version":"0.1.4","compiler":"0.12.0","description":"An IEEE-style paper template","keywords":["IEEE"],"categories":["paper"],"license":"MIT-0","template":{"path":"template","entrypoint":"main.typ"}},
          {"name":"cetz","version":"0.4.2","compiler":"0.13.0","description":"Drawing"},
          {"name":"cetz","version":"0.5.2","compiler":"0.14.0","description":"Drawing library"}
        ]"#;
        crate::commands::universe_index::save_cache(data.path(), index.as_bytes()).unwrap();
        let env = env_for(&dir, Some(data.path()));
        let ieee = env.search_universe("ieee", Some("template")).unwrap();
        assert_eq!(ieee["status"], "ok");
        assert_eq!(ieee["hits"][0]["id"], "@preview/charged-ieee:0.1.4");
        assert_eq!(ieee["hits"][0]["kind"], "template");
        let cetz = env.search_universe("cetz", Some("package")).unwrap();
        assert_eq!(cetz["hits"].as_array().unwrap().len(), 1, "una sola versión por paquete");
        assert_eq!(cetz["hits"][0]["id"], "@preview/cetz:0.5.2");
    }

    #[test]
    fn las_fuentes_incluyen_las_de_typst() {
        let dir = project(&[("main.typ", "x")]);
        let result = env_for(&dir, None).list_fonts("libertinus").unwrap();
        assert!(result["total"].as_u64().unwrap() >= 1);
        assert!(result["families"][0]["name"].as_str().unwrap().to_lowercase().contains("libertinus"));
    }

    #[test]
    fn la_bibliografia_y_los_estilos_se_leen_y_en_un_documento_suelto_no_hay_bibliografia() {
        let dir = project(&[("main.typ", "x"), ("refs.bib", "@article{knuth1984,\n  author = {Donald E. Knuth},\n  title = {Literate Programming},\n  journal = {J},\n  year = {1984},\n}\n")]);
        let env = env_for(&dir, None);
        let refs = env.list_bibliography("knuth").unwrap();
        assert_eq!(refs["references"][0]["key"], "knuth1984");
        let styles = env.citation_styles("ieee").unwrap();
        assert!(styles["styles"].as_array().unwrap().iter().any(|s| s["name"] == "ieee"));

        let mut loose = env_for(&dir, None);
        loose.project.as_mut().unwrap().single_file = true;
        assert!(loose.list_bibliography("").is_err());
    }

    #[test]
    fn sin_proyecto_las_herramientas_del_proyecto_dicen_como_lanzarlo() {
        let env = McpEnv::from_system(None);
        for result in [env.compile_project().map(|_| ()), env.list_fonts("").map(|_| ()), env.list_bibliography("").map(|_| ())] {
            assert!(result.unwrap_err().contains("--project"));
        }
        // La documentación y el catálogo no dependen del proyecto.
        assert!(env.search_typst_docs("table", 3).is_ok());
    }

    #[tokio::test]
    async fn instalar_un_paquete_solo_acepta_lo_que_el_catalogo_conoce_y_sin_la_aplicacion_no_instala() {
        let dir = project(&[("main.typ", "x")]);
        let data = tempfile::tempdir().unwrap();
        // Sin catálogo no se adivina nada.
        let none = env_for(&dir, Some(data.path())).install_package("@preview/dbv-prueba-paquete:9.9.9").await;
        assert!(none.unwrap_err().contains("catalog has not been downloaded"));

        let index = r#"[{"name":"dbv-prueba-paquete","version":"9.9.9","compiler":"0.12.0","description":"x"}]"#;
        crate::commands::universe_index::save_cache(data.path(), index.as_bytes()).unwrap();
        let env = env_for(&dir, Some(data.path()));
        let unknown = env.install_package("@preview/inventado-por-la-ia:1.0.0").await.unwrap_err();
        assert!(unknown.contains("not an installable package"), "{unknown}");
        let wrong_version = env.install_package("@preview/dbv-prueba-paquete:1.0.0").await.unwrap_err();
        assert!(wrong_version.contains("9.9.9"), "sugiere la versión que sí existe: {wrong_version}");
        // El paquete existe en el catálogo pero la aplicación no está abierta: no hay a quién preguntar, y no instala.
        let offline = env.install_package("@preview/dbv-prueba-paquete:9.9.9").await.unwrap_err();
        assert!(offline.contains("not open"), "{offline}");
    }

    #[tokio::test]
    async fn la_lista_de_herramientas_es_cerrada_y_ninguna_escribe_en_el_proyecto() {
        let names: Vec<String> = DbvMcp::new(McpEnv::from_system(None)).tool_router.list_all().into_iter().map(|tool| tool.name.to_string()).collect();
        assert!(names.contains(&"install_package".to_string()));
        // La lista es cerrada: añadir una herramienta que escriba en el proyecto obliga a cambiar este test a conciencia.
        let mut expected = vec!["citation_styles", "compile_project", "dbv_info", "editor_state", "install_package", "list_bibliography", "list_fonts", "read_package_docs", "read_typst_docs", "render_page", "search_typst_docs", "search_universe"];
        expected.sort_unstable();
        let mut found: Vec<&str> = names.iter().map(String::as_str).collect();
        found.sort_unstable();
        assert_eq!(found, expected);
    }

    #[test]
    fn la_configuracion_para_agentes_externos_usa_alias_appimage_o_ruta() {
        assert_eq!(launch_info(Path::new("D:/apps/dbv-typst-editor.exe"), None), LaunchInfo { command: "D:/apps/dbv-typst-editor.exe".into(), store: false, appimage: false });
        let store = launch_info(Path::new(r"C:\Program Files\WindowsApps\DBV_0.14.0.0_x64__abc\dbv-typst-editor.exe"), None);
        assert_eq!((store.command.as_str(), store.store), ("dbv-typst-editor.exe", true));
        // El ejecutable de dentro del AppImage cambia en cada arranque: se ofrece el propio AppImage.
        let image = launch_info(Path::new("/tmp/.mount_abc/usr/bin/dbv-typst-editor"), Some("/home/u/DBV.AppImage"));
        assert_eq!((image.command.as_str(), image.appimage), ("/home/u/DBV.AppImage", true));
        assert!(!launch_info(Path::new("/usr/bin/dbv-typst-editor"), Some("")).appimage);
    }

    #[test]
    fn el_agente_del_panel_lanza_el_servidor_con_la_ruta_o_con_el_alias_de_la_store() {
        let normal = server_spec(Path::new("C:/apps/dbv/dbv-typst-editor.exe"), "D:/libro");
        assert_eq!(normal["command"], "C:/apps/dbv/dbv-typst-editor.exe");
        assert_eq!(normal["args"], json!(["--mcp", "--project", "D:/libro"]));
        assert_eq!(normal["name"], "dbv");
        let store = server_spec(Path::new(r"C:\Program Files\WindowsApps\DBV_0.14.0.0_x64__abc\dbv-typst-editor.exe"), "D:/libro");
        assert_eq!(store["command"], "dbv-typst-editor.exe");
    }

    #[test]
    fn los_argumentos_se_interpretan() {
        let args: Vec<String> = ["dbv", "--mcp", "--project", "D:/p"].iter().map(|s| s.to_string()).collect();
        assert!(requested(&args));
        assert_eq!(project_arg(&args), Some(PathBuf::from("D:/p")));
        assert!(!requested(&["dbv".to_string()]));
        assert!(!requested(&["--mcp".to_string()]), "el primer argumento es el ejecutable");
        assert_eq!(project_arg(&["dbv".to_string(), "--project".to_string()]), None);
    }
}
