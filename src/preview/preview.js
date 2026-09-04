// =============================================================================
// DBV Typst Editor — Vista previa en tiempo real (SVG página a página)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// RF-06. La mitad de frontend de los cuatro requisitos del Adversarial Architect
// Review (la otra mitad está en `typst_engine/compile.rs`):
//
//   · debounce sobre la escritura, para no lanzar una compilación por tecla;
//   · descarte de resultados obsoletos por token de generación — el backend ya
//     los marca `stale`, y aquí se comprueba además que el token no sea menor
//     que el último pintado, de modo que ninguna de las dos capas dependa en
//     exclusiva de la otra;
//   · "última vista buena": un error de compilación NO borra el preview; se
//     mantiene lo último correcto y el error aparece en una banda inferior.
//
// Carga perezosa: una compilación devuelve el tamaño de todas las páginas y el
// marcado solo de las visibles; el resto se piden con `previewPage()` cuando el
// lector se acerca a ellas. Medido en el Slice 5: una tesis de 209 páginas son
// 82 MB de SVG, así que traerlas todas en cada pausa de escritura habría hecho
// inusable justo el escenario insignia del producto.

import { t } from '../i18n/i18n.js';
import { cancelPreview, compilePreview, previewPage } from '../services/backend.js';

/** Pausa de escritura tras la que se recompila. */
const DEBOUNCE_MS = 350;

/** Páginas cuyo marcado viaja ya con la respuesta de la compilación. */
const INITIAL_WINDOW = 2;

/** Margen de precarga: se traen las páginas una pantalla antes de llegar. */
const PRELOAD_MARGIN = '600px';

const ZOOM_STORAGE_KEY = 'dbv-typst-preview-zoom';
const ZOOM_STEPS = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 2];

function readStoredZoom() {
  try {
    const stored = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
    return ZOOM_STEPS.includes(stored) ? stored : 1;
  } catch {
    return 1;
  }
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.pagesEl Contenedor de las páginas.
 * @param {HTMLElement} deps.bandEl Banda de error/aviso del compilador.
 * @param {HTMLElement} deps.statusEl Indicador de estado.
 * @param {HTMLElement} deps.zoomLabelEl Porcentaje de zoom.
 */
export function createPreview({ pagesEl, bandEl, statusEl, zoomLabelEl }) {
  let debounceTimer = null;
  /** Último token de generación efectivamente pintado. */
  let renderedGeneration = 0;
  /** Última petición conocida: documento, raíz y contenido en vivo. */
  let request = null;
  let zoom = readStoredZoom();
  let pageCount = 0;

  // Trae el marcado de una página en cuanto su hueco se acerca al viewport.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) loadPage(entry.target);
      }
    },
    { root: pagesEl, rootMargin: PRELOAD_MARGIN }
  );

  function applyZoom() {
    pagesEl.style.setProperty('--preview-zoom', String(zoom));
    zoomLabelEl.textContent = `${Math.round(zoom * 100)}%`;
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
    } catch {
      // Un WebView que bloquee el almacenamiento no debe impedir hacer zoom.
    }
  }

  function setStatus(key, extra = '') {
    statusEl.textContent = extra ? `${t(key)} ${extra}` : t(key);
  }

  function showBand(message) {
    bandEl.textContent = message;
    bandEl.classList.remove('hidden');
  }

  function hideBand() {
    bandEl.textContent = '';
    bandEl.classList.add('hidden');
  }

  /** Pinta el marcado dentro del hueco ya reservado de una página. */
  function fillPage(pageEl, svg) {
    // El SVG lo produce el compilador Typst que la propia aplicación embebe y
    // ejecuta sobre un fichero local: no es contenido de terceros traído por
    // red, así que insertarlo como marcado es correcto — y es la única forma de
    // conservar el texto vectorial seleccionable.
    pageEl.innerHTML = svg;
    pageEl.dataset.loaded = '1';
    observer.unobserve(pageEl);
  }

  async function loadPage(pageEl) {
    if (pageEl.dataset.loaded || pageEl.dataset.loading) return;
    const generation = Number(pageEl.dataset.generation);
    if (generation !== renderedGeneration) return;

    pageEl.dataset.loading = '1';
    const result = await previewPage(generation, Number(pageEl.dataset.index));
    delete pageEl.dataset.loading;

    // Una generación superada mientras se pedía la página no es un error: la
    // compilación nueva ya está en camino con sus propios huecos.
    if (!result.ok || generation !== renderedGeneration) return;
    fillPage(pageEl, result.value.svg);
  }

  /**
   * Reserva un hueco por página con su proporción real y rellena las que ya
   * vienen en la respuesta. Reservar el hueco antes de tener el marcado es lo
   * que evita que la barra de desplazamiento salte mientras se cargan páginas.
   */
  function renderSkeleton(generation, geometry, pages) {
    const loaded = new Map(pages.map((page) => [page.index, page.svg]));
    const fragment = document.createDocumentFragment();

    geometry.forEach((size, index) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'preview-page';
      pageEl.dataset.index = String(index);
      pageEl.dataset.generation = String(generation);
      pageEl.style.setProperty('--page-ratio', String(size.heightPt / size.widthPt));

      const svg = loaded.get(index);
      if (svg) fillPage(pageEl, svg);
      fragment.append(pageEl);
    });

    pagesEl.replaceChildren(fragment);
    pageCount = geometry.length;

    for (const pageEl of pagesEl.children) {
      if (!pageEl.dataset.loaded) observer.observe(pageEl);
    }
  }

  /** Índice de la primera página visible, para recompilar por donde se lee. */
  function firstVisiblePage() {
    const top = pagesEl.scrollTop;
    for (const pageEl of pagesEl.children) {
      if (pageEl.offsetTop + pageEl.offsetHeight >= top) return Number(pageEl.dataset.index);
    }
    return 0;
  }

  /** Lanza una compilación inmediata con la petición actual. */
  async function compileNow() {
    if (!request?.document || !request?.root) return;

    const scrollTop = pagesEl.scrollTop;
    setStatus('preview.compiling');

    const result = await compilePreview({
      document: request.document,
      root: request.root,
      // Solo se manda el contenido en vivo si difiere del disco: mientras no
      // haya cambios sin guardar no se escribe nada en la carpeta del usuario
      // (importa para los proyectos ajenos de RF-02b).
      content: request.dirty ? request.content : null,
      firstPage: firstVisiblePage(),
      windowSize: INITIAL_WINDOW,
    });

    if (!result.ok) {
      // Última vista buena: no se toca `pagesEl`.
      showBand(result.error.message || t('preview.error'));
      setStatus('preview.failed');
      return;
    }

    const outcome = result.value;
    if (outcome.stale || outcome.generation < renderedGeneration) return;

    renderedGeneration = outcome.generation;
    renderSkeleton(outcome.generation, outcome.geometry, outcome.pages);
    applyZoom();
    // Recompilar no debe mover al lector de donde estaba leyendo.
    pagesEl.scrollTop = scrollTop;

    if (outcome.warnings.trim()) showBand(outcome.warnings.trim());
    else hideBand();
    setStatus('preview.pages', String(pageCount));
  }

  /** Programa una compilación tras la pausa de escritura. */
  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(compileNow, DEBOUNCE_MS);
  }

  function setZoomIndex(delta) {
    const current = ZOOM_STEPS.indexOf(zoom);
    const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, current + delta));
    zoom = ZOOM_STEPS[next];
    applyZoom();
  }

  applyZoom();
  setStatus('preview.idle');

  return {
    /** Fija el documento a compilar y lanza una primera compilación. */
    setDocument({ document, root, content }) {
      request = { document, root, content, dirty: false };
      renderedGeneration = 0;
      hideBand();
      pagesEl.scrollTop = 0;
      compileNow();
    },
    /** El usuario ha escrito: se recompila tras la pausa. */
    onContentChanged(content) {
      if (!request) return;
      request.content = content;
      request.dirty = true;
      schedule();
    },
    /** El documento se ha guardado: disco y editor vuelven a coincidir. */
    onSaved() {
      if (!request) return;
      request.dirty = false;
      schedule();
    },
    /** Algo cambió en disco fuera del editor (un capítulo, una imagen). */
    onExternalChange() {
      if (!request) return;
      schedule();
    },
    async clear() {
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
      await cancelPreview();
      request = null;
      renderedGeneration = 0;
      pageCount = 0;
      pagesEl.replaceChildren();
      hideBand();
      setStatus('preview.idle');
    },
    zoomIn: () => setZoomIndex(1),
    zoomOut: () => setZoomIndex(-1),
    zoomReset: () => {
      zoom = 1;
      applyZoom();
    },
    /** Repinta los textos dependientes del idioma. */
    refreshStatus() {
      if (pageCount > 0) setStatus('preview.pages', String(pageCount));
      else setStatus('preview.idle');
    },
  };
}
