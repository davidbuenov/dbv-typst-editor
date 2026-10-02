// =============================================================================
// DBV Typst Editor — Visor de la documentación de Typst offline (RF-96.6)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La misma documentación que usa la IA, ahora para el usuario y sin IA: un
// buscador (con el glosario español → inglés de `docs.rs`) y la página
// renderizada con el Markdown seguro. Los enlaces `typst:` navegan dentro del
// visor; los externos se abren en el navegador del sistema.

import { renderMarkdown } from '../ui/markdown.js';
import { t } from '../i18n/i18n.js';

/** `reference/model/table#parameters` → `{ path, anchor }`. */
export function splitTarget(target) {
  const [path, anchor] = String(target ?? '').split('#');
  return { path: path ?? '', anchor: anchor || null };
}

/**
 * Palabra de Typst bajo el cursor (`table`, `table.header`, `#figure`), sin el `#`.
 * @param {string} line
 * @param {number} column Posición dentro de la línea.
 */
export function wordAt(line, column) {
  const isWord = (c) => /[\w.-]/.test(c ?? '');
  let start = column;
  let end = column;
  while (start > 0 && isWord(line[start - 1])) start -= 1;
  while (end < line.length && isWord(line[end])) end += 1;
  const word = line.slice(start, end).replace(/^[.-]+|[.-]+$/g, '');
  return /^[A-Za-z]/.test(word) ? word : '';
}

/**
 * @param {object} deps
 * @param {{panel: HTMLElement, title: HTMLElement, input: HTMLInputElement, results: HTMLElement, content: HTMLElement, back: HTMLButtonElement}} deps.elements
 * @param {{docsSearch: Function, docsPage: Function, docsInfo: Function, openExternalUrl: Function}} deps.backend
 * @param {() => void} deps.show Muestra el panel.
 */
export function createDocsViewer({ elements, backend, show }) {
  const history = [];
  let current = null;
  let searchTimer = null;
  let searchId = 0;

  async function refreshTitle() {
    const info = await backend.docsInfo();
    elements.title.textContent = info.ok
      ? t('docs.titleVersion').replace('{version}', info.value.typstVersion)
      : t('docs.title');
  }

  function message(text) {
    elements.content.replaceChildren();
    const p = document.createElement('p');
    p.className = 'docs__message';
    p.textContent = text;
    elements.content.append(p);
  }

  function scrollToAnchor(anchor) {
    // Sin selector construido con el ancla: viene de un enlace de la página.
    const target = anchor ? [...elements.content.querySelectorAll('[data-anchor]')].find((node) => node.dataset.anchor === anchor) : null;
    if (target) target.scrollIntoView?.({ block: 'start' });
    else elements.content.scrollTop = 0;
  }

  async function showPage(target, { remember = true } = {}) {
    const { path, anchor } = splitTarget(target);
    const pagePath = path || current?.path;
    if (!pagePath) return;
    if (pagePath === current?.path) {
      scrollToAnchor(anchor);
      return;
    }
    const page = await backend.docsPage(pagePath);
    if (!page.ok) {
      message(`${t('docs.pageError')} — ${page.error.message}`);
      return;
    }
    if (remember && current) history.push(current.path);
    current = page.value;
    elements.back.disabled = history.length === 0;
    elements.content.replaceChildren(
      renderMarkdown(page.value.markdown, {
        onDocLink: (link) => showPage(link),
        onExternalLink: (url) => backend.openExternalUrl(url),
      }),
    );
    scrollToAnchor(anchor);
  }

  function renderHits(hits) {
    elements.results.replaceChildren();
    if (!hits.length) {
      const empty = document.createElement('p');
      empty.className = 'docs__empty';
      empty.textContent = t('docs.noResults');
      elements.results.append(empty);
      return;
    }
    for (const hit of hits) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'docs__hit';
      const title = document.createElement('span');
      title.className = 'docs__hit-title';
      title.textContent = hit.title;
      const heading = document.createElement('span');
      heading.className = 'docs__hit-heading';
      heading.textContent = hit.heading === hit.title ? hit.path : hit.heading;
      item.append(title, heading);
      item.addEventListener('click', () => showPage(`${hit.path}${hit.anchor ? `#${hit.anchor}` : ''}`));
      elements.results.append(item);
    }
  }

  async function search(query) {
    const id = ++searchId;
    if (!query.trim()) {
      elements.results.replaceChildren();
      return [];
    }
    const result = await backend.docsSearch(query, 20);
    if (id !== searchId) return [];
    const hits = result.ok ? result.value : [];
    renderHits(hits);
    if (!result.ok) message(`${t('docs.pageError')} — ${result.error.message}`);
    return hits;
  }

  elements.input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => search(elements.input.value), 200);
  });
  elements.input.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    clearTimeout(searchTimer);
    const hits = await search(elements.input.value);
    if (hits[0]) showPage(`${hits[0].path}${hits[0].anchor ? `#${hits[0].anchor}` : ''}`);
  });
  elements.back.addEventListener('click', () => {
    const previous = history.pop();
    if (previous) showPage(previous, { remember: false });
    elements.back.disabled = history.length === 0;
  });

  /**
   * Abre el visor: en una página, o con una búsqueda (y su primer resultado).
   * @param {{query?: string, target?: string}} [options]
   */
  async function open({ query, target } = {}) {
    show();
    refreshTitle();
    if (target) {
      await showPage(target);
    } else if (query) {
      elements.input.value = query;
      const hits = await search(query);
      if (hits[0]) await showPage(`${hits[0].path}${hits[0].anchor ? `#${hits[0].anchor}` : ''}`);
    } else if (!current) {
      await showPage('reference');
    }
    elements.input.focus();
  }

  /**
   * «Ver documentación de `word`»: si hay una página que se llama así, a ella;
   * si no, a la búsqueda.
   */
  async function openFor(word) {
    const hits = await backend.docsSearch(word, 5);
    const exact = hits.ok ? hits.value.find((hit) => hit.path.split('/').at(-1) === word.split('.').at(0)) : null;
    if (exact && !word.includes('.')) await open({ target: exact.path });
    else await open({ query: word });
  }

  return { open, openFor, showPage, search };
}
