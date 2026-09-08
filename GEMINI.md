# Project Instructions for Gemini CLI & Antigravity — DBV Typst Editor

This project follows **Spec-Driven Development (SDD)** with **dbv-specs-ops**.
Read these files at the start of each session before proposing any code or plan:

| File | Purpose |
| --- | --- |
| `dbv-specs-ops/project.config.md` | Project identity: DBV Typst Editor, author, license and headers |
| `dbv-specs-ops/docs/MASTER_PROMPT.md` | Mandatory workflow, rules and boundaries |
| `dbv-specs-ops/docs/SPECIFICATIONS.md` | Current project requirements (DBV Typst Editor PRD) |
| `dbv-specs-ops/docs/ARCHITECTURE.md` | Stack & technical decisions (Rust + Tauri v2) |
| `dbv-specs-ops/docs/DESIGN.md` | Visual design system (if it exists) |
| `dbv-specs-ops/memory.md` | Qualitative knowledge & ADRs |
| `dbv-specs-ops/task.md` | Current state + Context Snapshot |

> **Note:** This file is auto-loaded by both **Gemini CLI** and **Antigravity**. For Antigravity-specific setup, see `ANTIGRAVITY.md`.

## 🌐 Changelog bilingüe (regla del proyecto)

El repositorio lo consultan también lectores de habla inglesa, así que el changelog vive en
**dos ficheros espejo** que deben mantenerse sincronizados:

| Fichero | Idioma | Enganchado desde |
| --- | --- | --- |
| `dbv-specs-ops/CHANGELOG.md` | Español | `README.md` |
| `dbv-specs-ops/CHANGELOG.en.md` | Inglés | `README.en.md` |

**Siempre que añadas o muevas una entrada del changelog —en `/build`, `/test` o `/ship`—
hazlo en los DOS ficheros y en el mismo commit.** No es una traducción automática ni un
resumen: la entrada inglesa debe llevar el mismo detalle técnico que la española. Un `/ship`
que publica una versión tiene que crear la sección versionada en ambos.

## ⚠️ Core Rules
**Read `dbv-specs-ops/docs/MASTER_PROMPT.md` and follow its workflow strictly.**

> 🛠️ Framework SDD creado por **[David Bueno Vallejo](https://github.com/davidbuenov)** · [dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)
