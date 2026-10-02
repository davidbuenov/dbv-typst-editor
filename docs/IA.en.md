# 🤖 Using an AI with DBV Typst Editor

> 🌐 [Español](./IA.md) · **English** · [← Back to the README](../README.en.md)

The AI assistant in DBV Typst Editor is **optional**. With nothing configured, the editor works exactly as it always has: it compiles, previews and exports offline. This guide explains **what you need on your computer** depending on the AI you want to use.

## The essentials in one table

| I want to use… | What I need to install or have | Does anything leave my computer? | Does it cost money? |
| --- | --- | --- | --- |
| **A local AI** (Ollama, LM Studio, llama.cpp…) | The server program and at least one downloaded model | No | No (it uses your CPU/GPU and disk) |
| **Claude, ChatGPT, Gemini or OpenRouter with an API key** | An API key from that provider | Yes, to the provider | Yes, pay-per-use at the provider's rates |
| **My subscription** (Claude Pro/Max, ChatGPT Plus, Gemini, Copilot) | That service's **agent** installed and signed in: Claude Code, Codex, Gemini CLI or GitHub Copilot CLI | Yes, to the agent's service | Covered by your subscription |

> ⚠️ **A subscription is not an API key.** Paying for Claude Pro, ChatGPT Plus or Gemini does not give you an API key (those are bought separately). With a subscription, the route is the **installed agent** (third row).

To open the connection assistant: **Tools → Connect an AI**. When it opens, the editor **detects what you already have** (Ollama, LM Studio and the agents) and marks it with ✓; anything it does not find appears with an installation link. This detection only happens when you open that screen, never when the app starts.

Once connected, the AI panel opens with the **AI** button, next to P/E/V.

---

## 1. A local AI (nothing leaves your computer)

This is the most private option: your documents never leave your machine and there is no per-use cost. In exchange, quality depends on the size of the model and on your hardware.

### Ollama

1. Install [Ollama](https://ollama.com/download).
2. Download a model, for example: `ollama pull qwen2.5:3b` (or `llama3`).
3. Check what you have installed with `ollama list`.
4. In the editor: **Tools → Connect an AI**. If Ollama is running, it appears with ✓ and a **Use** button. Pick the model from the list, press **Test connection** and **Save**.

Ollama listens on `http://localhost:11434`. The editor talks to it through its **native API** (`/api/chat`) and sets the context size itself, because Ollama defaults to a small one (2,048–4,096 tokens) and silently truncates whatever does not fit.

### LM Studio

1. Install [LM Studio](https://lmstudio.ai), download a model and **start its local server** (*Developer / Local Server* tab).
2. It listens on `http://localhost:1234`; the editor detects it just like Ollama.

### Your own OpenAI-compatible server (llama.cpp, vLLM, Jan…)

Any server that offers the OpenAI API will do. The typical case is `llama-server` from [llama.cpp](https://github.com/ggml-org/llama.cpp) with a `.gguf` model you downloaded yourself. **The assistant does not detect this kind of server: you have to add it by hand.**

1. **Tools → Connect an AI → Add a cloud AI (API key)…** *(that is the button's name, but it opens a new form with every provider)*.
2. Under **Provider**, choose **OpenAI-compatible server (local or your own)**.
   - ⚠️ **Do not choose "Ollama"** for a server that is not Ollama: that mode uses a different protocol and the editor will not understand the reply. Also, the provider of an existing connection **cannot be changed when editing**: create a new one instead.
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
- **"Thinking" models can look mute.** Some models (Gemma 4, for example) first write their reasoning into a separate field (`reasoning_content`) and leave the answer (`content`) empty until they finish. The editor shows `content`, so you see an empty reply while the model burns hundreds or thousands of tokens. Start the server with `--reasoning-budget 0` to turn reasoning off.

A reasonable launch example:

```bash
llama-server -m model.gguf -c 32768 -np 1 --reasoning-budget 0 --port 8080
```

### What to expect from a local model

- **Tools.** With a model that supports them, the AI reads the project on its own, looks things up in the Typst documentation and proposes changes that DBV **compiles in memory** before showing them to you. Without tools, the assistant is still useful for conversation and for working on the context it is sent, but it does less by itself. The form's *Tools* field detects them; if detection fails, you can force it to *Yes* or *No*.
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

The editor **sets the context itself** with Ollama, so the *Context* field is what you decide, not whatever Ollama has configured. If you leave it empty, it uses a safe default (4,096).

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

**Tools → Connect an AI → Add a cloud AI (API key)…** → choose the provider → paste the key → **Test connection** → choose the model from the list the provider itself returns → **Save**.

- **The key** is stored in the **system credential store** (Windows Credential Manager, macOS Keychain, Secret Service on Linux), never in a file or in `localStorage`. When you edit a connection, the key field is empty: leaving it that way keeps the stored one. Deleting the connection also deletes the key.
- **Privacy:** to answer, the project's context (open file, selection, errors and whatever you attach) is sent to the provider. **The first time per project and provider, the editor asks you** before sending anything. You can remove any item from the context in the panel itself.
- **Cost:** billed by the provider, per use.

---

## 3. With your subscription: installed agents

If you pay for **Claude Pro/Max, ChatGPT Plus, Gemini or GitHub Copilot**, you do not need an API key: DBV can talk to that service's **command-line agent**, which uses your account. DBV **never sees or stores your credentials**: the agent itself does the sign-in.

| Agent | What must be installed | How DBV launches it |
| --- | --- | --- |
| **Claude Code** | Claude Code and **Node.js** (includes `npx`) | `npx -y @agentclientprotocol/claude-agent-acp` |
| **Codex** (OpenAI) | Codex and **Node.js** (includes `npx`) | `npx -y @zed-industries/codex-acp` |
| **Gemini CLI** | Gemini CLI | `gemini --experimental-acp` |
| **GitHub Copilot CLI** | Copilot CLI | `copilot --acp` |

Install links: [Claude Code](https://docs.anthropic.com/en/docs/claude-code/setup) · [Codex](https://github.com/openai/codex) · [Gemini CLI](https://github.com/google-gemini/gemini-cli) · [Copilot CLI](https://docs.github.com/copilot/how-tos/set-up/install-copilot-cli) · [Node.js](https://nodejs.org).

**Steps:**

1. Install the agent (and Node.js if it needs it) so that it is on your system's `PATH`.
2. **Open it once in a terminal** and sign in with your account. DBV cannot sign in for you.
3. In the editor: **Tools → Connect an AI**. The agent appears with ✓ *installed* and a **Connect** button.
4. The first time may take a while: for Claude Code and Codex, their adapter is downloaded with `npx`.

**How it works:**

- DBV launches the agent **with the project folder as its working directory**; it is closed when you close the project or the app.
- **Permissions:** whenever the agent asks permission for something (run a command, edit, read), DBV shows it to you with what it is asking for. You can **Allow once**, **Always allow in this conversation** or **Deny**. Nothing is approved on its own, and anything outside the project folder is denied.
- **Safety for your files:** before each turn, DBV saves a **restore point** of the project's text files. Whatever the agent changes directly on disk shows up afterwards under the heading **"The agent changed N files on disk"**, with its differences and **Undo** per file or all at once.

---

## Privacy at a glance

| Route | What leaves your computer |
| --- | --- |
| Local AI | Nothing. The conversation never leaves your machine. |
| Cloud API | The context that is sent, to the provider. You are asked the first time per project. |
| Agent with subscription | Whatever the agent sends to its service. DBV does not control its network traffic; permissions do pass through DBV. |

The direct models' tools **cannot reach the network or run programs**: they only read the project and propose changes that you review hunk by hunk before applying them, with **Undo**.

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
| The model forgets the start of the document | Context too small | Raise the server's context and the **Context (tokens)** field |

---

> This guide describes version **0.13.0**. The in-app help (**?** → *AI assistant*) summarizes the essentials; the full specification is in [`RF-90`–`RF-96` of SPECIFICATIONS.md](../dbv-specs-ops/docs/SPECIFICATIONS.md) (in Spanish).
