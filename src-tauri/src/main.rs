// =============================================================================
// DBV Typst Editor — Punto de entrada del binario
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

// Evita que se abra una consola junto a la ventana en compilaciones release de Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dbv_typst_editor_lib::run()
}
