# DBV Typst Editor

**[🇪🇸 Español](./README.md) · 🇬🇧 English**

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Rust](https://img.shields.io/badge/Rust-1.76+-000000?logo=rust&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&logoColor=white)
![Typst](https://img.shields.io/badge/Typst-powered-239DAD?logo=typst&logoColor=white)
![Status](https://img.shields.io/badge/status-in%20development-yellow)
[![Framework](https://img.shields.io/badge/framework-dbv--specs--ops-111827?logo=github&logoColor=white)](https://github.com/davidbuenov/dbv-specs-ops)

> A lightweight, offline-first, cross-platform desktop editor for [Typst](https://typst.app) documents, with real-time PDF preview. *"Academic and technical writing made simple. Powered by Typst."*

---

## 📑 Table of Contents

- [About](#-about)
- [Current status](#-current-status)
- [Target audience](#-target-audience)
- [Planned features (MVP)](#-planned-features-mvp)
- [Requirements](#-requirements)
- [Installation (development)](#-installation-development)
- [How to run](#-how-to-run)
- [How to stop](#-how-to-stop)
- [Project structure](#-project-structure)
- [Changelog](#-changelog)
- [License](#-license)
- [Author & Credits](#-author--credits)

---

## 📌 About

**DBV Typst Editor** is a native desktop editor for [Typst](https://typst.app) documents, built for teachers, researchers, PhD candidates, university students, and technical writers who need to produce professional-quality academic and technical PDFs without relying on LaTeX or online-only tools.

It follows the same philosophy as its sibling project [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader): lightweight, fast, cross-platform, offline-first, with a clean interface and a pleasant writing experience. It reuses, wherever possible, the architecture, components, and design decisions already validated in that project.

**Built with:** Rust, Tauri v2, Typst CLI/crate, HTML5, Tailwind CSS, JavaScript.

---

## 🚦 Current status

Project in bootstrap phase (`v0.1.0` in development). No binaries or releases have been published yet. Specification and architecture documentation lives in [`dbv-specs-ops/`](./dbv-specs-ops/) and is updated at every phase of the Spec-Driven Development cycle.

---

## 🎯 Target audience

- University professors and teachers
- Researchers and PhD candidates
- University students (undergraduate/master's theses)
- Technical writers
- Anyone who wants to produce professional PDFs with Typst without friction

---

## ✅ Planned features (MVP)

- Open, create, save, and save as `.typ` files
- Real-time PDF preview with automatic recompilation
- Basic project management
- Editor with Typst syntax highlighting, autocompletion, line numbers, code folding, and find/replace
- Light and dark themes
- Persistent settings
- Templates: academic article, undergraduate/master's thesis, doctoral thesis, technical report, CV, presentation
- Packaging for Windows and Linux (macOS in later phases)

Full requirements and acceptance criteria live in [`dbv-specs-ops/docs/SPECIFICATIONS.md`](./dbv-specs-ops/docs/SPECIFICATIONS.md).

---

## 🧰 Requirements

- [Rust](https://www.rust-lang.org/) 1.76+ and the [Tauri v2](https://v2.tauri.app/start/prerequisites/) toolchain
- Node.js 20+ (if the frontend uses a bundler)
- [Typst](https://github.com/typst/typst) (CLI or embedded crate — decision pending in `ARCHITECTURE.md`)

---

## ⚙️ Installation (development)

```bash
# Clone the repository
git clone https://github.com/davidbuenov/dbv-typst-editor.git
cd dbv-typst-editor

# Install frontend dependencies
npm install

# Install Tauri prerequisites (see official docs for your OS)
```

> Full build and packaging instructions will be added during `/build`.

---

## ▶️ How to run

**Windows:**
```cmd
start.cmd
```

**macOS / Linux:**
```bash
./start.sh
```

---

## ⏹ How to stop

**Windows:**
```cmd
stop.cmd
```

**macOS / Linux:**
```bash
./stop.sh
```

---

## 📂 Project structure

```
/
├── src/                # Frontend (editor + preview)
├── src-tauri/           # Rust backend + Tauri/Typst integration
├── dbv-specs-ops/       # SDD documentation (specs, architecture, memory, tasks)
├── templates/           # Typst templates (article, thesis, CV...)
├── start.cmd / start.sh # Startup scripts
├── stop.cmd / stop.sh   # Stop scripts
└── README.md            # This file
```

---

## 📋 Changelog

No release has been published yet. Change history will be documented in `CHANGELOG.md` starting with the first `/ship`.

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

Copyright (c) 2026 David Bueno Vallejo

---

## 👤 Author & Credits

Created by **[David Bueno Vallejo](https://github.com/davidbuenov)**.

> 🛠️ Built with **[dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)** — the SDD framework for AI-assisted development.
