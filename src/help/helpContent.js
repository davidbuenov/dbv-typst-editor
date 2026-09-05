// =============================================================================
// DBV Typst Editor — Contenido de la ayuda (ES / EN)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El contenido vive aquí como DATO, no como marcado: `help.js` es una capa de
// render fina, igual que `toolbar.js` lo es sobre `toolbarActions.js`. Así la
// ayuda se puede revisar y traducir leyendo un único fichero, y añadir una
// sección no obliga a tocar nada más.
//
// No va en `i18n/i18n.js` a propósito: aquel diccionario es de etiquetas
// cortas de interfaz (una línea por clave) y meter aquí párrafos enteros lo
// haría ilegible para las dos cosas.
//
// Cada sección: `title` y `blocks`. Un bloque es un párrafo (string), una
// lista (`{ list: [...] }`) o una tabla de atajos (`{ shortcuts: [[a, b]] }`).

/** @typedef {{es: string, en: string}} Bilingue */

export const HELP_SECTIONS = [
  {
    id: 'inicio',
    title: { es: 'Empezar un documento', en: 'Starting a document' },
    blocks: [
      {
        es: 'La aplicación no se abre con un documento en blanco: se abre con un lanzador donde eliges qué quieres hacer. Puedes crear un proyecto desde una plantilla, abrir una carpeta que ya exista, abrir un fichero .typ suelto o importar un proyecto empaquetado (.dbvt).',
        en: 'The app does not open on a blank document: it opens on a launcher where you choose what you want to do. You can create a project from a template, open an existing folder, open a single .typ file, or import a packaged project (.dbvt).',
      },
      {
        list: {
          es: [
            'Plantillas incluidas: proyecto en blanco, TFG, TFM, tesis doctoral, artículo académico, informe técnico, presentación y currículum.',
            'Al elegir una plantilla se abre un formulario (título, autor, institución, tutor, curso...) y esos datos se escriben ya dentro del documento: no hay que buscarlos luego en el código.',
            'Los proyectos recientes aparecen en el lanzador para volver a ellos de un clic.',
          ],
          en: [
            'Bundled templates: blank project, bachelor thesis, master thesis, doctoral thesis, academic paper, technical report, presentation and CV.',
            'Choosing a template opens a form (title, author, institution, supervisor, academic year...) and those values are written into the document itself: no need to hunt for them in the code later.',
            'Recent projects are listed in the launcher so you can reopen them with one click.',
          ],
        },
      },
      {
        es: 'Un proyecto creado aquí es un proyecto Typst normal y corriente: compila con el compilador oficial sin necesidad de esta aplicación. No hay ataduras.',
        en: 'A project created here is an ordinary Typst project: it compiles with the official compiler without this application. There is no lock-in.',
      },
    ],
  },
  {
    id: 'paneles',
    title: { es: 'Los tres paneles', en: 'The three panels' },
    blocks: [
      {
        es: 'La ventana tiene tres paneles y cada uno se enciende o se apaga por su cuenta con los botones P / E / V de la cabecera. Los que queden visibles se reparten siempre todo el ancho.',
        en: 'The window has three panels, and each one toggles independently with the P / E / V buttons in the header. Whichever ones stay visible always share the full width.',
      },
      {
        list: {
          es: [
            'P — Proyecto: el panel lateral, con dos pestañas, Archivos (el árbol del proyecto) y Esquema (los encabezados del documento).',
            'E — Editor: el documento con su barra de herramientas.',
            'V — Vista previa: el documento compuesto, página a página.',
            'Las divisiones entre paneles se arrastran con el ratón; doble clic sobre una devuelve el reparto por defecto.',
            'La combinación elegida se recuerda al cerrar la aplicación.',
          ],
          en: [
            'P — Project: the side panel, with two tabs, Files (the project tree) and Outline (the document headings).',
            'E — Editor: the document with its toolbar.',
            'V — Preview: the typeset document, page by page.',
            'The dividers between panels can be dragged; double-clicking one restores the default split.',
            'Your chosen combination is remembered when you close the app.',
          ],
        },
      },
    ],
  },
  {
    id: 'editor',
    title: { es: 'Escribir: la barra de herramientas', en: 'Writing: the toolbar' },
    blocks: [
      {
        es: 'La barra sobre el editor inserta el marcado por ti, para que no tengas que aprenderte la sintaxis de Typst si no quieres. Funciona con texto seleccionado (lo envuelve) y sin seleccionar (deja el cursor en su sitio).',
        en: 'The toolbar above the editor inserts markup for you, so you do not have to learn Typst syntax unless you want to. It works with text selected (wrapping it) and without selection (leaving the cursor in place).',
      },
      {
        list: {
          es: [
            'Formato: negrita, cursiva, tachado, código, superíndice y subíndice. Pulsar dos veces quita el marcado en vez de anidarlo.',
            'Estructura: encabezados H1/H2/H3 y tres tipos de lista. Cambiar de una a otra en la misma línea sustituye el marcador, no lo apila.',
            'Sensibilidad al contexto: dentro de una ecuación ($...$) los botones de formato de texto se atenúan y el grupo de Typst pasa al frente.',
          ],
          en: [
            'Formatting: bold, italic, strikethrough, code, superscript and subscript. Pressing twice removes the markup instead of nesting it.',
            'Structure: H1/H2/H3 headings and three list types. Switching between them on the same line replaces the marker instead of stacking it.',
            'Context aware: inside an equation ($...$) the text-formatting buttons dim and the Typst group moves to the front.',
          ],
        },
      },
      {
        shortcuts: [
          ['Ctrl/Cmd + B', { es: 'Negrita', en: 'Bold' }],
          ['Ctrl/Cmd + I', { es: 'Cursiva', en: 'Italic' }],
          ['Ctrl/Cmd + E', { es: 'Código en línea', en: 'Inline code' }],
          ['Ctrl/Cmd + K', { es: 'Enlace', en: 'Link' }],
          ['Ctrl/Cmd + Shift + 1/2/3', { es: 'Encabezado de nivel 1, 2 o 3', en: 'Heading level 1, 2 or 3' }],
          ['Ctrl/Cmd + S', { es: 'Guardar', en: 'Save' }],
          ['Esc', { es: 'Cerrar el panel abierto', en: 'Close the open panel' }],
        ],
      },
    ],
  },
  {
    id: 'asistentes',
    title: { es: 'Asistentes de inserción', en: 'Insertion assistants' },
    blocks: [
      {
        es: 'Cuatro botones de la barra no insertan marcado directamente: abren un pequeño asistente.',
        en: 'Four toolbar buttons do not insert markup directly: they open a small assistant.',
      },
      {
        list: {
          es: [
            'Cita: despliega las claves reales del fichero .bib del proyecto, filtrables escribiendo. Al final de la lista, "Nueva entrada bibliográfica" abre un formulario (artículo, libro, actas, tesis, TFM u otro) que sugiere la clave a partir del autor y el año, avisa si ya existe, la añade a refs.bib e inserta la cita donde estaba el cursor.',
            'Σ (símbolos): galería de símbolos matemáticos con filtro de texto. Dentro de una ecuación inserta el nombre a secas; fuera, lo envuelve en $...$ automáticamente.',
            'Tabla: pregunta filas, columnas y si lleva cabecera. La cabecera usa la forma oficial table.header(...) y el cursor cae en la primera celda del cuerpo.',
            'Figura: abre un selector de imagen; el fichero se copia a la carpeta images/ del proyecto (sin sobrescribir nada) y se inserta la figura con su pie. También puedes arrastrar una imagen desde el explorador del sistema directamente sobre el editor.',
          ],
          en: [
            'Citation: drops down the actual keys from the project .bib file, filterable as you type. At the end of the list, "New bibliography entry" opens a form (article, book, proceedings, thesis, master thesis or other) that suggests a key from author and year, warns if it already exists, appends it to refs.bib and inserts the citation at the cursor.',
            'Σ (symbols): a gallery of maths symbols with a text filter. Inside an equation it inserts the bare name; outside, it wraps it in $...$ automatically.',
            'Table: asks for rows, columns and whether it has a header. The header uses the official table.header(...) form and the cursor lands in the first body cell.',
            'Figure: opens an image picker; the file is copied into the project images/ folder (never overwriting anything) and the figure is inserted with its caption. You can also drag an image from your file manager straight onto the editor.',
          ],
        },
      },
    ],
  },
  {
    id: 'vista-previa',
    title: { es: 'Vista previa', en: 'Preview' },
    blocks: [
      {
        es: 'La vista previa se actualiza sola mientras escribes, sin guardar. Muestra el documento compuesto de verdad, no una aproximación.',
        en: 'The preview updates by itself as you type, without saving. It shows the actually typeset document, not an approximation.',
      },
      {
        list: {
          es: [
            'Zoom: los botones − y + recorren pasos fijos; el porcentaje del centro vuelve al 100%.',
            'Ajustar al ancho (↔): calcula el zoom necesario para que la página ocupe todo el panel, y lo recalcula solo si cambias el tamaño de la ventana o muestras/ocultas paneles.',
            'Si el documento tiene un error de sintaxis, la vista previa NO se borra: se mantiene la última versión correcta y el problema aparece en la banda inferior.',
            'Esa banda se puede agrandar arrastrando su borde superior, para leer mensajes largos.',
            'Un clic en un encabezado del panel Esquema lleva la vista previa a esa página y posición.',
          ],
          en: [
            'Zoom: the − and + buttons step through fixed levels; the percentage in the middle resets to 100%.',
            'Fit width (↔): computes the zoom needed for the page to fill the panel, and recomputes it automatically if you resize the window or show/hide panels.',
            'If the document has a syntax error the preview is NOT cleared: the last good version stays on screen and the problem is shown in the bottom band.',
            'That band can be made taller by dragging its top edge, to read long messages.',
            'Clicking a heading in the Outline panel takes the preview to that page and position.',
          ],
        },
      },
    ],
  },
  {
    id: 'guardar',
    title: { es: 'Guardar y exportar', en: 'Saving and exporting' },
    blocks: [
      {
        list: {
          es: [
            'Guardar / Guardar como: si alguien modifica el fichero desde fuera de la aplicación mientras lo editas, se te avisa antes de pisar nada.',
            'Exportar PDF: el documento final, con su índice y sus enlaces internos.',
            'Exportar PNG: exporta la página que estás leyendo en ese momento en la vista previa, no necesariamente la primera.',
            'Exportar proyecto (.dbvt): empaqueta el proyecto entero —capítulos, imágenes, bibliografía y fuentes propias— en un único fichero para compartirlo o guardarlo como copia. Se recupera con "Importar proyecto" desde el lanzador.',
          ],
          en: [
            'Save / Save as: if someone modifies the file outside the app while you are editing, you are warned before anything is overwritten.',
            'Export PDF: the final document, with its outline and internal links.',
            'Export PNG: exports the page you are currently reading in the preview, not necessarily the first one.',
            'Export project (.dbvt): packs the whole project — chapters, images, bibliography and its own fonts — into a single file to share or keep as a backup. Restore it with "Import project" from the launcher.',
          ],
        },
      },
    ],
  },
  {
    id: 'fuentes',
    title: { es: 'Fuentes propias del proyecto', en: 'Project fonts' },
    blocks: [
      {
        es: 'Si un proyecto necesita una tipografía que no está instalada en el ordenador, no hace falta instalarla: crea una carpeta llamada fonts/ en la raíz del proyecto y pon dentro los ficheros .ttf o .otf. La aplicación se los pasa al compilador automáticamente.',
        en: 'If a project needs a typeface that is not installed on the computer, there is no need to install it: create a folder named fonts/ at the root of the project and drop the .ttf or .otf files in it. The app passes them to the compiler automatically.',
      },
      {
        list: {
          es: [
            'Se suma a las fuentes del sistema, no las sustituye: puedes mezclar unas y otras.',
            'Se busca también dentro de subcarpetas.',
            'Esa carpeta viaja dentro del .dbvt al exportar, así que quien reciba el proyecto lo verá igual sin instalar nada.',
          ],
          en: [
            'It adds to your system fonts rather than replacing them: you can mix both.',
            'Subfolders are searched too.',
            'The folder travels inside the .dbvt when exporting, so whoever receives the project sees it identically without installing anything.',
          ],
        },
      },
    ],
  },
  {
    id: 'paquetes',
    title: { es: 'Typst Universe: plantillas y paquetes', en: 'Typst Universe: templates and packages' },
    blocks: [
      {
        es: 'El botón ✦ de la cabecera abre el catálogo de la comunidad, con dos pestañas. Plantillas crea un proyecto nuevo; Paquetes añade la importación al documento que tengas abierto.',
        en: 'The ✦ button in the header opens the community catalogue, with two tabs. Templates creates a new project; Packages adds the import to the document you have open.',
      },
      {
        list: {
          es: [
            'La lista que se ve está revisada: formatos IEEE, ACM y Springer, plantillas de libro, currículum y carta, y paquetes de uso habitual (dibujo, diagramas, presentaciones, código, tablas, glosario, pseudocódigo...).',
            'En el campo del final puedes escribir cualquier identificador de Universe, por ejemplo @preview/cetz:0.5.2, aunque no esté en la lista.',
            'Cada tarjeta muestra el identificador y la licencia: es código de terceros y conviene saber qué se instala.',
            'Un paquete se inserta siempre al principio del documento, después de las importaciones que ya haya, y no se duplica si ya estaba.',
            'La descarga la hace el compilador la primera vez y queda en caché: a partir de ahí funciona sin conexión.',
          ],
          en: [
            'The list shown is reviewed: IEEE, ACM and Springer formats, book, resume and letter templates, and commonly used packages (drawing, diagrams, presentations, code, tables, glossary, pseudocode...).',
            'In the field at the bottom you can type any Universe identifier, for example @preview/cetz:0.5.2, even if it is not on the list.',
            'Each card shows the identifier and the licence: it is third-party code and it is worth knowing what you are installing.',
            'A package is always inserted at the top of the document, after any existing imports, and is not duplicated if already there.',
            'The compiler downloads it the first time and caches it: from then on it works offline.',
          ],
        },
      },
      {
        es: 'Una diferencia a tener en cuenta: las plantillas de la comunidad no traen el formulario de datos que sí tienen las plantillas propias de la aplicación, así que solo se te pedirá el nombre del proyecto y dónde crearlo.',
        en: 'One difference worth knowing: community templates do not carry the data form that the app’s own templates have, so you will only be asked for the project name and where to create it.',
      },
    ],
  },
  {
    id: 'terminal',
    title: { es: 'Terminal avanzado', en: 'Advanced terminal' },
    blocks: [
      {
        es: 'El botón >_ de la cabecera abre una vía directa al compilador Typst para quien la necesite: escribe un subcomando oficial y pulsa Intro. Por ejemplo fonts (lista las tipografías disponibles) o --version. La ventana se puede mover arrastrando su cabecera, limpiar y cerrar.',
        en: 'The >_ button in the header opens a direct line to the Typst compiler for those who want it: type an official subcommand and press Enter. For example fonts (lists available typefaces) or --version. The window can be moved by dragging its header, cleared and closed.',
      },
      {
        es: 'No es una consola del sistema: solo ejecuta el compilador que la propia aplicación lleva dentro, sobre el proyecto abierto.',
        en: 'It is not a system shell: it only runs the compiler bundled with the app, against the open project.',
      },
    ],
  },
  {
    id: 'apariencia',
    title: { es: 'Apariencia e idioma', en: 'Appearance and language' },
    blocks: [
      {
        list: {
          es: [
            'El botón ◐ alterna entre tema claro y oscuro.',
            'El botón ES/EN cambia el idioma de toda la interfaz, incluida esta ayuda.',
            'Tema, idioma, anchos de panel, nivel de zoom y proyectos recientes se recuerdan entre sesiones.',
          ],
          en: [
            'The ◐ button toggles between light and dark theme.',
            'The ES/EN button switches the language of the whole interface, including this help.',
            'Theme, language, panel widths, zoom level and recent projects are remembered between sessions.',
          ],
        },
      },
    ],
  },
];
