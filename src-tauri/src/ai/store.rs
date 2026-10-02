// =============================================================================
// DBV Typst Editor — Conversaciones y avisos de nube por proyecto (RF-92.6)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El estado de la IA de cada proyecto (conversaciones y proveedores en la nube
// ya aceptados) se guarda en la carpeta de datos de la aplicación, NUNCA en el
// proyecto: no ensucia git ni el `.dbvt`. Un fichero por proyecto, nombrado
// por la huella de su raíz (la misma que usa el historial local, RF-73).
// El contenido lo decide el frontend; aquí solo se valida que es JSON y se
// limita su tamaño.

use std::path::{Path, PathBuf};

use serde_json::Value;

use super::AiError;

/// Tope por proyecto: muchas conversaciones largas, pero no sin límite.
pub const MAX_BYTES: usize = 8 * 1024 * 1024;

pub fn file_for(data_dir: &Path, root: &str) -> PathBuf {
    data_dir.join("ai").join(format!("{}.json", crate::history::key_of(root)))
}

pub fn load(data_dir: &Path, root: &str) -> Result<Value, AiError> {
    let path = file_for(data_dir, root);
    if !path.is_file() {
        return Ok(Value::Null);
    }
    let text = std::fs::read_to_string(&path).map_err(|error| AiError::Config(error.to_string()))?;
    // Un fichero dañado no debe impedir usar la IA: se empieza de cero.
    Ok(serde_json::from_str(&text).unwrap_or(Value::Null))
}

pub fn save(data_dir: &Path, root: &str, value: &Value) -> Result<(), AiError> {
    let text = serde_json::to_string(value).map_err(|error| AiError::Config(error.to_string()))?;
    if text.len() > MAX_BYTES {
        return Err(AiError::Config(format!("las conversaciones de este proyecto superan {} MB: borra alguna", MAX_BYTES / 1024 / 1024)));
    }
    let path = file_for(data_dir, root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| AiError::Config(error.to_string()))?;
    }
    let temp = path.with_extension("json.tmp");
    std::fs::write(&temp, text).map_err(|error| AiError::Config(error.to_string()))?;
    std::fs::rename(&temp, &path).map_err(|error| AiError::Config(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn guarda_y_carga_por_proyecto_fuera_del_proyecto() {
        let data = tempfile::tempdir().unwrap();
        let value = json!({"conversations": [{"id": "a", "messages": []}], "consents": ["anthropic"]});
        save(data.path(), "D:/libro", &value).unwrap();
        assert_eq!(load(data.path(), "D:/libro").unwrap(), value);
        assert_eq!(load(data.path(), "D:/otro").unwrap(), Value::Null);
        assert!(file_for(data.path(), "D:/libro").starts_with(data.path()));
    }

    #[test]
    fn un_fichero_danado_empieza_de_cero() {
        let data = tempfile::tempdir().unwrap();
        let path = file_for(data.path(), "D:/libro");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "{no es json").unwrap();
        assert_eq!(load(data.path(), "D:/libro").unwrap(), Value::Null);
    }

    #[test]
    fn rechaza_lo_que_supera_el_tope() {
        let data = tempfile::tempdir().unwrap();
        let big = json!({"x": "a".repeat(MAX_BYTES)});
        assert!(save(data.path(), "D:/libro", &big).is_err());
    }
}
