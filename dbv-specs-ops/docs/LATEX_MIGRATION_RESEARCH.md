# 🔬 Technical Research Report — Migración desde LaTeX / Overleaf

> **Encargo:** investigación de estrategia de migración LaTeX → Typst como palanca de **adquisición de usuarios**, solicitada por el usuario el 2026-09-06. Encuadre explícito del encargo: *"Do not think like a converter developer. Think like a product designer. The goal is not perfect conversion. The goal is helping LaTeX users successfully adopt Typst."*
> **Método:** repositorios y registros oficiales de cada candidato (GitHub, crates.io, docs.rs, Typst Universe), documentación oficial de Typst y de Overleaf, y lectura del código ya existente en este repositorio para identificar reutilización real.
> **Estado de verificación:** ✅ licencias, versiones, API pública y estado de mantenimiento verificados contra la fuente el 2026-09-06. ✅ **Spike S-1 ejecutado el 2026-09-06 sobre TRES proyectos reales del usuario** (artículo JENUI con `IEEEtran`; artículo de revista con `.sty` propio; artículo Springer con `llncs.cls` y figuras compuestas) — resultados en §0.bis. **Los tres compilan.** Cuatro afirmaciones de este informe resultaron falsas y están corregidas abajo, marcadas `⚠️ CORREGIDO (S-1)`; una decisión de roadmap cambió por el dato (contraste estructural sube a v1.0).
> **Confidencialidad:** dos de los tres proyectos están sin publicar. Se trataron **solo en local**, sus contenidos no aparecen en este informe ni en ningún material publicable, y las copias de trabajo son borrables.
> **Consumidores de este informe:** `SPECIFICATIONS.md` (nuevo pilar de producto y roadmap), `ARCHITECTURE.md` (nueva §7.15 cuando se apruebe), `memory.md` (ADR-LATEX-001).

---

## 🎯 0. Tesis estratégica (leer antes que nada)

La investigación arroja una conclusión que **cambia el encuadre del encargo**:

> **Convertir LaTeX a Typst ya no es un diferenciador. La app web oficial de Typst lo hace desde hace tiempo, vía Pandoc, gratis y sin instalar nada.**
> Fuente: [Guide for LaTeX Users — typst.app/docs](https://typst.app/docs/guides/for-latex-users/) ("*you can use Pandoc to convert your source code to Typst markup… also built into our web app*").

Si el producto compite en "convierte mejor", compite contra Pandoc en su propio terreno, con peor motor y sin ventaja percibida. La ventaja de DBV Typst Editor está en **las cuatro cosas que nadie hace hoy**:

| # | Lo que nadie hace | Por qué gana usuarios |
| --- | --- | --- |
| 1 | Migrar un **proyecto entero**, no un fichero | Un TFG/tesis real son 20 ficheros, `.bib`, figuras y una clase propia. Pegar un `.tex` en una web no resuelve eso. |
| 2 | Decir **qué revisar y dónde**, no solo convertir | El miedo del usuario no es "¿convertirá?", es "**¿qué se me ha roto sin que yo lo sepa?**". Un informe localizado responde a eso. |
| 3 | Reconocer la **identidad** del documento, no solo su sintaxis | `\documentclass{IEEEtran}` no es "un comando a convertir": es "este señor escribe para IEEE" → hay plantilla equivalente en Universe y la tenemos ya curada. |
| 4 | Garantizar que **el documento migrado compila siempre** | Ver §8. Es la diferencia entre "una herramienta que a veces funciona" y "un puente en el que se puede confiar". |

**Formulación de la promesa de producto (propuesta):**

> *"Abre tu proyecto de Overleaf en DBV Typst Editor. Compilará desde el primer minuto — y te diremos exactamente qué mirar."*

Nada de "conversión perfecta" (mentira que se descubre en 30 segundos y quema la confianza). La promesa es **continuidad de trabajo + transparencia**.

---

## 🧪 0.bis. Spike S-1 — resultados sobre un proyecto real

**Proyecto:** artículo para JENUI 2026 (`main.tex` 601 líneas, `\documentclass{IEEEtran}`, 14 paquetes, `biblio.bib` con 11 entradas, `IEEEtran_Jenui.bst` propio, sin figuras). Proyecto real del usuario, tratado solo en local.
**Método:** banco de pruebas en Rust contra `tylax 0.3.7` como *crate*, y compilación del resultado con **nuestro sidecar Typst 0.15.1**.

### El titular

| Pregunta | Respuesta medida |
| --- | --- |
| ¿Compila el resultado de Tylax tal cual? | ❌ **No.** 4 errores de compilación |
| ¿Son sistemáticos y reparables? | ✅ **Sí.** 3 patrones, todos mecánicos |
| ¿Compila tras reparar? | ✅ **Sí. 0 errores, PDF generado** |
| ¿Sobrevive el contenido? | ✅ En lo esencial: 7/7 tablas, **21/21 citas resueltas**, referencias cruzadas, texto y estructura |
| ¿Sobrevive la identidad del documento? | ❌ **No.** Título, autores, filiaciones y *keywords* se vuelcan como comentarios |

### Los tres patrones de fallo (todos con reparación demostrada)

| # | Patrón | Consecuencia | Reparación verificada |
| --- | --- | --- | --- |
| 1 | `\section*{Título}` → `== *` + el título en la línea siguiente | El `*` suelto **rompe la compilación**, y el título **deja de ser encabezado**: pasa a texto corriente, así que desaparece del esquema y de cualquier índice. ⚠️ *Corregido el 2026-09-06: en la primera redacción se afirmó que el título "se perdía entero"; verificado después con el CLI, el texto sobrevive — lo que se pierde es su condición de encabezado.* | Pre-pasada: `\section*{` → `\section{` (se pierde solo la supresión de numeración) |
| 2 | `\bibliographystyle`/`\bibliography` volcados como comentarios; el nombre del estilo se corrompe (`IEEEtran_Jenui` → `IEEEtran_(J)enui`, subrayado sin cerrar) | La bibliografía **no se conecta**, pese a estar el `.bib` al lado | Post-pasada: emitir `#bibliography("biblio.bib", style: "ieee")` |
| 3 | `david.bueno@uma.es` → `@uma.es` interpretado como **cita** | `error: label <uma.es> does not exist` | Post-pasada: escapar la arroba cuando el carácter previo es parte de una palabra (una cita real va precedida de espacio) |

El patrón 3 merece atención especial: **afecta a casi cualquier artículo académico**, porque todos llevan los correos de los autores en la cabecera.

### ⚠️ Consecuencia arquitectónica: la conversión es un BUCLE, no un paso

```
pre-pasada → Tylax → post-pasada → COMPILAR con nuestro Typst → reparar → COMPILAR
                                        ↑_______________________________|
```

Y aquí aparece el diferenciador más fuerte de todo el informe, que no estaba en la versión inicial:

> **Somos los únicos que podemos cerrar ese bucle, porque llevamos el compilador de Typst dentro de la aplicación.**
> Una web de conversión entrega texto y se desentiende. Nosotros podemos *comprobar* que el resultado compila antes de dárselo al usuario — y si no compila, repararlo o degradarlo a MiTeX. La promesa «compila desde el primer minuto» deja de ser una esperanza y pasa a ser una **verificación**.

### Lo que migró bien (confirmado en la práctica)

Texto y estructura íntegros con acentuación y tipografía españolas correctas · 7 de 7 tablas · **21 de 21 citas** convertidas a `#cite(<clave>)` y **todas resueltas** contra el `.bib` (en Typst una cita sin entrada es error de compilación, así que compilar sin errores lo demuestra) · referencias cruzadas `\ref{tab:x}` → `@tab-x` · enlaces y ORCID · énfasis. **El `.bib` migró intacto, sin tocar una línea** — confirmada la afirmación de §2.2.

### Proyecto 2 — artículo de revista con estilo propio (no publicado, tratado solo en local)

**Perfil:** `main.tex` de 674 líneas y 94 KB, `\documentclass{article}` + **`aaj2026.sty` propio de la revista**, 18 paquetes, `biblio.bib` de 72 KB, 13 tablas, 2 figuras, **178 citas**. Es el caso "clase/estilo propio" que §4.1 marcaba en rojo.

| Medida | Resultado |
| --- | --- |
| ¿Compila? | ✅ **Sí, 0 errores y a la primera**, con las **mismas tres reparaciones** del proyecto 1 |
| Tablas | ✅ **13 / 13** |
| Figuras | ✅ **2 / 2 fieles** (el original incluye la misma imagen dos veces a propósito, y así se reprodujo) |
| Citas | ✅ **178 → 194 elementos `cite`, todas resueltas** contra un `.bib` de 72 KB |
| Restos de LaTeX | ⚠️ **117** (frente a 3 del proyecto 1) |
| `.sty` propio | ⚠️ No impide compilar, pero su maquetación se pierde entera |

**Las tres reparaciones de §0.bis generalizan.** No hubo que inventar ninguna nueva para un proyecto cuatro veces mayor y con estilo propio. Eso sugiere que el bucle de reparación es **un catálogo pequeño y estable de patrones**, no una carrera sin fin contra casos particulares.

### 🔑 Hallazgo clave: los restos se agrupan por PAQUETE, no se dispersan

Los 117 restos del proyecto 2 no están repartidos por el documento. Son tres comandos:

| Resto | Veces | Origen |
| --- | --- | --- |
| `\makecell` | **90** | paquete `makecell` (saltos de línea dentro de una celda) |
| `\linewidth` | 13 | longitud dentro de tablas y figuras |
| `\arraybackslash` | 11 | especificadores de columna de `array` |

**El 77 % de todo el daño de este proyecto lo causa UN paquete.** Consecuencia directa para el diseño del informe (§5):

> **Los hallazgos se agrupan por causa, no por aparición.** El informe no debe decir «117 incidencias»: debe decir **«el paquete `makecell` no está soportado — afecta a 90 celdas de tus 13 tablas»**. Es la diferencia entre una lista abrumadora y **una sola acción**.

Esto también añade una fila empírica a la matriz de §4.2 que la documentación oficial no menciona: `makecell` → salto de línea nativo dentro de la celda en Typst.

### Proyecto 3 — artículo Springer LNCS con figuras compuestas

**Perfil:** `main.tex` de 135 líneas, **`llncs.cls`** (Springer), `splncs04.bst`, `bibliography.bib` de 53 KB, **8 figuras en subcarpeta `fig/`** (7 JPG + **1 PDF**), 11 citas, paquete `subfig`.

| Medida | Resultado |
| --- | --- |
| ¿Compila? | ✅ Sí, 0 errores (tras ampliar una reparación, ver abajo) |
| Texto conservado | ✅ **94 %** (1.748 → 1.649 palabras; la caída de líneas era reflujo, no pérdida) |
| Citas | ✅ 11 → 18 elementos `cite`, todas resueltas |
| **Figuras** | ❌ **0 de 8. Pérdida TOTAL y SILENCIOSA** |

#### 🚨 El hallazgo más grave del spike: pérdida silenciosa de figuras

Las 8 figuras desaparecieron **sin un solo error ni aviso**. El documento compila, tiene buen aspecto, y no queda ni rastro de ellas.

**Causa aislada con un caso mínimo reproducible** (8 líneas de LaTeX):

| Entrada | Salida de Tylax 0.3.7 |
| --- | --- |
| `\begin{figure}` + `\includegraphics` | ✅ `#figure(image("foto.png"), caption: [...])` |
| `\begin{figure}` + `\subfloat{\includegraphics}` | ❌ `#figure([], caption: [...])` — **cuerpo vacío** |

Es decir: **el paquete `subfig` (`\subfloat`) hace que Tylax descarte el contenido entero de la figura.** El proyecto 2, que no usa `subfig`, convirtió sus 2 figuras correctamente; el 3, que lo usa en las 8, las perdió todas. Es un fallo reportable aguas arriba, y así debe hacerse (§9).

#### ✅ Consecuencia estratégica: el contraste estructural sube de v1.x a v1.0

Esta pérdida **no la detecta el compilador** (0 errores), **ni los diagnósticos del motor**, ni una lectura rápida del resultado. La detectó **una sola cosa**: comparar `\includegraphics` en el origen (8) con `image()` en el destino (0).

> Es exactamente el **contraste estructural** que §7 proponía como comprobación barata — y que el propio informe relegaba a la fase E (v1.x). **El spike demuestra que es la única red que atrapa el peor fallo posible.**
> **Decisión: pasa a ser obligatorio en la misma entrega que el importador (v1.0), no un refinamiento posterior.** Sin él, la promesa de §0 («te diremos exactamente qué mirar») es falsa precisamente en el caso en que más importa.

#### Otros hallazgos del proyecto 3

- **Correo entre llaves.** `{jmgn,eva}@lcc.uma.es` —idioma habitual para autores que comparten dominio— escapó a la reparación nº 3, que solo miraba letras y puntos antes de la arroba. Ampliada a `}`, `)` y `]`: **el catálogo de reparaciones crece por refinamiento, no por acumulación de casos nuevos.**
- **Rutas de imagen sin extensión.** 6 de las 8 son `fig/Office1-t20-a4r0`, sin extensión: LaTeX la resuelve solo, **Typst exige la extensión**. Hace falta una resolución propia contra los ficheros del proyecto.
- **La figura en PDF nunca llegó a probarse** (se perdió con las demás por `subfloat`), así que la afirmación de §2.2 sobre PDF-como-imagen **sigue sin verificarse en un proyecto real**.

### Lo que sigue SIN probar tras los tres proyectos

- **Multi-fichero.** ⚠️ Dato inesperado: **los tres proyectos reales son de un solo fichero** (601, 674 y 135 líneas). La suposición de §3.2 («un TFG real son veinte `.tex`») **no se cumple en artículos**; probablemente sí en tesis, pero no hay ninguna en la muestra. `tylax::files` existe, pero sigue sin ejercitarse.
- **La red de seguridad MiTeX.** Ninguno de los tres la necesitó, y el proyecto 2 tiene **cero ecuaciones**. Sigue sin probarse (§6) — es el hueco más importante que queda.
- **TikZ.** Ausente en los tres.
- **Figuras EPS.** Ausentes en los tres.
- **PDF como figura.** Presente en el proyecto 3, pero se perdió antes de llegar al compilador por el fallo de `subfloat`.

### Hallazgos nuevos, no previstos en la investigación documental

1. **El `.bst` no tiene equivalente.** El proyecto trae `IEEEtran_Jenui.bst`, un estilo BibTeX propio de la conferencia. Typst usa **CSL**, no `.bst`: no hay conversión posible. Hay que mapear al estilo CSL más próximo (aquí `ieee`) y **avisar de que la bibliografía puede no salir con el formato exacto que pide la convocatoria** — dato crítico para quien envía a una revista.
2. **La identidad del documento se pierde entera.** `\title`, `\author`, `\maketitle` y `IEEEkeywords` acaban como comentarios y texto suelto. Esto **asciende el mapeo clase→plantilla (§4.1) de "momento wow" a requisito funcional**: sin aplicar `charged-ieee` y volcar ahí título y autores, el resultado no es usable como artículo.
3. **El español rompe el analizador de diagnósticos.** `check_latex()` falla en la línea 20 con `unexpected 'spanishtablename'` (de `babel` en español) y a partir de ahí encadena falsos positivos. Nuestro público objetivo es la academia hispanohablante: esto no es un caso raro, es el caso normal.

---

## 🧰 1. Tecnologías de conversión — estado real del arte

### 1.1. Cuadro comparativo

| Proyecto | Qué es | Licencia | Madurez / mantenimiento | Integración en nuestra app | Veredicto |
| --- | --- | --- | --- | --- | --- |
| **Tylax** | Conversor **bidireccional** LaTeX ↔ Typst en Rust (AST, no regex) | **Apache-2.0** ✅ | v0.3.7 (18 jul 2026), 483★, cadencia 2026: 0.2.0 ene → 0.3.0 mar → 0.3.7 jul. Autor único, ritmo "slowly but surely" | **Crate Rust, en proceso** — sin sidecar, sin binario extra, sin coste de instalador | ✅ **Motor primario** |
| **MiTeX** | Paquete **de Typst** que renderiza LaTeX *dentro* del documento compilado | **Apache-2.0** ✅ | v0.2.7, 606★, probado con 32,5k ecuaciones de OI Wiki; 2,28 s (WASM) frente a 109 s de texmath, 185 KB frente a 17 MB | `#import "@preview/mitex:0.2.7"` — ya soportado por nuestro panel de Universe | ✅ **Red de seguridad** (§8) |
| **Pandoc** | Conversor universal; escritor `typst` desde **3.1.2** | **GPL-2.0-or-later** ⚠️ | Maduro, referencia del sector, mantenimiento continuo (3.10.x en 2026). Es lo que usa la propia web de Typst | Binario externo (~150 MB, Haskell). GPL + MIT: distribuible como agregado invocado por CLI, pero obliga a oferta de fuentes y dispara el tamaño del instalador | ⚠️ **Opcional "trae el tuyo"** |
| **tex2typst** (JS / `tex2typst-rs` / PyPI) | Conversión de **matemáticas** LaTeX → Typst | MIT/Apache según implementación | Activo, varias implementaciones | Redundante: Tylax y MiTeX ya cubren matemáticas | ❌ No aporta |
| **typdiff** | Diff entre documentos **Typst** (estilo `latexdiff`) | — | Activo | No sirve para comparar LaTeX vs Typst (§7) | ❌ Fuera de caso |
| **Detypify / Hieroglyphic** | Buscadores de símbolos LaTeX↔Typst | — | Activos | Idea reutilizable para el asistente, no dependencia | 💡 Inspiración |

Fuentes: [scipenai/tylax](https://github.com/scipenai/tylax), [docs.rs/tylax](https://docs.rs/tylax), [mitex-rs/mitex](https://github.com/mitex-rs/mitex), [mitex en Universe](https://typst.app/universe/package/mitex/), [pandoc.org/releases](https://pandoc.org/releases.html), [best-of-typst](https://github.com/YDX-2147483647/best-of-typst).

### 1.2. Por qué Tylax es el motor primario (y no Pandoc)

Tres razones **de producto**, no de gusto técnico:

1. **Da diagnósticos estructurados, no solo texto convertido.** La API real (verificada en el código de la crate, no en la documentación) es:

   ```rust
   latex_document_to_typst_with_options(input: &str, options: &L2TOptions) -> String
   diagnostics::check_latex(input: &str) -> CheckResult   // Vec<Diagnostic> + contadores
   // Diagnostic { level, message, line, column, span, source_text, suggestion }
   ```

   > ⚠️ **CORREGIDO (S-1).** Los diagnósticos existen y traen incluso `line` y `suggestion`, **pero no sirven como informe para el usuario**. Sobre el proyecto real dieron **34 "errores" en un documento LaTeX perfectamente válido**: `check_latex()` tropieza con `\spanishtablename` (babel en español) en la línea 20 y encadena falsos positivos de entornos sin cerrar. Además solo **2 de 34** traían número de línea.
   >
   > **Fuente real del informe de migración: compilar el resultado con nuestro propio Typst.** El compilador sí da fichero, línea, columna y mensaje exactos — y es la única señal que importa, porque es la que decide si el usuario puede trabajar. `check_latex()` queda como señal interna auxiliar, nunca como texto que se le enseña a nadie.

2. **Vive dentro de nuestro binario.** Es una crate Rust: cero sidecars nuevos, cero instalador inflado, cero gestión de procesos hijo. Contrasta con la decisión ya tomada para Typst (sidecar, `ARCHITECTURE.md` §7.2) — aquí no hace falta porque no hay un CLI oficial que respetar.

3. **Apache-2.0 convive con nuestro MIT sin fricción.** Pandoc es GPL-2.0-or-later: empaquetarlo obliga a acompañar oferta de código fuente y a razonar sobre agregación; sumado a ~150 MB de binario Haskell frente a una app que hoy pesa lo que pesa, **el coste es desproporcionado para el beneficio**.

**Pero Pandoc tiene el mejor lector de LaTeX del mundo**, y hay usuarios que ya lo tienen instalado. De ahí la decisión híbrida:

> **ADR propuesto (ADR-LATEX-001): Tylax como motor embebido por defecto; Pandoc como motor alternativo *detectado*, nunca empaquetado.**
> Si `pandoc` está en el `PATH`, la app lo ofrece como "motor alternativo (avanzado)" y permite reconvertir con él un fichero concreto para comparar resultados. Si no está, no se menciona. Sin GPL en nuestro instalador, sin renunciar al mejor motor para quien lo tenga.

---

## 📦 2. Migración desde Overleaf

### 2.1. Anatomía real del export

| Hecho verificado | Consecuencia de diseño |
| --- | --- |
| El export es un **ZIP con las fuentes** | Reutilizamos `archive.rs` tal cual: ya descomprime ZIP **con doble defensa contra zip-slip** (`enclosed_name()` + comprobación propia). Cero infraestructura nueva. |
| **El ZIP NO incluye el PDF compilado** | ❗ La validación lado a lado (§7) **no puede asumir el PDF original**. Hay que pedirlo explícitamente ("descarga también el PDF") o detectarlo si el usuario lo dejó en la carpeta. |
| Overleaf **intenta autodetectar** el documento principal, y exige que esté **en la raíz** | Nuestra heurística puede ser la misma y es fiable: fichero en la raíz que contenga `\documentclass`. Si hay varios candidatos → preguntar, nunca adivinar en silencio. |
| Un proyecto real tiene **varios `.tex`** unidos por `\input`/`\include` | ⚠️ **CORREGIDO (S-1): lo cubre Tylax.** El módulo `tylax::files` expone `find_latex_includes()`, `IncludeCommand::{Input, Include}` y un resolvedor con directorio base y rutas de búsqueda (estilo `TEXINPUTS`), además de un sistema de ficheros virtual para WASM. **Menos trabajo nuestro del previsto.** Pendiente de validar con el segundo proyecto: el de S-1 es de un solo fichero. |

Fuentes: [Downloading a project — Overleaf docs](https://docs.overleaf.com/managing-projects-and-files/downloading-a-project), [The Main document — Overleaf docs](https://docs.overleaf.com/getting-started/recompiling-your-project/the-main-document), [Multi-file LaTeX projects](https://www.overleaf.com/learn/latex/Multi-file_LaTeX_projects).

### 2.2. Lo que migra gratis (y hay que decirlo en voz alta)

Dos activos del proyecto original **no necesitan conversión ninguna**, y son justo los que más miedo dan al usuario:

- **La bibliografía.** Typst lee `.bib` de BibTeX nativamente (`bibliography()`, CSL, 80+ estilos). El `.bib` se **copia tal cual**. Y nuestra app ya lo explota: `bibliography_keys` + selector de citas con autocompletado ya existen. → *"Tus 300 referencias siguen ahí, y ahora se autocompletan."*
- **Las figuras.** Typst soporta PNG, JPG, GIF, SVG, WebP **y PDF desde 0.14.0**; nosotros vendorizamos **0.15.1**, así que las figuras en PDF (matplotlib, TikZ exportado) **funcionan sin tocarlas**. Única excepción real: **EPS**, no soportado → warning explícito y sugerencia de conversión.

Fuentes: [typst.app/docs/reference/visualize/image](https://typst.app/docs/reference/visualize/image/), [Guide for LaTeX Users](https://typst.app/docs/guides/for-latex-users/), [muchpdf](https://typst.app/universe/package/muchpdf/) (ya no necesario con 0.15.1, se documenta por trazabilidad).

---

## 🧭 3. El asistente de migración — diseño de UX

### 3.1. Flujo

```
[Lanzador]  "Vengo de LaTeX / Overleaf"        ← entrada de primer nivel, no escondida
    ↓
1. ORIGEN        ZIP de Overleaf · carpeta con .tex · un solo .tex
    ↓
2. ANÁLISIS      (sin convertir nada todavía)
                 · documento principal detectado  → confirmar/cambiar
                 · N ficheros .tex, M figuras, X .bib, fuentes propias
                 · clase detectada  → PLANTILLA EQUIVALENTE sugerida
                 · paquetes detectados → clasificados (§4)
    ↓
3. DECISIONES    3 preguntas como mucho, con valor por defecto sensato:
                 · ¿aplicar la plantilla Typst equivalente o conversión literal?
                 · ¿qué hacer con lo no convertible? [MiTeX ▾] (§8)
                 · ¿dónde creo el proyecto nuevo?     (el original NO se toca)
    ↓
4. CONVERSIÓN    barra de progreso por fichero, cancelable
    ↓
5. INFORME       resumen + lista navegable de hallazgos (§6)
    ↓
[Proyecto abierto, compilando, con el informe al lado]
```

### 3.2. Decisiones de diseño que importan

- **El proyecto original nunca se modifica.** Se crea uno nuevo. Es la condición para que el usuario se atreva a pulsar el botón.
- **Análisis antes que conversión.** La pantalla 2 es la que vende: el usuario ve que entendemos *su* proyecto (su clase, sus paquetes, su bibliografía) antes de que toquemos nada.
- **El grafo de ficheros es nuestro.** Resolvemos `\input{cap1}` / `\include{cap2}` → convertimos cada uno a `cap1.typ`, `cap2.typ` → emitimos `#include "cap1.typ"` en el principal. Se conserva **la estructura de carpetas del autor**, que es su mapa mental.
- **Máximo 3 preguntas.** Cada pregunta adicional es un punto de abandono. Todo lo demás son valores por defecto revisables después.
- **Cancelable y reanudable**: una tesis de 300 páginas no puede dejar la app congelada.

---

## 🗺️ 4. Mapa de compatibilidad

### 4.1. Clase de documento → plantilla Typst (**el diferenciador nº 3**)

Hallazgo notable: **nuestro catálogo curado ya cubre casi todas las clases LaTeX frecuentes en el mundo académico.** No hay que construir nada nuevo, solo mapear.

| `\documentclass` | Plantilla Typst | ¿En nuestro catálogo curado? |
| --- | --- | --- |
| `IEEEtran` | `@preview/charged-ieee` | ✅ ya curada |
| `acmart` | `@preview/faithful-acmart` | ✅ ya curada |
| `llncs` (Springer) | `@preview/springer-spaniel` | ✅ ya curada |
| `book`, `report`, `memoir` | `@preview/ilm` | ✅ ya curada |
| `moderncv`, `europasscv` | `@preview/modern-cv` | ✅ ya curada |
| `letter`, `scrlttr2` | `@preview/appreciated-letter` | ✅ ya curada |
| `beamer` | `@preview/touying` | ✅ ya curada (como paquete) |
| `article` genérico | plantilla propia DBV "Artículo académico" | ✅ propia |
| `elsarticle`, `revtex`, clase propia de universidad | — | ⚠️ conversión literal + aviso |

### 4.2. Paquete LaTeX → destino Typst

Base oficial: [Guide for LaTeX Users](https://typst.app/docs/guides/for-latex-users/). Columna "Acción de la app" = lo que hace nuestro asistente, que es donde está el valor.

| Paquete LaTeX | Destino en Typst | Tipo | Acción de la app |
| --- | --- | --- | --- |
| `graphicx`, `svg` | `image()` nativo | Nativo | Silencioso |
| `amsmath`, `amssymb`, `amsfonts` | Matemáticas nativas, `sym` | Nativo | Silencioso |
| `booktabs`, `tabularx`, `tabularray` | `table()`, `grid()` | Nativo | Silencioso |
| `hyperref` | `link()` | Nativo | Silencioso |
| `xcolor` | `text(fill: …)` | Nativo | Silencioso |
| `geometry`, `fancyhdr` | `page()` | Nativo | Silencioso |
| `babel`, `polyglossia` | `text(lang: …)` | Nativo | Silencioso |
| `biblatex`, `natbib`, `bibtex` | `cite()`, `bibliography()` + **el `.bib` original** | Nativo | Copia el `.bib`, informa del estilo |
| `enumitem` | `list`, `enum`, `terms` | Nativo | Silencioso |
| `listings`, `minted` | `raw()` | Nativo | Silencioso |
| `caption`, `subcaption` | `figure()` | Nativo | Silencioso |
| `fontenc`, `inputenc`, `unicode-math` | — (innecesarios) | No-op | Se descartan en silencio |
| `tikz`, `pgfplots` | `@preview/cetz`, `@preview/cetz-plot` | **Universe** | Conversión experimental + **1 clic para instalar** desde el panel Universe que ya tenemos |
| `algorithm2e`, `algpseudocode` | `@preview/lovelace` | **Universe** | Sugerencia + 1 clic |
| `siunitx` | `@preview/unify` | **Universe** | Sugerencia + 1 clic |
| `glossaries` | `@preview/glossarium` | **Universe** | Sugerencia + 1 clic |
| `physics` | `@preview/physica` | **Universe** | Sugerencia + 1 clic |
| `subfig`, `subfigure` | `@preview/subpar` | **Universe** | 🚨 **Prioridad máxima tras S-1:** `\subfloat` provoca **pérdida silenciosa de todas las imágenes de la figura** (proyecto 3: 0 de 8). Requiere regla propia *antes* de convertir, no una simple sugerencia |
| `tcolorbox` | `@preview/showybox` | **Universe** | Sugerencia + 1 clic |
| `makecell` | Salto de línea nativo dentro de la celda | **Regla propia** | ✅ **Añadido tras S-1:** causó 90 de los 117 restos del proyecto 2. Una sola regla arregla el 77 % del daño |
| `longtable`, `tabularx`, `array` (`\arraybackslash`, `\linewidth`) | `table()` con `columns` | **Regla propia** | ✅ **Añadido tras S-1:** 24 restos más del proyecto 2 |
| `todonotes`, `changes`, macros propias | — | **Manual** | Hallazgo en el informe, localizado |

**Observación de producto:** las 7 filas "Universe" son exactamente paquetes **que ya están en nuestro catálogo curado**. El asistente de mapeo no es una funcionalidad nueva aislada: es el **Universe Browser existente, activado por el contexto de la migración**. Coste de implementación bajo, efecto percibido alto.

---

## 📋 5. El informe de migración

### 5.1. Principio de diseño

> Un informe que solo lista problemas es una lista de deberes. Un informe que **te lleva al sitio exacto** es una herramienta.
>
> ✅ **REFORZADO (S-1).** Y un informe que agrupa **por causa** es una decisión. El proyecto 2 produjo 117 incidencias que son, en realidad, **tres**: un paquete sin soporte (`makecell`, 90 veces) y dos comandos de tabla. Regla de diseño derivada del dato: **agrupar siempre por paquete/comando de origen, con el recuento al lado y la lista de ubicaciones plegada debajo.** Nunca 117 filas.

Por eso el informe vive en **dos sitios a la vez**:

1. **Anotado en el propio código**, donde importa:

   ```typ
   // ⚠️ MIGRACIÓN · macro propia sin equivalente: \miNotaTutor{...}
   //    original: \miNotaTutor{revisar con el director}
   ```

2. **Panel navegable** (misma mecánica que el panel de esquema, que ya existe): clic en el hallazgo → salta a la línea. Persistido como `migracion-informe.md` en la raíz del proyecto para que **sobreviva al cierre de la app** y se pueda compartir con un tutor.

### 5.2. Taxonomía de hallazgos

| Severidad | Significado para el usuario | Ejemplo |
| --- | --- | --- |
| ✅ **Convertido** | Hecho, no requiere nada | 42 secciones, 118 ecuaciones, 12 tablas |
| 📦 **Requiere paquete** | Un clic y listo | `tikz` → instalar `cetz` |
| ⚠️ **Revisar** | Convertido, pero el resultado puede no ser fiel | TikZ complejo, tabla con `multirow` anidado |
| 🔶 **Preservado con MiTeX** | Se ve bien, pero sigue siendo LaTeX por dentro (§8) | Entorno no soportado |
| ❌ **Manual** | No hay equivalente; hay que decidir | Macro propia, clase de universidad |

### 5.3. Cabecera del informe (lo primero que se lee)

```
Migración completada · prueba-tesis
────────────────────────────────────────
   ✅ 1.284 elementos convertidos
   📦 3 paquetes sugeridos (instalar con 1 clic)
   ⚠️ 7 elementos para revisar
   ❌ 2 requieren decisión manual

   El documento COMPILA. Puedes empezar a trabajar ya.
```

Esa última línea es la que convierte a un usuario escéptico. Solo se muestra si es verdad — y §8 existe para que sea verdad casi siempre.

---

## 🛟 6. La garantía "nada se pierde" (MiTeX como red de seguridad)

**Este es el hallazgo más valioso de la investigación.**

MiTeX no es un conversor rival: es un paquete de Typst que **renderiza LaTeX dentro del documento ya migrado**. Por tanto, cuando Tylax no sepa convertir algo, no hay que elegir entre "romperlo" o "perderlo":

```typ
#import "@preview/mitex:0.2.7": mitex, mitext

// Bloque que Tylax no supo convertir → se conserva y SE VE BIEN:
#mitex(`\begin{align} ... \end{align}`)
```

Consecuencias:

- **El documento migrado compila siempre**, aunque la conversión sea parcial. Se elimina el peor escenario del usuario (200 errores rojos y abandono).
- Cada bloque MiTeX es, además, **un marcador de trabajo pendiente**: el informe lo lista como 🔶 y el usuario lo va sustituyendo por Typst nativo *a su ritmo*, con el documento funcionando todo el tiempo.
- Migración **incremental**, no de todo o nada.

**Límite honesto que hay que respetar:** MiTeX cubre **matemáticas de forma completa**; su modo texto es "básico / en desarrollo" y **no soporta `\usepackage`**. Por tanto la red de seguridad es sólida para fórmulas y entornos matemáticos, y parcial para texto.

> ⚠️ **PENDIENTE (S-1).** El proyecto 1 **no necesitó MiTeX**: quedó reparado con las tres pasadas de §0.bis y compiló sin él. Es buena noticia —la red se usa menos de lo previsto—, pero significa que **sigue sin probarse**. Hay que forzarla con el proyecto 2 (matemáticas densas, entornos poco comunes) antes de prometerla en la interfaz.

Fuente: [mitex-rs/mitex README](https://github.com/mitex-rs/mitex).

---

## 🔍 7. Validación lado a lado — alcance honesto

Lo que **se puede** hacer con lo que ya tenemos, sin investigación adicional:

| Comprobación | Coste | Valor |
| --- | --- | --- |
| **Comparación visual página a página** (PDF original ↔ PDF migrado) | Bajo: el visor de preview ya pinta páginas; es un segundo panel | Alto — es lo que el usuario haría a mano |
| **Contraste estructural** (nº de páginas, secciones, figuras, tablas, citas, ecuaciones antes/después) | Bajo: `typst eval query(heading)` ya se usa para el esquema; el lado LaTeX sale del análisis de §3 | Alto — detecta pérdidas silenciosas (*"tenías 42 secciones, hay 41"*) |
| Diff pixel a pixel automático | Alto (rasterizado + tolerancias + falsos positivos por tipografía) | Bajo — Typst **no debe** producir un PDF idéntico; la tipografía es distinta a propósito |

**Restricción dura ya identificada:** el ZIP de Overleaf **no trae el PDF**. El asistente debe pedirlo en la pantalla de origen ("*si quieres comparar, arrastra también el PDF original*") y degradar limpiamente a solo contraste estructural si no está.

**Recomendación:** comparación visual + contraste estructural. **Descartar el diff automático** por ahora: es donde más esfuerzo se gasta y menos confianza se gana.

---

## ⚠️ 8. Riesgos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| **Tylax depende de un autor único** y va por v0.3.x | Alto — es nuestro motor primario | Apache-2.0 permite fork; el motor queda **detrás de una interfaz propia** (`trait ConversionEngine`) para poder sustituirlo por Pandoc/otro sin tocar el asistente |
| **La calidad real sobre tesis reales es desconocida** | Alto — condiciona toda la promesa | **Spike S-1 bloqueante** (§11) con 3 proyectos reales antes de comprometer alcance |
| Sobrepromesa en marketing ("convierte tu tesis") | Alto — quema la confianza en la primera decepción | Lenguaje de producto ya fijado en §0: continuidad + transparencia, nunca "perfecto" |
| Migración de proyecto grande bloquea la interfaz | Medio | Conversión en tarea cancelable con progreso, patrón ya usado en la compilación |
| El usuario migra y **pierde** su original | Crítico si ocurre | El original **nunca** se toca: siempre proyecto nuevo (§3.2) |
| TikZ complejo mal convertido sin avisar | Medio | Tylax marca TikZ como experimental → se degrada a ⚠️ **siempre**, nunca silencioso |
| 🚨 **Pérdida silenciosa de contenido** (confirmada en S-1: 8 figuras de 8) | **Crítico** — rompe la confianza justo donde se prometía transparencia | **Contraste estructural obligatorio en v1.0** (§0.bis) + regla propia para `subfig` antes de convertir + reporte del fallo aguas arriba a Tylax |

---

## 📜 9. Créditos y cumplimiento de licencias

Requisito explícito del usuario: **si usamos estos proyectos, se mencionan siempre**. Además, Apache-2.0 lo **exige** legalmente (§4 de la licencia: copia de la licencia, avisos de copyright, indicación de cambios).

| Proyecto | Licencia | Obligación | Dónde se cumple |
| --- | --- | --- | --- |
| **Tylax** | Apache-2.0 | Copia de licencia + aviso + indicar modificaciones si las hay | `NOTICE` en la raíz + panel "Acerca de → Créditos" + `README` |
| **MiTeX** | Apache-2.0 | Ídem; además el `#import` queda visible en el documento del usuario | Ídem + informe de migración cuando se usa |
| **Typst** | Apache-2.0 | Ya vendorizado hoy | Ya cumplido |
| **Pandoc** | GPL-2.0-or-later | Solo si se **distribuye**; con el modelo "detectado en el sistema" **no se distribuye** → sin obligación | Se menciona igualmente en Créditos por cortesía |

**Acción concreta propuesta:** añadir un apartado **"Créditos"** al panel "Acerca de" ya existente (no una pantalla nueva), con nombre, licencia, enlace al repositorio y una línea de agradecimiento por proyecto. Es lo correcto y, además, señal de seriedad para la comunidad Typst — de la que este producto quiere ser buen vecino.

---

## 🚀 10. Roadmap recomendado

> 🔴 **DECISIÓN DEL 2026-09-06 — este roadmap NO está aprobado (ver `memory.md`, ADR-LATEX-001).**
> Tras el spike S-1 (§0.bis), la migración **se aplaza como pilar de v1.0** y pasa a **investigación viva**. Motivo: con tres proyectos la curva de descubrimiento de fallos **no se ha aplanado** — el tercero reveló una clase nueva (pérdida silenciosa), no una repetición.
> **No se aplaza esperando a que maduren las herramientas de terceros**: el trabajo que falta es casi todo nuestro (identidad, contraste estructural, agrupación por paquete, bucle de reparación) y esperar no lo adelanta.
> **Disparador de reevaluación:** ~6 proyectos medidos sin clases nuevas de fallo, **o** que Tylax corrija el fallo de `subfig`.
> Las fases de abajo se conservan como **plan de referencia para cuando se retome**, con las versiones ya sin valor de compromiso.

**Nota de encuadre:** el encargo pedía repartir entre "v0.2 / v1.0 / v1.x", pero v0.2 **ya está entregada** y la Beta está funcionalmente completa (`SPECIFICATIONS.md` §11, `task.md`). La traducción honesta era: **próximo incremento (v0.5) / v1.0 / v1.x**.

| Fase | Alcance | Versión | Por qué ahí |
| --- | --- | --- | --- |
| **S-1 — Spike** | ✅ **Cerrado con dos proyectos reales (§0.bis): la promesa se sostiene, pero solo con el bucle de reparación.** Ambos compilan con 0 errores. Sin probar: multi-fichero, MiTeX, TikZ y EPS — ausentes en los dos proyectos | ✅ **Hecho (2026-09-06)** | Bloqueante, y ya desbloqueado: se puede pasar a `/specs` |
| **A — Importar un `.tex`** | Un fichero → un `.typ`, con informe básico. Tylax embebido tras `trait ConversionEngine` | **v0.5** | Valida el motor con riesgo mínimo |
| **B — Proyecto multi-fichero** | Grafo `\input`/`\include`, figuras, `.bib`, estructura de carpetas | **v0.5** | Es donde empieza a ser útil de verdad |
| **C — Importar ZIP de Overleaf** | Reutiliza `archive.rs`; detección de documento principal; asistente completo (§3) | **v1.0** 🚩 | **La funcionalidad de lanzamiento.** Es el titular: *"Importa tu proyecto de Overleaf"* |
| **D — Asistente de mapeo** | Clase → plantilla; paquetes → Universe con instalación en 1 clic (§4) | **v1.0** 🚩 | Es el "wow". Y es barato: reutiliza el Universe Browser existente |
| **E1 — Contraste estructural** | Contar en origen y destino: figuras, tablas, secciones, citas. Avisar de toda diferencia | **v1.0** 🚩 | ⚠️ **SUBIDO desde v1.x tras S-1.** Es lo único que detectó la pérdida silenciosa de 8 figuras (§0.bis). Sin esto, la promesa de §0 es falsa justo cuando más importa |
| **E2 — Informe avanzado + comparación visual** | Informe navegable persistido, PDF original ↔ PDF migrado lado a lado (§5, §7) | **v1.x** | Refuerza confianza; no bloquea el lanzamiento |
| **F — Motor Pandoc opcional** | Detectado en el `PATH`, nunca empaquetado | **v1.x** | Para usuarios avanzados; sin coste de instalador |

**Recomendación estratégica:** **C + D son el lanzamiento**, y deben salir juntas. "Importar de Overleaf" sin el mapeo de plantilla/paquetes es un conversor más; con él, es *"la aplicación que entiende de dónde vienes"*. A y B son los peldaños internos para llegar ahí, no hitos de marketing.

---

## ❓ 11. Preguntas abiertas (para el usuario)

- [x] **¿Se acepta el encuadre de §0?** → El spike lo **refuerza**: el valor está en la capa de producto (identidad, informe, detección de pérdidas), no en convertir. Sigue vigente para cuando se retome.
- [x] ¿Se aprueba **ADR-LATEX-001**? → **Sí, pero con el contenido cambiado por los datos.** El ADR registrado el 2026-09-06 no es "Tylax embebido vs Pandoc" (eso queda como recomendación técnica en §1.2): es **el aplazamiento de la migración como pilar de v1.0**. Ver `memory.md`.
- [x] ¿La migración es **el pilar de v1.0**? → **No.** Aplazada a investigación viva, con disparador de reevaluación explícito (§10).
- [x] **¿Proyectos reales para S-1?** → Aportados tres por el usuario y medidos (§0.bis). Dos sin publicar, tratados solo en local.
- [ ] ¿Se guarda en el repositorio el **banco de pruebas** (`spike-s1`, Rust) y el catálogo de reparaciones ejecutable, o se acepta reescribirlo desde §0.bis si se retoma? *(Hoy vive en un directorio temporal de sesión y se perderá.)*
- [ ] ¿Se **reporta el fallo de `subfig` a Tylax** ahora (caso mínimo ya aislado) o se espera a retomar el trabajo?
- [ ] Cuando se retome: ¿"Migración" entra en el **Lanzador como entrada de primer nivel**, o como acción secundaria?
- [ ] Cuando se retome: ¿el informe persistido (`migracion-informe.md`) viaja dentro del `.dbvt`, o es efímero?

---

**Instrucción para la IA:** Este informe es la fuente de verdad de la estrategia de migración LaTeX → Typst, y está **ABIERTO, no aprobado**: la decisión vigente es **ADR-LATEX-001** (`memory.md`, 2026-09-06), que aplaza la migración como pilar de v1.0 y la deja como investigación viva. **No se planifica ni se construye nada de este informe sin reabrir antes esa decisión con el usuario**, y solo se reabre si se cumple su disparador (~6 proyectos medidos sin clases nuevas de fallo, o `subfig` corregido aguas arriba).

Si aparece un proyecto LaTeX real nuevo, **medirlo es barato y es la actividad de mayor valor de esta línea**: registrar el resultado en §0.bis y actualizar la cuenta del disparador. Todo hallazgo que contradiga este informe se corrige aquí primero (marca `⚠️ CORREGIDO`, como en `TYPST_ECOSYSTEM_RESEARCH.md`) y se propaga después a `memory.md`; `SPECIFICATIONS.md` **no** se toca mientras la decisión siga siendo el aplazamiento.
