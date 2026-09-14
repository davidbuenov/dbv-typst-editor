// =============================================================================
// DBV Typst Editor — Vista previa en vivo del editor de ecuaciones (RF-46)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Spike de la Fase 19 (`/build` de v0.7.0, Slice 60): medir si compilar con el
// sidecar en cada ajuste es lo bastante rápido para sentirse "en vivo" — la
// alternativa (una librería de render matemático de terceros, tipo KaTeX)
// renderizaría LaTeX, no Typst, con tipografía y espaciado distintos, lo que
// le enseñaría al usuario algo que NO es lo que el documento final compilará.
//
// Resultado medido (proceso nativo, `subprocess` de Python contra el binario
// vendorizado real, 10 repeticiones de una fórmula con integral y raíz):
// **media 78 ms, máximo 84 ms** — muy por debajo del umbral de Doherty (400 ms,
// ya documentado en ARCHITECTURE.md/SPECIFICATIONS.md) y del propio debounce
// de 350 ms que ya usa la vista previa principal (RF-06). Decisión: usar el
// sidecar, sin librería nueva — fidelidad total con cero dependencias.
//
// Sin cancelación de proceso a la rusa (a diferencia de `EngineState` en
// `compile.rs`): con ~80 ms por compilación y un debounce del frontend muy por
// encima de eso, no hay riesgo real de amontonamiento, y el frontend ya
// descarta cualquier respuesta que no sea la de su petición más reciente
// (mismo principio que la vista previa principal, aplicado en JS en vez de
// en un `Mutex` compartido) — evita generar CADA compilación de ecuación
// contra el `EngineState` global, que cancelaría por error la vista previa
// PRINCIPAL del documento si ambas compartieran el mismo estado.

use tauri::AppHandle;

use super::{font_path_args, run, TypstError};

/// Envuelve el cuerpo matemático (sin los `$` delimitadores) en un documento
/// mínimo recortado al contenido — sin cabecera, pie, ni márgenes de página
/// real: es una "viñeta" de fórmula, no una página del documento.
///
/// `preamble`, si llega, se inserta ANTES de la fórmula (nunca dentro de
/// `$...$`, donde un `#import` no compila): lo usa el frontend para el
/// `#import` de MiTeX solo cuando la fórmula en curso ya usa `mi(...)` — no
/// siempre, porque forzarlo en cada vista previa descargaría el paquete
/// aunque el usuario nunca haya pulsado "Pegar LaTeX", rompiendo el trabajo
/// sin conexión para quien solo construye una fórmula con las piezas.
fn wrap_equation(math: &str, font_size_pt: f64, preamble: Option<&str>) -> String {
    let preamble_line = preamble.map(|line| format!("{line}\n")).unwrap_or_default();
    format!(
        "{preamble_line}#set page(width: auto, height: auto, margin: 8pt)\n#set text(size: {font_size_pt}pt)\n$ {math} $\n"
    )
}

/// Compila una fórmula suelta a SVG para la vista previa en vivo del editor
/// de ecuaciones (RF-46). `math` es el cuerpo Typst YA construido por los
/// botones del editor (o pegado vía MiTeX) — sin los `$` envolventes, que
/// pone esta función. `root`, si se pasa (proyecto abierto), permite que
/// fuentes propias del proyecto (`fonts/`) se resuelvan igual que en la vista
/// previa principal; sin proyecto, se compila sin `--font-path` adicional.
#[tauri::command]
pub async fn typst_compile_equation(
    app: AppHandle,
    math: String,
    root: Option<String>,
    font_size_pt: Option<f64>,
    preamble: Option<String>,
) -> Result<String, TypstError> {
    let workdir =
        tempfile::tempdir().map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;
    let input_path = workdir.path().join("equation.typ");
    let output_path = workdir.path().join("equation.svg");

    let source = wrap_equation(&math, font_size_pt.unwrap_or(11.0), preamble.as_deref());
    std::fs::write(&input_path, source).map_err(|error| TypstError::ExecutionFailed(error.to_string()))?;

    let input_arg = input_path.to_string_lossy().to_string();
    let output_arg = output_path.to_string_lossy().to_string();

    let mut args = vec!["compile".to_string(), input_arg, output_arg, "--format".to_string(), "svg".to_string()];
    if let Some(root) = &root {
        args.extend(font_path_args(std::path::Path::new(root)));
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();

    // No usa `run_cancelable`/`EngineState` a propósito (ver cabecera del
    // fichero): es un proceso independiente, corto, sin estado compartido con
    // la vista previa principal del documento. `run()` ya distingue éxito de
    // fallo por el código de salida (`TypstError::CompilationFailed` si el
    // compilador rechaza la fórmula), así que aquí solo queda leer el SVG.
    run(&app, &arg_refs).await?;

    std::fs::read_to_string(&output_path).map_err(|error| TypstError::ExecutionFailed(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wrap_equation_envuelve_el_cuerpo_entre_delimitadores_de_matematicas() {
        let wrapped = wrap_equation("x^2 + y^2 = z^2", 11.0, None);
        assert!(wrapped.contains("$ x^2 + y^2 = z^2 $"));
    }

    #[test]
    fn wrap_equation_usa_una_pagina_recortada_al_contenido() {
        let wrapped = wrap_equation("x", 11.0, None);
        assert!(wrapped.contains("width: auto, height: auto"));
    }

    #[test]
    fn wrap_equation_aplica_el_tamano_de_letra_pedido() {
        let wrapped = wrap_equation("x", 18.0, None);
        assert!(wrapped.contains("#set text(size: 18pt)"));
    }

    #[test]
    fn wrap_equation_sin_preambulo_no_anade_ninguna_linea_de_import() {
        let wrapped = wrap_equation("x", 11.0, None);
        assert!(!wrapped.contains("#import"));
    }

    #[test]
    fn wrap_equation_con_preambulo_lo_pone_antes_de_la_formula_no_dentro() {
        let preamble = "#import \"@preview/mitex:0.2.7\": mi";
        let wrapped = wrap_equation("mi(\"x\")", 11.0, Some(preamble));
        let import_at = wrapped.find(preamble).expect("preámbulo presente");
        let formula_at = wrapped.find("$ mi").expect("fórmula presente");
        assert!(import_at < formula_at, "el import debe ir ANTES de $...$: {wrapped}");
    }
}
