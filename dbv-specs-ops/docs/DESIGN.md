# 🎨 Sistema de Diseño: DBV Typst Editor

> **Fase:** `/spec` — deuda documental consciente saldada el 2026-09-09
> **Estado:** 📐 **DESCRIPTIVO v1.0** — este documento **no inventa** un sistema visual: describe el que ya existe y está en producción desde el MVP, leído de `src/themes/tokens.css`, `base.css` y `layout.css`. Todo valor de aquí está hoy en el código. Lo que aún no cumple el sistema está en §9, marcado como deuda.
> **Fuente:** `src/themes/tokens.css` (74 declaraciones, 3 temas) · `base.css` (1417 líneas) · `layout.css` (1395 líneas)
> **Última revisión:** 2026-09-09

---

## 1. Por qué existe este documento

El sistema visual del editor es coherente y está razonado —cada decisión tiene su comentario en el CSS— pero hasta ahora solo vivía en el código. Eso funcionó mientras la interfaz creció despacio. Con v0.5.0 entraron de golpe ~1000 líneas de CSS nuevo (Git, diagnósticos, galería, Python, CeTZ) y aparecieron las primeras grietas: una paleta de estado ajena a los tokens, un token referenciado que no existe y transiciones con el valor a mano (§9). Este documento fija el sistema **antes** de rediseñar el lanzador, para que ese trabajo amplíe el sistema en vez de abrirle más excepciones.

**La regla que resume todo lo demás:** ningún color literal fuera de `tokens.css`. Si un componente necesita un color que no está, el arreglo es añadir el token a los **tres** temas, no escribir el hex.

---

## 2. Los tres temas no son decoración

`tokens.css` define claro, oscuro y sepia. El oscuro es también el `:root` por defecto. Los tres se seleccionan con `[data-theme]` en el elemento raíz y **todos los componentes deben verse correctos en los tres** — no es un modo secundario: sepia entró por petición de un usuario real y es el que más rompe las suposiciones, porque su paleta es cálida y estrecha.

El mejor ejemplo de por qué esto importa está ya en el código, en el token `--band-hint`. En sepia, `--accent` (`#8b4513`) y `--code-tag` (`#7a4419`) son dos marrones casi idénticos: en la banda de vista previa, la pista de la aplicación y el error real del compilador **se veían del mismo color**, y lo reportó un usuario. La solución no fue tocar `--accent` (que se usa en toda la interfaz), sino crear un token semántico propio y darle en sepia un azul frío ausente del resto de esa paleta. Ese es el patrón a imitar: **cuando dos cosas deben distinguirse, el token es semántico y cada tema decide su valor.**

### 2.1. Tokens de color

| Token | Oscuro (por defecto) | Claro | Sepia | Para qué |
| --- | --- | --- | --- | --- |
| `--bg-primary` | `#0d1117` | `#ffffff` | `#faf3e0` | Fondo del lienzo, campos de entrada, superficies hundidas |
| `--bg-secondary` | `#161b22` | `#f6f8fa` | `#f2e8cc` | Tarjetas, modales, paneles — la superficie elevada por defecto |
| `--bg-tertiary` | `#21262d` | `#eaeef2` | `#e8d9b5` | Botones en reposo, píldora activa del selector segmentado |
| `--text-primary` | `#e6edf3` | `#1f2328` | `#3b2c1a` | Texto principal |
| `--text-secondary` | `#8b949e` | `#57606a` | `#6b5240` | Descripciones, texto de apoyo |
| `--text-muted` | `#6e7681` | `#8c959f` | `#9c7e65` | Metadatos, epígrafes, marcas de agua |
| `--accent` | `#58a6ff` | `#0969da` | `#8b4513` | Acción principal, foco, selección |
| `--accent-hover` | `#79c0ff` | `#0550ae` | `#6b340f` | Estado activo del acento |
| `--border` | `#30363d` | `#d0d7de` | `#d4bc8a` | Todos los bordes de 1px |
| `--code-bg` | `#161b22` | `#f6f8fa` | `#f2e8cc` | Fondo del editor y de bloques de código |
| `--quote-bg` | acento al 8 % | acento al 5 % | acento al 7 % | Realces suaves |
| `--shadow` | negro al 40 % | negro al 12 % | negro al 15 % | Color de sombra de modales y elevación |
| `--band-hint` | `= --accent` | `= --accent` | `#3d6b99` | Pista de la app en la banda de vista previa (ver arriba) |

Los ocho tokens `--code-*` (`keyword`, `string`, `comment`, `function`, `number`, `tag`, `class`, `operator`) alimentan el tema de CodeMirror 6 leyéndolos con `var(--…)` desde `editor.js`. **Un tema nuevo no necesita tocar ningún fichero JavaScript**: basta con añadir su bloque a `tokens.css`. Esa propiedad es deliberada y conviene no perderla.

---

## 3. Tipografía

Dos pilas, ambas del sistema. **No hay `@import` de Google Fonts a propósito**: el original del que se portó esto (DBV Markdown Reader) dependía de la red para su tipografía, lo que contradice el objetivo offline-first del producto.

```css
--font-ui:   -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'JetBrains Mono', 'Cascadia Code', Consolas, 'SF Mono', Menlo, monospace;
```

La escala real en uso, por frecuencia, es densa y de aplicación de escritorio — no de página web:

| Tamaño | Uso | Ejemplo en el código |
| --- | --- | --- |
| 24 px | Titular del lanzador, **una sola vez por pantalla** | `.launcher__heading` |
| 18 px | Título de un modal grande | `.template-gallery__titles .modal__title` |
| 16 px | Título de modal estándar | `.modal__title` |
| 14 px | Texto de control: botones, nombre de tarjeta | `.button`, `.template-card__name` |
| 13 px | Cuerpo dentro de superficies densas, campos de búsqueda | `.template-gallery__search-input` |
| 12 px | Descripciones, epígrafes, selector segmentado | `.template-card__description` |
| 11 px | Metadatos, casi siempre en `--font-mono` | `.template-card__meta` |
| 10 px | Insignias y contadores | varios |

`--font-mono` no es solo para código: marca **identificadores** (versiones, `@preview/…`, rutas). Es una señal semántica, no un capricho estético — cuando algo es copiable o literal, va en monoespaciada.

Pesos: 600 para nombres y elementos activos, 700 solo en el título de la galería, normal para el resto. Los epígrafes de sección usan `text-transform: uppercase` con `letter-spacing: 0.06em` a 12 px y `--text-muted` (`.launcher__subheading`) — es el patrón de "EMPEZAR DESDE UNA PLANTILLA".

---

## 4. Espaciado, radios y elevación

El espaciado es una escala de 2 px sin tokenizar, dominada por **4 / 6 / 8 / 10 / 12 / 16 px**. Los valores grandes (24, 28, 32, 48) aparecen solo en el lanzador, que es la única pantalla con aire.

- **Radio:** `--radius: 8px` para todo. Los elementos anidados dentro de una superficie ya redondeada usan `calc(var(--radius) - 2px)` (`.template-card__thumbnail`) y los muy pequeños, 6 px o 3 px literales.
- **Borde:** siempre `1px solid var(--border)`. No hay bordes de 2 px salvo en el anillo de foco.
- **Elevación**, en tres niveles y siempre con `--shadow` salvo donde se indica:
  - tarjeta al pasar el cursor → `0 6px 16px rgba(0, 0, 0, 0.12)`
  - modal estándar → `0 12px 32px var(--shadow)`
  - modal de galería → `0 20px 48px var(--shadow)`
- **Velo de modal:** `rgba(0, 0, 0, 0.45)`, `z-index: 30`.

---

## 5. Movimiento

```css
--transition: 120ms ease;
```

Un único valor para toda la interfaz, y es **rápido a propósito**: esto es una aplicación de escritorio, no una web con animaciones de entrada. Se anima solo lo que responde al puntero —`background`, `border-color`, `transform`, `box-shadow`— y nunca la geometría del layout. La única transformación en uso es `translateY(-2px)` al pasar el cursor sobre una tarjeta, más `scale(1.03)` en su miniatura.

---

## 6. Componentes

### 6.1. Botones

Una base común (`.button`, `.icon-button`) y modificadores:

| Clase | Aspecto | Cuándo |
| --- | --- | --- |
| `.button` | Fondo `--bg-tertiary`, borde, 14 px, `padding: 6px 14px` | Acción por defecto |
| `.button--primary` | Relleno de acento | **Una por pantalla**, la acción que se espera |
| `.button--ghost` | Fondo transparente | Acción secundaria junto a otras |
| `.button--compact` | 12 px, `padding: 2px 10px` | Barras densas |
| `.button--danger` | Borde y texto en `--code-tag` | Destructivo |
| `.button--icon-label` | Icono de 15 px + palabra, `gap: 6px` | Cabecera |
| `.icon-button` | Cuadrado de 32 px | Herramientas de la cabecera |

`.button--icon-label` merece una nota, porque su origen es una lección: antes había frases completas ("Mostrar en el explorador", "Exportar proyecto (.dbvt)") y **la cabecera dejaba de caber en pantallas normales**. Se sustituyeron por pictograma + palabra clave tras una sesión de uso real. Al añadir acciones a la cabecera, ese es el formato.

### 6.2. Selector segmentado

Dos o tres opciones dentro de una sola píldora (`.segmented-control`), con la activa resaltada mediante `--bg-tertiary` y peso 600. Se usa para tema (Claro/Oscuro/Sepia) e idioma (ES/EN). Es más legible que un botón de alternancia en cuanto hay tres opciones, y se aplica también al par de dos por consistencia.

### 6.3. Tarjeta de plantilla

`.template-card`: columna con `gap: 10px` y `padding: 12px` sobre `--bg-secondary`. Miniatura de 140 px de alto sobre `--bg-primary`, nombre a 14/600, descripción a 12 px en `--text-secondary`, y metadatos a 11 px monoespaciados empujados al fondo con `margin-top: auto` — así todas las tarjetas de una fila alinean su pie aunque las descripciones midan distinto. La rejilla es `repeat(auto-fill, minmax(220px, 1fr))` con `gap: 12px`.

### 6.4. Modales

Tres tamaños sobre el mismo `.modal__card`: estándar `min(520px, 100vw - 32px)`, ancho `620px` para formularios, y galería `min(1080px, …) × min(780px, …)` con cuerpo en rejilla `340px 1fr`. Las acciones van abajo a la derecha (`.modal__actions`, `justify-content: flex-end`, `gap: 8px`), con la primaria a la derecha del todo.

### 6.5. Paneles flotantes

`.floating-panel` y sus variantes (`--picker`, `--symbols`, `--table`, `--cetz`, `--universe`, `--bib-entry`) son desplegables anclados a su botón de origen, no modales. Se usan cuando la elección es corta y el contexto del documento debe seguir visible. **Criterio de cuándo usar cada cosa:** si hay que ver algo del documento mientras se elige, es panel flotante; si la elección merece la pantalla entera, es modal.

### 6.6. Pestañas

Dos implementaciones con el mismo lenguaje: `.sidebar-tab` (Archivos/Esquema) y las pestañas internas del panel de Universe (Plantillas/Paquetes). Activa = `--text-primary` sobre fondo elevado; inactiva = `--text-muted`.

---

## 7. Interacción y accesibilidad

- **Hover:** el fondo se aclara a `--bg-primary` y el borde pasa a `--accent`. Nunca se mueve el texto.
- **Foco:** `outline: 2px solid var(--accent)` con `outline-offset: 2px`, siempre con `:focus-visible` (nunca `:focus`, para no marcar al ratón). **No se elimina el contorno sin sustituirlo** por otra señal igual de visible; donde se hace (`.template-gallery__search-input`) se compensa con borde de acento más un anillo de `box-shadow`.
- **Selección:** `.is-selected` / `.active` / `aria-pressed="true"` según el componente. La interfaz ya usa `role="tab"` y `aria-pressed`; los controles nuevos deben mantenerlo.
- Todo lo pulsable es un `<button>` real, no un `<div>` con `click`. Es lo que hace que funcione el teclado sin trabajo extra.

---

## 8. Verificación

El diseño de esta aplicación tiene una comprobación ejecutable que **no** es un test unitario:

```bash
npm run verify:layout
```

Abre el esqueleto real del shell con las hojas de estilo reales en Chromium sin interfaz y comprueba la geometría de las cajas en las 7 combinaciones de paneles. Existe por un fallo real que ni Vitest (jsdom no calcula layout), ni `verify:frontend`, ni `vite build` podían ver: un `place-items: center` heredado del andamiaje del "Hola mundo" que quedó inerte durante meses hasta que Chromium implementó `justify-items` para cajas de bloque y empezó a centrarlo todo, dejando media ventana vacía.

**Al tocar layout, esta comprobación es obligatoria.** No se puede ejecutar en cualquier máquina (necesita un Chrome o Edge cuyo `--dump-dom` funcione); si aquí se omite, hay que ejecutarla en CI antes de entregar.

---

## 9. Deuda registrada (lo que hoy NO cumple este documento)

Detectado al escribir este documento, leyendo el CSS. Ninguno rompe nada visible en oscuro o claro; todos se notan en sepia o al cambiar de tema.

1. **Paleta de estado fuera del sistema de tokens.** Con las funciones de v0.5.0 entró una paleta de tipo Tailwind escrita a mano: `#10b981` (éxito), `#ef4444` (error), `#f59e0b` (aviso), `#3b82f6` (info), `#64748b`, `#ca8a04`, más sus variantes `rgba(…, 0.12)`. Aparece en el indicador de Git, los diagnósticos del LSP y el estado del actualizador. **No cambian con el tema**, así que en sepia son cuatro colores fríos y saturados en medio de una paleta cálida — exactamente el problema que `--band-hint` resolvió en su día. **Arreglo:** cuatro tokens semánticos (`--status-ok`, `--status-warn`, `--status-error`, `--status-info`) definidos en los tres temas.
2. **`--accent-subtle` se usa pero no existe.** En `layout.css:1148` se lee `var(--accent-subtle, rgba(2, 132, 199, 0.15))`: como el token nunca se declaró, **siempre gana el respaldo**, que es un azul fijo. El anillo de foco del buscador de la galería es azul incluso en sepia. Ya existe `--quote-bg`, que es justo "el acento muy diluido" en cada tema, así que puede resolverse sin inventar nada nuevo.
3. **Dos transiciones con el valor a mano** (`0.15s ease`) en lugar de `var(--transition)` (120 ms), ambas en el buscador de la galería. Cosmético, pero es por donde se deshacen los sistemas.
4. **La escala de espaciado no está tokenizada.** Es consistente en la práctica (múltiplos de 2, con 4/8/12 dominando), pero nada lo impone. No se propone cambiarlo ahora: tocar el espaciado de 2800 líneas de CSS sin `verify:layout` operativo es justo el tipo de cambio que este proyecto ha aprendido a no hacer a ciegas.

---

## 10. Reglas para el rediseño del lanzador

Restricciones que cualquier propuesta visual debe respetar. Existen porque cada una nace de algo que ya pasó en este proyecto:

1. **Un solo camino para cada trabajo.** Hoy hay tres superficies para elegir plantilla, y la rejilla del inicio solo sirve para abrir la galería, que muestra lo mismo con más información.
2. **Elegir plantilla y añadir un paquete son trabajos distintos.** Lo primero crea un proyecto y pertenece al lanzador; lo segundo se importa en el documento abierto y pertenece al editor. Fusionarlos recrea el problema que se está arreglando.
3. **Lista revisada + campo libre.** Es una decisión editorial ya tomada (`ARCHITECTURE.md` §6): el catálogo curado protege de código de terceros, y el campo `@preview/nombre:version` deja pasar a quien sabe lo que hace. Cualquier diseño nuevo mantiene las dos vías y el aviso de código de terceros.
4. **Nada de color literal.** Los componentes nuevos usan tokens, y si falta uno se añade a los tres temas.
5. **Sepia se comprueba.** Una maqueta validada solo en oscuro no está validada.
6. **Sin dependencias de red.** Ni fuentes, ni iconos remotos: el producto es offline-first y las miniaturas ya son SVG generados en local.

---

> 🛠️ Framework SDD creado por **[David Bueno Vallejo](https://github.com/davidbuenov)** · [dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops)

## 11. v0.9.0: componentes nuevos (menú contextual, Problemas, marca de sincronización, insignia de lenguaje)

Reglas para los cuatro componentes que trae `SPECIFICATIONS.md` §5i. Ninguno introduce un color, una fuente ni una sombra que no esté ya en los tokens.

- **Menú contextual del editor (RF-58).** Misma pieza que el menú del árbol de ficheros (`.tree-context-menu` + `.menu-item`): fondo `--bg-secondary`, borde `--border`, radio `--radius`, sombra `--shadow`, `z-index` por encima de los paneles flotantes. La primera entrada, **Ir a la vista previa**, lleva su atajo alineado a la derecha en `--text-muted`; los elementos desactivados usan la opacidad de `.menu-item:disabled`. Se coloca contra el puntero y se recoloca dentro de la ventana; foco visible con el mismo contorno `--accent`.
- **Panel de Problemas (RF-59).** Vive junto a la banda de mensajes de la vista previa, no en una ventana aparte. Cada fila: icono de gravedad (`--status-error` / `--status-warn`), mensaje, y `fichero:línea` en `--text-muted`. Recuento en la barra de estado con los mismos colores de estado que la insignia de Tinymist. Sin animación de entrada.
- **Marca de sincronización (RF-57).** Palabra o frase resaltada con `--accent-subtle` y un trazo de `--accent`; **una caja por línea** cuando la selección ocupa varias. Se desvanece a los 2 s animando **solo el fondo** (nunca la opacidad de la línea del editor: haría desaparecer el texto) y respeta `prefers-reduced-motion`.
- **Insignia de lenguaje (RF-60).** Junto al nombre del documento, con el estilo de la insignia de Tinymist (`.document__lsp-badge`) en su variante neutra (`--text-muted` sobre `--bg-tertiary`). Solo el nombre ("C++", "Python"…), sin icono de marca.
- **Resaltado de código de otros lenguajes (RF-60).** Solo los tokens `--code-*` ya definidos para Typst, para que los tres temas (claro, oscuro y sepia) funcionen sin trabajo extra. `verify:layout` sigue prohibiendo los colores literales fuera de `tokens.css`.

