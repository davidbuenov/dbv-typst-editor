# 📋 Especificaciones: DBV Typst Editor

> **Fase:** `/spec` (Especificación) → **v0.13.1 especificada**
> **Estado:** 🔒 **CONGELADO v1.18 — 2026-10-03.** v1.18 abre v0.13.1 (§5o: **RF-99 a RF-106**) tras la prueba real de la IA con modelos locales (Gemma 4, `qwen2.5:3b`, `qwen3:8b`) y con Claude: una propuesta que no existe no se anuncia como hecha (RF-99, ya construido), el razonamiento del modelo se ve en un bloque plegable con indicador de actividad (RF-100), interruptor «Razonamiento» por conexión desactivado por defecto (RF-101), velocidad y tiempo en el panel (RF-102), aviso de modelo pequeño y de contexto insuficiente con el mínimo recomendable (RF-103) evaluación con recomendación de modelos con datos (RF-104) y que la IA separe presentación de contenido, con el estilo en ficheros de estilo (RF-105), y crear un documento `.typ` suelto sin crear un proyecto (RF-106). La 0.13.0 no se publica en la Store; recibirá la 0.13.1 (`ADR-V0130-005`).
> **v1.17 (2026-10-02):** v1.17 abre v0.13.0 (§5n: **RNF-IA, RF-90 a RF-98 y RNF-IA-EVAL**): IA integrada y opcional, con conexiones directas (locales o con clave de API) y agentes instalados por ACP (Claude Code, Gemini CLI, Codex, Copilot); panel de conversación con el proyecto como contexto y cambios en varios ficheros que se revisan y se comprueban compilando antes de aplicarse; IA en línea sobre la selección; documentación de Typst generada para la versión vendorizada, offline, para la IA y para el usuario; panel de Problemas con «Explicar y arreglar»; y visor de datos CSV/TSV. Adelanta la IA, que §6 y §11 tenían como «Futuro post-1.0», y matiza el riesgo de privacidad de §8. Decisiones en `ADR-V0130-001` (`memory.md`).
> **v1.16 (2026-09-29):** v1.16 abre v0.12.1 (§5m: **RF-86 a RF-89**): la vista previa estrecha no se sale del panel, se retira el conmutador de motor (modifica RF-56.6) y los sidecars van intactos en el AppImage con la insignia de Tinymist traducida (RF-86 a RF-88, ya construidos fuera de ciclo); y el esquema sale del motor en proceso y dice por qué no lo hay (RF-89, recupera RF-56.7). Decisiones en `ADR-V0121-001` (`memory.md`).
> **v1.15 (2026-09-28):** *(Precisado en `/plan` el mismo día con lo comprobado contra los binarios reales: RF-77.1, .4, .5 y .9, RF-79.6, RF-81.4 y RF-84.3, y **RF-85** nuevo, la corrección de un fallo publicado. Ver `ADR-V0120-001`.)* v1.15 abre v0.12.0 (§5l: **RF-74 a RF-84**): autocompletado completo y ayuda de firma, zoom que conserva la página y «Proyecto en blanco» más a mano (RF-74 a RF-76, ya construidos fuera de ciclo); navegar y refactorizar con Tinymist; buscar y reemplazar en el proyecto; pestañas; atajos documentados; snippets de usuario; buscar y copiar en la vista previa; el documento principal en el manifiesto (modifica RF-53.4); y actualizaciones incrementales del AppImage. Cierra RF-67: el motor clásico se queda como está. Decisiones en `ADR-V0120-001` (`memory.md`).
> **v1.14 (2026-09-26):** v1.14 abre v0.11.0 (§5k: **RF-68 a RF-73**): conflicto externo decidido por contenido (arregla el guardado automático), operaciones de ficheros en el panel Archivos, actualización automática de referencias al mover o renombrar, acción «Nuevo capítulo…», enlaces funcionales en la vista previa e historial local de versiones. Decisiones en `ADR-V0110-001` (`memory.md`).
> **v1.13 (2026-09-21):** v1.13 abre v0.10.0 (§5j: **RF-61 a RF-67**): arreglo de Formatear, resaltado de BibTeX, pulido (ocultos, números de línea, refresco), guardado automático opcional con indicador de modificado, ruta corta, no compilar los no principales y análisis previo sobre retirar el motor clásico. **Anterior — v1.12 (2026-09-20).** v1.12 abre v0.9.0 (§5i: **RNF-MOTOR, RF-56 a RF-60**): motor de vista previa **en proceso** (Typst como librería) con sincronización exacta por palabra y frase en los dos sentidos, velocidad tras cada edición, menú contextual del editor, diagnósticos en línea y edición de ficheros de texto/código con resaltado. Decisión de arquitectura en `ADR-MOTOR-001` (`memory.md`); **RF-16 queda sustituido por RF-57 en el motor en proceso** y se conserva en el motor clásico de respaldo.
> **v1.11 (2026-09-19):** v1.11 añade §5h (**RNF-PERF, RF-53, RF-54, RF-55**), registrada **a posteriori** en `/ship` de v0.8.0 (ver `ADR-V080-001` en `memory.md`).
> **v1.10 (2026-09-15):** v1.10 añade **RF-52** (botón "?" de ayuda contextual en cada asistente de diagramación) tras probar el usuario en vivo el asistente de DOT/Graphviz recién construido: sin ninguna ayuda visual de sintaxis (a diferencia de los otros cinco asistentes, que sí construyen el código por ti), quien no conoce el lenguaje DOT se queda sin saber qué escribir. Ver criterios de aceptación al final de §5g.
> **v1.9:** v1.9 activó RF-50 (Kanban) y RF-51 (DOT/Graphviz) de forma incondicional: v1.8 los había dejado como un único RF-50 condicional ("si sobra alcance de `/plan`"); con `/build`, `/test` y `/code-simplify` de los otros 9 RF de v0.7.0 (RF-40 a RF-49) cerrados y probados en vivo por el usuario el mismo día, el usuario decidió completar también esta parte para cerrar v0.7.0 con el alcance íntegro del `/spec` original, en vez de diferir nada a una versión futura. Los dos requisitos quedan detallados al mismo nivel que RF-46 a RF-49 (criterios de aceptación concretos, no solo el nombre del paquete), con nombre/versión/licencia/API de `kantan` y `diagraph` verificados contra el registro real de Typst Universe y sus READMEs reales, no asumidos — ver `ADR-DECISION-006` en `memory.md`.
> **v1.8:** v1.8 abrió v0.7.0 (§5g, RF-40 a RF-50) tras una pasada de uso real del usuario con un proyecto externo (un glosario técnico-administrativo con imágenes y fuentes propias) que destapó tres defectos de UX vivos en la aplicación —un aviso benigno de `ResizeObserver` mostrado como error de la app, el separador editor/vista previa bloqueable al arrastrarlo, y los atajos de zoom capturados por el zoom nativo del webview en vez de por la app— más dos reorganizaciones de menú pedidas al ver la app en marcha (Guardar/Guardar como/PDF/PNG a "Archivo"; el editor de diagramas de RF-31 visible en "Herramientas" en vez de un icono suelto en la barra del editor), un rediseño de la pantalla de inicio, un **nuevo editor visual interactivo de ecuaciones matemáticas**, y tres ampliaciones de diagramación (flujogramas con decisiones, diagramas de secuencia, diagramas de Gantt) priorizadas explícitamente contra la Sección XI ("Application of Typst for Computer Science") de Voynov, A., Corbi, A., López-Oliver, P., & Gil, D. (2026), *"Typst: A Modern Typesetting Engine for Science"*, IJIMAI 9(7), 107–120, ya indexado como referencia en `README.md`/`README.en.md` — uno de sus autores, Alberto Corbi, es colaborador de este proyecto.
> **v1.7:** v1.7 abre v0.6.0 (§5f, RF-31 a RF-38) en una sola pasada, a petición explícita del usuario tras la dinámica de v0.5.0 (tres reaperturas del mismo `/spec`): editor WYSIWYG de diagramas que sustituye al asistente CeTZ de RF-23, menú "Herramientas" en la cabecera, alcance de integración con GitHub (clonar por URL, decisión del usuario cerrando la pregunta abierta de §5e.1/§9), Universe Browser completo, bibliografía visual completa, empaquetado macOS, auto-actualizador y ejecución de módulos JavaScript con el paquete Typst Universe `jogs` (runtime QuickJS embebido, análogo al runner de Python de RF-22).
> **v1.5:** v1.4 consolidó el lanzador (§5d, RF-25 a RF-27, con la precisión de RF-26 criterio 10 añadida el mismo día). **v1.5 añade §5e** —RF-28 (chincheta de ventana encima, portada de DBV Markdown Reader) y RF-29 (ver la previsualización de plantilla a tamaño grande)— tras probar el usuario la aplicación construida, más **§5e.1, que documenta el alcance real de la integración con Git** y por qué NO es integración con GitHub. Ver `ADR-VENTANA-001` en `memory.md`. (baseline de especificación v0.5.0, ampliada). v1.3 especificó el salto a productividad profesional y robustez (v0.5.0): Integración con Git y resolución visual de conflictos (RF-19), Galería visual de plantillas con previsualización (RF-20), Inteligencia de código con Tinymist LSP vendorizado (RF-21), Figuras y datos dinámicos con Python (RF-22), Asistente visual de diagramas CeTZ (RF-23), y Robustez de entorno y guardado atómico (RF-24). **v1.4 reabre ese `/spec`, a decisión del usuario y antes de entregar la versión, para consolidar el lanzador** (§5d): Lanzador de una sola vía (RF-25), Galería unificada de creación de documentos (RF-26) y Tokens semánticos de estado (RF-27). El motivo es que `/build` de v0.5.0 dejó **tres** superficies distintas para elegir plantilla; ver `ADR-LANZADOR-001` en `memory.md`.
> **Regla de congelación:** a partir de aquí, cualquier cambio de alcance o de requisito exige (1) registrarlo como ADR en `memory.md`, (2) actualizar este documento con nueva versión, y (3) revisar el impacto en `implementation_plan.md`. No se modifican requisitos "al vuelo" durante `/build`.
> **Documento de diseño:** el sistema visual que rige §5d está en [`DESIGN.md`](./DESIGN.md), escrito el 2026-09-09 (deuda documental abierta desde el `/spec` original, saldada al abordar este rediseño).
> **Última Revisión:** 2026-10-02

---

## 🎯 1. Contexto y Objetivos

- **Problema:** Redactar documentos académicos y técnicos de calidad profesional (TFG, TFM, tesis, artículos, informes) hoy obliga a elegir entre LaTeX (potente pero con una curva de entrada alta, compilación lenta y sintaxis verbosa) o editores online (Overleaf, la propia web de Typst) que exigen conexión permanente. [Typst](https://typst.app) resuelve la parte del lenguaje de composición, pero el ecosistema actual (Typst Web App, VS Code + extensiones, editores genéricos) sigue orientado a **desarrolladores que piensan en sintaxis**, no a un profesor, doctorando o estudiante que piensa en "quiero escribir mi TFG", no en "quiero editar código".
- **Objetivo (Éxito):** Disponer de un editor de escritorio (Windows/Linux, macOS en fase posterior) que permita **crear y escribir documentos académicos orientados al resultado final** (no al lenguaje subyacente), con vista previa PDF en tiempo real, offline-first y consumo de RAM comparable al de DBV Markdown Reader (el tamaño del instalador **deja de ser una restricción dura** por decisión del usuario del 2026-09-04, al asumir el peso del compilador Typst vendorizado; el arranque en frío y la RAM sí siguen siendo objetivos), reutilizando al máximo su arquitectura ya validada. El detalle técnico completo vive en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## 🧭 2. Filosofía de Producto (Spec Addendum + posicionamiento)

> Esta sección resume e integra el *Spec Addendum* y el feedback de posicionamiento recibidos del usuario el 2026-09-04, que redefinen el posicionamiento del producto. Tiene prioridad sobre cualquier formulación anterior de este documento en caso de conflicto.

**Posicionamiento oficial del producto (fijado explícitamente por el usuario):** *"El entorno de escritorio más accesible para el ecosistema Typst"* — **no** *"un editor de código con soporte Typst"*. Consecuencia directa: Typst aporta la infraestructura (compilador, gestión de paquetes, plantillas, ecosistema); **DBV Typst Editor aporta la experiencia** (gestión de proyectos, flujos académicos, exploración visual, productividad) — ver principios arquitectónicos completos en `ARCHITECTURE.md` §0.1.

**DBV Typst Editor no es "otro editor de código para Typst".** Ya existen alternativas para ese perfil (Typst Web App, VS Code + extensiones, editores genéricos). El objetivo es ser **para Typst lo que Obsidian es para Markdown**: simplicidad, accesibilidad, experiencia agradable, baja curva de aprendizaje, útil tanto para quien no sabe qué es Typst como para un usuario avanzado.

Consecuencias de diseño directas:

1. **Orientado al documento, no a la tecnología.** El usuario piensa "crear un TFG", "escribir una tesis", "generar un CV" — no "función", "macro", "paquete" o "sintaxis". Toda la UI debe formularse en esos términos.
2. **El usuario no debe ver código si no quiere.** Los asistentes de inserción rápida (§5.6) y el asistente de creación de proyecto (§5.3) existen precisamente para que gran parte del trabajo se pueda hacer sin tocar sintaxis Typst directamente.
3. **La app no arranca en un editor vacío.** Arranca en un lanzador orientado a tareas (§5.1) — el usuario empieza pensando en el resultado, no en un fichero en blanco.
4. **Las plantillas son una funcionalidad de primer nivel**, no un extra — probablemente la funcionalidad más importante del producto junto con la vista previa PDF (ver orden de prioridades en §11).
5. **El acceso al ecosistema Typst (Universe Browser: plantillas y paquetes, §6) es en sí mismo un punto de entrada de primer nivel de la aplicación**, no una funcionalidad secundaria — el valor de DBV Typst Editor no es solo editar ficheros Typst, es hacer accesible todo el ecosistema oficial de Typst sin que el usuario tenga que salir de la app ni tocar la línea de comandos. Siempre que sea posible ("Universe-First"), se prefiere consumir recursos oficiales del ecosistema antes que construir infraestructura paralela propia — ver `ARCHITECTURE.md` §0.1 y §7.6.
6. Esto es coherente con, y refuerza, la decisión arquitectónica de **CodeMirror 6** ya tomada en `ARCHITECTURE.md` §7.1: Obsidian —la referencia explícita de esta filosofía— está construido internamente sobre CodeMirror 6, no sobre Monaco. Ver la re-evaluación completa (incluyendo la petición explícita de evaluar Monaco) en `ARCHITECTURE.md` §7.1.

## 👥 3. Usuarios y Escenarios

- **Perfiles de usuario:** Profesorado universitario, personal investigador, doctorandos, estudiantes universitarios (TFG/TFM), escritores técnicos. Incluye explícitamente usuarios **sin conocimiento previo de Typst**.
- **Escenarios clave:**
  - *Escenario A (lanzador):* Un estudiante abre la app por primera vez y ve "¿Qué quieres crear hoy?" con opciones TFG/TFM/Tesis/Artículo/Presentación/Apuntes/Informe/CV — no una pantalla en blanco.
  - *Escenario B (asistente de proyecto):* Selecciona "TFG", rellena un formulario (Título, Autor, Tutor, Universidad, Curso, Titulación) y la app genera automáticamente el proyecto completo ya maquetado, sin que el usuario edite variables a mano.
  - *Escenario C (redacción):* Un doctorando escribe un capítulo con ecuaciones y citas bibliográficas, y ve el PDF actualizado en menos de 1 segundo tras cada pausa de escritura, sin pulsar ningún botón de "compilar".
  - *Escenario D (inserción asistida):* Para insertar una figura, el usuario arrastra una imagen al editor o pulsa el botón "Insertar figura" — no escribe `#figure(image(...))` de memoria.
  - *Escenario E (navegación):* En una tesis de 200 páginas, el usuario navega por el panel de esquema (Introducción → Objetivos → Estado del arte...) en vez de hacer scroll manual.
  - *Escenario F (offline):* Un profesor sin conexión a internet sigue trabajando sin degradación — incluidas las plantillas ya instaladas previamente.
  - *Escenario G (compartir):* Un profesor exporta su proyecto de TFG como archivo `.dbvt` portable y se lo envía a un estudiante como plantilla de ejemplo, sin explicar estructura de carpetas.

## 📁 4. Modelo de Proyecto

La unidad de trabajo principal **no es un fichero `.typ` suelto**, es un **proyecto**. Estructura de referencia:

```text
mi-tfg/
├── main.typ        # Documento principal (importa el resto)
├── refs.bib         # Bibliografía
├── chapters/         # Capítulos/secciones en ficheros separados (documentos largos)
├── images/           # Imágenes del proyecto
├── assets/           # Otros recursos (plantillas de estilo, fuentes locales...)
└── settings/          # Metadatos del proyecto (manifiesto DBV, no de Typst)
```

Toda la aplicación (lanzador, asistente de creación, explorador de ficheros, exportación, archivo `.dbvt`) se diseña alrededor de esta unidad "proyecto", no de "fichero individual". Un `.typ` suelto (compatibilidad con documentos existentes/importados) sigue pudiendo abrirse directamente y se trata como un proyecto de un único fichero. Arquitectura de detalle en `ARCHITECTURE.md` §7.5.

## ✨ 5. Funcionalidades Principales — MVP v0.1

> Alcance del MVP acotado explícitamente por el usuario: *proyectos, editor, PDF live preview, plantillas básicas, exportación PDF, project archive.* El resto de funcionalidades del Spec Addendum (marketplace, navegación estructural, exportación PNG/SVG...) se difieren a Beta/v1.0 — ver §6.
>
> **Corrección de alcance v1.2 (2026-09-05):** la **barra de herramientas de inserción** quedó agrupada por error con los "asistentes de inserción" y diferida entera a Beta. Se separa y sube a **v0.2** como **RF-13** (ver más abajo); solo los asistentes que abren mini-formulario siguen en Beta. Motivo en ADR-EDITOR-002.

- [ ] **RF-01 Lanzador orientado a tareas:** Pantalla inicial "¿Qué quieres crear hoy?" con las plantillas básicas (§RF-04) + acceso a proyectos recientes/existentes. No hay editor vacío por defecto.
- [ ] **RF-02 Modelo de Proyecto:** Crear/abrir una carpeta de proyecto con la estructura de §4. Explorador de proyecto lateral (reutilizando `filetree.js` de DBV Markdown Reader).
- [ ] **RF-02b Apertura de proyectos existentes (flujo de primer nivel):** La app debe funcionar igual de bien con proyectos **no creados por DBV** — repositorios Git clonados, proyectos Typst preexistentes, plantillas comunitarias instaladas y proyectos hechos a mano. El manifiesto `settings/dbv-project.toml` es **opcional**: su ausencia nunca degrada la experiencia (solo desactiva lo que dependa de metadatos DBV, como los campos del asistente). Un `.typ` suelto se abre como proyecto de un fichero.
- [ ] **RF-02c Operaciones de proyecto:** "Abrir carpeta de proyecto", "Mostrar carpeta en el explorador del SO" (`reveal_in_file_manager`, ya portable desde DBV Markdown Reader) y "Proyectos recientes" (mecanismo de recent-files portado). Alto valor diario, coste de implementación mínimo por ser código heredado.
- [ ] **RF-03 Asistente de creación de proyecto:** Diferenciador de producto explícito (`ARCHITECTURE.md` §7.6.4) — el usuario debe sentir que crea un documento, no que inicializa un paquete. Formulario de metadatos por plantilla con campos base (nombre del proyecto, título, autor, institución, supervisor/tutor, curso/año académico) más los específicos de cada plantilla, que genera el proyecto sustituyendo variables automáticamente sobre el scaffolding oficial (`typst init`) — el usuario no edita variables a mano si no quiere.
- [ ] **RF-04 Plantillas básicas (catálogo curado inicial, alcance v1.1):** **Proyecto en blanco**, **TFG**, **Artículo académico** y **CV** — instaladas de fábrica, sin marketplace todavía (eso es Beta, §6). "Proyecto en blanco" es un proyecto Typst mínimo y válido, pensado para usuarios avanzados que prefieren empezar vacíos. TFM, Tesis doctoral, Informe técnico y Presentación se difieren a **v0.2** (decisión de alcance aprobada por el usuario al autorizar `/build`).
- [ ] **RF-05 Editor de código Typst:** CodeMirror 6 (decisión y re-evaluación completa en `ARCHITECTURE.md` §7.1) — resaltado de sintaxis Typst, autocompletado léxico/snippets, numeración de líneas, plegado de bloques, búsqueda y reemplazo, atajos de teclado profesionales, selección múltiple (multi-cursor nativo).
- [ ] **RF-06 Vista previa PDF en tiempo real:** Recompilación automática con debounce tras cada pausa de escritura; debe sentirse instantánea. Compilación vía el CLI oficial de Typst vendorizado como sidecar (no crates embebidas); estrategia técnica (SVG por página) en `ARCHITECTURE.md` §7.2-7.3.
- [ ] **RF-07 Guardar / Guardar como:** Persistencia en disco, con detección de cambios externos concurrentes (modal de conflicto heredado de DBV Markdown Reader).
- [ ] **RF-08 Temas claro/oscuro:** Reutilización directa del sistema de tokens CSS de DBV Markdown Reader.
- [ ] **RF-09 Configuración persistente:** Tema, tamaño/posición de ventana, últimos proyectos, nivel de zoom.
- [ ] **RF-10 Exportación PDF:** El PDF real, fiel al documento compilado, es el artefacto final que el usuario exporta/comparte (vía el sidecar CLI, `typst compile ... -`, sin fichero temporal — `ARCHITECTURE.md` §7.2).
- [ ] ~~**RF-11 Project Archive (`.dbvt`)**~~ → **diferido a v0.2** (decisión de alcance aprobada por el usuario al autorizar `/build`): exportar/importar el proyecto completo como archivo portable único. Formato ya diseñado en `ARCHITECTURE.md` §7.12, listo para implementar sin re-análisis. Motivo del diferimiento: no está en el camino crítico del bucle de valor (crear → editar → previsualizar → exportar PDF), que es lo que v0.1 debe validar.
- [ ] **RF-13 Barra de herramientas de inserción del editor (v0.2 — ADR-EDITOR-002):** Barra permanente sobre el editor con los botones que emiten marcado Typst en la posición del cursor, sin que el usuario memorice sintaxis. Cubre (a) **paridad** con la barra de DBV Markdown Reader —formato en línea, encabezados, listas, enlace, imagen, cita, bloque de código, tabla, regla— y (b) los **elementos propios de Typst** que Markdown no tiene: ecuación, referencia cruzada, etiqueta, cita bibliográfica, salto de página. Requisitos de calidad, no opcionales (el listón es superar al editor web oficial de Typst, no solo igualar a DBV Markdown Reader): envolver la selección en vez de solo insertar, alternar el marcado al volver a pulsar, **un solo paso de deshacer por acción**, sensibilidad al contexto (los botones cambian dentro de `$...$`), atajo de teclado con el atajo visible en el tooltip, textos ES/EN y funcionamiento sin conexión. Inventario de botones y marcado generado en `ARCHITECTURE.md` §7.7. *No incluye* los asistentes con formulario (galería de símbolos con búsqueda, diálogo de tabla, cita con autocompletado sobre el `.bib`), que siguen en Beta — §6.

- [ ] **RF-12 Empaquetado:** Instalador para Windows (NSIS) y Linux (AppImage + .deb), reutilizando la configuración CI de DBV Markdown Reader, más el vendorizado del binario `typst` por plataforma (`ARCHITECTURE.md` §7.2, §6).

## ✨ 5b. Funcionalidades — v0.4.0 (Beta)

> Alcance fijado con el usuario el 2026-09-08, a partir de dos peticiones de uso real (sincronización
> editor↔vista previa; el botón "Fig" debería ofrecer las imágenes del proyecto como hace "Cite" con
> las claves del `.bib`) y de los resultados medidos del **Spike S-2** (`spikes/preview-sync/README.md`).
>
> **Enmienda de especificación:** §6 y §11 prometían la sincronización *"por posición real de fuente
> (no por anclas)"* apoyada en el LSP `tinymist`. El Spike S-2 demuestra que eso es **inalcanzable con
> la arquitectura de sidecar** —Typst no expone el `span` de origen en el API de scripting ni anota el
> SVG—, y §9 ya había descartado `tinymist` al resolver las posiciones del outline. La cláusula queda
> **sustituida** por el mecanismo de anclas, con sus limitaciones escritas aquí de forma explícita.
> `tinymist` se conserva como posible mejora futura de precisión, nunca como dependencia.

- [ ] **RF-14 Alcance de la vista previa: el documento completo, conmutable.** La vista previa compila
  el **documento raíz** del proyecto (el `entrypoint` ya resuelto por `pick_entrypoint()` o por el
  manifiesto), no el fichero abierto. Un conmutador en la barra de la vista previa permite volver a
  "solo este fichero". *Motivo:* compilar el capítulo suelto no es solo un alcance distinto, es
  **incorrecto** — sin el raíz no hay bibliografía, ni numeración de páginas, ni referencias cruzadas,
  y el capítulo real de `testfiles/demo-proyecto` ni siquiera compila (`label <knuth1984> does not
  exist`). Es además condición necesaria de RF-16.
  - **Criterios de aceptación:** (a) editar un capítulo muestra el documento entero, con su
    bibliografía y su numeración reales; (b) los cambios **sin guardar** del capítulo se ven en esa
    vista previa; (c) un `.typ` suelto sin proyecto sigue funcionando igual que hoy; (d) el conmutador
    persiste por proyecto; (e) la pista de "no hay bibliografía" (Slice 27) deja de dispararse en el
    modo por defecto, porque su causa desaparece.

- [ ] **RF-15 Control de refresco de la vista previa: automático o manual.** Dos modos, conmutables
  desde la barra de la vista previa: **automático** (recompilar tras la pausa de escritura, el
  comportamiento actual) y **manual** (no recompila sola; un botón "Refrescar" y su atajo disparan la
  compilación). *Motivo:* no es una comodidad, es **requisito** de RF-14. Medido en el Spike S-2:
  compilar el documento completo cuesta **×9** lo que cuesta el capítulo (828 ms frente a 91 ms en una
  tesis de 202 páginas) y **supera la pausa de tecleo** de 350 ms; en automático el compilador estaría
  corriendo casi sin parar. En proyectos pequeños no hay problema (136 ms el proyecto de demo entero).
  - **Criterios de aceptación:** (a) en modo manual, escribir no dispara ninguna compilación; (b) la
    vista previa se marca **visiblemente como desactualizada** cuando hay cambios sin recompilar —
    nunca se muestra contenido viejo como si fuera actual; (c) el modo persiste por proyecto; (d) se
    descarta de momento un tercer modo "cada N segundos": paga el coste completo igual, solo que con
    menos frecuencia, y el usuario no sabe cuándo le caerá.

- [ ] **RF-16 Sincronización editor ↔ vista previa (bidireccional).** *(Desde v0.9.0, sustituido por RF-57 en el motor en proceso; este mecanismo por anclas se conserva solo en el motor clásico de respaldo.)* Doble clic en la vista previa
  lleva el cursor al punto correspondiente del fuente, **abriendo el fichero que corresponda** si no
  es el que está abierto; y desde el editor, una acción explícita lleva la vista previa al punto que
  se está escribiendo. *Sustituye* a la cláusula de §6 sobre sync por posición real.
  - **Mecanismo (cerrado por el Spike S-2, no reabrir en `/plan` sin datos nuevos):** anclas
    `#metadata((f: …, l: …))<dbv-sync>` inyectadas **entre bloques** en una **raíz sombra temporal**
    —nunca en la carpeta del usuario—, y tabla extraída con `typst eval` +
    `query(<dbv-sync>)`, que devuelve de una pasada el payload propio y `location().position()`.
    Medido: anclas entre bloques dejan el SVG **byte a byte idéntico**, a 0,007 ms por ancla.
  - **Criterios de aceptación:** (a) funciona **entre ficheros**, que es el caso que originó la
    petición; (b) la tabla de anclas se calcula **bajo demanda y se cachea**, nunca en cada pausa de
    escritura — la pasada de `eval` cuesta otra composición completa (≈750 ms); (c) la búsqueda ordena
    por **(página, banda de x, y)**, no por (página, y), porque en documentos a dos columnas la segunda
    columna tiene una `y` menor que la primera; (d) el camino inverso sobre una vista previa marcada
    como desactualizada (RF-15) tiene un comportamiento definido y explicado, no silencioso.
  - **Limitaciones aceptadas y documentadas:** la precisión es de **bloque**, no de línea (la
    imprecisión típica es la altura de un párrafo). Los **flotantes no se resuelven por posición**:
    `location().position()` de una `figure(..., placement: top)` devuelve su posición en el flujo, no
    dónde se dibuja, así que un clic sobre ella no tiene ancla anterior válida y debe caer al ancla más
    cercana en distancia absoluta.

- [ ] **RF-17 Selector de imágenes del proyecto en el botón "Fig".** Pulsar "Fig" abre un desplegable
  filtrable con las **imágenes que ya existen en el proyecto**, listas para insertar, y como última
  opción "Buscar una imagen…", que abre el selector nativo de fichero y la copia al proyecto.
  *Motivo:* petición explícita del usuario por **coherencia con "Cite"**, que ya funciona así (lista de
  claves reales del `.bib` + "No encuentro la fuente que busco"). Hoy "Fig" salta directo al explorador
  de ficheros, lo que obliga a navegar el disco para reutilizar una imagen que ya está en el proyecto.
  - **Criterios de aceptación:** (a) mismo patrón de interacción y mismo aspecto que el desplegable de
    citas (`citationPicker.js` es el modelo a reutilizar, no a duplicar); (b) la ruta insertada se
    ancla a la raíz con `/`, como ya hace `figureActionForPath()` desde el Slice 27; (c) un proyecto
    sin imágenes muestra un vacío explicado y la opción de buscar, nunca un desplegable en blanco;
    (d) funciona sin conexión y con textos ES/EN.
  - **[SUPUESTO a confirmar en `/plan`]** el listado recorre el proyecto entero buscando imágenes, no
    solo `images/`, para no romperse con proyectos ajenos que organicen los recursos de otra forma
    (RF-02b). Coste y forma del comando Rust —espejo de `bibliography_keys`— se cierran en `/plan`.

- [ ] **RF-18 Arrastre de imágenes coherente con el de fuentes.** Soltar una imagen en **cualquier
  parte de la ventana** la copia al proyecto y lo notifica; si además se soltó sobre el editor, se
  inserta la figura en el cursor como hasta ahora. *Motivo:* hoy `wireImageDrop` exige soltar dentro del
  panel del editor, mientras que `wireFontDrop` acepta la ventana entera. Soltar una imagen sobre el
  explorador de proyecto **no hace nada, y en silencio** — el peor modo de fallo posible, y la razón de
  que un usuario creyera recordar que ya funcionaba. No es alcance nuevo: es corregir un defecto contra
  el espíritu de la cláusula de §6 ("gestión de imágenes por arrastre: copiar al proyecto, organizar").
  - **Criterios de aceptación:** (a) soltar sobre el explorador de proyecto copia la imagen y avisa;
    (b) soltar sobre el editor copia **e** inserta, sin cambio respecto a hoy; (c) se reutiliza la
    deduplicación por contenido ya existente (`find_existing_copy`, Slice 27) — soltar dos veces la
    misma imagen no crea `foto-1.png`; (d) sin proyecto abierto, no se copia nada y se explica por qué.

## ✨ 5c. Funcionalidades — v0.5.0 (Productividad Profesional y Robustez)

> Alcance acordado con el usuario el 2026-09-09. Incorpora capacidades avanzadas de productividad,
> integración de herramientas del ecosistema e ingeniería de robustez inspiradas en el análisis
> de *Hilbert Editor*: Git/Diffs, previsualización de plantillas, LSP `tinymist` vendorizado,
> automatización de figuras Python, diagramas CeTZ y mitigación de problemas de plataforma en Windows.

- [ ] **RF-19 Integración con Git y Resolución Visual de Conflictos.**
  Soporte de Git nativo aprovechando la CLI instalada en el sistema del usuario (con comprobación previa de disponibilidad en el `PATH`):
  - **Criterios de aceptación:**
    1. *Indicador de estado en la barra de estado/proyecto:* Si la carpeta del proyecto es un repositorio Git, muestra la rama activa (`main`), conteo de ficheros modificados/sin seguimiento, y estado respecto al remoto (`↑1 ↓0`). Si Git no está instalado o el proyecto no es un repositorio, degrada limpiamente sin mostrar errores ruidosos.
    2. *Acciones rápidas de sincronización:* Menú o botón accesible con acciones básicas: *Pull* (traer cambios), *Push* (enviar commits), y *Commit* con mensaje directo para trabajo local ágil.
    3. *Detección de cambios externos y Diff Side-by-Side:* Si un archivo se modifica en disco (por un `git pull` o editor externo) mientras el usuario tiene modificaciones sin guardar en el editor, **nunca se sobrescribe silenciosamente**. Se abre un visor de diferencias dividido (Diff side-by-side) para inspeccionar y elegir si conservar la versión en memoria o recargar la del disco.

- [ ] **RF-20 Galería Visual de Plantillas con Previsualización (Template Preview).**
  > ⚠️ **Ampliado por RF-26 (§5d, v1.4).** Los tres criterios de abajo siguen vigentes tal cual; lo que cambia es que la galería deja de ser *una superficie más* para convertirse en la **única** puerta de entrada a la creación de documentos, absorbiendo el catálogo de Typst Universe y el identificador libre. Leer los dos requisitos juntos.

  Las plantillas dejan de ser solo un nombre en un desplegable y se presentan en una interfaz visual con capturas reales pre-renderizadas:
  - **Criterios de aceptación:**
    1. *Miniaturas en alta resolución:* Cada una de las 8 plantillas curadas de DBV (y las comunitarias integradas) cuenta con una miniatura fiel de su primera página maquetada.
    2. *Ficha informativa de plantilla:* Al seleccionar una plantilla se muestra: título, descripción clara de uso (TFG, Informe, Artículo, etc.), autor, etiquetas y selector de idioma cuando aplique (ES/EN).
    3. *Creación asistida:* Acción principal "Usar plantilla" que transiciona al formulario de metadatos (RF-03) con los campos ya adaptados al tipo de documento seleccionado.

- [ ] **RF-21 Inteligencia de Código con Tinymist (LSP vendorizado).**
  Integración del Language Server oficial de Typst (`tinymist`) para ofrecer autocompletado semántico, hover docs y diagnósticos en tiempo real:
  - **Criterios de aceptación:**
    1. *Vendorizado como sidecar:* `tinymist` se descarga y vendoriza como binario sidecar por plataforma (igual que el CLI de `typst`), garantizando que funciona de fábrica sin depender de que el usuario lo instale manualmente.
    2. *Autocompletado semántico:* Sugerencias contextuales de funciones de la biblioteca estándar de Typst, argumentos con nombre (ej. `margin: (top: ...)`), variables locales y referencias a etiquetas (`<sec:...>`).
    3. *Hover Docs:* Al colocar el cursor sobre un identificador o función, se despliega una ventana flotante con su signatura de tipos y documentación oficial.
    4. *Diagnósticos en línea:* Subrayado ondulado de avisos y errores tipográficos y sintácticos en el propio CodeMirror 6 antes de guardar o compilar.
    5. *Formateo con typstyle:* Integración de formateo automático de documento completo con el atajo estándar `Shift + Alt + F` o botón de menú.

- [ ] **RF-22 Generador de Figuras y Datos Dinámicos con Python.**
  Capacidad de ejecutar scripts de Python para generar figuras (Matplotlib, Seaborn) o procesar datos sin salir del editor:
  - **Criterios de aceptación:**
    1. *Asistente / Runner de Python:* Panel o modal donde pegar o escribir un script de generación de gráficas o datos.
    2. *Detección de intérprete local:* Detección transparente de `python` o launcher `py` en Windows utilizando el PATH enriquecido.
    3. *Guardado automático en `images/`:* Si el script produce un archivo de imagen (PNG/SVG/PDF), se deposita en la carpeta `images/` del proyecto y se ofrece la inserción automática del bloque `#figure(image("images/..."), caption: [...])` en la posición actual del cursor.
    4. *Ejecución asíncrona y segura:* Timeout configurable (por defecto 30s) para evitar que un script bloqueante congele la aplicación, capturando `stdout` y `stderr` para depuración.

- [ ] **RF-23 Asistente Visual de Diagramas CeTZ.**
  Inserción guiada de diagramas vectoriales nativos para Typst basados en el paquete estándar CeTZ:
  - **Criterios de aceptación:**
    1. *Galería de tipos de diagramas:* Opciones de diagramas frecuentes: Diagramas de flujo (bloques de proceso, decisiones, conexiones etiquetadas), diagramas de arquitectura/componentes y gráficas de funciones matemáticas 2D.
    2. *Emisión de código CeTZ limpio:* Inserta el bloque `#import "@preview/cetz:0.3.1"` (si no existe ya en el documento) y la estructura `cetz.canvas({ ... })` comentada y lista para personalizar.

- [ ] **RF-24 Robustez de Plataforma en Windows y Guardado Atómico.**
  Solución de problemas reales de entorno identificados en la trinchera del desarrollo de escritorio:
  - **Criterios de aceptación:**
    1. *`augment_path()`:* Inyección dinámica en el arranque de rutas críticas de Windows (`WinGet\Links`, `cargo\bin`, `Python\Launcher`, `scoop\shims`, `chocolatey\bin`) con el separador `;` correcto para que cualquier herramienta instalada recientemente se reconozca de inmediato sin reiniciar sesión.
    2. *`write_atomic()`:* Guardado en fichero temporal oculto y renombrado atómico para prevenir que el observador de cambios compile ficheros a medio escribir.
    3. *Preservación de "Last Good Render":* Si una edición introduce un error sintáctico, la vista previa conserva el último documento PDF/SVG renderizado con éxito, indicando el fallo en la barra de problemas sin dejar el visor en blanco.

## ✨ 5d. Funcionalidades — v0.5.0 (Consolidación del Lanzador)

> Alcance **añadido el 2026-09-09 reabriendo el `/spec` de v0.5.0**, a decisión explícita del usuario y
> antes de la entrega de esa versión. No sustituye a §5c: se construye y se entrega en la misma v0.5.0.
> El rediseño se validó visualmente antes de especificarlo, en un lienzo de seis artboards cuyas fuentes
> viven en `spikes/launcher-redesign/` (home, las tres pestañas de la galería y las dos variantes en tema
> sepia). Las restricciones de diseño están congeladas en [`DESIGN.md`](./DESIGN.md) §10.
>
> **Motivo.** Al cerrar `/build` de v0.5.0 la aplicación había acumulado **tres superficies distintas para
> el mismo trabajo** — elegir una plantilla:
> 1. La rejilla de 8 tarjetas del lanzador (`launcher.js`), cuyo `click` **solo abre la galería**
>    (`launcher.js:87-93`): un menú cuyo único trabajo es abrir otro menú con más información.
> 2. El modal de galería (`templateGalleryModal.js`), incorporado en esta misma v0.5.0 por RF-20.
> 3. El panel de Typst Universe (`universePanel.js`), de la Beta (§7.6 de `ARCHITECTURE.md`), anterior a la
>    galería y con otra estética, cuya pestaña "Plantillas" ofrece un tercer catálogo.
>
> Más dos botones en el home ("Explorar catálogo con vista previa…" y "Plantillas del Typst Universe") que
> llevan a **dos ventanas diferentes**. El coste no es estético: obliga al usuario a decidir dos veces y a
> aprender dos interfaces para una sola tarea, justo en la pantalla de entrada del producto.

- [ ] **RF-25 Lanzador de una sola vía.**
  El lanzador deja de ser un catálogo y pasa a ser una pantalla de arranque: no elige plantilla, abre la galería.
  - **Criterios de aceptación:**
    1. *La rejilla desaparece.* El home no contiene ninguna rejilla de plantillas (`.template-grid`) ni ningún botón que abra un catálogo alternativo: se retiran `#btn-launcher-gallery` y `#btn-launcher-universe`.
    2. *Una acción dominante.* Un único control "Nuevo documento", visualmente destacado respecto al resto, abre la galería unificada de RF-26. Es la **única** vía de creación desde plantilla que ofrece el lanzador.
    3. *Tres acciones secundarias, subordinadas.* Abrir carpeta de proyecto, abrir documento `.typ` e importar proyecto `.dbvt`, agrupadas y con menos peso visual que la acción dominante.
    4. *Los proyectos recientes heredan el espacio.* La lista de recientes ocupa el sitio que dejan las tarjetas y pasa a ser la sección de mayor peso por debajo de las acciones, conservando abrir y eliminar por entrada. Es lo que el usuario recurrente busca de verdad al abrir la aplicación, y hoy queda por debajo de un muro que solo abre otra ventana.
    5. *Sin pérdida de funcionalidad.* Todo lo que hoy se puede hacer desde el home se sigue pudiendo hacer: lo que hacía la rejilla lo hace la galería, con más información.

- [ ] **RF-26 Galería unificada de creación de documentos.**
  La galería pasa de ser una superficie más a ser **la única puerta de entrada** a la creación de documentos, absorbiendo el catálogo de plantillas de Typst Universe y el identificador libre.
  - **Criterios de aceptación:**
    1. *Punto de entrada único.* Existe una sola ventana de elección de plantilla en toda la aplicación.
    2. *Tres pestañas sobre el mismo esqueleto.* "Plantillas locales", "Typst Universe" y "Dirección" comparten la misma columna de lista, el mismo buscador y el mismo panel de vista previa: entre pestañas **solo cambia la fuente de la lista**, nunca la disposición. Es lo que impide que vuelvan a divergir en tres estéticas.
    3. *Plantillas locales.* Las 8 plantillas curadas de DBV, con la ficha informativa y la transición al formulario de metadatos de RF-03 — RF-20 se mantiene íntegro, solo cambia dónde vive.
    4. *Typst Universe.* El catálogo revisado (`CURATED_TEMPLATES`), con el identificador `@preview/nombre:version` visible, su licencia, y el aviso de que es código de terceros que se descarga y ejecuta en el equipo.
    5. *Dirección (identificador libre).* Campo donde escribir cualquier `@preview/nombre:version`, validado con `parseUniverseSpec`. Un identificador incompleto o mal formado produce un **mensaje que explica qué falta** (p. ej. la versión), y la acción principal permanece **deshabilitada** mientras no sea válido. El aviso de código de terceros es más prominente que en la pestaña anterior, porque aquí no hay lista revisada detrás.
    6. *Vista previa del identificador libre, solo bajo petición explícita.* En la pestaña "Dirección" **no** se descarga ni se ejecuta nada al teclear ni al validar. La vista previa se genera únicamente al pulsar un control cuyo texto declara que descargará y ejecutará la plantilla. Decisión del usuario, 2026-09-09: es el punto medio entre no ofrecer previsualización y contradecir la postura editorial de `ARCHITECTURE.md` §6 descargando código ajeno solo por escribir en un campo.
    7. *Los paquetes NO se absorben.* La pestaña "Paquetes" del panel de Universe permanece donde está: se importan en el documento **ya abierto**, es trabajo del editor y sigue detrás del botón ✦ de la cabecera. Elegir plantilla (crea un proyecto) y añadir un paquete (modifica un documento) son trabajos distintos; fusionarlos recrearía exactamente el problema que este requisito resuelve.
    8. *Se conservan las dos vías.* Lista revisada **y** campo libre siguen existiendo para plantillas, tal como fija `ADR-UNIVERSE-001`. La consolidación cambia dónde viven, nunca la política.
    9. *Accesible y consistente.* Las pestañas se recorren con teclado y exponen su estado (`role="tab"`/`aria-selected`), y la ventana es correcta en los tres temas — sepia incluido, que es el que más rompe las suposiciones de contraste.
    10. *Los paquetes no se ofrecen cuando no se pueden usar.* Añadido el 2026-09-09, dentro de la misma congelación, a observación del usuario: "elegir paquetes si no se ha seleccionado un proyecto no tiene sentido". El botón ✦ de la cabecera **se deshabilita mientras no haya un documento abierto**, con una explicación al pasar el cursor, en lugar de abrir un panel cuya única acción posible termina en un aviso de error. Es el corolario natural del criterio 7: si añadir un paquete es trabajo del editor sobre el documento abierto, ofrecerlo desde el lanzador es ofrecer algo que no puede funcionar. Hoy `main.js` ya contempla el caso (`universe.needDocument`), pero **después** de que el usuario haya abierto el panel y elegido un paquete.

- [ ] **RF-27 Tokens semánticos de estado (deuda de `DESIGN.md` §9).**
  Se salda al mismo tiempo, porque el estado de error de RF-26 lo necesita y sería el siguiente color literal en entrar.
  - **Criterios de aceptación:**
    1. *Cuatro tokens nuevos en los tres temas:* `--status-ok`, `--status-warn`, `--status-error` y `--status-info` en `tokens.css`, con valor propio para claro, oscuro y sepia.
    2. *Ningún color de estado literal.* La paleta escrita a mano que entró con las funciones de v0.5.0 (`#10b981`, `#ef4444`, `#f59e0b`, `#3b82f6`, y sus variantes translúcidas) desaparece de `base.css` y `layout.css` en favor de esos tokens. Hoy no cambian con el tema: en sepia son colores fríos y saturados sobre una paleta cálida — el mismo defecto que `--band-hint` ya corrigió una vez tras el aviso de un usuario real.
    3. *`--accent-subtle` declarado.* `layout.css:1148` lo usa con respaldo (`var(--accent-subtle, rgba(2, 132, 199, 0.15))`) pero nunca se declaró, así que **siempre gana el respaldo** y el anillo de foco del buscador de la galería es azul incluso en sepia. Se declara en los tres temas.
    4. *Verificación.* `npm run verify:layout` en verde tras el cambio, ejecutado donde pueda ejecutarse de verdad (CI o una máquina con Chrome utilizable).

## ✨ 5e. Funcionalidades — v0.5.0 (Pulido de ventana y previsualización)

> Alcance **añadido el 2026-09-09**, tercera y última ampliación del `/spec` de v0.5.0, a petición
> explícita del usuario tras probar la aplicación construida. Dos peticiones pequeñas y contenidas que
> entran antes de la entrega para no obligar a una segunda pasada manual.

- [ ] **RF-28 Chincheta "mantener la ventana encima".**
  El usuario lo describió como *"esencial en mis aplicaciones y todas la tienen, aquí se había pasado"*.
  No es una funcionalidad nueva del ecosistema DBV: **existe ya en DBV Markdown Reader** y aquí solo se
  porta, igual que se portaron el watcher, los temas, los paneles flotantes y el selector segmentado.
  - **Criterios de aceptación:**
    1. *Un control en la cabecera*, junto al resto de herramientas de ventana, con el mismo pictograma de chincheta que usa DBV Markdown Reader — la misma acción no debe tener dos dibujos distintos entre aplicaciones de la familia.
    2. *Alterna y se ve*: al activarse queda marcado como activo, y su descripción cambia para decir cómo desactivarlo. Un control que no dice si está encendido obliga a probarlo para saberlo.
    3. *Por ventana y sin persistencia*, replicando la decisión ya tomada en DBV Markdown Reader (su `ADR-023`): el estado no sobrevive al cierre de la aplicación. Fijar una ventana encima es una decisión del momento —"quiero verla mientras trabajo en otra cosa"—, no una preferencia permanente, y arrancar siempre por encima del resto sorprendería.
    4. *Permisos mínimos*: `core:default` de Tauri **no** incluye las capacidades de ventana que mutan estado. Se añaden únicamente `core:window:allow-set-always-on-top` y `core:window:allow-is-always-on-top`, siguiendo la regla de menor privilegio que ya declara `capabilities/main.json` ("se añaden por slice, según se necesitan").
    5. *Degrada limpiamente*: si la llamada falla, el control no se queda mintiendo sobre su estado.

- [ ] **RF-29 Ver la previsualización de plantilla a tamaño grande.**
  La vista previa maquetada de la galería (RF-20/RF-26) se pinta a unos 340 px de ancho: suficiente para
  reconocer la estructura, insuficiente para leer nada. El usuario lo resumió como *"se ve bien, pero muy
  pequeñita"*.
  - **Criterios de aceptación:**
    1. *Pulsar la página la amplía* a un tamaño en el que el texto simulado y la maquetación se distinguen de verdad, aprovechando la ventana disponible.
    2. *Salir es obvio y barato*: se cierra con `Escape`, pulsando fuera, y con un control visible. No debe hacer falta adivinar cómo volver.
    3. *No se pierde el contexto*: al cerrar la ampliación se vuelve a la galería con la misma plantilla seleccionada y la misma pestaña abierta.
    4. *Se aplica a las tres pestañas*, incluida la previsualización descargada de un identificador libre: es la que más falta hace, porque es la única que el usuario no ha visto nunca antes de crear el proyecto.
    5. *Es descubrible*: el cursor y una pista indican que la página se puede pulsar. Una ampliación que nadie encuentra no existe.

- [ ] **RF-30 La cabecera agrupa sus acciones de fichero en un solo menú.**
  Propuesto por el usuario al ver la cabecera con un proyecto abierto: *"sigue siendo inmensa, se ve poco elegante"*.
  - **Criterios de aceptación:**
    1. *Un control en lugar de cinco.* "Explorador", "Exportar .dbvt", "Cerrar", "Carpeta" y "Archivo" se agrupan bajo un único **Archivo ▾**. Medido en el motor real a 1552 px: los cinco ocupaban **356 px** (~380 con separaciones) y el menú ocupa **71 px**.
    2. *Ninguna acción se pierde ni cambia de nombre.* El menú usa las etiquetas completas que ya existían (`Abrir carpeta de proyecto`, `Mostrar en el explorador`…), no las abreviadas que se inventaron para que cupieran en la barra. Se añade además "Importar proyecto (.dbvt)", que hasta ahora solo estaba en el lanzador: un menú de fichero sin importar sería raro.
    3. *Lo que necesita proyecto se deshabilita, no se oculta.* Exportar, Mostrar en el explorador y Cerrar quedan apagados mientras no hay proyecto abierto. Es el mismo criterio de RF-26.10, y evita que el menú cambie de tamaño según el contexto: uno estable se recorre de memoria, uno que baila hay que releerlo entero cada vez.
    4. *Fuera del menú se quedan los controles frecuentes o con estado:* el selector de paneles P/E/V (verlo de un vistazo es la mitad de su valor) y los botones de solo icono, que ya son compactos.
    5. *Se cierra solo al elegir.* Si no, el menú queda flotando encima del diálogo del sistema que acaba de abrirse.

  > **Por qué esto no es una idea nueva:** la clase `.button--icon-label` existe desde la Beta precisamente porque *"la cabecera dejaba de caber en pantallas normales solo con texto"*, y entonces se acortaron las etiquetas. Aquello alivió el síntoma sin tocar la causa —cinco acciones poco frecuentes ocupando sitio permanente—, y la cabecera volvió a romperse en cuanto se le añadieron el indicador de Git y la chincheta. RF-30 cierra esa historia.

### 5e.1. Alcance real de la integración con Git (RF-19) — aclaración, no cambio

> Escrito el 2026-09-09 a petición del usuario, que preguntó *"lo que no sé cómo se hace o si se ha hecho
> es la integración con GitHub"*. **No hay ningún cambio de alcance aquí**: esta sección documenta lo que
> RF-19 hace hoy y, sobre todo, lo que **no** hace, porque la diferencia no era evidente desde la interfaz.

**Lo que existe es integración con Git, no con GitHub.** La aplicación se apoya en la CLI de Git ya
instalada en el sistema (`ADR` de RF-19: apoyarse en el binario del usuario, no vendorizar Git) y expone
exactamente cuatro operaciones, en `commands/git.rs`:

| Comando | Qué hace |
| --- | --- |
| `git_status` | Rama activa, adelanto/retraso respecto al remoto (`↑1 ↓0`), ficheros modificados y sin seguir |
| `git_commit` | `git add` de lo indicado + `git commit -m` |
| `git_push` | `git push` sobre el remoto ya configurado |
| `git_pull` | `git pull` sobre el remoto ya configurado |

**Nada de esto es específico de GitHub.** No hay inicio de sesión, ni clonado desde una URL, ni creación
de repositorios, ni *pull requests*, ni *issues*, ni lectura de la API de GitHub. Funciona igual con
GitLab, Codeberg, un remoto por SSH o un repositorio puramente local.

**Cómo se resuelve entonces la autenticación, que es la parte que sorprende.** La aplicación **nunca pide
credenciales**: lanza Git con `GIT_TERMINAL_PROMPT=0` y `GIT_ASKPASS` vacío, a propósito, porque un
proceso hijo que se queda esperando una contraseña en una terminal que no existe colgaría la operación
sin explicación. En consecuencia, `push` y `pull` contra un remoto privado funcionan **solo si el gestor
de credenciales del sistema** (Git Credential Manager en Windows, el llavero en macOS, el *helper*
configurado en Linux) ya puede resolverlas. Si no, la operación falla y el error de Git se muestra tal
cual en el panel. Esto es una consecuencia deliberada del diseño, no una carencia de la implementación.

**El hueco reconocido:** no se puede clonar un repositorio desde la aplicación. El texto del lanzador ya
lo refleja con honestidad —habla de abrir "un repositorio clonado"—, dando por hecho que el usuario lo
clonó por su cuenta. Se cubre en v0.6.0 con **RF-33** (§5f).

## ✨ 5f. Funcionalidades — v0.6.0 (Herramientas del Ecosistema)

> Alcance acordado con el usuario el 2026-09-11, congelado en una sola pasada para evitar la dinámica de
> v0.5.0 (tres reaperturas del mismo `/spec`). Consolida deuda de Beta que llevaba abierta desde el spec
> original (Universe Browser completo, bibliografía visual, macOS, auto-actualizador) junto con
> funcionalidad nueva pedida explícitamente en esta sesión (diagramas WYSIWYG, menú Herramientas, alcance
> de GitHub, runtime JavaScript). Los detalles de implementación que no se han resuelto aquí (crate BibTeX
> concreto, tamaño/criterio de la whitelist de Universe Browser, mecanismo exacto de invocación de `jogs`)
> quedan explícitamente diferidos a `/plan`, no a una futura reapertura de este `/spec`.

- [ ] **RF-31 Editor WYSIWYG de Diagramas (sustituye a RF-23).**
  El asistente visual de diagramas CeTZ (RF-23, `cetzAssistant.js`, botón ⬡) tiene un fallo activo sin
  arreglar y se sustituye por un editor visual de manipulación directa, en vez de parchearse dos veces
  (una para el bug, otra para el rediseño).
  - **Criterios de aceptación:**
    1. *Manipulación directa.* El usuario dibuja y ajusta formas, conexiones y texto sobre un lienzo interactivo (arrastrar nodos, redimensionar, conectar), no solo elige una plantilla de código ya escrita como hace RF-23 hoy.
    2. *Emisión de código CeTZ limpio.* El resultado se traduce a `cetz.canvas({ ... })` legible e insertable en el documento, igual que RF-23, manteniendo el `#import "@preview/cetz:0.3.1"` deduplicado.
    3. *Edición bidireccional mínima.* Reabrir un diagrama ya insertado desde su código CeTZ lo recupera en el lienzo visual, siempre que se generara con este editor (no se exige parsear CeTZ arbitrario escrito a mano).
    4. *Cubre como mínimo los 4 tipos de RF-23* (flujo, bloques/arquitectura, gráficas 2D, lienzo libre) sin regresión de funcionalidad.
    5. *El bug actual de RF-23 no se hereda.* Se documenta su causa raíz en `memory.md` antes de empezar la construcción, para no repetirlo en el editor nuevo.

- [ ] **RF-32 Menú "Herramientas" en la cabecera.**
  Agrupa funcionalidad de ecosistema ya dispersa por la cabecera y la barra del editor en un único punto de entrada, con el mismo criterio de RF-30 (un control en vez de varios).
  - **Criterios de aceptación:**
    1. *Un menú, no una reorganización silenciosa.* Terminal avanzado (Beta, §6), runner de Python (RF-22) y las acciones de Git existentes (RF-19) pasan a vivir bajo **Herramientas ▾**; ninguna pierde su atajo de teclado si lo tenía.
    2. *Punto de entrada para lo nuevo de esta versión.* El clonado por URL de RF-33 y el runner de JavaScript de RF-38 se añaden a este mismo menú, no a superficies nuevas — evita repetir el problema de tres puertas de entrada que motivó RF-25/RF-26.
    3. *Lo que necesita proyecto abierto se deshabilita, no se oculta*, mismo criterio que RF-26.10 y RF-30.3.
    4. *Extensible sin rediseño.* La estructura del menú (lista de entradas con icono + etiqueta + acción) admite añadir una entrada nueva sin tocar layout — relevante porque RF-38 ya es la primera incorporación tras el diseño inicial.

- [ ] **RF-33 Clonar Repositorio por URL.**
  Cierra el hueco reconocido en §5e.1: hoy no se puede clonar desde la aplicación. Decisión del usuario
  (2026-09-11) entre las 5 alternativas evaluadas en §9: **clonar por URL**, la única que aporta valor sin
  custodiar credenciales ni atarse a una plataforma concreta.
  - **Criterios de aceptación:**
    1. *Campo de URL* accesible desde el menú Herramientas (RF-32) y desde el lanzador, que acepta cualquier URL de remoto Git (no solo `github.com`) — coherente con que RF-19 ya funciona igual con GitLab, Codeberg o SSH.
    2. *Clona con la CLI de Git ya integrada* (`commands::git`), sin vendorizar Git ni añadir un cliente propio — mismo ADR que RF-19.
    3. *Repositorios públicos funcionan sin configuración.* Uno privado depende del gestor de credenciales del sistema, con el mismo comportamiento y el mismo error legible que ya tienen `git_push`/`git_pull` (§5e.1) — no se añade custodia de credenciales propia de la aplicación.
    4. *Tras clonar, abre el proyecto* directamente en el workspace, igual que "Abrir carpeta de proyecto".
    5. *Error legible* si la URL no es válida, el destino ya existe y no está vacío, o la clonación falla (red, autenticación, repositorio no encontrado) — nunca falla en silencio.

- [ ] **RF-34 Universe Browser Completo (Package Explorer + Template Explorer).**
  Cierra la deuda de Beta descrita en §6: hoy solo existe una whitelist curada de plantillas/paquetes.
  - **Criterios de aceptación:**
    1. *Package Explorer* sobre el `index.json` público de Typst: buscar/explorar por categoría, ver instalados, insertar `#import` con un botón, detección de paquetes usados en el proyecto abierto con insignia de actualización disponible.
    2. *Template Explorer* sobre el mismo catálogo, filtrado por plantillas: pestañas Instaladas/Comunidad/Favoritas/Recientes/Actualizaciones, integrado en la galería unificada de RF-26 como ampliación de su pestaña "Typst Universe", no como una cuarta puerta de entrada — ver `ADR-UNIVERSE-001`.
    3. *Transición de "whitelist curada" a "catálogo completo"* con un criterio de confianza visible (p. ej. badge de verificado/curado vs. comunidad sin filtrar) — el tamaño exacto de la whitelist inicial y el criterio de expansión se cierran en `/plan`, no aquí (pregunta ya abierta en §9).
    4. *El aviso de código de terceros de RF-26.4/RF-26.5 se mantiene* para cualquier paquete o plantilla fuera de la lista curada original.
    5. *Hover enriquecido sobre un identificador en el editor* (`editor/universeHover.js`, construido en v0.5.0 pero nunca documentado aquí hasta ahora — hallazgo de la pasada manual de v0.6.0, 2026-09-11): al pasar el ratón sobre `@preview/nombre:version` dentro del código Typst, una tarjeta flotante muestra metadatos del paquete y un enlace directo para abrirlo en `typst.app/universe`, sin salir del editor.

- [ ] **RF-35 Gestión Visual de Bibliografía Completa.**
  Cierra la deuda de Beta descrita en §6: hoy la cita del editor solo escanea claves del `.bib` con un
  escaneo ligero, sin parsear campos.
  - **Criterios de aceptación:**
    1. *Explorador de referencias* del `.bib` del proyecto: lista de entradas con autor/título/año, búsqueda y filtro.
    2. *Autocompletado de citas enriquecido* en el editor (extiende el asistente de cita ya existente) con vista previa del campo completo, no solo la clave.
    3. *Validación básica* del `.bib`: entradas duplicadas o campos obligatorios ausentes se señalan sin bloquear la edición.
    4. *Motor/crate BibTeX concreto sin decidir aquí* — pregunta abierta desde el spec original (§9), se resuelve en `/plan` de esta fase con un research phase dedicado, misma disciplina que `tinymist`.

- [ ] **RF-36 Empaquetado macOS.**
  Cierra la deuda de Beta descrita en §6 y en el roadmap (§11): hoy solo hay empaquetado Windows y Linux.
  - **Criterios de aceptación:**
    1. *Bundle `.dmg`/`.app`* generado por Tauri v2 para macOS (Intel y Apple Silicon), con el mismo sidecar `typst`/`tinymist` vendorizado por arquitectura que ya existe para Windows/Linux.
    2. *CI dedicada* que compila macOS en GitHub Actions — ver gate de `MASTER_PROMPT.md` sobre apps nativas multiplataforma: el plan de `/plan` debe fijar explícitamente qué runner compila qué plataforma y si hay Release automatizada.
    3. *Verificación funcional mínima* (arranque, compilación de un proyecto de prueba, preview) antes de dar el empaquetado por cerrado — no basta con que compile, misma lección que el fallo del `.msix` de Microsoft Store (`memory.md`, lección 2026-09-07).

- [ ] **RF-37 Auto-actualizador.**
  Cierra la deuda de Beta descrita en §6 (`tauri-plugin-updater`). Solo bloqueado en un paso manual del
  usuario, no en una decisión de diseño pendiente.
  - **Criterios de aceptación:**
    1. *Clave de firma generada por el propio usuario* en su terminal, nunca por la IA — regla ya fijada en `UPGRADE_PROMPT.md` §4 y confirmada en `ADR-ACTUALIZADOR-001` (`memory.md`).
    2. *Comprobación de actualizaciones* desde el panel "Acerca de", que hoy solo informa si la instalación es de Microsoft Store o manual — se añade la acción real que antes no existía por falta de esta pieza.
    3. *Descarga y aplicación firmadas y verificadas* antes de instalar, sin exponer al usuario a un binario sin firmar.
    4. *No sustituye al canal de actualización de Microsoft Store* cuando la instalación viene de ahí — degrada a "gestionado por la tienda" en ese caso, coherente con la detección de `is_packaged_app` ya existente.

- [ ] **RF-38 Ejecución de Módulos JavaScript con `jogs` (análogo a RF-22).**
  Paralelo directo del runner de Python (RF-22), pedido explícitamente por el usuario, usando el paquete
  de Typst Universe [`jogs`](https://typst.app/universe/package/jogs/) (`#import "@preview/jogs:0.2.4"`):
  runtime **QuickJS embebido como plugin WASM del propio compilador Typst**, sin proceso Node/Deno externo
  — arquitectura más ligera que RF-22, que sí lanza un proceso `python` real. Investigado antes de fijar
  alcance, misma disciplina que el research phase de `tinymist` y del ecosistema Typst en general
  (`TYPST_ECOSYSTEM_RESEARCH.md`).
  - **Criterios de aceptación:**
    1. *Asistente de inserción*, en el menú Herramientas (RF-32), que inyecta el `#import` de `jogs` deduplicado y una plantilla de `eval-js`/`call-js-function` lista para editar — mismo patrón que RF-23/RF-31 para CeTZ, no un runner con proceso propio como RF-22.
    2. *Sin aprovisionamiento de sistema.* A diferencia de RF-22 (detección de intérprete `python`/`py`), no depende de nada instalado fuera de la app: el runtime viaja dentro del propio paquete WASM que Typst ya descarga/cachea.
    3. *Precompilación opcional* vía `compile-js`, documentada en el asistente para scripts que se reutilizan varias veces en el mismo documento (evita recompilar en cada render).
    4. *Confirmación exacta del mecanismo de invocación* (cómo se pasa el resultado de vuelta al documento, límites de `list-global-property`, comportamiento si el script lanza una excepción) se cierra en `/plan` con una prueba mínima contra el paquete real, mismo método que validó cada flag del CLI de `typst` en el Slice 2 — la página de Typst Universe no documenta sandboxing explícito y conviene verificarlo antes de exponerlo al usuario.

- [x] **RF-39 Pegar una imagen desde el portapapeles.**
  Hallazgo de la pasada manual (2026-09-12): recortar una zona de la pantalla y pegarla en el documento
  **no hacía nada**. No era un fallo, era una ausencia — no existía ningún manejo de `paste` en la
  aplicación. Completa el trío de vías de entrada de una imagen al proyecto, junto al arrastre (RF-18) y
  al selector nativo del asistente "Fig" (RF-17), que hasta ahora eran las dos únicas.
  - **Criterios de aceptación:**
    1. *Se guarda en el proyecto, no se incrusta en el documento.* La imagen pegada se escribe en
       `images/` del proyecto activo, igual que una arrastrada, y se inserta la figura con su ruta
       relativa — nunca como `data:` URL dentro del `.typ`, que dejaría documentos ilegibles y enormes.
    2. *Insertar solo si el foco está en el editor.* Sin foco en el editor la imagen se copia igual y se
       avisa con su ruta, mismo criterio que RF-18 resolvió para el arrastre ("copiar siempre, insertar
       solo donde hay un cursor con contexto"); un pegado no tiene coordenadas, así que el foco sustituye
       a la posición del puntero.
    3. *Pegar texto sigue intacto.* Solo se intercepta el pegado cuando el portapapeles trae un fichero de
       imagen y **ningún** `text/plain`: copiar texto de una web arrastra a veces una imagen de adorno, y
       ahí lo que se quiere pegar es el texto.
    4. *Mismas extensiones que el resto de la app.* Se aceptan los formatos que Typst sabe incrustar y se
       descarta el resto — en particular `image/bmp`, que Windows pone en el portapapeles con frecuencia y
       que dejaría en `images/` un fichero que rompe la compilación.
    5. *Sin duplicados.* Pegar dos veces el mismo recorte reutiliza el fichero ya guardado, misma
       deduplicación por contenido que ya hacía el arrastre.

## ✨ 5g. Funcionalidades — v0.7.0 (Pulido de UX real + Ecuaciones + Diagramación ampliada)

> Alcance acordado con el usuario el 2026-09-14, en una sola pasada de análisis (sin reaperturas), tras una
> sesión de uso real de la aplicación con un proyecto externo (un glosario técnico-administrativo, ajeno a
> este repositorio, con imágenes y fuentes propias) y una lectura dirigida de Voynov, A., Corbi, A.,
> López-Oliver, P., & Gil, D. (2026), *"Typst: A Modern Typesetting Engine for Science"*, IJIMAI 9(7),
> 107–120 (referenciado en `README.md`/`README.en.md`). RF-40 a RF-45 son correcciones y reorganizaciones
> de UX encontradas usando la app, no funcionalidad nueva; RF-46 a RF-52 sí lo son. RF-50 y RF-51 (Kanban y
> DOT/Graphviz) quedaron inicialmente como un único RF-50 condicional a que sobrara alcance de `/plan`;
> activados sin condición y separados en dos requisitos independientes el día siguiente, tras cerrar
> `/build`, `/test` y `/code-simplify` de los otros nueve (v1.9, ver cabecera del documento y
> `ADR-DECISION-006`). RF-52 (botón de ayuda contextual) se añadió el mismo día que RF-50/RF-51, tras
> probar el usuario en vivo el asistente de DOT/Graphviz recién construido (v1.10).

- [ ] **RF-40 El aviso de `ResizeObserver` deja de mostrarse como error de la aplicación.**
  Arrastrar el separador entre editor y vista previa dispara el mensaje del navegador *"ResizeObserver
  loop completed with undelivered notifications"*, y la aplicación lo muestra en el banner rojo de error
  global como si fuera un fallo propio. Es un aviso **benigno y extremadamente común** en cualquier layout
  redimensionable con `ResizeObserver` (Chromium lo emite cuando dos observers se retroalimentan entre sí
  dentro de un mismo frame) — el defecto no está en el redimensionado, está en que el manejador de errores
  global no lo distingue de un error real.
  - **Criterios de aceptación:**
    1. *Nunca llega al banner de error visible al usuario*, sea cual sea el mecanismo de filtrado elegido
       en `/plan` (lista de mensajes ignorados en el manejador de `window.onerror`/`unhandledrejection`,
       o eliminar la causa de raíz del bucle de `ResizeObserver` si `/plan` la encuentra y es razonable).
    2. *Un error real de la app durante el mismo gesto (arrastrar el separador) sigue mostrándose.* No es
       aceptable silenciar la categoría entera de errores del manejador global, solo este mensaje concreto
       y benigno — degradar la detección de errores reales sería cambiar un defecto visible por uno
       invisible.
    3. *Regresión cubierta:* un test (manual o automatizado, a decidir en `/plan` dado que depende de
       `ResizeObserver` real en un navegador) confirma que arrastrar el separador repetidamente no produce
       ningún banner.

- [ ] **RF-41 El separador editor/vista previa no debe quedar bloqueado al arrastrarlo.**
  Reportado por el usuario: "a veces esa barra no se podía mover más a la izquierda, se quedaba como
  bloqueada". Bug de layout independiente de RF-40, probablemente un `min-width` mal calculado o no
  recalculado en el panel de vista previa (`ui/splitter.js`, ver Slice 5/18 en `task.md` para el mecanismo
  existente) que a veces impide seguir reduciendo el ancho del panel aunque quede espacio disponible.
  - **Criterios de aceptación:**
    1. *Causa raíz identificada y documentada en `memory.md`* antes de aplicar el arreglo — no basta con
       ampliar un límite a ojo si no se sabe por qué se activaba antes de tiempo.
    2. *El separador se puede arrastrar hasta los límites reales de usabilidad* (un mínimo razonable de
       ancho para cada panel, no cero), de forma consistente en cada intento, sin que un arrastre previo
       dentro de la misma sesión deje el límite más restrictivo de lo que debería.
    3. *Reproducido y verificado con `npm run verify:layout`* (el arnés de geometría real en navegador
       headless que ya existe desde el Slice 25, punto 9 de `task.md`) — es exactamente el tipo de fallo
       que ese arnés se creó para atrapar.

- [ ] **RF-42 Zoom contextual con teclado y rueda del ratón.**
  `Ctrl++`/`Ctrl+-` y `Ctrl` + rueda del ratón deben ajustar una magnitud distinta según dónde esté el
  foco, en vez de disparar el zoom nativo del webview de Tauri sobre toda la ventana (comportamiento
  actual, no deseado).
  - **Criterios de aceptación:**
    1. *Foco en el editor de código:* aumenta/disminuye el tamaño de fuente de CodeMirror 6, con un
       mínimo y máximo razonables y persistencia por proyecto o global (a decidir en `/plan`, mismo
       criterio que otras preferencias de RF-09).
    2. *Foco en la vista previa:* aumenta/disminuye el zoom del PDF, reutilizando el mecanismo de zoom ya
       existente (`preview.js`, botones +/−/100%/"Ajustar al ancho" del Slice 25 punto 7 de `task.md`) en
       vez de crear uno paralelo.
    3. *El zoom nativo del webview queda deshabilitado* para estas combinaciones — se intercepta el evento
       con `preventDefault()` antes de que Tauri/WebView2 lo resuelva a nivel de sistema.
    4. *La rueda del ratón con `Ctrl` reproduce el mismo efecto que `Ctrl++`/`Ctrl+-`* según el mismo
       criterio de foco, con la dirección de scroll natural (rueda hacia arriba = acercar).
    5. *Sin foco en ninguno de los dos paneles* (p. ej. foco en el árbol de proyecto), la combinación no
       hace nada perceptible — nunca cae por defecto en el zoom nativo del sistema.

- [ ] **RF-43 Guardar / Guardar como / Exportar PDF / Exportar PNG se mueven al menú "Archivo".**
  Hoy viven como botones sueltos en la barra de herramientas del editor de texto, duplicando el propósito
  del menú "Archivo" que ya agrupa el resto de operaciones de fichero desde RF-30 (§5e).
  - **Criterios de aceptación:**
    1. *Los cuatro pasan al menú Archivo*, con las mismas etiquetas y atajos que ya tenían — mismo
       criterio de "ninguna acción se pierde ni cambia de nombre" que fijó RF-30.2.
    2. *Desaparecen de la barra de herramientas del editor* una vez migrados — no se duplican en los dos
       sitios, que reintroduciría el mismo problema de "varias puertas para lo mismo" que motivó RF-25/26.
    3. *Se deshabilitan, no se ocultan, sin proyecto/documento abierto*, mismo criterio ya establecido en
       RF-26.10 y RF-30.3.

- [ ] **RF-44 Rediseño de la pantalla de inicio.**
  La pantalla "¿Qué quieres escribir hoy?" (post-RF-25/26) resultó, en palabras del usuario al verla en la
  ventana real, "horrorosa": cinco botones sueltos de peso visual similar y una lista plana de rutas
  completas de Windows sin recortar. No cambia qué se puede hacer desde el home (eso ya lo fijó RF-25),
  solo cómo se presenta.
  - **Criterios de aceptación:**
    1. *Jerarquía visual clara*, conservando la estructura ya fijada por RF-25 (una acción dominante "Nuevo
       documento", el resto subordinado): las acciones secundarias (Abrir carpeta, Abrir documento `.typ`,
       Importar `.dbvt`, Clonar repositorio de RF-33) se presentan con menos peso que la acción dominante,
       no como una fila de botones idénticos.
    2. *Proyectos recientes como tarjetas*, no como filas de texto plano: icono según tipo (carpeta de
       proyecto vs. `.typ` suelto), nombre del proyecto destacado, y la ruta del padre **recortada** (los
       últimos 2-3 segmentos, nunca la ruta completa de Windows) con la ruta completa disponible en un
       `title`/tooltip al pasar el cursor.
    3. *Máximo 5 entradas recientes visibles.* Decisión explícita del usuario, en lugar de un buscador:
       más allá de 5 no aporta valor y añade un elemento de búsqueda innecesario para una lista corta. Si existen
       más de 5 proyectos recientes en el almacenamiento persistente, se muestran solo los 5 más recientes
       — no se trunca el histórico subyacente, solo lo visible.
    4. *Entradas obsoletas señaladas.* Si la ruta de un proyecto reciente ya no existe en disco (carpeta
       movida o borrada), la tarjeta lo indica visualmente (p. ej. atenuada, con aviso) en vez de fallar
       sin explicación al intentar abrirla — mejora no pedida explícitamente pero que se cuela directamente
       en el alcance de "rediseñar cómo se presentan los recientes".
    5. *Funciona en los tres temas* (claro/oscuro/sepia) y a ancho de ventana pequeño, mismo criterio de
       calidad que el resto de superficies visuales del producto (`DESIGN.md`).

- [ ] **RF-45 El editor de diagramas gana una entrada visible en el menú "Herramientas".**
  El editor WYSIWYG de RF-31 (v0.6.0) solo es alcanzable hoy como un icono entre una veintena en la barra
  de herramientas del editor de texto — "muy disimulado", en palabras del usuario. No cambia el editor de
  diagramas en sí (RF-31 sigue íntegro), solo dónde se entra a él.
  - **Criterios de aceptación:**
    1. *Entrada propia en el menú Herramientas (RF-32)*, con icono y etiqueta legible, no solo un
       pictograma — mismo nivel de visibilidad que ya tienen el runner de Python (RF-22) o el runner de
       JavaScript (RF-38) dentro de ese mismo menú.
    2. *El icono de la barra del editor puede conservarse como atajo adicional* (decisión de `/plan`: dos
       vías a la misma acción no repiten el problema de RF-25/26 mientras ambas abran exactamente el mismo
       editor, sin comportamiento divergente).
    3. *Sin proyecto/documento abierto se deshabilita*, mismo criterio que el resto de entradas de
       Herramientas (RF-32.3).

- [ ] **RF-46 Editor visual interactivo de ecuaciones matemáticas.**
  Nueva capacidad, sin precedente en RF-13/RF-20 (que solo insertan símbolos sueltos o marcado estático).
  El usuario fue explícito sobre el alcance: **no** es un catálogo de plantillas de inserción rápida, es
  una **interfaz visual e interactiva** donde la ecuación se va construyendo y ajustando con **vista previa
  en vivo** de cómo queda, y solo al terminar se inserta como código Typst en el cursor. El artículo de
  referencia (§ sección "Application of Typst for Computer Science"/"Mathematics") no describe ningún
  editor visual de este tipo ya hecho para Typst — es diseño propio de este producto, no una integración de
  paquete existente.
  - **Criterios de aceptación:**
    1. *Construcción incremental con vista previa en vivo.* El usuario compone la ecuación por piezas
       (fracción, exponente/subíndice, sumatorio/integral/producto, matriz, símbolos griegos y operadores,
       delimitadores) y ve en todo momento cómo se renderiza el resultado, antes de decidir insertarlo —
       no un formulario que solo se ve al final.
    2. *Inserción explícita y única.* La ecuación solo entra en el documento cuando el usuario confirma
       (botón "Insertar"), como código Typst (`$...$` o bloque de ecuación) en la posición del cursor, con
       la misma sensibilidad al contexto que ya usa RF-13 (`isInsideMath()`).
    3. *Reapertura para editar (deseable, no bloqueante):* si es alcanzable sin complejidad desproporcionada,
       reabrir una ecuación ya insertada desde su código Typst la recupera en el editor visual — mismo
       espíritu que la "edición bidireccional mínima" que RF-31.3 ya exige para diagramas; si `/plan` lo
       encuentra desproporcionado para esta primera versión, queda documentado como diferido, no descartado
       en silencio.
    4. *Soporte del paquete MiTeX para pegar LaTeX ya escrito.* Complementa al editor visual (no lo
       sustituye): quien ya tiene una fórmula en sintaxis LaTeX puede pegarla y se traduce/envuelve
       para Typst, sin tener que reconstruirla pieza a pieza en la interfaz visual. Investigación puntual
       de `/plan` sobre el paquete real (`@preview/mitex`) antes de comprometerse, misma disciplina que
       cualquier otra integración de Typst Universe en este proyecto.
    5. *Motor de renderizado de la vista previa en vivo* (recompilar con el sidecar en cada ajuste vs. una
       libreria de render matemático embebida en el frontend) se decide en `/plan` con un spike dedicado,
       igual que se hizo para la sincronización editor↔preview (Spike S-2) — es la decisión técnica de
       mayor riesgo de este RF y no debe resolverse "sobre la marcha" en `/build`.

- [ ] **RF-47 Diagramas de flujo con decisiones (Fletcher/Matofletcher).**
  Primera ampliación de diagramación, y la de mayor prioridad acordada: extensión natural del editor
  WYSIWYG ya existente (RF-31), que hoy dibuja nodos y flechas genéricos pero no tiene un modo dedicado a
  flujogramas con bifurcaciones de decisión (sí/no) como los que produce el paquete Fletcher (vía su
  envoltorio Matofletcher, según cataloga la Sección XI del artículo de referencia).
  - **Criterios de aceptación:**
    1. *Nodo de decisión propio* en el lienzo del editor de RF-31 (forma de rombo, dos salidas etiquetables
       "sí"/"no" o etiqueta libre), distinto del nodo de proceso rectangular ya existente.
    2. *Emisión de código limpio* usando el paquete elegido en `/plan` (Fletcher directamente o vía
       Matofletcher — la elección concreta y su import se cierran ahí, no aquí), con el mismo criterio de
       RF-31.2 (import deduplicado, código legible e insertable).
    3. *No rompe los tipos de diagrama ya cubiertos por RF-31* (flujo genérico, bloques/arquitectura,
       gráficas 2D, lienzo libre) — es una ampliación del mismo editor, no una superficie nueva.

- [ ] **RF-48 Diagramas de secuencia (Chronos).**
  Segunda prioridad acordada. Actores, mensajes (síncronos/asíncronos), activaciones y ciclos de vida —
  tipo de diagrama frecuente en documentación técnica de proyecto (el propio caso de uso real que motivó
  esta sesión de `/spec` es un glosario de arquitectura con actores UTE/AMTEGA) y ausente por completo del
  editor actual.
  - **Criterios de aceptación:**
    1. *Asistente o modo dedicado* (a decidir en `/plan` si se integra como un modo más del lienzo de
       RF-31 o como una superficie propia más simple, dado que un diagrama de secuencia es
       estructuralmente distinto de un lienzo de nodos/flechas libre) que permite definir actores y la
       secuencia de mensajes entre ellos.
    2. *Emisión de código con el paquete Chronos* (`#import "@preview/chronos:..."`, versión exacta a
       verificar en `/plan` contra el registro real de Typst Universe, misma disciplina que fijó
       `ADR-UNIVERSE-001` para el resto de paquetes curados de este proyecto).
    3. *Accesible desde el menú Herramientas (RF-45)*, no como una superficie oculta nueva.

- [ ] **RF-49 Diagramas de Gantt (Gantty/Timeliney).**
  Tercera prioridad acordada. Encaja directamente con el tipo de documentos de gestión de proyecto que
  produce el perfil de usuario objetivo (fases, hitos, fechas de entrega).
  - **Criterios de aceptación:**
    1. *Asistente o modo dedicado* para definir tareas/fases con fechas de inicio y fin, y su agrupación
       (p. ej. "Investigación", "Redacción", "Producción" como en el ejemplo del artículo de referencia).
    2. *Emisión de código con el paquete elegido en `/plan`* entre Gantty y Timeliney (evaluación de
       cuál de los dos encaja mejor con el editor visual, no una elección arbitraria) — versión verificada
       contra el registro real antes de curarla, mismo criterio que el resto del catálogo.
    3. *Accesible desde el menú Herramientas (RF-45)*.

- [ ] **RF-50 Tableros Kanban (Kantan).**
  Cuarta prioridad de diagramación, **activada sin condición el 2026-09-14** (ver cabecera del documento,
  v1.9): el usuario decidió completarla en la misma v0.7.0 en vez de diferirla, tras cerrar y probar en vivo
  los otros nueve RF de esta versión. Paquete verificado contra el registro real de Typst Universe
  (`packages.typst.org/preview/index.json`, 2026-09-14): `kantan:0.1.0`, único release publicado, licencia
  **AGPL-3.0-only** (README real descargado y leído, no adivinado — ver nota de licencia más abajo).
  - **Criterios de aceptación:**
    1. *Asistente de formulario, no lienzo de arrastre* — mismo criterio que RF-48/RF-49
       (`ADR-DECISION-004`): un tablero Kanban para ilustrar un documento no necesita arrastrar tarjetas
       entre columnas en tiempo real, solo declarar su contenido. El asistente gestiona una lista de
       **columnas** (nombre + color opcional) y, dentro de cada columna, una lista de **tarjetas** (nombre,
       asignado opcional, coste/dificultad, prioridad) — añadir/quitar columnas y tarjetas con los mismos
       controles ya usados en los asistentes de secuencia y Gantt (`sequence-editor__row`/`__remove`).
    2. *Emisión de código con el paquete real* — llamadas anidadas `kanban(kanban-column(name, color:,
       kanban-item(hardness-level, priority-level, ..args)), ...)`, con `args` como 1 argumento posicional
       (solo nombre de tarjeta) o 2 (asignado + nombre), según traiga o no asignado la tarjeta del
       formulario — API real confirmada leyendo `README.md` del paquete, no inventada.
    3. *Accesible desde el menú Herramientas (RF-45)*, mismo patrón que los otros tres asistentes de
       diagramación de esta versión.
    4. *Nota de licencia (AGPL-3.0-only).* Más estricta que el LGPL ya aceptado para `cetz`/`gantty`
       (`ADR-DECISION-005`), pero el razonamiento es el mismo: esta app no vendoriza ni enlaza estáticamente
       el código del paquete — lo descarga el propio compilador Typst a la caché de paquetes del usuario
       cuando el documento lo importa, igual que cualquier otro `@preview/...`. El cláusula de red del AGPL
       (Affero) tampoco aplica: Kantan no se ejecuta como servicio, es código Typst que se tipografía en
       tiempo de compilación. Se cura igualmente en `curatedCatalog.js` con su licencia real visible, para
       que quien lo mire desde el Universe Browser (RF-34) sepa exactamente a qué se compromete su propio
       documento si lo redistribuye con el paquete modificado — decisión de transparencia, no de bloqueo.

- [ ] **RF-51 Render de diagramas DOT/Graphviz (Diagraph).**
  Quinta prioridad de diagramación, **activada sin condición el 2026-09-14** junto con RF-50 (antes ambas
  eran un único RF-50 condicional). Paquete verificado contra el registro real: `diagraph:0.3.7`, el más
  reciente publicado, licencia **MIT**, requiere Typst ≥0.13.0 (el sidecar vendorizado de este proyecto es
  0.15.1, cumple con margen). Renderiza Graphviz vía un plugin Wasm embebido en el propio paquete — sin
  exigir el binario de Graphviz instalado en el sistema del usuario, la razón original por la que este
  requisito interesa: sirve para quien ya trae un `.dot` exportado de otra herramienta y solo quiere
  incrustarlo en el documento.
  - **Criterios de aceptación:**
    1. *Sin asistente visual de nodos/aristas — un campo de texto con el DOT tal cual.* La API real del
       paquete es una sola función, `render(dot_string)` (o `raw-render` sobre un bloque ```` ```dot ````),
       que toma el lenguaje DOT de Graphviz literal. Quien usa este requisito ya conoce o ya tiene ese DOT
       escrito en otro sitio (Sección XI del artículo de referencia lo describe así); construir un editor
       visual de nodos/aristas encima duplicaría el editor de diagramas de RF-31 sin aportar nada a quien
       parte de un `.dot` ya hecho.
    2. *Vista previa en vivo, reutilizando la infraestructura de RF-46* — el mismo patrón de
       `equation.rs`/`typst_compile_equation` (compilar contra el sidecar real en cada pausa del usuario, sin
       compartir el `EngineState` de la vista previa principal) sirve igual aquí para una viñeta de DOT: la
       elección exacta de generalizar `equation.rs` o duplicar un comando equivalente se resuelve en
       `/plan`, no aquí.
    3. *Emisión de código con el paquete real* — `#import "@preview/diagraph:0.3.7": render` + `#render("...")`
       con el texto DOT del usuario escapado como cadena Typst (mismo `escapeTypstString` ya compartido por
       los otros tres asistentes tras `/code-simplify`, `typstEscape.js`).
    4. *Accesible desde el menú Herramientas (RF-45)*, mismo patrón que el resto.

- [ ] **RF-52 Botón de ayuda contextual en cada asistente de diagramación.**
  Añadido el 2026-09-15 (v1.10) tras probar el usuario en vivo el asistente de DOT/Graphviz recién
  construido (RF-51): a diferencia de los otros cinco asistentes de esta versión, DOT no tiene ninguna
  ayuda visual que construya la sintaxis por el usuario — el propio texto DOT que se escribe ES el
  contenido, así que quien no conoce ese lenguaje "lo tiene complicado" (palabras del usuario). El mismo
  problema, en menor medida, aplica a cualquiera de los otros asistentes para quien no recuerde su flujo.
  - **Criterios de aceptación:**
    1. *Botón "?" en la cabecera* de los seis paneles de diagramación de esta versión (editor de diagramas
       RF-31/RF-47, ecuaciones RF-46, secuencia RF-48, Gantt RF-49, Kanban RF-50, DOT/Graphviz RF-51), junto
       al botón de cierre — no una superficie nueva, un punto de entrada más a la Ayuda ya existente.
    2. *Abre el panel de Ayuda ya centrado* en la sección correspondiente a ESE asistente, sin que el
       usuario tenga que buscarla en el índice.
    3. *Contenido de Ayuda del asistente de DOT ampliado* con una chuleta mínima de sintaxis (grafo
       dirigido/no dirigido, etiquetas de arista, atributos de nodo) — un enlace a una sección vacía de
       contenido no resolvería el problema real reportado.
    4. *Opt-in, no en todo panel de la aplicación* — un panel declara su sección de ayuda explícitamente;
       paneles que no lo necesitan (selectores de cita/imagen/símbolo, tabla...) no ganan un botón de la
       nada.
    5. *(RF-52.1, añadido el mismo día tras probar el usuario los enlaces en vivo)* Cada sección de Ayuda
       de un asistente que se apoya en un paquete/lenguaje externo (cetz, MiTeX/Typst math, chronos, gantty,
       kantan, Graphviz) termina con un enlace a SU documentación original, tras la explicación propia —
       la explicación de esta app no sustituye a la referencia completa de quien mantiene esa sintaxis.
       Abre con el navegador del sistema (`open_external_url`, Rust), nunca navegando el propio WebView.

### Descartado explícitamente para v0.7.0 (Sección XI del artículo de referencia)

Evaluados y descartados por bajo encaje con el perfil de usuario actual de DBV Typst Editor (§3) — no son
un olvido, es una decisión de alcance tomada en esta misma sesión de `/spec`, 2026-09-14:

- **Pintora/Pintorita** (texto→diagrama de actividad/clases/ER): el propio artículo de referencia advierte
  de un coste de compilación de hasta **decenas de segundos** por depender de un intérprete JavaScript
  sobre Wasm — contradice el objetivo de vista previa "instantánea" (RF-06) de este producto.
- **Zap / Circuiteria / Quill** (circuitos electrónicos/cuánticos): público de electrónica/computación
  cuántica, fuera de los perfiles de usuario de §3 (profesorado, investigación, TFG/TFM, escritura técnica).
- **Algorithmic** (pseudocódigo académico de algoritmos): público de Ciencias de la Computación específico,
  no el perfil principal del producto.
- **Touying** (presentaciones tipo Beamer): descartado de *este* alcance por ser una funcionalidad de
  tamaño mayor —un modo "Presentación" completo, comparable en esfuerzo a RF-31 o RF-46— y no un ítem de
  menú incremental; candidato explícito para una futura versión con `/spec` propio si el usuario lo pide.

## ✨ 5h. Funcionalidades — v0.8.0 (Rendimiento con documentos grandes + Documento principal + Homebrew)

> **Origen (2026-09-19):** la v0.7.0 se probó en un Mac con un libro real de 220 páginas (`z6-IPbook`: CPU al 95 %, proceso en 8,9 GB) y en Windows con un informe suelto en `Descargas` (casi un minuto en abrirse). Estos requisitos se **registran a posteriori**: nacieron de medir problemas reales, no de una especificación previa, y este apartado deja constancia de qué se decidió y por qué. Detalle técnico y mediciones en `CHANGELOG.md` (`[0.8.0]`) y en `memory.md` (Lecciones Aprendidas, 2026-09-19).

### RNF-PERF — La vista previa escala con documentos grandes
1. La memoria de la vista previa **no crece sin techo** al recorrer un documento largo: el marcado de una página alejada más de 2.500 px del viewport se libera, conservando su hueco (el scroll no salta) y se vuelve a pedir si el lector regresa.
2. La pausa de escritura antes de recompilar **se adapta** a lo que tardó la última compilación real (1,5×, mínimo 350 ms, techo 6 s).
3. La réplica temporal de un `.typ` suelto **solo copia lo que un documento Typst puede leer**, y ninguna réplica copia ficheros de más de 32 MB que no pueda enlazar. Una carpeta abierta como proyecto se replica entera.
4. Criterio de aceptación medido: un informe suelto en una carpeta de 59 GB abre en segundos; un libro de 220 páginas (86 MB de SVG, 4,6 s por compilación) no acumula memoria al recorrerlo.

### RF-53 — Documento principal elegible desde la interfaz
1. Un proyecto sin `main.typ` deja de depender de la heurística alfabética del backend: el usuario marca cuál es el documento principal.
2. El árbol de ficheros muestra una etiqueta **principal** en ese fichero. El botón derecho sobre un `.typ` ofrece "Establecer como documento principal" (no en carpetas, en ficheros que no sean `.typ` ni en el que ya lo es) y "Mostrar en el explorador"; el menú Archivo ofrece lo mismo para el fichero abierto.
3. Marcar otro fichero **anula el anterior**, devuelve el alcance de la vista previa a "Documento" y recompila.
4. La elección se guarda **por proyecto en la aplicación** y no escribe nada en la carpeta del usuario; el valor guardado se trata como dato no fiable (rutas absolutas y `..` se rechazan) y se aplica al reabrir solo si el fichero sigue existiendo. ***Modificado en v0.12.0 por RF-83 (§5l):** la elección se escribe además en el manifiesto del proyecto, y la de la aplicación queda como respaldo.*

### RF-54 — Tinymist bajo demanda y desactivable
1. Tinymist ya **no arranca al abrir un proyecto**: arranca solo cuando el documento abierto tiene menos de 100.000 caracteres; con uno mayor espera a que el usuario pulse la insignia "Activar Tinymist". Pasar a un documento grande lo detiene.
2. Pulsar la insignia con Tinymist activo lo **desactiva**, y la preferencia se recuerda entre sesiones y proyectos hasta que se pulse de nuevo.
3. Un arranque fallido no se reintenta solo con cada documento que se abre.
4. Motivo: Tinymist compila el documento entero en segundo plano y recibe el texto completo en cada pulsación, además de la vista previa propia.

### RF-55 — Canal Homebrew para macOS y Linux, y comando `typs`
1. Un tap propio (`davidbuenov/homebrew-dbv-typst-editor`) con **un único Cask** para macOS (`.dmg` universal) y Linux x86_64 (`.AppImage`, Homebrew 6.0.0+). Se actualiza automáticamente al publicarse una Release (`update-homebrew-tap.yml`); el tap se valida en CI en macOS y Ubuntu.
2. El Cask instala el comando de consola **`typs`**: `typs`, `typs fichero.typ`, `typs carpeta/` y `typs .`, que devuelven el terminal en cuanto se abre la ventana.
3. La aplicación acepta, al arrancar o por instancia única, **ficheros `.typ` y carpetas existentes** (una carpeta se abre como proyecto), y resuelve las rutas relativas contra el directorio de quien la invocó.
4. **Pendiente de verificación en un Mac real:** que `open -a "DBV Typst Editor" <carpeta>` llegue a la aplicación como Apple Event con la carpeta, y el bucle de recompilación de macOS (hipótesis: eventos de solo metadatos de Spotlight; mitigado descartándolos en el observador de ficheros).

---

## ✨ 5i. Funcionalidades — v0.9.0 (Motor en proceso: sincronización exacta + velocidad tras cada edición)

> **Origen (2026-09-20):** tras publicar v0.8.0, el usuario probó la sincronización con un libro real (`z6-IPbook`, 224 páginas) y pidió que "vaya directamente al punto correspondiente", no solo al bloque; y quiere recuperar el lema del producto —la velocidad— tras cada edición. Se estudió Hilbert Editor (MIT), que resuelve el clic → fuente cargando el crate `typst` y leyendo el `Span` de cada glifo, y se midió el **Spike S-3** (`spikes/typst-jump/README.md`) sobre ese mismo libro. **No se busca copiar su solución sino superarla**: un solo compilado, en proceso, del que salen la imagen y el mapa exacto al fuente. Decisión de arquitectura en `ADR-MOTOR-001` (`memory.md`) y `ARCHITECTURE.md` §7.17.
>
> **Decisiones del usuario (2026-09-20):** (1) el motor clásico (CLI + réplica + anclas) queda como **respaldo automático** durante esta versión y se retira en la 0.10; (2) las **exportaciones (PDF/PNG) siguen con el CLI**; (3) entre las mejoras extra propuestas, solo entra **diagnósticos en línea** (RF-59); (4) se añade **editar ficheros de texto y código** (RF-60) y el **menú contextual del editor** (RF-58). La v0.8.0 queda como está (sin instalador de Windows: solo Store, `ADR-WINDOWS-001`); lo construido después —arreglo de etiquetas tras encabezados, marca visual por bloque— **entra en la 0.9.0** como parte del motor clásico de respaldo.

### RNF-MOTOR — Presupuesto de rendimiento y método de medida
1. **Edición → vista previa actualizada** (página visible repintada): ≤ **1,5 s** (p95) en un libro de ≥ 220 páginas; ≤ **150 ms** en un documento de menos de 20 páginas. *Punto de partida medido (S-3):* 0,54–0,72 s de compilación incremental + 2–5 ms por página SVG, frente a ≈ 5 s hoy.
2. **Compilación en frío** (abrir el proyecto): no peor que la del CLI + 10 % (medido: 4,4 s frente a 4,6 s — *no hay ventaja en frío, y no se promete*).
3. **Salto de sincronización:** ≤ **50 ms** con el mapa ya construido; ≤ **500 ms** cuando hay que construirlo (0,33 s para el libro de 224 páginas, medido).
4. **Memoria:** sin crecimiento sin techo tras 100 ediciones consecutivas y al recorrer el documento entero. El **techo concreto se fija en `/plan`** tras medirlo: el Spike S-3 no midió memoria.
5. **Binario y CI:** el incremento de tamaño del ejecutable y de tiempo de compilación en CI se **miden en `/plan`** antes de comprometerse (el Spike S-3 solo midió que las dependencias compilan en ≈ 2 minutos).
6. **Método:** un corpus sintético versionado de ≥ 200 páginas en `testfiles/` (no dependiente de material con derechos) para las pruebas automáticas, y el libro real como prueba manual del usuario. Las cifras de aceptación se comprueban con un guion (`npm run verify:engine`), no a ojo.

### RF-56 — Motor de vista previa en proceso (compilación incremental)
1. La vista previa compila con **Typst como librería** (`typst`, `typst-ide`, `typst-layout`, `typst-svg`, `typst-kit`), con versiones **exactas iguales a las del sidecar vendorizado** (hoy 0.15.1). Una prueba falla si dejan de coincidir: es la condición para que la imagen y las exportaciones con el CLI sean idénticas.
2. Un **mundo persistente por proyecto** conserva la caché incremental de Typst entre compilaciones. El contenido sin guardar entra como **sustitución en memoria**: **desaparecen la réplica del proyecto, las anclas sembradas y las escrituras en temporales** del motor nuevo. Los ficheros de disco se vuelven a leer cuando cambian.
3. Cada compilación se ejecuta **fuera del hilo de la interfaz**, y **gana la última**: una compilación obsoleta se descarta al terminar y no se pinta. Una compilación en proceso **no se puede cancelar a mitad**; se acepta y se documenta (el CLI sí, matando el proceso).
4. Del mismo documento compuesto se genera el **SVG solo de las páginas visibles** (más un margen); las demás, bajo demanda. La memoria del documento anterior se libera al sustituirlo, al cerrar el proyecto y tras un periodo de inactividad.
5. **Fuentes idénticas a las del CLI** (carpeta `fonts/` del proyecto, variables `TYPST_*` que hoy respeta el sidecar, mismo orden de prioridad). Sin red en el motor: si falta un paquete de Typst Universe, **la descarga se delega en el sidecar**, que la deja en la caché compartida, y se reintenta.
6. **Respaldo automático al motor clásico** si el motor en proceso entra en pánico, falla su arranque, se detecta una incompatibilidad, o una compilación supera el tiempo máximo actual (45 s). Se avisa en la barra de estado ("motor clásico") y se puede **forzar** desde un ajuste. Tras un tiempo máximo, el hilo colgado se abandona y el mundo se recrea.
7. **Exportar PDF/PNG y Universe/paquetes siguen con el CLI** (decisión del usuario). El panel de navegación (Outline) sale del mismo compilado del motor nuevo y del CLI en el clásico.
8. **Criterios de aceptación:** los de RNF-MOTOR-1 a 4; el árbol de ficheros, los alcances (RF-14), el refresco manual/automático (RF-15) y el documento principal (RF-53) funcionan sin cambios; el comportamiento con errores es el de hoy (se conserva la última vista buena).

### RF-57 — Mapa render↔fuente y sincronización exacta (sustituye a RF-16 en el motor en proceso)
1. **Mapa por glifo** construido del mismo documento compuesto: cada glifo dibujado con el **rango de bytes del fuente** del que salió (`Span` + desplazamiento dentro del nodo de texto), a **nivel de palabra y de frase**, atravesando grupos y transformaciones (girados, escalados, recortes) y ficheros incluidos.
2. **Casos que se resuelven aparte, no por el glifo:** las **referencias** (`@sec-x`, "Ecuación (1)") y las **citas** responden con la referencia tal como se escribió, no con el destino; el texto **generado sin fuente propio** (numeración, "Figura 1:", marcador de nota al pie) responde con el elemento al que pertenece; imágenes y formas con el elemento que las produjo; ecuaciones a nivel de símbolo (subíndices, superíndices, delimitadores grandes).
3. **Render → fuente (doble clic):** el cursor va al **byte exacto**, **abriendo el fichero** que corresponda, y la **palabra queda seleccionada**. Los huecos entre letras y un punto justo bajo la línea base pertenecen a la palabra.
4. **Fuente → render** (menú contextual, atajo o botón, RF-58): la vista previa se desplaza a la posición exacta, y se **resalta la palabra bajo el cursor**; **con una selección en el editor se resalta la selección completa (la frase)**, con una caja por línea cuando ocupa varias. Sustituye a la marca por bloque de la v0.8.x.
5. **Frescura del mapa:** el mapa pertenece a la **generación** del render que se ve. Si el fuente ha cambiado desde esa compilación (se está escribiendo, o el refresco es manual, RF-15), las posiciones se **reasignan con los cambios pendientes del editor**; si el trozo fue borrado, se cae al vecino más cercano **y se avisa**. Un salto nunca aterriza en un sitio equivocado en silencio.
6. **Sin anclas ni réplica** en el motor nuevo. En el motor clásico se conserva el mecanismo de RF-16 (anclas entre bloques), con su precisión de bloque y su marca por bloque, como degradación aceptada.
7. **Criterios de aceptación medibles:** sobre el corpus de RNF-MOTOR-6 y el libro real, ≥ **95 %** de las palabras de prosa (excluyendo código, comentarios y texto generado) se localizan por **palabra** en ambos sentidos (*Spike S-3, con una métrica más tosca: 93,5 % fuente→render y 83,8 % clic→fuente*); tests con fixtures de: prosa, encabezados numerados, listas, tablas, notas al pie, ecuaciones y referencias, dos columnas, figuras flotantes, texto girado y escrituras de derecha a izquierda; ningún salto del corpus aterriza en un fichero distinto del que contiene el texto marcado.

### RF-58 — Menú contextual del editor con "Ir a la vista previa"
1. El **botón derecho en el editor** abre un menú propio (hoy solo existe el del árbol de ficheros): **Ir a la vista previa** (con su atajo a la vista), separador, **Cortar, Copiar, Pegar, Seleccionar todo**. Cortar y Copiar se desactivan sin selección.
2. **Ir a la vista previa** lleva la vista previa a la palabra bajo el cursor —o marca la selección— según RF-57. Si el panel de la vista previa está oculto (modo Escritura/Edición), **lo muestra primero**. Si el fichero abierto **no forma parte del documento que se está viendo**, lo dice y ofrece cambiar el alcance (RF-14); nunca falla en silencio.
3. **Atajo de teclado propio**, fijado en `/plan` comprobando conflictos con la barra de inserción y el resto de atajos, y listado en la Ayuda. El botón ⇥ de la barra de la vista previa y el doble clic se conservan.
4. **Accesible:** se abre también con la tecla de menú contextual / `Mays+F10`, se recorre con flechas, se cierra con `Esc` devolviendo el foco al editor, con `role="menu"`; textos en español e inglés.
5. **Riesgo a resolver en `/plan`:** Cortar/Copiar/Pegar deben funcionar en los tres motores web (WebView2, WKWebView y WebKitGTK); pegar exige el permiso de lectura del portapapeles, que no se concede igual en los tres. Se verifica en cada plataforma, no se supone.

### RF-59 — Diagnósticos en línea desde el mismo compilado
1. Los **errores y avisos** del compilador salen del **mismo compilado** del motor en proceso, con su **fichero y rango exacto** (y las pistas que Typst aporta): **subrayado en el editor** del fichero abierto y un **panel de Problemas** con la lista, el recuento en la barra de estado y **clic para saltar** (abriendo el fichero si hace falta).
2. **No dependen de Tinymist**, que ahora arranca bajo demanda (RF-54): con Tinymist apagado siguen viéndose. Si está activo y también informa, **se deduplica por (rango, mensaje)** y prevalecen los del compilador para los errores de compilación; Tinymist conserva lo suyo (análisis y autocompletado).
3. **Números de línea y rutas correctos por construcción** (sin la réplica temporal ni el remapeo de rutas del motor clásico).
4. En el motor clásico se conserva la banda de mensajes actual (`stderr` del CLI).
5. **Criterios de aceptación:** un error en un capítulo incluido y no abierto aparece en el panel con su fichero y línea reales, y al abrirlo está subrayado en el sitio exacto; al corregirlo desaparece en la siguiente compilación; los avisos no bloquean la vista previa.

### RF-60 — Editar ficheros de texto y de código con resaltado
1. **Qué se puede abrir y editar:** además de `.typ` y de los tres acompañantes de hoy (`.bib`, `.toml`, `.yml`), una lista de extensiones de **código y texto** sin necesidad de salir a otro editor: `.c .h .cpp .cc .hpp .cs .java .kt .py .js .ts .rs .go .rb .php .sh .ps1 .sql .r .m .swift .lua .css .html .xml .json .yaml .csv .tsv .txt .md .tex .ini .log .csl`. El árbol las marca editables **por extensión, sin leer el fichero** (listar carpetas no debe costar E/S). Para cualquier otra, el menú contextual ofrece **"Abrir como texto"**.
2. **Solo texto, sin comportamiento especial:** sin barra de inserción de Typst, sin asistentes, sin LSP ni diagnósticos de Typst. Editar un `.cpp` **no cambia el documento que se previsualiza**.
3. **Resaltado de sintaxis** con **paquetes de lenguaje cargados a demanda** (uno por lenguaje, solo cuando se abre un fichero de ese tipo), sin red y sin engordar el arranque: el tamaño del paquete inicial **no crece** (se mide). Los colores usan los **mismos tokens `--code-*`** que el resaltado de Typst, así que respetan los **tres temas** (claro, oscuro y sepia) sin colores propios. Se muestra el **nombre del lenguaje** en la barra del documento.
4. **La vista previa se entera de lo que se edita:** un `.cpp` que el documento incrusta con `read()` **actualiza la vista previa mientras se escribe, sin guardar** (con el motor en proceso el coste es de décimas de segundo); en el motor clásico, al guardar (como hoy los `.bib`).
5. **Guardarraíles:** el fichero se guarda **byte a byte como estaba** salvo lo editado: se **conservan los finales de línea** (CRLF/LF), el BOM y la ausencia o presencia de salto de línea final; se rechaza —o se ofrece abrir en solo lectura— lo que **no sea UTF-8 válido o contenga bytes NUL**; y hay un **tamaño máximo** (a fijar en `/plan`, orientativo 5 MB) con aviso claro.
6. **Fuera de alcance de este requisito (registrado):** autocompletado, formateo, ejecución o compilación de esos lenguajes; el runner de Python (RF-22) sigue siendo independiente.
7. **Criterios de aceptación:** abrir un `.cpp`, un `.java` y un `.py` los muestra coloreados en los tres temas; guardar un `.cpp` con CRLF lo deja con CRLF; un fichero binario no se abre como texto; el tamaño del paquete inicial no cambia; un `.cpp` incrustado con `read()` refleja la edición en la vista previa.

### Diferido y registrado (NO entra en la 0.9.0, decisión del usuario)
- **Sincronización continua** (que editor y vista previa se sigan al mover cursor o scroll): con el mapa cuesta microsegundos; candidata a la 0.10.
- **Vista previa interactiva:** buscar y copiar texto, enlaces y referencias clicables. Hoy el SVG solo lleva glifos; el mapa lo haría posible.
- **Apertura instantánea** (última imagen conocida al abrir), **tiempo de compilación en la barra de estado** y **repintado solo de las páginas que cambian**.
- **Exportar PDF/PNG en proceso** (mismo compilado, con progreso).
- **Retirada del motor clásico** (réplica, anclas, reintento sin anclas): prevista para la 0.10, cuando el motor nuevo lleve una versión en uso.

### Preguntas abiertas para `/plan` (no se resuelven aquí a propósito)
- Techo de memoria del motor en proceso, incremento de tamaño del binario y de tiempo de CI (RNF-MOTOR-4/5).
- Estrategia exacta de fallo y reinicio del hilo de compilación (RF-56.6) y de comunicación de resultados obsoletos.
- Cómo se reutiliza el documento compuesto del motor nuevo para el Outline (hoy `typst eval`).
- Atajo de RF-58 y comprobación de portapapeles en las tres plataformas.
- Lista definitiva de lenguajes de RF-60 y su paquete de resaltado (`@codemirror/lang-*` o `legacy-modes`); tamaño máximo de fichero.
- Auditoría de licencias de los crates nuevos (Typst es Apache-2.0, compatible con la licencia MIT del proyecto; requiere conservar los avisos) y de la versión mínima de Rust.
- Cómo coexisten, durante una versión, el motor nuevo y el clásico en `EngineState` sin duplicar la lógica de alcance y de refresco.

---

## ✨ 5j. Funcionalidades — v0.10.0 (Pulido, flujo de guardado y decisión sobre el motor clásico)

> **Origen (2026-09-21):** un amigo del usuario, entusiasmado con la 0.9.0, le pasó una lista de cosas a arreglar. **No se dieron por buenas**: se analizaron una a una contra el código y el usuario decidió cuáles entran. El diagnóstico de RF-61 y RF-62 se hizo **leyendo el código, sin ejecutar la aplicación**: la causa de RF-61 está por confirmar en `/test` con una ventana real.
>
> **Fuera de alcance, aparcado por decisión del usuario (2026-09-21):** esquema de macros cuando no hay encabezados `==`; enlaces de la salida; gestión de ficheros en el panel (crear, renombrar, borrar, mover). Quedan registrados aquí para no perderlos. *(Los enlaces de la salida y la gestión de ficheros se recuperan en v0.11.0: RF-72 y RF-69, §5k.)*
>
> **Convención de estilo, sin cambios:** los ficheros en gris en el panel Archivos (p. ej. `.gitignore`, `IP.pdf`) significan «existe pero no se puede abrir». Es intencionado y **no se toca**.

### RF-61 — Formatear solo actúa sobre Typst y siempre dice qué pasó
1. **Causa (leyendo el código):** `editor.js` envuelve el cliente LSP en `typstOnlyLsp` para apagarlo con ficheros que no son Typst, pero solo sobrescribe `isActive`; `formatDocument` se copia con `...lspClient` y conserva el estado interno, y el botón llama además directamente al cliente original. Con un `.bib`, `.cpp` u otro fichero delante, se pide formatear **el último `.typ` abierto** y las ediciones resultantes se aplican al buffer equivocado: riesgo de **corromper el fichero abierto**.
2. El botón **Formatear** y `Mayús+Alt+F` actúan **solo en ficheros Typst**. En cualquier otro, el botón se ve **deshabilitado** (atenuado, con su motivo en el tooltip) y el atajo no hace nada. La guarda de tipo de fichero vive **dentro de `formatDocument`**, no solo en `isActive`, para que ningún camino la salte.
3. Resultados **distinguibles** (hoy `lspClient.js` devuelve `false` en silencio en todos los fallos): *formateado*, *ya estaba formateado*, *Tinymist apagado o arrancando* (con la forma de activarlo, RF-54) y *error* (con el motivo).
4. El texto y el tooltip del botón dicen la verdad: el formateo depende de Tinymist activo.
5. **Criterios de aceptación:** un test abre un `.bib` y comprueba que **no se envía ninguna petición de formateo** y que el buffer no cambia; con Tinymist apagado, pulsar Formatear muestra el aviso correspondiente; en un `.typ` ya formateado se avisa de que no había cambios; con un `.typ` desordenado queda formateado.

### RF-62 — Resaltado de BibTeX
1. **Causa:** `@codemirror/language-data` solo trae `sTeX` y `LaTeX`; no hay lenguaje para `.bib`, así que `detectLanguage` lo clasifica como `text` y se abre sin colores.
2. Un **modo propio con `StreamLanguage`** (unas 40 líneas, **sin dependencias nuevas**) reconoce: tipo de entrada `@book`, clave de cita, nombres de campo, valores entre llaves o comillas (anidados), números y comentarios `%%`. Se conecta desde `languageSupport.js` y la insignia del documento dice **«BibTeX»**.
3. Colores con los **mismos tokens `--code-*`** del resto del resaltado (los tres temas, RF-60.3). Carga sin coste para el paquete inicial.
4. **Criterios de aceptación:** abrir `IP.bib` lo muestra coloreado en los tres temas, incluidos valores con llaves anidadas (`{Problem Solving with {C++}}`) que abarcan varias líneas; el tamaño del paquete inicial no crece de forma medible.

### RF-63 — Pulido del espacio de trabajo
1. **Ocultos en Archivos:** el panel **no lista** ficheros ni carpetas que empiezan por punto (`.claude`, `.git`, `.gitignore`…). Un ajuste **«Mostrar ficheros ocultos»**, desactivado por defecto y recordado entre sesiones, los muestra. Se filtra en la presentación: no cambia qué ficheros existen ni qué recorren Git o el explorador de proyecto.
2. **Números de línea optativos:** un ajuste (activado por defecto, para no cambiar el comportamiento actual) los muestra u oculta **en caliente**, sin recargar el editor, y se recuerda entre sesiones. Los marcadores de plegado y de diagnósticos siguen visibles.
3. **Refresco de la vista previa más visible:** hoy el botón está escondido. Pasa a ser un **botón siempre visible** en la barra de la vista previa, con tooltip y atajo listado en la Ayuda. Con el refresco automático activo (RF-15) sigue disponible.
4. **Criterios de aceptación:** con `.claude` y `.hilbert` en la raíz del proyecto, el panel Archivos no los muestra y con el ajuste sí; los números de línea aparecen y desaparecen sin perder la posición del cursor ni el historial; el botón de refresco se ve en todos los modos de panel.

### RF-64 — Guardado automático opcional e indicador de modificado
1. **Guardado automático como opción**, **desactivada por defecto**, **recordada entre sesiones del mismo usuario** (misma persistencia que los demás ajustes de la aplicación). Se guarda tras una **pausa de escritura** y al **perder el foco** la ventana o el editor. *(Valor de la pausa, a fijar en `/plan`; orientativo 2 s.)*
2. El guardado automático **usa el mismo camino que Guardar** (RF-07): conserva el **guardado atómico** (RF-24), la **detección de conflicto externo** y los guardarraíles de RF-60.5 (finales de línea, BOM, salto final). **Nunca pisa** un fichero cambiado por otro programa: ante un conflicto se detiene y avisa, como hoy.
3. **Indicador de modificado estilo Mac:** el texto «sin guardar» de la barra se sustituye por un **punto de color de aviso junto al nombre** del fichero, visible mientras haya cambios sin guardar y con etiqueta accesible (`aria-label`/tooltip) en español e inglés. El color no es la única señal (forma + texto para lectores de pantalla).
4. **Indicador Git:** se **oculta solo el texto «Limpio»** cuando el repositorio no tiene cambios; se **conserva la rama** y el recuento de modificados, conflictos y adelanto/atraso. *(Decisión del usuario, 2026-09-21.)*
5. **Confirmar antes de perder cambios** (`doc.discardTitle`) se mantiene cuando el guardado automático está apagado; con él encendido, cambiar de fichero o cerrar guarda antes en vez de preguntar.
6. **Cerrar la ventana con cambios sin guardar queda protegido siempre**, esté o no activado el guardado automático — no es deuda técnica, entra en este requisito: la aplicación intercepta el cierre (`onCloseRequested` de Tauri) y, si hay cambios sin guardar, con el guardado automático **apagado** pregunta con el mismo diálogo de `confirmDiscardChanges`, y con él **encendido** guarda antes de cerrar sin preguntar. Cubre también recargar o salir por el menú del sistema.
7. **Riesgos a resolver en `/plan`:** guardar dispara recompilaciones y el observador de ficheros (evitar bucles guardado→cambio externo→recarga); interacción con Git (cada guardado ensucia el árbol de trabajo); qué pasa si el guardado automático falla (disco lleno, permisos): debe **avisar y no perder el texto**.
8. **Criterios de aceptación:** con la opción activada, escribir y esperar deja el fichero en disco y quita el punto; con un cambio externo simultáneo aparece el conflicto de RF-07 y **no se sobrescribe**; la preferencia sobrevive a reiniciar; con la opción apagada el comportamiento es el de la 0.9.0 salvo el indicador visual; **cerrar la ventana con cambios sin guardar y el guardado automático apagado muestra el diálogo de confirmación y no cierra hasta responder**; con el guardado automático encendido, cerrar guarda primero y no pierde nada.

### RF-65 — Ruta corta y desambiguada *(si cabe)*
1. **Contexto:** el editor no tiene pestañas; la ruta completa aparece en la **barra del documento**, junto al nombre. Se aplica ahí.
2. Por defecto se muestra **solo el nombre del fichero**; la **ruta completa** queda en el tooltip y un ajuste **«Mostrar ruta completa»** la restaura, recordado entre sesiones.
3. **Desambiguación:** si dos ficheros del proyecto comparten nombre (p. ej. `a/main.typ` y `b/main.typ`), el nombre se amplía **solo hasta donde las rutas difieren** (`a/main.typ`). Aplica a la barra del documento y a los sitios donde la interfaz ya listaba ficheros por nombre (p. ej. lista del panel de Problemas), sin cambiar el árbol, que ya muestra la jerarquía.
4. **Criterios de aceptación:** dos `main.typ` en carpetas distintas se distinguen sin mostrar la ruta absoluta; un nombre único se muestra sin prefijo; la lógica es una función pura con tests.

### RF-66 — Compilar solo el documento principal hasta que se indique *(retirado)*
**Retirado por decisión del usuario (2026-09-22), al aprobar `implementation_plan.md`.** `/plan` había comprobado que el caso que lo motivaba ya funciona: con documento principal (RF-53) y alcance «Documento» (RF-14), abrir un capítulo no cambia lo que se compila (`app/compileTarget.js`, `hasRootDocument`). El usuario no identificó un escenario distinto al que le faltara cobertura, así que no hay nada que construir. Si aparece un caso concreto en el futuro, se reabre como requisito nuevo.

### RF-67 — Decisión informada sobre el motor clásico *(análisis previo, no una retirada decidida)*
1. **Contexto:** el spec de 0.9.0 preveía retirar el motor clásico en la 0.10. El usuario no quiere decidirlo sin datos: el motor en proceso **funcionó muy bien** en la prueba, pero hay dudas de si **quitar el clásico** compensa —mejora real en eficiencia y mantenimiento— o **elimina un respaldo** que puede hacer falta. Hoy el motor en proceso **ya es el predeterminado** (commit `9d82c45`, antes de publicar la 0.9.0, tras validarlo el usuario en ventana real); el clásico queda como respaldo automático y opción manual. *(Corregido en `/plan` de la 0.10: este apartado decía «apagado por defecto», que era el estado de `ADR-MOTOR-002` antes de esa validación.)*
2. **Antes de decidir, se mide y se prueba** (en `/plan`/`/test`, con `z6-IPbook` y el corpus sintético de `npm run verify:engine`):
   - **Código a retirar:** líneas y ficheros del motor clásico (`typst_engine/shadow.rs` ≈ 1.200, `compile.rs` ≈ 1.100 y los lados de JS que dependen de él) y cuántos siguen siendo necesarios de todos modos (exportar PDF/PNG y Outline siguen con el CLI, decisión de 0.9.0).
   - **Eficiencia real:** qué mejora aporta retirarlo (tamaño del ejecutable, tiempo de compilación en CI, memoria, superficie de pruebas), no solo líneas.
   - **Con qué frecuencia y por qué se activa el respaldo:** disparadores de RF-56.6 (pánico, incompatibilidad, tiempo máximo de 45 s) contra proyectos reales y el corpus, y **qué vería el usuario si no existiera** (proyecto sin vista previa frente a vista previa más lenta).
   - **Paridad:** casos en que el motor nuevo difiere del CLI (paquetes ausentes, fuentes, versiones) y qué cubre hoy el respaldo.
   - **Memoria** del motor en proceso con el libro real (3,49 GB medidos en `/plan` con `comemo::evict(10)`, 2,75 GB con `evict(2)`; CLI 2,3 GB) y estabilidad tras muchas ediciones.
3. **Opciones a comparar en la decisión:** (a) **retirar** el clásico; (b) **conservarlo como respaldo sin mantenimiento activo**, solo corrigiendo fallos graves; (c) **dejarlo como está hoy**: motor nuevo predeterminado y clásico como respaldo mantenido.
4. **Cambiar el motor predeterminado es una decisión aparte del usuario**, tomada tras ver esos datos; este requisito **no la adelanta**. Si el resultado es retirar, se especifica como requisito propio con su plan de retirada.
5. **Informe entregado (2026-09-22):** `spikes/engine-review/README.md` (Spike S-4). Inventario real de código (solo ≈1.715 de las 3.187 líneas de `typst_engine/` son retirables — `compile.rs` mezcla exportación, que se queda, con vista previa clásica), tamaño del binario combinado actual (60,6 MiB) y por qué es improbable que retirar el motor clásico lo reduzca de forma perceptible (el peso está en las dependencias del motor nuevo, no en esta lógica propia), la cita de la memoria ya medida en `/plan` de 0.9.0, y lo que **no** se pudo medir esta sesión (frecuencia real del respaldo — sin telemetría, por diseño offline-first — y tamaño/CI sin el motor clásico, que exigiría separar antes exportación y vista previa clásica dentro de `compile.rs`). **Recomendación del informe: (c), dejarlo como está.** Pendiente de que el usuario decida.
6. **Criterios de aceptación:** existe un informe con las cifras anteriores medidas (no estimadas), un resumen de casos en que el respaldo se activó y una **recomendación razonada**, y el usuario elige entre (a)–(c) tras leerlo.
7. **Decisión del usuario (2026-09-28, `/spec` de la 0.12.0): opción (c), dejarlo como está.** El motor en proceso sigue siendo el predeterminado y el clásico se mantiene como respaldo automático. Las funciones que solo existen en el motor en proceso (enlaces de RF-72, búsqueda y copia de RF-82) degradan en el clásico sin errores. **RF-67 queda cerrado.** Si se quiere reabrir, se especifica un requisito nuevo de retirada con su propio plan. Ver `ADR-V0120-001`.

### Preguntas abiertas para `/plan` (no se resuelven aquí a propósito)
- Valor de la pausa del guardado automático y su interacción con el observador de ficheros y con Git (RF-64.6).
- Comportamiento actual al abrir un `.typ` secundario y superficie de cambio real de RF-66 (¿ajuste pequeño o cambio de comportamiento?).
- Si RF-65 y RF-66 caben en esta versión o se aplazan.
- ~~Método y umbrales para RF-67~~ → resuelto en `/plan`: Spike S-4 (slice 88), sin retirada decidida.

---

## ✨ 5k. Funcionalidades — v0.11.0 (Explorador de archivos, conflictos por contenido y enlaces en la vista previa)

> **Origen (2026-09-26):** uso intensivo de la 0.10.0 por el usuario con un libro real de varios capítulos (`z6-IPbook`). Tres problemas encontrados: (1) para añadir un capítulo hay que salir al explorador del sistema, porque el panel Archivos no permite crear, renombrar ni mover nada; (2) el guardado automático de RF-64 es inutilizable en la práctica porque salta una y otra vez el diálogo «El documento cambió fuera del editor» sin que nadie haya tocado el fichero; (3) los enlaces del documento no funcionan en la vista previa, así que no se comporta como el PDF final. Se recuperan dos puntos que §5j había aparcado (enlaces de la salida y gestión de ficheros en el panel). El usuario decidió que todo, incluidas las dos propuestas añadidas durante la discusión (RF-71 y RF-73), entra en la v0.11.0 y no en un parche aparte. Decisiones en `ADR-V0110-001` (`memory.md`).
>
> **Fuera de alcance (no pedido o sin decidir):** pestañas en el editor; búsqueda global en el proyecto (Ctrl+Mayús+F); cortar, copiar y pegar ficheros con Ctrl+X/C/V en el árbol; «Contraer todo»; `git mv` (los movimientos son del sistema de ficheros y Git detecta los renombrados solo); vista previa en PDF nativo (el visor de PDF que trae WebView2 no existe en WebKitGTK, y se perdería la sincronización de RF-57).

### RF-68 — Conflicto externo decidido por contenido, no por avisos del sistema *(corrección, prioridad 1)*
1. **Causa (leyendo el código; hay que confirmarla en `/test` con una ventana real):** el diálogo de la captura del usuario (*Conservar lo mío / Ver diferencias / Recargar desde disco*) es el del **observador de ficheros** (`workspace.js::handleActiveDocumentChanged`), no el de Guardar. Hoy cualquier aviso del observador sobre el documento abierto que llegue más de 1,5 s después de un guardado propio (`SELF_WRITE_GRACE_MS`) se trata como un cambio real. En Windows, `notify` notifica los cambios de **atributos** como `Modify(Any)`. Por eso el filtro de solo metadatos (`watcher.rs::is_relevant_kind`, pensado para Spotlight en macOS) no los descarta. Y el antivirus, el indexador o un cliente de sincronización tocan el fichero segundos después de guardarlo. Con el guardado automático casi siempre hay cambios sin guardar, así que cada uno de esos avisos acaba en el diálogo. La comprobación previa de Guardar compara solo la **marca de tiempo** (`modifiedMs`).
2. **Regla nueva:** hay conflicto externo **solo si el contenido en disco es distinto del último conocido**, es decir, del que se leyó al abrir o del que se escribió en el último guardado. El backend devuelve un **hash del contenido** al leer y al escribir. En la escritura es el hash de los bytes que llegan a disco, después de los guardarraíles de RF-60.5.
3. **Aviso del observador:** se calcula el hash del disco. Si coincide con el último conocido, se **ignora en silencio**, haya o no cambios sin guardar. Si no coincide, se mantiene el comportamiento actual: recarga silenciosa si no hay cambios locales y diálogo si los hay.
4. **Comprobación previa de Guardar** (manual y automático): se cambia la comparación de marcas de tiempo por la de hash. La marca de tiempo puede seguir sirviendo como filtro barato: si no ha cambiado, no hace falta leer el fichero.
5. La ventana de gracia de 1,5 s **deja de ser lo que garantiza que no haya falsos conflictos**. Si se conserva como optimización o se retira se decide en `/plan`.
6. «Conservar lo mío» guarda como conocido el hash del disco, para no volver a preguntar por el mismo cambio. RF-64.2 no cambia: el guardado automático **nunca** sobrescribe un conflicto real.
7. Se aplica igual a los ficheros que no son Typst abiertos en el editor (RF-60).
8. **Criterios de aceptación:**
   - Tests de la lógica pura: un aviso con el mismo contenido no abre diálogo ni recarga; un aviso con contenido distinto y cambios sin guardar sí abre el diálogo; Guardar tras un cambio que solo toca la marca de tiempo o los atributos no pregunta.
   - En el `.exe` real, con el guardado automático encendido y `z6-IPbook`: escribir de forma continuada durante 10 minutos **sin que aparezca ni un solo diálogo**, y cambiar los atributos del fichero desde fuera (`attrib +A`) mientras tanto sin efecto visible.
   - Un cambio real hecho con otro editor sigue detectándose.

### RF-69 — Operaciones de ficheros en el panel Archivos
1. **Cabecera del panel:** al pasar el ratón aparecen los botones **Nuevo fichero**, **Nueva carpeta** y **Refrescar**, igual que en el explorador de VS Code. También se puede llegar a ellos con el teclado. El destino es la carpeta seleccionada; si lo seleccionado es un fichero, la carpeta que lo contiene; si no hay selección, la raíz del proyecto.
2. **Crear:** aparece una fila editable dentro del propio árbol; Enter confirma y Escape cancela. El nombre se respeta tal cual, sin imponer extensión. Un fichero editable recién creado se abre en el editor.
3. **Menú contextual:**
   - Sobre una carpeta: *Nuevo fichero…* y *Nueva carpeta…*, dentro de ella.
   - Sobre un fichero: las mismas dos opciones, en su carpeta.
   - En ambos casos: *Renombrar* (F2), *Duplicar*, *Eliminar* (Supr), *Copiar ruta* y *Copiar ruta relativa*.
   - Se conservan las opciones actuales: documento principal, abrir como texto y mostrar en el explorador del sistema.
4. **Selección múltiple:** clic selecciona uno; Ctrl+clic (Cmd en macOS) añade o quita; Mayús+clic selecciona un rango. *Eliminar* y el arrastre actúan sobre toda la selección. *Renombrar* y *Duplicar* solo se ofrecen con un elemento seleccionado.
5. **Mover arrastrando:** los elementos seleccionados se sueltan sobre una carpeta o sobre la raíz.
   - El destino se resalta mientras se arrastra, y una carpeta cerrada se abre si el puntero se queda un momento encima.
   - Mover una carpeta dentro de sí misma o de una subcarpeta suya se rechaza. Soltar en la misma carpeta no hace nada.
6. **Soltar ficheros del sistema sobre una carpeta del árbol** los **copia** en esa carpeta. Si ya existe uno con el mismo nombre, se usa un nombre único y nunca se sobrescribe. Fuera del árbol, el arrastre de imágenes y fuentes de RF-18 funciona igual que ahora.
7. **Eliminar** envía a la **papelera del sistema** tras una confirmación que lista lo que se va a eliminar. Si la papelera no está disponible (unidad de red, por ejemplo), se pide confirmación explícita de **borrado definitivo**.
8. **Validación del nombre**, con el mensaje en línea y sin crear nada: nombre vacío, caracteres no válidos, nombres reservados de Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1`…), punto o espacio final en Windows, y colisión con un elemento existente (incluida la que solo difiere en mayúsculas en Windows y macOS). Renombrar **solo cambiando mayúsculas** (`cap1.typ` → `Cap1.typ`) debe funcionar.
9. **Confinamiento:** el backend comprueba en **cada** operación que el origen y el destino, ya canónicos, están dentro de la raíz del proyecto, sin `..` ni enlaces simbólicos que escapen. Es el mismo criterio anti-escape que la importación `.dbvt` (RF-11).
10. **Coherencia con el estado de la aplicación:**
    - Renombrar o mover el **documento abierto** (o la carpeta que lo contiene) actualiza su ruta sin perder los cambios sin guardar ni el historial de deshacer del editor.
    - Lo mismo con el **documento principal** (RF-53): su preferencia se actualiza.
    - Eliminar el documento abierto lo cierra, preguntando antes si tiene cambios sin guardar. Eliminar el principal le quita la marca.
11. **Observador y árbol:** las operaciones propias **no** provocan avisos de conflicto ni recargas (RF-68). Al refrescarse, el árbol conserva las carpetas abiertas y la selección, y el indicador de Git se actualiza.
12. **Ocultos (RF-63.1):** si se crea un elemento que empieza por punto con los ocultos filtrados, se avisa de que se ha creado pero no se ve.
13. Textos en español e inglés, tokens de `DESIGN.md`, uso completo con teclado y etiquetas accesibles en los botones de solo icono.
14. **Criterios de aceptación:**
    - Tests de las funciones puras: validación de nombres, confinamiento (incluido un intento con `..` y otro con un enlace simbólico) y nombre único al copiar.
    - Crear `capitulos/cap7.typ` desde el árbol lo abre en el editor.
    - Arrastrar tres ficheros seleccionados a otra carpeta los mueve.
    - Renombrar el documento abierto con cambios sin guardar no pierde nada.
    - Eliminar manda a la papelera.
    - Ninguna de estas operaciones hace saltar el diálogo de conflicto.

### RF-70 — Actualización automática de referencias al mover o renombrar
1. Al renombrar o mover (RF-69) un fichero o una carpeta, la aplicación **actualiza automáticamente**, en todos los `.typ` del proyecto, las rutas que apuntan a ellos. *(Decisión del usuario, 2026-09-26: automático, no solo avisar.)*
2. **Detección con el analizador sintáctico de Typst**, nunca con búsqueda de texto: se buscan las **cadenas literales** que son la ruta en `#include`, `#import` (con `: …` o `as …`), `image`, `bibliography` (cadena o array de cadenas), `read`, `json`, `csv`, `yaml`, `toml`, `xml`, `cbor`, `plugin` y `path` (función nueva de Typst 0.15, añadida en `/plan`). Los paquetes (`@preview/…`) se ignoran.
3. **Resolución igual que Typst:** una ruta sin `/` inicial es relativa al **fichero que la contiene**, y una con `/` inicial lo es a la raíz del proyecto (comportamiento verificado en `memory.md`, 2026-09-06). La ruta nueva conserva el estilo de la original, relativa o absoluta al proyecto, y siempre usa `/` como separador.
4. **Referencias salientes:**
   - Si se mueve un `.typ`, se reescriben también sus **propias** rutas relativas, porque ahora parten de otra carpeta.
   - Si se mueve una carpeta, se actualizan las referencias que entran desde fuera y las que salen hacia fuera. Las internas a la carpeta no se tocan.
5. **Documentos abiertos con cambios sin guardar:** el cambio se aplica **al contenido del editor**, no al disco, y el documento queda como modificado. Nunca se pisa trabajo sin guardar.
6. Solo cambia el texto de la cadena: formato, comentarios, finales de línea y BOM se conservan (RF-60.5). Cada fichero se escribe de forma atómica (RF-24).
7. **Resultado visible:** un aviso del tipo «Actualizadas N referencias en M ficheros», con **Ver cambios** (lista `fichero:línea`, ruta antigua → nueva) y **Deshacer**.
8. **Deshacer** revierte el último movimiento o renombrado **junto con** sus reescrituras, todo o nada. Si algún fichero afectado ha cambiado desde entonces, avisa y no deshace nada.
9. **Preferencia** «Preguntar antes de actualizar referencias», **desactivada por defecto** y recordada entre sesiones. Si está activa, muestra la lista antes de aplicar y permite *Actualizar* o *Mover sin actualizar*.
10. **Límites declarados** (no son fallos):
    - No se tocan las rutas construidas en tiempo de ejecución (`"figs/" + nombre`), las guardadas en variables ni las que se pasan a una plantilla o función (`#show: tesis.with(logo: "img/logo.png")`).
    - Tampoco las referencias desde ficheros que no son Typst.
    - Si alguna queda rota, los diagnósticos del compilador (RF-59) la muestran como fichero no encontrado.
    - En un fichero con errores de sintaxis se actualizan las referencias que el analizador reconozca.
11. **Criterios de aceptación:**
    - Batería de tests de la función pura (en Rust) con: ruta relativa, absoluta al proyecto, en subcarpeta, referencias salientes del fichero movido, carpeta movida con referencias internas y externas, `bibliography` con array, `import` con alias, una cadena en variable que **no** se toca, una cadena con escapes y diferencias de mayúsculas en Windows.
    - Test de Deshacer.
    - Con `z6-IPbook`: mover un capítulo a otra carpeta y renombrar una imagen deja el libro **compilando sin errores nuevos**.

### RF-71 — Acción «Nuevo capítulo…»
1. Disponible en el **menú contextual de las carpetas** del árbol y en el **menú Archivo**.
2. **Diálogo:**
   - Pide el **título** del capítulo y propone un nombre de fichero derivado de él (minúsculas, sin acentos ni espacios, `.typ`) que se puede editar.
   - Propone también una carpeta: la seleccionada; si no, la carpeta donde ya están los capítulos incluidos por el documento principal; si no, la raíz.
3. Crea el fichero con el encabezado `= Título` y una línea en blanco.
4. **Lo enlaza:** inserta `#include "ruta"` en el **documento principal** (RF-53), justo después del último `#include` de nivel superior, o al final si no hay ninguno. La ruta sigue el estilo de las existentes.
   - Si el principal está abierto con cambios sin guardar, se edita el contenido del editor (como en RF-70.5).
   - Si no hay documento principal, se crea el fichero igualmente, se avisa de que no se ha podido enlazar y se ofrece elegir uno.
5. Abre el capítulo nuevo en el editor.
6. **Criterios de aceptación:** tests puros del nombre derivado del título (acentos, espacios, colisión) y del punto de inserción del `#include` (con varios `#include`, sin ninguno, y con un `#include` dentro de un bloque que no es de nivel superior). En `z6-IPbook`, «Nuevo capítulo» deja el capítulo visible en la vista previa del documento completo sin tocar nada más.

### RF-72 — Enlaces funcionales en la vista previa
1. **Causa:** `preview.js` anula a propósito cualquier clic sobre un `<a>` del SVG para evitar el fallo de `SVGAElement.href` (Slice 11). Además, `typst-svg` no da destino a los enlaces **internos**. *(Corregido en `/plan`, leyendo los fuentes de `typst-svg` 0.15.1: los enlaces externos **sí** llevan `href` en el SVG; este apartado decía que no llevaba ninguno.)*
2. **Capa de enlaces:** el motor en proceso (RF-56) saca de cada página maquetada sus enlaces (rectángulo y destino), y el frontend pinta encima del SVG zonas clicables transparentes. Estas zonas se alinean con el zoom y con «Ajustar al ancho», y se crean y descartan junto con la página (paginación perezosa, RNF-PERF).
3. **Enlaces externos:** se abren con un **clic directo** en el navegador del sistema *(decisión del usuario, 2026-09-26)*. Al pasar el ratón se ve la URL y el cursor de mano. Solo se permiten `http`, `https` y `mailto`; cualquier otro esquema (`file:`, `javascript:`…) se ignora y se avisa. Hace falta una **lista de esquemas permitidos propia para el documento**, porque la actual de `open_external_url` (solo `https`, para la documentación de la ayuda) es otra.
4. **Enlaces internos** (índice, `@ref`, citas a la bibliografía, notas al pie, `link(<etiqueta>)`, `link((page: …))`): desplazan la **vista previa** hasta la página y altura del destino y lo señalan con la misma marca visual de RF-57. El editor no se mueve.
5. No interfieren con el doble clic de sincronización hacia el editor (RF-57), con la selección ni con el menú contextual de la vista previa. En ese menú, sobre un enlace externo, se añade *Copiar dirección del enlace*.
6. **Motor clásico de respaldo:** sin enlaces clicables (degradación documentada, sin errores). Se sigue anulando el clic sobre `<a>` como hoy.
7. **Criterios de aceptación:** test de la conversión de rectángulos de enlace a coordenadas de pantalla con varios zooms, y test de la lista de esquemas. En `z6-IPbook`, un clic en una entrada del índice lleva a su capítulo, un clic en una cita lleva a la bibliografía y un clic en una URL abre el navegador. La sincronización por doble clic sigue funcionando.

### RF-73 — Historial local de versiones
1. **Qué se guarda:** una copia del contenido **anterior** de un fichero antes de sobrescribirlo, en estos casos: guardado manual, guardado automático, reescritura por RF-70 o RF-71, y antes de descartar cambios locales con «Recargar desde disco». En este último caso se guarda el contenido del editor, para que un clic por error no pierda trabajo.
2. Se guarda **fuera del proyecto**, en la carpeta de datos de la aplicación y separado por proyecto, para no ensuciar el proyecto ni Git.
3. **Consolidación:** las copias del guardado automático se agrupan (orientativo: como mucho una cada 5 minutos por fichero). Las de las demás causas se guardan siempre.
4. **Retención:** orientativo, las últimas 50 versiones o 30 días por fichero, con un tope total de espacio (orientativo 200 MB) que purga lo más antiguo. Los valores se fijan en `/plan`.
5. **Interfaz:** *Historial local…* en el menú contextual del árbol y del editor abre una lista de versiones con fecha y causa (manual, automático, antes de recargar, antes de actualizar referencias). Se pueden **ver las diferencias** con el contenido actual, reutilizando el diff de RF-19, y **restaurar**. Restaurar pone esa versión en el editor como cambio sin guardar, que se puede deshacer con Ctrl+Z; nunca escribe directamente en disco.
6. Solo para ficheros de texto editables, con el mismo límite de tamaño que RF-60. El historial sigue al fichero cuando se renombra o se mueve desde la aplicación (RF-69).
7. **Preferencias:** activar o desactivar (activado por defecto) y *Vaciar historial local*. Todo es local; nada sale del equipo.
8. **Criterios de aceptación:** tests puros de la consolidación y la retención (por número, por antigüedad y por tamaño total). Tras un «Recargar desde disco» por error, lo descartado se recupera desde el historial. Restaurar deja el documento como modificado sin escribir en disco.

### Preguntas abiertas para `/plan` (no se resuelven aquí a propósito)
- **Spike de enlaces (RF-72):** cómo exponen los enlaces las páginas maquetadas en `typst` 0.15.1 (elemento de frame o etiqueta), cómo se resuelven los destinos internos a página y posición, y cómo se reutiliza el mapa de RF-57.
- **Hash de RF-68:** algoritmo (basta uno rápido, no criptográfico) y coste con ficheros grandes. Si la ventana de gracia de 1,5 s se conserva o se retira.
- **Papelera (RF-69.7):** crate y comportamiento en Windows (MSIX), macOS y Linux, y qué hacer en unidades de red.
- **RF-70:** si el analizador sintáctico se usa desde el crate que ya enlaza el motor en proceso, y el rendimiento con proyectos grandes (orientativo: menos de 1 s con 200 `.typ`). Confirmar contra el binario real las reglas de resolución de rutas de la 0.15.1.
- **RF-73:** valores definitivos de consolidación y retención, formato de almacenamiento y cómo se identifica un proyecto si se mueve de carpeta.
- Qué secciones de `ARCHITECTURE.md` hay que ampliar (operaciones de ficheros en el backend, reescritura de referencias, capa de enlaces, historial).

---

## ✨ 5l. Funcionalidades — v0.12.0 (Editor para proyectos grandes: navegación, búsqueda, pestañas y snippets)

> **Origen (2026-09-28):** tras publicar la 0.11.0, una sesión de uso destapó que el autocompletado de Tinymist se quedaba a medias dentro de las llamadas a funciones y otros detalles, arreglados fuera de ciclo (RF-74 a RF-76, **ya construidos**). Al hablar de ellos surgió el resto: aprovechar lo que Tinymist ya ofrece y no usamos, búsqueda global y pestañas (las dos quedaron fuera de la 0.11.0 porque la pregunta se quedó sin respuesta, no por descarte), atajos documentados, snippets de usuario, buscar y copiar en la vista previa, y tres puntos del backlog de `task.md`. El usuario decidió que **todo** entra en la 0.12.0. Decisiones en `ADR-V0120-001` (`memory.md`).
>
> **Decisión sobre el motor clásico (RF-67, 2026-09-28): opción (c), se deja como está.** Motor en proceso predeterminado y clásico como respaldo automático mantenido. Ver RF-67.7.
>
> **Fuera de alcance:** publicación en Flathub (versión propia; análisis en el backlog de `task.md`); editor visual de snippets (RF-81 hace el primer paso con el fichero JSON); pestaña «provisional» al estilo de VS Code (RF-79 usa pestañas simples, decisión del usuario).
>
> **Contraste con el código, hecho en `/spec`:** Tinymist (el binario del sidecar) anuncia `definitionProvider`, `referencesProvider`, `renameProvider` con `prepareProvider`, `codeActionProvider`, `documentSymbolProvider` y `documentHighlightProvider`. `codemirror-lang-typst` declara `commentTokens` (`//`, `/* */`). En CodeMirror, **Ctrl+clic (Cmd en macOS) añade hoy un cursor** (`clickAddsSelectionRange` por defecto), y la cursiva de la barra (RF-13) ocupa **Ctrl+I**, que en el `defaultKeymap` es `selectParentSyntax`. En Linux el auto-actualizador (RF-37) **no está activo**: `release-linux.yml` no genera artefactos de actualización.

### RF-74 — Autocompletado completo de Tinymist y ayuda de firma *(ya construido, commit `e0e6872`)*
1. **Causa:** la fuente de autocompletado solo preguntaba a Tinymist tras `#`, `@`, `.`, `:`, `<` o una palabra a medias. Tras `(` y `,`, que Tinymist anuncia como disparadores, no preguntaba, así que `#box(` no ofrecía los parámetros.
2. Se pregunta tras todos los disparadores de Tinymist (`# ( < , . : / " @`). Se respetan su orden (`sortText`) y el tramo que reemplaza cada sugerencia (`textEdit.range`). La lista se reabre tras aceptar una función (`box(|)`) o un parámetro (`fill: |`). Los snippets LSP se traducen a la sintaxis de CodeMirror (`lspSnippetToCodeMirror`), y el detalle muestra el tipo en vez de la firma entera.
3. **Tab** acepta la sugerencia abierta; sin lista abierta sigue indentando o saltando de campo.
4. **Ayuda de firma:** al escribir `(` o `,` aparece encima del cursor la firma con el parámetro actual resaltado y su documentación breve. Se actualiza al moverse entre argumentos y se cierra con Escape o al salir de la llamada.
5. **Criterios de aceptación (cumplidos):** 22 tests, varios con un `EditorView` real y respuestas capturadas del binario de Tinymist. Pendiente solo la prueba en ventana real.

### RF-75 — La vista previa conserva el punto de lectura al cambiar el zoom *(ya construido, commit `e0e6872`)*
1. **Causa:** el zoom cambia el alto de todas las páginas y `scrollTop` se quedaba en los mismos píxeles. «Ajustar al ancho» en la página 12 llevaba a otra página.
2. `applyZoom` guarda la página que asoma arriba y la fracción ya recorrida, y la restaura tras el cambio. Vale para «Ajustar al ancho», +/−, 100 % y el reajuste al redimensionar.
3. **Criterios de aceptación (cumplidos):** 3 tests que simulan el layout y fallan sin el arreglo.

### RF-76 — «Proyecto en blanco» más a mano *(ya construido, commits `e0e6872` y `b895419`)*
1. En la galería de «Nuevo documento», «Proyecto en blanco» aparece **el primero**; el resto sigue en orden alfabético.
2. **Archivo › Nuevo proyecto en blanco**, primera opción del menú Archivo: abre el asistente con esa plantilla, igual que «Usar plantilla» en la galería. Carga el catálogo si la aplicación arrancó directamente con un documento.
3. **Criterios de aceptación (cumplidos):** test del orden del catálogo empaquetado; tests de la búsqueda de la plantilla, de su carga sin pasar por el lanzador y del cableado del menú.

### RF-77 — Navegar y refactorizar con Tinymist
1. **Ir a la definición:** **F12** y **Ctrl+clic** (Cmd+clic en macOS) sobre una función, variable, etiqueta (`@fig-x`, `<fig-x>`) o `#import`. Si el destino está en otro fichero del proyecto, lo abre (en su pestaña, RF-79) en esa posición. Si está fuera del proyecto (paquetes de `@preview`, en la caché de paquetes), lo abre **en modo solo lectura** y lo indica. *(Corregido en `/plan`, comprobado con el binario: las **funciones internas de Typst** (`box`, `text`…) no tienen código fuente y Tinymist no devuelve destino. Se avisa «Función interna de Typst: sin código fuente»; su documentación sigue en el hover.)*
2. **Multicursor:** como Ctrl+clic pasa a ser «Ir a la definición», **añadir un cursor pasa a Alt+clic**, como en VS Code. La selección rectangular sigue con Alt+arrastrar.
3. **Buscar referencias:** **Mayús+F12** lista todos los usos del símbolo en el proyecto, agrupados por fichero con la línea de contexto. Un clic lleva a cada uno.
4. **Renombrar símbolo:** **F2 con el foco en el editor** (en el árbol, F2 sigue renombrando el fichero, RF-69). Primero se consulta `prepareRename`: si el símbolo no se puede renombrar, se dice por qué. Si se puede, un campo en línea pide el nombre nuevo y se aplica el cambio en todos los ficheros, incluidos los cerrados. Se usa **la misma maquinaria que RF-70**: los documentos abiertos con cambios sin guardar se editan en el editor, no en disco; cada fichero se escribe de forma atómica; se deja copia en el historial local (RF-73); y un aviso «N cambios en M ficheros» ofrece **Ver cambios** y **Deshacer** (todo o nada). *(Añadido en `/plan`, comprobado con el binario: renombrar una **etiqueta** devuelve cambios marcados como «búsqueda aproximada» (`needsConfirmation`), así que la lista de cambios se **muestra antes de aplicar**, con *Aplicar* y *Cancelar*. Renombrar la **ruta** de un `#include` renombra el fichero pero solo actualiza esa referencia: se desvía al renombrado del árbol (RF-69) con la actualización de todas las referencias (RF-70).)*
5. **Acciones de código:** **Ctrl+.** y *Acciones de código…* en el menú contextual piden a Tinymist las acciones de la posición o la selección actual y las listan; si no hay ninguna, se dice. Aplicar una acción es una edición normal, que se deshace con Ctrl+Z. *(Corregido en `/plan`, comprobado con el binario: Tinymist no ofrece arreglos para los diagnósticos, sino **refactorizaciones** según el sitio: «Envolver en bloque de contenido», «Aumentar nivel del encabezado»… Por eso no hay indicador junto a los diagnósticos.)*
6. El **menú contextual del editor** (RF-58) añade *Ir a la definición*, *Buscar referencias* y *Renombrar símbolo…*.
7. **Con Tinymist apagado o arrancando (RF-54):** las acciones aparecen deshabilitadas con el motivo, igual que Formatear (RF-61). Nunca fallan en silencio.
8. **Criterios de aceptación:**
   - Tests de la aplicación de un `WorkspaceEdit` de varios ficheros: con un fichero cerrado, uno abierto sin cambios y uno abierto con cambios sin guardar. Test de Deshacer.
   - En `z6-IPbook`: F12 sobre un `@etiqueta` de un capítulo lleva a la figura de otro capítulo; renombrar una etiqueta la cambia en todos los capítulos y el libro sigue compilando sin errores nuevos.
   - Alt+clic añade un cursor.
9. **Límite declarado** *(añadido en `/plan`, comprobado con el binario)*: Tinymist resuelve las **etiquetas** a partir del último documento que **compiló sin errores**. Con el documento en error, ir a la definición, buscar referencias y renombrar una etiqueta no dan resultado: se avisa de ello, en vez de fallar en silencio. Las variables y funciones funcionan igual.

### RF-78 — Buscar y reemplazar en todo el proyecto
1. **Ctrl+Mayús+F** (Cmd+Mayús+F) abre un panel de búsqueda global. Opciones: distinguir mayúsculas, palabra completa y expresión regular. Filtro opcional de ficheros a incluir o excluir (p. ej. `*.typ`).
2. **Dónde busca:** en los ficheros de texto editables del proyecto (mismo criterio y límite de tamaño que RF-60). Se excluyen las carpetas que empiezan por punto (`.git`, `.vscode`…) salvo con «Mostrar ficheros ocultos» (RF-63.1). Los documentos abiertos se buscan **en su contenido del editor**, con los cambios sin guardar.
3. **Resultados** agrupados por fichero, con el número de coincidencias y la línea de contexto resaltada. Un clic abre el fichero en esa línea (en su pestaña, RF-79). Los resultados se actualizan si se edita un fichero.
4. **Reemplazar:** campo de reemplazo (con grupos `$1` si hay expresión regular) y **vista previa** del cambio en cada coincidencia. Se puede reemplazar una, todas las de un fichero o todas. Igual que en RF-70 y RF-77.4: los documentos abiertos con cambios se editan en el editor, la escritura es atómica, se deja copia en el historial local (RF-73) y hay un aviso con **Deshacer** (todo o nada).
5. **Rendimiento:** en `z6-IPbook` la búsqueda responde en **menos de 1 s** (orientativo) y no bloquea la interfaz; una búsqueda nueva cancela la anterior.
6. Una expresión regular no válida se avisa en el propio campo, sin buscar.
7. **Criterios de aceptación:**
   - Tests de la función de búsqueda: mayúsculas, palabra completa, expresión regular con grupos, exclusión de ocultos y de binarios, límite de tamaño.
   - Test de reemplazo con un documento abierto con cambios sin guardar (no toca el disco) y test de Deshacer.
   - Buscar en `z6-IPbook` una palabra de varios capítulos los lista todos; reemplazarla y deshacer deja el libro como estaba.

### RF-79 — Pestañas de documentos abiertos
1. Cada fichero abierto es una **pestaña** sobre el editor. Abrir un fichero ya abierto activa su pestaña. Sustituye a la barra del documento de un solo fichero y conserva su información: nombre corto y desambiguado (RF-65), punto de modificado (RF-64.3) e insignia de lenguaje.
2. **Cerrar:** botón de la pestaña, **Ctrl+W** o clic central. Cerrar una pestaña con cambios sin guardar pregunta, salvo con el guardado automático encendido, que guarda antes (RF-64.5).
3. **Moverse:** **Ctrl+Tab** y **Ctrl+Mayús+Tab**, o clic. Las pestañas se reordenan arrastrando. Si no caben, la barra se desplaza y la pestaña activa siempre queda visible.
4. **Cada pestaña conserva su estado:** cursor, selección, scroll, plegados e historial de deshacer.
5. **Se recuerdan por proyecto:** al reabrirlo vuelven las mismas pestañas, en el mismo orden y con la misma activa. Si algún fichero ya no existe, se omite sin error. *(Decisión del usuario, 2026-09-28: pestañas simples y recordadas.)*
6. **Coherencia con el resto:**
   - Renombrar o mover desde el árbol (RF-69, RF-70) actualiza las pestañas afectadas; eliminar un fichero cierra su pestaña, preguntando si tiene cambios.
   - El guardado automático (RF-64) también guarda las pestañas de fondo con cambios.
   - El conflicto externo (RF-68) vigila **todas** las pestañas, no solo la activa.
   - La vista previa en alcance «Fichero» (RF-14) sigue a la pestaña activa; en «Documento» no cambia.
   - Tinymist (RF-21) recibe el contenido actual de las pestañas abiertas, para que la navegación y el renombrado de RF-77 vean los cambios sin guardar.
   - Cerrar la ventana (RF-64.6) cubre las pestañas de fondo con cambios.
   - *(Añadido en `/plan`)* La actualización de referencias de RF-70 recibe **todas** las pestañas abiertas: si una pestaña de fondo con cambios sin guardar referencia un fichero que se mueve, se edita su contenido en el editor, nunca su disco. Hoy RF-70 solo conoce un documento abierto.
   - *(Añadido en `/plan`)* **macOS:** Cmd+W cierra la pestaña y «Cerrar proyecto» pasa a Cmd+Mayús+W. Hoy el menú nativo asigna Cmd+W a «Cerrar proyecto» y gana al editor: sin este cambio, cerrar una pestaña cerraría el proyecto.
7. **Criterios de aceptación:**
   - Tests puros del modelo de pestañas: abrir, activar, cerrar, reordenar, renombrado desde el árbol, eliminación y restauración con un fichero que falta.
   - Con tres capítulos abiertos, editar uno, cambiar a otro y volver conserva el cursor y el deshacer.
   - Reabrir el proyecto recupera las pestañas.
   - Cerrar la ventana con una pestaña de fondo modificada y el guardado automático apagado pregunta.

### RF-80 — Atajos de teclado completos y documentados
1. La Ayuda gana una sección **«Atajos de teclado»** con **todos** los atajos del editor. Incluye los que ya trae CodeMirror y hoy nadie descubre: mover líneas (Alt+↑/↓), duplicarlas (Mayús+Alt+↑/↓), borrar línea (Ctrl+Mayús+K), comentar (Ctrl+/), plegar, ir a línea y multicursor. Incluye también los nuevos de esta versión (F12, Mayús+F12, F2, Ctrl+., Ctrl+Mayús+F, Ctrl+Tab, Ctrl+W). Se abre también desde el menú de ayuda.
2. **Una sola fuente:** la tabla de la ayuda se genera desde la misma definición que registra los atajos, para que no se desfasen. Un test comprueba que todo atajo registrado por la aplicación aparece en la ayuda en los dos idiomas.
3. **Ampliar selección:** `selectParentSyntax` (hoy tapado por Ctrl+I, la cursiva) se recupera en una combinación libre, comprobada contra todo el keymap. Se propone Mayús+Alt+→, como en VS Code, a confirmar en `/plan` porque CodeMirror la usa para `selectSyntaxRight`.
4. **Comentar en Typst:** Ctrl+/ comenta y descomenta con `//`, y Mayús+Alt+A con `/* */`. Hay que comprobarlo en ventana real: `codemirror-lang-typst` declara la sintaxis, pero nunca se ha probado en la aplicación.
5. **Criterios de aceptación:** el test del punto 2; ningún atajo duplicado entre los keymaps de la aplicación (test); Ctrl+/ comenta una línea de un `.typ`; Ctrl+I sigue siendo cursiva.

### RF-81 — Snippets de usuario *(primer paso: fichero JSON)*
1. **Formato de VS Code:** cada snippet tiene `prefix` (texto o lista), `body` (texto o lista de líneas), `description` y, opcionalmente, `scope`. Se admiten comentarios y comas finales (JSONC, como en VS Code). Así sirven snippets copiados de VS Code o de internet.
2. **Dos niveles:**
   - **Globales:** un fichero en la configuración de la aplicación (`snippets/typst.json`).
   - **Del proyecto:** los ficheros **`.vscode/*.code-snippets`** del proyecto, el mismo sitio y formato que usa VS Code, para compartirlos con coautores que usen VS Code con Tinymist *(decisión del usuario, 2026-09-28)*. Se usan los snippets sin `scope` o cuyo `scope` incluya `typst`.
   - Si un prefijo existe en los dos, se ofrecen ambos, primero el del proyecto.
3. **En el autocompletado:** los snippets aparecen en la lista con su tipo, su descripción y el cuerpo como vista previa, junto a las sugerencias de Tinymist. **También funcionan con Tinymist apagado.** El cuerpo se traduce con `lspSnippetToCodeMirror` (RF-74). Variables admitidas: `TM_SELECTED_TEXT`, `TM_FILENAME`, `TM_FILENAME_BASE`, `CURRENT_YEAR`, `CURRENT_MONTH`, `CURRENT_DATE`; las demás se sustituyen por su valor por defecto o por texto vacío.
4. **Editar:** *Editar snippets globales* y *Editar snippets del proyecto* abren el fichero **en el propio editor**, con resaltado de JSON (`.code-snippets` se reconoce como JSON). Si no existe, se crea con dos ejemplos comentados que sirven de plantilla. Crear el fichero del proyecto es una acción explícita del usuario. *(Precisado en `/plan`: hoy `.code-snippets` no se reconoce como JSON ni es editable en el árbol, y hay que añadirlo. El resaltado de JSON no distingue los comentarios, aunque se leen bien.)*
5. **Recarga:** al guardar el fichero, los snippets se recargan sin reiniciar. También si lo cambia otro programa.
6. **Errores:** un JSON no válido se avisa con el fichero y la línea, y se **siguen usando los snippets válidos anteriores**; el autocompletado nunca se rompe. Una entrada sin `prefix` o sin `body` se ignora con aviso.
7. **Guardar selección como snippet…** (menú contextual del editor): con texto seleccionado, pide nombre, prefijo, descripción y destino (global o proyecto). Escapa `$` y `}` del texto y añade la entrada al fichero **sin tocar el resto de su contenido**, comentarios incluidos.
8. **Criterios de aceptación:**
   - Tests puros: lectura de JSONC; `body` como texto y como lista; `scope`; variables; prioridad proyecto/global; escape al guardar una selección con `$` y llaves; un JSON roto conserva el conjunto anterior.
   - Un snippet copiado tal cual de VS Code se inserta con sus campos y Tab salta entre ellos.
   - Guardar una selección y escribir su prefijo la inserta.

### RF-82 — Buscar y copiar texto en la vista previa *(diferido desde la 0.9.0)*
1. **Buscar:** con el foco en la vista previa, **Ctrl+F** abre una barra de búsqueda sobre el documento renderizado. Busca en **todas** las páginas, aunque no estén cargadas (paginación perezosa, RNF-PERF), resalta las coincidencias, indica «n de m» y navega con Intro y Mayús+Intro, llevando la vista a cada una.
2. **Copiar:** arrastrar sobre la vista previa selecciona texto y **Ctrl+C** lo copia como texto plano, en orden de lectura. El menú contextual de la vista previa añade *Copiar*.
3. **Sin romper lo que hay:** el doble clic sigue sincronizando con el editor (RF-57), un clic en un enlace sigue funcionando (RF-72) y los resaltados se alinean con el zoom y «Ajustar al ancho» (RF-75).
4. **Cómo:** con una **capa de texto** que saca el motor en proceso de cada página maquetada (posición de cada fragmento de texto), igual que la capa de enlaces de RF-72. El SVG no lleva texto seleccionable. **Motor clásico de respaldo:** sin búsqueda ni copia (degradación documentada, sin errores), coherente con RF-67.7.
5. **Criterios de aceptación:** tests de la búsqueda sobre la capa de texto (varias páginas, coincidencia partida entre dos líneas, mayúsculas) y de la conversión a coordenadas de pantalla con varios zooms. En `z6-IPbook`, buscar una palabra de la página 150 con solo las primeras páginas cargadas la encuentra y lleva a ella; copiar un párrafo pega su texto.

### RF-83 — El documento principal viaja con el proyecto *(modifica RF-53.4)*
1. **Cambio sobre RF-53.4:** marcar el documento principal **escribe también** `entrypoint` en el manifiesto `settings/dbv-project.toml`. Si no existe, se crea, incluso en proyectos que no creó DBV. *(Decisión del usuario, 2026-09-28: el resto de aplicaciones lo ignoran y DBV lo aprovecha al reabrir; el principal viaja con git, con el `.dbvt` y a otro ordenador.)* Es una acción explícita del usuario, así que cumple R-MVP-3 («ninguna operación debe escribir el manifiesto sin acción explícita del usuario»): la regla no cambia. **Abrir un proyecto sigue sin escribir nada.**
2. **Se conserva el resto del manifiesto** (plantilla, campos del asistente) y, en lo posible, su formato y sus comentarios.
3. **Al abrir, manda el manifiesto:** si declara un principal que existe, se usa. Si no declara ninguno, se usa la elección guardada en la aplicación (proyectos marcados antes de la 0.12.0). Si tampoco hay, se usa la heurística de siempre.
4. **Respaldo:** la elección se sigue guardando también en la aplicación. Si no se puede escribir el manifiesto (carpeta de solo lectura, o `settings` es un fichero y no una carpeta), se avisa una vez y el principal queda recordado **solo en este equipo**, como en la 0.11.0.
5. **Coherencia con el árbol (RF-69.10):** renombrar o mover el principal actualiza también el manifiesto; eliminarlo quita `entrypoint`.
6. **Confinamiento:** el backend solo acepta una ruta relativa dentro del proyecto, sin `..` ni ruta absoluta, que sea un `.typ` existente. Mismo criterio que `isSafeRelativePath` en el frontend.
7. **Límite declarado:** en un repositorio compartido, el manifiesto aparece como fichero nuevo en `git status`. Está pensado para subirse; la ayuda lo explica.
8. **Punto de partida:** el borrador `set_project_entrypoint` apartado en `git stash` («RF-53 borrador…»). Crea el manifiesto y conserva el resto, pero **no confina la ruta** ni está conectado.
9. **Criterios de aceptación:**
   - Tests en Rust: escritura con y sin manifiesto previo; conserva los demás campos; rechaza `..`, rutas absolutas, ficheros que no son `.typ` y ficheros que no existen; `settings` como fichero cae al respaldo.
   - Test de la prioridad al abrir (manifiesto sobre preferencia local).
   - Renombrar el principal desde el árbol actualiza el manifiesto.
   - Marcar el principal en un equipo y abrir el proyecto sincronizado en otro lo respeta.

### RF-84 — Actualizaciones incrementales del AppImage
1. **Contexto:** el test de AppImageHub avisa (sin bloquear) de que el AppImage no lleva información de actualización. En Linux el auto-actualizador de la aplicación (RF-37) no está activo, así que hoy quien usa el AppImage solo puede actualizar descargándolo de nuevo o con Homebrew (RF-55). Esto **no choca** con RF-37: es la única vía de actualización para el AppImage.
2. `release-linux.yml`, en el paso que reempaqueta el AppImage (añadido en la Fase 48 para normalizar permisos), **incrusta la información de actualización** con `appimagetool -u "gh-releases-zsync|davidbuenov|dbv-typst-editor|latest|<patrón del nombre>.zsync"` y **publica el `.zsync`** junto al AppImage en la Release.
3. El `.zsync` se genera sobre el AppImage **definitivo**, después de normalizar permisos. El Cask de Homebrew (RF-55) debe calcular su SHA sobre ese mismo fichero. *(Precisado en `/plan`, leyendo el fuente de appimagetool: el `.zsync` lo genera `zsyncmake`, y si no está instalado **se omite sin error**. Además usa como URL el nombre del fichero de salida, así que hay que reempaquetar ya con el nombre que tendrá en GitHub, con puntos. La CI debe fallar si falta cualquiera de las dos cosas. Y la Release se crea siempre como borrador y se publica al final: si se publica antes de reempaquetar, `update-homebrew-tap.yml` calcula el SHA del fichero viejo, como pasó en la Fase 48.)*
4. **Criterios de aceptación:**
   - `appimageupdatetool` sobre el AppImage de la versión anterior a la 0.12.0 no puede actualizar (no lleva la información). Sobre el de la 0.12.0, al publicarse una versión siguiente, descarga solo lo que cambia. Esta segunda comprobación queda para la 0.12.1 o la 0.13.0.
   - El test de AppImageHub deja de mostrar el aviso.
   - El Cask sigue verificando su SHA en la CI del tap.
5. Si sale bien, la lección se lleva a dbv-md-reader, al framework (`NATIVE_APPS_RELEASE_CI.md`) y a `dbv-tauri-starter`, como la de los permisos.

### RF-85 — Los diagnósticos de Tinymist se pintan en su fichero *(corrección de un fallo publicado, añadida en `/plan`)*
1. **Causa (comprobada con el binario de Tinymist 0.15.8):** Tinymist publica los diagnósticos de **todos** los ficheros del proyecto, no solo del abierto. Con `main.typ` abierto, un error de `cap/uno.typ` llega como diagnóstico de `cap/uno.typ`. `lspClient.js` los entrega sin su fichero, y el editor los subraya en el documento abierto, en líneas que no tienen nada que ver; también cuentan en la insignia de Tinymist. El panel de Problemas no se ve afectado, porque sale del motor en proceso y sí lleva el fichero.
2. Los diagnósticos de Tinymist se guardan **por fichero**. El editor muestra solo los del documento activo, y al cambiar de documento (o de pestaña, RF-79) muestra los suyos.
3. **Criterios de aceptación:** test con la notificación capturada del binario. Con `main.typ` abierto y un error en `cap/uno.typ`, en `main.typ` no se subraya nada; al abrir `cap/uno.typ`, el error aparece en su línea.

### Preguntas abiertas para `/plan` *(resueltas en `implementation_plan.md` §5, 2026-09-28)*
- **Tinymist con varias pestañas (RF-77, RF-79):** hoy `lspClient.js` solo abre un documento. Cómo se abren y sincronizan todas las pestañas (`didOpen`/`didChange`/`didClose`) y qué coste tiene con capítulos grandes (umbral de RF-54). Qué pasa si Tinymist devuelve un `WorkspaceEdit` que crea o renombra ficheros.
- **F12 en el WebView:** si la tecla llega a la aplicación o la captura el WebView para las herramientas de desarrollo, en `dev` y en producción.
- **Destinos fuera del proyecto (RF-77.1):** cómo se abren los ficheros de la caché de paquetes en solo lectura y cómo se distinguen en la interfaz.
- **Búsqueda (RF-78):** si va en Rust (crates `regex`/`ignore`) o en el frontend; streaming de resultados y cancelación; sintaxis de expresión regular común a buscar y reemplazar.
- **Pestañas (RF-79):** memoria con muchas pestañas grandes (un `EditorState` por pestaña), dónde se guarda el estado por proyecto, y cómo encaja con `workspace.js`, que hoy asume un solo documento.
- **Combinación de «Ampliar selección» (RF-80.3)** y mecanismo para que la ayuda se genere desde los keymaps.
- **Snippets (RF-81):** crate o función para JSONC en el frontend; cómo añadir una entrada sin perder comentarios; carpeta exacta de configuración por plataforma; observador para la recarga.
- **Capa de texto (RF-82):** spike sobre `typst` 0.15.1, igual que el de enlaces de RF-72: cómo sacar los fragmentos de texto con posición de cada página maquetada, orden de lectura, ligaduras y texto matemático; tamaño de esa capa en un libro de 220 páginas.
- **Manifiesto (RF-83):** conservar formato y comentarios al reescribir el TOML (`toml_edit` frente a la serialización actual).
- **AppImage (RF-84):** patrón exacto del nombre del asset (GitHub cambia espacios por puntos, `scripts/github-asset-name.mjs`) y orden de los pasos frente a la actualización del Cask.
- Qué secciones de `ARCHITECTURE.md` hay que ampliar (cliente LSP con varios documentos, pestañas, búsqueda, snippets, capa de texto).

---

## ✨ 5m. Funcionalidades — v0.12.1 (Esquema desde el motor en proceso y arreglos tras publicar la 0.12.0)

> **Origen (2026-09-29):** tras publicar la 0.12.0 llegaron cuatro informes de usuarios reales. (1) Con la ventana pequeña, la vista previa se salía por la derecha. (2) En un Mac, pulsar «Motor: rápido» pasaba al clásico y daba «Operation not permitted (os error 1)». (3) En Linux, el AppImage mostraba «⚠ LSP error» (issue #2, informado sobre la 0.11.0 y reproducido también en la 0.12.0). (4) En otro Mac, el panel Esquema decía «Este documento no tiene encabezados todavía» en un libro que sí los tiene. RF-86 a RF-88 se arreglaron fuera de ciclo el mismo día (**ya construidos**). RF-89 es el requisito nuevo de esta versión. Decisiones en `ADR-V0121-001` (`memory.md`).
>
> **Contraste con el código, hecho en `/spec`:** el esquema **no** sale del motor en proceso. Lo calcula el sidecar con `typst eval` y un `query(heading)` sobre la réplica del proyecto (`typst_engine/outline.rs`), la misma vía que el motor clásico. RF-56.7 (0.9.0) ya pedía sacarlo del compilado del motor nuevo, pero en el `/plan` de esa versión se aplazó («Decisión 4», `ADR-MOTOR-002`). Además, `outline/outline.js` solo repinta cuando la llamada sale bien: **un fallo del sidecar se ve igual que un documento sin encabezados**. El motor en proceso ya conserva el documento compuesto (`Arc<PagedDocument>` en `engine/session.rs`), del que salen los enlaces (RF-72) y la capa de texto (RF-82).
>
> **Hipótesis sobre el informe (4), sin Mac para confirmarla:** en ese Mac falla la vía del sidecar (lanzar `typst`, o replicar el proyecto en el temporal), como en el informe (2). RF-89 la saca del camino normal y, si aun así falla, el panel dirá el motivo real.

### RF-86 — La vista previa estrecha no se sale del panel *(ya construido, commit `39dad88`)*
1. **Causa:** `.preview` es una rejilla con solo filas. Su columna implícita `auto` tomaba el ancho mínimo de la barra, donde nada encoge, así que la barra, las páginas y la barra de desplazamiento se salían por la derecha y el zoom quedaba fuera de alcance.
2. La columna pasa a `minmax(0, 1fr)` (también en `.document`) y la barra de la vista previa salta a una segunda línea (`flex-wrap`).
3. **Criterios de aceptación (cumplidos):** comprobación nueva en `verify:layout` (barra real en un panel de 260 px); probado por el usuario en la ventana real.

### RF-87 — Se retira el conmutador de motor de la vista previa *(ya construido, commit `39dad88`; modifica RF-56.6)*
1. **Decisión del usuario:** se quita el botón «Motor: rápido / clásico». La vista previa usa siempre el motor en proceso, y el clásico queda **solo como respaldo automático**. RF-56.6 decía que el clásico se podía «forzar desde un ajuste»: ya no.
2. La elección guardada por versiones anteriores (`dbv-typst-preview-engine`) se borra al arrancar, para que nadie se quede en el clásico sin forma de volver.
3. El código del motor clásico no cambia (RF-67, opción c).
4. **Camino de vuelta al motor rápido** *(añadido en la prueba de la 0.12.1, ver `ADR-V0121-001`)*: el conmutador era también la única forma de reactivar el motor rápido tras una desactivación de sesión (plazo agotado o pánico, RF-56.6). Sin él, la sincronización se quedaba por párrafo hasta reiniciar la app. Mientras lo que se ve lo compiló el respaldo, la barra de la vista previa muestra el aviso «⚠ Motor clásico» con el motivo; pulsarlo reactiva el motor rápido y recompila. Cada proyecto que se abre empieza con el motor rápido. En la compilación de depuración el plazo es de 300 s, porque ahí Typst es unas 6 veces más lento.

### RF-88 — Sidecars intactos en el AppImage e insignia de Tinymist traducida *(ya construido, commit `19e666f`; issue #2)*
1. **Causa (reproducida en WSL con los AppImage publicados de la 0.11.0 y la 0.12.0):** linuxdeploy pasa `patchelf` por todo `usr/bin`. A `typst` y `tinymist`, binarios musl *static-pie*, les añade `RUNPATH` y un segmento `LOAD`, y mueren con SIGSEGV al arrancar. En el AppImage no funcionaban Tinymist, exportar a PDF/PNG ni el motor clásico. El `.deb` no estaba afectado.
2. `release-linux.yml` repone los binarios vendorizados en el paso de reempaquetado (RF-84) y **no publica** el AppImage si `typst --version` o `tinymist --version` no arrancan desde él.
3. Los textos de la insignia de Tinymist y de sus avisos pasan a `i18n.js` y se repintan al cambiar de idioma.
4. **Criterios de aceptación:** la CI de la 0.12.1 pasa la comprobación nueva; en el AppImage de la 0.12.1, Tinymist arranca y se exporta a PDF.

### RF-89 — El esquema sale del motor en proceso y dice por qué no lo hay *(modifica RF-56.7 y el panel de navegación de §7.8)*
1. **Fuente del esquema:** con el motor en proceso, el esquema sale **del mismo documento compuesto** que la vista previa, sin lanzar el sidecar ni replicar el proyecto. Se actualiza con cada compilación, así que incluye el contenido sin guardar y siempre coincide con lo que se ve.
2. **Respaldo *(decisión del usuario)*:** si la compilación la hace el motor clásico (respaldo automático, RF-56.6), el esquema sigue saliendo del CLI (`typst eval`), como hoy.
3. **Qué encabezados *(decisión del usuario)*:** solo los que irían en el índice del documento: se **omiten los de `outlined: false`**, igual que `#outline()`. Es un cambio de comportamiento: hasta la 0.12.0 salían todos. El respaldo por CLI aplica el mismo filtro, para que el esquema no cambie según el motor.
4. **Datos de cada entrada, sin cambios:** nivel, texto (plano, aunque el encabezado mezcle estilos), página y posición vertical en puntos. Un clic navega igual que hoy.
5. **Estados del panel *(decisión del usuario)*:**
   - **Hay encabezados:** la lista.
   - **El documento compila y no tiene encabezados** (o todos son `outlined: false`): «Este documento no tiene encabezados todavía». Es el **único** caso en que sale este mensaje.
   - **El documento tiene un error de compilación:** se **conserva el último esquema bueno**, con un aviso discreto encima de que puede estar desactualizado. Si todavía no había ninguno, se dice que el documento no compila.
   - **Falla la herramienta** (el motor no responde, el sidecar no arranca, la réplica no se puede crear, la salida no se entiende): se muestra el **motivo real**, en los dos idiomas, en vez de la lista vacía.
6. **Mientras se genera el primer esquema** *(petición del usuario en la prueba)*, el panel lo indica con el mismo indicador giratorio que la vista previa.
7. **Sin coste extra:** el esquema no puede añadir una segunda compilación. Con el motor en proceso se lee del compilado que ya existe.
8. **Criterios de aceptación:**
   - Tests en Rust sobre un documento con varios niveles, encabezados con estilos mezclados, uno `outlined: false`, varios ficheros incluidos y encabezados en páginas distintas: nivel, texto, página y posición correctos; el `outlined: false` no aparece.
   - Las páginas y posiciones coinciden con las del CLI sobre el mismo documento (prueba de paridad, como la de los crates en RF-56.1).
   - Tests del panel para los cuatro estados de RF-89.5: en particular, un fallo simulado del sidecar **no** muestra «no tiene encabezados».
   - `verify:engine`: el esquema del libro de ≥ 200 páginas no alarga el tiempo de la edición.
   - En `z6-IPbook`, el esquema aparece con el motor en proceso y un clic lleva a cada capítulo; con un error de sintaxis a propósito, se conserva el esquema y aparece el aviso.

### Preguntas abiertas para `/plan` (no se resuelven aquí a propósito)
- **API de Typst 0.15.1:** cómo se consultan los encabezados en el `Introspector` del `PagedDocument` (selector de `HeadingElem`, campo `outlined`, página y posición de su `Location`), y cómo se aplana su cuerpo a texto. Se comprueba contra los crates reales, no de memoria.
- **Transporte:** si el esquema viaja en el resultado de cada compilación del motor (sin llamada aparte) o en un comando `engine_outline` que lee el último documento; y cómo sabe el frontend qué motor compiló (ya existe `result.engine`).
- **Frescura:** qué esquema se muestra mientras la compilación está en curso o se descarta («gana la última», RF-56.3).
- **Tipos de fallo:** cómo distingue el frontend «error de compilación» de «fallo de la herramienta» con los tipos de error actuales (`TypstError`), sin comparar textos.
- **Traducción de los mensajes** y dónde va el aviso de «puede estar desactualizado» sin robar sitio a la lista.

---

## ✨ 5n. Funcionalidades — v0.13.0 (IA integrada, documentación de Typst offline, panel de Problemas y visor de datos)

> **Origen (2026-10-02):** el usuario pidió analizar **Papers AI** (papers.ai, Digital Science, el equipo de Overleaf; publicado el 2026-08-04) antes de abrir la versión. Conclusión del análisis: en lo propio de Typst DBV va por delante (Papers AI no tiene modo visual, sincronización, LSP, plantillas ni Universe para Typst), pero nos saca ventaja en **IA con el proyecto como contexto y cambios revisables**, en el **panel de Problemas** y en la conexión con modelos locales. El usuario aportó su flujo real: escribe en DBV y abre la misma carpeta en VS Code con Claude Code para que le ayude con el formato, y vuelve a DBV para verlo. **Esta versión integra ese flujo.** Decisiones en `ADR-V0130-001` (`memory.md`).
>
> **Decisiones del usuario (2026-10-02):** (1) entran **los dos caminos** de conexión: modelos directos (locales o con clave de API) y **agentes ya instalados** por el protocolo ACP (Claude Code, Gemini CLI, Codex, GitHub Copilot), que usan la suscripción del propio usuario; (2) **panel de conversación y también IA en línea** sobre la selección; (3) **documentación de Typst generada en el build** para la versión vendorizada, empaquetada y sin descarga; (4) **la IA puede crear y modificar varios ficheros** desde la conversación, siempre con revisión; (5) **la IA es opcional**: sin configurarla, la app se usa como hasta ahora; (6) el **visor de CSV** entra como una herramienta más; (7) **no se recorta por tamaño**: la versión crece lo que haga falta, con el cuidado de siempre.
>
> **Fuera de alcance, registrado:** integración con Zotero/Mendeley (el usuario no la usa; el `.bib` basta por ahora); etiquetas en el historial de versiones; comentarios anclados; colaboración en tiempo real; instalar o descargar modelos locales desde DBV (eso lo hace Ollama/LM Studio); autocompletado con IA mientras se escribe («texto fantasma»); acciones de IA personalizadas en un fichero (como los snippets de RF-81); crear un documento entero desde el lanzador con IA; búsqueda semántica con *embeddings*.
>
> **Contraste con el código y con fuentes externas, hecho en `/spec`:**
> - **Problemas:** hoy no hay panel. Es la insignia `problems-chip` (`main.js`) con un desplegable de **50 entradas como máximo**, y solo con el motor en proceso (RF-59). RF-97 la convierte en panel.
> - **Cambios en varios ficheros:** ya existe una maquinaria única, `app/multiFileEdit.js` (RF-70, RF-77.4, RF-78.4): pestañas abiertas editadas en el editor, ficheros cerrados escritos de forma atómica con copia en el historial (RF-73), validación de huellas antes de escribir y Deshacer todo o nada. RF-93 la reutiliza; no se escribe otra.
> - **Diferencias:** `editor/diffModal.js` (RF-19) compara dos textos lado a lado, sin aceptar o rechazar por trozo.
> - **Procesos externos:** el runner de Python (`commands/python_runner.rs`, RF-22) ya detecta un intérprete en el PATH y degrada limpiamente si no está, también en el paquete de la Store. Es el precedente para detectar agentes (RF-91).
> - **Red:** las descargas van por Rust con `ureq` (Universe, RF-34). No hay almacén de secretos: las preferencias viven en `localStorage` (`app/prefs.js`), **sitio prohibido para una clave de API**.
> - **Compilar cambios sin escribirlos:** el motor en proceso ya compila contenido en memoria de varias pestañas (`CompileTarget.otherDirty`, `ADR-V0120-002`). Es la base para comprobar una propuesta antes de enseñarla (RF-93.3).
> - **Documentación de Typst:** **no existe en Markdown ni hay versión offline oficial** (hay una propuesta abierta de `llms.txt`, typst/typst#5840). Sus fuentes están en el repositorio de Typst: páginas en **marcado Typst** y referencia en los comentarios de documentación del código Rust, con un generador propio (`cargo docit` en la rama principal). Cómo se generan para la 0.15.1 y cómo se pasan a Markdown se decide en `/plan` (RF-96.1).
> - **ACP** (Agent Client Protocol, JSON-RPC sobre stdio, creado por Zed y adoptado por JetBrains): el cliente puede ofrecer leer y escribir ficheros (`fs/read_text_file`, `fs/write_text_file`), pero **son opcionales para el agente**: un agente puede escribir en disco con sus propias herramientas sin pasar por DBV. RF-91.6 cubre ese caso.

### RNF-IA — Principios que rigen todas las funciones de IA
1. **Opcional de verdad.** Sin ninguna IA configurada, la interfaz es la de la 0.12.1 más **una sola entrada**: «Conectar una IA…» en el menú Herramientas. No se arranca ningún proceso, no se abre ninguna conexión y no se carga el código de IA: el paquete inicial del frontend **no crece** (se mide, como en RF-60.3). Un ajuste **«Mostrar las funciones de IA»** las oculta todas sin borrar la configuración.
2. **Nada se escribe sin que el usuario lo vea.** Toda modificación de ficheros que venga de la IA pasa por la revisión de RF-93. Única excepción, declarada y cubierta: el agente que escribe en disco por su cuenta (RF-91.6).
3. **Confinamiento al proyecto.** La IA solo lee y propone cambios **dentro de la carpeta del proyecto abierto**, con el mismo criterio que las operaciones de ficheros (`ensure_inside`, RF-69). Nada de rutas absolutas ajenas, `..` ni `.git`.
4. **Local por defecto; la nube, con aviso.** La **primera vez** que un proyecto se va a enviar a un proveedor en la nube, se avisa con su nombre («Este proyecto se enviará a Anthropic»), y se recuerda por proyecto y proveedor. El panel muestra siempre a dónde va lo que se envía («Local» o «Nube: …»).
5. **Secretos fuera de todo fichero.** Las claves de API se guardan en el **almacén de credenciales del sistema** (Administrador de credenciales de Windows, Llavero de macOS, Secret Service en Linux). Nunca en `localStorage`, en el proyecto, en el `.dbvt`, en el historial, en los registros ni en el frontend: **las peticiones salen de Rust** y la clave cruza el puente IPC **solo una vez, de ida** (al escribirla en el formulario), y nunca vuelve al frontend. *(Precisado en `/test`.)* Si el sistema no tiene almacén (un Linux sin Secret Service), se avisa y se ofrece recordarla solo durante la sesión.
6. **Sin telemetría ni servidor propio.** DBV no tiene backend, no incluye ni descarga modelos y no envía nada a ningún sitio que el usuario no haya configurado.
7. **El contenido del proyecto es un dato, no una orden.** Las instrucciones del asistente marcan como datos los ficheros que lee, para reducir la inyección de órdenes. Las herramientas de los modelos directos (RF-94) **no acceden a la red ni ejecutan programas**.
8. **Idioma:** el asistente responde en el idioma de la interfaz salvo que el usuario escriba en otro. Toda la interfaz nueva, en ES y EN.

### RF-90 — Conectar una IA
1. **Asistente «Conectar una IA»**, desde Herramientas y desde la configuración. Al abrirlo (nunca al arrancar la app) **detecta lo disponible** y lo marca: Ollama escuchando en `localhost:11434`, LM Studio en `localhost:1234` y los agentes de RF-91 en el PATH. Lo que no se encuentra aparece con un enlace a cómo instalarlo.
2. **Conexiones directas admitidas:**
   - **Locales:** Ollama, LM Studio y **cualquier servidor compatible con la API de OpenAI** (llama.cpp, vLLM, Jan…), con URL y clave opcional.
   - **En la nube, con clave de API:** Anthropic (Claude), OpenAI (ChatGPT), Google (Gemini) y OpenRouter.
   - La pantalla explica, en una frase, que **una suscripción** (Claude Pro, ChatGPT Plus, Gemini, Copilot) **no da una clave de API**, y que para usarla hay que conectar su agente (RF-91).
3. **Flujo:** elegir el proveedor → pegar la clave si hace falta → **«Probar conexión»** → elegir el modelo de la lista que devuelve el proveedor → nombre de la conexión. Los fallos se explican sin jerga: clave no válida, sin conexión, servidor local apagado, modelo inexistente, límite de uso.
4. **Varias conexiones, una activa.** El panel de conversación (RF-92) tiene un selector rápido. Cada conexión se puede editar, volver a probar y eliminar; eliminarla **borra su clave del almacén**.
5. **Capacidades por modelo,** detectadas cuando el proveedor las informa y, si no, con un valor prudente editable: si admite **herramientas**, si admite **imágenes** y su **tamaño de contexto**. Se muestran, porque cambian lo que el asistente puede hacer (RF-94.4).
6. **Criterios de aceptación:**
   - Tests de la detección contra servidores simulados (encendido, apagado, respuesta inválida).
   - Test que guarda una conexión con clave y comprueba que la clave **no aparece** en `localStorage`, en la carpeta de configuración de la app ni en los mensajes que cruzan el IPC.
   - Prueba manual con Ollama y un modelo pequeño, y con una clave real de al menos un proveedor en la nube.

### RF-91 — Agentes instalados por ACP (Claude Code, Gemini CLI, Codex, GitHub Copilot)
1. **Agentes reconocidos:** Claude Code, Gemini CLI, Codex y GitHub Copilot CLI, más «Otro agente ACP» con su orden de arranque. La forma exacta de lanzar cada uno (nativo o con adaptador) se fija en `/plan` **contra los binarios reales**, no de memoria.
2. **Ciclo de vida:** el agente se lanza como proceso hijo **con la carpeta del proyecto como directorio de trabajo** y habla ACP por stdio. Se cierra al cerrar el proyecto o la app. Un agente que no responde se puede detener desde el panel.
3. **La cuenta es la del agente.** El inicio de sesión lo hace el propio agente con la suscripción del usuario: **DBV no ve ni guarda sus credenciales**. Si el agente pide iniciar sesión, se muestra cómo, con el método que el propio agente anuncia.
4. **Requisitos que faltan** (el CLI, un adaptador, Node.js): se explica qué falta y cómo instalarlo. **DBV no instala nada sin un permiso explícito** para esa instalación concreta.
5. **Escrituras por DBV** *(spike S-ACP: Claude Code no usa esta vía; escribe en disco tras pedir permiso con el diff, y esa petición es donde se revisa y se comprueba compilando)*: DBV ofrece al agente leer ficheros **con el contenido sin guardar del editor** y escribirlos. Lo que el agente escribe por esa vía **no va a disco**: se convierte en una **propuesta de RF-93**. Mientras dura el turno, el agente lee lo que él mismo propuso, para que su trabajo sea coherente. Si el usuario rechaza algo, el siguiente mensaje al agente se lo indica.
6. **Escrituras directas en disco** (el protocolo no las impide):
   - Antes de cada turno de un agente, DBV toma un **punto de restauración** de los ficheros de texto del proyecto en el historial local (RF-73).
   - Al terminar el turno, los ficheros cambiados en disco aparecen en la misma revisión de RF-93, como **«Cambios ya hechos por el agente»**, con sus diferencias respecto al punto de restauración y **Deshacer** por fichero o todo.
   - Las pestañas abiertas siguen las reglas de conflicto por contenido de RF-68.
7. **Permisos:** cada petición de permiso del agente (ejecutar una orden, editar, leer algo) se muestra con lo que pide, y se responde con **Permitir una vez**, **Permitir siempre en esta conversación** o **Denegar**. **Nada se aprueba solo por defecto.** Lo que salga de la carpeta del proyecto se deniega con explicación.
8. **Sin terminal del cliente:** DBV **no ofrece** al agente su propia capacidad de terminal en esta versión. Las órdenes que el agente ejecute por su cuenta pasan por el punto 7 cuando el agente pide permiso.
9. **Herramientas de DBV para el agente:** si el agente admite servidores MCP en la sesión, DBV le ofrece las suyas: buscar en la documentación de Typst (RF-96), consultar los diagnósticos y **comprobar si una propuesta compila**. Así un agente que no sepa Typst 0.15.1 tiene la misma ayuda que un modelo directo. *(Resuelto en `/plan`, `ADR-V0130-002`: sin servidor MCP, que sería superficie nueva; el primer mensaje de cada sesión le da la ruta de la documentación volcada en Markdown y los diagnósticos, y la comprobación por compilación la hace DBV en la petición de permiso.)*
10. **Misma interfaz:** la conversación con un agente se muestra en el panel de RF-92, con sus mensajes, su plan, sus llamadas a herramientas resumidas y sus cambios.
11. **Criterios de aceptación:**
    - Tests con un **agente ACP simulado**: inicio, mensaje, escritura convertida en propuesta, lectura de lo propuesto, petición de permiso, cancelación, escritura directa detectada contra el punto de restauración.
    - Prueba manual del usuario con **Claude Code** en un proyecto real: pedir un cambio de formato que toque varios capítulos, revisarlo y aceptarlo en DBV. Con al menos otro agente si está disponible.

### RF-92 — Panel de conversación con el proyecto como contexto
1. **Panel propio, conmutable junto a P/E/V** (botón «IA»), visible solo con una IA activa. Ancho redimensionable y recordado. Respeta `DESIGN.md` y los tres temas.
2. **Contexto automático:** el proyecto (nombre, árbol de ficheros y documento principal), la pestaña activa con la posición del cursor y la selección, los diagnósticos actuales y el esquema. Un indicador muestra **qué se va a enviar** («main.typ · selección · 3 problemas»), se puede desplegar y se puede quitar cualquier elemento.
3. **Adjuntar:**
   - **`@`** en el campo de texto para mencionar ficheros del proyecto, con autocompletado.
   - Arrastrar un fichero desde el árbol, o **«Añadir a la conversación»** en los menús contextuales del árbol y del editor.
   - Si el modelo admite imágenes: **«Adjuntar la página visible»** de la vista previa, para preguntas como «¿por qué esta tabla se sale del margen?».
4. **Respuestas en streaming**, en Markdown con los bloques de código Typst resaltados. Cada bloque tiene **Copiar** e **Insertar en el cursor**. Insertar es una acción explícita del usuario, que se deshace con Ctrl+Z.
5. **Control:** detener la respuesta en cualquier momento, reintentar y editar el último mensaje.
6. **Conversaciones por proyecto**, guardadas en la carpeta de datos de la aplicación, **nunca en el proyecto** (no ensucian git ni el `.dbvt`). Hay una lista para retomarlas, y se pueden empezar nuevas y borrar una o todas.
7. **Errores del proveedor** (límite de uso, clave caducada, contexto excedido, sin red) se explican dentro de la conversación, con qué hacer.
8. **Consumo:** tokens de entrada y salida de la conversación, cuando el proveedor los informa.
9. **Con la conversación vacía,** sugerencias según el contexto: «Explica la estructura de este proyecto», «Revisa los errores», «Mejora el formato de las tablas»…
10. **Accesible:** se maneja con teclado, tiene foco visible y lector de pantalla (`aria-live` en la respuesta). ES y EN.
11. **Criterios de aceptación:**
    - Tests de la construcción del contexto (qué entra y en qué orden), de las menciones `@`, de la persistencia por proyecto y de que quitar un elemento del indicador lo saca de lo enviado.
    - Prueba manual en `z6-IPbook`: preguntar por un capítulo concreto lo encuentra y responde sobre él.

### RF-93 — Cambios propuestos por la IA y su revisión
1. **Qué puede proponer**, en una misma respuesta: **modificar varios ficheros** y **crear ficheros nuevos** (un capítulo, un `.bib`…). También **renombrar y eliminar**: siempre destacados, y eliminar manda a la papelera (RF-69.7). Solo ficheros de texto editables (RF-60).
2. **Revisión:**
   - Lista de ficheros afectados con sus líneas añadidas y quitadas.
   - Diferencias de cada fichero con **Aceptar o Rechazar por trozo, por fichero o todo**.
   - El texto propuesto **se puede retocar antes de aceptarlo**.
3. **Comprobación por compilación antes de enseñarla.** El motor en proceso compila el proyecto con los cambios **en memoria, sin tocar el disco**, y la propuesta dice si **compila sin errores**, **introduce N errores nuevos** o **corrige M**. **«Ver en la vista previa»** muestra el documento como quedaría, marcado claramente como propuesta, hasta volver. Con el motor clásico de respaldo, no hay comprobación, y se dice.
4. **Aplicar** usa la maquinaria de `multiFileEdit.js`, sin una segunda:
   - las pestañas abiertas se editan en el editor;
   - los ficheros cerrados se escriben de forma atómica, con copia en el historial (RF-73);
   - las huellas se validan antes de escribir;
   - un aviso «N cambios en M ficheros» ofrece **Deshacer** (todo o nada).
5. **Nunca se aplica sobre otro texto.** Una propuesta se hace sobre una versión de cada fichero. Si el usuario lo cambió después, los trozos que ya no casan **se marcan y no se aplican en silencio**, y se puede pedir a la IA que la rehaga.
6. **Duración:** una propuesta pendiente sobrevive a cerrar el panel, pero no a cerrar el proyecto; al cerrarlo se avisa de que hay cambios sin revisar.
7. **Criterios de aceptación:**
   - Tests con un fichero cerrado, una pestaña abierta con cambios sin guardar, un fichero nuevo y un trozo en conflicto.
   - Tests de aceptar o rechazar por trozo y de Deshacer.
   - Test de la comprobación por compilación: una propuesta con un error lo informa, y una que lo arregla informa de la corrección.

### RF-94 — El asistente con herramientas (modelos directos)
1. **Herramientas** que DBV da a un modelo directo que las admite:
   - listar ficheros, leer un fichero (o un tramo) y buscar en el proyecto (el motor de RF-78);
   - ver los diagnósticos y el esquema;
   - buscar en la documentación de Typst (RF-96);
   - **proponer cambios** (RF-93) y **comprobar si una propuesta compila**.

   Todas confinadas al proyecto (RNF-IA.3), sin red y sin ejecutar programas.
2. **Bucle acotado y visible:** el panel enseña lo que hace («Leyendo `cap2.typ`…»). Tiene un **máximo de pasos** por petición, fijado en `/plan` (orientativo: 15), y el usuario lo puede detener.
3. **Autocorrección:** si la propuesta no compila, el asistente recibe los errores y la puede rehacer **un número limitado de veces** (orientativo: 2). Si aun así no compila, la presenta diciéndolo.
4. **Modelos sin herramientas** (muchos locales pequeños) funcionan en **modo conversación**:
   - el contexto se arma por adelantado: fichero activo, selección, diagnósticos y fragmentos de documentación relevantes;
   - los cambios se piden en un formato de bloque por fichero que DBV convierte en propuesta de RF-93;
   - si la respuesta no se puede interpretar como propuesta, se queda como texto con «Insertar».
5. **Presupuesto de contexto:** nunca se supera la ventana del modelo. Prioridad, de más a menos:
   1. instrucciones;
   2. selección;
   3. fichero activo, recortado alrededor del cursor;
   4. diagnósticos;
   5. documentación;
   6. esquema;
   7. resto.

   El indicador de RF-92.2 dice qué se recortó.
6. **Instrucciones del sistema propias,** versionadas en el repositorio y en ES/EN. Explican lo básico de Typst 0.15.1, que **no es LaTeX**, que use la documentación y el formato de las propuestas.
7. **Criterios de aceptación:** tests con un **modelo simulado con guion** (llamadas a herramientas predefinidas) que comprueben:
   - el bucle y el máximo de pasos;
   - el reintento tras un fallo de compilación;
   - el presupuesto de contexto con una ventana pequeña;
   - el rechazo de una ruta fuera del proyecto;
   - la conversión del formato de bloque en propuesta en modo conversación.

### RF-95 — IA en línea sobre la selección
1. **Con texto seleccionado,** el menú contextual del editor tiene **«IA ›»**, y hay un atajo (fijado en `/plan` contra todo el keymap, RF-80). Los dos abren una barra flotante junto a la selección con estas acciones:
   - **Mejorar redacción**;
   - **Corregir ortografía y gramática**;
   - **Traducir a…** (ES, EN u otro idioma);
   - **Acortar** y **Ampliar**;
   - **Convertir a tabla Typst** y **Convertir a lista**;
   - **Explicar** (solo responde, no cambia nada);
   - un campo libre **«Pide algo…»**.
2. **Sin selección,** la acción actúa sobre el párrafo actual. Sobre un error subrayado, el menú ofrece **«Explicar y arreglar»** (RF-97.5).
3. **Resultado en línea:** se ve en el propio editor como diferencia (lo que sale y lo que entra), con **Aceptar**, **Rechazar** y **Reintentar**. «Explicar» abre una nota flotante.
4. **Respeta el marcado de Typst:** conserva funciones, ecuaciones, etiquetas y citas. En un `.typ`, el resultado se comprueba compilando (RF-93.3) y avisa si introduce errores.
5. **Qué IA usa:** la conexión directa activa. Si solo hay un agente conectado, la petición se le envía como mensaje, con su revisión normal.
6. **Criterios de aceptación:** tests de que la petición conserva el marcado (`#`, `$…$`, `<etiqueta>`, `@cita`), de la aplicación de la diferencia y del atajo sin conflictos; prueba manual de traducir un párrafo con una cita y una ecuación sin romperlas.

### RF-96 — Documentación de Typst offline, para la IA y para el usuario
1. **Generada desde las fuentes oficiales** *(por un script de mantenimiento, `npm run docs:typst`, una vez por versión de Typst, y versionada: `ADR-V0130-002`)* de **la versión exacta vendorizada** (hoy 0.15.1, con la misma comprobación de versión que RF-56.1). Se convierte a **Markdown**, se trocea por página y sección y se empaqueta con la aplicación. **Sin descarga ni red.** Un test falla si la versión de la documentación no es la del compilador. El método de generación se decide en `/plan`.
2. **Contenido:** tutorial, guías y la **referencia completa** (funciones, parámetros, tipos y ejemplos). La documentación de Typst es Apache-2.0: se conservan sus avisos.
3. **Búsqueda local,** léxica y sin *embeddings*. La documentación está en inglés, así que la búsqueda en español usa un **glosario bilingüe** de términos de Typst (tabla → `table`, figura → `figure`, ecuación → `equation`, pie de figura → `caption`…).
4. **Uso por la IA:** con la herramienta de RF-94 o con fragmentos inyectados en modo conversación (RF-94.4). Las respuestas **citan la página** que usaron.
5. **Paquetes del proyecto:** también entra el README (y la documentación que traiga) de los paquetes de Universe que importa el proyecto, **leídos de la caché local de paquetes**, sin red.
6. **También para el usuario, sin IA:** Ayuda › **«Documentación de Typst (sin conexión)»**, con buscador, páginas renderizadas y enlaces internos. En el menú contextual del editor, **«Ver documentación de `nombre`»** sobre una función. Para renderizar el Markdown se reutiliza lo de DBV Markdown Reader si encaja (prioridad 1 de §11).
7. **Tamaño:** se mide en `/plan`. Orientativo: menos de 5 MB comprimido en el instalador.
8. **Criterios de aceptación:**
   - *(Sustituido en `/plan`)* El paquete generado se versiona y un test de Rust falla si su versión no es la del sidecar.
   - Test de la versión.
   - Tests de búsqueda: «table header» devuelve primero la página de `table`; «cabecera de tabla» llega a la misma por el glosario.
   - Prueba manual del visor sin conexión.

### RF-97 — Panel de Problemas, con «Explicar y arreglar»
1. **Pestaña «Problemas» en el panel lateral,** junto a Archivos, Esquema y Buscar, con su contador. La insignia actual se conserva y abre esta pestaña en vez del desplegable.
2. **Lista completa** (sin el tope de 50), **agrupada por fichero** y con los errores primero. Cada entrada lleva severidad, mensaje, línea y columna, un extracto de la línea y las **pistas** de Typst. Un clic abre el fichero en el sitio (en su pestaña, RF-79).
3. **Filtros:** errores, avisos y «solo el fichero activo».
4. **Se actualiza con cada compilación.** Con el motor clásico de respaldo, muestra los mensajes de la banda con su fichero y línea cuando se pueden extraer y, si no, su texto, **sin inventar posiciones**.
5. **Con IA:** **«Explicar y arreglar»** en cada problema y en el menú del subrayado del editor. Envía el diagnóstico, el fragmento y la documentación relevante (RF-96). Devuelve una **explicación en lenguaje llano** y una **propuesta** (RF-93) comprobada compilando. Con varios errores, **«Arreglar todos»** los trata en una sola propuesta.
6. **Sin IA:** el panel funciona igual, sin ese botón. Si el error nombra una función, ofrece **«Ver documentación»** (RF-96.6).
7. **Criterios de aceptación:** tests de agrupación, orden, filtros y de que la insignia abre la pestaña; con un error en un capítulo incluido y no abierto, aparece con su fichero y su línea, y un clic lleva a él.

### RF-98 — Visor de datos CSV/TSV
1. **Abrir un `.csv` o `.tsv` muestra una tabla,** con un conmutador **Tabla / Texto**. El modo texto es el editor de RF-60. Se recuerda por fichero.
2. **Lectura:** detecta el separador (`,`, `;` o tabulador) y la cabecera, y admite campos entre comillas con separadores y saltos de línea dentro. UTF-8 con o sin BOM; otra codificación se avisa.
3. **Explorar:** ordenar por columna (como número cuando la columna es numérica), filtrar (en todas las columnas o en una), número de filas y ancho de columna. Ficheros grandes con desplazamiento virtual (orientativo: 100 000 filas con fluidez).
4. **Solo lectura en la tabla:** se edita en modo texto.
5. **«Insertar como tabla»** inserta, en el cursor del último `.typ` activo, código Typst que **lee el fichero con `csv()`** (con la ruta relativa correcta desde ese `.typ`) y lo pinta con `table`. Opciones: cabecera, alineación por columna y envolverla en figura con pie y etiqueta. Para tablas pequeñas, **«Copiar como tabla Typst»** incrusta los datos.
6. **Herramientas › «Visor de datos…»** abre un CSV del proyecto o de fuera. De fuera, ofrece **copiarlo a `data/`**, como se hace con las imágenes.
7. **Con IA:** «Preguntar a la IA sobre estos datos» adjunta la cabecera y una muestra, respetando el presupuesto de RF-94.5.
8. **Criterios de aceptación:**
   - Tests del lector: comillas, separadores, saltos de línea dentro de comillas, BOM y orden numérico.
   - El código que genera «Insertar como tabla» **compila** con el sidecar real (`verify:typst`) con ruta en la misma carpeta y en otra.
   - Prueba manual de fluidez con un CSV grande.

### RNF-IA-EVAL — Evaluación de la IA (evals)
1. **Corpus versionado** en `testfiles/ai-evals/` con **al menos 30 tareas reales de Typst**:
   - arreglar errores que da el compilador;
   - pasar fragmentos de LaTeX o Markdown;
   - tablas desde CSV;
   - figuras con pie y etiqueta;
   - referencias cruzadas y bibliografía;
   - cambios que tocan varios ficheros;
   - preguntas de documentación.
2. **Métricas automáticas:**
   - la propuesta **compila sin errores nuevos**, lo que prueba además que no inventa funciones;
   - no toca ficheros fuera de la tarea;
   - la propuesta tiene un formato válido;
   - trayectoria: número de pasos y ninguna herramienta fuera del proyecto.

   La calidad del texto se valora con una rúbrica.
3. **Contra al menos un modelo local pequeño** (en Ollama), **con y sin** la documentación de RF-96. Criterio: **la documentación sube la tasa de compilación**. El umbral absoluto se fija en `/plan` tras medir la línea base. Con un modelo en la nube si el usuario aporta una clave.
4. **Fuera de la CI normal,** porque necesita un modelo: `npm run eval:ai`, a mano, con los resultados guardados con fecha y modelo. **En la CI sí van** los tests deterministas con modelo y agente simulados (RF-91 a RF-95).

### Preguntas abiertas para `/plan` (no se resuelven aquí a propósito)
- **Protocolos y crates:** cliente HTTP con streaming (SSE) desde Rust (`ureq` actual o un segundo cliente); API compatible con OpenAI frente a API nativa por proveedor (Anthropic y Gemini); almacén de secretos (crate `keyring` u otro) y su comportamiento en MSIX, macOS sin firmar y Linux sin Secret Service.
- **ACP:** crate o implementación propia; orden de arranque exacta de cada agente y si necesita adaptador o Node.js; semántica de las escrituras preparadas (RF-91.5) cuando el usuario rechaza a mitad de turno; coste del punto de restauración (RF-91.6) en un libro grande; si ofrecer herramientas por MCP (RF-91.9) es viable con cada agente. Lanzar procesos desde el paquete de la Store (precedente: Python).
- **Documentación (RF-96):** cómo se generan las páginas de la 0.15.1 desde sus fuentes (el generador de la rama principal ha cambiado), conversión a Markdown, troceado, glosario, algoritmo de búsqueda y tamaño final.
- **Revisión (RF-93):** vista de diferencias por trozo (ampliar `diffModal.js` o `@codemirror/merge`); compilar una propuesta como sustitución en memoria del motor (precedente `CompileTarget.otherDirty`) y mostrarla en la vista previa sin perder la generación actual.
- **Panel (RF-92):** sitio en la rejilla junto a P/E/V y su encaje en `verify:layout`; renderizador de Markdown; formato y ubicación de las conversaciones; estimación de tokens sin tokenizador por modelo.
- **IA en línea (RF-95):** atajo y presentación de la diferencia en línea en CodeMirror.
- **CSV (RF-98):** lector propio o librería, desplazamiento virtual y sitio del conmutador en la barra del documento.
- **Ficha de privacidad de la Store:** la app puede enviar datos a terceros si el usuario lo configura; revisar la declaración de privacidad y el texto de la ficha.
- **Riesgo de deriva:** ACP es joven y los adaptadores cambian; cómo se aísla esa dependencia.
- Qué secciones de `ARCHITECTURE.md` hay que ampliar (§7.20 nace en este `/spec` como directriz).

---

## ✨ 5o. Funcionalidades — v0.13.1 (La IA con modelos locales: razonamiento visible, velocidad, contexto y honestidad de las propuestas)

> **Origen:** prueba real de la 0.13.0 el 2026-10-03 con Gemma 4 (`llama-server`), `qwen2.5:3b`, `qwen3:8b` (Ollama) y Claude. Lo observado:
> - **Modelos que no llaman a la herramienta o la llaman mal.** Gemma 4 dijo «he propuesto un cambio… revisa y acepta» sin llamar a `propose_changes`; `qwen2.5:3b` leyó un fichero y contestó de memoria que `box` «no es una función estándar de Typst» sin consultar la documentación.
> - **El panel se queda mudo.** `qwen3:8b` funciona bien pero tarda mucho, y mientras razona el panel no enseña nada: el backend **descarta por completo** el razonamiento del modelo (`thinking` de Ollama, `reasoning_content` de los servidores compatibles con OpenAI), así que la espera parece un cuelgue.
> - **La guía recomendaba un modelo inservible.** `docs/IA.md` y la Ayuda usan `qwen2.5:3b` como ejemplo; la evaluación (RNF-IA-EVAL, 2026-10-02) lo dejó en 2/32 sin documentación y 1/32 con ella (`llama3`: 5/32 y 6/32).
> - **Equipo de referencia:** RTX 4070 Ti de 12 GB, 128 GB de RAM. `qwen3:8b` cabe holgado; `qwen3:14b` (9,3 GB) cabe justo y desborda a la RAM si la GPU está ocupada.
>
> **Versionado:** la 0.13.0 ya está en GitHub, pero **no se publica en la Microsoft Store**; la Store recibirá la 0.13.1. Ver `ADR-V0130-005` (`memory.md`).
>
> **Decisiones del usuario en este `/spec` (2026-10-03):** el razonamiento va **desactivado por defecto, con interruptor por conexión**; el soporte de mostrarlo se limita a **Ollama y a los servidores compatibles con OpenAI**, y el resto de proveedores queda como mejora futura; entran el indicador de velocidad, la medición con recomendación de modelos y el análisis del contexto mínimo.

Se mantienen todos los principios de RNF-IA. Esta versión **no añade proveedores ni funciones nuevas de IA**: hace que las existentes se comporten bien con modelos pequeños y se entienda lo que hacen.

### RF-99 — Una propuesta que no existe no se anuncia como hecha *(ya construido en el árbol de trabajo; modifica RF-94.2 y RF-94.3)*
1. **`propose_changes` nunca devuelve una respuesta vacía.** Si no llega ningún cambio (ausente, vacío o que no es una lista), o si ningún cambio modifica un fichero (edición idéntica al texto actual o que falló), devuelve un error explícito —«NOTHING was proposed…»— que le dice al modelo que reintente o se lo diga al usuario. Un único cambio enviado como objeto se acepta como lista de uno.
2. **El recordatorio por falta de llamada** (RF-94.2) salta cuando el modelo **anuncia** una propuesta («propuesta», «proponiendo», «I'll propose», «review and accept»), no solo cuando escribe literalmente `propose_changes`. Una sola vez por turno y solo si aún no hay propuesta; el aviso dice que **no se ha propuesto nada**.
3. **Criterios de aceptación** *(cumplidos)*: tests de `tools.test.js` (cambios vacíos, objeto suelto, edición idéntica o fallida) y de `agentLoop.test.js` (frases que anuncian una propuesta, y una respuesta normal que no dispara el aviso).

### RF-100 — El razonamiento del modelo, visible y plegable
1. **Se recoge.** El streaming del backend distingue el **razonamiento** del texto de la respuesta: `message.thinking` en la API nativa de Ollama y `reasoning_content` en los servidores compatibles con OpenAI (llama.cpp, LM Studio, vLLM). Llega al frontend como un evento propio, no mezclado con el texto.
2. **Bloque plegable por respuesta.** Mientras llega, se muestra **abierto**, con el texto fluyendo y un contador de tiempo; al terminar la respuesta se **contrae** a una línea («Pensó durante 38 s ▸») que se puede desplegar para ver por qué el modelo propuso lo que propuso. Un modelo que no razona no muestra nada.
3. **Indicador de actividad, aunque no llegue razonamiento.** Desde que se envía el mensaje hasta el primer dato, el panel muestra que **el modelo está trabajando** («Esperando al modelo…», «Pensando…», «Escribiendo…»), con animación que respeta `prefers-reduced-motion`. Cubre también la espera del modelo local que carga o procesa el contexto antes de emitir nada. Es independiente del bloque de razonamiento.
4. **Solo se muestra, nunca se reutiliza.** El razonamiento **no se reenvía** al modelo como historial, **no se guarda** en la conversación (ni en disco), **no cuenta** para el presupuesto de contexto de RF-94.5 y no se copia al insertar o aplicar nada.
5. **Alcance:** Ollama y compatibles con OpenAI. Anthropic (extended thinking), Gemini y OpenAI quedan **fuera**, como mejora futura declarada.
6. **Accesible:** el bloque es un `<details>` operable con teclado; el razonamiento **no va en una región `aria-live`** (sería ruido), solo el indicador de estado. Respeta `DESIGN.md` y los tres temas. ES y EN.
7. **Criterios de aceptación:**
   - Tests del backend con un servidor simulado que emite `thinking` (Ollama) y `reasoning_content` (compatible), con y sin texto de respuesta.
   - Test de que el razonamiento no aparece en la petición del turno siguiente ni en la conversación persistida.
   - Test del panel: bloque abierto durante el streaming, contraído al terminar, ausente si no hubo razonamiento.
   - Prueba manual con `qwen3:8b` (Ollama) y con Gemma 4 por `llama-server` **sin** `--reasoning-budget 0`.

### RF-101 — Interruptor «Razonamiento» por conexión
1. **Por conexión, desactivado por defecto.** En el formulario de «Conectar una IA» y al editarla, un interruptor «Razonamiento» (explicado en una frase: «Piensa antes de responder: suele mejorar las propuestas, pero tarda mucho más»). Las conexiones existentes **no cambian de comportamiento sin que el usuario lo decida**: se tratan como «desactivado».
2. **Se aplica donde DBV puede:** en Ollama, con el parámetro `think` de su API nativa. En los servidores compatibles con OpenAI no hay un estándar: se aplica el mecanismo que cada servidor admita en la petición si se puede detectar y, si no, el interruptor se muestra **inactivo con la explicación** de cómo hacerlo en el servidor (`--reasoning-budget 0` en `llama-server`, ya en la guía).
3. **Un modelo que no razona no falla por esto.** Si el modelo no admite `think`, la conexión sigue funcionando y el interruptor se muestra como no aplicable (capacidad detectada, como RF-90.5).
4. **Criterios de aceptación:** test de la petición con y sin `think` contra un servidor simulado; test de que un modelo que rechaza `think` no rompe el turno; prueba manual con `qwen3:8b` midiendo el tiempo de la misma tarea con el interruptor activado y desactivado.

### RF-102 — Velocidad y tiempo de respuesta en el panel
1. **Tokens por segundo y tiempo transcurrido**, durante la respuesta y al terminar, junto al consumo de RF-92.8. Los toma de lo que informa el proveedor (Ollama da `eval_count` y `eval_duration`) y, si no, los calcula con los datos del streaming.
2. **Orientación cuando va lento.** Si la velocidad es muy baja (umbral orientativo: menos de 5 tokens/s, fijado en `/plan`) y la conexión es local, el panel añade una sugerencia no bloqueante: comprobar si el modelo cabe en la GPU (`ollama ps` debe decir «100 % GPU») o probar un modelo más pequeño. Aparece como una nota de la conversación y no se repite en la misma conversación.
3. **No sustituye al indicador de RF-100.3:** saber los tokens/s no dice si el modelo está vivo; el indicador de actividad sí.
4. **Criterios de aceptación:** tests del cálculo con y sin datos del proveedor, y de que la sugerencia aparece una sola vez.

### RF-103 — Modelos pequeños y contexto insuficiente
1. **Aviso de modelo pequeño.** Cuando el modelo es local y el tamaño que informa el proveedor (en Ollama, `parameter_size` de `/api/show`) es **menor de 7 000 millones de parámetros**, «Conectar una IA…» y el panel muestran un aviso **no bloqueante**: los modelos pequeños suelen fallar al proponer cambios y al decidir cuándo usar la documentación; se recomienda uno mayor o una IA en la nube. Si el tamaño no se conoce, no se avisa.
2. **Contexto mínimo recomendable.** DBV calcula, a partir de lo que realmente envía (instrucciones del sistema, definición de las herramientas, contexto automático básico y la reserva de respuesta de RF-94.5; más una reserva extra si el razonamiento está activado), **el contexto mínimo con el que el asistente funciona**, y un **valor recomendado** con holgura. Los valores se **miden en `/plan`** (orientativo: 8 192 de mínimo y 16 384 recomendado con herramientas).
3. **Aviso de contexto corto.** Si el contexto de la conexión es menor que ese mínimo, se avisa **con el número**: «Con N tokens el asistente tiene que recortar casi todo lo que le envías, y el resultado puede no ser óptimo; usa al menos M». En Ollama se explica cómo subirlo (`num_ctx` ya lo fija DBV); en `llama-server`, recordando que cada slot recibe `n_ctx / total_slots` (ya en la guía). RF-92.2 sigue diciendo qué se recortó en cada mensaje.
4. **Ejemplos honestos en la guía y en la Ayuda.** `docs/IA.md`, `docs/IA.en.md` y la sección «Asistente de IA» de la Ayuda dejan de usar `qwen2.5:3b` como ejemplo y recomiendan modelos con números (RF-104). Se explica qué es el razonamiento, por qué un modelo local puede parecer mudo y qué hace el interruptor de RF-101.
5. **Criterios de aceptación:** tests del cálculo del mínimo (cambia con las herramientas, con el razonamiento y con la ventana), de los avisos (tamaño conocido, desconocido, contexto corto/suficiente) y de que los textos existen en ES y EN.

### RF-104 — Medir los modelos locales y recomendar solo los que lo merecen
1. **Evaluación con modelos actuales.** Se ejecuta `npm run eval:ai` contra `qwen3:8b` y `qwen3:14b` (Ollama) y, si el usuario lo aporta, contra Gemma 4 y un modelo en la nube, **con y sin** el razonamiento y con y sin la documentación de RF-96. Los resultados se guardan en `testfiles/ai-evals/results/` con fecha y modelo, como los de la 0.13.0.
2. **Recomendación con datos.** La guía incluye una tabla con modelo, tamaño en disco, herramientas y tareas superadas (sin y con documentación), con el tiempo y la memoria de GPU en el texto cuando se midieron, y **solo recomienda los que superan un umbral** fijado en `/plan` a partir de la línea base medida (`qwen2.5:3b`: 2/32; `llama3`: 5/32). Los que no lo superan se indican como «no recomendado para proponer cambios».
3. **El script respeta el interruptor:** `eval:ai` admite fijar el razonamiento del modelo para comparar ambos modos con la misma tarea.
4. **Criterios de aceptación:** resultados guardados y enlazados desde la guía; la tabla de la guía coincide con los ficheros de resultados.

### RF-105 — La IA separa presentación de contenido
*Observado en la prueba de la 0.13.0 (2026-10-03): la IA genera `#set`, `#show` y funciones de formato dentro del documento principal, mezclados con el texto.*
1. **Principio, en las instrucciones del sistema (RF-94.6) y en ES/EN:** el **contenido** (texto, estructura, figuras, tablas, referencias) va en los ficheros de contenido; la **presentación** (`#set`, `#show`, tipografías, márgenes, colores, tamaños, espaciados, numeración, estilos de encabezados, de tablas y de figuras, y funciones de formato reutilizables) va en **ficheros de estilo**. Cuando la tarea toca el aspecto, el cambio se propone **en el fichero de estilo**, no en el principal ni en el capítulo.
2. **Usa la convención del proyecto.** El contexto automático (RF-92.2) indica qué ficheros de estilo existen (nombres habituales como `estilos.typ`, `style.typ`, `styles.typ`, `template.typ` o `config.typ`, o el que importe el documento principal con `#import` o `#include` y solo contenga reglas y funciones de formato). Si hay uno, **se edita ese**.
3. **Si no hay ninguno,** la propuesta **lo crea** (nombre orientativo `estilos.typ`, fijado en `/plan`) y **añade al documento principal solo** el `#import` o `#include` necesario, en una propuesta única que se revisa como las demás (RF-93).
4. **Excepciones razonables,** que la IA explica en una frase: una regla `#set`/`#show` de ámbito local que solo afecta a un fragmento concreto (por ejemplo, una tabla puntual) puede quedarse junto a él si moverla cambiaría el resultado; y un documento de un solo fichero y sin intención de dividirse se respeta tal cual si el usuario lo pide.
5. **No reorganiza lo que no se le pide.** Separar es una regla para lo que **la IA escribe**; no mueve por su cuenta el formato que el proyecto ya tiene en el principal salvo que el usuario se lo pida («separa el estilo del contenido»), y entonces lo hace como una propuesta revisable.
6. **Alcance:** modelos directos (RF-94) y modo conversación (RF-94.4); en los agentes por ACP (RF-91) va como parte del primer mensaje de la sesión; en la IA en línea (RF-95), que opera sobre una selección, se limita a **no introducir** formato dentro del texto que reescribe.
7. **Se evalúa (RNF-IA-EVAL):** el corpus gana tareas de formato (cambiar tipografía, márgenes, estilo de encabezados o de tablas, numeración), con una métrica automática nueva: **el cambio de aspecto se ha hecho en un fichero de estilo y el fichero de contenido no ha ganado `#set`/`#show`**, además de que compile. Se mide la línea base antes y después de añadir el principio al prompt.
8. **Criterios de aceptación:**
   - Test de que las instrucciones del sistema incluyen el principio en ES y EN y en las dos modalidades (con y sin herramientas).
   - Test de que el contexto lista los ficheros de estilo detectados y de que un proyecto sin ninguno lo indica.
   - Tests con un modelo simulado: una petición de cambiar la tipografía acaba como edición del fichero de estilo; sin fichero de estilo, como creación más un `#import` en el principal.
   - Tareas de formato en `testfiles/ai-evals/tasks.json` y su métrica en `eval:ai`.

### RF-106 — Nuevo documento suelto, sin crear un proyecto
*Petición recurrente de usuarios: escribir un único `.typ` sin pasar por el asistente de proyecto. Hoy «Abrir archivo» ya abre un `.typ` suelto (RF-16, criterio c), pero no hay forma de **crear** uno sin crear una carpeta de proyecto.*
1. **Entrada «Nuevo .typ vacío…»** *(el nombre «Nuevo documento» ya es el del botón de plantillas del lanzador; se cambió en `/build`)* en el menú de nuevo/archivo (junto a «Proyecto en blanco»), con su atajo y también en la pantalla de inicio y en la vista sin documento abierto. Se maneja con teclado y tiene su texto en ES y EN.
2. **Se guarda primero, se abre después** (opción A de este `/spec`). Abre el diálogo de guardar del sistema, filtrado a `.typ`; al aceptar, DBV crea el fichero y lo abre **como documento suelto**, exactamente igual que uno abierto con «Abrir archivo». No hay documento «sin título» en memoria.
3. **Carpeta por defecto: la última usada** para abrir o guardar un documento, recordada entre sesiones. Si no existe o no hay ninguna, la carpeta de documentos del usuario. Si la carpeta recordada ya no existe, se cae a la de documentos sin dar error.
4. **Plantilla vacía:** el fichero se crea **vacío** (0 bytes), sin `#set`, sin título ni texto de ejemplo. Coherente con RF-105: nada de formato que el usuario no pidió.
5. **Si el nombre no acaba en `.typ`,** se añade. Si el fichero ya existe, se usa la confirmación de sobrescritura del propio diálogo del sistema; **nunca se sobrescribe sin que el usuario lo confirme**. Cancelar el diálogo no cambia nada.
6. **No se crea ninguna carpeta ni ningún fichero de proyecto** (ni `.dbvt`, ni `typst.toml`, ni documento principal declarado): lo único que aparece en disco es el `.typ` elegido. Lo que ya hace un `.typ` suelto (compilar en su carpeta, vista previa, exportar a PDF, guardar, deshacer, autoguardado) sigue igual.
7. **La IA ve un solo fichero.** Con un documento suelto, el contexto automático (RF-92.2) es **solo ese fichero**; el indicador del panel lo dice («Documento suelto: la IA solo ve este archivo»), y las propuestas solo pueden tocarlo. Para RF-105: sin más ficheros no hay fichero de estilo que editar, así que la IA **no crea ficheros nuevos por su cuenta** en un documento suelto salvo que el usuario se lo pida.
8. **Criterios de aceptación:**
   - Test de que la acción crea un fichero vacío con extensión `.typ` en la ruta elegida y lo abre como documento suelto, sin crear ninguna otra cosa en disco.
   - Tests del diálogo: carpeta inicial = la última usada; carpeta recordada inexistente → documentos; sin `.typ` en el nombre → se añade; cancelar → sin cambios.
   - Test de que no sobrescribe un fichero existente sin confirmación.
   - Test del contexto de la IA con un documento suelto (un solo fichero, con el aviso en el indicador).
   - Prueba manual: crear un documento nuevo, escribir, ver la vista previa, exportar a PDF, cerrar y reabrirlo desde «Recientes».

### Fuera de alcance de la 0.13.1
- Mostrar el razonamiento de Anthropic (extended thinking), Gemini y OpenAI (RF-100.5).
- Elegir o descargar modelos desde DBV, o medir la memoria de la GPU del usuario.
- Cambiar el comportamiento de los agentes por ACP (RF-91): no usan `propose_changes`.
- Un documento «sin título» en memoria que se guarda después (RF-106 lo resuelve guardando primero); si hiciera falta, es una mejora futura con su propio coste en compilación, pestañas, autoguardado e historial.
- Publicar la 0.13.0 en la Microsoft Store.

### Preguntas abiertas para `/plan` (no se resuelven aquí a propósito)
- **`think` en Ollama:** versión mínima que lo admite; qué devuelve un modelo sin capacidad de razonar (error o se ignora) y cómo detectarla de antemano (`capabilities` de `/api/show`).
- **Compatibles con OpenAI:** qué parámetro por petición desactiva el razonamiento en llama.cpp (`chat_template_kwargs`/`enable_thinking`), LM Studio y vLLM, y si se puede detectar; si no, el interruptor solo explica.
- **Streaming:** cómo viaja el evento de razonamiento por el puente IPC y cuántos eventos por segundo aguanta el panel sin perder fluidez.
- **Medición de velocidad:** con el streaming de un servidor compatible que no informa de duraciones, cuánto error mete calcularla en el cliente (el primer token incluye la carga del modelo).
- **Contexto mínimo:** cuántos tokens ocupan realmente el sistema y las herramientas (se mide en `/plan`) y cómo influye la reserva del razonamiento.
- **Umbral de recomendación (RF-104):** qué porcentaje de tareas superadas y de compilación se exige.
- **Separación de estilo (RF-105):** cómo se detecta un fichero de estilo (por nombre, por lo que importa el principal o por su contenido de solo reglas), el nombre por defecto al crearlo y cuántos tokens añade al contexto listar los ficheros de estilo; qué hacer con proyectos que ya mezclan formato y contenido.
- **Nuevo documento (RF-106):** dónde se guarda «la última carpeta usada» (¿la misma preferencia que ya usa «Abrir archivo»?), atajo de teclado libre, y si el diálogo de guardar de Tauri permite fijar el nombre propuesto y el filtro `.typ` en las tres plataformas.
- **Guion del vídeo de demostración** (pospuesto por el usuario hasta tener esto): no es un requisito de producto.

---

## 🚀 6. Funcionalidades — Beta y v1.0 (detalle del Spec Addendum)

Estas funcionalidades están **descritas y arquitectónicamente resueltas** (ver `ARCHITECTURE.md` §7.6–§7.14 y `TYPST_ECOSYSTEM_RESEARCH.md`) pero **fuera del MVP v0.1** por decisión explícita de alcance del usuario. Nota de encuadre: el **Universe Browser** (Package Explorer + Template Explorer, ver árbol de navegación en `ARCHITECTURE.md` §7.6.0.1) se posiciona como punto de entrada de primer nivel de la aplicación (§2), no como un add-on menor — esto afecta a su importancia de diseño y visibilidad en Beta, no reabre el acuerdo de fases ya cerrado con el usuario (el Lanzador de plantillas curadas, MVP, ya adelanta esta experiencia — ver `ARCHITECTURE.md` §7.6):

**Beta (v0.2–v0.4):**
- **Universe Browser — Package Explorer** (ecosistema distinto del de plantillas — clarificación explícita del usuario): buscar/explorar paquetes Typst por categoría, ver instalados/detalle/documentación/versión/actualizaciones, botón "Añadir al proyecto" que inserta el `#import` automáticamente. Incluye detección automática de "Paquetes usados" al abrir un proyecto, con **Versión actual / Última versión / insignia de actualización disponible** por paquete y botón "Actualizar" (reescribe el `#import`, no delega en el CLI — no existe comando equivalente). Apoyado en el `index.json` público oficial de Typst (`packages.typst.org`), no en un registro propio — ver `ARCHITECTURE.md` §7.6.2 y `TYPST_ECOSYSTEM_RESEARCH.md`.
- **Universe Browser — Template Explorer** (distinto del Package Explorer, mismo nivel de navegación — ver §7.6.0.1): pestañas Instaladas / Comunidad / Favoritas / Recientes / Actualizaciones; ficha de plantilla con imagen de vista previa, nombre, autor, versión, descripción, categoría; acción principal "Crear Proyecto" (nunca "Descargar código"). La pestaña Comunidad usa el mismo `index.json` oficial, filtrado por plantillas — ver `ARCHITECTURE.md` §7.6.3.
- Panel de navegación estructural (esquema del documento, actualizado automáticamente, navegación rápida) — crítico para tesis y documentos extensos. Vía `typst query` del sidecar CLI.
- Asistentes de inserción **con formulario** (la barra de botones en sí es **v0.2**, RF-13): galería de símbolos matemáticos con búsqueda, diálogo de tabla con dimensiones y alineación, inserción de figura con selector de fichero y copia al proyecto —ampliado en **RF-17** (§5b) a un desplegable con las imágenes que ya tiene el proyecto, por coherencia con el de citas—, cita con autocompletado sobre las claves del `.bib`. Es la capa que necesita UI y datos propios por encima del simple emisor de marcado de RF-13.
- Gestión de imágenes por arrastre: copiar al proyecto, organizar, generar `figure()` con caption automáticamente. *Entregado en el Slice 19, pero restringido a soltar dentro del panel del editor; **RF-18** (§5b) lo iguala con el arrastre de fuentes, que acepta la ventana entera.*
- ~~Gestión visual de bibliografía (`.bib`): exploración de referencias, autocompletado de citas, validación.~~ **Movido a v0.6.0 como RF-35 (§5f), 2026-09-11.**
- Modos de trabajo: Escritura (mínima distracción), Edición (todas las herramientas), Dividido (editor + PDF), Lectura (documento final).
- Exportación PNG (página actual / rango / documento completo).
- **Terminal avanzado:** consola opcional, oculta por defecto, para ejecutar subcomandos oficiales de Typst directamente sobre el proyecto activo, con salida mostrada en la app — para usuarios avanzados; no sustituye a ningún flujo guiado. `ARCHITECTURE.md` §7.14. **Pasa a vivir bajo el menú Herramientas en v0.6.0 (RF-32, §5f), 2026-09-11.**
- Autocompletado semántico y diagnósticos en línea vía LSP `tinymist`. ~~Sincronización de scroll editor↔preview por posición real de fuente (no por anclas).~~ **Sustituido el 2026-09-08 por RF-16 (§5b):** el Spike S-2 demuestra que no existe posición real de fuente accesible desde el sidecar —ni `span` en el API de scripting ni anotación en el SVG— y §9 ya había descartado `tinymist` para esto mismo. La sincronización se implementa **con anclas**. `tinymist` sigue siendo candidato para el autocompletado semántico y, en el futuro, para elevar la precisión del sync de bloque a línea.
- ~~Empaquetado macOS, auto-actualizador (`tauri-plugin-updater`).~~ **Movidos a v0.6.0 como RF-36 y RF-37 (§5f), 2026-09-11.**
- ~~Universe Browser — Package Explorer y Template Explorer completos (párrafos de arriba, sobre el catálogo sin filtrar).~~ **Movido a v0.6.0 como RF-34 (§5f), 2026-09-11**: la whitelist curada del lanzador (RF-25/RF-26) cubría el MVP/v0.5.0; el catálogo completo entra en v0.6.0.

**v1.0:**
- Ecosistema completo de plantillas (categorías ampliadas: Académico, Docencia, Profesional, Presentaciones — ver listado completo del Spec Addendum en `ARCHITECTURE.md` §7.6).
- Exportación SVG.
- Asistentes avanzados y experiencia académica completa.
- Publicación en Microsoft Store / Uptodown, accesibilidad WCAG AA auditada.
- Paquete Docente (export combinado PDF+SVG+PNG+recursos listo para Moodle/Teams/SharePoint).

**Futuro (post-1.0, exploratorio):** ~~IA (asistentes de redacción académica)~~ **adelantada a v0.13.0 (§5n, RF-90 a RF-98), 2026-10-02**, repositorio comunitario propio, sincronización, colaboración en tiempo real, integración con Zotero/Mendeley.

## 🚫 7. Fuera de alcance (v0.1 MVP)

- [ ] Todo lo listado como Beta/v1.0/Futuro en §6.
- [ ] Empaquetado macOS.
- [ ] Colaboración en tiempo real / multiusuario.
- [ ] Integración con gestores de referencias externos (Zotero, Mendeley) más allá de `.bib` local.
- [ ] Exportación a formatos distintos de PDF — Typst no lo soporta de forma nativa hoy.
- [ ] Versión Android/iOS.
- [ ] Sincronización en la nube.

## ⚠️ 8. Riesgos y Mitigación

- **Riesgo:** El MVP creció de 11 a 12 requisitos funcionales tras el Spec Addendum (lanzador, asistente de proyecto y project archive se incorporan al MVP). Esto aumenta el esfuerzo de la primera entrega.
  - **Mitigación:** El core técnico (editor + compilación + preview) sigue siendo el mismo; los añadidos (RF-01, RF-03, RF-11) son UI/orquestación sobre la infraestructura ya heredada de DBV Markdown Reader, no nuevo riesgo técnico — ver estimación de complejidad en `ARCHITECTURE.md` §8.
- **Riesgo:** El editor de código (RF-05) es la mayor brecha respecto a DBV Markdown Reader (solo tiene un `<textarea>` plano). El Spec Addendum pide además evaluar explícitamente Monaco como opción principal, lo que reabre una decisión ya tomada.
  - **Mitigación:** Re-evaluación completa realizada, decisión confirmada (CodeMirror 6) con justificación reforzada por la propia filosofía "Obsidian for Typst" del Addendum — ver `ARCHITECTURE.md` §7.1 y ADR en `memory.md`.
- **Riesgo:** Integrar plantillas comunitarias (Beta) implica ejecutar/compilar código Typst de terceros — riesgo de cadena de suministro, aunque Typst es un lenguaje de tipografía sandboxed (sin acceso arbitrario a red/FS fuera del proyecto).
  - **Mitigación:** Ver `ARCHITECTURE.md` §6 (nueva fila de riesgo) y §7.6.
- **Riesgo de Seguridad y Privacidad (IA/Datos):** Ninguno de los datos del usuario (documentos académicos) debe salir del equipo — coherente con el objetivo offline-first.
  - **Mitigación:** Cero llamadas de red obligatorias en el flujo de compilación/edición; la única red opcional es la descarga bajo demanda de paquetes/plantillas comunitarias en Beta, con caché local tras la primera descarga.
  - **Matiz desde v0.13.0 (§5n, `ADR-V0130-001`):** con la IA, los datos **pueden** salir del equipo, pero **solo** si el usuario configura un proveedor en la nube o un agente que lo use. Por defecto no hay ninguna IA; con una IA local no sale nada. La primera vez que un proyecto se va a enviar a la nube se avisa con el nombre del proveedor, las claves viven en el almacén de credenciales del sistema y DBV no tiene servidor propio ni telemetría (RNF-IA).
- **Riesgo (v0.13.0):** inyección de órdenes. Un fichero del proyecto o el README de un paquete pueden contener texto que intente dirigir a la IA (por ejemplo, borrar ficheros o sacar datos).
  - **Mitigación:** el contenido se trata como dato (RNF-IA.7); las herramientas de los modelos directos no tienen red ni ejecutan programas; nada se escribe sin revisión (RF-93); los permisos de los agentes nunca se conceden solos (RF-91.7); todo queda confinado al proyecto (RNF-IA.3).
- **Riesgo (v0.13.0):** dependencia de terceros que cambian deprisa (ACP, adaptadores de agentes, API de los proveedores).
  - **Mitigación:** la detección degrada limpiamente («no encontrado», «versión no compatible») y nunca rompe el resto de la app; cada proveedor y agente se aísla tras una interfaz propia (ver preguntas para `/plan` de §5n).

## ❓ 9. Preguntas Abiertas

- [x] ¿Reutilizamos el nombre "DBV Academic Writer" o "DBV Typst Editor"? → Resuelto: **DBV Typst Editor**.
- [x] ¿Monaco o CodeMirror 6? → Re-evaluado tras el Spec Addendum, confirmado **CodeMirror 6** — ver `ARCHITECTURE.md` §7.1.
- [x] ¿Integración con Typst vía crates embebidas o CLI? → Resuelto por instrucción explícita del usuario: **CLI oficial vendorizado como sidecar** — ver `ARCHITECTURE.md` §7.2 y `TYPST_ECOSYSTEM_RESEARCH.md`.
- [x] ¿El catálogo "Comunidad" se apoya en el registro oficial de Typst o en uno propio? → Resuelto tras investigación: **sí, exclusivamente en el `index.json` público oficial** (`packages.typst.org`), nunca en la API privada `api.typst.app` — ver `TYPST_ECOSYSTEM_RESEARCH.md` §5.
- [x] ¿Se persigue publicación en Microsoft Store / Uptodown desde el MVP, o se pospone a v1.0 como plantea el roadmap de §6? → **Superado por los hechos: publicada desde v0.3.1** (Store ID `9PCPSVTNJMP0`), con envíos actualizados en cada entrega posterior (v0.5.0 incluida). No se pospuso a v1.0.
- [ ] Tamaño exacto de la whitelist curada inicial de paquetes/plantillas comunitarios y criterio de expansión hacia el catálogo completo sin filtrar (`ARCHITECTURE.md` §6, §7.6.3). Se resuelve en `/plan` de **RF-34 (v0.6.0, §5f)**.
- [ ] ¿`.dbvt` es el nombre de extensión definitivo para el Project Archive, o solo conceptual en el Addendum? Confirmar antes de fijarlo en `tauri.conf.json` (`fileAssociations`) en `/build`.
- [x] ¿Qué motor/crate de parseo BibTeX se usa para la gestión visual de bibliografía? → **Resuelto en `/build` de v0.6.0 (Slice 46, 2026-09-11): `hayagriva`**, el mismo motor que usa el propio compilador Typst para `#bibliography()` — ver `ADR-BIBLIOGRAFIA-001` en `memory.md`.
- [ ] Spike técnico pendiente (`/build`): ¿sirve `packages.typst.org` una URL directa para las miniaturas/capturas de plantilla (`template.thumbnail`, `screenshots` de la Capa DBV) sin descargar el tarball completo? Condiciona el rendimiento de scroll del Template Explorer (`TYPST_ECOSYSTEM_RESEARCH.md` §5).
- [x] Spike técnico: ¿hay posición de página suficiente para la navegación del panel de outline? → **Resuelto en el Slice 2, a favor.** No con `typst query` (deprecado y sin serializar la posición) sino con **`typst eval`**, que devuelve nivel, texto, página y coordenada `y` por encabezado. El plan B con `tinymist` queda descartado (`TYPST_ECOSYSTEM_RESEARCH.md` §1.5).
- [ ] Diseño de UX pendiente (`/build`, Beta): cómo comunicar al usuario que el Universe Browser muestra el catálogo **cacheado en el último sincronizado**, no en vivo, cuando no hay red o el usuario no ha pulsado "Actualizar catálogo" — evitar que parezca desactualizado sin explicación (`ARCHITECTURE.md` §7.6.1).
- [x] ¿Cómo enriquecer plantillas *comunitarias* con la Capa DBV (`dbv-template.toml`) sin crear problemas de mantenimiento por desajuste de versión? → Resuelto a nivel de diseño: overlay propio de DBV indexado por `(namespace/nombre, versión)`, nunca co-ubicado en la caché de paquetes de Typst; degrada limpiamente a "sin formulario" si no hay overlay para la versión instalada — ver `ARCHITECTURE.md` §7.6.3 y riesgo en §6.

- [x] Spike técnico (S-2, 2026-09-08): ¿se puede sincronizar editor y vista previa con el compilador vendorizado como sidecar? → **Resuelto, con matices.** No por posición real de fuente: Typst **no** expone el `span` de origen (`heading.span` no existe) ni anota el SVG (sin un solo `data-*`). Sí con **anclas `#metadata` + `query`**, que devuelven payload y posición de una pasada y dejan el SVG byte a byte idéntico. Informe y mediciones en `spikes/preview-sync/README.md`; consecuencias en RF-14 a RF-16 (§5b).
- [x] ¿Cómo empaquetar Tinymist (v0.5.0)? → **Resuelto por decisión del usuario (2026-09-09): vendorizado como sidecar** por plataforma (igual que el compilador Typst), sin depender de que el usuario lo instale.
- [x] ¿Cómo integrar el control de versiones Git (v0.5.0)? → **Resuelto por decisión del usuario (2026-09-09): apoyarse en la CLI nativa de Git instalada en el sistema del usuario**, con detección en PATH y degradación limpia si no está presente.
- [x] ¿La pestaña de identificador libre de la galería (RF-26) debe previsualizar la plantilla antes de crear el documento? → **Resuelto por decisión del usuario (2026-09-09): previsualización solo bajo un control explícito** que declara que descarga y ejecuta la plantilla. Se descartaron las dos alternativas: no ofrecer previsualización (pierde el rasgo distintivo de la pantalla) y previsualizar automáticamente al validar el identificador (descargaría y ejecutaría código de terceros solo por teclear, en contra de `ARCHITECTURE.md` §6).

- [x] **¿Qué debe cubrir la integración con GitHub, y hasta dónde?** Planteada el 2026-09-09 por el usuario, que pidió expresamente **analizar todas las alternativas al inicio de v0.6.0** en vez de decidirlo sobre la marcha. Punto de partida: hoy hay integración con **Git**, no con GitHub (§5e.1) — cuatro operaciones sobre la CLI del sistema y ninguna funcionalidad específica de la plataforma. Alternativas evaluadas, de menor a mayor compromiso:
  1. **No hacer nada específico de GitHub.** Documentar bien lo que hay y dejar que el usuario clone por fuera. Coste cero; el hueco (no se puede clonar desde la app) sigue abierto.
  2. **Clonar desde una URL.** Pegar una URL en el lanzador, clonar con la CLI y abrir el proyecto. Es el hueco más evidente y el único que no necesita autenticación **si el repositorio es público**. Sobre uno privado vuelve a depender del gestor de credenciales del sistema, con el mismo límite de §5e.1.
  3. **Publicar un proyecto local en GitHub.** `git init` + crear el repositorio remoto + primer *push*. Esto ya **no se puede hacer solo con la CLI**: crear el repositorio exige la API de GitHub y, por tanto, un token.
  4. **Autenticación propia de la aplicación.** Que DBV gestione el acceso en vez de depender del gestor de credenciales del sistema. Aquí hay que elegir mecanismo (*device flow* de OAuth frente a token personal pegado a mano) y, sobre todo, **dónde se guarda el secreto**: un editor offline-first que empieza a custodiar credenciales cambia de categoría en cuanto a superficie de riesgo, y eso afecta a la ficha de privacidad de las tiendas.
  5. **Usar la CLI `gh` si está instalada**, en lugar de hablar con la API. Reutiliza la autenticación que el usuario ya tenga hecha y evita custodiar nada — coherente con la decisión de RF-19 de apoyarse en el binario del sistema— a cambio de depender de una herramienta que la mayoría no tiene instalada.

  **→ Resuelto por decisión del usuario (2026-09-11): opción 2, clonar por URL.** Es la que aporta valor sin custodiar credenciales ni atarse a una única plataforma — coherente con que RF-19 ya funciona igual con GitLab, Codeberg o SSH. Las opciones 3, 4 y 5 quedan descartadas para v0.6.0 (no reabren esta pregunta salvo petición futura explícita del usuario). Especificada como **RF-33 (§5f)**.

## 🧪 10. Criterios de Evaluación (No Deterministas)

- No aplica en el MVP: el pipeline de compilación Typst es determinista. Si en fases futuras se añaden asistentes de redacción con IA (§6, Futuro), se definirán evals en ese momento.
- **Desde v0.13.0:** la IA es el primer componente no determinista. Sus evals están definidas en **RNF-IA-EVAL** (§5n): corpus de tareas reales de Typst, la compilación como juez automático (la propuesta compila sin errores nuevos), confinamiento y trayectoria de herramientas, y comparación con y sin la documentación offline de RF-96.

## 🚀 11. Roadmap por Fases y Prioridades

Orden de prioridad para toda decisión de diseño/arquitectura (fijado explícitamente por el usuario en el Spec Addendum):

1. Reutilización máxima del código de DBV Markdown Reader.
2. Simplicidad para usuarios no técnicos.
3. Experiencia académica y educativa.
4. Plantillas.
5. Vista PDF.
6. Rendimiento.
7. Extensibilidad futura.

| Fase | Alcance | Estado |
| --- | --- | --- |
| **MVP (v0.1)** — alcance reducido aprobado | Bucle de valor completo: lanzador, proyectos (incl. apertura de proyectos existentes y operaciones Abrir/Mostrar/Recientes), asistente de creación, **4 plantillas** (Proyecto en blanco, TFG, Artículo académico, CV), editor CodeMirror 6, preview SVG en tiempo real, guardado con detección de conflicto, temas, configuración, exportación PDF, empaquetado Windows + Linux. | ✅ Completado (2026-09-05) |
| **v0.2** | **Barra de herramientas de inserción del editor (RF-13)** + Project Archive `.dbvt` (export/import) + 4 plantillas restantes (TFM, Tesis doctoral, Informe técnico, Presentación). | ✅ Completado (2026-09-05) |
| **v0.4.0** | Vista previa del **documento completo** conmutable (RF-14), **control de refresco** automático/manual (RF-15), **sincronización editor↔vista previa** por anclas (RF-16), **selector de imágenes del proyecto** en el botón Fig (RF-17) y **arrastre de imágenes** coherente con el de fuentes (RF-18). | ✅ Completado (2026-09-08) |
| **v0.5.0** | **Integración con Git y diffs side-by-side (RF-19)**, **Galería visual de plantillas con preview (RF-20)**, **LSP Tinymist vendorizado (RF-21)**, **Figuras y datos dinámicos con Python (RF-22)**, **Asistente visual de diagramas CeTZ (RF-23)**, **Robustez de entorno Windows y guardado atómico (RF-24)**, consolidación del lanzador (RF-25 a RF-27), pulido de ventana y previsualización (RF-28 a RF-30). Cerrado y publicado. | ✅ Completado (2026-09-09) |
| **v0.6.0** | **Editor WYSIWYG de diagramas (RF-31, sustituye a RF-23)**, **menú Herramientas (RF-32)**, **clonar repositorio por URL (RF-33)**, **Universe Browser completo (RF-34)**, **bibliografía visual completa (RF-35)**, **empaquetado macOS (RF-36)**, **auto-actualizador (RF-37)**, **ejecución de módulos JavaScript con `jogs` (RF-38)**. Especificado el 2026-09-11 en una sola pasada. | ✅ Completado (2026-09-13) |
| **v0.7.0** | **Filtrado del aviso de `ResizeObserver` (RF-40)**, **arreglo del separador bloqueable (RF-41)**, **zoom contextual con teclado/rueda (RF-42)**, **Guardar/PDF/PNG al menú Archivo (RF-43)**, **rediseño de la pantalla de inicio (RF-44)**, **editor de diagramas visible en Herramientas (RF-45)**, **editor visual interactivo de ecuaciones (RF-46)**, **flujogramas con decisiones (RF-47)**, **diagramas de secuencia (RF-48)**, **diagramas de Gantt (RF-49)**, **tableros Kanban (RF-50)**, **render DOT/Graphviz (RF-51)** y **botón de ayuda contextual en cada asistente (RF-52)**. Especificado el 2026-09-14 en una sola pasada; RF-50/RF-51 activados sin condición el día siguiente (v1.9); RF-52 añadido el mismo día tras probar RF-51 en vivo (v1.10). | 📋 Especificado |
| **v0.10.0** | **Formatear solo en Typst con avisos claros (RF-61)**, **resaltado de BibTeX (RF-62)**, **pulido: ocultos, números de línea y refresco visibles (RF-63)**, **guardado automático opcional e indicador de modificado (RF-64)**, **ruta corta (RF-65)** y **compilar solo el principal (RF-66)** *(si caben)*, y **análisis previo sobre el motor clásico (RF-67)**. Especificado el 2026-09-21 tras filtrar una lista externa de sugerencias. | ✅ `/ship` hecho (2026-09-22) |
| **v0.11.0** | **Conflicto externo por contenido — arregla el guardado automático (RF-68)**, **operaciones de ficheros en el panel Archivos (RF-69)**, **actualización automática de referencias al mover o renombrar (RF-70)**, **«Nuevo capítulo…» (RF-71)**, **enlaces funcionales en la vista previa (RF-72)** e **historial local de versiones (RF-73)**. Especificado el 2026-09-26 tras el uso intensivo de la 0.10.0 con un libro real. | ✅ `/ship` hecho (2026-09-26) |
| **v0.13.0** | **IA integrada y opcional** (RNF-IA): **conectar una IA local o con clave de API (RF-90)**, **agentes instalados por ACP: Claude Code, Gemini CLI, Codex, Copilot (RF-91)**, **panel de conversación con el proyecto como contexto (RF-92)**, **cambios en varios ficheros revisados y comprobados compilando (RF-93)**, **asistente con herramientas (RF-94)**, **IA en línea sobre la selección (RF-95)**, **documentación de Typst offline (RF-96)**, **panel de Problemas con «Explicar y arreglar» (RF-97)** y **visor de datos CSV/TSV (RF-98)**, con evals (RNF-IA-EVAL). Especificado el 2026-10-02 tras analizar Papers AI. | ✅ `/ship` hecho (2026-10-02), sin push |
| **v0.13.1** | **La IA con modelos locales** (§5o): **una propuesta que no existe no se anuncia como hecha (RF-99)**, **razonamiento visible y plegable con indicador de actividad (RF-100)**, **interruptor «Razonamiento» por conexión (RF-101)**, **velocidad y tiempo en el panel (RF-102)**, **aviso de modelo pequeño y de contexto insuficiente (RF-103)** y **evaluación y recomendación de modelos con datos (RF-104)** y **separación de presentación y contenido en lo que escribe la IA (RF-105)** y **«Nuevo documento» suelto sin proyecto (RF-106)**. Especificado el 2026-10-03 tras probar la 0.13.0 con Gemma 4, `qwen2.5:3b`, `qwen3:8b` y Claude; la 0.13.0 no se publica en la Store. | ⏳ `/spec` hecho (2026-10-03) |
| **Beta (v0.2–v0.4)** | Navegación estructural, asistentes de inserción con formulario (la barra en sí es v0.2, RF-13), gestión de imágenes por arrastre, modos de escritura, exportación PNG, terminal avanzado, LSP `tinymist`. | ✅ Completado / absorbido por v0.5.0–v0.6.0 |
| **v1.0** | Ecosistema completo de plantillas, exportación SVG, asistentes avanzados, Paquete Docente, publicación en stores, accesibilidad WCAG AA. | Futuro |
| **Futuro (post-1.0)** | ~~IA~~ (adelantada a v0.13.0), repositorio comunitario, sincronización, colaboración en tiempo real, integración Zotero/Mendeley, asistentes de redacción académica. | Exploratorio |

---
**Instrucción para la IA:** No pases a la fase `/plan` (más allá del análisis arquitectónico ya realizado en `ARCHITECTURE.md`) hasta que las Preguntas Abiertas críticas de §9 hayan sido resueltas con el usuario.
