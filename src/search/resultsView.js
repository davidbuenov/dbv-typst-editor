// =============================================================================
// DBV Typst Editor — Lista de resultados por fichero (RF-77.3, RF-78.3)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La usan «Buscar referencias» (Mayús+F12) y la búsqueda en el proyecto: grupos
// plegables por fichero, con el número de resultados, y una fila por resultado
// con su línea de contexto y el tramo resaltado. Un clic la abre en su pestaña.

/**
 * @param {object} deps
 * @param {HTMLElement} deps.containerEl
 * @param {(path: string, item: {line: number, range: any}) => void} deps.onOpen
 */
export function createResultsView({ containerEl, onOpen }) {
  /** Fila: número de línea, texto con el tramo resaltado y acciones opcionales. */
  function renderItem(group, item, itemActions) {
    const row = document.createElement('div');
    row.className = 'search-hit';
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    const number = document.createElement('span');
    number.className = 'search-hit__line';
    number.textContent = String(item.line);
    const text = document.createElement('span');
    text.className = 'search-hit__text';
    // Recorte por la izquierda para que el tramo se vea en líneas largas.
    const cut = Math.max(0, item.from - 40);
    const mark = document.createElement('mark');
    mark.textContent = item.text.slice(item.from, item.to);
    text.append((cut > 0 ? '…' : '') + item.text.slice(cut, item.from).trimStart(), mark, item.text.slice(item.to));
    if (item.replacement !== undefined) {
      const replacement = document.createElement('ins');
      replacement.className = 'search-hit__replacement';
      replacement.textContent = item.replacement;
      mark.after(replacement);
      mark.classList.add('search-hit__replaced');
    }
    row.append(number, text, ...(itemActions ? itemActions(group, item) : []));
    row.title = `${group.relative}:${item.line}`;
    row.addEventListener('click', () => onOpen(group.path, item));
    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onOpen(group.path, item);
    });
    return row;
  }

  /**
   * @param {{title?: string, groups: Array<{path: string, relative: string, items: any[]}>, emptyMessage?: string, actions?: (group: any) => HTMLElement[], itemActions?: (group: any, item: any) => HTMLElement[]}} result
   */
  function show({ title, groups, emptyMessage, actions, itemActions }) {
    const nodes = [];
    if (title) {
      const heading = document.createElement('div');
      heading.className = 'search-results__title';
      heading.textContent = title;
      nodes.push(heading);
    }
    if (groups.length === 0 && emptyMessage) {
      const empty = document.createElement('p');
      empty.className = 'search-results__empty';
      empty.textContent = emptyMessage;
      nodes.push(empty);
    }
    for (const group of groups) {
      const details = document.createElement('details');
      details.className = 'search-group';
      details.open = true;
      const summary = document.createElement('summary');
      summary.className = 'search-group__summary';
      const name = document.createElement('span');
      name.className = 'search-group__name';
      name.textContent = group.relative;
      const count = document.createElement('span');
      count.className = 'search-group__count';
      count.textContent = String(group.items.length);
      summary.append(name, count, ...(actions ? actions(group) : []));
      details.append(summary, ...group.items.map((item) => renderItem(group, item, itemActions)));
      nodes.push(details);
    }
    containerEl.replaceChildren(...nodes);
  }

  return {
    show,
    clear: () => containerEl.replaceChildren(),
  };
}
