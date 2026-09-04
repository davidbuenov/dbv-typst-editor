// =============================================================================
// DBV Typst Editor — Error tipado compartido por los comandos
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Patrón Result con error tipado (MASTER_PROMPT §coding_standards §2): ningún
// comando devuelve `Option` vacío, booleano mágico ni `String` suelta. El
// discriminante `kind` viaja al frontend para poder decidir el mensaje sin
// tener que parsear texto — el mismo motivo por el que `typst_engine` ya tiene
// su propio `TypstError`, que se mantiene aparte porque su semántica (fallo de
// compilación con código de salida) no es la de una operación de fichero.

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
pub enum AppError {
    /// La ruta no existe en disco.
    NotFound(String),
    /// La ruta existe pero no es del tipo esperado (fichero vs. carpeta), o es inválida.
    InvalidPath(String),
    /// Fallo de entrada/salida al leer o escribir.
    Io(String),
    /// Contenido presente pero con formato incorrecto (manifiesto TOML, JSON de estado...).
    Parse(String),
    /// Operación rechazada por una regla de la aplicación.
    Denied(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let message = match self {
            AppError::NotFound(m)
            | AppError::InvalidPath(m)
            | AppError::Io(m)
            | AppError::Parse(m)
            | AppError::Denied(m) => m,
        };
        write!(f, "{message}")
    }
}

impl std::error::Error for AppError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn el_error_serializa_con_discriminante_y_mensaje() {
        let raw = serde_json::to_string(&AppError::NotFound("x.typ".into())).unwrap();
        assert_eq!(raw, r#"{"kind":"notFound","message":"x.typ"}"#);
    }

    #[test]
    fn display_expone_solo_el_mensaje() {
        assert_eq!(AppError::Io("disco lleno".into()).to_string(), "disco lleno");
    }
}
