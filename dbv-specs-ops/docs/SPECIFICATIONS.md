# 📋 Especificaciones: DBV Typst Editor

> **Fase:** `/spec` (Especificación) → **v0.5.0 especificada (reabierta y ampliada)**
> **Estado:** 🔒 **CONGELADO v1.6 — 2026-09-09.** v1.6 añade **RF-30** a §5e (la cabecera agrupa sus cinco acciones de fichero en un solo menú), propuesto por el usuario tras ver la cabecera con un proyecto abierto.
> **v1.5:** v1.4 consolidó el lanzador (§5d, RF-25 a RF-27, con la precisión de RF-26 criterio 10 añadida el mismo día). **v1.5 añade §5e** —RF-28 (chincheta de ventana encima, portada de DBV Markdown Reader) y RF-29 (ver la previsualización de plantilla a tamaño grande)— tras probar el usuario la aplicación construida, más **§5e.1, que documenta el alcance real de la integración con Git** y por qué NO es integración con GitHub. Ver `ADR-VENTANA-001` en `memory.md`. (baseline de especificación v0.5.0, ampliada). v1.3 especificó el salto a productividad profesional y robustez (v0.5.0): Integración con Git y resolución visual de conflictos (RF-19), Galería visual de plantillas con previsualización (RF-20), Inteligencia de código con Tinymist LSP vendorizado (RF-21), Figuras y datos dinámicos con Python (RF-22), Asistente visual de diagramas CeTZ (RF-23), y Robustez de entorno y guardado atómico (RF-24). **v1.4 reabre ese `/spec`, a decisión del usuario y antes de entregar la versión, para consolidar el lanzador** (§5d): Lanzador de una sola vía (RF-25), Galería unificada de creación de documentos (RF-26) y Tokens semánticos de estado (RF-27). El motivo es que `/build` de v0.5.0 dejó **tres** superficies distintas para elegir plantilla; ver `ADR-LANZADOR-001` en `memory.md`.
> **Regla de congelación:** a partir de aquí, cualquier cambio de alcance o de requisito exige (1) registrarlo como ADR en `memory.md`, (2) actualizar este documento con nueva versión, y (3) revisar el impacto en `implementation_plan.md`. No se modifican requisitos "al vuelo" durante `/build`.
> **Documento de diseño:** el sistema visual que rige §5d está en [`DESIGN.md`](./DESIGN.md), escrito el 2026-09-09 (deuda documental abierta desde el `/spec` original, saldada al abordar este rediseño).
> **Última Revisión:** 2026-09-09

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

- [ ] **RF-16 Sincronización editor ↔ vista previa (bidireccional).** Doble clic en la vista previa
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
clonó por su cuenta. Cubrirlo es trabajo de v0.6.0 (ver §9).

## 🚀 6. Funcionalidades — Beta y v1.0 (detalle del Spec Addendum)

Estas funcionalidades están **descritas y arquitectónicamente resueltas** (ver `ARCHITECTURE.md` §7.6–§7.14 y `TYPST_ECOSYSTEM_RESEARCH.md`) pero **fuera del MVP v0.1** por decisión explícita de alcance del usuario. Nota de encuadre: el **Universe Browser** (Package Explorer + Template Explorer, ver árbol de navegación en `ARCHITECTURE.md` §7.6.0.1) se posiciona como punto de entrada de primer nivel de la aplicación (§2), no como un add-on menor — esto afecta a su importancia de diseño y visibilidad en Beta, no reabre el acuerdo de fases ya cerrado con el usuario (el Lanzador de plantillas curadas, MVP, ya adelanta esta experiencia — ver `ARCHITECTURE.md` §7.6):

**Beta (v0.2–v0.4):**
- **Universe Browser — Package Explorer** (ecosistema distinto del de plantillas — clarificación explícita del usuario): buscar/explorar paquetes Typst por categoría, ver instalados/detalle/documentación/versión/actualizaciones, botón "Añadir al proyecto" que inserta el `#import` automáticamente. Incluye detección automática de "Paquetes usados" al abrir un proyecto, con **Versión actual / Última versión / insignia de actualización disponible** por paquete y botón "Actualizar" (reescribe el `#import`, no delega en el CLI — no existe comando equivalente). Apoyado en el `index.json` público oficial de Typst (`packages.typst.org`), no en un registro propio — ver `ARCHITECTURE.md` §7.6.2 y `TYPST_ECOSYSTEM_RESEARCH.md`.
- **Universe Browser — Template Explorer** (distinto del Package Explorer, mismo nivel de navegación — ver §7.6.0.1): pestañas Instaladas / Comunidad / Favoritas / Recientes / Actualizaciones; ficha de plantilla con imagen de vista previa, nombre, autor, versión, descripción, categoría; acción principal "Crear Proyecto" (nunca "Descargar código"). La pestaña Comunidad usa el mismo `index.json` oficial, filtrado por plantillas — ver `ARCHITECTURE.md` §7.6.3.
- Panel de navegación estructural (esquema del documento, actualizado automáticamente, navegación rápida) — crítico para tesis y documentos extensos. Vía `typst query` del sidecar CLI.
- Asistentes de inserción **con formulario** (la barra de botones en sí es **v0.2**, RF-13): galería de símbolos matemáticos con búsqueda, diálogo de tabla con dimensiones y alineación, inserción de figura con selector de fichero y copia al proyecto —ampliado en **RF-17** (§5b) a un desplegable con las imágenes que ya tiene el proyecto, por coherencia con el de citas—, cita con autocompletado sobre las claves del `.bib`. Es la capa que necesita UI y datos propios por encima del simple emisor de marcado de RF-13.
- Gestión de imágenes por arrastre: copiar al proyecto, organizar, generar `figure()` con caption automáticamente. *Entregado en el Slice 19, pero restringido a soltar dentro del panel del editor; **RF-18** (§5b) lo iguala con el arrastre de fuentes, que acepta la ventana entera.*
- Gestión visual de bibliografía (`.bib`): exploración de referencias, autocompletado de citas, validación.
- Modos de trabajo: Escritura (mínima distracción), Edición (todas las herramientas), Dividido (editor + PDF), Lectura (documento final).
- Exportación PNG (página actual / rango / documento completo).
- **Terminal avanzado:** consola opcional, oculta por defecto, para ejecutar subcomandos oficiales de Typst directamente sobre el proyecto activo, con salida mostrada en la app — para usuarios avanzados; no sustituye a ningún flujo guiado. `ARCHITECTURE.md` §7.14.
- Autocompletado semántico y diagnósticos en línea vía LSP `tinymist`. ~~Sincronización de scroll editor↔preview por posición real de fuente (no por anclas).~~ **Sustituido el 2026-09-08 por RF-16 (§5b):** el Spike S-2 demuestra que no existe posición real de fuente accesible desde el sidecar —ni `span` en el API de scripting ni anotación en el SVG— y §9 ya había descartado `tinymist` para esto mismo. La sincronización se implementa **con anclas**. `tinymist` sigue siendo candidato para el autocompletado semántico y, en el futuro, para elevar la precisión del sync de bloque a línea.
- Empaquetado macOS, auto-actualizador (`tauri-plugin-updater`).

**v1.0:**
- Ecosistema completo de plantillas (categorías ampliadas: Académico, Docencia, Profesional, Presentaciones — ver listado completo del Spec Addendum en `ARCHITECTURE.md` §7.6).
- Exportación SVG.
- Asistentes avanzados y experiencia académica completa.
- Publicación en Microsoft Store / Uptodown, accesibilidad WCAG AA auditada.
- Paquete Docente (export combinado PDF+SVG+PNG+recursos listo para Moodle/Teams/SharePoint).

**Futuro (post-1.0, exploratorio):** IA (asistentes de redacción académica), repositorio comunitario propio, sincronización, colaboración en tiempo real, integración con Zotero/Mendeley.

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

## ❓ 9. Preguntas Abiertas

- [x] ¿Reutilizamos el nombre "DBV Academic Writer" o "DBV Typst Editor"? → Resuelto: **DBV Typst Editor**.
- [x] ¿Monaco o CodeMirror 6? → Re-evaluado tras el Spec Addendum, confirmado **CodeMirror 6** — ver `ARCHITECTURE.md` §7.1.
- [x] ¿Integración con Typst vía crates embebidas o CLI? → Resuelto por instrucción explícita del usuario: **CLI oficial vendorizado como sidecar** — ver `ARCHITECTURE.md` §7.2 y `TYPST_ECOSYSTEM_RESEARCH.md`.
- [x] ¿El catálogo "Comunidad" se apoya en el registro oficial de Typst o en uno propio? → Resuelto tras investigación: **sí, exclusivamente en el `index.json` público oficial** (`packages.typst.org`), nunca en la API privada `api.typst.app` — ver `TYPST_ECOSYSTEM_RESEARCH.md` §5.
- [ ] ¿Se persigue publicación en Microsoft Store / Uptodown desde el MVP, o se pospone a v1.0 como plantea el roadmap de §6?
- [ ] Tamaño exacto de la whitelist curada inicial de paquetes/plantillas comunitarios y criterio de expansión hacia el catálogo completo sin filtrar (`ARCHITECTURE.md` §6, §7.6.3).
- [ ] ¿`.dbvt` es el nombre de extensión definitivo para el Project Archive, o solo conceptual en el Addendum? Confirmar antes de fijarlo en `tauri.conf.json` (`fileAssociations`) en `/build`.
- [ ] ¿Qué motor/crate de parseo BibTeX se usa para la gestión visual de bibliografía (Beta)? Se resolverá en `/plan` de esa fase.
- [ ] Spike técnico pendiente (`/build`): ¿sirve `packages.typst.org` una URL directa para las miniaturas/capturas de plantilla (`template.thumbnail`, `screenshots` de la Capa DBV) sin descargar el tarball completo? Condiciona el rendimiento de scroll del Template Explorer (`TYPST_ECOSYSTEM_RESEARCH.md` §5).
- [x] Spike técnico: ¿hay posición de página suficiente para la navegación del panel de outline? → **Resuelto en el Slice 2, a favor.** No con `typst query` (deprecado y sin serializar la posición) sino con **`typst eval`**, que devuelve nivel, texto, página y coordenada `y` por encabezado. El plan B con `tinymist` queda descartado (`TYPST_ECOSYSTEM_RESEARCH.md` §1.5).
- [ ] Diseño de UX pendiente (`/build`, Beta): cómo comunicar al usuario que el Universe Browser muestra el catálogo **cacheado en el último sincronizado**, no en vivo, cuando no hay red o el usuario no ha pulsado "Actualizar catálogo" — evitar que parezca desactualizado sin explicación (`ARCHITECTURE.md` §7.6.1).
- [x] ¿Cómo enriquecer plantillas *comunitarias* con la Capa DBV (`dbv-template.toml`) sin crear problemas de mantenimiento por desajuste de versión? → Resuelto a nivel de diseño: overlay propio de DBV indexado por `(namespace/nombre, versión)`, nunca co-ubicado en la caché de paquetes de Typst; degrada limpiamente a "sin formulario" si no hay overlay para la versión instalada — ver `ARCHITECTURE.md` §7.6.3 y riesgo en §6.

- [x] Spike técnico (S-2, 2026-09-08): ¿se puede sincronizar editor y vista previa con el compilador vendorizado como sidecar? → **Resuelto, con matices.** No por posición real de fuente: Typst **no** expone el `span` de origen (`heading.span` no existe) ni anota el SVG (sin un solo `data-*`). Sí con **anclas `#metadata` + `query`**, que devuelven payload y posición de una pasada y dejan el SVG byte a byte idéntico. Informe y mediciones en `spikes/preview-sync/README.md`; consecuencias en RF-14 a RF-16 (§5b).
- [x] ¿Cómo empaquetar Tinymist (v0.5.0)? → **Resuelto por decisión del usuario (2026-09-09): vendorizado como sidecar** por plataforma (igual que el compilador Typst), sin depender de que el usuario lo instale.
- [x] ¿Cómo integrar el control de versiones Git (v0.5.0)? → **Resuelto por decisión del usuario (2026-09-09): apoyarse en la CLI nativa de Git instalada en el sistema del usuario**, con detección en PATH y degradación limpia si no está presente.
- [x] ¿La pestaña de identificador libre de la galería (RF-26) debe previsualizar la plantilla antes de crear el documento? → **Resuelto por decisión del usuario (2026-09-09): previsualización solo bajo un control explícito** que declara que descarga y ejecuta la plantilla. Se descartaron las dos alternativas: no ofrecer previsualización (pierde el rasgo distintivo de la pantalla) y previsualizar automáticamente al validar el identificador (descargaría y ejecutaría código de terceros solo por teclear, en contra de `ARCHITECTURE.md` §6).

- [ ] **¿Qué debe cubrir la integración con GitHub, y hasta dónde?** Planteada el 2026-09-09 por el usuario, que pidió expresamente **analizar todas las alternativas al inicio de v0.6.0** en vez de decidirlo sobre la marcha. Punto de partida: hoy hay integración con **Git**, no con GitHub (§5e.1) — cuatro operaciones sobre la CLI del sistema y ninguna funcionalidad específica de la plataforma. Alternativas a evaluar, de menor a mayor compromiso:
  1. **No hacer nada específico de GitHub.** Documentar bien lo que hay y dejar que el usuario clone por fuera. Coste cero; el hueco (no se puede clonar desde la app) sigue abierto.
  2. **Clonar desde una URL.** Pegar una URL en el lanzador, clonar con la CLI y abrir el proyecto. Es el hueco más evidente y el único que no necesita autenticación **si el repositorio es público**. Sobre uno privado vuelve a depender del gestor de credenciales del sistema, con el mismo límite de §5e.1.
  3. **Publicar un proyecto local en GitHub.** `git init` + crear el repositorio remoto + primer *push*. Esto ya **no se puede hacer solo con la CLI**: crear el repositorio exige la API de GitHub y, por tanto, un token.
  4. **Autenticación propia de la aplicación.** Que DBV gestione el acceso en vez de depender del gestor de credenciales del sistema. Aquí hay que elegir mecanismo (*device flow* de OAuth frente a token personal pegado a mano) y, sobre todo, **dónde se guarda el secreto**: un editor offline-first que empieza a custodiar credenciales cambia de categoría en cuanto a superficie de riesgo, y eso afecta a la ficha de privacidad de las tiendas.
  5. **Usar la CLI `gh` si está instalada**, en lugar de hablar con la API. Reutiliza la autenticación que el usuario ya tenga hecha y evita custodiar nada — coherente con la decisión de RF-19 de apoyarse en el binario del sistema— a cambio de depender de una herramienta que la mayoría no tiene instalada.

  **Preguntas que la evaluación debe responder, no solo listar:** ¿cuántos usuarios de este producto usan Git siquiera, siendo un editor pensado para quien "quiere escribir su TFG" y no para desarrolladores? ¿Justifica eso custodiar credenciales? ¿Y encaja atarse a **una** plataforma en un producto que hasta ahora funciona igual con GitLab, Codeberg o un remoto por SSH? La opción 2 es la única que aporta valor sin responder a ninguna de esas preguntas.

## 🧪 10. Criterios de Evaluación (No Deterministas)

- No aplica en el MVP: el pipeline de compilación Typst es determinista. Si en fases futuras se añaden asistentes de redacción con IA (§6, Futuro), se definirán evals en ese momento.

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
| **v0.5.0** | **Integración con Git y diffs side-by-side (RF-19)**, **Galería visual de plantillas con preview (RF-20)**, **LSP Tinymist vendorizado (RF-21)**, **Figuras y datos dinámicos con Python (RF-22)**, **Asistente visual de diagramas CeTZ (RF-23)**, **Robustez de entorno Windows y guardado atómico (RF-24)**. Especificado el 2026-09-09. | 📋 Especificado |
| **Beta (v0.2–v0.4)** | **Universe Browser** (Package Explorer + Template Explorer, separados a nivel de UX, sobre el `index.json` oficial de Typst Universe), navegación estructural, asistentes de inserción con formulario (la barra en sí es v0.2, RF-13), gestión de imágenes por arrastre, bibliografía visual, modos de escritura, exportación PNG, terminal avanzado, LSP `tinymist`, macOS, auto-actualizador. | En evolución |
| **v1.0** | Ecosistema completo de plantillas, exportación SVG, asistentes avanzados, Paquete Docente, publicación en stores, accesibilidad WCAG AA. | Futuro |
| **Futuro (post-1.0)** | IA, repositorio comunitario, sincronización, colaboración en tiempo real, integración Zotero/Mendeley, asistentes de redacción académica. | Exploratorio |

---
**Instrucción para la IA:** No pases a la fase `/plan` (más allá del análisis arquitectónico ya realizado en `ARCHITECTURE.md`) hasta que las Preguntas Abiertas críticas de §9 hayan sido resueltas con el usuario.
