# Banco de pruebas — migración LaTeX → Typst (spike S-1)

Herramienta de **investigación**, no código de producto. Mide qué pasa de verdad
al convertir un proyecto LaTeX real a Typst con [Tylax](https://github.com/scipenai/tylax)
y comprobar el resultado con el compilador Typst que la propia aplicación vendoriza.

> **Decisión vigente: `ADR-LATEX-001` (`dbv-specs-ops/memory.md`, 2026-09-06).**
> La migración está **aplazada** como pilar de v1.0 y es investigación viva.
> Resultados y conclusiones: [`dbv-specs-ops/docs/LATEX_MIGRATION_RESEARCH.md`](../../dbv-specs-ops/docs/LATEX_MIGRATION_RESEARCH.md) §0.bis.
> **Este directorio existe para que medir un proyecto nuevo cueste minutos, no una tarde** — que es la condición de la que depende el disparador de reevaluación del ADR.

## Por qué está guardado

El spike encontró que Tylax por sí solo **no** produce un documento que compile, y que
los fallos son un catálogo **pequeño y estable** de patrones reparables. Ese catálogo es
el activo: está implementado en `prepass()` / `postpass()` de `src/main.rs`, con un
comentario por patrón explicando de qué proyecto real salió.

## Uso

```bash
# Un proyecto entero (detecta el .tex principal como hace Overleaf: el de la
# raíz que contiene \documentclass) o un fichero suelto.
cargo run -- ../ruta/al/proyecto-latex

# Escribe `_spike_salida.typ` junto al proyecto. Después, compilar con el
# MISMO compilador que usa la app (esa es la medida que importa):
../../src-tauri/binaries/typst-x86_64-pc-windows-msvc.exe \
    compile --root . _spike_salida.typ salida.pdf
```

Dos scripts auxiliares para el **contraste estructural**, que es lo único que detectó
la pérdida silenciosa de figuras del proyecto 3:

```bash
node medir.mjs   proyecto/main.tex proyecto/_spike_salida.typ  # restos por comando
node figuras.mjs proyecto/main.tex proyecto/_spike_salida.typ  # rastro de cada figura
```

## Qué mide

- **Inventario**: `.tex`, `.bib`, figuras por formato, fuentes propias.
- **Identidad**: `\documentclass` y lista de `\usepackage` (base del mapeo a plantilla).
- **Multi-fichero**: si Tylax resuelve `\input`/`\include` (los tres proyectos medidos
  eran de un solo fichero, así que sigue sin ejercitarse).
- **Diagnósticos del motor**: cuántos traen línea y sugerencia. Conclusión del spike:
  **no sirven como informe para el usuario** — 34 "errores" en un LaTeX válido.
- **Reparaciones aplicadas**: el catálogo, con su recuento.
- **Restos**: secuencias `\comando` que sobreviven en la salida.

## Catálogo de reparaciones (a fecha del spike)

| # | Patrón | Por qué | Origen |
| --- | --- | --- | --- |
| 1 | `\section*{X}` → `\section{X}` antes de convertir | Tylax emite `== *` y baja el título a la línea siguiente: **deja de ser encabezado** (no sale en el esquema) y el `*` suelto **rompe la compilación** | Proyecto 1 |
| 2 | Emitir `#bibliography("x.bib")` | Tylax vuelca `\bibliography` como comentario y corrompe el nombre del estilo | Proyectos 1-3 |
| 3 | Escapar `@` en correos | En Typst `@algo` es una cita → `label does not exist`. Incluye el idioma `{a,b}@dominio` | Proyectos 1-3 |

**Sin resolver** (ver el informe): `\subfloat` descarta las imágenes de la figura entera
(reportado aguas arriba), rutas de imagen sin extensión, y la identidad del documento
(título/autores), que necesita el mapeo clase→plantilla, no una reparación de texto.

## Nota sobre los proyectos de prueba

Los tres proyectos medidos son artículos reales del autor, **dos de ellos sin publicar**.
No están en el repositorio y no deben añadirse. El informe recoge solo cifras y
estructura, nunca contenido.
