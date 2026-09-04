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
- [Público objetivo](#-público-objetivo)
- [Funcionalidades previstas (MVP)](#-funcionalidades-previstas-mvp)
- [Requisitos](#-requisitos)
- [Instalación (desarrollo)](#-instalación-desarrollo)
- [Cómo ejecutar](#-cómo-ejecutar)
- [Cómo parar](#-cómo-parar)
- [Estructura del proyecto](#-estructura-del-proyecto)
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

Proyecto en fase de arranque (`v0.1.0` en desarrollo). Aún no hay binarios ni releases publicados. La documentación de especificación y arquitectura vive en [`dbv-specs-ops/`](./dbv-specs-ops/) y se actualiza en cada fase del ciclo Spec-Driven Development.

---

## 🎯 Público objetivo

- Profesores y docentes universitarios
- Investigadores y doctorandos
- Estudiantes universitarios (TFG, TFM, tesis)
- Escritores técnicos
- Cualquier persona que quiera generar PDFs profesionales con Typst sin fricción

---

## ✅ Funcionalidades previstas (MVP)

- Abrir, crear, guardar y guardar como archivos `.typ`
- Vista previa PDF en tiempo real con recompilación automática
- Gestión básica de proyectos
- Editor con resaltado de sintaxis Typst, autocompletado, numeración de líneas, plegado de bloques y búsqueda/reemplazo
- Temas claro y oscuro
- Configuración persistente
- Plantillas: artículo académico, TFG, TFM, tesis doctoral, informe técnico, CV, presentación
- Empaquetado para Windows y Linux (macOS en fases posteriores)

El detalle completo de requisitos y criterios de aceptación vive en [`dbv-specs-ops/docs/SPECIFICATIONS.md`](./dbv-specs-ops/docs/SPECIFICATIONS.md).

---

## 🧰 Requisitos

- [Rust](https://www.rust-lang.org/) 1.76+ y toolchain de [Tauri v2](https://v2.tauri.app/start/prerequisites/)
- Node.js 20+ (si el frontend usa un bundler)
- [Typst](https://github.com/typst/typst) (CLI o crate embebido — decisión pendiente en `ARCHITECTURE.md`)

---

## ⚙️ Instalación (desarrollo)

```bash
# Clona el repositorio
git clone https://github.com/davidbuenov/dbv-typst-editor.git
cd dbv-typst-editor

# Instala dependencias del frontend
npm install

# Instala prerrequisitos de Tauri (ver docs oficiales de tu SO)
```

> Instrucciones completas de compilación y empaquetado se añadirán durante `/build`.

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
├── src/                # Frontend (editor + previsualizador)
├── src-tauri/           # Backend Rust + integración Tauri/Typst
├── dbv-specs-ops/       # Documentación SDD (specs, arquitectura, memoria, tareas)
├── templates/           # Plantillas Typst (artículo, TFG, TFM, tesis, CV...)
├── start.cmd / start.sh # Scripts de arranque
├── stop.cmd / stop.sh   # Scripts de parada
└── README.md            # Este fichero
```

---

## 📋 Changelog

Aún no hay versión publicada. El historial de cambios se documentará en `CHANGELOG.md` a partir del primer `/ship`.

---

## 📄 Licencia

MIT — ver [LICENSE](./LICENSE) para más detalles.

Copyright (c) 2026 David Bueno Vallejo

---

## 👤 Autor y Créditos

Creado por **[David Bueno Vallejo](https://github.com/davidbuenov)**.

> 🛠️ Built with **[dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)** — the SDD framework for AI-assisted development.
