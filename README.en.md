# DBV Typst Editor

**[🇪🇸 Español](./README.md) · 🇬🇧 English**

[![Website](https://img.shields.io/badge/Website-davidbuenov.github.io%2Fdbv--typst--editor-2563eb?style=flat&logo=googlechrome&logoColor=white)](https://davidbuenov.github.io/dbv-typst-editor/en/)
[![Releases](https://img.shields.io/badge/Releases-v0.9.0-brightgreen?logo=github)](https://github.com/davidbuenov/dbv-typst-editor/releases)
[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-9PCPSVTNJMP0-0078D6?logo=microsoft&logoColor=white)](https://apps.microsoft.com/store/detail/9PCPSVTNJMP0?cid=DevShareMCLPCB)
![Status](https://img.shields.io/badge/status-stable%20%7C%20v0.9.0-success)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Windows](https://img.shields.io/badge/Windows-10%20%2F%2011%20(Microsoft%20Store)-0078D6?logo=windows&logoColor=white)
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
- [References](#-references)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)
- [Author & Credits](#-author--credits)

---

## 📌 About

**DBV Typst Editor** is a native desktop editor for [Typst](https://typst.app) documents, built for teachers, researchers, PhD candidates, university students, and technical writers who need to produce professional-quality academic and technical PDFs without relying on LaTeX or online-only tools.

It follows the same philosophy as its sibling project [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader): lightweight, fast, cross-platform, offline-first, with a clean interface and a pleasant writing experience. It reuses, wherever possible, the architecture, components, and design decisions already validated in that project.

**Built with:** Rust, Tauri v2, Typst CLI/crate, HTML5, Tailwind CSS, JavaScript.

---

## 🚦 Current status

**Current version:** `v0.9.0` · **Status:** 🟢 Stable and production ready

- 🌐 **Official Website:** [https://davidbuenov.github.io/dbv-typst-editor/en/](https://davidbuenov.github.io/dbv-typst-editor/en/) (featuring full-resolution interactive screenshot gallery and bilingual ES/EN switch).
- 📦 **Installers available on Releases:** [GitHub Releases](https://github.com/davidbuenov/dbv-typst-editor/releases):
  - 🪟 **Windows**: only through the [Microsoft Store](https://apps.microsoft.com/store/detail/9PCPSVTNJMP0?cid=DevShareMCLPCB) (there is no `.exe` installer on Releases since `v0.8.0`).
  - 🍎 **macOS**: Universal `.dmg` (compatible with Apple Silicon & Intel).
  - 🐧 **Linux**: `.AppImage` (portable) and `.deb` (Debian/Ubuntu/Mint) packages.
- 🏬 **Microsoft Store:** published on the official store. [🛒 Get it from Microsoft Store (ID 9PCPSVTNJMP0)](https://apps.microsoft.com/store/detail/9PCPSVTNJMP0?cid=DevShareMCLPCB). If you installed an earlier Store package, make sure you get `v0.3.1` or later (see [`CHANGELOG.en.md`](./dbv-specs-ops/CHANGELOG.en.md)).
- 🧪 **Quality & Stability:** 1,096 automated tests passing at 100% (742 frontend tests + 354 Rust backend tests) and layout verification in real rendering engines.
- 🚀 **Key Highlights:**
  - **Fast preview engine (v0.9.0):** Typst as a library inside the app — each edit of a 224-page book takes ≈0.5 s instead of ≈4.6 s — with exact word-by-word sync in both directions (double-click or right-click on the render; Ctrl+Alt+P from the editor), diagnostics underlined in the editor, context menus and code-file editing (`.cpp`, `.java`, `.py` and ~40 more types). The classic engine is the automatic fallback.
  - Performance with large documents: the preview releases pages that scroll far away (a 220-page book no longer grows to several GB), the typing pause adapts to how long compiling takes, and a loose `.typ` in a huge folder (Downloads, Desktop) opens in seconds instead of almost a minute.
  - Selectable main document: a **main** badge in the file tree and a context menu (right-click) or the File menu to mark which file the preview compiles — essential in projects without a `main.typ`. It is remembered per project and writes nothing into your folder.
  - Tinymist on demand and switchable off from its badge: it starts by itself for small documents and waits for you to enable it on large ones.
  - Homebrew install on macOS and Linux (`brew tap davidbuenov/dbv-typst-editor && brew install --cask dbv-typst-editor`), with a `typs` command-line command to open a document or a folder.
  - Visual, interactive equation editor with a REAL preview compiled by Typst on every pause, plus "Paste LaTeX" via the MiTeX package.
  - Five more diagramming assistants: flowcharts with decisions, sequence diagrams (Chronos), Gantt charts with real dates (Gantty), Kanban boards (Kantan) and DOT/Graphviz graph rendering (Diagraph) — each reachable from the Tools menu, with a contextual help button and a link to the package's original documentation.
  - WYSIWYG diagram editor: nodes, arrows with direction/stroke/label, colors, zoom and drag-and-drop — translates to readable `cetz.canvas` code and can be reopened for further editing.
  - Contextual zoom with keyboard and mouse wheel: adjusts the editor's font size or the preview's zoom depending on where the focus is.
  - Git integration: status, commit, push, pull and clone by URL from the header, with a diff viewer and visual merge-conflict resolution.
  - Full Universe Browser: search across the real Typst Universe catalog (~4,700 packages and templates), not just a curated list, with automatic package/template detection.
  - Bidirectional editor ↔ preview synchronization (double-click on preview jumps to source code and pin button takes preview to cursor).
  - Whole-document compilation (`main.typ`) preserving cross-references and chapters, with automatic/manual refresh control.
  - Visual bibliography with `hayagriva`: citation autocomplete with title/author/year and a warning for duplicate or incomplete entries.
  - Official Typst Language Server (tinymist) built in: semantic autocomplete, live diagnostics, and one-click formatting.
  - Built-in Python runner (Matplotlib, NumPy, pandas) and a JavaScript runner with `jogs` for dynamic figures and data.
  - Paste an image straight from the clipboard, in addition to universal drag-and-drop.
  - 8 pre-configured academic templates with self-contained embedded fonts.
  - Self-contained project archives in `.dbvt` format.
  - 3 visual themes (Light, Dark, and warm Sepia) plus an integrated advanced Typst terminal.

---

## 🚀 Download and install

**No need to install Rust, Node.js, or any programming tool.** The installer bundles everything required — including the Typst compiler — and associates `.typ` files for you.

### 🪟 Windows

**[🛒 Get it from Microsoft Store](https://apps.microsoft.com/store/detail/9PCPSVTNJMP0?cid=DevShareMCLPCB)**

Since `v0.8.0`, Microsoft Store is the **only** install channel for Windows: the package is signed by the Store itself (no SmartScreen warnings), installs with one click and updates itself in the background. It was chosen because the Store publishes updates very quickly and is the safest way to receive them: it does not depend on every user downloading and running an installer by hand.

The `.exe` installer on GitHub Releases is **discontinued**. If you already installed it that way, install from the Store to keep receiving updates: they are two different application identities, so they will coexist as two separate entries in "Installed apps" until you uninstall the old one. The `.exe` install will not receive `v0.8.0` or later through "Check for updates".

*(Store ID `9PCPSVTNJMP0`. The version the Store offers is always the latest one Microsoft has certified; it can lag a few days behind GitHub. See [`CHANGELOG.en.md`](./dbv-specs-ops/CHANGELOG.en.md).)*

### 🍺 Homebrew (macOS & Linux)

```bash
brew tap davidbuenov/dbv-typst-editor
brew install --cask dbv-typst-editor
```

Works on **macOS** (Intel and Apple Silicon) and **Linux x86_64**. On Linux it needs Homebrew 6.0.0 or later (the release that added AppImage casks) and FUSE 2 to run AppImages (`libfuse2` on Debian/Ubuntu). The tap ([davidbuenov/homebrew-dbv-typst-editor](https://github.com/davidbuenov/homebrew-dbv-typst-editor)) updates itself on every new Release; update with `brew upgrade --cask dbv-typst-editor`. On macOS it does not replace the Gatekeeper prompt described below: the `.dmg` is still not signed or notarised by Apple.

**From the terminal:** the Cask also installs a `typs` command, to open the app without leaving the keyboard:

```bash
typs                 # open the app
typs report.typ      # open a document
typs thesis/         # open a folder as a project
typs .               # open the current folder
```

If the app is already running, `typs` reuses the same window. `brew uninstall --cask dbv-typst-editor` removes it.

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

`v0.8.0` documented in [`dbv-specs-ops/CHANGELOG.en.md`](./dbv-specs-ops/CHANGELOG.en.md) — performance with large documents (preview page release, bounded temporary replica, adaptive typing pause), a main document selectable from the tree, Tinymist on demand, and a Homebrew channel for macOS and Linux with the `typs` command. `v0.7.0` added: a visual, interactive equation editor, five new diagramming assistants (sequence, Gantt, Kanban, DOT/Graphviz and flowcharts with decisions), a contextual help button linking to each assistant's original documentation, contextual zoom with keyboard/wheel, and a batch of UX fixes (stuck splitter, `ResizeObserver` warning, home screen redesign) found using the app on a real project.

The changelog is maintained in both languages: [English](./dbv-specs-ops/CHANGELOG.en.md) · [Español](./dbv-specs-ops/CHANGELOG.md).

---

## 📚 References

- **Voynov, A., Corbi, A., López-Oliver, P., & Gil, D. (2026).** [*Typst: A Modern Typesetting Engine for Science*](https://doi.org/10.9781/ijimai.2026.2269). *International Journal of Interactive Multimedia and Artificial Intelligence, 9*(7), 107–120. A systematic review of the Typst ecosystem (engine, language, Typst Universe packages, adoption) with case studies in Physics, Math and Computer Science. Section XI ("Application of Typst for Computer Science") catalogs diagramming packages — Fletcher/Matofletcher (flowcharts), CeTZ (trees, charts), Diagraph (DOT/Graphviz via Wasm), Pintora/Pintorita (activity, class, ER diagrams), Chronos (sequence diagrams), Gantty/Timeliney (Gantt charts) and Kantan (Kanban boards) — that serve as a reference map for evaluating future integrations in the editor. One of its authors, **Alberto Corbi**, is a collaborator on this project (see the Author & Credits section below).

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

Copyright (c) 2026 David Bueno Vallejo

---

## 🙏 Acknowledgments

This app wouldn't exist without a good number of open-source projects. Thanks to their authors and maintainers:

### Engine and language

- [Typst](https://typst.app) — the typesetting engine the whole app is built around (vendored as a compilation sidecar binary and, since v0.9.0, its `typst`, `typst-ide`, `typst-layout`, `typst-svg` and `typst-kit` crates linked into the app for the in-process preview engine; Apache-2.0 licensed).
- [Hilbert Editor](https://github.com/aburousan/hilbert-editor) (MIT) — studying its click→source sync through each glyph's `Span` inspired v0.9.0's render↔source map; the implementation is our own.
- [Tinymist](https://github.com/Myriad-Dreamin/tinymist) — Typst's official Language Server, vendored for semantic autocompletion, live diagnostics and formatting.

### Typst Universe packages powering the app's own visual assistants

- [cetz](https://typst.app/universe/package/cetz) — the drawing engine behind the WYSIWYG diagram editor.
- [MiTeX](https://typst.app/universe/package/mitex) — converts LaTeX pasted into the visual equation editor.
- [Chronos](https://typst.app/universe/package/chronos) — sequence diagrams.
- [Gantty](https://typst.app/universe/package/gantty) — Gantt charts with real dates.
- [Kantan](https://typst.app/universe/package/kantan) — Kanban boards.
- [Diagraph](https://typst.app/universe/package/diagraph) — DOT/Graphviz graph rendering via a Wasm plugin.
- [jogs](https://typst.app/universe/package/jogs) — embedded JavaScript runtime (QuickJS) for figures and dynamic data.

### Core pieces of the application

- [Tauri](https://tauri.app) — the desktop framework (Rust + native WebView) the whole app runs on, along with its `shell`, `dialog`, `updater`, `process` and `single-instance` plugins.
- [CodeMirror 6](https://codemirror.net) and [codemirror-lang-typst](https://github.com/kxxt/codemirror-lang-typst) — the code editor and its Typst syntax highlighting.
- [Hayagriva](https://github.com/typst/hayagriva) — the very same BibTeX/Hayagriva bibliography engine the Typst compiler itself uses for `#bibliography()`.
- [Vite](https://vite.dev) — frontend bundling and dev server.
- Rust crates: [serde](https://serde.rs)/serde_json, [tokio](https://tokio.rs), [notify](https://github.com/notify-rs/notify), [toml](https://github.com/toml-rs/toml), [tempfile](https://github.com/Stebalien/tempfile), [zip](https://github.com/zip-rs/zip2), [dunce](https://gitlab.com/kornelski/dunce), [base64](https://github.com/marshallpierce/rust-base64), [ureq](https://github.com/algesten/ureq) and [sys-locale](https://github.com/1Password/sys-locale) (macOS).

Thanks also to the maintainers of every package curated in the app's Universe Browser (see [`src/universe/curatedCatalog.js`](./src/universe/curatedCatalog.js)) — IEEE/ACM/Springer templates, `fletcher`, `touying`, `quick-maths`, `physica`, `codly`, `zebraw`, `showybox`, `tablem`, `subpar`, `lovelace`, `glossarium`, `unify`, `wordometer` and the rest — for their work, even where this list doesn't name every one individually.

### Microsoft Store publishing

- [tauri-windows-bundle](https://github.com/Choochmeque/tauri-windows-bundle), by **Vladimir Pankratov** — the tool that builds the `.msix` package this app ships to the Microsoft Store; without it, Tauri's official path to the Store would require a paid Authenticode certificate.

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
