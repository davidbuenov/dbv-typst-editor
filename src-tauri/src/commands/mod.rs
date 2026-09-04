// =============================================================================
// DBV Typst Editor — Registro de comandos expuestos al frontend
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Un módulo por dominio (ARCHITECTURE.md §7.4, AD-08): el backend se modulariza
// desde el primer commit para no repetir el monolito `lib.rs` de 1200 líneas de
// DBV Markdown Reader, que este proyecto va a superar ampliamente.

pub mod app_info;
pub mod file_io;
pub mod recent_projects;
