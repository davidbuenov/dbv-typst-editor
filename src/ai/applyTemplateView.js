// =============================================================================
// DBV Typst Editor — «Aplicar plantilla…»: aplicarla y revisar la propuesta (RF-116)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Herramientas › «Aplicar plantilla…» abre la galería de plantillas de «Nuevo documento» en modo
// «aplicar» (`launcher/templateGalleryModal.js`): una sola galería, con vista previa. Lo que elige el
// usuario llega aquí, y este diálogo hace lo que viene después, hacia una propuesta revisable (RF-93):
//
//   · DBV hace lo mecánico (`templateApply.js`) y enseña la propuesta aquí mismo, con su comprobación
//     y, si hace falta, el bloque de «Paquetes que se descargarán».
//   · «Que la IA lo adapte»: con una IA conectada, le pide el trabajo completo (RF-110).
//
// Es una acción del usuario: leer la documentación de la plantilla que ELIGE no es la IA tocando la
// red. Todo el texto ajeno entra por `textContent` (R-A4).

import { t } from '../i18n/i18n.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * La plantilla ya viene ELEGIDA en la galería de plantillas (la misma de «Nuevo documento»: lista, vista previa
 * maquetada, buscador y dirección libre). Este diálogo solo hace lo que viene después: aplicarla al documento abierto
 * y enseñar la propuesta para revisarla (RF-116, RF-93).
 *
 * @param {object} deps
 * @param {HTMLElement} deps.panel Contenedor del diálogo (ya registrado como panel).
 * @param {HTMLElement} deps.body Donde se pinta.
 * @param {() => void} deps.close
 */
export function createApplyTemplateView({ panel, body, close }) {
  let handlers = null;
  let hit = null;
  let runId = 0;

  const intro = el('p', 'ai-template__intro', t('ai.applyTemplateIntro'));
  const chosen = el('div', 'ai-template__results');
  const status = el('p', 'ai-template__status');
  status.setAttribute('aria-live', 'polite');
  const actions = el('div', 'ai-template__actions');
  const askAi = el('button', 'button button--compact hidden', t('ai.applyTemplateAskAi'));
  askAi.type = 'button';
  const cancel = el('button', 'button button--compact button--ghost', t('action.close'));
  cancel.type = 'button';
  cancel.addEventListener('click', close);
  actions.append(askAi, cancel);
  const cardHost = el('div', 'ai-template__card');
  body.replaceChildren(intro, chosen, status, actions, cardHost);

  function setStatus(text, tone = '') {
    status.className = `ai-template__status${tone ? ` is-${tone}` : ''}`;
    status.textContent = text;
  }

  askAi.addEventListener('click', () => {
    if (hit && handlers?.onAskAi) handlers.onAskAi(hit);
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  return {
    /**
     * Aplica `template` (`{id, description?}`) y enseña la propuesta. `hasAi`: hay una IA conectada, así que se
     * ofrece pedirle el trabajo completo.
     */
    async open({ template, hasAi, onApply, onAskAi }) {
      handlers = { onApply, onAskAi };
      hit = template;
      const run = (runId += 1);
      askAi.classList.toggle('hidden', !hasAi);
      cardHost.replaceChildren();
      chosen.replaceChildren(el('code', 'ai-package__id', template.id));
      setStatus(t('ai.applyTemplateReading').replace('{id}', template.id));
      const outcome = await onApply(template);
      if (run !== runId) return;
      if (outcome?.error) setStatus(outcome.error, 'error');
      else {
        setStatus(t('ai.applyTemplateReview'));
        cardHost.replaceChildren(outcome.card);
      }
    },
  };
}
