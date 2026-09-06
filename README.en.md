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
- [Download and install](#-download-and-install)
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

`v0.3.0` — MVP complete plus a good part of Beta: besides the full loop (create a project → write with Typst syntax highlighting → watch the PDF update on its own → save → export), it includes Typst Universe (community templates and packages, with missing-font detection and drag-and-drop to add them), Project Archive `.dbvt`, the editor's insertion toolbar (with find and replace), outline, advanced terminal, writing modes, image/citation/bibliography assistants, an automatic updater and single-instance behavior. Three themes — light, dark and sepia — with a segmented selector. Manually validated in the real app (3 root-cause bugs found and fixed in this version), with 223 automated tests passing (99 frontend + 124 backend). Two version tags created (`v0.2.0`, `v0.3.0`); no GitHub Release published yet — the first tagged push failed all three CI/Release workflows due to a pre-existing test bug (now fixed). Specification and architecture documentation lives in [`dbv-specs-ops/`](./dbv-specs-ops/) and is updated at every phase of the Spec-Driven Development cycle.

> This English README lags behind the Spanish one in some sections below (a known, pre-existing gap) — [`README.md`](./README.md) is the more current reference until it's caught up.

---

## 🚀 Download and install

**No need to install Rust, Node.js, or any programming tool.** The installer bundles everything required — including the Typst compiler — and associates `.typ` files for you.

### 🪟 Windows

**[⬇️ See all versions (Releases)](https://github.com/davidbuenov/dbv-typst-editor/releases)** — download `DBV Typst Editor_x.y.z_x64-setup.exe`. *(Microsoft Store listing in progress — identity already reserved in Partner Center.)*

Your browser may warn that the file "isn't commonly downloaded" (SmartScreen) — this is normal for new installers without a commercial signature. Double-click to install (no admin rights or internet connection required), then check for updates any time from the "About" panel (ⓘ icon) — never automatic on launch.

### 🐧 Linux

**[⬇️ Download the `.deb` or `.AppImage` from Releases](https://github.com/davidbuenov/dbv-typst-editor/releases)** — built automatically on every version via CI.

### 🍎 macOS

**[⬇️ Download the `.dmg` from Releases](https://github.com/davidbuenov/dbv-typst-editor/releases)** — universal build (Apple Silicon + Intel), built automatically via CI. Unsigned and unnotarized: right-click the app → **Open** to bypass Gatekeeper the first time, or run `xattr -cr "DBV Typst Editor.app"` from Terminal.

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
- Light, dark and sepia themes
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

# Download the official Typst compiler that ships inside the app (sidecar).
# REQUIRED step: without it the application cannot compile documents.
npm run vendor:typst

# (optional) Verify the sidecar against the real binary: 8 checks
npm run verify:typst
```

The Typst binary is **not committed to the repository**: it is downloaded from the official release pinned in `scripts/vendor-typst.mjs`. The same step runs in CI before packaging.

Additional requirements: the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system.

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

`v0.3.0` documented in [`dbv-specs-ops/CHANGELOG.md`](./dbv-specs-ops/CHANGELOG.md). No GitHub Release published yet.

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

Copyright (c) 2026 David Bueno Vallejo

---

## 👤 Author & Credits

Created by **[David Bueno Vallejo](https://github.com/davidbuenov)**.

> 🛠️ Built with **[dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)** — the SDD framework for AI-assisted development.
