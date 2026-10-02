// =============================================================================
// DBV Typst Editor — Conexiones con proveedores de IA (RF-90)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Lista de conexiones configuradas (`ai-connections.json` en la carpeta de
// configuración): proveedor, URL, modelo y capacidades. NUNCA la clave: esa
// vive en el almacén de credenciales del sistema (`secrets.rs`) y aquí solo
// queda `hasKey`.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::AiError;

/// Proveedor de una conexión directa (RF-90.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ProviderKind {
    Ollama,
    LmStudio,
    OpenAiCompatible,
    OpenAi,
    Anthropic,
    Gemini,
    OpenRouter,
    /// Agente instalado por ACP (RF-91): `base_url` = `acp:<agente>` y, si es
    /// `acp:custom`, `model` lleva la orden completa.
    Agent,
}

/// Protocolo de red que habla el proveedor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Protocol {
    OpenAi,
    Anthropic,
    /// API nativa de Ollama (`/api/chat`): la única forma de fijar el contexto
    /// (`num_ctx`); la compatible con OpenAI usa el de su configuración, que
    /// puede ser de solo 2 048 tokens y recorta en silencio.
    Ollama,
}

impl ProviderKind {
    /// URL base por defecto (la del usuario manda en `OpenAiCompatible`).
    pub fn default_base_url(self) -> &'static str {
        match self {
            Self::Ollama => "http://localhost:11434/v1",
            Self::LmStudio => "http://localhost:1234/v1",
            Self::OpenAiCompatible => "http://localhost:8080/v1",
            Self::OpenAi => "https://api.openai.com/v1",
            Self::Anthropic => "https://api.anthropic.com/v1",
            Self::Gemini => "https://generativelanguage.googleapis.com/v1beta/openai",
            Self::OpenRouter => "https://openrouter.ai/api/v1",
            Self::Agent => "acp:claude",
        }
    }

    /// ¿Los datos salen del equipo? (aviso de RNF-IA.4).
    pub fn is_cloud(self) -> bool {
        // Un agente (Claude Code, Gemini CLI…) habla con su nube.
        matches!(self, Self::OpenAi | Self::Anthropic | Self::Gemini | Self::OpenRouter | Self::Agent)
    }

    /// Contexto prudente si el proveedor no lo informa (ADR-V0130-002). Ollama
    /// trabaja con 4 096 por defecto aunque el modelo admita más.
    pub fn default_context(self) -> u32 {
        match self {
            Self::Ollama => 4096,
            Self::LmStudio | Self::OpenAiCompatible => 8192,
            _ => 32768,
        }
    }
}

/// Una conexión configurada.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub name: String,
    pub provider: ProviderKind,
    pub base_url: String,
    pub model: String,
    /// Hay una clave guardada en el almacén del sistema (o en la sesión).
    #[serde(default)]
    pub has_key: bool,
    #[serde(default)]
    pub context_tokens: Option<u32>,
    #[serde(default)]
    pub supports_tools: Option<bool>,
    #[serde(default)]
    pub supports_images: Option<bool>,
}

impl Connection {
    pub fn protocol(&self) -> Protocol {
        match self.provider {
            ProviderKind::Anthropic => Protocol::Anthropic,
            ProviderKind::Ollama => Protocol::Ollama,
            _ => Protocol::OpenAi,
        }
    }

    /// Contexto con el que se pide al modelo (el configurado o el prudente).
    pub fn context(&self) -> u32 {
        self.context_tokens.unwrap_or_else(|| self.provider.default_context())
    }

    /// Una URL que no sea `http(s)` no se acepta (ni `file:`, ni nada raro).
    pub fn validate(&self) -> Result<(), AiError> {
        let url = self.base_url.trim();
        if self.provider == ProviderKind::Agent {
            let known = ["acp:claude", "acp:gemini", "acp:codex", "acp:copilot", "acp:custom"];
            if !known.contains(&url) {
                return Err(AiError::Config(format!("agente no reconocido ({url})")));
            }
        } else if !(url.starts_with("http://") || url.starts_with("https://")) {
            return Err(AiError::Config(format!("la dirección debe empezar por http:// o https:// ({url})")));
        }
        if self.id.trim().is_empty() || self.id.contains(['/', '\\']) {
            return Err(AiError::Config("identificador de conexión no válido".into()));
        }
        Ok(())
    }
}

/// Fichero de conexiones: la lista y cuál está activa.
#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionsFile {
    #[serde(default)]
    pub connections: Vec<Connection>,
    #[serde(default)]
    pub active: Option<String>,
    /// RNF-IA.1: «Mostrar las funciones de IA». Por defecto, sí (si hay conexión).
    #[serde(default = "yes")]
    pub show_ai: bool,
}

fn yes() -> bool {
    true
}

pub fn file_path(config_dir: &Path) -> PathBuf {
    config_dir.join("ai-connections.json")
}

pub fn load(config_dir: &Path) -> Result<ConnectionsFile, AiError> {
    let path = file_path(config_dir);
    if !path.is_file() {
        return Ok(ConnectionsFile { show_ai: true, ..ConnectionsFile::default() });
    }
    let text = std::fs::read_to_string(&path).map_err(|error| AiError::Config(error.to_string()))?;
    serde_json::from_str(&text).map_err(|error| AiError::Config(format!("{} ilegible: {error}", path.display())))
}

/// Escritura atómica (temporal + renombrado), como el resto de la aplicación.
pub fn save(config_dir: &Path, file: &ConnectionsFile) -> Result<(), AiError> {
    std::fs::create_dir_all(config_dir).map_err(|error| AiError::Config(error.to_string()))?;
    let path = file_path(config_dir);
    let temp = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(file).map_err(|error| AiError::Config(error.to_string()))?;
    std::fs::write(&temp, text).map_err(|error| AiError::Config(error.to_string()))?;
    std::fs::rename(&temp, &path).map_err(|error| AiError::Config(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Connection {
        Connection {
            id: "c1".into(),
            name: "Claude".into(),
            provider: ProviderKind::Anthropic,
            base_url: ProviderKind::Anthropic.default_base_url().into(),
            model: "claude-sonnet".into(),
            has_key: true,
            context_tokens: None,
            supports_tools: Some(true),
            supports_images: Some(true),
        }
    }

    #[test]
    fn guardar_y_cargar_conserva_las_conexiones() {
        let dir = tempfile::tempdir().unwrap();
        let file = ConnectionsFile { connections: vec![sample()], active: Some("c1".into()), show_ai: true };
        save(dir.path(), &file).unwrap();
        assert_eq!(load(dir.path()).unwrap(), file);
    }

    #[test]
    fn sin_fichero_no_hay_conexiones_y_se_muestra_la_ia() {
        let dir = tempfile::tempdir().unwrap();
        let file = load(dir.path()).unwrap();
        assert!(file.connections.is_empty());
        assert!(file.show_ai);
    }

    #[test]
    fn la_nube_y_el_protocolo_dependen_del_proveedor() {
        assert!(ProviderKind::Gemini.is_cloud());
        assert!(!ProviderKind::Ollama.is_cloud());
        assert_eq!(sample().protocol(), Protocol::Anthropic);
    }

    #[test]
    fn solo_se_aceptan_urls_http() {
        let mut connection = sample();
        connection.base_url = "file:///etc".into();
        assert!(connection.validate().is_err());
        connection.base_url = "http://localhost:11434/v1".into();
        assert!(connection.validate().is_ok());
        connection.id = "../x".into();
        assert!(connection.validate().is_err());
        connection.id = "a1".into();
        connection.provider = ProviderKind::Agent;
        connection.base_url = "acp:claude".into();
        assert!(connection.validate().is_ok());
        connection.base_url = "acp:../../x".into();
        assert!(connection.validate().is_err());
    }
}
