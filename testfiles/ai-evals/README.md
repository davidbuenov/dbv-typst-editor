# Evaluación de la IA (RNF-IA-EVAL)

Corpus y resultados de la evaluación del asistente de DBV Typst Editor.

## Cómo se ejecuta

```bash
npm run eval:ai -- --model llama3            # todo el corpus, con y sin documentación
npm run eval:ai -- --model qwen2.5:3b --tasks fix-,docs-   # solo algunas tareas
npm run eval:ai -- --model llama3 --ctx 8192 --host http://127.0.0.1:11434
npm run eval:ai -- --model qwen3:8b --think on --label con-razonamiento   # con el razonamiento activado
```

> ⚠️ **No olvides el `--`** después de `npm run eval:ai`: sin él, npm se queda con las opciones y el script recibiría solo los valores sueltos (el script se niega y lo explica).

Opciones: `--think on|off` (razonamiento del modelo; `off` por defecto, como la aplicación) y `--label texto` (se añade al nombre del resultado, para no pisar el de otra ejecución del mismo día y modelo).

Necesita Ollama con el modelo descargado y el sidecar de Typst (`npm run vendor:typst`). No corre en la CI.

### Medir una IA en la nube o un servidor propio (RF-104)

```bash
# PowerShell
$env:ANTHROPIC_API_KEY = "…"          # la clave va en una variable de entorno, NUNCA como argumento
npm run eval:ai -- --provider anthropic --model <modelo>
# macOS / Linux
ANTHROPIC_API_KEY=… npm run eval:ai -- --provider anthropic --model <modelo>
```

Proveedores: `anthropic` (`ANTHROPIC_API_KEY`), `openai` (`OPENAI_API_KEY`), `gemini` (`GEMINI_API_KEY`), `openrouter` (`OPENROUTER_API_KEY`) y `compatible` para un servidor propio compatible con OpenAI (`llama-server`, vLLM, LM Studio…): `--provider compatible --base-url http://127.0.0.1:8080/v1 --model <id>` (la clave `OPENAI_COMPATIBLE_API_KEY` es opcional).

- **Cuesta dinero** (tokens de tu cuenta): 38 tareas × 2 modos son unas 76 ejecuciones con varias llamadas cada una. Al acabar se imprimen y se guardan los tokens gastados (`tokens` en el resumen) para que sepas lo que costó. Prueba antes con pocas tareas: `--tasks style-`.
- **La clave solo viaja en la cabecera** de la petición: no entra en el cuerpo, no se imprime y no se guarda en ningún resultado (hay un test que lo comprueba).
- Un 429 o un 5xx se reintenta hasta tres veces con espera.
- Los agentes por suscripción (Claude Code, Codex, Gemini CLI) usan su propio bucle y no se pueden medir así.

El script usa **el mismo código que la aplicación**: el bucle (`src/ai/agentLoop.js`), las herramientas (`tools.js`), las propuestas (`proposal.js`) y el contexto (`context.js`). El juez es el compilador real. Una tarea pasa si:

- la propuesta compila sin errores (`compiles`);
- contiene lo que pide la tarea (`mustContain`) y no lo prohibido (`mustNotContain`, p. ej. sintaxis de LaTeX);
- crea los ficheros pedidos (`files`);
- el asistente no intentó salir del proyecto (`confined`);
- y, en las tareas de formato, el aspecto va a un fichero de estilo y el de contenido no gana reglas (`separate`, RF-105).

Cada tarea se ejecuta **sin** y **con** la documentación de Typst empaquetada. Los resultados, con fecha y modelo, quedan en `results/`.

## Corpus

46 tareas (`tasks.json`):

| Categoría | Tareas | Ejemplos |
| --- | --- | --- |
| Arreglar errores reales del compilador | 10 | variable desconocida, delimitador sin cerrar, argumento con otro nombre, LaTeX dentro de Typst |
| Pasar de LaTeX | 5 | listas, énfasis, ecuaciones, citas, notas al pie |
| Tablas | 4 | cabecera, `csv()`, alineación, figura con pie y etiqueta |
| Figuras y numeración | 4 | imagen con pie, encabezados, ecuaciones, números de página |
| Varios ficheros | 3 | capítulo nuevo incluido, renombrar etiqueta, estilo compartido |
| Preguntas de documentación | 5 | cabecera de tabla, márgenes, columnas, índice, idioma |
| Redacción | 1 | añadir un resumen sin tocar lo demás |
| Formato y estilo (RF-105) | 6 | tipografía, márgenes, numeración, color de encabezados, justificado; un cambio solo de contenido |
| Typst Universe (RF-108, RF-110) | 5 | «pásalo al IEEE», plantilla de Springer, un diagrama, un glosario, un código de barras |
| Bibliografía (RF-115) | 3 | citar una clave que existe, una referencia que NO está (no inventarla), el estilo IEEE |

## Typst Universe y bibliografía (2026-10-04, `scripts/evalUniverse.mjs`)

Las 8 tareas nuevas usan **las mismas herramientas de la aplicación** (`search_universe`, `read_package_docs`, `list_bibliography`, `citation_styles`) con el **catálogo real** de Typst Universe (el que dejó la aplicación en su carpeta de datos, o el público) y los paquetes reales (`.tar.gz` público, extraído con `tar`). La lógica de búsqueda y de comprobación es una réplica en JS de la de Rust: mide el **comportamiento del modelo**, no el código Rust (que tiene sus tests). Una tarea de Universe pasa además si **todo `@preview/nombre:versión` de la propuesta existe y es una versión que el compilador admite** (`packagesValid`). Se lanzan con `--tasks uni-,bib- --docs on`.

| Modelo | Universe (5) | Bibliografía (3) | Paquetes inventados | Tokens (entrada / salida) |
| --- | --- | --- | --- | --- |
| `qwen3:8b` (Ollama, contexto 8 192) | **0 / 5** | 3 / 3 | **0** | 269 552 / 3 510 |
| Gemini 3.8 Flash (nube) | **3 / 5** | 3 / 3 | **0** | 197 613 / 6 365 |

**Cómo leerlo:**

- **Ninguno inventó un paquete ni una versión** (0 de 10 ejecuciones de Universe): lo que se medía de RF-108. El coste es que un modelo local pequeño **no llega a terminar**: `qwen3:8b` agota los 15 pasos leyendo documentación (3 de 5) o propone código que no compila.
- **Gemini 3.8 Flash:** pasa «pásalo al IEEE», el diagrama y el glosario; falla con Springer (mezcló `#import … : article` con `sn.article.with(…)`, y no compila) y con el código de barras (importó el paquete correcto y olvidó el número).
- **Bibliografía:** los dos citan solo claves que existen y ninguno inventa la referencia que falta (la respuesta correcta a «cita el libro de Dijkstra» era decir que no está).
- **No se midió** `render_page` ni las fuentes con modelos (necesitan el renderizado y la descarga de la aplicación), ni modelos locales de 14B o más. Son pocas tareas y una sola pasada: una diferencia de una tarea es ruido.

Resultados: `results/2026-10-04-qwen3_8b-universe.json`, `…-qwen3_8b-bib-missing.json` y `…-gemini-gemini-3.8-flash-universe.json`.

## Resultados del 2026-10-03 y 04 (`qwen3:8b`, Ollama, RTX 4070 Ti 12 GB)

Sobre las **32 tareas originales** (para poder compararlo con los de abajo; el corpus tiene ahora 38):

| Modelo | Razonamiento | Sin documentación | Con documentación | Compila (sin → con) |
| --- | --- | --- | --- | --- |
| `qwen3:8b` | desactivado | 10 / 32 | 12 / 32 | 20 / 27 → 20 / 27 |

Con **razonamiento activado** (`--think on`, contexto 16 384) solo se midió un subconjunto de 20 tareas (`fix-`, `table-`, `style-`) con documentación, porque una primera ejecución completa se colgó (y por eso el script tiene ahora `--timeout`, `--docs` y guardado incremental):

| `qwen3:8b`, 20 tareas con documentación | Tareas superadas | Tiempo medio por tarea |
| --- | --- | --- |
| razonamiento desactivado | 8 / 20 | 4,9 s |
| razonamiento activado | 10 / 20 | **82,7 s** |

Dos aciertos más (dentro del ruido: hay tareas que pasan con una opción y fallan con la otra en los dos sentidos) por esperar unas 17 veces más, y tres tareas se pasaron del límite de 4 minutos (parte de esa medición compartió GPU con otras ejecuciones). Por eso el razonamiento va **desactivado por defecto**.

**Estilo (RF-105), 6 tareas con `qwen3:8b` sin razonamiento:** el cambio de aspecto bien separado en un fichero de estilo pasó de 0/10 a 2/10 al añadir el principio al prompt (1/6 → 1/6 sin documentación y 1/6 → 2/6 con ella). Mejora pequeña, un solo modelo y una sola pasada: no concluyente (`2026-10-03-qwen3_8b-estilo-base.json` y `-estilo-prompt.json`).

## Resultados del 2026-10-04 (`gemma-4-E2B-it` Q4_K_M, `llama-server` con `--jinja`)

`2026-10-04-compatible-gemma-4-E2B-it-Q4_K_M.gguf.json` (`--provider compatible`): sobre las **32 tareas originales**, **5 superadas sin documentación y 8 con ella**; 1,59 millones de tokens de entrada (completo: 6/38 sin documentación y 9/38 con ella en las 38 tareas). Un modelo de ~2 000 millones de parámetros: en 26 de 38 ejecuciones sin documentación **no llegó a proponer nada** (`changed: false`) y gastó una media de 7,6 pasos prometiendo hacerlo sin llamar a la herramienta (seis ejecuciones acabaron en `maxSteps`). La documentación ayuda, como con los demás.

## Resultados del 2026-10-04 (Gemini 3.8 Flash, API de Google)

`2026-10-04-gemini-gemini-3.8-flash.json`: **sin documentación**, las 38 tareas: **35 superadas** (31/32 en las originales; 4/6 en estilo), con 321 243 tokens de entrada y 10 322 de salida en 42 ejecuciones. Con documentación **solo se midieron 4 tareas** (se paró a mano: con el 92 % sin documentación, la segunda pasada aportaba poco), por eso el resumen dice `"complete": false` y no hay dato de ese modo. Fallos: `equation-numbering` (el compilador dio un pánico `panicked with: [Equation]` y el modelo agotó los 15 pasos) y `style-font-new` / `style-heading-color-new`, donde puso el aspecto en `main.typ` en vez de crear un fichero de estilo.

## Resultados del 2026-10-02 (máquina de desarrollo, Ollama 0.6.5)

| Modelo | Herramientas | Sin documentación | Con documentación | Preguntas de documentación (sin → con) |
| --- | --- | --- | --- | --- |
| `llama3` (8B, 2024) | no (modo conversación) | 5 / 32 | 6 / 32 | **1 / 5 → 5 / 5** |
| `qwen2.5:3b` | sí | 2 / 32 | 1 / 32 | 0 / 5 → 1 / 5 |

**Lectura:**

- **La documentación empaquetada es lo que más se nota:** con ella, el modelo responde con la sintaxis real (`table.header`, `#set page(margin: …)`, `outline`) en vez de inventarla (`^ Título` para una cabecera). Es el objetivo de RF-96.
- **Los modelos locales pequeños (3B-8B) no son buenos editando Typst por sí solos.** Muchas veces explican el arreglo en vez de proponerlo, o lo proponen con la sintaxis de LaTeX. Para editar con soltura conviene un modelo de 14B o más, uno en la nube o un agente (Claude Code, Codex, Gemini CLI). La comprobación por compilación de DBV evita que una propuesta rota pase desapercibida.
- **Confinamiento:** en ninguna ejecución el asistente consiguió tocar algo fuera del proyecto; los intentos (los hubo con `qwen2.5:3b`) se bloquearon.
- Las primeras ejecuciones destaparon y sirvieron para corregir dos cosas de DBV: bloques de cambio con espacios tras `=======` y texto a buscar con otra sangría (los modelos pequeños los copian así), y llamadas a herramientas escritas como texto (`<tool_call>…`, formato de Qwen).
