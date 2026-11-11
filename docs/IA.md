# 🤖 Usar una IA con DBV Typst Editor

> 🌐 **Español** · [English](./IA.en.md) · [← Volver al README](../README.md)

El asistente de IA de **DBV Typst Editor** es **opcional**. Sin configurar nada, la aplicación funciona exactamente igual, de forma local. Esta guía explica **qué necesitas tener en tu ordenador** según la IA que quieras usar.

## Lo esencial en una tabla

| Quiero usar… | Qué necesito instalar o tener | ¿Sale algo de mi equipo? | ¿Cuesta dinero? |
| --- | --- | --- | --- |
| **Una IA local** (Ollama, LM Studio, llama.cpp…) | El programa servidor y al menos un modelo descargado | No | No (gasta tu CPU/GPU y disco) |
| **Claude, ChatGPT, Gemini u OpenRouter con clave de API** | Una clave de API de ese proveedor | Sí, al proveedor | Sí, por uso, según la tarifa del proveedor |
| **Mi suscripción** (Claude Pro/Max, ChatGPT Plus, Gemini / Google One, Copilot) | El **agente** de ese servicio instalado y con la sesión iniciada: Claude Code, Codex, Gemini CLI, Google Antigravity o GitHub Copilot CLI | Sí, al servicio del agente | Lo cubre tu suscripción |

> ⚠️ **Una suscripción no es una clave de API.** Pagar Claude Pro, ChatGPT Plus o Gemini no te da una clave de API (se contratan por separado). Con una suscripción, la vía es el **agente instalado** (tercera fila).

Todo se configura en la pantalla **Conectar una IA**, que se abre con el botón de IA de la aplicación. Al abrirla, DBV Typst Editor **detecta lo que ya tienes** (Ollama, LM Studio y los agentes) y lo marca con ✓; lo que no encuentra aparece con un botón **Cómo instalarlo**. Esta detección solo ocurre al abrir esa pantalla, nunca al arrancar la aplicación.

La pantalla tiene tres bloques, uno por cada fila de la tabla: **IAs Locales**, **IAs por Suscripción (Agentes CLI)** e **IAs en la nube con clave de API**.

---

## 1. Una IA local (nada sale de tu equipo)

Es la opción más privada: tus documentos no abandonan tu ordenador y no hay coste por uso. A cambio, la calidad depende del tamaño del modelo y de tu hardware.

### Ollama

1. Instala [Ollama](https://ollama.com/download).
2. Descarga un modelo, por ejemplo: `ollama pull qwen2.5:3b` (o `llama3`).
3. Comprueba qué tienes instalado con `ollama list`.
4. Abre **Conectar una IA**. Si Ollama está en marcha, aparece con ✓ y un botón **Usar**. Elige el modelo de la lista, pulsa **Probar conexión** y **Guardar**.

Ollama escucha en `http://localhost:11434`. La aplicación habla con él por su **API nativa** (`/api/chat`) y le indica ella misma el tamaño de contexto, porque Ollama usa por defecto uno pequeño (2 048–4 096 tokens) y recorta en silencio lo que no cabe.

### LM Studio

1. Instala [LM Studio](https://lmstudio.ai), descarga un modelo y **arranca su servidor local** (pestaña *Developer / Local Server*).
2. Escucha en `http://localhost:1234`; la aplicación lo detecta igual que a Ollama.

### Tu propio servidor compatible con OpenAI (llama.cpp, vLLM, Jan…)

Cualquier servidor que ofrezca la API de OpenAI sirve. El caso típico es `llama-server` de [llama.cpp](https://github.com/ggml-org/llama.cpp) con un modelo `.gguf` que tú mismo has descargado. **Este servidor no se detecta solo: hay que añadirlo a mano.**

1. **Conectar una IA → Añadir una IA en la nube (clave de API)…** *(el botón se llama así, pero abre un formulario con todos los proveedores)*.
2. En **Proveedor**, elige **Servidor compatible con OpenAI (local o propio)**.
   - ⚠️ **No elijas «Ollama»** para un servidor que no es Ollama: ese modo usa un protocolo distinto y la aplicación no entenderá la respuesta. Y al **editar** una conexión el proveedor no se puede cambiar: hay que crear una nueva.
3. Rellena el formulario:

   | Campo | Valor |
   | --- | --- |
   | Nombre | el que quieras |
   | Dirección | `http://127.0.0.1:8080/v1` (puerto de tu servidor, **terminada en `/v1`**) |
   | Clave | vacía, salvo que arrancaras el servidor con `--api-key` |
   | Modelo | el `id` que devuelve `curl http://127.0.0.1:8080/v1/models` |
   | Contexto (tokens) | el `n_ctx` del servidor dividido entre sus slots (ver abajo) |
   | Herramientas | *Detectar* |

4. **Probar conexión** y **Guardar**. Marca la conexión como activa y elígela en el selector del panel.

Los datos del formulario (modelo, contexto, herramientas) se consultan con unos comandos: ver [Averiguar los datos del formulario](#averiguar-los-datos-del-formulario).

**Tres trampas habituales con llama.cpp:**

- **El contexto no es `n_ctx_train`.** `/v1/models` muestra `n_ctx_train`, el máximo con el que se entrenó el modelo, no el que tiene tu servidor. El valor real es el flag `-c` con el que arrancaste.
- **Los *slots* reparten el contexto.** Con varios slots (`-np`), el contexto se divide entre ellos; con `-np 4` y `-c 32768`, cada petición dispone de 8 192. Para dárselo entero a una conversación: `-np 1`.
- **Los modelos que «piensan» pueden parecer mudos.** Algunos modelos escriben primero su razonamiento en un campo aparte (`reasoning_content`) y dejan la respuesta (`content`) vacía hasta terminar. La aplicación muestra `content`, así que ves una respuesta vacía mientras el modelo consume cientos o miles de tokens. Arranca el servidor con `--reasoning-budget 0` para desactivar el razonamiento.

Ejemplo de arranque razonable:

```bash
llama-server -m modelo.gguf -c 32768 -np 1 --reasoning-budget 0 --port 8080
```

### Qué esperar de un modelo local

- **Herramientas.** Con un modelo que las admite, la IA consulta por su cuenta los documentos de la carpeta y propone cambios que tú revisas antes de aplicarlos. Sin herramientas, el asistente sigue sirviendo para conversar y para trabajar sobre el contexto que se le envía, pero hace menos por sí mismo. El campo *Herramientas* del formulario las detecta; si falla la detección, puedes forzarlas a *Sí* o *No*.
- **Tamaño.** Los modelos de 2–3 mil millones de parámetros (que ocupan unos 2–3 GB) responden rápido en un portátil, pero se quedan cortos en propuestas largas o complejas. Si las respuestas salen flojas, prueba antes con un modelo mayor que tocar la configuración.
- **Contexto.** Un contexto de 4 096 tokens es el mínimo y se queda corto con documentos largos o imágenes. 8 192 es cómodo para trabajar; 32 768, holgado.
- **Memoria.** Un modelo más grande o un contexto mayor necesitan más RAM o VRAM. Empieza pequeño y sube.

---

## Averiguar los datos del formulario

Para conectar una IA local el formulario pide tres cosas: **modelo**, **contexto** y si admite **herramientas**. Se consultan en tu propio equipo con los comandos de abajo, y el resultado es lo que hay que escribir en cada campo.

> En **PowerShell** usa `curl.exe` (con la extensión): `curl` a secas es un alias de otro comando y no devuelve lo mismo. En CMD, macOS y Linux vale `curl`.

### Ollama (puerto 11434)

| Quiero saber… | Comando | Campo del formulario |
| --- | --- | --- |
| Qué modelos tengo descargados | `ollama list` | **Modelo**: la columna `NAME`, completa (por ejemplo `qwen2.5:3b`; `llama3:latest` también vale como `llama3`) |
| Lo mismo, por la API | `curl http://localhost:11434/api/tags` | — |
| Qué modelos están cargados en memoria ahora | `ollama ps` | — |
| Detalles de un modelo (arquitectura, parámetros, contexto máximo, cuantización) | `ollama show qwen2.5:3b` | **Contexto**: el máximo que muestra es el del modelo; elige un valor igual o menor que quepa en tu memoria |
| Descargar un modelo nuevo | `ollama pull qwen2.5:3b` | — |

La aplicación **fija el contexto por su cuenta** en Ollama, así que el campo *Contexto* es el que tú decides, no el que tenga Ollama configurado. Si lo dejas vacío, usa un valor prudente (4 096).

### LM Studio (puerto 1234)

Con su servidor local arrancado:

```bash
curl http://localhost:1234/v1/models      # el campo "id" de cada modelo → campo Modelo
lms ls                                    # modelos descargados (si tienes instalada su herramienta `lms`)
```

El contexto se fija en LM Studio al cargar el modelo (ajuste *Context Length*); copia ese número en el formulario.

### Servidor propio con llama.cpp (`llama-server`)

Con el servidor arrancado (el puerto por defecto es `8080`):

```bash
curl http://127.0.0.1:8080/v1/models      # "data" → "id": nombre del modelo → campo Modelo
curl http://127.0.0.1:8080/props          # contexto, slots y capacidades
```

Y en PowerShell, ya masticado:

```powershell
# Nombre del modelo → campo Modelo
(curl.exe -s http://127.0.0.1:8080/v1/models | ConvertFrom-Json).data.id

# Contexto, slots, herramientas e imágenes
$p = curl.exe -s http://127.0.0.1:8080/props | ConvertFrom-Json
"n_ctx=$($p.default_generation_settings.n_ctx)  slots=$($p.total_slots)  tools=$($p.chat_template_caps.supports_tools)  vision=$($p.modalities.vision)"
```

| Dato que devuelve | Qué significa | Campo del formulario |
| --- | --- | --- |
| `id` en `/v1/models` | Nombre del modelo (suele ser el fichero `.gguf`) | **Modelo** |
| `n_ctx` en `/props` | Contexto **total** del servidor (el flag `-c`) | **Contexto (tokens)**, dividido entre `total_slots` |
| `total_slots` en `/props` | Slots en paralelo: cada petición recibe `n_ctx / total_slots` (con 4 slots y 32 768, 8 192). Con `-np 1`, todo el contexto | Divide `n_ctx` entre este número (ver «Tres trampas habituales», arriba) |
| `supports_tools` en `/props` | Si el modelo admite herramientas | **Herramientas**: déjalo en *Detectar*; fuérzalo a *No* si ves que falla |
| `vision` en `/props` | Si el servidor lleva visión (`--mmproj`) | — |
| `n_ctx_train` en `/v1/models` | Contexto con el que se **entrenó** el modelo: **no es el del servidor** | No lo uses |

### El botón «Probar conexión»

Es la comprobación definitiva: si el servidor responde y la dirección es correcta, devuelve la lista real de modelos. Para Ollama y LM Studio, esa lista sale en el desplegable del campo **Modelo**; para un servidor propio, comprueba que el nombre que escribes es uno de los que devuelve `/v1/models`.

---

## 2. En la nube, con tu clave de API

Para usar un modelo de un proveedor con **clave de API**:

| Proveedor | Dónde se consigue la clave | Dirección (ya preconfigurada) |
| --- | --- | --- |
| Anthropic (Claude) | consola de Anthropic | `https://api.anthropic.com/v1` |
| OpenAI (ChatGPT) | plataforma de OpenAI | `https://api.openai.com/v1` |
| Google (Gemini) | Google AI Studio | `https://generativelanguage.googleapis.com/v1beta/openai` |
| OpenRouter | openrouter.ai | `https://openrouter.ai/api/v1` |

**Conectar una IA → Añadir una IA en la nube (clave de API)…** → elige el proveedor → pega la clave → **Probar conexión** → elige el modelo de la lista que devuelve el propio proveedor → **Guardar**.

- **La clave** se guarda en el **almacén de credenciales del sistema** (Administrador de credenciales de Windows, Llavero de macOS, Secret Service en Linux), nunca en un fichero ni en `localStorage`. Al editar una conexión el campo de la clave queda vacío: dejarlo así conserva la guardada. Eliminar la conexión borra también la clave.
- **Privacidad:** para responder, se envía al proveedor el contexto (documento abierto, selección y lo que adjuntes). **La primera vez por proyecto y proveedor, la aplicación te pregunta** antes de enviar nada. Puedes quitar cualquier elemento del contexto desde el propio panel.
- **Coste:** lo factura el proveedor por uso.

---

## 3. Con tu suscripción: agentes instalados

Si pagas **Claude Pro/Max, ChatGPT Plus, Gemini / Google One o GitHub Copilot**, no necesitas clave de API: DBV Typst Editor puede hablar con el **agente de línea de comandos** de ese servicio, que usa tu cuenta. La aplicación **no ve ni guarda tus credenciales**: el inicio de sesión lo hace el propio agente. La conexión usa el protocolo abierto [ACP (Agent Client Protocol)](https://agentclientprotocol.com).

| Agente | Qué debe estar instalado | Cómo lo lanza la aplicación |
| --- | --- | --- |
| **Claude Code** | Claude Code y **Node.js** (incluye `npx`) | `npx -y @agentclientprotocol/claude-agent-acp` |
| **Codex** (OpenAI) | Codex y **Node.js** (incluye `npx`) | `npx -y @agentclientprotocol/codex-acp` |
| **Gemini CLI** | Gemini CLI | `gemini --acp` |
| **Google Antigravity** | Antigravity CLI (`agy`) **y su servidor ACP** (`agy_acp_server`, se instala aparte: [ver abajo](#google-antigravity-instalar-su-servidor-acp)) | `agy_acp_server` |
| **GitHub Copilot CLI** | Copilot CLI (**no basta** el comando `copilot` que trae VS Code: [ver abajo](#github-copilot-el-comando-copilot-de-vs-code-no-es-la-cli)) | `copilot --acp` |

Enlaces de instalación: [Claude Code](https://docs.anthropic.com/en/docs/claude-code/setup) · [Codex](https://github.com/openai/codex) · [Gemini CLI](https://github.com/google-gemini/gemini-cli) · [Antigravity CLI](https://antigravity.google/product/antigravity-cli) · [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli) · [Node.js](https://nodejs.org).

**Pasos:**

1. Instala el agente (y Node.js si lo necesita) para que quede en el `PATH` de tu sistema.
2. **Ábrelo una vez en una terminal** e inicia sesión con tu cuenta. La aplicación no puede iniciar sesión por ti.
3. Abre **Conectar una IA**. El agente aparece en **IAs por Suscripción** con ✓ *instalado* y un botón **Conectar**.
4. La primera vez puede tardar: para Claude Code y Codex se descarga su adaptador con `npx`.
5. Si el agente pide **iniciar sesión** al conectarse (Antigravity y Codex pueden pedirlo la primera vez), la aplicación se lo solicita con el método habitual del agente (por ejemplo, *Log in with Google* o *Login with ChatGPT*): si se abre el navegador, complétalo allí. La sesión la guarda el propio agente.
6. Opcional: con el agente conectado, el botón **⚙️** te deja elegir **modelo** y **nivel de razonamiento**. La lista se pide al propio agente la primera vez que abres la pantalla; **🔄** la vuelve a pedir. Junto al nombre del agente verás un resumen del modelo y el nivel elegidos.

### GitHub Copilot: el comando `copilot` de VS Code no es la CLI

VS Code con Copilot pone en el `PATH` un comando `copilot` que **solo es un lanzador**: ejecuta la CLI de Copilot si está instalada y, si no, avisa *«GitHub Copilot CLI was not found»*. La aplicación lo sabe y, si detrás no hay CLI, muestra Copilot como *no instalado*. Instala la CLI de verdad con cualquiera de estas vías ([guía oficial](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli)):

| Sistema | Orden |
| --- | --- |
| Windows | `winget install GitHub.Copilot` |
| macOS y Linux | `brew install --cask copilot-cli` |
| Cualquiera (Node.js 22 o posterior) | `npm install -g @github/copilot` |

Después ábrela una vez con `copilot` en una terminal, inicia sesión con tu cuenta de GitHub y vuelve a abrir **Conectar una IA**.

### Google Antigravity: instalar su servidor ACP

La CLI de Antigravity (`agy`) **no habla ACP por sí sola**: lo hace un programa aparte, **`agy_acp_server`**, que Google publica en el [registro ACP](https://github.com/agentclientprotocol/registry/blob/main/antigravity-acp/agent.json). Si solo tienes `agy`, la aplicación muestra Antigravity como *instalado, pero sin su servidor ACP* y no se puede conectar.

1. **Instala [Antigravity CLI](https://antigravity.google/product/antigravity-cli)**, ábrelo una vez con `agy` en una terminal e inicia sesión con tu cuenta de Google.
2. **Descarga el servidor ACP** para tu sistema (versión 1.4.4; la más reciente siempre está en el [registro](https://github.com/agentclientprotocol/registry/blob/main/antigravity-acp/agent.json)):

   | Sistema | Descarga |
   | --- | --- |
   | Windows x64 | [agy-acp-server-1.4.4-windows-x86_64.zip](https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.4.4-windows-x86_64.zip) |
   | Windows ARM | [agy-acp-server-1.4.4-windows-arm64.zip](https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.4.4-windows-arm64.zip) |
   | macOS Apple Silicon | [agy-acp-server-1.4.4-darwin-arm64.zip](https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-1.4.4-darwin-arm64.zip) |
   | macOS Intel | [agy-acp-server-1.4.4-darwin-x86_64.zip](https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-1.4.4-darwin-x86_64.zip) |
   | Linux x64 | [agy-acp-server-1.4.4-linux-x86_64.zip](https://dl.google.com/agy-extensions/releases/linux/agy-acp-server-1.4.4-linux-x86_64.zip) |
   | Linux ARM | [agy-acp-server-1.4.4-linux-arm64.zip](https://dl.google.com/agy-extensions/releases/linux/agy-acp-server-1.4.4-linux-arm64.zip) |

3. **Descomprime todo el zip** (trae más de un fichero y deben quedar juntos) en esta carpeta, donde la aplicación lo busca:

   | Sistema | Carpeta |
   | --- | --- |
   | Windows | `%LOCALAPPDATA%\agy\acp-server` |
   | macOS y Linux | `~/.local/share/agy-acp-server` |

   En **Windows**, desde PowerShell (Windows x64; para ARM cambia `x86_64` por `arm64`):

   ```powershell
   $zip = "$env:TEMP\agy-acp-server.zip"
   Invoke-WebRequest https://dl.google.com/agy-extensions/releases/windows/agy-acp-server-1.4.4-windows-x86_64.zip -OutFile $zip
   Expand-Archive $zip -DestinationPath "$env:LOCALAPPDATA\agy\acp-server" -Force
   ```

   En **macOS o Linux** (cambia el nombre del zip por el de tu sistema):

   ```bash
   mkdir -p ~/.local/share/agy-acp-server && cd ~/.local/share/agy-acp-server
   curl -LO https://dl.google.com/agy-extensions/releases/macos/agy-acp-server-1.4.4-darwin-arm64.zip
   unzip -o agy-acp-server-*.zip && chmod +x agy_acp_server.par
   ```

4. Vuelve a abrir **Conectar una IA**: Antigravity aparece con ✓ *instalado* y el botón **Conectar**.
5. La primera vez que le escribas, el servidor pide **iniciar sesión** y la aplicación se lo solicita con tu cuenta de Google (*Log in with Google*): si se abre el navegador, complétalo allí.

> Si prefieres otra carpeta, vale cualquiera que esté en el `PATH`. Los adaptadores de terceros que «envuelven» `agy` no se admiten: usan un modo de `agy` sin documentar y Google no ha aclarado si sus condiciones lo permiten.

**Cómo funciona:**

- La aplicación lanza el agente **con la carpeta del documento como directorio de trabajo**; se cierra al cerrar el documento o la aplicación.
- **Permisos:** cada vez que el agente pide permiso para algo (ejecutar una orden, editar, leer), la aplicación te lo muestra con lo que pide. Puedes **Permitir una vez**, **Permitir siempre en esta conversación** o **Denegar**. Nada se aprueba solo, y lo que quede fuera de la carpeta se deniega.
- **Seguridad de tus ficheros:** antes de cada turno, la aplicación guarda un **punto de restauración** de los ficheros de texto de la carpeta. Lo que el agente cambie directamente en disco aparece al terminar bajo el título **«El agente cambió N documentos en disco»**, con sus diferencias y **Deshacer** por fichero o en bloque.

---

## Privacidad de un vistazo

| Vía | Qué sale de tu equipo |
| --- | --- |
| IA local | Nada. La conversación no abandona tu ordenador. |
| API en la nube | El contexto que se envía, al proveedor. Se pregunta la primera vez por proyecto. |
| Agente con suscripción | Lo que el agente envíe a su servicio. La aplicación no controla su red; los permisos sí pasan por ella. |

Las herramientas de los modelos directos (local y API) **no acceden a la red ni ejecutan programas**: solo leen la carpeta y proponen cambios que tú revisas trozo a trozo antes de aplicarlos, con **Deshacer**.

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| Escribo y **no responde nada** (servidor propio) | Proveedor en *Ollama* en lugar de *compatible con OpenAI* | Crea una conexión nueva con el proveedor correcto |
| Respuesta vacía y muchos tokens «recibidos» | El modelo razona y no llega a escribir `content` | Arranca el servidor con `--reasoning-budget 0` |
| «Servidor local apagado» | Ollama, LM Studio o tu servidor no están en marcha | Arráncalo y vuelve a **Probar conexión** |
| Error de dirección o 404 con un servidor propio | Falta `/v1` al final de la dirección | `http://127.0.0.1:PUERTO/v1` |
| Clave no válida | Clave mal pegada o de otro proveedor | Vuelve a pegarla; una suscripción no sirve como clave |
| Un agente no aparece o no conecta | No está en el `PATH`, falta Node.js o no has iniciado sesión | Instálalo, ábrelo una vez en una terminal y abre de nuevo **Conectar una IA** |
| El agente dice que necesita Node.js | Claude Code y Codex usan `npx` | Instala [Node.js](https://nodejs.org) |
| Copilot aparece *no instalado* aunque `copilot` existe, o «GitHub Copilot CLI was not found» | Solo está el lanzador `copilot` de VS Code, sin la CLI | Instala la CLI: [instrucciones](#github-copilot-el-comando-copilot-de-vs-code-no-es-la-cli) |
| Antigravity aparece *sin su servidor ACP*, o «Antigravity necesita su servidor ACP» | Solo está instalada la CLI `agy` | Instala `agy_acp_server`: [instrucciones](#google-antigravity-instalar-su-servidor-acp) |
| Codex responde «Internal error» | Una versión antigua de la aplicación, con el adaptador `@zed-industries/codex-acp`, que no entiende los modelos actuales | Actualiza la aplicación: la versión actual usa `@agentclientprotocol/codex-acp` |
| El modelo olvida el principio del documento | Contexto demasiado pequeño | Sube el contexto del servidor y el campo **Contexto (tokens)** |

<!-- dbv-ia:fin-guia-comun · Todo lo anterior sale de dbv-specs-ops/docs/templates/IA.template.md (no lo edites aquí: cambia la plantilla y sincroniza con scripts/sync-ai.mjs). Lo que pongas debajo es propio de esta aplicación y se conserva. -->

---

## 4. Qué puede hacer la IA por tu documento

Con un modelo que admite **herramientas** (los de la nube y muchos locales; el campo *Herramientas* de la conexión lo detecta), la IA no se limita a contestar: **trabaja sobre tu proyecto**. Todo lo que sigue lo hace ella sola, sin escribir nada todavía; lo que quiere cambiar te llega como una **propuesta que revisas**.

| Puede… | Cómo lo hace | Límite |
| --- | --- | --- |
| **Leer y buscar** en los ficheros del proyecto | Por sus herramientas, solo dentro de la carpeta del proyecto | Un `.typ` suelto: solo ve ese fichero |
| **Consultar la documentación de Typst** | La de la versión exacta que compila DBV, sin conexión | — |
| **Comprobar su propuesta** | La compila en memoria y te dice los errores nuevos y los corregidos | Un paquete sin instalar se marca como «comprobación incompleta», no como error |
| **Buscar plantillas y paquetes** en Typst Universe | Del catálogo real, con una sola versión por paquete (la última compatible con el compilador) | Nunca escribe un nombre o una versión de memoria |
| **Leer cómo se usa un paquete** | README, manifiesto y función de plantilla del paquete | Con una IA local, solo de los ya instalados |
| **Citar referencias** | Solo claves que existen en tu `.bib`; estilos de cita de los que trae Typst | Un documento suelto no tiene bibliografía de la carpeta |
| **Ver las páginas** | Renderiza hasta 3 páginas y las recibe como imágenes | Solo con un modelo que admite imágenes |
| **Ofrecer una tipografía** que falta | Te enseña licencia y tamaño; solo se copia a `fonts/` si pulsas **Añadir al proyecto** | Solo con una IA en la nube; se puede deshacer |

**Medido:** con el catálogo real, ni `qwen3:8b` ni Gemini 3.8 Flash inventaron un paquete o una versión en 10 ejecuciones. Pero un modelo local pequeño **no suele terminar** estas tareas (0 de 5 con `qwen3:8b`; 3 de 5 con Gemini): ver [`testfiles/ai-evals/README.md`](../testfiles/ai-evals/README.md).

**Por qué importa que «no invente»:** las versiones de los paquetes cambian y una antigua puede no compilar con tu compilador. Por eso la IA solo escribe los identificadores `@preview/nombre:versión` que le devolvió la búsqueda. Si necesita un paquete que **no está instalado**, lo pone en su propuesta y **tú decides** en la revisión si se descarga («Paquetes que se descargarán»: licencia, ficha y un botón; no se descarga nada sola).

**Qué hace cada vía con la red:**

| | IA local | IA en la nube | Agente (suscripción) |
| --- | --- | --- | --- |
| Catálogo de Universe | Solo si ya lo descargaste tú (abriendo la galería) | Lo descarga DBV una vez y lo dice en el panel | El agente usa el servidor MCP de DBV (sección 6) |
| Instalar un paquete | Nunca por sí sola | Siempre con tu confirmación | Siempre con tu confirmación (`install_package`) |
| Añadir una fuente | No | Siempre con tu confirmación | — |

---

## 5. Cambiar el formato de un documento: aplicar una plantilla

Para pasar un documento que ya tienes a un formato nuevo (IEEE, Springer, una tesis…) sin copiar y pegar a mano hay **dos caminos al mismo resultado**:

### Con DBV, sin IA

**Herramientas → Aplicar plantilla…** *(funciona sin ninguna IA conectada)*.

1. Abre el documento principal del proyecto.
2. Elige **Herramientas → Aplicar plantilla…**. Se abre **la misma galería que «Nuevo documento»**, con vista previa maquetada de cada plantilla: la pestaña *Typst Universe* (revisadas), *Buscar* (todo el catálogo) y la dirección libre (`@preview/charged-ieee:0.1.4`). No hay pestaña de plantillas locales: esas sirven para crear documentos nuevos.
3. Elige una y pulsa **Aplicar «…» a mi documento**.
4. DBV lee la documentación de la plantilla (si no está instalada, la descarga: es una acción tuya) y prepara **una propuesta**: añade el `#import` y el `#show` con la plantilla, **mueve el título, los autores, el resumen y las palabras clave** a sus parámetros y deja **el resto del contenido exactamente como está**.
5. La propuesta se **revisa** como cualquier cambio de la IA: ves las diferencias, si compila y qué paquetes se descargarán. Te **marca** las reglas `#set` y `#show` de tu documento que pueden chocar con la plantilla (no las quita) y no se escribe nada hasta que pulsas **Aplicar**. Después, **Deshacer**.

### Pidiéndoselo a la IA

Con una IA conectada, el botón **Que la IA lo adapte** (o escribir en el panel *«Adapta el documento a @preview/…»*, o simplemente *«pásalo al IEEE»*) le pide el trabajo completo: busca la plantilla en el catálogo (si hay varias, te ofrece dos o tres y espera tu elección), lee sus parámetros, los rellena con tus datos, quita solo lo que choque, ajusta el estilo de la bibliografía con los estilos de Typst y **comprueba el resultado renderizando la página** si el modelo admite imágenes. Es más flexible que el camino mecánico, y también más caro y más variable según el modelo: revisa siempre la propuesta.

**Límites:** solo plantillas de Typst Universe; la plantilla debe describir una función de plantilla (`#show: nombre.with(…)`); si el documento ya la usa, DBV te lo dice y no propone nada. Un formato muy distinto del de partida puede pedir retoques a mano (cabeceras, bibliografía): para eso es la revisión.

---

## 6. El servidor MCP de DBV: las herramientas de DBV para otros agentes

**MCP** (*Model Context Protocol*) es un estándar para que un agente de IA use las herramientas de otros programas. DBV incluye un **servidor MCP** que le presta a un agente lo que no tiene por sí solo:

- **Compilar con el compilador exacto de DBV** (Typst 0.15.1) y recibir los errores con fichero y línea.
- **Ver las páginas renderizadas** como imágenes, para juzgar el formato.
- **La documentación de Typst** de esa versión, sin conexión, y el **catálogo de Typst Universe** con identificadores y versiones reales.
- **Pedirte permiso para instalar un paquete**, con un diálogo en la ventana de DBV: nada se descarga sin que lo aceptes.
- Tipografías disponibles, **referencias de tu `.bib`** y estilos de cita.

El agente **sigue leyendo y escribiendo tus ficheros por su cuenta**: el servidor es de **solo lectura**, no escribe nada en el proyecto y no abre ninguna conexión de red.

### ¿Quién lo usa y cómo se conecta?

| Agente | Qué hay que hacer |
| --- | --- |
| **El del panel de IA de DBV** (Claude Code, Gemini CLI…) | **Nada.** DBV se lo ofrece al abrir la conversación, apuntando al proyecto abierto (siempre que el agente admita MCP). |
| **Un agente que ejecutas fuera de DBV** (Claude Code en tu terminal, Claude Desktop, Cursor, Codex…) | **Herramientas → Servidor MCP…** enseña la configuración lista para copiar con la ruta real de DBV y tu proyecto. |

La configuración tiene esta forma (los valores reales los pone el diálogo):

```bash
# Claude Code y Codex: un comando en una terminal
claude mcp add dbv -- "<ruta-de-DBV>" --mcp --project "<carpeta-del-proyecto>"
codex  mcp add dbv -- "<ruta-de-DBV>" --mcp --project "<carpeta-del-proyecto>"
```

```json
{ "mcpServers": { "dbv": { "command": "<ruta-de-DBV>", "args": ["--mcp", "--project", "<carpeta-del-proyecto>"] } } }
```

El JSON sirve para Claude Desktop, Cursor, Gemini CLI y otros que leen `mcpServers`. La `<ruta-de-DBV>` es el ejecutable de la aplicación: en la versión de **Microsoft Store** es el alias `dbv-typst-editor.exe` (funciona desde cualquier terminal), en **Linux** el propio AppImage y en el resto la ruta de instalación. `--mcp` arranca **el servidor en lugar de la ventana**: el agente lo lanza como proceso hijo y lo cierra al terminar.

### Las herramientas

| Herramienta | Qué hace |
| --- | --- |
| `compile_project` | Compila y devuelve errores y avisos con fichero, línea y pistas. Un paquete sin instalar sale como «incompleto», no como error. |
| `render_page` | Hasta 3 páginas como imágenes PNG. |
| `search_typst_docs`, `read_typst_docs` | Busca y lee la documentación de Typst de la versión exacta. |
| `search_universe` | Busca plantillas y paquetes en el catálogo **ya descargado** (una versión por paquete). Sin catálogo, lo dice: no inventa. |
| `read_package_docs` | README, manifiesto y plantilla de un paquete **ya instalado**. |
| `install_package` | Pide a DBV que, **con tu permiso**, instale un paquete del catálogo, y devuelve su documentación. Si DBV no está abierto, no instala nada. |
| `list_fonts`, `list_bibliography`, `citation_styles` | Tipografías, referencias del `.bib` y estilos de cita. |
| `editor_state` | Lo que ves en el editor (ver abajo). |
| `dbv_info` | Versión del servidor, del compilador y proyecto. |

### Compartir el estado del editor (opcional)

Con **Preferencias → Compartir el estado del editor con agentes MCP** (**desactivado por defecto**; también en el diálogo *Servidor MCP…*), un agente conectado ve además lo que **no está en disco**: las pestañas abiertas **con su texto sin guardar**, el documento activo, el cursor y la selección, el esquema y los problemas. Es útil para pedirle *«explica lo que estoy escribiendo»*.

- **Solo lectura** y **solo del proyecto abierto**: no hay forma de que un agente mueva el cursor, edite una pestaña o guarde.
- Mientras un agente lo lee, aparece **«Agente conectado ✕»** en la cabecera del documento; pulsarlo **corta** el acceso.
- Si DBV no está abierto, o el ajuste está apagado, `editor_state` lo dice y el agente trabaja con lo que hay en disco.

### Seguridad

- El servidor lo lanza el agente como **proceso hijo** y habla con él por la entrada y salida estándar: **no hay ningún puerto de red**.
- El canal entre el servidor y la ventana de DBV es **local** (tubería con nombre en Windows, socket de Unix en macOS y Linux), con un **testigo aleatorio de 256 bits** que cambia en cada ejecución y solo lee el usuario que ejecuta DBV.
- Solo ve **la carpeta del proyecto** con el que se lanzó; ninguna herramienta recibe rutas.
- Instalar un paquete **siempre** pasa por el diálogo de DBV.
