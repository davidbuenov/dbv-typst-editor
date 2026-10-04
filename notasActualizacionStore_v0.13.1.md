# Notas de actualización v0.13.1 — Microsoft Store

Textos listos para copiar en Partner Center. Store ID `9PCPSVTNJMP0`.

---

## 1. "Novedades de esta versión" / "What's new in this version"

Campo del envío: **Descripciones de la Store → Novedades de esta versión** (límite 1.500 caracteres).

### 🇪🇸 Español

```text
Versión 0.13.1 — Asistente de IA opcional, ahora más claro y fiable con modelos locales:

• Asistente de IA OPCIONAL: conecta una IA local (Ollama, LM Studio), en la nube con tu clave (Anthropic, OpenAI, Gemini, OpenRouter) o tu agente instalado (Claude Code, Gemini CLI, Codex, Copilot). Sin configurar nada, el editor funciona igual que siempre.
• La IA propone cambios, también en varios ficheros; DBV comprueba que compilan antes de enseñártelos y los revisas trozo a trozo, con Deshacer.
• Ves lo que piensa el modelo (bloque plegable), qué está haciendo y a qué velocidad, y te avisa si el modelo es demasiado pequeño o el contexto demasiado corto.
• Al escribir, separa el aspecto del contenido: el estilo va en ficheros de estilo.
• Nuevo «Nuevo .typ vacío…»: crea un documento suelto sin crear un proyecto.
• IA sobre la selección (Ctrl+Mayús+I) y «Explicar y arreglar» en cada error.
• Documentación oficial de Typst sin conexión, panel de Problemas y visor de datos CSV/TSV.
• Con una IA local nada sale de tu equipo; las claves van al almacén de credenciales de Windows.
```

### 🇬🇧 English

```text
Version 0.13.1 — Optional AI assistant, now clearer and more reliable with local models:

• OPTIONAL AI assistant: connect a local AI (Ollama, LM Studio), a cloud one with your key (Anthropic, OpenAI, Gemini, OpenRouter) or your installed agent (Claude Code, Gemini CLI, Codex, Copilot). With nothing configured, the editor works exactly as before.
• The AI proposes changes, across several files too; DBV checks they compile before showing them and you review them hunk by hunk, with Undo.
• You see what the model is thinking (collapsible block), what it is doing and how fast, and you are warned if the model is too small or the context too short.
• When it writes, it separates the look from the content: the style goes in style files.
• New "New empty .typ…": creates a loose document without creating a project.
• AI on the selection (Ctrl+Shift+I) and "Explain and fix" on every error.
• Offline official Typst documentation, a Problems panel and a CSV/TSV data viewer.
• With a local AI nothing leaves your computer; keys go to the Windows Credential Manager.
```

---

## 2. Notas para la certificación (Additional Testing Info)

Campo del envío: **Envíos → Notas para la certificación**.

```text
SUBMISSION NOTES — v0.13.1 (Minor Release over the last published version, 0.12.1; it also includes the changes of 0.13.0, which was never submitted to the Store)

WHAT'S NEW IN THIS VERSION:
- (0.13.1) Improvements to the optional AI assistant after testing it with real local and cloud models: it shows what the model is thinking in a collapsible block, what it is doing and how fast, and warns when a local model is too small or its context too short; reasoning is off by default and switchable per connection; it keeps the look of the document (fonts, margins, colors…) in style files instead of the main document; a loose .typ file can now be created without creating a project (File > "New empty .typ…"), and the AI only sees that file. Several fixes (Gemini 3 tool calls, the model list of the connection form, error messages). No new permissions, sidecars or network behavior.
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
6. Help > "AI assistant (optional)": explains what must be installed for each route (local server, API key, or an installed agent) and links to the full guide.
7. File > "New empty .typ…": pick a name in any folder; an empty loose document opens and nothing else is created in that folder. The live preview shows an empty page.

ADDITIONAL TECHNICAL CONTEXT:
- No new sidecars: still the Typst compiler and the tinymist Language Server. New bundled resource: the Typst documentation (typst-docs.json.gz, 0.3 MB).
- Network access happens only when the user connects a cloud AI provider (HTTPS to that provider) or downloads Typst packages, as before. AI agents are only launched on explicit user action.
- No background telemetry, no advertising, no tracking — consistent with all previous releases.
- The privacy policy (https://davidbuenov.github.io/dbv-typst-editor/privacy.html) was updated on 2026-10-02 to describe the optional AI connections: nothing is sent unless the user connects a cloud AI or an agent, the data goes directly from the user's machine to the provider they chose, and the app has no server of its own.
```

---

## 3. Checklist de verificación del paquete MSIX

Sigue habiendo **DOS sidecars** (ver `dbv-specs-ops/docs/MICROSOFT_STORE.md` §6) y se añade un recurso empaquetado: `resources/typst-docs.json.gz`.

- [x] Haber ejecutado `npm run vendor:typst` **y** `npm run vendor:tinymist` antes de empaquetar (`src-tauri/binaries/` con los dos `.exe`).
- [x] Comprobar versión del paquete: **`0.13.1.0`** (en el nombre del archivo y en `AppxManifest.xml`).
- [x] `Get-ChildItem src-tauri\target\appx\x64` debe contener `typst.exe`, `tinymist.exe`, `templates\` **y** `resources\typst-docs.json.gz`.
- [x] Comprobar tamaño del paquete: del orden de la v0.12.1 (~80 MB). Si cae de forma notable (~30 MB), falta un sidecar — **NO SUBIR**. *(77,61 MB, verificado el 2026-10-04; la 0.13.0 pesó 77,56 MB y la 0.12.1, 76,95 MB. Contenido comprobado: `typst.exe`, `tinymist.exe`, `templates\local` con 53 ficheros y `resources\typst-docs.json.gz`; `AppxManifest.xml` con `Version="0.13.1.0"`.)*
- [ ] Instalar el `.msixbundle` localmente (certificado de pruebas + `signtool` + `Add-AppxPackage`) y ejecutar la guía de prueba de 2 minutos de la sección 2.
- [ ] **Nuevo en esta versión, en la app instalada desde el paquete:** Ayuda › «Documentación de Typst» abre (comprueba que el recurso viaja en el MSIX); en «Conectar una IA», guardar una conexión con una clave de prueba y comprobar que no sale el aviso «solo durante la sesión» (el Administrador de credenciales funciona desde el paquete); si tienes Ollama o Claude Code, una pregunta de prueba.
- [ ] **Nuevo en la 0.13.1, en la app instalada desde el paquete:** Archivo › «Nuevo .typ vacío…» (también Ctrl+Alt+N): elegir un nombre en una carpeta cualquiera abre un documento suelto vacío y no crea nada más en esa carpeta; en «Conectar una IA», tras «Probar conexión» el modelo es un desplegable con todos los de la lista y el interruptor «Razonamiento» sale desactivado; si tienes Ollama, un modelo pequeño muestra el aviso de tamaño.
- [ ] En Partner Center → Envíos → Paquetes: arrastrar `src-tauri/target/msix/dbv-typst-editor_0.13.1.0.msixbundle`.
- [ ] En Partner Center → Descripciones de la Store: pegar los textos de «Novedades de esta versión» en español e inglés.
- [ ] En Partner Center → Notas para la certificación: pegar las Submission Notes de la sección 2.

## 4. Privacidad: revisar antes de enviar (nuevo en la 0.13.0, que la Store recibe por primera vez en la 0.13.1)

Hasta la 0.12.1 la app no enviaba ningún dato del usuario a terceros. Desde la 0.13.0 **puede hacerlo, solo si el usuario conecta una IA en la nube o un agente**: el contenido del proyecto que la conversación necesite va al proveedor que el propio usuario elige, con su clave o su cuenta. DBV no tiene servidor propio ni telemetría.

- [x] La política de privacidad de la web (`docs/privacidad.html` y `docs/privacy.html`) se actualizó el 2026-10-02 para decir esto con claridad y **fue revisada y dada por buena por el usuario**. Falta comprobar que la URL de política de privacidad que figura en la ficha de Partner Center es esa.
- [x] La descripción de la ficha (`descripcionStore_es.md` y `descripcionStore_en.md`) se revisó para mencionar la IA opcional: ver la sección 5.
- [ ] Revisar en Partner Center las declaraciones de la ficha relacionadas con datos o privacidad, si las hay, para que sean coherentes.

## 5. Descripción de la ficha: revisión para la IA opcional

La descripción de la ficha seguía diciendo «100% local» sin matiz, su campo «Novedades» aún hablaba de la v0.4/0.5 y la lista de características ya usaba los 20 huecos permitidos. Se revisaron los dos ficheros fuente (`descripcionStore_es.md` y `descripcionStore_en.md`); **en Partner Center hay que repetir el copiado de estos campos**, no solo el de «Novedades»:

| Campo de Partner Center | Qué cambió | Límite | Medida |
| --- | --- | --- | --- |
| Descripción | Frase inicial: «100% local **por defecto** … con un asistente de IA opcional que eliges tú»; cinco viñetas nuevas (IA opcional con sus tres vías, la IA propone y la app comprueba que compila, IA sobre la selección y «Explicar y arreglar», documentación sin conexión, Problemas y visor CSV/TSV); el párrafo final nombra la IA entre las conexiones y explica qué sale del equipo y que las claves van al Administrador de credenciales | — | — |
| Novedades de esta versión | Texto de la 0.13.1 (el mismo de la sección 1; cubre también lo de la 0.13.0, que no llegó a la Store) en lugar del de la v0.4/0.5 | 1.500 | ES 1.082 · EN 1.067 |
| Características del producto | Se fusionan cuatro pares de líneas parecidas (tinymist + Typstyle, Git + conflictos, citas + imágenes, sincronización + chincheta) y el esquema pasa a «Esquema y Problemas»; entran cuatro líneas de IA, documentación y datos | 20 | 20 y 20 |
| Descripción corta | Pasa de «100% local» a «local por defecto» y menciona la IA opcional; se retira la mención a los temas por espacio | 270 recomendado | ES 251 · EN 255 |

- [ ] Pegar los cuatro campos en español y en inglés en Partner Center → Descripciones de la Store.
- [ ] Capturas de la ficha: ninguna muestra el asistente de IA. Opcional: añadir una del panel de la IA para que lo prometido en la descripción se vea.
