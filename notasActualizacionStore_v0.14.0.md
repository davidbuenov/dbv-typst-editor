# Notas de actualización v0.14.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.14.0 — «AI Native»: la IA conoce Typst Universe, ve tus páginas y se conecta con otros agentes.

• Aplicar plantilla…: pasa un documento que ya tienes al formato IEEE, Springer o el que elijas desde la galería de plantillas; revisas la propuesta antes de aplicar nada.
• La IA usa Typst Universe de verdad: busca plantillas y paquetes reales con su versión exacta, sin inventar nombres. Si falta un paquete, te pregunta antes de descargarlo.
• Ve el resultado: con un modelo que admite imágenes mira las páginas renderizadas; con la nube puede ofrecerte una tipografía que falte (tú confirmas).
• Servidor MCP (Herramientas › Servidor MCP…): Claude Code, Cursor o Codex usan el compilador exacto de DBV, ven las páginas y consultan Universe. Solo lectura y sin red.
• Modelos locales más útiles: tope de respuesta configurable, progreso visible y reintento cuando no contestan.
• Importar snippets de Sublime Text; las fuentes que añades a fonts/ se recogen sin reiniciar.
• Ayuda y guía de IA ampliadas.
```

### 🇬🇧 English

```text
Version 0.14.0 — "AI Native": the AI knows Typst Universe, sees your pages and connects to other agents.

• Apply template…: turn a document you already have into IEEE, Springer or any format you choose from the template gallery; you review the proposal before anything is applied.
• The AI uses Typst Universe for real: it searches real templates and packages with their exact version, without inventing names. If a package is missing, it asks before downloading it.
• It sees the result: with a model that accepts images it looks at the rendered pages; with the cloud it can offer a missing typeface (you confirm).
• MCP server (Tools › MCP server…): Claude Code, Cursor or Codex use DBV's exact compiler, see the pages and query Universe. Read-only, no network.
• More useful local models: configurable response cap, visible progress and retry when they do not answer.
• Import Sublime Text snippets; fonts you add to fonts/ are picked up without a restart.
• Expanded help and AI guide.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.14.0 (Minor Release over the last published version, 0.12.1; it also includes the changes of 0.13.0 and 0.13.1, which were never submitted to the Store)

WHAT'S NEW IN THIS VERSION:
- (0.14.0) "AI Native" release around the OPTIONAL AI assistant and a new, optional integration for other AI coding agents:
  * Tools > "Apply template…" opens the same template gallery as "New document", in "apply" mode, to turn the open document into a Typst Universe template (e.g. IEEE). The result is shown as a proposal that the user reviews before anything is written.
  * The AI assistant can search Typst Universe (public catalog), read package documentation, look at rendered pages (images) and cite only references of the project's .bib. It never writes a package name or version it did not get from the catalog. Installing a package or adding a font ALWAYS needs an explicit confirmation from the user in a dialog.
  * Tools > "MCP server…": the application executable has a headless mode (`--mcp --project <folder>`) that speaks the Model Context Protocol over standard input/output, so AI coding agents that the user runs (Claude Code, Cursor, Codex…) can use the app's Typst compiler. It is read-only, opens NO network port and never writes to the project. To make it launchable from outside the Store package, the manifest declares an app execution alias (`dbv-typst-editor.exe`, uap3 `windows.appExecutionAlias`).
  * When the user turns it on (Preferences > "Share the editor state with MCP agents", OFF by default), a connected agent can read the open tabs, including unsaved text, through a local named pipe protected by a random token; a "Agent connected" badge is shown and can be clicked to cut it off.
  * Local-model robustness (output cap, progress, retry), Sublime Text snippet import, fonts added to the project's fonts/ folder are picked up without a restart, and a larger help and AI guide. Several fixes.
- (0.13.1 and 0.13.0, also new for the Store) The OPTIONAL AI assistant itself: off until the user connects one from Tools > "Connect an AI…" (local server such as Ollama/LM Studio, a cloud provider with the user's own API key, or an installed AI coding agent launched as a child process in the project folder); keys are stored in the Windows Credential Manager, never in files; the first time a project would be sent to a cloud provider the app asks; every proposed change is shown for review. Plus offline Typst documentation, a Problems tab, a CSV/TSV data viewer and File > "New empty .typ…".

CREDENTIALS:
None required. Every feature of the editor works offline without any account. The AI assistant and the MCP server are optional and not needed to test the app; they use the user's own provider or local software, never a service run by us.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application and choose File > New blank project; create it in any folder. main.typ opens with the live preview on the right.
2. Replace its content with:  = Paper title  /  Some text.  Then Tools > "Apply template…": the template gallery opens with a "Typst Universe" tab (it needs Internet the first time). Pick any template and press "Apply … to my document": a review card appears with the differences, the packages that would be downloaded and an Apply button. Do NOT apply; close it. Nothing was written.
3. Tools > "MCP server…": the dialog shows what the MCP server gives an AI agent and the configuration (command and JSON) with this installation's real path, ready to copy. Close it.
4. Optional, from a terminal (the alias is declared in the manifest):  dbv-typst-editor.exe --mcp --project <the project folder>  and send one JSON-RPC line, e.g.  {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}  : the server answers with its capabilities on standard output; no window opens and no port is listened on.
5. Help (?): the help now shows "The four panels" and separate sections for the AI assistant, "Changing a document's format" and the MCP server.
6. Tools > "Connect an AI…" shows what was detected (nothing needs to be connected); no AI panel appears unless an AI is connected.
7. Tools > "Import Sublime snippets…" opens a dialog to pick .sublime-snippet files (any file can be tried; nothing is written without a confirmation).

ADDITIONAL TECHNICAL CONTEXT:
- No new sidecars: still the Typst compiler and the tinymist Language Server. The Typst documentation is a bundled resource (typst-docs.json.gz, 0.3 MB).
- New manifest extension: an app execution alias (`dbv-typst-editor.exe`) pointing at the same executable, used only to start the optional MCP server mode from a terminal or from an AI agent the user runs. It declares no extra capability.
- Network access happens only on explicit user action: connecting a cloud AI (HTTPS to the user's provider), downloading Typst packages (packages.typst.org, as before), the public Typst Universe catalog index (packages.typst.org) when the user opens the gallery or applies a template, and — only if the user confirms a dialog while using a cloud AI — a font from Google Fonts' public repository (raw.githubusercontent.com/google/fonts). The MCP server itself never opens a connection.
- The local channel between the MCP server process and the window is a named pipe (Windows) with a random 256-bit token kept in a user-only file; it is only used when the user has a project open and, for the editor state, only if the user enabled the setting.
- No background telemetry, no advertising, no tracking — consistent with all previous releases.
- The privacy policy (https://davidbuenov.github.io/dbv-typst-editor/privacy.html) describes the optional AI connections (updated 2026-10-02). The 0.14.0 additions do not send data to any server of ours.
```

---

## 3. Checklist de verificación del paquete MSIX

Siguen siendo **DOS sidecars** (ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6) y el recurso `resources/typst-docs.json.gz`. **Nuevo en la 0.14.0:** el manifiesto lleva el alias de ejecución `dbv-typst-editor.exe`.

- [x] Haber ejecutado `npm run vendor:typst` **y** `npm run vendor:tinymist` antes de empaquetar (`src-tauri/binaries/` con los dos `.exe`).
- [x] Comprobar versión del paquete: **`0.14.0.0`** (en el nombre del archivo y en `AppxManifest.xml`). *(verificado el 2026-10-04)*
- [x] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe`, `templates\` **y** `resources\typst-docs.json.gz`. *(verificado: los cuatro, con 53 ficheros en `templates\`)*
- [x] Comprobar tamaño del paquete: del orden de la v0.13.1 (~77,6 MB). Si cae de forma notable (~30 MB), falta un sidecar — **NO SUBIR**. *(**78,68 MB**, verificado el 2026-10-04; la 0.13.1 pesó 77,61 MB)*
- [x] `AppxManifest.xml` contiene `windows.appExecutionAlias` con `Alias="dbv-typst-editor.exe"`, en un único bloque `<Extensions>` junto a la asociación de `.typ`, y es XML válido. *(verificado)*
- [ ] Instalar el `.msixbundle` localmente (certificado de pruebas + `signtool` + `Add-AppxPackage`) y ejecutar la guía de prueba de 2 minutos de la sección 2.
- [ ] **Criterio (c) del spike del MCP, solo posible con el paquete instalado:** desde una terminal AJENA a la app (PowerShell), `dbv-typst-editor.exe --mcp --project <carpeta>` debe quedarse esperando entrada sin abrir ventana, y al pegarle la línea JSON-RPC de `initialize` (sección 2, paso 4) responder por la salida estándar. Si falla, el servidor MCP en Windows pasa a la 0.14.1 (decisión de `ADR-V0140-003`).
- [ ] En la app instalada desde el paquete: Herramientas › «Aplicar plantilla…» abre la galería en modo aplicar; Herramientas › «Servidor MCP…» muestra el alias `dbv-typst-editor.exe` como comando; Ayuda dice «Los cuatro paneles».
- [ ] En Partner Center → Envíos → Paquetes: arrastrar `src-tauri/target/msix/dbv-typst-editor_0.14.0.0.msixbundle`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de «Novedades de esta versión» en español e inglés **y** repetir el copiado de «Descripción» y «Características del producto» (`descripcionStore_es.md` / `descripcionStore_en.md`, actualizados en la 0.14.0).
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2.

## 4. Privacidad: revisar antes de enviar

La 0.14.0 no añade ninguna transmisión de datos del usuario a servidores del proyecto (no los hay). Lo nuevo que toca la red lo hace **a petición del usuario**: el índice público de Typst Universe, paquetes de `packages.typst.org` y, con una IA en la nube y un diálogo de confirmación, una tipografía del repositorio público de Google Fonts. El servidor MCP no abre conexiones.

- [x] La política de privacidad de la web (`docs/privacidad.html` y `docs/privacy.html`) describe la IA opcional (revisada el 2026-10-02).
- [ ] Decidir si la política debe mencionar el índice de Universe y las fuentes de Google Fonts (ver `task.md`); no cambia quién recibe datos del usuario.
- [ ] Revisar en Partner Center las declaraciones de la ficha relacionadas con datos o privacidad, si las hay.

## 5. Descripción de la ficha

Se actualizaron `descripcionStore_es.md` y `descripcionStore_en.md` (descripción, novedades, características y descripción corta). **En Partner Center hay que repetir el copiado de estos campos.**

| Campo de Partner Center | Qué cambió | Límite | Medida |
| --- | --- | --- | --- |
| Novedades de esta versión | Texto de la 0.14.0 (sección 1) | 1.500 | ES 1014 · EN 990 |
| Descripción | Dos viñetas nuevas: «Aplicar plantilla…» y la IA con Typst Universe, páginas renderizadas y servidor MCP | — | — |
| Características del producto | Se funde la 19 y la 20 y entra una nueva con lo de la 0.14.0 | 20 | 20 y 20 |

- [ ] Pegar los campos en español y en inglés en Partner Center → Descripciones de la Store.
- [ ] Capturas de la ficha: ninguna muestra el asistente de IA ni «Aplicar plantilla…». Opcional: añadir capturas de la galería en modo aplicar y del diálogo «Servidor MCP…».
