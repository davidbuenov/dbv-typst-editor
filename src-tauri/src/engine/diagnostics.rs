// =============================================================================
// DBV Typst Editor — Diagnósticos del compilado en proceso (RF-59)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El motor clásico enseñaba el `stderr` del CLI: texto con una ruta de la réplica
// temporal, que había que reescribir hacia el proyecto real, y con números de línea
// desplazados por las anclas sembradas (medido: línea 11 en la réplica para un
// fallo en la 8). Aquí los errores y avisos salen del MISMO compilado, con el
// fichero y el rango exactos donde Typst los detectó, así que no hay réplica que
// remapear ni anclas que desplacen nada.
//
// Cada diagnóstico se entrega como un rango en UTF-16 (línea y columna
// 1-indexadas), que es lo que CodeMirror necesita para subrayar y lo que el panel
// de Problemas necesita para saltar. Un diagnóstico de un fichero de paquete no es
// del usuario y no tiene fichero navegable: se conserva el mensaje sin rango.

use std::ops::Range;

use serde::Serialize;
use typst::diag::{Severity, SourceDiagnostic};
use typst::syntax::{DiagSpanKind, FileId, Source};

use super::map::{RelativeLookup, SourceLookup};

/// Gravedad de un diagnóstico.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Error,
    Warning,
}

/// Un error o un aviso del compilador con su lugar en el proyecto.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub level: Level,
    pub message: String,
    /// Pistas que Typst aporta para arreglarlo.
    pub hints: Vec<String>,
    /// Ruta relativa a la raíz del proyecto, con `/`; `None` si el diagnóstico
    /// cae en un paquete o no tiene origen.
    pub file: Option<String>,
    pub start_line: u32,
    pub start_column: u32,
    pub end_line: u32,
    pub end_column: u32,
}

/// Convierte los diagnósticos de Typst en rangos por fichero.
///
/// El resultado va ordenado: errores antes que avisos y, dentro de cada gravedad,
/// por fichero y posición, para que el panel de Problemas sea estable de una
/// compilación a la siguiente. Los duplicados exactos (Typst repite un mismo
/// error cuando varias rutas de evaluación lo alcanzan) se eliminan.
pub fn collect(
    diagnostics: &[SourceDiagnostic],
    source_of: SourceLookup<'_>,
    relative_of: RelativeLookup<'_>,
) -> Vec<Diagnostic> {
    let mut result: Vec<Diagnostic> = diagnostics
        .iter()
        .map(|diagnostic| convert(diagnostic, source_of, relative_of))
        .collect();
    result.sort_by(|a, b| {
        (a.level, a.file.as_deref().unwrap_or(""), a.start_line, a.start_column)
            .cmp(&(b.level, b.file.as_deref().unwrap_or(""), b.start_line, b.start_column))
    });
    result.dedup();
    result
}

impl PartialOrd for Level {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Level {
    /// Los errores van antes que los avisos.
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        let rank = |level: &Level| match level {
            Level::Error => 0,
            Level::Warning => 1,
        };
        rank(self).cmp(&rank(other))
    }
}

fn convert(diagnostic: &SourceDiagnostic, source_of: SourceLookup<'_>, relative_of: RelativeLookup<'_>) -> Diagnostic {
    let level = match diagnostic.severity {
        Severity::Error => Level::Error,
        Severity::Warning => Level::Warning,
    };
    let mut located = Diagnostic {
        level,
        message: diagnostic.message.to_string(),
        hints: diagnostic.hints.iter().map(|hint| hint.v.to_string()).collect(),
        file: None,
        start_line: 0,
        start_column: 0,
        end_line: 0,
        end_column: 0,
    };
    let Some((id, range)) = byte_range(diagnostic, source_of) else { return located };
    let Some(file) = relative_of(id) else { return located };
    let Some(source) = source_of(id) else { return located };
    let (Some(start), Some(end)) = (line_column(&source, range.start), line_column(&source, range.end)) else {
        return located;
    };
    located.file = Some(file);
    (located.start_line, located.start_column) = start;
    (located.end_line, located.end_column) = end;
    located
}

/// Fichero y rango de bytes al que apunta el diagnóstico. Typst 0.15 distingue un
/// `Span` numerado (con sub-rango opcional) de un rango de bytes directo, que es
/// como se señalan los ficheros que no son de Typst (una bibliografía, un dato).
fn byte_range(diagnostic: &SourceDiagnostic, source_of: SourceLookup<'_>) -> Option<(FileId, Range<usize>)> {
    match diagnostic.span.get() {
        DiagSpanKind::Detached => None,
        DiagSpanKind::Number { id, num, sub_range } => {
            let range = source_of(id)?.range(num, sub_range)?;
            Some((id, range))
        }
        DiagSpanKind::Range { id, range } => Some((id, range)),
    }
}

/// Línea y columna (1-indexadas, columna en UTF-16) de un byte.
fn line_column(source: &Source, byte: usize) -> Option<(u32, u32)> {
    let lines = source.lines();
    let line = lines.byte_to_line(byte)?;
    let line_start = lines.line_to_byte(line)?;
    let column = lines.byte_to_utf16(byte)? - lines.byte_to_utf16(line_start)?;
    Some((line as u32 + 1, column as u32 + 1))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::worker::{Outcome, Request, Worker};
    use crate::engine::world::EngineWorld;
    use std::fs;
    use std::sync::{mpsc::channel, Arc, Mutex};
    use std::time::Duration;

    /// Compila el proyecto y devuelve sus diagnósticos ya convertidos.
    fn diagnose(files: &[(&str, &str)]) -> Vec<Diagnostic> {
        let dir = tempfile::tempdir().unwrap();
        for (name, text) in files {
            let path = dir.path().join(name);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, text).unwrap();
        }
        let world = EngineWorld::new(dir.path(), &dir.path().join(files[0].0)).unwrap();
        let (tx, rx) = channel();
        let tx = Mutex::new(tx);
        let worker = Worker::spawn(world.clone(), Arc::new(move |result| {
            let _ = tx.lock().unwrap().send(result);
        }));
        worker.submit(Request { generation: 1, overrides: Vec::new() });
        let all: Vec<SourceDiagnostic> = match rx.recv_timeout(Duration::from_secs(60)).unwrap().outcome {
            Outcome::Failed { errors, warnings } => errors.into_iter().chain(warnings).collect(),
            Outcome::Compiled { warnings, .. } => warnings,
            Outcome::Panicked(message) => panic!("pánico: {message}"),
        };
        let (source_world, relative_world) = (world.clone(), world.clone());
        collect(
            &all,
            &move |id| typst::World::source(&*source_world, id).ok(),
            &move |id| relative_world.relative_path(id),
        )
    }

    #[test]
    fn un_error_en_un_capitulo_incluido_apunta_a_ese_fichero_y_linea() {
        let diagnostics = diagnose(&[
            ("main.typ", "= Libro\n#include \"cap.typ\"\n"),
            ("cap.typ", "Primera linea.\n#variable-que-no-existe\n"),
        ]);

        let error = diagnostics.iter().find(|d| d.level == Level::Error).expect("debe haber un error");

        assert_eq!(error.file.as_deref(), Some("cap.typ"));
        assert_eq!(error.start_line, 2);
        assert_eq!(error.start_column, 2, "el rango empieza tras el `#`");
        assert!(error.message.contains("unknown variable"), "{}", error.message);
    }

    #[test]
    fn el_rango_cubre_lo_que_typst_senala_no_toda_la_linea() {
        let diagnostics = diagnose(&[("main.typ", "Texto #foo y mas texto.")]);

        let error = &diagnostics[0];

        assert_eq!((error.start_line, error.end_line), (1, 1));
        assert_eq!(error.end_column - error.start_column, "foo".len() as u32);
    }

    #[test]
    fn las_columnas_cuentan_unidades_utf16_no_bytes() {
        // "ñandú 😀 " son 9 unidades UTF-16 (el emoji vale 2) y 13 bytes.
        let diagnostics = diagnose(&[("main.typ", "ñandú 😀 #desconocida")]);

        let error = &diagnostics[0];

        assert_eq!(error.start_column, 9 + 1 + 1, "9 unidades + la columna 1-indexada + el `#`");
    }

    #[test]
    fn un_aviso_llega_como_aviso_con_su_lugar() {
        let diagnostics = diagnose(&[("main.typ", "#set text(font: \"FuenteQueNoExiste\")\nHola.")]);

        let warning = diagnostics.iter().find(|d| d.level == Level::Warning).expect("debe haber un aviso");

        assert_eq!(warning.file.as_deref(), Some("main.typ"));
        assert!(warning.message.to_lowercase().contains("font"), "{}", warning.message);
        assert!(diagnostics.iter().all(|d| d.level == Level::Warning), "no hay errores en este documento");
    }

    #[test]
    fn los_errores_van_antes_que_los_avisos_y_en_orden_de_posicion() {
        let diagnostics = diagnose(&[(
            "main.typ",
            "#set text(font: \"FuenteQueNoExiste\")\n#segundo\n#primero-no\n",
        )]);

        let levels: Vec<Level> = diagnostics.iter().map(|d| d.level).collect();
        let first_warning = levels.iter().position(|l| *l == Level::Warning);
        let last_error = levels.iter().rposition(|l| *l == Level::Error);
        if let (Some(w), Some(e)) = (first_warning, last_error) {
            assert!(e < w, "los errores primero: {levels:?}");
        }
        let error_lines: Vec<u32> = diagnostics.iter().filter(|d| d.level == Level::Error).map(|d| d.start_line).collect();
        assert!(error_lines.windows(2).all(|w| w[0] <= w[1]), "por posición: {error_lines:?}");
    }

    #[test]
    fn un_diagnostico_sin_origen_conserva_el_mensaje_sin_rango() {
        let detached = SourceDiagnostic::error(typst::syntax::DiagSpan::detached(), "sin origen");

        let converted = collect(&[detached], &|_| None, &|_| None);

        assert_eq!(converted.len(), 1);
        assert_eq!(converted[0].file, None);
        assert_eq!((converted[0].start_line, converted[0].start_column), (0, 0));
        assert_eq!(converted[0].message, "sin origen");
    }

    #[test]
    fn los_duplicados_exactos_se_eliminan() {
        let detached = SourceDiagnostic::error(typst::syntax::DiagSpan::detached(), "repetido");

        let converted = collect(&[detached.clone(), detached], &|_| None, &|_| None);

        assert_eq!(converted.len(), 1);
    }

    #[test]
    fn un_proyecto_sin_problemas_no_da_diagnosticos() {
        assert!(diagnose(&[("main.typ", "= Todo bien\nTexto.")]).is_empty());
    }
}
