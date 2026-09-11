# Spike: forma real del índice de Typst Universe (RF-34, v0.6.0)

**Pregunta:** ¿qué campos trae de verdad `packages.typst.org/preview/index.json`, y son
siempre los mismos en cada entrada?

**Método:** descarga real el 2026-09-11 con `curl`. 4.711 paquetes, ~2,2 MB. No se
versiona entero por peso — `index-sample.json` es un recorte de las primeras 25 entradas,
suficiente para fijar la forma exacta.

**Hallazgo:** todas las entradas traen `name`, `version`, `entrypoint`, `authors`,
`license`, `description`, `repository`, `keywords`, `compiler`, `updatedAt`. **No todas**
traen `categories`/`disciplines`/`exclude`: solo aparecen cuando aplican (`categories` es
propio de las plantillas, con su objeto `template{path, entrypoint, thumbnail}`). La
consecuencia práctica: `UniverseIndexEntry` en `src-tauri/src/commands/universe_index.rs`
deserializa esos campos opcionales con `#[serde(default)]`, no asumiendo que siempre
llegan — verificado con los dos tests de `commands::universe_index::tests`.

Detalle completo de la decisión de arquitectura (modelo de dos niveles verificado/
comunidad, caché en memoria, sin registro propio) en `memory.md`.
