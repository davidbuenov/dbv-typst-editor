// =============================================================================
// DBV Typst Editor — Punto de entrada del binario
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

// Evita que se abra una consola junto a la ventana en compilaciones release de Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `--mcp`: en lugar de la ventana, un servidor MCP por stdio para agentes externos (RF-113). Se decide ANTES de
    // arrancar nada de Tauri: sin ventana, sin instancia única y sin tocar la interfaz.
    let args: Vec<String> = std::env::args().collect();
    if dbv_typst_editor_lib::mcp::requested(&args) {
        std::process::exit(dbv_typst_editor_lib::mcp::run(&args));
    }
    dbv_typst_editor_lib::run()
}
