# DBV Typst Editor

**[🇪🇸 Español](./README.md) · 🇬🇧 English**

[![Website](https://img.shields.io/badge/Website-davidbuenov.github.io%2Fdbv--typst--editor-2563eb?style=flat&logo=googlechrome&logoColor=white)](https://davidbuenov.github.io/dbv-typst-editor/en/)
[![Releases](https://img.shields.io/badge/Releases-v0.5.0-brightgreen?logo=github)](https://github.com/davidbuenov/dbv-typst-editor/releases)
[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-9PCPSVTNJMP0-0078D6?logo=microsoft&logoColor=white)](https://apps.microsoft.com/store/detail/9PCPSVTNJMP0?cid=DevShareMCLPCB)
![Status](https://img.shields.io/badge/status-stable%20%7C%20v0.5.0-success)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Windows](https://img.shields.io/badge/Windows-10%20%2F%2011%20(.exe%20%2B%20Store)-0078D6?logo=windows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Universal%20(.dmg)-000000?logo=apple&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-AppImage%20%7C%20.deb-FCC624?logo=linux&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-1.76+-000000?logo=rust&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&logoColor=white)
![Typst](https://img.shields.io/badge/Typst-0.15+-239DAD?logo=typst&logoColor=white)
[![Framework](https://img.shields.io/badge/framework-dbv--specs--ops-111827?logo=github&logoColor=white)](https://github.com/davidbuenov/dbv-specs-ops)

> A lightweight, offline-first, cross-platform desktop editor for [Typst](https://typst.app) documents, with real-time PDF preview. *"Academic and technical writing made simple. Powered by Typst."*
>
> 🌐 **Official Website:** [https://davidbuenov.github.io/dbv-typst-editor/en/](https://davidbuenov.github.io/dbv-typst-editor/en/)

<p align="center">
  <a href="https://davidbuenov.github.io/dbv-typst-editor/en/">
    <img src="docs/images/featured-hero-text.jpg" alt="DBV Typst Editor — Official Banner" width="100%" style="border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" />
  </a>
</p>

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

**Current version:** `v0.5.0` · **Status:** 🟢 Stable and production ready

- 🌐 **Official Website:** [https://davidbuenov.github.io/dbv-typst-editor/en/](https://davidbuenov.github.io/dbv-typst-editor/en/) (featuring full-resolution interactive screenshot gallery and bilingual ES/EN switch).
- 📦 **Installers available on Releases:** [GitHub Releases v0.5.0](https://github.com/davidbuenov/dbv-typst-editor/releases):
  - 🪟 **Windows**: Standalone `.exe` installer (no external dependencies).
  - 🍎 **macOS**: Universal `.dmg` (compatible with Apple Silicon & Intel).
  - 🐧 **Linux**: `.AppImage` (portable) and `.deb` (Debian/Ubuntu/Mint) packages.
- 🏬 **Microsoft Store:** published on the official store. [🛒 Get it from Microsoft Store (ID 9PCPSVTNJMP0)](https://apps.microsoft.com/store/detail/9PCPSVTNJMP0?cid=DevShareMCLPCB). If you installed an earlier Store package, make sure you get `v0.3.1` or later (see [`CHANGELOG.en.md`](./dbv-specs-ops/CHANGELOG.en.md)).
- 🧪 **Quality & Stability:** 313 automated tests passing at 100% (152 frontend tests + 161 Rust backend tests) and layout verification in real rendering engines.
- 🚀 **Key Highlights:**
  - Bidirectional editor ↔ preview synchronization (double-click on preview jumps to source code and pin button takes preview to cursor).
  - Whole-document compilation (`main.typ`) preserving cross-references and chapters, with automatic/manual refresh control.
  - Image insertion assistant with project images dropdown and universal drag-and-drop.
  - Full loop with real-time automatic PDF preview as you type.
  - Native Typst Universe integration (+1,500 community packages & templates).
  - 8 pre-configured academic templates with self-contained embedded fonts.
  - BibTeX citation assistant with live autocomplete.
  - Remove recent projects easily from the launcher.
  - Self-contained project archives in `.dbvt` format.
  - 3 visual themes (Light, Dark, and warm Sepia) plus integrated Typst CLI terminal.

---

## 🚀 Download and install

**No need to install Rust, Node.js, or any programming tool.** The installer bundles everything required — including the Typst compiler — and associates `.typ` files for you.

### 🪟 Windows

#### 🏬 Microsoft Store (Recommended for Windows)

**[🛒 Get it from Microsoft Store](https://apps.microsoft.com/store/detail/9PCPSVTNJMP0?cid=DevShareMCLPCB)**

The most seamless experience on Windows 10 and 11: packaged and signed directly by Microsoft Store (no SmartScreen warnings), one-click installation, and automatic background updates.

*(Note: available with Store ID `9PCPSVTNJMP0`. If you previously installed an earlier build from the Store, ensure you update to `v0.3.1` or newer; the current Store version is `v0.5.0` with full embedded Typst compiler; see [`CHANGELOG.en.md`](./dbv-specs-ops/CHANGELOG.en.md)). If you prefer not to use the Store, use the standalone `.exe` installer below.*

#### 📦 Standalone Installer (.exe)

**[⬇️ See all versions (Releases)](https://github.com/davidbuenov/dbv-typst-editor/releases)** — download `DBV Typst Editor_x.y.z_x64-setup.exe`.

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

`v0.5.0` documented in [`dbv-specs-ops/CHANGELOG.en.md`](./dbv-specs-ops/CHANGELOG.en.md) — code intelligence through the Tinymist LSP, figure generation with Python, a CeTZ diagram assistant, Git integration with side-by-side diff, and a thorough interface overhaul: launcher and gallery consolidate into a single entry point with three routes (local templates, Typst Universe and a free identifier), the header groups its file actions into one menu, and the keep-on-top pin and enlarged template preview arrive.

The changelog is maintained in both languages: [English](./dbv-specs-ops/CHANGELOG.en.md) · [Español](./dbv-specs-ops/CHANGELOG.md).

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

Copyright (c) 2026 David Bueno Vallejo

---

## ✍️ Author & Credits

### 👤 David Bueno Vallejo

> Original idea, architecture, project direction and development.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-davidbueno-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/davidbueno/)
[![Website](https://img.shields.io/badge/Web-davidbuenov.com-6366f1?logo=googlechrome&logoColor=white)](https://davidbuenov.com)
[![GitHub](https://img.shields.io/badge/GitHub-davidbuenov-181717?logo=github&logoColor=white)](https://github.com/davidbuenov)

### 👥 Collaborators

- **Juan Falgueras Cano**
- **Alberto Corbi**

### 🤖 Built with AI

| Tool | Role |
| --- | --- |
| **[Gemini](https://deepmind.google/technologies/gemini/)** · *Google DeepMind* | Development & pair programming: frontend, bidirectional editor ↔ preview sync, UI/UX, command integration, and optimizations. |
| **[Claude Code](https://claude.com/claude-code)** · *Anthropic* | Development & pair programming: Rust/Tauri v2 architecture, Typst compiler engine & SVG/PNG/PDF rendering, testing, and application lifecycle. |
| **[Microsoft Copilot](https://copilot.microsoft.com/)** · *Microsoft* | Initial planning, ideation, and project requirements structuring. |

> 🛠️ Built with the **[dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)** framework — Spec-Driven Development, free and open.
