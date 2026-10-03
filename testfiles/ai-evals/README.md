# Evaluación de la IA (RNF-IA-EVAL)

Corpus y resultados de la evaluación del asistente de DBV Typst Editor.

## Cómo se ejecuta

```bash
npm run eval:ai -- --model llama3            # todo el corpus, con y sin documentación
npm run eval:ai -- --model qwen2.5:3b --tasks fix-,docs-   # solo algunas tareas
npm run eval:ai -- --model llama3 --ctx 8192 --host http://127.0.0.1:11434
npm run eval:ai -- --model qwen3:8b --think on --label con-razonamiento   # con el razonamiento activado
```

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

38 tareas (`tasks.json`):

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
