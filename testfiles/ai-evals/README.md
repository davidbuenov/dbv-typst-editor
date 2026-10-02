# Evaluación de la IA (RNF-IA-EVAL)

Corpus y resultados de la evaluación del asistente de DBV Typst Editor.

## Cómo se ejecuta

```bash
npm run eval:ai -- --model llama3            # todo el corpus, con y sin documentación
npm run eval:ai -- --model qwen2.5:3b --tasks fix-,docs-   # solo algunas tareas
npm run eval:ai -- --model llama3 --ctx 8192 --host http://127.0.0.1:11434
```

Necesita Ollama con el modelo descargado y el sidecar de Typst (`npm run vendor:typst`). No corre en la CI.

El script usa **el mismo código que la aplicación**: el bucle (`src/ai/agentLoop.js`), las herramientas (`tools.js`), las propuestas (`proposal.js`) y el contexto (`context.js`). El juez es el compilador real. Una tarea pasa si:

- la propuesta compila sin errores (`compiles`);
- contiene lo que pide la tarea (`mustContain`) y no lo prohibido (`mustNotContain`, p. ej. sintaxis de LaTeX);
- crea los ficheros pedidos (`files`);
- y el asistente no intentó salir del proyecto (`confined`).

Cada tarea se ejecuta **sin** y **con** la documentación de Typst empaquetada. Los resultados, con fecha y modelo, quedan en `results/`.

## Corpus

32 tareas (`tasks.json`):

| Categoría | Tareas | Ejemplos |
| --- | --- | --- |
| Arreglar errores reales del compilador | 10 | variable desconocida, delimitador sin cerrar, argumento con otro nombre, LaTeX dentro de Typst |
| Pasar de LaTeX | 5 | listas, énfasis, ecuaciones, citas, notas al pie |
| Tablas | 4 | cabecera, `csv()`, alineación, figura con pie y etiqueta |
| Figuras y numeración | 4 | imagen con pie, encabezados, ecuaciones, números de página |
| Varios ficheros | 3 | capítulo nuevo incluido, renombrar etiqueta, estilo compartido |
| Preguntas de documentación | 5 | cabecera de tabla, márgenes, columnas, índice, idioma |
| Redacción | 1 | añadir un resumen sin tocar lo demás |

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
