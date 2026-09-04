# 📋 Especificaciones: DBV Typst Editor

> **Fase:** `/spec` (Especificación)
> **Estado:** En Definición — v4 (incorpora Spec Addendum, Additional Specification Clarification, TYPST CLI INTEGRATION, el research phase dedicado y el feedback de posicionamiento de producto; ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) y [`TYPST_ECOSYSTEM_RESEARCH.md`](./TYPST_ECOSYSTEM_RESEARCH.md))
> **Última Revisión:** 2026-09-04

---

## 🎯 1. Contexto y Objetivos

- **Problema:** Redactar documentos académicos y técnicos de calidad profesional (TFG, TFM, tesis, artículos, informes) hoy obliga a elegir entre LaTeX (potente pero con una curva de entrada alta, compilación lenta y sintaxis verbosa) o editores online (Overleaf, la propia web de Typst) que exigen conexión permanente. [Typst](https://typst.app) resuelve la parte del lenguaje de composición, pero el ecosistema actual (Typst Web App, VS Code + extensiones, editores genéricos) sigue orientado a **desarrolladores que piensan en sintaxis**, no a un profesor, doctorando o estudiante que piensa en "quiero escribir mi TFG", no en "quiero editar código".
- **Objetivo (Éxito):** Disponer de un editor de escritorio (Windows/Linux, macOS en fase posterior) que permita **crear y escribir documentos académicos orientados al resultado final** (no al lenguaje subyacente), con vista previa PDF en tiempo real, offline-first, con un instalador ligero y consumo de RAM comparable al de DBV Markdown Reader, reutilizando al máximo su arquitectura ya validada. El detalle técnico completo vive en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

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

> Alcance del MVP acotado explícitamente por el usuario: *proyectos, editor, PDF live preview, plantillas básicas, exportación PDF, project archive.* El resto de funcionalidades del Spec Addendum (marketplace, navegación estructural, asistentes de inserción, exportación PNG/SVG...) se difieren a Beta/v1.0 — ver §6.

- [ ] **RF-01 Lanzador orientado a tareas:** Pantalla inicial "¿Qué quieres crear hoy?" con las plantillas básicas (§RF-04) + acceso a proyectos recientes/existentes. No hay editor vacío por defecto.
- [ ] **RF-02 Modelo de Proyecto:** Crear/abrir una carpeta de proyecto con la estructura de §4. Explorador de proyecto lateral (reutilizando `filetree.js` de DBV Markdown Reader).
- [ ] **RF-03 Asistente de creación de proyecto:** Diferenciador de producto explícito (`ARCHITECTURE.md` §7.6.4) — el usuario debe sentir que crea un documento, no que inicializa un paquete. Formulario de metadatos por plantilla con campos base (nombre del proyecto, título, autor, institución, supervisor/tutor, curso/año académico) más los específicos de cada plantilla, que genera el proyecto sustituyendo variables automáticamente sobre el scaffolding oficial (`typst init`) — el usuario no edita variables a mano si no quiere.
- [ ] **RF-04 Plantillas básicas (catálogo curado inicial):** Artículo académico, TFG, TFM, Tesis doctoral, Informe técnico, CV, Presentación — instaladas de fábrica, sin marketplace todavía (eso es Beta, §6).
- [ ] **RF-05 Editor de código Typst:** CodeMirror 6 (decisión y re-evaluación completa en `ARCHITECTURE.md` §7.1) — resaltado de sintaxis Typst, autocompletado léxico/snippets, numeración de líneas, plegado de bloques, búsqueda y reemplazo, atajos de teclado profesionales, selección múltiple (multi-cursor nativo).
- [ ] **RF-06 Vista previa PDF en tiempo real:** Recompilación automática con debounce tras cada pausa de escritura; debe sentirse instantánea. Compilación vía el CLI oficial de Typst vendorizado como sidecar (no crates embebidas); estrategia técnica (SVG por página) en `ARCHITECTURE.md` §7.2-7.3.
- [ ] **RF-07 Guardar / Guardar como:** Persistencia en disco, con detección de cambios externos concurrentes (modal de conflicto heredado de DBV Markdown Reader).
- [ ] **RF-08 Temas claro/oscuro:** Reutilización directa del sistema de tokens CSS de DBV Markdown Reader.
- [ ] **RF-09 Configuración persistente:** Tema, tamaño/posición de ventana, últimos proyectos, nivel de zoom.
- [ ] **RF-10 Exportación PDF:** El PDF real, fiel al documento compilado, es el artefacto final que el usuario exporta/comparte (vía el sidecar CLI, `typst compile ... -`, sin fichero temporal — `ARCHITECTURE.md` §7.2).
- [ ] **RF-11 Project Archive (`.dbvt`):** Exportar/importar el proyecto completo como archivo portable único (para compartir, respaldar o distribuir como ejemplo/plantilla). Formato en `ARCHITECTURE.md` §7.12.
- [ ] **RF-12 Empaquetado:** Instalador para Windows (NSIS) y Linux (AppImage + .deb), reutilizando la configuración CI de DBV Markdown Reader, más el vendorizado del binario `typst` por plataforma (`ARCHITECTURE.md` §7.2, §6).

## 🚀 6. Funcionalidades — Beta y v1.0 (detalle del Spec Addendum)

Estas funcionalidades están **descritas y arquitectónicamente resueltas** (ver `ARCHITECTURE.md` §7.6–§7.14 y `TYPST_ECOSYSTEM_RESEARCH.md`) pero **fuera del MVP v0.1** por decisión explícita de alcance del usuario. Nota de encuadre: el **Universe Browser** (Package Explorer + Template Explorer, ver árbol de navegación en `ARCHITECTURE.md` §7.6.0.1) se posiciona como punto de entrada de primer nivel de la aplicación (§2), no como un add-on menor — esto afecta a su importancia de diseño y visibilidad en Beta, no reabre el acuerdo de fases ya cerrado con el usuario (el Lanzador de plantillas curadas, MVP, ya adelanta esta experiencia — ver `ARCHITECTURE.md` §7.6):

**Beta (v0.2–v0.4):**
- **Universe Browser — Package Explorer** (ecosistema distinto del de plantillas — clarificación explícita del usuario): buscar/explorar paquetes Typst por categoría, ver instalados/detalle/documentación/versión/actualizaciones, botón "Añadir al proyecto" que inserta el `#import` automáticamente. Incluye detección automática de "Paquetes usados" al abrir un proyecto, con **Versión actual / Última versión / insignia de actualización disponible** por paquete y botón "Actualizar" (reescribe el `#import`, no delega en el CLI — no existe comando equivalente). Apoyado en el `index.json` público oficial de Typst (`packages.typst.org`), no en un registro propio — ver `ARCHITECTURE.md` §7.6.2 y `TYPST_ECOSYSTEM_RESEARCH.md`.
- **Universe Browser — Template Explorer** (distinto del Package Explorer, mismo nivel de navegación — ver §7.6.0.1): pestañas Instaladas / Comunidad / Favoritas / Recientes / Actualizaciones; ficha de plantilla con imagen de vista previa, nombre, autor, versión, descripción, categoría; acción principal "Crear Proyecto" (nunca "Descargar código"). La pestaña Comunidad usa el mismo `index.json` oficial, filtrado por plantillas — ver `ARCHITECTURE.md` §7.6.3.
- Panel de navegación estructural (esquema del documento, actualizado automáticamente, navegación rápida) — crítico para tesis y documentos extensos. Vía `typst query` del sidecar CLI.
- Asistentes de inserción rápida: figura, tabla, ecuación, cita, bibliografía, bloque de código, sección, referencia cruzada — generan Typst automáticamente sin que el usuario memorice sintaxis.
- Gestión de imágenes por arrastre: copiar al proyecto, organizar, generar `figure()` con caption automáticamente.
- Gestión visual de bibliografía (`.bib`): exploración de referencias, autocompletado de citas, validación.
- Modos de trabajo: Escritura (mínima distracción), Edición (todas las herramientas), Dividido (editor + PDF), Lectura (documento final).
- Exportación PNG (página actual / rango / documento completo).
- **Terminal avanzado:** consola opcional, oculta por defecto, para ejecutar subcomandos oficiales de Typst directamente sobre el proyecto activo, con salida mostrada en la app — para usuarios avanzados; no sustituye a ningún flujo guiado. `ARCHITECTURE.md` §7.14.
- Autocompletado semántico y diagnósticos en línea vía LSP `tinymist`; sincronización de scroll editor↔preview por posición real de fuente (no por anclas).
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
- [ ] Spike técnico pendiente (`/build`): ¿el JSON de `typst query <input> heading` incluye posición de página suficiente para la navegación del panel de outline? (`TYPST_ECOSYSTEM_RESEARCH.md` §1.5).
- [ ] Diseño de UX pendiente (`/build`, Beta): cómo comunicar al usuario que el Universe Browser muestra el catálogo **cacheado en el último sincronizado**, no en vivo, cuando no hay red o el usuario no ha pulsado "Actualizar catálogo" — evitar que parezca desactualizado sin explicación (`ARCHITECTURE.md` §7.6.1).
- [x] ¿Cómo enriquecer plantillas *comunitarias* con la Capa DBV (`dbv-template.toml`) sin crear problemas de mantenimiento por desajuste de versión? → Resuelto a nivel de diseño: overlay propio de DBV indexado por `(namespace/nombre, versión)`, nunca co-ubicado en la caché de paquetes de Typst; degrada limpiamente a "sin formulario" si no hay overlay para la versión instalada — ver `ARCHITECTURE.md` §7.6.3 y riesgo en §6.

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
| **MVP (v0.1)** | RF-01 a RF-12 de §5: lanzador, proyectos, asistente de creación, 7 plantillas curadas, editor CodeMirror 6, preview SVG en tiempo real, guardado, temas, configuración, exportación PDF, Project Archive `.dbvt`, empaquetado Windows + Linux. | Planificado |
| **Beta (v0.2–v0.4)** | **Universe Browser** (Package Explorer + Template Explorer, separados a nivel de UX, sobre el `index.json` oficial de Typst Universe), navegación estructural, asistentes de inserción rápida, gestión de imágenes por arrastre, bibliografía visual, modos de escritura, exportación PNG, terminal avanzado, LSP `tinymist`, sync editor↔preview por posición real, macOS, auto-actualizador. | Futuro |
| **v1.0** | Ecosistema completo de plantillas, exportación SVG, asistentes avanzados, Paquete Docente, publicación en stores, accesibilidad WCAG AA. | Futuro |
| **Futuro (post-1.0)** | IA, repositorio comunitario, sincronización, colaboración en tiempo real, integración Zotero/Mendeley, asistentes de redacción académica. | Exploratorio |

---
**Instrucción para la IA:** No pases a la fase `/plan` (más allá del análisis arquitectónico ya realizado en `ARCHITECTURE.md`) hasta que las Preguntas Abiertas críticas de §9 hayan sido resueltas con el usuario.
