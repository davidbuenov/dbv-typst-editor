# 📋 Especificaciones: DBV Typst Editor

> **Fase:** `/spec` (Especificación)
> **Estado:** En Definición
> **Última Revisión:** 2026-09-04

---

## 🎯 1. Contexto y Objetivos

- **Problema:** Redactar documentos académicos y técnicos de calidad profesional (TFG, TFM, tesis, artículos, informes) hoy obliga a elegir entre LaTeX (potente pero con una curva de entrada alta, compilación lenta y sintaxis verbosa) o editores online (Overleaf, la propia web de Typst) que exigen conexión permanente y no ofrecen una experiencia de escritorio nativa, ligera y offline-first. [Typst](https://typst.app) resuelve la parte del lenguaje de composición (sintaxis moderna, compilación casi instantánea, tipografía de calidad LaTeX) pero carece de un editor de escritorio nativo, ligero y multiplataforma equivalente en filosofía a herramientas como Typora o el propio [DBV Markdown Reader](https://github.com/davidbuenov/dbv-md-reader).
- **Objetivo (Éxito):** Disponer de un editor de escritorio (Windows/Linux, macOS en fase posterior) que permita abrir, editar y compilar documentos `.typ` con vista previa en tiempo real, sin conexión a internet, con un instalador ligero (`<30 MB`) y consumo de RAM en reposo comparable al de DBV Markdown Reader (`<100 MB`), reutilizando la arquitectura y las lecciones ya validadas en ese proyecto hermano. El detalle completo de la arquitectura reutilizada, adaptada y descartada vive en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## 👥 2. Usuarios y Escenarios

- **Perfiles de usuario:** Profesorado universitario, personal investigador, doctorandos, estudiantes universitarios (TFG/TFM), escritores técnicos.
- **Escenarios clave:**
  - *Escenario A (redacción):* Un doctorando abre `tesis.typ`, escribe un capítulo con ecuaciones y citas bibliográficas, y ve el PDF actualizado en menos de 1 segundo tras cada pausa de escritura, sin pulsar ningún botón de "compilar".
  - *Escenario B (arranque de proyecto):* Un estudiante crea un documento nuevo a partir de la plantilla "TFG" y obtiene una estructura ya maquetada (portada, índice, capítulos, bibliografía) lista para rellenar.
  - *Escenario C (offline):* Un profesor sin conexión a internet en un vuelo sigue trabajando en su artículo sin ninguna degradación de funcionalidad (compilación 100% local, sin llamadas a servicios externos).
  - *Escenario D (multiplataforma):* El mismo documento `.typ` se abre indistintamente en Windows y Linux con resultados de compilación idénticos.

## ✨ 3. Funcionalidades Principales — MVP v0.1 (Requisitos)

- [ ] **RF-01 Abrir `.typ`:** Diálogo nativo de apertura + doble clic / "Abrir con" en el SO (asociación de fichero) + arrastrar y soltar.
- [ ] **RF-02 Nuevo documento:** Documento en blanco o a partir de plantilla (ver RF-09).
- [ ] **RF-03 Guardar / Guardar como:** Persistencia en disco del `.typ`, con detección de cambios externos concurrentes (ver riesgo en §6).
- [ ] **RF-04 Vista previa en tiempo real:** Panel de previsualización que refleja el documento compilado, actualizado automáticamente tras cada cambio (con debounce), sin acción manual del usuario.
- [ ] **RF-05 Recompilación automática:** Disparada por el watcher de fichero (para cambios externos) y por el propio editor (para cambios locales), sin bloquear la interfaz.
- [ ] **RF-06 Gestión básica de proyectos:** Apertura de una carpeta de proyecto (documento principal + assets + bibliografía), árbol de ficheros lateral (reutilizando el patrón de `filetree.js` de DBV Markdown Reader).
- [ ] **RF-07 Editor de código Typst:** Resaltado de sintaxis, numeración de líneas, plegado de bloques, autocompletado básico, búsqueda y reemplazo, atajos de teclado profesionales (ver decisión de componente en `ARCHITECTURE.md` §7.1).
- [ ] **RF-08 Temas claro/oscuro:** Reutilización directa del sistema de tokens CSS de DBV Markdown Reader.
- [ ] **RF-09 Plantillas:** Artículo académico, TFG, TFM, tesis doctoral, informe técnico, CV, presentación — selector de plantilla al crear documento nuevo.
- [ ] **RF-10 Configuración persistente:** Tema, tamaño/posición de ventana, últimos documentos, nivel de zoom.
- [ ] **RF-11 Empaquetado:** Instalador para Windows (NSIS) y Linux (AppImage + .deb), reutilizando la configuración CI de DBV Markdown Reader.

## 🚫 4. Fuera de alcance (v0.1)

- [ ] Empaquetado macOS (se aborda en Beta, ver roadmap §9).
- [ ] Colaboración en tiempo real / multiusuario.
- [ ] Integración con gestores de referencias externos (Zotero, Mendeley) más allá de `.bib` local.
- [ ] LSP completo de Typst (`tinymist`) con diagnósticos en línea — el autocompletado del MVP es léxico/basado en snippets, no semántico (ver Beta en roadmap).
- [ ] Exportación a formatos distintos de PDF (Word, HTML) — Typst no lo soporta de forma nativa hoy.
- [ ] Versión Android/iOS.
- [ ] Sincronización en la nube.

## ⚠️ 5. Riesgos y Mitigación

- **Riesgo:** El editor de código (RF-07) es la mayor brecha respecto a DBV Markdown Reader, que solo tiene un `<textarea>` plano sin resaltado ni autocompletado real (ver hallazgo crítico en `ARCHITECTURE.md` §3.7). No hay componente que "reutilizar sin cambios" aquí.
  - **Mitigación:** Adoptar CodeMirror 6 desde el día 1 del MVP en lugar de intentar evolucionar el `<textarea>` existente (ver justificación técnica en `ARCHITECTURE.md` §7.1).
- **Riesgo:** Integrar el compilador Typst (¿CLI externo vs. crate Rust embebido?) es una decisión arquitectónica con impacto directo en tamaño de instalador, offline-first y velocidad de recompilación.
  - **Mitigación:** Decisión tomada y justificada en `ARCHITECTURE.md` §7.2 (crates Rust embebidos, no CLI sidecar).
- **Riesgo de Seguridad y Privacidad (IA/Datos):** Ninguno de los datos del usuario (documentos académicos) debe salir del equipo — coherente con el objetivo offline-first.
  - **Mitigación:** Cero llamadas de red en el flujo de compilación/edición; el único código de red heredado de DBV Markdown Reader (descarga de `.md` remotos vía `ureq`) se elimina por completo (ver `ARCHITECTURE.md` §5).

## ❓ 6. Preguntas Abiertas

- [x] ¿Reutilizamos el nombre de proyecto "DBV Academic Writer" o "DBV Typst Editor"? → Resuelto: **DBV Typst Editor** es el nombre oficial del producto; "Academic and technical writing made simple. Powered by Typst." queda como tagline.
- [ ] ¿Se persigue publicación en Microsoft Store / Uptodown desde el MVP, o se pospone a Beta/1.0 como en DBV Markdown Reader? (Afecta a si se genera ya el checklist de `MARKETPLACE_PUBLISHING.md`.)
- [ ] ¿Qué motor de bibliografía Typst se documenta como estándar en las plantillas académicas (`bibliography()` nativo con `.bib`/`.yaml`)? Se resolverá al diseñar la plantilla TFG/Tesis en `/build`.

## 🧪 7. Criterios de Evaluación (No Deterministas)

- No aplica en el MVP: el pipeline de compilación Typst es determinista (no hay componentes de IA/LLM en el propio producto). Si en fases futuras se añade autocompletado asistido por IA, se definirán evals en ese momento.

## 🗺️ 8. Público Objetivo y Visión de Producto

DBV Typst Editor se dirige a profesorado, personal investigador, doctorandos, estudiantes universitarios y escritores técnicos que necesitan generar PDFs profesionales con Typst, con una experiencia de escritura ligera, rápida, offline-first y multiplataforma — misma filosofía que DBV Markdown Reader, aplicada a la edición (no solo lectura) de un lenguaje de composición tipográfica en lugar de Markdown.

## 🚀 9. Roadmap por Fases

| Fase | Alcance | Estado |
| --- | --- | --- |
| **MVP (v0.1)** | RF-01 a RF-11 de §3. Editor CodeMirror 6 + resaltado Typst, compilación embebida vía crates Rust, preview SVG en tiempo real, 7 plantillas base, temas claro/oscuro, empaquetado Windows + Linux. | Planificado |
| **Beta (v0.2–v0.4)** | Autocompletado semántico y diagnósticos en línea vía LSP `tinymist`, sincronización de scroll editor↔preview por posición real (no por anclas de heading como en DBV Markdown Reader), exportación PDF con progreso, gestión avanzada de proyectos multi-fichero (`#import`), empaquetado macOS, auto-actualizador (`tauri-plugin-updater`, patrón ya validado). | Futuro |
| **v1.0** | Publicación en Microsoft Store / Uptodown, plantillas ampliables por el usuario (marketplace de plantillas propio o comunitario), soporte de paquetes Typst de terceros (`@preview/*`), snippets de citas bibliográficas asistidos, accesibilidad WCAG AA auditada. | Futuro |
| **Futuro (post-1.0)** | Colaboración en tiempo real, integración con Zotero/Mendeley, revisión de cambios (diff visual entre versiones), exportación a HTML si Typst lo soporta oficialmente, versión Android. | Exploratorio |

---
**Instrucción para la IA:** No pases a la fase `/plan` (más allá del análisis arquitectónico ya realizado en `ARCHITECTURE.md`) hasta que las Preguntas Abiertas críticas de §6 hayan sido resueltas con el usuario.
