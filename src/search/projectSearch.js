// =============================================================================
// DBV Typst Editor — Panel «Buscar»: buscar y reemplazar en el proyecto (RF-78)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// La búsqueda la hace el backend (`search.rs`, un solo motor de expresiones
// regulares, R-S1); aquí vive el panel: los campos, la espera de 250 ms al
// escribir, el descarte de respuestas superadas (R-S2), el error de la
// expresión en el propio campo (RF-78.6) y el reemplazo, que se aplica con la
// edición en varios ficheros (`multiFileEdit`, R-E1): las pestañas abiertas en
// el editor, los cerrados en disco, con historial y Deshacer.
//
// Antes de reemplazar se vuelve a buscar CON el reemplazo: las posiciones son
// las de ese momento, no las de una búsqueda de hace un rato.

/** Espera tras la última pulsación antes de buscar. */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * ¿Es Ctrl+Mayús+F (Cmd+Mayús+F en macOS)?
 * @param {{key: string, ctrlKey: boolean, metaKey: boolean, shiftKey: boolean, altKey: boolean}} event
 */
export function isSearchProjectShortcut(event) {
  return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'f';
}

/**
 * Resultado del backend → grupos de la lista de resultados.
 * @param {{files: Array<{path: string, relative: string, matches: any[]}>}} result
 */
export function toGroups(result) {
  return result.files.map((file) => ({
    path: file.path,
    relative: file.relative,
    items: file.matches.map((match) => ({
      line: match.start.line + 1,
      text: match.preview,
      from: match.previewStart,
      to: match.previewEnd,
      range: { start: match.start, end: match.end },
      replacement: match.replacement ?? undefined,
    })),
  }));
}

/**
 * Ediciones de reemplazo por fichero, para `multiFileEdit`. Con `onlyPath`,
 * las de ese fichero; con `onlyStart`, solo la coincidencia que empieza ahí.
 * @param {{files: Array<{path: string, matches: any[]}>}} result
 * @param {{onlyPath?: string, onlyStart?: {line: number, character: number}}} [filter]
 */
export function replacementEdits(result, { onlyPath, onlyStart } = {}) {
  const sameStart = (match) => !onlyStart || (match.start.line === onlyStart.line && match.start.character === onlyStart.character);
  return result.files
    .filter((file) => !onlyPath || file.path === onlyPath)
    .map((file) => ({
      path: file.path,
      edits: file.matches.filter(sameStart).map((match) => ({ range: { start: match.start, end: match.end }, newText: match.replacement ?? '' })),
    }))
    .filter((file) => file.edits.length > 0);
}

/**
 * @param {object} deps
 * @param {Record<string, HTMLElement>} deps.elements query, replace, include, exclude, caseSensitive, wholeWord, regex, replaceAll, error, status
 * @param {object} deps.workspace
 * @param {Function} deps.searchProject `backend.searchProject`
 * @param {ReturnType<import('../app/multiFileEdit.js').createMultiFileEdit>} deps.multiFileEdit
 * @param {ReturnType<import('./resultsView.js').createResultsView>} deps.resultsView
 * @param {(location: {path: string, range: any}) => void} deps.openAt
 * @param {(key: string) => boolean} deps.getPref
 * @param {(key: string) => string} deps.t
 */
export function createProjectSearch({ elements, workspace, searchProject, multiFileEdit, resultsView, openAt, getPref, t }) {
  let searchId = 0;
  let timer = null;
  let lastResult = null;

  const toggles = [elements.caseSensitive, elements.wholeWord, elements.regex];
  for (const toggle of toggles) {
    toggle.setAttribute('aria-pressed', 'false');
    toggle.addEventListener('click', () => {
      toggle.setAttribute('aria-pressed', String(toggle.getAttribute('aria-pressed') !== 'true'));
      schedule(0);
    });
  }
  const pressed = (toggle) => toggle.getAttribute('aria-pressed') === 'true';

  function options() {
    return {
      caseSensitive: pressed(elements.caseSensitive),
      wholeWord: pressed(elements.wholeWord),
      regex: pressed(elements.regex),
      include: elements.include.value,
      exclude: elements.exclude.value,
      includeHidden: Boolean(getPref('showHiddenFiles')),
    };
  }

  function showError(message) {
    elements.error.textContent = message ?? '';
    elements.error.classList.toggle('hidden', !message);
    elements.query.classList.toggle('is-invalid', Boolean(message));
    elements.query.setAttribute('aria-invalid', String(Boolean(message)));
  }

  function setStatus(text) {
    elements.status.textContent = text;
  }

  /** Lanza la búsqueda; `replacement` fuerza a calcular los reemplazos. */
  async function query({ withReplacement = false } = {}) {
    const root = workspace.getRoot();
    const text = elements.query.value;
    const replacement = elements.replace.value;
    const id = ++searchId;
    const response = await searchProject(root, text, options(), {
      replacement: withReplacement || replacement ? replacement : null,
      openDocuments: workspace.getOpenTexts(),
      searchId: id,
    });
    // Una búsqueda posterior ya está en marcha: esta respuesta no vale (R-S2).
    const fresh = id === searchId && !(response.ok && response.value.cancelled);
    return fresh ? response : null;
  }

  /** Busca y pinta. */
  async function run() {
    clearTimeout(timer);
    timer = null;
    if (!workspace.getRoot() || !elements.query.value) {
      lastResult = null;
      showError(null);
      setStatus('');
      resultsView.clear();
      return;
    }
    const response = await query();
    if (!response) return;
    if (!response.ok) {
      lastResult = null;
      showError(response.error.message);
      setStatus('');
      resultsView.clear();
      return;
    }
    showError(null);
    lastResult = response.value;
    render();
  }

  function render() {
    const result = lastResult;
    const replacing = elements.replace.value !== '';
    elements.replaceAll.disabled = !replacing || result.total === 0;
    let status = t('search.summary').replace('{n}', String(result.total)).replace('{m}', String(result.files.length));
    if (result.truncated) status += ` — ${t('search.truncated')}`;
    setStatus(result.total === 0 ? t('search.noResults') : status);
    resultsView.show({
      groups: toGroups(result),
      actions: replacing
        ? (group) => [actionButton(t('search.replaceInFile'), '⇄', () => replace({ onlyPath: group.path }))]
        : undefined,
      itemActions: replacing
        ? (group, item) => [actionButton(t('search.replaceOne'), '⇄', () => replace({ onlyPath: group.path, onlyStart: item.range.start }))]
        : undefined,
    });
  }

  function actionButton(label, glyph, run) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-action';
    button.textContent = glyph;
    button.title = label;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', (event) => {
      // Dentro de un `<summary>`: que no pliegue el grupo.
      event.preventDefault();
      event.stopPropagation();
      run();
    });
    return button;
  }

  /**
   * Reemplaza (todas, las de un fichero o una). Se vuelve a buscar con el
   * reemplazo para trabajar con las posiciones de ahora.
   */
  async function replace(filter = {}) {
    const response = await query({ withReplacement: true });
    if (!response?.ok) return false;
    const files = replacementEdits(response.value, filter);
    const result = await multiFileEdit.apply(files, { reason: 'replace' });
    multiFileEdit.report(result, 'replace');
    await run();
    return Boolean(result);
  }

  function schedule(delay = SEARCH_DEBOUNCE_MS) {
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  }

  for (const input of [elements.query, elements.replace, elements.include, elements.exclude]) {
    input.addEventListener('input', () => schedule());
  }
  elements.query.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      schedule(0);
    }
  });
  elements.replaceAll.addEventListener('click', () => replace());

  return {
    run,
    replace,
    /** Ctrl+Mayús+F: foco en el campo, con la selección del editor si es de una línea. */
    focus(prefill) {
      if (prefill && !prefill.includes('\n')) {
        elements.query.value = prefill;
        schedule(0);
      }
      elements.query.focus();
      elements.query.select();
    },
    /** Se editó algo: si hay una búsqueda activa, se recalcula (RF-78.3). */
    refreshSoon() {
      if (elements.query.value && lastResult) schedule();
    },
    /** Abrir un resultado en su pestaña. */
    open: (path, item) => openAt({ path, range: item.range }),
  };
}
