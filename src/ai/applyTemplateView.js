// =============================================================================
// DBV Typst Editor — «Aplicar plantilla…»: elegir la plantilla (RF-116.1)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El diálogo de Herramientas › «Aplicar plantilla…»: un buscador sobre el catálogo de Typst
// Universe (solo plantillas), con la plantilla elegida y dos caminos hacia el MISMO resultado,
// una propuesta revisable (RF-93):
//
//   · «Aplicar la plantilla»: DBV hace lo mecánico (`templateApply.js`) y enseña la propuesta aquí
//     mismo, con su comprobación y, si hace falta, el bloque de «Paquetes que se descargarán».
//   · «Que la IA lo adapte»: con una IA conectada, le pide el trabajo completo (RF-110).
//
// Es una acción del usuario: buscar y leer la documentación de la plantilla que ELIGE no es la IA
// tocando la red. Todo el texto ajeno entra por `textContent` (R-A4).

import { t } from '../i18n/i18n.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Búsquedas de un clic que cubren lo que la gente suele pedir. */
const SUGGESTIONS = ['ieee', 'thesis', 'poster', 'cv', 'report', 'slides'];

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panel Contenedor del diálogo (ya registrado como panel).
 * @param {HTMLElement} deps.body Donde se pinta.
 * @param {{aiUniverseSearch: Function, aiUniverseRefresh: Function}} deps.backend
 * @param {() => void} deps.close
 */
export function createApplyTemplateView({ panel, body, backend, close }) {
  let handlers = null;
  let selected = null;
  let runId = 0;

  const intro = el('p', 'ai-template__intro', t('ai.applyTemplateIntro'));
  const form = el('form', 'ai-template__search');
  const input = el('input', 'form-row__input');
  input.type = 'search';
  input.placeholder = t('ai.applyTemplatePlaceholder');
  input.setAttribute('aria-label', t('ai.applyTemplatePlaceholder'));
  const searchButton = el('button', 'button button--compact', t('ai.applyTemplateSearch'));
  searchButton.type = 'submit';
  form.append(input, searchButton);
  const chips = el('div', 'ai-template__chips');
  for (const word of SUGGESTIONS) {
    const chip = el('button', 'button button--compact button--ghost', word);
    chip.type = 'button';
    chip.addEventListener('click', () => {
      input.value = word;
      search();
    });
    chips.append(chip);
  }
  const status = el('p', 'ai-template__status');
  status.setAttribute('aria-live', 'polite');
  const results = el('div', 'ai-template__results');
  results.setAttribute('role', 'radiogroup');
  results.setAttribute('aria-label', t('ai.applyTemplateResults'));
  const actions = el('div', 'ai-template__actions');
  const apply = el('button', 'button button--primary button--compact', t('ai.applyTemplateApply'));
  apply.type = 'button';
  apply.disabled = true;
  const askAi = el('button', 'button button--compact hidden', t('ai.applyTemplateAskAi'));
  askAi.type = 'button';
  askAi.disabled = true;
  const cancel = el('button', 'button button--compact button--ghost', t('action.close'));
  cancel.type = 'button';
  cancel.addEventListener('click', close);
  actions.append(apply, askAi, cancel);
  const cardHost = el('div', 'ai-template__card');
  body.replaceChildren(intro, form, chips, status, results, actions, cardHost);

  function setStatus(text, tone = '') {
    status.className = `ai-template__status${tone ? ` is-${tone}` : ''}`;
    status.textContent = text;
  }

  function select(hit) {
    selected = hit;
    apply.disabled = false;
    askAi.disabled = false;
    cardHost.replaceChildren();
  }

  function renderResults(hits) {
    results.replaceChildren();
    selected = null;
    apply.disabled = true;
    askAi.disabled = true;
    for (const hit of hits) {
      const row = el('label', 'ai-template__row');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'ai-template';
      radio.addEventListener('change', () => select(hit));
      const text = el('span', 'ai-template__text');
      text.append(el('code', 'ai-package__id', hit.id), el('span', 'ai-template__desc', hit.description), el('span', 'ai-package__meta', [hit.license, hit.updated].filter(Boolean).join(' · ')));
      row.append(radio, text);
      results.append(row);
    }
  }

  async function search() {
    const query = input.value.trim();
    const run = (runId += 1);
    if (!query) {
      setStatus(t('ai.applyTemplateEmpty'));
      renderResults([]);
      return;
    }
    setStatus(t('ai.applyTemplateSearching'));
    const found = await backend.aiUniverseSearch(query, 'template', 8);
    if (run !== runId) return;
    if (!found.ok || found.value.status === 'noCatalog') {
      renderResults([]);
      setStatus(t('ai.applyTemplateNoCatalog'), 'error');
      const download = el('button', 'button button--compact', t('ai.applyTemplateDownloadCatalog'));
      download.type = 'button';
      download.addEventListener('click', async () => {
        download.disabled = true;
        setStatus(t('ai.step.universeRefresh'));
        const refreshed = await backend.aiUniverseRefresh();
        if (!refreshed.ok) setStatus(`${t('ai.applyTemplateCatalogFailed')} ${refreshed.error?.message ?? ''}`, 'error');
        else search();
      });
      results.append(download);
      return;
    }
    renderResults(found.value.hits);
    setStatus(found.value.hits.length ? t('ai.applyTemplateFound').replace('{n}', String(found.value.hits.length)) : t('ai.applyTemplateNone').replace('{query}', query));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    search();
  });
  apply.addEventListener('click', async () => {
    if (!selected || !handlers) return;
    apply.disabled = true;
    setStatus(t('ai.applyTemplateReading').replace('{id}', selected.id));
    const outcome = await handlers.onApply(selected);
    apply.disabled = false;
    if (outcome?.error) setStatus(outcome.error, 'error');
    else {
      setStatus(t('ai.applyTemplateReview'));
      cardHost.replaceChildren(outcome.card);
    }
  });
  askAi.addEventListener('click', () => {
    if (selected && handlers?.onAskAi) handlers.onAskAi(selected);
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  return {
    /** Abre el diálogo. `hasAi`: hay una IA conectada, así que se ofrece pedirle el trabajo completo. */
    open({ hasAi, onApply, onAskAi }) {
      handlers = { onApply, onAskAi };
      askAi.classList.toggle('hidden', !hasAi);
      cardHost.replaceChildren();
      setStatus(t('ai.applyTemplateEmpty'));
      renderResults([]);
      input.value = '';
      input.focus();
    },
  };
}
