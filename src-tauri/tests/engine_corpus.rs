// =============================================================================
// DBV Typst Editor — Guion de verificación del motor en proceso (RNF-MOTOR, R-M2)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Sobre un libro SINTÉTICO de más de 200 páginas (no hay que llevar al repositorio
// el libro real de un usuario) comprueba, con el motor en proceso:
//   1. que compila en frío dentro de un margen holgado;
//   2. que 40 ediciones seguidas siguen siendo rápidas y NO se vuelven más lentas
//      (una caché que crece sin límite se nota aquí antes que en la ventana);
//   3. que la memoria no crece con las ediciones (`comemo::evict`, riesgo R-M2);
//   4. que el mapa render↔fuente responde en las dos direcciones.
//
// Los umbrales son generosos a propósito: el guion detecta una regresión seria
// (un orden de magnitud), no compite con el reloj de la máquina. Va marcado
// `#[ignore]` porque en modo depuración Typst es unas 10 veces más lento; se
// ejecuta con `npm run verify:engine`, que lo lanza en `--release`.

use std::fs;
use std::path::Path;
use std::process::Command;
use std::time::{Duration, Instant};

use dbv_typst_editor_lib::engine::session::{Attempt, InProcEngine, Mode};
use dbv_typst_editor_lib::typst_engine::compile::CompileTarget;

const CHAPTERS: usize = 40;
const EDITS: usize = 40;

/// Umbrales. Medidos en el libro real (224 páginas): frío 4,4 s, edición 0,5 s.
const MAX_COLD: Duration = Duration::from_secs(60);
const MAX_MEDIAN_EDIT: Duration = Duration::from_secs(8);
/// La mediana de las últimas 10 ediciones no puede pasar de ×2 la de las primeras 10.
const MAX_SLOWDOWN: f64 = 2.0;
/// La memoria tras 40 ediciones no puede pasar de ×1,3 la de tras 10.
const MAX_MEMORY_GROWTH: f64 = 1.3;

fn prose(seed: usize) -> String {
    let words = ["motor", "compilación", "incremental", "documento", "capítulo", "sincronía", "página", "vista"];
    (0..120).map(|i| words[(seed + i * 7) % words.len()]).collect::<Vec<_>>().join(" ")
}

/// Libro de `CHAPTERS` capítulos con títulos, párrafos, ecuaciones, listas y una
/// referencia cruzada por capítulo, hasta pasar de 200 páginas.
fn write_corpus(root: &Path) {
    let mut main = String::from("#set page(paper: \"a4\")\n#set heading(numbering: \"1.1\")\n");
    for c in 0..CHAPTERS {
        main.push_str(&format!("#include \"cap{c:02}.typ\"\n"));
        let mut chapter = format!("#pagebreak(weak: true)\n= Capítulo {c} <cap{c}>\n");
        for s in 0..6 {
            chapter.push_str(&format!("== Sección {c}.{s}\n"));
            for p in 0..5 {
                chapter.push_str(&format!("{}\n\n", prose(c * 31 + s * 7 + p)));
            }
            chapter.push_str(&format!("$ x_{c} = sum_(i=0)^n i^2 + {s} $\n\n- uno\n- dos\n- tres\n\n"));
        }
        chapter.push_str(&format!("Véase el capítulo @cap{}.\n", (c + 1) % CHAPTERS));
        fs::write(root.join(format!("cap{c:02}.typ")), chapter).unwrap();
    }
    fs::write(root.join("main.typ"), main).unwrap();
}

/// Memoria residente del proceso, en MB. `None` si no se puede medir aquí.
fn resident_mb() -> Option<f64> {
    let pid = std::process::id();
    let text = if cfg!(target_os = "windows") {
        let out = Command::new("powershell")
            .args(["-NoProfile", "-Command", &format!("(Get-Process -Id {pid}).WorkingSet64")])
            .output()
            .ok()?;
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    } else {
        let out = Command::new("ps").args(["-o", "rss=", "-p", &pid.to_string()]).output().ok()?;
        // `ps` da KB; se normaliza a bytes para tratar igual los dos casos.
        let kb: f64 = String::from_utf8_lossy(&out.stdout).trim().parse().ok()?;
        return Some(kb / 1024.0);
    };
    Some(text.parse::<f64>().ok()? / 1_048_576.0)
}

fn median(mut values: Vec<Duration>) -> Duration {
    values.sort();
    values[values.len() / 2]
}

fn target(root: &Path, dirty: Option<(&Path, String)>) -> CompileTarget {
    serde_json::from_value(serde_json::json!({
        "document": root.join("main.typ").to_string_lossy(),
        "root": root.to_string_lossy(),
        "singleFile": false,
        "dirtyPath": dirty.as_ref().map(|(p, _)| p.to_string_lossy().to_string()),
        "dirtyContent": dirty.as_ref().map(|(_, c)| c.clone()),
    }))
    .unwrap()
}

#[test]
#[ignore = "lento en depuración: usar `npm run verify:engine` (--release)"]
fn el_motor_aguanta_un_libro_de_mas_de_200_paginas() {
    let dir = tempfile::tempdir().unwrap();
    write_corpus(dir.path());
    let engine = InProcEngine::default();
    engine.set_mode(Mode::InProc);
    let run = |target: &CompileTarget, generation: u64| {
        tauri::async_runtime::block_on(engine.compile(target, generation, |_| true, 0, 2))
    };

    // 1. Compilación en frío.
    let started = Instant::now();
    let Attempt::Done(cold) = run(&target(dir.path(), None), 1) else { panic!("el libro debía compilar") };
    let cold_time = started.elapsed();
    println!("frío: {:?} · {} páginas", cold_time, cold.geometry.len());
    assert!(cold.geometry.len() >= 200, "el corpus debe pasar de 200 páginas, tiene {}", cold.geometry.len());
    assert!(cold_time < MAX_COLD, "compilación en frío demasiado lenta: {cold_time:?}");

    // 2 y 3. Cuarenta ediciones de un capítulo del final, con el texto sin guardar.
    let chapter_path = dir.path().join(format!("cap{:02}.typ", CHAPTERS - 1));
    let original = fs::read_to_string(&chapter_path).unwrap();
    let mut times = Vec::new();
    let mut memory_after_10 = None;
    for edit in 0..EDITS {
        let text = format!("{original}\nEdición número {edit} añadida al final.\n");
        let started = Instant::now();
        let Attempt::Done(_) = run(&target(dir.path(), Some((&chapter_path, text))), 2 + edit as u64) else {
            panic!("la edición {edit} debía compilar")
        };
        times.push(started.elapsed());
        if edit == 9 {
            memory_after_10 = resident_mb();
        }
    }
    let first = median(times[..10].to_vec());
    let last = median(times[EDITS - 10..].to_vec());
    let overall = median(times.clone());
    println!("edición: mediana {overall:?} · primeras 10 {first:?} · últimas 10 {last:?}");
    assert!(overall < MAX_MEDIAN_EDIT, "edición demasiado lenta: {overall:?}");
    assert!(
        last.as_secs_f64() <= first.as_secs_f64() * MAX_SLOWDOWN + 0.05,
        "las ediciones se vuelven más lentas: {first:?} → {last:?}"
    );

    match (memory_after_10, resident_mb()) {
        (Some(early), Some(late)) => {
            println!("memoria: {early:.0} MB tras 10 ediciones → {late:.0} MB tras {EDITS}");
            assert!(late <= early * MAX_MEMORY_GROWTH, "la memoria crece con las ediciones: {early:.0} → {late:.0} MB");
        }
        _ => println!("memoria: no se pudo medir en esta plataforma; se omite la comprobación"),
    }

    // 4. El mapa responde en los dos sentidos sobre la última compilación.
    let last_generation = (1 + EDITS) as u64;
    let hit = (0..40)
        .flat_map(|row| (0..30).map(move |col| (col, row)))
        .find_map(|(col, row)| {
            engine.locate(last_generation, 100, 60.0 + col as f64 * 16.0, 80.0 + row as f64 * 17.0).unwrap()
        })
        .expect("algún punto de la página 100 debe localizar su fuente");
    assert!(hit.file.ends_with(".typ"), "fichero inesperado: {}", hit.file);
    let rects = engine.reveal(last_generation, &hit.file, hit.from, hit.to).unwrap();
    assert!(!rects.is_empty(), "el rango localizado debe poder volver a dibujarse");
}
