// =============================================================================
// DBV Typst Editor — Vista previa en vivo del asistente de DOT/Graphviz (RF-51)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Spike de `/plan` (implementation_plan.md §6.1): `#render(dot_string)` del
// paquete `@preview/diagraph:0.3.7` compila tal cual describe su README, sin
// sorpresas — a diferencia de Kantan (RF-50), que rompía con sus valores por
// defecto. Un DOT con error de sintaxis produce un `error:` limpio con
// `exit 1` (mismo camino que ya maneja `run()`/`TypstError::CompilationFailed`,
// nunca un cuelgue). **10 compilaciones consecutivas: media 105ms, máximo
// 110ms** — por encima de los 78ms de RF-46 (el plugin Wasm de Graphviz tarda
// algo más en arrancar que una compilación matemática pura) pero muy por
// debajo del umbral de Doherty (400ms): vista previa en vivo viable con el
// mismo debounce de 200ms.
//
// Reutiliza `compile_source_to_svg` (extraído en el slice anterior de esta
// misma ampliación de `equation.rs`, su único consumidor hasta ahora) para la
// fontanería de tempdir/compilar/leer — este fichero solo aporta su propia
// función de envoltorio (`wrap_dot`), sin tamaño de fuente que envolver y con
// una llamada a `render(...)` en vez de una fórmula entre `$ ... $`. Mismo
// criterio de "sin `EngineState` compartido" que ya documenta `equation.rs`:
// tres compilaciones independientes (principal, ecuación, DOT), cero estado
// compartido entre ellas.

use tauri::AppHandle;

use super::{compile_source_to_svg, TypstError};

const DIAGRAPH_SPEC: &str = "@preview/diagraph:0.3.7";

/// Escapa `value` para que quepa dentro de una cadena Typst (`"..."`).
///
/// Duplicado deliberado de `editor/typstEscape.js` del frontend — mismo
/// algoritmo, pero cada lado del puente IPC tiene su propio runtime y no hay
/// forma de compartir código entre Rust y JS aquí. `dot` llega a este comando
/// como texto DOT crudo (nunca ya escapado por el frontend, a diferencia de
/// `math` en `equation.rs`, que no necesita comillas porque no va dentro de
/// una cadena) — escaparlo es responsabilidad de quien construye la cadena
/// Typst final, es decir, de esta función.
fn escape_typst_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Envuelve el texto DOT crudo en un documento mínimo recortado al
/// contenido — misma "viñeta" que `wrap_equation`, pero con una llamada a
/// `render(...)` del paquete Diagraph en vez de una fórmula entre `$ ... $`.
/// A diferencia de `wrap_equation`, el `#import` no es opcional aquí: RF-51
/// no tiene una variante "sin Diagraph" — todo DOT necesita el paquete para
/// convertirse en algo visible.
fn wrap_dot(dot: &str) -> String {
    format!(
        "#import \"{DIAGRAPH_SPEC}\": render\n#set page(width: auto, height: auto, margin: 8pt)\n#render(\"{}\")\n",
        escape_typst_string(dot)
    )
}

/// Compila un grafo DOT suelto a SVG para la vista previa en vivo del
/// asistente de DOT/Graphviz (RF-51). `dot` es el texto DOT tal cual lo
/// escribe el usuario, sin escapar. `root`, si se pasa (proyecto abierto),
/// permite que fuentes propias del proyecto (`fonts/`) se resuelvan igual que
/// en la vista previa principal.
#[tauri::command]
pub async fn typst_compile_dot(
    app: AppHandle,
    dot: String,
    root: Option<String>,
) -> Result<String, TypstError> {
    let source = wrap_dot(&dot);
    compile_source_to_svg(&app, &source, root.as_deref()).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wrap_dot_incluye_el_import_de_diagraph() {
        let wrapped = wrap_dot("digraph { a -> b }");
        assert!(wrapped.contains("#import \"@preview/diagraph:0.3.7\": render"));
    }

    #[test]
    fn wrap_dot_usa_una_pagina_recortada_al_contenido() {
        let wrapped = wrap_dot("digraph { a -> b }");
        assert!(wrapped.contains("width: auto, height: auto"));
    }

    #[test]
    fn wrap_dot_envuelve_el_texto_dot_en_una_llamada_render() {
        let wrapped = wrap_dot("digraph { a -> b }");
        assert!(wrapped.contains("#render(\"digraph { a -> b }\")"));
    }

    #[test]
    fn wrap_dot_escapa_comillas_dentro_del_texto_dot() {
        let wrapped = wrap_dot(r#"digraph { a [label="hi"] }"#);
        assert!(wrapped.contains(r#"a [label=\"hi\"]"#));
    }

    #[test]
    fn wrap_dot_escapa_backslashes() {
        let wrapped = wrap_dot("a\\b");
        assert!(wrapped.contains("#render(\"a\\\\b\")"));
    }
}
