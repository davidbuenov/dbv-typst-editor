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
const FIT_WIDTH_STORAGE_KEY = 'dbv-typst-preview-fit-width';
/** Debe coincidir con `max-width: calc(920px * var(--preview-zoom))` de
 * `.preview-page` en `themes/layout.css` — es el ancho de referencia sobre el
 * que se calcula el zoom que hace que la página use todo el ancho disponible. */
const PAGE_REFERENCE_WIDTH_PX = 920;
/** `.preview__pages` tiene `padding: 16px` a cada lado (`layout.css`). */
const PAGES_PADDING_PX = 32;

/** Reconoce el aviso de Typst para una familia tipográfica no instalada. */
const MISSING_FONT_PATTERN = /unknown font family:\s*"?([^"\n]+?)"?\s*$/gim;

/**
 * Antepone, cuando aplica, un aviso legible sobre fuentes que faltan en el
 * sistema al texto crudo del compilador — que ya usa este mismo nombre de
 * familia en su propio warning, pero perdido entre coordenadas de fichero y
 * columna que solo tienen sentido para quien conoce el código fuente del
 * paquete, no para quien solo quiere saber qué instalar.
 */
function withFontHint(warnings) {
  const names = new Set();
  for (const match of warnings.matchAll(MISSING_FONT_PATTERN)) {
    names.add(match[1].trim());
  }
  if (names.size === 0) return warnings;

  const label = names.size === 1 ? t('preview.missingFontsOne') : t('preview.missingFontsMany');
  const hint = `${label} ${[...names].join(', ')}. ${t('preview.missingFontsHint')}`;
  return `${hint}\n\n${warnings}`;
}

function readStoredZoom() {
  try {
    const stored = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
    return ZOOM_STEPS.includes(stored) ? stored : 1;
  } catch {
    return 1;
  }
}

function readStoredFitWidth() {
  try {
    return localStorage.getItem(FIT_WIDTH_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.pagesEl Contenedor de las páginas.
 * @param {HTMLElement} deps.bandEl Banda de error/aviso del compilador.
 * @param {HTMLElement} [deps.bandSplitterEl] Separador redimensionable de la banda
 *   (Beta): se muestra/oculta junto con `bandEl`, nunca por su cuenta.
 * @param {HTMLElement} deps.statusEl Indicador de estado.
 * @param {HTMLElement} deps.zoomLabelEl Porcentaje de zoom.
 */
export function createPreview({ pagesEl, bandEl, bandSplitterEl, statusEl, zoomLabelEl }) {
  let debounceTimer = null;
  /** Último token de generación efectivamente pintado. */
  let renderedGeneration = 0;
  /** Última petición conocida: documento, raíz y contenido en vivo. */
  let request = null;
  let zoom = readStoredZoom();
  /** "Ajustar al ancho" (petición explícita tras probar la Beta): en vez de un
   * porcentaje fijo, el zoom se recalcula para que la página ocupe todo el
   * ancho disponible del panel — que ahora puede cambiar en caliente al
   * mostrar/ocultar paneles (`app/workspacePanels.js`) o redimensionar la
   * ventana, de ahí el `ResizeObserver` más abajo. */
  let fitWidth = readStoredFitWidth();
  let pageCount = 0;
  /** Alto real (pt) de cada página de la compilación vigente, por índice — lo
   * que permite convertir la coordenada `y` del outline (Beta, §7.8) a un
   * desplazamiento de scroll sin esperar a que la página haya cargado su SVG. */
  let pageHeightsPt = [];

  // Typst incrusta un `<a>` real (espacio de nombres SVG) alrededor de cada
  // cita y referencia cruzada, incluso sin `href` — solo se rellena al
  // exportar a PDF (verificado compilando un `#cite()` de prueba). El problema
  // es que `SVGAElement.prototype.href` devuelve SIEMPRE un `SVGAnimatedString`,
  // nunca una cadena, tenga o no atributo `href`. El runtime de la ventana
  // intercepta clics en cualquier `<a>` asumiendo HTML y llama
  // `.href.startsWith(...)`, así que pulsar sobre una cita revienta la app
  // entera con "r.href.startsWith is not a function". Se corta aquí, en fase
  // de captura, antes de que el clic llegue a ese código: estos `<a>` no son
  // navegables en la vista previa (solo importan al exportar), así que
  // ignorarlos por completo es lo correcto, no un parche.
  pagesEl.addEventListener(
    'click',
    (event) => {
      if (event.target.closest('a')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true }
  );

  // Trae el marcado de una página en cuanto su hueco se acerca al viewport.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) loadPage(entry.target);
      }
    },
    { root: pagesEl, rootMargin: PRELOAD_MARGIN }
  );

  /** Zoom que hace que la página use todo el ancho disponible ahora mismo. */
  function fitZoom() {
    const available = pagesEl.clientWidth - PAGES_PADDING_PX;
    return available > 0 ? available / PAGE_REFERENCE_WIDTH_PX : 1;
  }

  function applyZoom() {
    const effectiveZoom = fitWidth ? fitZoom() : zoom;
    pagesEl.style.setProperty('--preview-zoom', String(effectiveZoom));
    zoomLabelEl.textContent = `${Math.round(effectiveZoom * 100)}%`;
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
      localStorage.setItem(FIT_WIDTH_STORAGE_KEY, fitWidth ? '1' : '0');
    } catch {
      // Un WebView que bloquee el almacenamiento no debe impedir hacer zoom.
    }
  }

  // El ancho disponible cambia con la ventana y, desde el rediseño de paneles
  // (Beta), también al mostrar/ocultar el editor o el explorador — sin este
  // observador, "Ajustar al ancho" se quedaría con el cálculo del momento en
  // que se activó, no el actual.
  const resizeObserver = new ResizeObserver(() => {
    if (fitWidth) applyZoom();
  });
  resizeObserver.observe(pagesEl);

  function setStatus(key, extra = '') {
    statusEl.textContent = extra ? `${t(key)} ${extra}` : t(key);
  }

  function showBand(message) {
    bandEl.textContent = message;
    bandEl.classList.remove('hidden');
    bandSplitterEl?.classList.remove('hidden');
  }

  function hideBand() {
    bandEl.textContent = '';
    bandEl.classList.add('hidden');
    bandSplitterEl?.classList.add('hidden');
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
      showBand(withFontHint(result.error.message || t('preview.error')));
      setStatus('preview.failed');
      return;
    }

    const outcome = result.value;
    if (outcome.stale || outcome.generation < renderedGeneration) return;

    renderedGeneration = outcome.generation;
    pageHeightsPt = outcome.geometry.map((page) => page.heightPt);
    renderSkeleton(outcome.generation, outcome.geometry, outcome.pages);
    applyZoom();
    // Recompilar no debe mover al lector de donde estaba leyendo.
    pagesEl.scrollTop = scrollTop;

    if (outcome.warnings.trim()) showBand(withFontHint(outcome.warnings.trim()));
    else hideBand();
    setStatus('preview.pages', String(pageCount));
  }

  /** Programa una compilación tras la pausa de escritura. */
  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(compileNow, DEBOUNCE_MS);
  }

  function setZoomIndex(delta) {
    // Un zoom explícito sustituye a "Ajustar al ancho", igual que en
    // cualquier visor de PDF: pedir un porcentaje concreto es una decisión
    // más específica que "lo que quepa".
    fitWidth = false;
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
    /**
     * El editor se ha ido a otro fichero (uno acompañante, como `refs.bib`).
     * La vista previa sigue mostrando el mismo documento, pero deja de usar el
     * contenido en vivo: a partir de aquí compila lo que hay en disco.
     */
    detachLiveContent() {
      if (!request) return;
      request.dirty = false;
      request.content = null;
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
    /** Página 1-indexada que se está leyendo ahora mismo (exportación PNG, Beta). */
    getCurrentPage: () => firstVisiblePage() + 1,
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
    /**
     * Navegación del panel de navegación estructural (Beta, §7.8): `page` es
     * 1-indexado (como lo devuelve Typst), `yPt` la coordenada vertical dentro
     * de esa página. `offsetHeight` de la página ya es correcto aunque su SVG
     * todavía no haya cargado — lo fija el `aspect-ratio` reservado en CSS.
     */
    scrollToPage(page, yPt) {
      const pageEl = pagesEl.children[page - 1];
      if (!pageEl) return;
      const heightPt = pageHeightsPt[page - 1] || pageEl.offsetHeight;
      const ratio = pageEl.offsetHeight / heightPt;
      const margin = 24;
      pagesEl.scrollTo({ top: Math.max(0, pageEl.offsetTop + yPt * ratio - margin), behavior: 'smooth' });
    },
    zoomIn: () => setZoomIndex(1),
    zoomOut: () => setZoomIndex(-1),
    zoomReset: () => {
      fitWidth = false;
      zoom = 1;
      applyZoom();
    },
    /** Alterna "Ajustar al ancho" (Beta): la página ocupa todo el panel. */
    toggleFitWidth() {
      fitWidth = !fitWidth;
      applyZoom();
      return fitWidth;
    },
    isFitWidth: () => fitWidth,
    /** Repinta los textos dependientes del idioma. */
    refreshStatus() {
      if (pageCount > 0) setStatus('preview.pages', String(pageCount));
      else setStatus('preview.idle');
    },
  };
}
