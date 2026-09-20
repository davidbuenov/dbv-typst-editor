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
import { cancelPreview, compilePreview, getSyncAnchors, previewPage } from '../services/backend.js';
import { anchorAtPoint, anchorForLine, anchorSpan } from './syncAnchors.js';

/** Pausa de escritura tras la que se recompila, en modo automático. */
const DEBOUNCE_MS = 350;

/**
 * La pausa de escritura crece con lo que tarda la compilación: esperar solo
 * 350 ms cuando compilar cuesta 4,6 s (libro real de 220 páginas) lanza una
 * compilación nueva —y cancela la anterior— en cada respiro, y el proceso no
 * termina nunca. Se espera el equivalente a 1,5 compilaciones, con un techo.
 */
const DEBOUNCE_SLOW_FACTOR = 1.5;
const DEBOUNCE_MAX_MS = 6000;

/** Pausa de escritura adecuada tras una compilación que duró `lastCompileMs`. */
export function debounceFor(lastCompileMs) {
  return Math.min(DEBOUNCE_MAX_MS, Math.max(DEBOUNCE_MS, lastCompileMs * DEBOUNCE_SLOW_FACTOR));
}

/**
 * Modo de refresco (RF-15). No es una comodidad: desde RF-14 la vista previa
 * compila el documento completo, y el Spike S-2 midió que eso cuesta ×9 lo que
 * costaba el capítulo (828 ms frente a 91 ms en una tesis de 202 páginas), muy
 * por encima de la pausa de escritura. En un documento grande, el modo
 * automático tendría al compilador corriendo casi sin parar.
 */
const REFRESH_STORAGE_KEY = 'dbv-typst-preview-refresh';

/** Páginas cuyo marcado viaja ya con la respuesta de la compilación. */
const INITIAL_WINDOW = 2;

/** Margen de precarga: se traen las páginas una pantalla antes de llegar. */
const PRELOAD_MARGIN = '600px';

/**
 * Distancia al viewport a partir de la cual una página ya pintada se descarta.
 * Bastante mayor que `PRELOAD_MARGIN` para que no haya ida y vuelta: una página
 * que se descarta siempre queda fuera de la zona donde se vuelve a pedir.
 *
 * Sin descarte, recorrer un libro de 220 páginas dejaba cada una como DOM vivo:
 * ~400 kB de SVG (miles de nodos `<path>` de glifos) por página. Con un libro
 * real (`z6-IPbook`: 86 MB de SVG) el proceso llegó a 8,9 GB en un Mac.
 */
const EVICT_MARGIN = '2500px';

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
 * Reconoce el error de Typst cuando `#cite(...)` (o `#bibliography`) se
 * compila sin bibliografía en su propio ámbito — verificado contra el binario
 * real: `the document does not contain a bibliography`.
 */
const MISSING_BIBLIOGRAPHY_PATTERN = /the document does not contain a bibliography/i;

/**
 * Aviso legible sobre fuentes que faltan en el sistema, o `null` si el texto
 * del compilador no menciona ninguna — que ya usa este mismo nombre de
 * familia en su propio warning, pero perdido entre coordenadas de fichero y
 * columna que solo tienen sentido para quien conoce el código fuente del
 * paquete, no para quien solo quiere saber qué instalar.
 */
function fontHint(warnings) {
  const names = new Set();
  for (const match of warnings.matchAll(MISSING_FONT_PATTERN)) {
    names.add(match[1].trim());
  }
  if (names.size === 0) return null;

  const label = names.size === 1 ? t('preview.missingFontsOne') : t('preview.missingFontsMany');
  return `${label} ${[...names].join(', ')}. ${t('preview.missingFontsHint')}`;
}

/**
 * Pista sobre por qué una `#cite(...)` que funciona perfectamente al
 * compilar desde el documento principal falla en este preview, o `null` si
 * no aplica: la vista previa compila SIEMPRE el fichero abierto, no
 * `main.typ` (§7.6 ARCHITECTURE.md) — así que un capítulo suelto, incluido
 * normalmente vía `#include` desde un documento que sí declara
 * `#bibliography(...)`, no tiene bibliografía en su propio ámbito. No es un
 * error del proyecto: es una limitación esperada de previsualizar un capítulo
 * fuera de su documento — mismo patrón que `fontHint` para fuentes.
 */
function bibliographyHint(message) {
  return MISSING_BIBLIOGRAPHY_PATTERN.test(message) ? t('preview.missingBibliographyHint') : null;
}

/**
 * Todas las pistas de la aplicación que aplican a este texto de compilador,
 * separadas del texto en sí — para que `showBand` pueda pintarlas en un color
 * distinto al del error real y así quede claro que no son parte de lo que
 * dice el compilador (RF-06, aviso de un usuario real: "en otro color que no
 * fuera rojo para que el usuario supiera que es de la aplicación").
 * @returns {string[]}
 */
function appHints(message) {
  return [fontHint(message), bibliographyHint(message)].filter(Boolean);
}

function readStoredZoom() {
  try {
    const stored = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
    return ZOOM_STEPS.includes(stored) ? stored : 1;
  } catch {
    return 1;
  }
}

function readStoredRefreshMode() {
  try {
    return localStorage.getItem(REFRESH_STORAGE_KEY) === 'manual' ? 'manual' : 'auto';
  } catch {
    return 'auto';
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
 * @param {() => (import('../services/backend.js').CompileTarget | null)} deps.getTarget
 *   Objetivo de compilación vigente (RF-14). Se pide en cada compilación en vez
 *   de guardarse aquí: así la vista previa no puede quedarse con un objetivo
 *   viejo cuando el workspace cambia de documento o de alcance.
 * @param {(stale: boolean) => void} [deps.onStaleChange] Aviso de que lo que se
 *   ve ya no corresponde con lo escrito (RF-15).
 */
export function createPreview({
  pagesEl,
  bandEl,
  bandSplitterEl,
  statusEl,
  zoomLabelEl,
  getTarget,
  onStaleChange,
}) {
  let debounceTimer = null;
  /** Duración de la última compilación, para adaptar la pausa de escritura. */
  let lastCompileMs = 0;
  /** Último token de generación efectivamente pintado. */
  let renderedGeneration = 0;
  /** Hay algo compilado en pantalla (aunque sea de una versión anterior). */
  let hasRendered = false;
  /** 'auto' | 'manual' (RF-15). */
  let refreshMode = readStoredRefreshMode();
  /** Lo pintado ya no corresponde con lo escrito (RF-15). */
  let stale = false;
  /**
   * Tabla de anclas de la generación pintada (RF-16), o `null` si aún no se ha
   * pedido. Se calcula BAJO DEMANDA porque cuesta otra composición completa del
   * documento (≈750 ms en 202 páginas); pedirla en cada pausa de escritura
   * duplicaría el coste de escribir. Se descarta al recompilar: una tabla de una
   * generación vieja mandaría al usuario a cualquier parte.
   * @type {null | Array<object>}
   */
  let anchors = null;
  let anchorsGeneration = 0;
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

  // Descarta el marcado de las páginas que se alejan del viewport. El hueco se
  // conserva (su alto sale de `--page-ratio`), así que el scroll no salta, y
  // `observer` la volverá a pedir si el lector regresa.
  const releaseObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) releasePage(entry.target);
      }
    },
    { root: pagesEl, rootMargin: EVICT_MARGIN }
  );

  function releasePage(pageEl) {
    if (!pageEl.dataset.loaded) return;
    pageEl.replaceChildren();
    delete pageEl.dataset.loaded;
    releaseObserver.unobserve(pageEl);
    // Solo si sigue siendo de la generación vigente: si no, el hueco ya está
    // muerto y `renderSkeleton` lo habrá sustituido.
    if (Number(pageEl.dataset.generation) === renderedGeneration) observer.observe(pageEl);
  }

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

  /**
   * Pinta la banda inferior: primero las pistas propias de la aplicación
   * (`preview__band-hint`, color de acento), después el texto crudo del
   * compilador (`preview__band-message`, el rojo de siempre) — dos nodos
   * distintos, no un único `textContent` concatenado, para que un usuario
   * distinga a simple vista "esto lo explica la app" de "esto lo dice Typst".
   */
  function showBand(message) {
    bandEl.replaceChildren();
    for (const hint of appHints(message)) {
      const hintEl = document.createElement('div');
      hintEl.className = 'preview__band-hint';
      hintEl.textContent = hint;
      bandEl.append(hintEl);
    }
    const messageEl = document.createElement('div');
    messageEl.className = 'preview__band-message';
    messageEl.textContent = message;
    bandEl.append(messageEl);

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
    releaseObserver.observe(pageEl);
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
    // Los huecos de la generación anterior desaparecen: se sueltan de ambos
    // observadores para que no retengan nodos muertos. Va ANTES del bucle,
    // porque `fillPage` registra en `releaseObserver` las páginas ya servidas.
    releaseObserver.disconnect();
    observer.disconnect();

    const loaded = new Map(pages.map((page) => [page.index, page.svg]));
    const fragment = document.createDocumentFragment();

    geometry.forEach((size, index) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'preview-page';
      pageEl.dataset.index = String(index);
      pageEl.dataset.generation = String(generation);
      pageEl.style.setProperty('--page-ratio', String(size.heightPt / size.widthPt));

      const svg = loaded.get(index);
      if (svg) {
        fillPage(pageEl, svg);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'preview-page__placeholder';
        const spinner = document.createElement('div');
        spinner.className = 'preview-page__spinner';
        const label = document.createElement('span');
        label.textContent = `${t('preview.pageLoading')} ${index + 1}…`;
        placeholder.append(spinner, label);
        pageEl.append(placeholder);
      }
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
      if (!pageEl.classList.contains('preview-page')) continue;
      if (pageEl.offsetTop + pageEl.offsetHeight >= top) return Number(pageEl.dataset.index);
    }
    return 0;
  }

  /** Marca (o desmarca) que lo pintado ya no corresponde con lo escrito. */
  function setStale(value) {
    if (stale === value) return;
    stale = value;
    onStaleChange?.(stale);
  }

  /** Lanza una compilación inmediata con el objetivo vigente. */
  async function compileNow() {
    const target = getTarget();
    if (!target?.document || !target?.root) return;

    const scrollTop = pagesEl.scrollTop;
    setStatus('preview.compiling');

    const startedAt = performance.now();
    const result = await compilePreview({
      target,
      firstPage: firstVisiblePage(),
      windowSize: INITIAL_WINDOW,
    });
    // Una compilación superada por otra devuelve enseguida y no dice nada de lo
    // que cuesta el documento: solo las que terminan de verdad ajustan la pausa.
    if (!result.ok || !result.value.stale) lastCompileMs = performance.now() - startedAt;

    if (!result.ok) {
      if (!hasRendered) {
        pagesEl.replaceChildren();
      } else {
        // Última vista buena (Last Good Render): conserva las páginas visibles y marca desactualizado
        setStale(true);
      }
      showBand(result.error.message || t('preview.error'));
      setStatus('preview.failed');
      return;
    }

    const outcome = result.value;
    if (outcome.stale || outcome.generation < renderedGeneration) return;

    renderedGeneration = outcome.generation;
    hasRendered = true;
    setStale(false);
    // La tabla pertenece a una generación: al recompilar deja de valer.
    if (anchorsGeneration !== outcome.generation) anchors = null;
    pageHeightsPt = outcome.geometry.map((page) => page.heightPt);
    renderSkeleton(outcome.generation, outcome.geometry, outcome.pages);
    applyZoom();
    // Recompilar no debe mover al lector de donde estaba leyendo.
    pagesEl.scrollTop = scrollTop;

    if (outcome.warnings.trim()) showBand(outcome.warnings.trim());
    else hideBand();
    setStatus('preview.pages', String(pageCount));
  }

  /**
   * Programa una compilación tras la pausa de escritura.
   *
   * En modo manual no se compila nada: se marca la vista como desactualizada,
   * que es la contrapartida obligatoria de no recompilar sola — nunca se puede
   * enseñar contenido viejo como si fuera el actual (RF-15b).
   */
  function schedule() {
    if (refreshMode === 'manual') {
      if (hasRendered) setStale(true);
      return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(compileNow, debounceFor(lastCompileMs));
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

  /**
   * Lleva la vista a `yPt` dentro de `page` (1-indexada, como Typst).
   * `offsetHeight` de la página ya es correcto aunque su SVG todavía no haya
   * cargado — lo fija el `aspect-ratio` reservado en CSS.
   */
  function scrollToPage(page, yPt) {
    const pageEl = pagesEl.children[page - 1];
    if (!pageEl) return;
    const heightPt = pageHeightsPt[page - 1] || pageEl.offsetHeight;
    const ratio = pageEl.offsetHeight / heightPt;
    const margin = 24;
    pagesEl.scrollTo({ top: Math.max(0, pageEl.offsetTop + yPt * ratio - margin), behavior: 'smooth' });
  }

  /** Cuánto dura la marca del salto sobre la vista previa. */
  const SYNC_MARK_MS = 2200;

  /**
   * Pinta unos segundos una banda sobre el bloque de `anchor` (RF-16): sin ella,
   * tras el salto no se veía QUÉ parte del render correspondía al fuente.
   *
   * La banda es un hijo propio del contenedor, posicionado contra la página, y no
   * un hijo de la página: `fillPage` y el descarte de páginas lejanas vacían la
   * página al cargar o soltar su marcado, y se llevarían la marca consigo.
   */
  function flashAnchor(anchor) {
    const pageEl = pagesEl.children[anchor.page - 1];
    if (!pageEl || !pageEl.classList.contains('preview-page')) return;

    const heightPt = pageHeightsPt[anchor.page - 1] || pageEl.offsetHeight;
    const ratio = pageEl.offsetHeight / heightPt;
    const mark = document.createElement('div');
    mark.className = 'preview-sync-mark';
    mark.style.top = `${pageEl.offsetTop + anchor.yPt * ratio}px`;
    mark.style.left = `${pageEl.offsetLeft}px`;
    mark.style.width = `${pageEl.offsetWidth}px`;
    mark.style.height = `${Math.max(anchorSpan(anchors, anchor) * ratio, 16)}px`;
    pagesEl.querySelectorAll('.preview-sync-mark').forEach((old) => old.remove());
    pagesEl.append(mark);
    setTimeout(() => mark.remove(), SYNC_MARK_MS);
  }

  /**
   * Convierte un punto de pantalla en coordenadas del documento (RF-16).
   * Inverso exacto de `scrollToPage`: la misma razón `offsetHeight / heightPt`.
   */
  function documentPointAt(clientX, clientY) {
    for (const pageEl of pagesEl.children) {
      if (!pageEl.classList.contains('preview-page')) continue;
      const rect = pageEl.getBoundingClientRect();
      const inside =
        clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      if (!inside) continue;

      const index = Number(pageEl.dataset.index);
      const heightPt = pageHeightsPt[index] || rect.height;
      const ratio = rect.height / heightPt;
      return {
        page: index + 1,
        xPt: (clientX - rect.left) / ratio,
        yPt: (clientY - rect.top) / ratio,
      };
    }
    return null;
  }

  function showLoadingPlaceholder() {
    const placeholder = document.createElement('div');
    placeholder.className = 'preview__loading';
    const spinner = document.createElement('div');
    spinner.className = 'preview-page__spinner';
    const label = document.createElement('span');
    label.className = 'preview__loading-text';
    label.textContent = t('preview.compiling');
    placeholder.append(spinner, label);
    pagesEl.replaceChildren(placeholder);
  }

  /** Tabla de anclas de la generación pintada, calculándola si hace falta. */
  async function ensureAnchors() {
    if (anchors && anchorsGeneration === renderedGeneration) return anchors;

    const target = getTarget();
    if (!target) return null;
    const result = await getSyncAnchors(target);
    if (!result.ok) return null;

    anchors = result.value;
    anchorsGeneration = renderedGeneration;
    return anchors;
  }

  applyZoom();
  setStatus('preview.idle');

  return {
    /** Empieza de cero con el objetivo vigente (abrir documento o cambiar alcance). */
    restart() {
      renderedGeneration = 0;
      hasRendered = false;
      setStale(false);
      anchors = null;
      hideBand();
      pagesEl.scrollTop = 0;
      showLoadingPlaceholder();
      compileNow();
    },
    /** El usuario ha escrito, o ha cambiado algo que afecta al render. */
    onContentChanged() {
      schedule();
    },
    /** Algo cambió en disco fuera del editor (un capítulo, una imagen). */
    onExternalChange() {
      schedule();
    },
    /** Refresco explícito (RF-15): el botón, y el atajo. */
    refreshNow() {
      if (debounceTimer) clearTimeout(debounceTimer);
      compileNow();
    },
    getRefreshMode: () => refreshMode,
    /** Alterna automático/manual, lo recuerda, y devuelve el modo nuevo. */
    toggleRefreshMode() {
      refreshMode = refreshMode === 'auto' ? 'manual' : 'auto';
      try {
        localStorage.setItem(REFRESH_STORAGE_KEY, refreshMode);
      } catch {
        // Sin almacenamiento el modo no se recuerda entre sesiones; no es
        // motivo para impedir el cambio.
      }
      // Volver a automático con algo pendiente compila ya: dejar la vista
      // desactualizada en un modo que promete actualizarse sola sería mentir.
      if (refreshMode === 'auto' && stale) compileNow();
      return refreshMode;
    },
    isStale: () => stale,
    /**
     * Punto del fuente que corresponde a un punto de la vista previa (RF-16),
     * o `null` si ahí no hay nada que resolver. Lo usa el doble clic.
     */
    async sourceAt(clientX, clientY) {
      const point = documentPointAt(clientX, clientY);
      if (!point) return null;
      const table = await ensureAnchors();
      return anchorAtPoint(table, point);
    },
    /**
     * Lleva la vista previa al punto que corresponde a una línea del fuente
     * (RF-16, dirección editor → render). Devuelve si ha podido situarse.
     */
    async scrollToSource(file, line) {
      const table = await ensureAnchors();
      const anchor = anchorForLine(table, file, line);
      if (!anchor) return false;
      scrollToPage(anchor.page, anchor.yPt);
      flashAnchor(anchor);
      return true;
    },
    /** Marca en la vista previa el bloque de `anchor`, el resuelto por un doble clic. */
    flashAnchor,
    /** Página 1-indexada que se está leyendo ahora mismo (exportación PNG, Beta). */
    getCurrentPage: () => firstVisiblePage() + 1,
    async clear() {
      if (debounceTimer) clearTimeout(debounceTimer);
      observer.disconnect();
      await cancelPreview();
      renderedGeneration = 0;
      hasRendered = false;
      setStale(false);
      pageCount = 0;
      pagesEl.replaceChildren();
      hideBand();
      setStatus('preview.idle');
    },
    /** Navegación del outline (Beta, §7.8) y del sync (RF-16). */
    scrollToPage,
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
