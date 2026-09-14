// =============================================================================
// DBV Typst Editor — Punto de acceso global al panel de Ayuda (RF-52)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cada asistente de esta versión (diagrama, ecuación, secuencia, Gantt,
// Kanban, DOT) gana un botón "?" en su cabecera — feedback directo del
// usuario tras probar el asistente de DOT: sin ayuda visual ninguna (a
// diferencia de los otros asistentes, que sí construyen la sintaxis por ti),
// alguien que no conoce el lenguaje DOT se queda sin saber qué escribir.
//
// El botón lo añade `registerPanel.js` (`ensurePanelChrome`), que ya
// construye la cabecera de TODO panel de tipo diálogo — igual que el botón de
// cierre. Pero `registerPanel.js` no puede importar `help.js` directamente:
// `help.js` construye el CONTENIDO de la Ayuda (`helpContent.js`), y crear
// ese enlace en los dos sentidos sería un ciclo de imports sin necesidad real.
// Este módulo intermedio es el mismo patrón que ya usa `t()` de `i18n.js`
// dentro de esa misma factoría: un punto de acceso que se registra una vez al
// arrancar (`wireHelpPanel()` en `main.js`) y que cualquier otro módulo puede
// llamar sin conocer quién lo implementa.

/** @type {((sectionId: string) => void) | null} */
let trigger = null;

/** Registrado una vez por `wireHelpPanel()` al arrancar la app. */
export function setHelpTrigger(fn) {
  trigger = fn;
}

/**
 * Abre el panel de Ayuda centrado en `sectionId`. Antes de que `main.js`
 * termine de arrancar no hace nada — ningún botón "?" es clicable antes de
 * eso, así que en la práctica siempre hay un `trigger` registrado.
 */
export function openHelpSection(sectionId) {
  trigger?.(sectionId);
}
