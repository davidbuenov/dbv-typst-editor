// =============================================================================
// DBV Typst Editor — Servidor MCP para agentes externos (RF-113, spike S157)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// `DBV Typst Editor --mcp --project <carpeta>` arranca, en lugar de la ventana, un servidor
// MCP por stdio: lo lanza el agente (Claude Code, Claude Desktop, Cursor…) como proceso hijo, así
// que no hay puerto de red y ningún otro proceso puede conectarse (RF-113.4).
//
// Decisión del spike S157 (ADR-V0140-003, que MODIFICA el plan): el servidor es un MODO del propio
// ejecutable y no un crate y un sidecar aparte. Un `[[bin]]` en el mismo paquete que `tauri-build`
// chocaba con la comprobación de `externalBin`, y un crate aparte obligaba a sacar a una biblioteca
// sin Tauri el motor, la documentación, Universe, las fuentes y el renderizado (miles de líneas).
// Como modo `--mcp` reutiliza todo ese código tal cual, no añade ningún binario al paquete y el alias
// de ejecución de la Store apunta al ejecutable que ya está. Lo que había que comprobar era que un
// ejecutable del subsistema de ventanas de Windows sirve stdio por tuberías: se mide en el spike.

use std::path::PathBuf;

use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{ServerCapabilities, ServerConfig},
    schemars, tool, tool_handler, tool_router, ErrorData as McpError, ServerHandler, ServiceExt,
};
use serde::{Deserialize, Serialize};

/// Lo que cuenta la herramienta de prueba del spike.
#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct InfoRequest {
    /// Texto cualquiera que la herramienta devuelve tal cual (para comprobar el ida y vuelta).
    #[serde(default)]
    pub echo: Option<String>,
}

/// El servidor: la carpeta del proyecto con la que se lanzó y el enrutador de herramientas.
#[derive(Clone)]
pub struct DbvMcp {
    project: Option<PathBuf>,
    tool_router: ToolRouter<Self>,
}

impl DbvMcp {
    pub fn new(project: Option<PathBuf>) -> Self {
        Self { project, tool_router: Self::tool_router() }
    }
}

#[tool_router(router = tool_router)]
impl DbvMcp {
    /// Qué es este servidor (herramienta de comprobación del spike).
    #[tool(description = "Information about the DBV Typst Editor MCP server: version, compiler and project folder.")]
    async fn dbv_info(&self, Parameters(request): Parameters<InfoRequest>) -> Result<String, McpError> {
        let project = self.project.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "(none)".into());
        Ok(format!(
            "DBV Typst Editor {} · Typst {} · project: {}{}",
            env!("CARGO_PKG_VERSION"),
            crate::universe_catalog::compiler_version(),
            project,
            request.echo.map(|e| format!(" · echo: {e}")).unwrap_or_default(),
        ))
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for DbvMcp {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(rmcp::model::Implementation::new("dbv-typst-editor", env!("CARGO_PKG_VERSION")))
    }
}

/// `--project <carpeta>` de los argumentos, si está y es una carpeta.
pub fn project_from_args(args: &[String]) -> Option<PathBuf> {
    let at = args.iter().position(|arg| arg == "--project")?;
    let path = PathBuf::from(args.get(at + 1)?);
    path.is_dir().then_some(path)
}

/// ¿Se pidió el modo servidor? (`--mcp` como argumento).
pub fn requested(args: &[String]) -> bool {
    args.iter().skip(1).any(|arg| arg == "--mcp")
}

/// Sirve MCP por stdio hasta que el cliente cierra. Devuelve el código de salida del proceso.
pub fn run(args: &[String]) -> i32 {
    let server = DbvMcp::new(project_from_args(args));
    let outcome = tauri::async_runtime::block_on(async move {
        let service = server.serve(rmcp::transport::stdio()).await?;
        service.waiting().await?;
        Ok::<(), Box<dyn std::error::Error + Send + Sync>>(())
    });
    match outcome {
        Ok(()) => 0,
        Err(error) => {
            // Por stderr: stdout es el canal del protocolo y no debe llevar nada más.
            eprintln!("dbv-typst-editor --mcp: {error}");
            1
        }
    }
}
