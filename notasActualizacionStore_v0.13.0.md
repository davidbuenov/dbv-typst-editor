# Notas de actualización v0.13.0 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.13.0 — Asistente de IA opcional, documentación sin conexión y más:

• Asistente de IA OPCIONAL: conecta una IA local (Ollama, LM Studio), en la nube con tu clave (Anthropic, OpenAI, Gemini, OpenRouter) o tu agente instalado (Claude Code, Gemini CLI, Codex, Copilot). Sin configurar nada, el editor funciona igual que siempre.
• La IA propone cambios, también en varios ficheros; DBV comprueba que compilan antes de enseñártelos y los revisas trozo a trozo antes de aplicar, con Deshacer.
• IA sobre la selección (Ctrl+Mayús+I): mejorar, corregir, traducir, convertir a tabla, explicar…
• «Explicar y arreglar» en cada error de compilación.
• Documentación oficial de Typst sin conexión, con buscador también en español.
• Nuevo panel de Problemas con la lista completa de errores y avisos.
• Visor de datos CSV/TSV con «Insertar como tabla».
• Con una IA local nada sale de tu equipo; las claves se guardan en el almacén de credenciales de Windows.
```

### 🇬🇧 English

```text
Version 0.13.0 — Optional AI assistant, offline documentation and more:

• OPTIONAL AI assistant: connect a local AI (Ollama, LM Studio), a cloud one with your key (Anthropic, OpenAI, Gemini, OpenRouter) or your installed agent (Claude Code, Gemini CLI, Codex, Copilot). With nothing configured, the editor works exactly as before.
• The AI proposes changes, across several files too; DBV checks they compile before showing them and you review them hunk by hunk before applying, with Undo.
• AI on the selection (Ctrl+Shift+I): improve, fix, translate, convert to table, explain…
• "Explain and fix" on every compile error.
• Offline official Typst documentation, searchable.
• New Problems panel with the full list of errors and warnings.
• CSV/TSV data viewer with "Insert as table".
• With a local AI nothing leaves your computer; keys are stored in the Windows Credential Manager.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.13.0 (Minor Release)

WHAT'S NEW IN THIS VERSION:
- An OPTIONAL AI assistant. It is off until the user connects one from Tools > "Connect an AI…": a local model server (Ollama, LM Studio), a cloud provider with the user's own API key (Anthropic, OpenAI, Google Gemini, OpenRouter) or an AI coding agent the user already has installed (Claude Code, Gemini CLI, Codex, Copilot CLI), launched as a child process in the project folder. API keys are stored in the Windows Credential Manager, never in files. The first time a project would be sent to a cloud provider, the app asks for confirmation. Every change proposed by the AI is shown for review before anything is written.
- Offline Typst documentation (Help > "Typst documentation"), a Problems tab in the sidebar and a CSV/TSV data viewer (Tools > "Data viewer").

CREDENTIALS:
None required. Every feature of the editor works offline without any account. The AI assistant is optional and is not needed to test the app; it uses the user's own provider or local software, never a service run by us.

QUICK 2-MINUTE TESTING GUIDE:
1. Launch the application and choose File > New blank project; create it in any folder. main.typ opens with the live preview on the right.
2. Type on a new line:  #tabla(columns: 2)[A][B]  — the red badge on the document bar shows 1 error. Click it: the "Problems" tab lists "unknown variable: tabla" with its line; click the entry to jump there.
3. Click "View documentation" on that problem (or open Help > "Typst documentation" and search "table"): the offline documentation opens on the table page.
4. Tools > "Data viewer (CSV/TSV)…": pick any .csv file. It is shown as a sortable, filterable table; "Copy as Typst table" copies Typst code.
5. Tools > "Connect an AI…": the dialog shows what was detected on the computer (nothing needs to be connected). Close it: no AI panel or button appears unless an AI is connected.

ADDITIONAL TECHNICAL CONTEXT:
- No new sidecars: still the Typst compiler and the tinymist Language Server. New bundled resource: the Typst documentation (typst-docs.json.gz, 0.3 MB).
- Network access happens only when the user connects a cloud AI provider (HTTPS to that provider) or downloads Typst packages, as before. AI agents are only launched on explicit user action.
- No background telemetry, no advertising, no tracking — consistent with all previous releases.
```

---

## 3. Checklist de verificación del paquete MSIX

Sigue habiendo **DOS sidecars** (ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6) y se añade un recurso empaquetado: `resources/typst-docs.json.gz`.

- [x] Haber ejecutado `npm run vendor:typst` **y** `npm run vendor:tinymist` antes de empaquetar (`src-tauri/binaries/` con los dos `.exe`).
- [x] Comprobar versión del paquete: **`0.13.0.0`** (en el nombre del archivo y en `AppxManifest.xml`).
- [x] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe`, `templates\` **y** `resources\typst-docs.json.gz`.
- [x] Comprobar tamaño del paquete: del orden de la v0.12.1 (~80 MB). Si cae de forma notable (~30 MB), falta un sidecar — **NO SUBIR**. *(81,3 MB, verificado el 2026-10-02.)*
- [ ] Instalar el `.msixbundle` localmente (certificado de pruebas + `signtool` + `Add-AppxPackage`) y ejecutar la guía de prueba de 2 minutos de la sección 2.
- [ ] **Nuevo en esta versión, en la app instalada desde el paquete:** Ayuda › «Documentación de Typst» abre (comprueba que el recurso viaja en el MSIX); en «Conectar una IA», guardar una conexión con una clave de prueba y comprobar que no sale el aviso «solo durante la sesión» (el Administrador de credenciales funciona desde el paquete); si tienes Ollama o Claude Code, una pregunta de prueba.
- [ ] En Partner Center → Envíos → Paquetes: arrastrar `src-tauri/target/msix/dbv-typst-editor_0.13.0.0.msixbundle`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de «Novedades de esta versión» en español e inglés.
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2.

## 4. Privacidad: revisar antes de enviar (nuevo en la 0.13.0)

Hasta la 0.12.1 la app no enviaba ningún dato del usuario a terceros. Desde la 0.13.0 **puede hacerlo, solo si el usuario conecta una IA en la nube o un agente**: el contenido del proyecto que la conversación necesite va al proveedor que el propio usuario elige, con su clave o su cuenta. DBV no tiene servidor propio ni telemetría.

- [ ] Revisar la política de privacidad enlazada en la ficha (y la de la web) para decir esto con claridad.
- [ ] Revisar en Partner Center las declaraciones de la ficha relacionadas con datos o privacidad, si las hay, para que sean coherentes.
