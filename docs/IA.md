# 🤖 Usar una IA con DBV Typst Editor

> 🌐 **Español** · [English](./IA.en.md) · [← Volver al README](../README.md)

El asistente de IA de DBV Typst Editor es **opcional**. Sin configurar nada, el editor funciona exactamente igual que siempre: compila, previsualiza y exporta sin conexión. Esta guía explica **qué necesitas tener en tu ordenador** según la IA que quieras usar.

## Lo esencial en una tabla

| Quiero usar… | Qué necesito instalar o tener | ¿Sale algo de mi equipo? | ¿Cuesta dinero? |
| --- | --- | --- | --- |
| **Una IA local** (Ollama, LM Studio, llama.cpp…) | El programa servidor y al menos un modelo descargado | No | No (gasta tu CPU/GPU y disco) |
| **Claude, ChatGPT, Gemini u OpenRouter con clave de API** | Una clave de API de ese proveedor | Sí, al proveedor | Sí, por uso, según la tarifa del proveedor |
| **Mi suscripción** (Claude Pro/Max, ChatGPT Plus, Gemini, Copilot) | El **agente** de ese servicio instalado y con la sesión iniciada: Claude Code, Codex, Gemini CLI o GitHub Copilot CLI | Sí, al servicio del agente | Lo cubre tu suscripción |

> ⚠️ **Una suscripción no es una clave de API.** Pagar Claude Pro, ChatGPT Plus o Gemini no te da una clave de API (se contratan por separado). Con una suscripción, la vía es el **agente instalado** (tercera fila).

Para abrir el asistente de conexión: **Herramientas → Conectar una IA**. Al abrirlo, el editor **detecta lo que ya tienes** (Ollama, LM Studio y los agentes) y lo marca con ✓; lo que no encuentra aparece con un enlace de instalación. Esta detección solo ocurre al abrir esa pantalla, nunca al arrancar la aplicación.

Una vez conectada, el panel de la IA se abre con el botón **IA**, junto a P/E/V. Para saber **qué hace la IA por tu documento**, ve a la sección 4; para **cambiar el formato** de un documento (IEEE, Springer…), a la 5; y para usar las herramientas de DBV desde **otro agente** (Claude Code en tu terminal, Cursor…), a la 6.

---

## 1. Una IA local (nada sale de tu equipo)

Es la opción más privada: los documentos no abandonan tu ordenador y no hay coste por uso. A cambio, la calidad depende del tamaño del modelo y de tu hardware.

### Ollama

1. Instala [Ollama](https://ollama.com/download).
2. Descarga un modelo, por ejemplo: `ollama pull qwen3:8b` (el mejor de los que hemos medido; ver [Qué modelo local elegir](#qué-modelo-local-elegir-con-números)).
3. Comprueba qué tienes instalado con `ollama list`.
4. En el editor: **Herramientas → Conectar una IA**. Si Ollama está en marcha, aparece con ✓ y un botón **Usar**. Elige el modelo de la lista, pulsa **Probar conexión** y **Guardar**.

Ollama escucha en `http://localhost:11434`. El editor habla con él por su **API nativa** (`/api/chat`) y le indica él mismo el tamaño de contexto, porque Ollama usa por defecto uno pequeño (2 048–4 096 tokens) y recorta en silencio lo que no cabe. El ajuste «Context length» de la aplicación de Ollama **no se aplica a DBV**.

### LM Studio

1. Instala [LM Studio](https://lmstudio.ai), descarga un modelo y **arranca su servidor local** (pestaña *Developer / Local Server*).
2. Escucha en `http://localhost:1234`; el editor lo detecta igual que a Ollama.

### Tu propio servidor compatible con OpenAI (llama.cpp, vLLM, Jan…)

Cualquier servidor que ofrezca la API de OpenAI sirve. El caso típico es `llama-server` de [llama.cpp](https://github.com/ggml-org/llama.cpp) con un modelo `.gguf` que tú mismo has descargado. **Este servidor no lo detecta el asistente: hay que añadirlo a mano.**

1. **Herramientas → Conectar una IA → Añadir una IA en la nube (clave de API)…** *(el botón se llama así, pero abre un formulario nuevo con todos los proveedores)*.
2. En **Proveedor**, elige **Servidor compatible con OpenAI (local o propio)**.
   - ⚠️ **No elijas «Ollama»** para un servidor que no es Ollama: ese modo usa un protocolo distinto y el editor no entenderá la respuesta. Y al **editar** una conexión el proveedor no se puede cambiar: hay que crear una nueva.
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
- **Los modelos que «piensan» tardan mucho.** Algunos modelos (Gemma 4, Qwen3…) escriben primero su razonamiento (`reasoning_content`) y dejan la respuesta vacía hasta terminar, con cientos o miles de tokens por el camino. El panel lo enseña como «Pensando…» con un bloque plegable, pero la espera es larga. Arranca el servidor con `--reasoning-budget 0` para desactivarlo; DBV también manda `enable_thinking: false` a un servidor compatible genérico mientras el interruptor *Razonamiento* de la conexión esté desactivado (que es el valor por defecto).

Ejemplo de arranque razonable:

```bash
llama-server -m modelo.gguf -c 32768 -np 1 --reasoning-budget 0 --port 8080
```

### Qué esperar de un modelo local

- **Herramientas.** Con un modelo que las admite, la IA lee el proyecto por su cuenta, consulta la documentación de Typst y propone cambios que DBV **compila en memoria** antes de enseñártelos. Sin herramientas, el asistente sigue sirviendo para conversar y para trabajar sobre el contexto que se le envía, pero hace menos por sí mismo. El campo *Herramientas* del formulario las detecta; si falla la detección, puedes forzarlas a *Sí* o *No*.
- **Tamaño.** Los modelos de menos de 7 000 millones de parámetros (2–3 GB en disco) responden rápido en un portátil, pero **suelen fallar al proponer cambios** y al decidir cuándo consultar la documentación: el editor te avisa en el formulario y en el panel. Con los números de abajo, para editar con soltura conviene uno de 8B como mínimo, uno mayor o una IA en la nube.
- **Contexto.** DBV calcula el **mínimo con el que el asistente funciona**: **8 192 tokens** con herramientas (más con el razonamiento activado) y **16 384 recomendados**. Ollama arranca con 4 096, que se queda corto: DBV pide **8 192** por defecto y, si escribes un valor menor, te avisa con el número («con 4 096 tokens el asistente tiene que recortar casi todo lo que le envías»); puedes subirlo en el campo *Contexto* de la conexión.
- **Razonamiento.** Algunos modelos (Qwen3, Gemma 4…) «piensan» antes de responder. Tarda **mucho más** y se ve en el panel como «Pensando…», con un bloque plegable con lo que piensa. Cada conexión tiene un interruptor **Razonamiento**, desactivado por defecto: ver [Qué modelo local elegir](#qué-modelo-local-elegir-con-números).
- **Memoria.** Un modelo más grande o un contexto mayor necesitan más RAM o VRAM. Con una GPU de 12 GB, un modelo de 8B (5 GB) cabe holgado; uno de 14B (9 GB) cabe justo y, si la GPU está ocupada, desborda a la RAM y va mucho más lento (en Ollama, `ollama ps` debe decir «100% GPU»).

### Qué modelo local elegir (con números)

Medimos los modelos con el mismo bucle que usa la aplicación sobre un **corpus de 32 tareas reales de Typst** (arreglar errores del compilador, pasar de LaTeX, tablas, figuras, varios ficheros, preguntas de documentación…), con y sin la documentación de Typst que trae el editor. Una tarea se da por superada si la propuesta **compila sin errores**, hace lo que se pedía y no sale del proyecto. Equipo: RTX 4070 Ti de 12 GB, Ollama; 2–3 de octubre de 2026. Los resultados completos están en [`testfiles/ai-evals/results/`](../testfiles/ai-evals/results/).

| Modelo | En disco | Herramientas | Sin documentación | Con documentación | Veredicto |
| --- | --- | --- | --- | --- | --- |
| `qwen3:8b` | 5,2 GB | sí | 10 / 32 (31 %) | **12 / 32 (38 %)** | El mejor que hemos medido. Aun así acierta poco más de 1 de cada 3: **revisa siempre lo que propone**. |
| `llama3` (8B, 2024) | 4,7 GB | no (modo conversación) | 5 / 32 | 6 / 32 | Para conversar; no para proponer cambios. |
| `qwen2.5:3b` | 1,9 GB | sí | 2 / 32 | 1 / 32 | **No recomendado** para proponer cambios. |
| `gemma-4-E2B-it` (Q4_K_M, por `llama-server` con `--jinja`) | — | sí | 5 / 32 (16 %) | 8 / 32 (25 %) | **No recomendado** para proponer cambios: en 2 de cada 3 ejecuciones ni llega a proponer nada (dice «lo propondré otra vez» sin llamar a la herramienta). |

**Cómo leerlo, sin adornos:**

- **Ningún modelo local de los que hemos medido llega al 40 %** que nos pusimos como mínimo para recomendarlo para proponer cambios sin vigilancia. Sirven para borradores y para que les pidas el siguiente paso, **pero hay que revisar cada propuesta** (DBV te la enseña compilada y por trozos precisamente por eso).
- **La documentación ayuda:** con ella, `qwen3:8b` pasa de 10 a 12 y `llama3` de 1 a 5 de 5 en las preguntas de documentación.
- **No hemos medido todavía** modelos locales de 14B o más. De la nube solo hay **una referencia** (abajo). El script de evaluación puede medir más (`npm run eval:ai -- --provider …`): ver [`testfiles/ai-evals/README.md`](../testfiles/ai-evals/README.md).
- **Son pocas tareas y una sola pasada:** una diferencia de uno o dos aciertos es ruido.

**Como referencia, una IA en la nube.** Con **Gemini 3.8 Flash** (clave de API de Google) y la misma evaluación, **sin** documentación: **31 de 32** tareas originales superadas (97 %) y 4 de 6 en las de estilo (35 de 38 en total); gastó unos 321 000 tokens de entrada en 42 ejecuciones (unos 7 600 por tarea, céntimos con la tarifa de un modelo «flash»). Con documentación solo se midieron 4 tareas, así que no hay dato. Para el mismo trabajo, `qwen3:8b` en tu equipo supera 10 de 32: **una IA en la nube es, hoy, claramente más fiable para proponer cambios**, a cambio de que lo que envías salga de tu equipo. Los únicos fallos de Gemini fueron una tarea en la que el propio compilador de Typst dio un error interno (`equation-numbering`) y dos en las que puso el cambio de aspecto en el documento principal en vez de crear un fichero de estilo; con un fichero de estilo ya existente lo hizo bien las tres veces. Es **un solo modelo en una sola pasada**: no lo tomes como un ranking.

**¿Merece la pena activar el razonamiento?** Medimos `qwen3:8b` con y sin él sobre 20 tareas representativas, con documentación:

| | Sin razonamiento | Con razonamiento |
| --- | --- | --- |
| Tareas superadas | 8 / 20 | 10 / 20 |
| Tiempo medio por tarea | 4,9 s | **82,7 s** |

Dos aciertos más, que están dentro del ruido, a cambio de esperar **unas 17 veces más** (y tres tareas se pasaron del límite de 4 minutos). Por eso **viene desactivado**. Actívalo solo si no te importa esperar, con un contexto de 16 384 o más, y para tareas difíciles.


---

## Averiguar los datos del formulario

Para conectar una IA local el formulario pide tres cosas: **modelo**, **contexto** y si admite **herramientas**. Se consultan en tu propio equipo con los comandos de abajo, y el resultado es lo que hay que escribir en cada campo.

> En **PowerShell** usa `curl.exe` (con la extensión): `curl` a secas es un alias de otro comando y no devuelve lo mismo. En CMD, macOS y Linux vale `curl`.

### Ollama (puerto 11434)

| Quiero saber… | Comando | Campo del formulario |
| --- | --- | --- |
| Qué modelos tengo descargados | `ollama list` | **Modelo**: la columna `NAME`, completa (por ejemplo `qwen3:8b`; `llama3:latest` también vale como `llama3`) |
| Lo mismo, por la API | `curl http://localhost:11434/api/tags` | — |
| Qué modelos están cargados en memoria ahora | `ollama ps` | — |
| Detalles de un modelo (arquitectura, parámetros, contexto máximo, cuantización) | `ollama show qwen3:8b` | **Contexto**: el máximo que muestra es el del modelo; elige un valor igual o menor que quepa en tu memoria |
| Descargar un modelo nuevo | `ollama pull qwen3:8b` | — |

El editor **fija el contexto por su cuenta** en Ollama, así que el campo *Contexto* es el que tú decides, no el que tenga Ollama configurado. Si lo dejas vacío, usa 8 192. El campo *Máximo por respuesta* (8 192 por defecto en modelos locales) corta a un modelo que se desboca antes de que llene el contexto: una propuesta larga de ~1 200 palabras ocupa unos 1 400 tokens.

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

**Herramientas → Conectar una IA → Añadir una IA en la nube (clave de API)…** → elige el proveedor → pega la clave → **Probar conexión** → elige el modelo de la lista que devuelve el propio proveedor → **Guardar**.

- **La clave** se guarda en el **almacén de credenciales del sistema** (Administrador de credenciales de Windows, Llavero de macOS, Secret Service en Linux), nunca en un fichero ni en `localStorage`. Al editar una conexión el campo de la clave queda vacío: dejarlo así conserva la guardada. Eliminar la conexión borra también la clave.
- **Privacidad:** para responder, se envía al proveedor el contexto del proyecto (fichero abierto, selección, errores y lo que adjuntes). **La primera vez por proyecto y proveedor, el editor te pregunta** antes de enviar nada. Puedes quitar cualquier elemento del contexto desde el propio panel.
- **Coste:** lo factura el proveedor por uso.

---

## 3. Con tu suscripción: agentes instalados

Si pagas **Claude Pro/Max, ChatGPT Plus, Gemini o GitHub Copilot**, no necesitas clave de API: DBV puede hablar con el **agente de línea de comandos** de ese servicio, que usa tu cuenta. DBV **no ve ni guarda tus credenciales**: el inicio de sesión lo hace el propio agente.

| Agente | Qué debe estar instalado | Cómo lo lanza DBV |
| --- | --- | --- |
| **Claude Code** | Claude Code y **Node.js** (incluye `npx`) | `npx -y @agentclientprotocol/claude-agent-acp` |
| **Codex** (OpenAI) | Codex y **Node.js** (incluye `npx`) | `npx -y @zed-industries/codex-acp` |
| **Gemini CLI** | Gemini CLI | `gemini --experimental-acp` |
| **GitHub Copilot CLI** | Copilot CLI | `copilot --acp` |

Enlaces de instalación: [Claude Code](https://docs.anthropic.com/en/docs/claude-code/setup) · [Codex](https://github.com/openai/codex) · [Gemini CLI](https://github.com/google-gemini/gemini-cli) · [Copilot CLI](https://docs.github.com/copilot/how-tos/set-up/install-copilot-cli) · [Node.js](https://nodejs.org).

**Pasos:**

1. Instala el agente (y Node.js si lo necesita) para que quede en el `PATH` de tu sistema.
2. **Ábrelo una vez en una terminal** e inicia sesión con tu cuenta. DBV no puede iniciar sesión por ti.
3. En el editor: **Herramientas → Conectar una IA**. El agente aparece con ✓ *instalado* y un botón **Conectar**.
4. La primera vez puede tardar: para Claude Code y Codex se descarga su adaptador con `npx`.

**Cómo funciona:**

- DBV lanza el agente **con la carpeta del proyecto como directorio de trabajo**; se cierra al cerrar el proyecto o la aplicación.
- **Permisos:** cada vez que el agente pide permiso para algo (ejecutar una orden, editar, leer), DBV te lo muestra con lo que pide. Puedes **Permitir una vez**, **Permitir siempre en esta conversación** o **Denegar**. Nada se aprueba solo, y lo que quede fuera de la carpeta del proyecto se deniega.
- **Seguridad de tus ficheros:** antes de cada turno, DBV guarda un **punto de restauración** de los ficheros de texto del proyecto. Lo que el agente cambie directamente en disco aparece al terminar bajo el título **«El agente cambió N ficheros en disco»**, con sus diferencias y **Deshacer** por fichero o en bloque.

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

---

## Privacidad de un vistazo

| Vía | Qué sale de tu equipo |
| --- | --- |
| IA local | Nada. La conversación no abandona tu ordenador. |
| API en la nube | El contexto que se envía, al proveedor. Se pregunta la primera vez por proyecto. |
| Agente con suscripción | Lo que el agente envíe a su servicio. DBV no controla su red; los permisos sí pasan por DBV. |

Las herramientas de los modelos directos **no abren conexiones ni ejecutan programas**: el modelo solo le pide cosas a DBV, que lee el proyecto y propone cambios que tú revisas trozo a trozo antes de aplicarlos, con **Deshacer**. Lo que DBV descarga **en nombre de una IA en la nube** (el catálogo público de Typst Universe, sin enviar nada tuyo) se avisa en el panel, y **instalar un paquete o añadir una tipografía exige siempre tu confirmación**. Con una IA local, DBV no descarga nada: solo lee lo que ya hay en tu equipo.

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
| El modelo olvida el principio del documento | Contexto demasiado pequeño | Sube el contexto del servidor y el campo **Contexto (tokens)** |

---

> Esta guía describe la versión **0.14.0**. La ayuda dentro de la aplicación (**?** → *Asistente de IA*, *Servidor MCP*) resume lo esencial; la especificación completa está en [`RF-90`–`RF-96` de SPECIFICATIONS.md](../dbv-specs-ops/docs/SPECIFICATIONS.md).
