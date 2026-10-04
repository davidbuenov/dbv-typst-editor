// =============================================================================
// DBV Typst Editor — IA integrada: backend (RNF-IA, RF-90 a RF-95)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Rust hace solo lo que el frontend no debe hacer (ARCHITECTURE.md §7.20):
// custodiar las claves, hablar con la red y compilar propuestas en memoria. El
// bucle del asistente (herramientas, contexto, propuestas) vive en el
// frontend, donde están las pestañas y el contenido sin guardar.

pub mod acp;
pub mod check;
pub mod commands;
pub mod connections;
pub mod detect;
pub mod providers;
pub mod secrets;
pub mod store;
pub mod universe_search;

use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use serde::Serialize;

/// Errores de la IA, con un `kind` que la interfaz sabe explicar (RF-90.3, RF-92.7).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AiError {
    /// Clave no válida o sin permiso (401/403).
    Auth(String),
    /// Límite de uso (429).
    RateLimit(String),
    /// Sin conexión, servidor local apagado, conexión cortada.
    Network(String),
    /// Modelo o ruta inexistente (404).
    NotFound(String),
    /// La conversación no cabe en el contexto del modelo.
    ContextTooLong(String),
    /// Petición rechazada por otro motivo (4xx).
    BadRequest(String),
    /// Fallo del proveedor (5xx) o inesperado.
    Server(String),
    /// El usuario la detuvo.
    Cancelled(String),
    /// Configuración inválida o fichero ilegible.
    Config(String),
    /// El almacén de credenciales del sistema falló.
    SecretStore(String),
}

impl std::fmt::Display for AiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let message = match self {
            Self::Auth(m)
            | Self::RateLimit(m)
            | Self::Network(m)
            | Self::NotFound(m)
            | Self::ContextTooLong(m)
            | Self::BadRequest(m)
            | Self::Server(m)
            | Self::Cancelled(m)
            | Self::Config(m)
            | Self::SecretStore(m) => m,
        };
        write!(f, "{message}")
    }
}

impl std::error::Error for AiError {}

/// Estado de la IA gestionado por Tauri.
#[derive(Default)]
pub struct AiState {
    pub secrets: secrets::Secrets,
    pub checks: Arc<check::CheckWorlds>,
    /// Peticiones en curso → su bandera de cancelación.
    pub running: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn el_error_viaja_con_su_tipo() {
        let raw = serde_json::to_string(&AiError::Auth("clave mala".into())).unwrap();
        assert_eq!(raw, r#"{"kind":"auth","message":"clave mala"}"#);
    }
}
