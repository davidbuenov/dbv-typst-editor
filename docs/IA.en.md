# 🤖 Using an AI with DBV Typst Editor

> 🌐 [Español](./IA.md) · **English** · [← Back to the README](../README.en.md)

The AI assistant in **DBV Typst Editor** is **optional**. With nothing configured, the application works exactly the same, locally. This guide explains **what you need on your computer** depending on the AI you want to use.

## The essentials in one table

| I want to use… | What I need to install or have | Does anything leave my computer? | Does it cost money? |
| --- | --- | --- | --- |
| **A local AI** (Ollama, LM Studio, llama.cpp…) | The server program and at least one downloaded model | No | No (it uses your CPU/GPU and disk) |
| **Claude, ChatGPT, Gemini or OpenRouter with an API key** | An API key from that provider | Yes, to the provider | Yes, pay-per-use at the provider's rates |
| **My subscription** (Claude Pro/Max, ChatGPT Plus, Gemini / Google One, Copilot) | That service's **agent** installed and signed in: Claude Code, Codex, Gemini CLI, Google Antigravity or GitHub Copilot CLI | Yes, to the agent's service | Covered by your subscription |

> ⚠️ **A subscription is not an API key.** Paying for Claude Pro, ChatGPT Plus or Gemini does not give you an API key (those are bought separately). With a subscription, the route is the **installed agent** (third row).

Everything is set up on the **Connect an AI** screen, which opens from the application's AI button. When it opens, DBV Typst Editor **detects what you already have** (Ollama, LM Studio and the agents) and marks it with ✓; anything it does not find appears with a **How to install** button. This detection only happens when you open that screen, never when the application starts.

The screen has three blocks, one per row of the table: **Local AIs (100% Offline)**, **Subscription AIs (CLI Agents)** and **Cloud AIs with API Key**.

---

## 1. A local AI (nothing leaves your computer)

This is the most private option: your documents never leave your machine and there is no per-use cost. In exchange, quality depends on the size of the model and on your hardware.

### Ollama

1. Install [Ollama](https://ollama.com/download).
2. Download a model, for example: `ollama pull qwen2.5:3b` (or `llama3`).
3. Check what you have installed with `ollama list`.
4. Open **Connect an AI**. If Ollama is running, it appears with ✓ and a **Use** button. Pick the model from the list, press **Test connection** and **Save**.

Ollama listens on `http://localhost:11434`. The application talks to it through its **native API** (`/api/chat`) and sets the context size itself, because Ollama defaults to a small one (2,048–4,096 tokens) and silently truncates whatever does not fit.

### LM Studio

1. Install [LM Studio](https://lmstudio.ai), download a model and **start its local server** (*Developer / Local Server* tab).
2. It listens on `http://localhost:1234`; the application detects it just like Ollama.

### Your own OpenAI-compatible server (llama.cpp, vLLM, Jan…)

Any server that offers the OpenAI API will do. The typical case is `llama-server` from [llama.cpp](https://github.com/ggml-org/llama.cpp) with a `.gguf` model you downloaded yourself. **This kind of server is not detected automatically: you have to add it by hand.**

1. **Connect an AI → Add a cloud AI (API key)…** *(that is the button's name, but it opens a form with every provider)*.
2. Under **Provider**, choose **OpenAI-compatible server (local or your own)**.
   - ⚠️ **Do not choose "Ollama"** for a server that is not Ollama: that mode uses a different protocol and the application will not understand the reply. Also, the provider of an existing connection **cannot be changed when editing**: create a new one instead.
3. Fill in the form:

   | Field | Value |
   | --- | --- |
   | Name | whatever you like |
   | Address | `http://127.0.0.1:8080/v1` (your server's port, **ending in `/v1`**) |
   | API key | empty, unless you started the server with `--api-key` |
   | Model | the `id` returned by `curl http://127.0.0.1:8080/v1/models` |
   | Context (tokens) | the server's `n_ctx` divided by its slots (see below) |
   | Tools | *Detect* |

4. **Test connection** and **Save**. Make the connection active and pick it in the panel's selector.

The form values (model, context, tools) can be looked up with a few commands: see [Finding out the form values](#finding-out-the-form-values).

**Three common llama.cpp pitfalls:**

- **The context is not `n_ctx_train`.** `/v1/models` shows `n_ctx_train`, the maximum the model was trained with, not what your server has. The real value is the `-c` flag you started it with.
- **Slots split the context.** With several slots (`-np`), the context is divided among them; with `-np 4` and `-c 32768`, each request gets 8,192. To give a single conversation all of it: `-np 1`.
- **"Thinking" models can look mute.** Some models first write their reasoning into a separate field (`reasoning_content`) and leave the answer (`content`) empty until they finish. The application shows `content`, so you see an empty reply while the model burns hundreds or thousands of tokens. Start the server with `--reasoning-budget 0` to turn reasoning off.

A reasonable launch example:

```bash
llama-server -m model.gguf -c 32768 -np 1 --reasoning-budget 0 --port 8080
```

### What to expect from a local model

- **Tools.** With a model that supports them, the AI looks through the documents in the folder on its own and proposes changes that you review before they are applied. Without tools, the assistant is still useful for conversation and for working on the context it is sent, but it does less by itself. The form's *Tools* field detects them; if detection fails, you can force it to *Yes* or *No*.
- **Size.** Models of 2–3 billion parameters (around 2–3 GB) answer quickly on a laptop but fall short on long or complex proposals. If answers come out weak, try a larger model before touching the configuration.
- **Context.** A 4,096-token context is the bare minimum and falls short with long documents or images. 8,192 is comfortable for working; 32,768, generous.
- **Memory.** A bigger model or a larger context needs more RAM or VRAM. Start small and scale up.

---

## Finding out the form values

To connect a local AI, the form asks for three things: **model**, **context** and whether it supports **tools**. You look them up on your own computer with the commands below, and the result is what goes into each field.

> In **PowerShell**, use `curl.exe` (with the extension): plain `curl` is an alias for a different command and does not return the same thing. In CMD, macOS and Linux, `curl` works.

### Ollama (port 11434)

| I want to know… | Command | Form field |
| --- | --- | --- |
| Which models I have downloaded | `ollama list` | **Model**: the full `NAME` column (for example `qwen2.5:3b`; `llama3:latest` also works as `llama3`) |
| The same, through the API | `curl http://localhost:11434/api/tags` | — |
| Which models are loaded in memory right now | `ollama ps` | — |
| Details of a model (architecture, parameters, maximum context, quantization) | `ollama show qwen2.5:3b` | **Context**: the maximum shown is the model's; choose a value equal to or lower than what fits in your memory |
| Download a new model | `ollama pull qwen2.5:3b` | — |

The application **sets the context itself** with Ollama, so the *Context* field is what you decide, not whatever Ollama has configured. If you leave it empty, it uses a safe default (4,096).

### LM Studio (port 1234)

With its local server running:

```bash
curl http://localhost:1234/v1/models      # each model's "id" → Model field
lms ls                                    # downloaded models (if you have its `lms` tool installed)
```

The context is set in LM Studio when the model is loaded (*Context Length* setting); copy that number into the form.

### Your own server with llama.cpp (`llama-server`)

With the server running (the default port is `8080`):

```bash
curl http://127.0.0.1:8080/v1/models      # "data" → "id": model name → Model field
curl http://127.0.0.1:8080/props          # context, slots and capabilities
```

And in PowerShell, ready to use:

```powershell
# Model name → Model field
(curl.exe -s http://127.0.0.1:8080/v1/models | ConvertFrom-Json).data.id

# Context, slots, tools and images
$p = curl.exe -s http://127.0.0.1:8080/props | ConvertFrom-Json
"n_ctx=$($p.default_generation_settings.n_ctx)  slots=$($p.total_slots)  tools=$($p.chat_template_caps.supports_tools)  vision=$($p.modalities.vision)"
```

| Value returned | What it means | Form field |
| --- | --- | --- |
| `id` in `/v1/models` | Model name (usually the `.gguf` file) | **Model** |
| `n_ctx` in `/props` | The server's **total** context (the `-c` flag) | **Context (tokens)**, divided by `total_slots` |
| `total_slots` in `/props` | Parallel slots: each request gets `n_ctx / total_slots` (with 4 slots and 32,768, that is 8,192). With `-np 1`, all of it | Divide `n_ctx` by this number (see "Three common llama.cpp pitfalls", above) |
| `supports_tools` in `/props` | Whether the model supports tools | **Tools**: leave it on *Detect*; force it to *No* if you see it fail |
| `vision` in `/props` | Whether the server has vision (`--mmproj`) | — |
| `n_ctx_train` in `/v1/models` | The context the model was **trained** with: **not the server's** | Do not use it |

### The "Test connection" button

It is the definitive check: if the server answers and the address is right, it returns the real list of models. For Ollama and LM Studio, that list appears in the **Model** field's drop-down; for your own server, check that the name you type is one of those returned by `/v1/models`.

---

## 2. In the cloud, with your API key

To use a provider's model with an **API key**:

| Provider | Where to get the key | Address (already preset) |
| --- | --- | --- |
| Anthropic (Claude) | Anthropic console | `https://api.anthropic.com/v1` |
| OpenAI (ChatGPT) | OpenAI platform | `https://api.openai.com/v1` |
| Google (Gemini) | Google AI Studio | `https://generativelanguage.googleapis.com/v1beta/openai` |
| OpenRouter | openrouter.ai | `https://openrouter.ai/api/v1` |

**Connect an AI → Add a cloud AI (API key)…** → choose the provider → paste the key → **Test connection** → choose the model from the list the provider itself returns → **Save**.

- **The key** is stored in the **system credential store** (Windows Credential Manager, macOS Keychain, Secret Service on Linux), never in a file or in `localStorage`. When you edit a connection, the key field is empty: leaving it that way keeps the stored one. Deleting the connection also deletes the key.
- **Privacy:** to answer, the context (open document, selection and whatever you attach) is sent to the provider. **The first time per project and provider, the application asks you** before sending anything. You can remove any item from the context in the panel itself.
- **Cost:** billed by the provider, per use.

---

## 3. With your subscription: installed agents

If you pay for **Claude Pro/Max, ChatGPT Plus, Gemini / Google One or GitHub Copilot**, you do not need an API key: DBV Typst Editor can talk to that service's **command-line agent**, which uses your account. The application **never sees or stores your credentials**: the agent itself does the sign-in. The connection uses the open [ACP (Agent Client Protocol)](https://agentclientprotocol.com).

| Agent | What must be installed | How the application launches it |
| --- | --- | --- |
| **Claude Code** | Claude Code and **Node.js** (includes `npx`) | `npx -y @agentclientprotocol/claude-agent-acp` |
| **Codex** (OpenAI) | Codex and **Node.js** (includes `npx`) | `npx -y @agentclientprotocol/codex-acp` |
| **Gemini CLI** | Gemini CLI | `gemini --acp` |
| **Google Antigravity** | Antigravity CLI (`agy`) **and its ACP server** (`agy_acp_server`, installed separately: [see below](#google-antigravity-installing-its-acp-server)) | `agy_acp_server` |
| **GitHub Copilot CLI** | Copilot CLI (the `copilot` command that comes with VS Code is **not enough**: [see below](#github-copilot-vs-codes-copilot-command-is-not-the-cli)) | `copilot --acp` |

Install links: [Claude Code](https://docs.anthropic.com/en/docs/claude-code/setup) · [Codex](https://github.com/openai/codex) · [Gemini CLI](https://github.com/google-gemini/gemini-cli) · [Antigravity CLI](https://antigravity.google/product/antigravity-cli) · [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli) · [Node.js](https://nodejs.org).

**Steps:**

1. Install the agent (and Node.js if it needs it) so that it is on your system's `PATH`.
2. **Open it once in a terminal** and sign in with your account. The application cannot sign in for you.
3. Open **Connect an AI**. The agent appears under **Subscription AIs** with ✓ *installed* and a **Connect** button.
4. The first time may take a while: for Claude Code and Codex, their adapter is downloaded with `npx`.
5. If the agent asks you to **sign in** when it connects (Antigravity and Codex may ask the first time), the application requests it with the agent's usual method (for example *Log in with Google* or *Login with ChatGPT*): if a browser opens, finish there. The agent itself keeps the session.
6. Optional: once the agent is connected, the **⚙️** button lets you pick the **model** and **reasoning level**. The list is asked from the agent itself the first time you open the screen; **🔄** asks again. Next to the agent's name you will see a summary of the chosen model and level.

### GitHub Copilot: VS Code's `copilot` command is not the CLI

VS Code with Copilot puts a `copilot` command on the `PATH` that is **only a launcher**: it runs the Copilot CLI if it is installed and, if not, says *"GitHub Copilot CLI was not found"*. The application knows this and, when there is no CLI behind it, shows Copilot as *not installed*. Install the real CLI in any of these ways ([official guide](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli)):

| System | Command |
| --- | --- |
| Windows | `winget install GitHub.Copilot` |
| macOS and Linux | `brew install --cask copilot-cli` |
| Any (Node.js 22 or later) | `npm install -g @github/copilot` |

Then open it once with `copilot` in a terminal, sign in with your GitHub account and reopen **Connect an AI**.

### Google Antigravity: installing its ACP server

The Antigravity CLI (`agy`) **does not speak ACP on its own**: a separate program, **`agy_acp_server`**, does, and Google publishes it in the [ACP registry](https://github.com/agentclientprotocol/registry/blob/main/antigravity-acp/agent.json). If you only have `agy`, the application shows Antigravity as *installed, but without its ACP server* and it cannot be connected.

1. **Install [Antigravity CLI](https://antigravity.google/product/antigravity-cli)**, open it once with `agy` in a terminal and sign in with your Google account.
2. **Download the ACP server** for your system (version 1.4.4; the latest is always in the [registry](https://github.com/agentclientprotocol/registry/blob/main/antigravity-acp/agent.json)):

   | System | Download |
   | --- | --- |
   | Windows x64 | [agy-acp-server-1.4.4-windows-x86_64.zip](https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.4.4-windows-x86_64.zip) |
   | Windows ARM | [agy-acp-server-1.4.4-windows-arm64.zip](https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.4.4-windows-arm64.zip) |
   | macOS Apple Silicon | [agy-acp-server-1.4.4-darwin-arm64.zip](https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-1.4.4-darwin-arm64.zip) |
   | macOS Intel | [agy-acp-server-1.4.4-darwin-x86_64.zip](https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-1.4.4-darwin-x86_64.zip) |
   | Linux x64 | [agy-acp-server-1.4.4-linux-x86_64.zip](https://dl.google.com/agy-extensions/releases/linux/agy-acp-server-1.4.4-linux-x86_64.zip) |
   | Linux ARM | [agy-acp-server-1.4.4-linux-arm64.zip](https://dl.google.com/agy-extensions/releases/linux/agy-acp-server-1.4.4-linux-arm64.zip) |

3. **Unzip the whole archive** (it contains more than one file and they must stay together) into this folder, where the application looks for it:

   | System | Folder |
   | --- | --- |
   | Windows | `%LOCALAPPDATA%\agy\acp-server` |
   | macOS and Linux | `~/.local/share/agy-acp-server` |

   On **Windows**, from PowerShell (Windows x64; for ARM replace `x86_64` with `arm64`):

   ```powershell
   $zip = "$env:TEMP\agy-acp-server.zip"
   Invoke-WebRequest https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.4.4-windows-x86_64.zip -OutFile $zip
   Expand-Archive $zip -DestinationPath "$env:LOCALAPPDATA\agy\acp-server" -Force
   ```

   On **macOS or Linux** (replace the zip name with your system's):

   ```bash
   mkdir -p ~/.local/share/agy-acp-server && cd ~/.local/share/agy-acp-server
   curl -LO https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-1.4.4-darwin-arm64.zip
   unzip -o agy-acp-server-*.zip && chmod +x agy_acp_server.par
   ```

4. Reopen **Connect an AI**: Antigravity appears with ✓ *installed* and the **Connect** button.
5. The first time you write to it, the server asks to **sign in** and the application requests it with your Google account (*Log in with Google*): if a browser opens, finish there.

> Any other folder on your `PATH` works too. Third-party adapters that "wrap" `agy` are not supported: they rely on an undocumented `agy` mode and Google has not said whether its terms allow it.

**How it works:**

- The application launches the agent **with the document's folder as its working directory**; it is closed when you close the document or the application.
- **Permissions:** whenever the agent asks permission for something (run a command, edit, read), the application shows it to you with what it is asking for. You can **Allow once**, **Always allow in this conversation** or **Deny**. Nothing is approved on its own, and anything outside the folder is denied.
- **Safety for your files:** before each turn, the application saves a **restore point** of the folder's text files. Whatever the agent changes directly on disk shows up afterwards under the heading **"The agent changed N documents on disk"**, with its differences and **Undo** per file or all at once.

---

## Privacy at a glance

| Route | What leaves your computer |
| --- | --- |
| Local AI | Nothing. The conversation never leaves your machine. |
| Cloud API | The context that is sent, to the provider. You are asked the first time per project. |
| Agent with subscription | Whatever the agent sends to its service. The application does not control its network traffic; permissions do pass through it. |

The direct models' tools (local and API) **cannot reach the network or run programs**: they only read the folder and propose changes that you review hunk by hunk before applying them, with **Undo**.

## Common problems

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| I type and **nothing answers** (own server) | Provider set to *Ollama* instead of *OpenAI-compatible* | Create a new connection with the right provider |
| Empty reply and many tokens "received" | The model reasons and never gets to write `content` | Start the server with `--reasoning-budget 0` |
| "Local server not running" | Ollama, LM Studio or your server is not running | Start it and **Test connection** again |
| Address error or 404 with your own server | Missing `/v1` at the end of the address | `http://127.0.0.1:PORT/v1` |
| Invalid key | Key pasted wrongly or from another provider | Paste it again; a subscription does not work as a key |
| An agent does not appear or will not connect | It is not on the `PATH`, Node.js is missing or you have not signed in | Install it, open it once in a terminal and reopen **Connect an AI** |
| The agent says it needs Node.js | Claude Code and Codex use `npx` | Install [Node.js](https://nodejs.org) |
| Copilot shows *not installed* although `copilot` exists, or "GitHub Copilot CLI was not found" | Only VS Code's `copilot` launcher is there, without the CLI | Install the CLI: [instructions](#github-copilot-vs-codes-copilot-command-is-not-the-cli) |
| Antigravity shows *without its ACP server*, or "Antigravity needs its ACP server" | Only the `agy` CLI is installed | Install `agy_acp_server`: [instructions](#google-antigravity-installing-its-acp-server) |
| Codex answers "Internal error" | An old version of the application, with the `@zed-industries/codex-acp` adapter, which does not understand current models | Update the application: the current version uses `@agentclientprotocol/codex-acp` |
| The model forgets the start of the document | Context too small | Raise the server's context and the **Context (tokens)** field |

<!-- dbv-ia:fin-guia-comun · Everything above comes from dbv-specs-ops/docs/templates/IA.en.template.md (do not edit it here: change the template and sync with scripts/sync-ai.mjs). Whatever you put below is specific to this application and is kept. -->

---

## 4. What the AI can do for your document

With a model that supports **tools** (cloud models and many local ones; the connection’s *Tools* field detects it), the AI does not just answer: it **works on your project**. Everything below it does on its own, without writing anything yet; what it wants to change reaches you as a **proposal you review**.

| It can… | How | Limit |
| --- | --- | --- |
| **Read and search** the project files | Through its tools, only inside the project folder | A loose `.typ`: it only sees that file |
| **Look up the Typst documentation** | That of the exact version DBV compiles with, offline | — |
| **Check its proposal** | Compiles it in memory and tells you the new and the fixed errors | A package that is not installed is flagged as an "incomplete check", not as an error |
| **Search templates and packages** in Typst Universe | From the real catalog, one version per package (the latest compatible with the compiler) | It never writes a name or version from memory |
| **Read how a package is used** | The package’s README, manifest and template function | With a local AI, only for installed ones |
| **Cite references** | Only keys that exist in your `.bib`; only citation styles Typst ships with | A loose document has no folder bibliography |
| **See the pages** | Renders up to 3 pages and receives them as images | Only with a model that accepts images |
| **Offer a missing typeface** | Shows its licence and size; it is only copied into `fonts/` if you press **Add to project** | Cloud AI only; it can be undone |

**Measured:** with the real catalog, neither `qwen3:8b` nor Gemini 3.8 Flash invented a package or a version in 10 runs. But a small local model **usually does not finish** these tasks (0 of 5 with `qwen3:8b`; 3 of 5 with Gemini): see [`testfiles/ai-evals/README.md`](../testfiles/ai-evals/README.md).

**Why "it does not invent" matters:** package versions change and an old one may not compile with your compiler. So the AI only writes the `@preview/name:version` identifiers the search returned. If it needs a package that is **not installed**, it puts it in its proposal and **you decide** in the review whether it is downloaded ("Packages that will be downloaded": licence, card and a button; nothing is downloaded by itself).

**What each route does with the network:**

| | Local AI | Cloud AI | Agent (subscription) |
| --- | --- | --- | --- |
| Universe catalog | Only if you already downloaded it (by opening the gallery) | DBV downloads it once and says so in the panel | The agent uses DBV’s MCP server (section 6) |
| Installing a package | Never on its own | Always with your confirmation | Always with your confirmation (`install_package`) |
| Adding a font | No | Always with your confirmation | — |

---

## 5. Changing a document’s format: applying a template

To move a document you already have into a new format (IEEE, Springer, a thesis…) without copying and pasting by hand there are **two paths to the same result**:

### With DBV, no AI

**Tools → Apply template…** *(works with no AI connected)*.

1. Open the project’s main document.
2. Choose **Tools → Apply template…**. **The same gallery as "New document"** opens, with a laid-out preview of each template: the *Typst Universe* tab (reviewed ones), *Search* (the whole catalog) and the free address (`@preview/charged-ieee:0.1.4`). There is no local-templates tab: those are for creating new documents.
3. Pick one and press **Apply "…" to my document**.
4. DBV reads the template’s documentation (if it is not installed, it downloads it: that is an action of yours) and prepares **one proposal**: it adds the `#import` and the `#show` with the template, **moves the title, authors, abstract and keywords** into its parameters and leaves **the rest of the content exactly as it is**.
5. The proposal is **reviewed** like any AI change: you see the differences, whether it compiles and which packages will be downloaded. It **flags** the `#set` and `#show` rules in your document that may clash with the template (it does not remove them) and nothing is written until you press **Apply**. Then, **Undo**.

### By asking the AI

With an AI connected, the **Let the AI adapt it** button (or typing in the panel *"Adapt the document to @preview/…"*, or simply *"make it IEEE"*) asks it for the full job: it looks for the template in the catalog (if several fit, it offers two or three and waits for your choice), reads its parameters, fills them with your data, removes only what clashes, sets the bibliography style from Typst’s styles and **checks the result by rendering the page** if the model accepts images. It is more flexible than the mechanical path, and also costlier and more variable by model: always review the proposal.

**Limits:** Typst Universe templates only; the template must describe a template function (`#show: name.with(…)`); if the document already uses it, DBV tells you and proposes nothing. A format very different from the starting one may need touch-ups by hand (headers, bibliography): that is what the review is for.

---

## 6. DBV’s MCP server: DBV’s tools for other agents

**MCP** (*Model Context Protocol*) is a standard that lets an AI agent use the tools of other programs. DBV includes an **MCP server** that lends an agent what it lacks on its own:

- **Compile with DBV’s exact compiler** (Typst 0.15.1) and get the errors with file and line.
- **See the rendered pages** as images, to judge the layout.
- **The Typst documentation** of that version, offline, and the **Typst Universe catalog** with real identifiers and versions.
- **Ask your permission to install a package**, with a dialog in DBV’s window: nothing is downloaded unless you accept it.
- Available typefaces, **references from your `.bib`** and citation styles.

The agent **still reads and writes your files on its own**: the server is **read-only**, writes nothing in the project and opens no network connection.

### Who uses it and how it connects

| Agent | What to do |
| --- | --- |
| **The one in DBV’s AI panel** (Claude Code, Gemini CLI…) | **Nothing.** DBV offers it when the conversation opens, pointing at the open project (as long as the agent supports MCP). |
| **An agent you run outside DBV** (Claude Code in your terminal, Claude Desktop, Cursor, Codex…) | **Tools → MCP server…** shows the configuration ready to copy with DBV’s real path and your project. |

The configuration looks like this (the dialog fills in the real values):

```bash
# Claude Code and Codex: one command in a terminal
claude mcp add dbv -- "<DBV-path>" --mcp --project "<project-folder>"
codex  mcp add dbv -- "<DBV-path>" --mcp --project "<project-folder>"
```

```json
{ "mcpServers": { "dbv": { "command": "<DBV-path>", "args": ["--mcp", "--project", "<project-folder>"] } } }
```

The JSON works for Claude Desktop, Cursor, Gemini CLI and others that read `mcpServers`. The `<DBV-path>` is the application’s executable: in the **Microsoft Store** version it is the `dbv-typst-editor.exe` alias (it works from any terminal), on **Linux** the AppImage itself, and elsewhere the install path. `--mcp` starts **the server instead of the window**: the agent launches it as a child process and closes it when done.

### The tools

| Tool | What it does |
| --- | --- |
| `compile_project` | Compiles and returns errors and warnings with file, line and hints. A package that is not installed shows as "incomplete", not as an error. |
| `render_page` | Up to 3 pages as PNG images. |
| `search_typst_docs`, `read_typst_docs` | Search and read the Typst documentation of the exact version. |
| `search_universe` | Searches templates and packages in the catalog **already downloaded** (one version per package). With no catalog it says so: it does not invent. |
| `read_package_docs` | README, manifest and template of a package **already installed**. |
| `install_package` | Asks DBV to install a catalog package **with your permission**, and returns its documentation. If DBV is not open, nothing is installed. |
| `list_fonts`, `list_bibliography`, `citation_styles` | Typefaces, `.bib` references and citation styles. |
| `editor_state` | What you see in the editor (see below). |
| `dbv_info` | Server and compiler version, and the project. |

### Sharing the editor state (optional)

With **Preferences → Share the editor state with MCP agents** (**off by default**; also in the *MCP server…* dialog), a connected agent also sees what is **not on disk**: the open tabs **with their unsaved text**, the active document, the cursor and the selection, the outline and the problems. It is useful for asking *"explain what I am writing"*.

- **Read-only** and **only for the open project**: there is no way for an agent to move the cursor, edit a tab or save.
- While an agent reads it, **"Agent connected ✕"** shows in the document header; clicking it **cuts** the access.
- If DBV is not open, or the setting is off, `editor_state` says so and the agent works from what is on disk.

### Security

- The agent launches the server as a **child process** and talks to it over standard input and output: **there is no network port**.
- The channel between the server and DBV’s window is **local** (a named pipe on Windows, a Unix socket on macOS and Linux), with a **random 256-bit token** that changes on every run and that only the user running DBV can read.
- It only sees **the project folder** it was launched with; no tool takes paths.
- Installing a package **always** goes through DBV’s dialog.
