# DBV Typst Editor

**🇪🇸 Español · [🇬🇧 English](./README.en.md)**

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Rust](https://img.shields.io/badge/Rust-1.76+-000000?logo=rust&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&logoColor=white)
![Typst](https://img.shields.io/badge/Typst-powered-239DAD?logo=typst&logoColor=white)
![Status](https://img.shields.io/badge/status-en%20desarrollo-yellow)
[![Framework](https://img.shields.io/badge/framework-dbv--specs--ops-111827?logo=github&logoColor=white)](https://github.com/davidbuenov/dbv-specs-ops)

> Editor de escritorio multiplataforma, ligero y offline-first para documentos [Typst](https://typst.app), con vista previa PDF en tiempo real. *"Academic and technical writing made simple. Powered by Typst."*

---

## 📑 Índice

- [Sobre el proyecto](#-sobre-el-proyecto)
- [Estado actual](#-estado-actual)
- [Descárgalo e instálalo](#-descárgalo-e-instálalo)
- [Público objetivo](#-público-objetivo)
- [Funcionalidades del MVP](#-funcionalidades-del-mvp)
- [Requisitos](#-requisitos)
- [Instalación (desarrollo)](#-instalación-desarrollo)
- [Cómo ejecutar](#-cómo-ejecutar)
- [Cómo parar](#-cómo-parar)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Probar la aplicación](#-probar-la-aplicación)
- [Empaquetado y publicación](#-empaquetado-y-publicación)
- [Changelog](#-changelog)
- [Licencia](#-licencia)
- [Autor y Créditos](#-autor-y-créditos)

---

## 📌 Sobre el proyecto

**DBV Typst Editor** es un editor nativo de escritorio para documentos [Typst](https://typst.app), pensado para profesores, investigadores, doctorandos, estudiantes universitarios y escritores técnicos que necesitan generar PDFs académicos y técnicos de calidad profesional sin depender de LaTeX ni de herramientas online.

Sigue la misma filosofía que su proyecto hermano [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader): ligero, rápido, multiplataforma, offline-first, con una interfaz limpia y una experiencia de escritura agradable. Reutiliza en la medida de lo posible la arquitectura, componentes y decisiones de diseño ya validadas en ese proyecto.

**Built with:** Rust, Tauri v2, Typst CLI/crate, HTML5, Tailwind CSS, JavaScript.

---

## 🚦 Estado actual

`v0.3.0` — MVP completo más buena parte de Beta: además del bucle completo (crear proyecto → escribir con resaltado Typst → ver el PDF actualizarse solo → guardar → exportar), incluye Typst Universe (plantillas y paquetes de la comunidad, con detección de fuentes que faltan y arrastrar-y-soltar para añadirlas), Project Archive `.dbvt`, barra de herramientas de inserción del editor (con búsqueda y reemplazo), outline, terminal avanzado, modos de escritura, gestión de imágenes/citas/bibliografía por asistente, actualizador automático e instancia única. Tres temas — claro, oscuro y sepia — con selector segmentado. Validado a mano en la aplicación real (3 bugs de raíz encontrados y corregidos en esta versión) y con 223 tests automáticos en verde (99 de frontend + 124 de backend). Dos tags de versión creados (`v0.2.0`, `v0.3.0`); todavía no hay Release publicada en GitHub — el primer push con tag falló en los tres workflows de CI/Release por un bug de un test preexistente (ya corregido).

La documentación de especificación y arquitectura vive en [`dbv-specs-ops/`](./dbv-specs-ops/) y se actualiza en cada fase del ciclo Spec-Driven Development.

---

## 🚀 Descárgalo e instálalo

**No necesitas instalar Rust, Node.js, ni ninguna herramienta de programación.** El instalador trae todo lo necesario —incluido el compilador Typst— y asocia los archivos `.typ` contigo.

### 🪟 Windows

#### 🏬 Microsoft Store *(en proceso de publicación)*

Identidad ya reservada en Partner Center; en cuanto la ficha esté aprobada, el enlace directo se añadirá aquí. Mientras tanto, usa el instalador `.exe` de abajo — funciona exactamente igual.

#### 1️⃣ Descarga

**[⬇️ Ver todas las versiones (Releases)](https://github.com/davidbuenov/dbv-typst-editor/releases)**

Descarga el instalador de la última versión: `DBV Typst Editor_x.y.z_x64-setup.exe`.

El navegador puede avisar de que el archivo "no se descarga habitualmente" (SmartScreen). Es normal en instaladores nuevos sin firma comercial: en Edge, abre el panel de descargas y pulsa **Mostrar más → Mantener**.

#### 2️⃣ Instala

Doble clic sobre el instalador. No requiere permisos de administrador ni conexión a internet durante la instalación — el compilador Typst ya viaja incluido. Windows puede mostrar un aviso de "Editor no reconocido" — pulsa **Más información → Ejecutar de todas formas**.

#### 3️⃣ Actualiza

Abre el panel **Acerca de** (icono ⓘ) y pulsa **Buscar actualizaciones** — la comprobación es siempre bajo demanda, nunca se ejecuta sola al arrancar. Este mecanismo solo aplica a la instalación por `.exe`; una instalación desde Microsoft Store se actualiza sola vía Windows Update.

### 🐧 Linux

**[⬇️ Descarga el `.deb` o el `.AppImage` desde Releases](https://github.com/davidbuenov/dbv-typst-editor/releases)** — se generan automáticamente en cada versión vía CI.

- **`.deb` (Debian, Ubuntu, Linux Mint y derivadas):** `sudo dpkg -i "DBV Typst Editor_x.y.z_amd64.deb"` (o doble clic desde el gestor de archivos).
- **`.AppImage` (cualquier distribución):** `chmod +x "DBV Typst Editor_x.y.z_amd64.AppImage"` y ejecútalo directamente. Portátil, sin instalación.

> El canal de Linux no tiene comprobación de actualizaciones integrada — descarga la versión nueva desde Releases cuando quieras actualizar.

### 🍎 macOS

**[⬇️ Descarga el `.dmg` desde Releases](https://github.com/davidbuenov/dbv-typst-editor/releases)** — build universal (Apple Silicon + Intel), generado automáticamente vía CI.

No está firmado ni notarizado (requeriría una cuenta Apple Developer de pago). macOS lo bloqueará la primera vez:

- Clic derecho sobre `DBV Typst Editor.app` → **Abrir** → confirmar en el diálogo.
- O desde la Terminal: `xattr -cr "DBV Typst Editor.app"` antes de abrirlo.

---

## 🎯 Público objetivo

- Profesores y docentes universitarios
- Investigadores y doctorandos
- Estudiantes universitarios (TFG, TFM, tesis)
- Escritores técnicos
- Cualquier persona que quiera generar PDFs profesionales con Typst sin fricción

---

## ✅ Funcionalidades del MVP

- **Lanzador orientado a tareas:** la aplicación no abre un editor vacío, pregunta qué quieres escribir.
- **Asistente de creación de proyecto:** eliges plantilla, rellenas cuatro datos y el proyecto queda listo para compilar.
- **Plantillas curadas:** Proyecto en blanco, Trabajo de Fin de Grado, Artículo académico y Currículum vitae. Cada proyecto generado es Typst estándar y compila con `typst` a secas, sin depender de esta aplicación.
- **Modelo de proyecto, no de fichero suelto:** explorador lateral, proyectos recientes y "mostrar en el explorador del sistema". Abrir un repositorio Git clonado o un proyecto Typst hecho a mano funciona igual de bien, y la aplicación no escribe nada en su carpeta.
- **Editor Typst real:** CodeMirror 6 con resaltado de la sintaxis de Typst 0.15, autocompletado de las funciones y símbolos integrados, plegado, numeración de líneas, búsqueda y reemplazo y selección múltiple.
- **Vista previa en tiempo real:** el PDF se recompila solo tras cada pausa de escritura, con zoom y carga de páginas bajo demanda. Un error de sintaxis a medio escribir no borra la vista: mantiene la última correcta y muestra el error en una banda.
- **Guardar, guardar como y detección de cambios externos**, con recarga automática cuando no hay nada que perder y aviso solo cuando lo hay.
- **Exportación a PDF** del documento tal como se ve, incluidos los cambios sin guardar.
- **Temas claro, oscuro y sepia**, interfaz en español e inglés y compilador Typst embebido: todo funciona sin conexión.
- **Empaquetado** para Windows (NSIS) y Linux (AppImage + `.deb`), con asociación de fichero `.typ`. macOS tiene menú nativo escrito, pendiente de su primera compilación real.
- **Typst Universe:** plantillas y paquetes de la comunidad, lista curada + identificador libre, con detección de fuentes que faltan en los avisos del compilador y la posibilidad de arrastrarlas al proyecto para añadirlas.
- **Project Archive `.dbvt`, barra de herramientas de inserción, outline, terminal avanzado, modos de escritura, gestión de imágenes/citas/bibliografía por asistente, instancia única y actualizador automático** — el detalle completo de cada uno vive en `CHANGELOG.md`.

El detalle completo de requisitos y criterios de aceptación vive en [`dbv-specs-ops/docs/SPECIFICATIONS.md`](./dbv-specs-ops/docs/SPECIFICATIONS.md).

---

## 🧰 Requisitos

- [Rust](https://www.rust-lang.org/) 1.76+ y toolchain de [Tauri v2](https://v2.tauri.app/start/prerequisites/)
- Node.js 20+ (si el frontend usa un bundler)
- [Typst](https://github.com/typst/typst) CLI oficial, vendorizado como sidecar (ver `npm run vendor:typst` más abajo) — no hace falta instalarlo aparte

---

## ⚙️ Instalación (desarrollo)

```bash
# Clona el repositorio
git clone https://github.com/davidbuenov/dbv-typst-editor.git
cd dbv-typst-editor

# Instala dependencias del frontend
npm install

# Descarga el compilador Typst oficial que viaja dentro de la app (sidecar).
# Paso OBLIGATORIO: sin él la aplicación no puede compilar documentos.
npm run vendor:typst

# (opcional) Verifica el sidecar contra el binario real: 8 comprobaciones
npm run verify:typst

# (opcional) Verifica el catálogo de plantillas: instancia cada plantilla con el
# compilador real, sustituye datos de ejemplo y comprueba que compila a PDF
npm run verify:templates

# Tests: lógica del frontend (Vitest, 98) + backend Rust (122)
npm test
```

El binario de Typst **no se versiona en el repositorio**: se descarga de la release oficial fijada en `scripts/vendor-typst.mjs`. El mismo paso se ejecuta en CI antes de empaquetar.

Requisitos adicionales: los [prerrequisitos de Tauri v2](https://v2.tauri.app/start/prerequisites/) de tu sistema operativo.

---

## ▶️ Cómo ejecutar

**Windows:**
```cmd
start.cmd
```

**macOS / Linux:**
```bash
./start.sh
```

---

## ⏹ Cómo parar

**Windows:**
```cmd
stop.cmd
```

**macOS / Linux:**
```bash
./stop.sh
```

---

## 📂 Estructura del proyecto

```
/
├── src/                        # Frontend (ESM, sin monolito)
│   ├── app/                     # Estado del espacio de trabajo
│   ├── editor/                   # Editor CodeMirror 6 + lenguaje Typst
│   ├── preview/                   # Vista previa SVG en tiempo real
│   ├── launcher/                   # Lanzador orientado a tareas
│   ├── project-wizard/              # Asistente de creación de proyecto
│   ├── project-explorer/             # Árbol de ficheros del proyecto
│   ├── services/                      # Única frontera con el backend
│   ├── panels/ · ui/ · themes/ · i18n/ # Paneles, controles, temas y traducciones
├── src-tauri/                  # Backend Rust
│   └── src/                     # commands/, project.rs, templates.rs,
│                                 # typst_engine/, watcher.rs, error.rs
├── templates/local/            # Plantillas curadas, como paquetes `@local`
├── testfiles/                  # Documento y proyecto de prueba para abrir en la app
├── scripts/                    # Vendorizado y verificaciones sin dependencias
├── dbv-specs-ops/              # Documentación SDD (specs, arquitectura, memoria)
├── start.cmd / start.sh        # Scripts de arranque
├── stop.cmd / stop.sh          # Scripts de parada
└── README.md                   # Este fichero
```

---

## 🧪 Probar la aplicación

Si acabas de arrancarla y quieres algo que abrir, hay dos ficheros de prueba en [`testfiles/`](./testfiles/):

| Qué | Cómo abrirlo | Qué comprueba |
| --- | --- | --- |
| `testfiles/demo-suelto.typ` | **Abrir documento .typ** | Un `.typ` suelto como proyecto de un solo fichero: edición, vista previa en vivo, banda de error y exportación |
| `testfiles/demo-proyecto/` | **Abrir carpeta de proyecto** | Proyecto multi-fichero real: explorador, capítulos con `#include`, imagen desde `images/`, bibliografía y referencias cruzadas |

`demo-proyecto` **no trae manifiesto DBV a propósito**: se comporta como un repositorio clonado o un proyecto Typst hecho a mano, así que la cabecera debe etiquetarlo como *proyecto externo* y la aplicación no debe escribir nada en su carpeta (RF-02b).

Cada fichero lleva dentro una lista de lo que conviene probar con él. La otra vía, si prefieres empezar de cero, es el propio lanzador: **Proyecto en blanco** → elegir carpeta → *Crear proyecto*.

---

## 📦 Empaquetado y publicación

```bash
# Instalador de la plataforma actual (Windows: NSIS de ~18 MB)
npm run build

# Solo Windows: variante con el instalador de WebView2 embebido (~268 MB), para
# equipos sin WebView2 y sin conexión — aulas aisladas, por ejemplo
npm run build:win:offline

# Solo Windows, con TAURI_SIGNING_PRIVATE_KEY/_PASSWORD puestas: genera el
# manifiesto de actualización a partir del .exe firmado que acaba de compilar
npm run updater:manifest

# Solo Windows, sobre el .exe ya compilado: genera el .msix para Microsoft Store
npm run tauri:windows:build
```

| Plataforma | Quién compila | Release |
| --- | --- | --- |
| **Windows** | El mantenedor, en local (`npm run build`, requiere la clave de firma del actualizador) | Sube el `.exe` + `.sig` + `latest.json` al borrador de Release a mano; el `.msix` se sube aparte a Partner Center |
| **Linux** | GitHub Actions (`release-linux.yml`) al empujar un tag `vX.Y.Z` | Adjunta AppImage y `.deb` al borrador automáticamente |
| **macOS** | GitHub Actions (`release-macos.yml`), build universal | Adjunta `.dmg` al borrador automáticamente |

El workflow vendoriza el compilador Typst antes de empaquetar y **falla de forma explícita si falta**: un instalador sin compilador dentro no serviría de nada. Cada push ejecuta además el workflow `ci.yml` con los tests, el build del frontend y las dos verificaciones contra el compilador real.

Preparación para Microsoft Store documentada en [`dbv-specs-ops/docs/MICROSOFT_STORE.md`](./dbv-specs-ops/docs/MICROSOFT_STORE.md).

---

## 📋 Changelog

`v0.3.0` documentada en [`dbv-specs-ops/CHANGELOG.md`](./dbv-specs-ops/CHANGELOG.md). Sigue sin haber una Release publicada en GitHub.

---

## 📄 Licencia

MIT — ver [LICENSE](./LICENSE) para más detalles.

Copyright (c) 2026 David Bueno Vallejo

---

## 👤 Autor y Créditos

Creado por **[David Bueno Vallejo](https://github.com/davidbuenov)**.

> 🛠️ Built with **[dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)** — the SDD framework for AI-assisted development.
