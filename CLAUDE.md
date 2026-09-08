# Instrucciones del Proyecto para Claude Code — DBV Typst Editor

Este proyecto sigue la metodología **Spec-Driven Development (SDD)** con el framework **dbv-specs-ops**.
Toda la documentación, normas y especificaciones residen en el subdirectorio `dbv-specs-ops/`:

| Archivo | Propósito |
| --- | --- |
| `dbv-specs-ops/project.config.md` | Identidad del proyecto: nombre, autor, licencia y plantilla de cabeceras |
| `dbv-specs-ops/docs/MASTER_PROMPT.md` | Workflow obligatorio, normas y límites de desarrollo |
| `dbv-specs-ops/docs/SPECIFICATIONS.md` | Requisitos del proyecto actual (DBV Typst Editor) |
| `dbv-specs-ops/docs/ARCHITECTURE.md` | Stack técnico (Rust + Tauri v2 + Typst CLI/crate) |
| `dbv-specs-ops/docs/DESIGN.md` | Sistema de diseño visual (si existe) |
| `dbv-specs-ops/memory.md` | Contexto y Decisiones cualitativas (ADRs) |
| `dbv-specs-ops/task.md` | Estado actual de tareas + Snapshot de Contexto |

## 🌐 Changelog bilingue (regla del proyecto)

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

## ⚠️ Reglas Core
**Lee `dbv-specs-ops/docs/MASTER_PROMPT.md` y sigue su flujo de trabajo estrictamente.**

> 🛠️ Framework SDD creado por **[David Bueno Vallejo](https://github.com/davidbuenov)** · [dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)
