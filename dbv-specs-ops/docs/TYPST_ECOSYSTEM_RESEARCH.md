# 🔬 Technical Research Report — Typst Ecosystem

> **Encargo:** investigación dedicada del ecosistema Typst (CLI, sistema de paquetes, Typst Universe, registros oficiales) antes de pasar de Specs a Plan, solicitada explícitamente por el usuario el 2026-09-04.
> **Método:** documentación oficial de Typst (`typst.app/docs`), el repositorio oficial `typst/packages` (manifiesto, README, GitHub Actions de publicación), páginas de manual (`man`) generadas a partir del `--help` real del CLI, y el propio sitio `typst.app/universe`. Sin acceso a build/ejecución local del CLI en esta sesión — los detalles marcados **(a verificar en `/build`)** deben confirmarse contra una instalación real antes de comprometerse en código.
> **Consumidores de este informe:** `ARCHITECTURE.md` (decisiones §7.2, §7.6, §7.8, §7.14) y `SPECIFICATIONS.md` (RF de exploración de paquetes/plantillas y terminal avanzado).

---

## 1. Typst CLI

### 1.1. Instalación y distribución

| Método | Comando / origen |
| --- | --- |
| Binarios precompilados | [github.com/typst/typst/releases](https://github.com/typst/typst/releases) — archivos nombrados por *target triple* de Rust, p. ej. `typst-x86_64-pc-windows-msvc.zip`, `typst-aarch64-apple-darwin.tar.xz` (previsiblemente también `typst-x86_64-apple-darwin` y `typst-x86_64-unknown-linux-gnu`) |
| Homebrew (macOS) | `brew install typst` |
| winget (Windows) | `winget install --id Typst.Typst` |
| Cargo | `cargo install --locked typst-cli` (estable) / `cargo install --git https://github.com/typst/typst --locked typst-cli` (desarrollo) |
| Nix | `nix-shell -p typst` / flake oficial |
| Docker | `docker run ghcr.io/typst/typst:latest` |
| Linux adicional | Snap, paquetes de distro vía Repology |

**Hallazgo clave para la arquitectura:** el naming de los binarios de release (`typst-<target-triple>[.ext]`) **coincide con la convención de sidecar de Tauri** (`<nombre>-<target-triple>[.exe]` dentro de `src-tauri/binaries/`), lo que permite vendorizar el binario oficial casi sin fricción de empaquetado — ver `ARCHITECTURE.md` §7.2.

Fuentes: [github.com/typst/typst](https://github.com/typst/typst), [typst.app/open-source](https://typst.app/open-source/).

### 1.2. `typst init` — creación de proyecto desde plantilla

```text
typst init [OPTIONS] <TEMPLATE> [DIR]
```

- `<TEMPLATE>`: especificador de paquete `@preview/nombre[:versión]` (si se omite versión, usa la última) **o** una ruta local a un directorio de plantilla — *"supports both local and published templates"*.
- `[DIR]`: directorio destino, opcional; por defecto usa el nombre de la plantilla.
- Flags: `--package-path <DIR>` / `--package-cache-path <DIR>` (también vía `TYPST_PACKAGE_PATH` / `TYPST_PACKAGE_CACHE_PATH`).
- **Comportamiento interno confirmado:** copia literal del contenido de `template.path` (declarado en el `typst.toml` de la plantilla) al directorio destino. **No hay sustitución de variables/tokens integrada en el propio comando.** Esto confirma que el asistente de creación de proyecto de DBV (formulario título/autor/tutor...) debe implementarse como un **paso posterior** a `typst init`, no como parte de él — ver `ARCHITECTURE.md` §7.6.4.

Fuente: [manpages.opensuse.org — typst-init(1)](https://manpages.opensuse.org/Tumbleweed/typst/typst-init.1.en.html).

### 1.3. `typst compile` — compilación

```text
typst compile <input> [output]
```

- Formato por defecto: **PDF**. `--format {pdf,svg,png,html}` (HTML es experimental, requiere `--features html`).
- `--pages <rangos>` (p. ej. `2,3-6,8-`) para exportar solo ciertas páginas.
- **Multi-página en SVG/PNG:** requiere que el nombre de salida sea una plantilla con marcador de página (`{0p}` con padding de ceros, o `{p}`), porque se genera **un fichero por página** — no se puede volcar más de un SVG por invocación a un único stdout.
- **Piping stdin/stdout con `-`:** `typst compile input.typ -` escribe el **PDF en bytes directamente a stdout** (sin fichero temporal) para el caso de documento completo; `typst compile - output.pdf` lee la fuente desde stdin. **Relevante para la arquitectura:** el export final a PDF (RF-10) puede evitar el sistema de ficheros por completo leyendo stdout del proceso hijo; el preview SVG por página (§7.3), al requerir múltiples ficheros de salida, sí necesita un directorio temporal de trabajo.
- `--font-path` / `TYPST_FONT_PATHS` para añadir directorios de fuentes adicionales — relevante si DBV decide empaquetar una fuente académica por defecto.

Fuentes: [typst.app/docs/reference/svg](https://typst.app/docs/reference/svg/), [typst.app/docs/reference/pdf](https://typst.app/docs/reference/pdf/), [manpages.opensuse.org — typst-compile(1)](https://man.archlinux.org/man/extra/typst/typst-compile.1.en), [Typst Forum — stdout piping](https://forum.typst.app/t/typst-compile-in-typ-writes-to-the-file-instead-of-stdout/739).

### 1.4. `typst watch` — recompilación continua

```text
typst watch <input> [output]
```

Mismas opciones de salida que `compile`, pero mantiene un proceso de larga duración que recompila automáticamente al detectar cambios, aprovechando compilación incremental (más rápido que relanzar `compile` desde cero en cada cambio). **Limitación conocida:** combinar `watch` con entrada por stdin (`-`) no funciona de forma fiable (issue abierta en el repo oficial) — la fuente debe ser un fichero real en disco.

**Decisión de diseño relevante:** para el bucle de preview en tiempo real (§7.3), DBV Typst Editor puede elegir entre (a) lanzar `typst watch` una vez por documento activo y leer los ficheros de salida cuando cambian (reutilizando nuestro propio watcher `notify` ya heredado de DBV Markdown Reader para detectar *esos* cambios), o (b) invocar `typst compile` de tipo *one-shot* en cada ciclo de debounce ya validado en la arquitectura heredada (§1.4). La opción (b) da control total y máxima coherencia con el patrón watch→debounce→recompilar ya probado; la opción (a) delega la detección de "qué recompilar" al propio Typst pero añade la complejidad de gestionar un proceso hijo de larga duración (arranque/parada/crash-recovery) coexistiendo con nuestro propio watcher de fichero. **Recomendación: empezar con (b)** en el MVP por simplicidad y consistencia arquitectónica; reevaluar (a) en Beta si el rendimiento de recompilación en documentos muy largos lo justifica (la incrementalidad de `watch` podría notarse en tesis de cientos de páginas).

Fuente: [manpages.opensuse.org — typst-watch(1)](https://man.archlinux.org/man/typst-watch.1.en).

### 1.5. `typst query` — introspección del documento

```text
typst query [OPTIONS] <input> <selector>
```

Compila el documento y evalúa un *selector* (una etiqueta como `<nota>`, o un selector de elemento como `heading`) contra el árbol resultante, imprimiendo los elementos encontrados como JSON (o YAML) a stdout.

- `--field <nombre>`: extrae un campo concreto de cada elemento encontrado.
- `--one`: exige y espera exactamente un resultado.
- `--format {json,yaml}`, `--pretty`.
- Ejemplo oficial: `typst query --field value --one example.typ "<note>"`.

**Aplicación directa:** es el mecanismo propuesto para el panel de navegación estructural (§7.8) — `typst query documento.typ heading` debería devolver los encabezados del documento compilado. **(a verificar en `/build`):** confirmar si el JSON de un selector `heading` incluye información de posición/página utilizable para navegación clic→ubicación (Typst expone `location()` como introspección del lenguaje; falta confirmar si `query` la serializa de forma directamente consumible sin escribir código Typst auxiliar en la propia plantilla).

Fuentes: [typst.app/docs/reference/introspection/query](https://typst.app/docs/reference/introspection/query/), [manpages.opensuse.org — typst-query(1)](https://manpages.opensuse.org/Tumbleweed/typst/typst-query.1.en.html).

### 1.6. `typst update` — autoactualización del propio binario

Añadido en Typst CLI 0.8.0. Actualiza el binario instalado a la última versión (o a una versión concreta), con `--force` (permite downgrade) y `--revert`/`--backup-path` (rollback). Requiere que el binario se haya compilado con la característica de auto-actualización activada.

**Irrelevante para DBV Typst Editor tal como está planteada la integración (§7.2):** si vendorizamos una copia propia y fijada del binario `typst` como sidecar de la app (no un `typst` del sistema en el `PATH` del usuario), la actualización de versión del compilador pasa a gestionarse a través del propio canal de actualización de DBV Typst Editor (mismo mecanismo que el auto-actualizador ya heredado de DBV Markdown Reader), **no** invocando `typst update` sobre el sidecar.

Fuentes: [Typst Changelog 0.8.0](https://typst.app/docs/changelog/0.8.0/), [man.archlinux.org — typst-update(1)](https://man.archlinux.org/man/extra/typst/typst-update.1.en).

### 1.7. `typst fonts`

Lista las fuentes detectadas (sistema + `--font-path`/`TYPST_FONT_PATHS`). No crítico para el MVP; útil para un futuro panel de diagnóstico de fuentes.

---

## 2. Sistema de paquetes de Typst

### 2.1. Manifiesto `typst.toml`

Campos de `[package]`: `name`, `version` (SemVer estricto), `entrypoint`, `authors`, `license` (SPDX-2), `description`, `homepage`, `repository`, `keywords`, `categories` (máx. 3, de una lista cerrada oficial), `disciplines`, `compiler` (versión mínima requerida), `exclude` (patrones glob excluidos del bundle publicado). Sección opcional `[template]`: `path`, `entrypoint`, `thumbnail` (PNG/WebP, mín. 1080px en el lado largo, máx. 3 MiB) — su sola presencia marca el paquete como instalable vía `typst init`.

Fuente: [github.com/typst/packages — docs/manifest.md](https://github.com/typst/packages/blob/main/docs/manifest.md).

### 2.2. Resolución de `#import "@preview/nombre:versión"`

Cascada de resolución en cada compilación (confirmada contra documentación oficial y de terceros):

1. `{package-path}/{namespace}/{name}/{version}` — instalación local manual del usuario.
2. `{package-cache-path}/{namespace}/{name}/{version}` — ya descargado y cacheado.
3. Solo para el namespace `@preview`: descarga desde `https://packages.typst.org` y cacheado automático.

**Rutas de caché por sistema operativo** (todas overrideables vía `TYPST_PACKAGE_CACHE_PATH`):

| SO | Directorio de caché | Directorio de datos (paquetes locales) |
| --- | --- | --- |
| Windows | `%LOCALAPPDATA%\typst\packages\{namespace}\{name}-{version}` | `%APPDATA%\typst\packages\...` |
| Linux | `$XDG_CACHE_HOME` (o `~/.cache`) `/typst/packages/...` | `$XDG_DATA_HOME` (o `~/.local/share`) `/typst/packages/...` |
| macOS | `~/Library/Caches/typst/packages/...` | `~/Library/Application Support/typst/packages/...` |

`typst info` imprime las rutas resueltas reales en el sistema actual — útil para un futuro panel de diagnóstico. Fuente: [typst-community/extra-docs — Packages](https://typst-community.github.io/extra-docs/packages/index.html), [github.com/typst/packages — README](https://github.com/typst/packages/blob/main/README.md).

### 2.3. Publicación y actualización de índice (lado servidor, informativo)

El repositorio `typst/packages` aloja cada versión publicada en `packages/preview/{name}/{version}/`. Una GitHub Action, en cada push, empaqueta cada paquete como `.tar.gz` y regenera un `index.json` único con los metadatos de **todos** los paquetes, publicándolo en `https://packages.typst.org/preview/` (servido vía CDN). Es decir: **el repositorio Git es la fuente canónica editable, `index.json` es su proyección de solo lectura para consumo automatizado** — la fuente que debe usar DBV Typst Editor es esta segunda (no clonar/parsear el repo Git completo).

### 2.4. Flujo de "actualización" de un paquete ya usado en un proyecto (hallazgo importante)

**No existe un subcomando de CLI tipo "actualizar paquete" análogo a `npm update`.** Actualizar la versión de un paquete usado en un proyecto significa, literalmente, editar el string de versión dentro del propio `#import "@preview/nombre:X.Y.Z"` del código fuente; la siguiente compilación descargará (si no está ya cacheada) la nueva versión. Las versiones antiguas cacheadas no se purgan automáticamente.

**Consecuencia de diseño para el Package Explorer (§7.6.2, "Actualizaciones"):** el botón "Actualizar" de DBV Typst Editor **no puede delegar en un comando del CLI** — debe ser una operación propia: detectar la versión usada (§2.5 más abajo), compararla contra la última versión del `index.json` cacheado, y si procede, reescribir el string de versión directamente en el editor (transacción de CodeMirror 6, mismo mecanismo que los asistentes de inserción, §7.7) seguido de una recompilación normal para que se descargue la nueva versión.

### 2.5. Detección de imports en el proyecto ("Paquetes usados")

Dado que la integración del compilador se resuelve ahora vía **CLI en sidecar** (decisión revisada, ver `ARCHITECTURE.md` §7.2), y no vía crates Rust embebidas, **se revisa la recomendación previa de usar el parser `typst::syntax::parse`** para detectar `#import "@preview/..."` en los ficheros del proyecto: acoplarse a esa crate como librería contradice la nueva decisión de mantener toda la interacción con Typst detrás de un único proceso CLI externo. **Decisión revisada:** implementar la detección como un escaneo de texto ligero (expresión regular sobre líneas no comentadas, buscando el patrón sintácticamente muy acotado `#import "@preview/...`), sin depender de la crate `typst` como librería. Es un patrón suficientemente estrecho (namespace fijo, comillas, `@`) para que la tasa de falsos positivos/negativos sea marginal en la práctica; si en Beta se detectan problemas reales de precisión, se puede reevaluar apoyarse en `typst query` (§1.5) para una detección basada en el propio compilador — **pendiente de spike:** confirmar si el modelo de selectores de `query` permite seleccionar nodos de sintaxis de importación (pensado principalmente para elementos de *contenido* como encabezados/figuras/etiquetas, no necesariamente para sentencias de importación crudas).

---

## 3. Typst Universe — Paquetes

- URL de navegación: `typst.app/universe/search/?kind=packages`.
- Filtros observados: ordenación (Recommended / Last updated / Last published), categorías (funcionales: Components, Visualization, Model, Layout, Text, Languages, Scripting, Integration, Utility, Fun), filtros de calidad (Only featured content / Only officially affiliated / Only recently updated / Only with repository link).
- **No se encontró documentación pública de una API de búsqueda dedicada.** Se observó una referencia a `api.typst.app/v1/` en la página — es la API privada del propio backend web de Typst Universe (probablemente respalda autenticación, "featured"/"officially affiliated" y búsqueda de texto completo en el sitio), sin contrato documentado para terceros.
- Los flags "featured"/"officially affiliated" que se ven en la UI de Universe **no aparecen confirmados como campos del `index.json` público** — son, con alta probabilidad, curación propia del backend privado de Universe. **Implicación:** la señal de "destacado/curado" que DBV Typst Editor use para su propia whitelist de seguridad (§6 de `ARCHITECTURE.md`) debe ser una **capa editorial propia de DBV**, no algo que se pueda leer directamente del índice público.

## 4. Typst Universe — Plantillas

- URL de navegación: `typst.app/universe/search/?kind=templates`.
- **Confirmado: no es un ecosistema de datos separado.** Una plantilla es, a nivel de dato, exactamente una entrada del mismo `index.json` de paquetes que además incluye el objeto `template` (§2.1). La UI de Universe simplemente filtra por la presencia de ese campo.
- Categorías específicas de tipo-documento observadas (superpuestas a las funcionales): Book, Report, Paper, Thesis, Poster, Flyer, Presentation, CV, Office. Ninguna corresponde 1:1 a "TFG"/"TFM" (terminología académica hispana/latinoamericana) — refuerza la necesidad de la taxonomía propia `dbv_category` ya prevista en el sidecar `dbv-template.toml` (`ARCHITECTURE.md` §7.6.3).
- Instalación/generación de proyecto: mecanismo único y oficial, `typst init @preview/{nombre}:{versión} [dir]` (§1.2) — sin variables de sustitución propias, solo copia.

## 5. Registros e índices oficiales — conclusión de integración

| Fuente | ¿Pública/documentada? | ¿Usar? |
| --- | --- | --- |
| `https://packages.typst.org/preview/index.json` | Sí — es la misma fuente que usa el propio compilador Typst (indirectamente) y el CLI | ✅ **Fuente primaria y única** para el catálogo de paquetes/plantillas |
| Repositorio `github.com/typst/packages` | Sí, público (Git) | Complementaria — útil para leer READMEs/manifiestos individuales o para contribuir/publicar plantillas propias de DBV a futuro, no como fuente de consulta masiva rutinaria (el índice ya cumple ese papel) |
| `api.typst.app/v1/...` (backend privado de Universe) | No documentada | ❌ **No usar** — sin contrato estable, riesgo de romperse sin aviso o de infringir condiciones de uso no explícitas para consumo por terceros |
| Miniaturas de plantilla (`template.thumbnail`) | Ruta relativa dentro del propio paquete, no URL directa confirmada | ⚠️ **Pendiente de spike en `/build`**: determinar si `packages.typst.org` sirve la miniatura por URL directa sin descargar el tarball completo; si no, cachear miniaturas propias generadas de forma diferida |

**Conclusión:** la estrategia "Universe First" pedida por el usuario es viable y de bajo mantenimiento apoyándose exclusivamente en `index.json` — no hace falta construir ni mantener un backend/registro propio para el catálogo. El valor añadido de DBV Typst Editor (según el propio encargo) es la **capa de experiencia**: exploración visual, gestión de dependencias, configuración de plantillas por asistente y flujos académicos — no la infraestructura de distribución, que Typst ya resuelve.

## 6. Oportunidades de integración — resumen accionable

| Componente | Mecanismo confirmado | Fase |
| --- | --- | --- |
| **Package Explorer** | Filtrar `index.json` cacheado por `template == null`; "Añadir al proyecto" inserta `#import` + dispara recompilación (que descarga/cachea igual que el CLI lo haría manualmente) | Beta |
| **Template Explorer** | Filtrar `index.json` cacheado por `template != null`; "Crear Proyecto" invoca `typst init` (oficial) contra `@preview/...` o una ruta local (plantillas propias de DBV) | MVP (plantillas propias) / Beta (comunidad) |
| **Project Creation Wizard** | Capa DBV sobre `typst init` — post-procesa con sustitución de tokens solo si existe `dbv-template.toml` | MVP |
| **Dependency Manager ("Paquetes usados")** | Escaneo de texto ligero (no crate embebida) de `#import "@preview/..."`; "Actualizar" = reescritura de texto propia (no hay comando CLI equivalente) | Beta |
| **Offline support** | Cache de paquetes 100% gestionado por el propio CLI (`--package-cache-path`); cache del `index.json` gestionado por DBV, con indicador de última actualización y aviso claro si no hay red para refrescar | MVP (compilación offline) / Beta (exploración offline del catálogo ya cacheado) |

---

**Instrucción para la IA:** Este informe es la fuente de verdad técnica para las decisiones de integración con el ecosistema Typst. `ARCHITECTURE.md` §7.2, §7.6 y §7.8 deben mantenerse coherentes con los hallazgos aquí documentados; cualquier hallazgo nuevo que los contradiga en `/build` debe actualizar primero este informe y después propagarse a `ARCHITECTURE.md`/`memory.md`.
