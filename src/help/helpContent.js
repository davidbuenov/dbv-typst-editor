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
// lista (`{ list: [...] }`), una tabla de atajos (`{ shortcuts: [[a, b]] }`)
// o la tabla completa de atajos generada desde el registro único
// (`{ shortcutRegistry: true }`, RF-80): los atajos no se escriben a mano aquí.


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
            'Los proyectos recientes aparecen en el lanzador para volver a ellos de un clic; al pasar el ratón por encima puedes eliminar de la lista con una cruz los que ya no necesites.',
          ],
          en: [
            'Bundled templates: blank project, bachelor thesis, master thesis, doctoral thesis, academic paper, technical report, presentation and CV.',
            'Choosing a template opens a form (title, author, institution, supervisor, academic year...) and those values are written into the document itself: no need to hunt for them in the code later.',
            'Recent projects are listed in the launcher so you can reopen them with one click; hovering over an entry lets you remove it with a cross if no longer needed.',
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
            'Buscar y reemplazar: el botón ⌕ abre el panel de búsqueda (también con Ctrl/Cmd + F), con reemplazo uno a uno o de todas las coincidencias a la vez.',
            'Referencias con @: al escribir @ dentro del documento aparece un listado con las figuras, tablas, ecuaciones y secciones ya etiquetadas del proyecto, filtrable mientras sigues escribiendo.',
          ],
          en: [
            'Formatting: bold, italic, strikethrough, code, superscript and subscript. Pressing twice removes the markup instead of nesting it.',
            'Structure: H1/H2/H3 headings and three list types. Switching between them on the same line replaces the marker instead of stacking it.',
            'Context aware: inside an equation ($...$) the text-formatting buttons dim and the Typst group moves to the front.',
            'Find and replace: the ⌕ button opens the search panel (also with Ctrl/Cmd + F), with one-at-a-time or replace-all.',
            'References with @: typing @ anywhere in the document brings up a list of the project’s already-labelled figures, tables, equations and sections, filterable as you keep typing.',
          ],
        },
      },
      {
        es: 'Todos los atajos de teclado, también los que trae el editor y casi nadie descubre (mover y duplicar líneas, multicursor, plegar, ir a una línea…), están en la sección «Atajos de teclado».',
        en: 'Every keyboard shortcut, including the ones the editor comes with and hardly anyone discovers (moving and duplicating lines, multiple cursors, folding, going to a line…), is in the "Keyboard shortcuts" section.',
      },
    ],
  },
  {
    id: 'atajos',
    title: { es: 'Atajos de teclado', en: 'Keyboard shortcuts' },
    blocks: [
      {
        es: 'Todos los atajos de la aplicación, agrupados por dónde actúan. Se muestran las combinaciones del sistema en el que estás: en macOS, con sus símbolos (⌘ Cmd, ⌥ Opción, ⇧ Mayús, ⌃ Control).',
        en: 'Every shortcut in the app, grouped by where it acts. The combinations shown are those of the system you are on: on macOS, with its symbols (⌘ Cmd, ⌥ Option, ⇧ Shift, ⌃ Control).',
      },
      { shortcutRegistry: true },
    ],
  },
  {
    id: 'explorador',
    title: { es: 'Archivos, capítulos y enlaces', en: 'Files, chapters and links' },
    blocks: [
      {
        es: 'El panel Archivos es un explorador completo: todo lo que antes obligaba a salir al explorador del sistema se hace desde aquí.',
        en: 'The Files panel is a full file explorer: everything that used to require the system file manager can be done from here.',
      },
      {
        list: {
          es: [
            'Crear: al pasar el ratón por el panel aparecen «Nuevo fichero», «Nueva carpeta» y «Refrescar»; actúan en la carpeta seleccionada. El botón derecho sobre una carpeta ofrece lo mismo dentro de ella.',
            'Mover: arrastra uno o varios elementos sobre otra carpeta. También puedes soltar ficheros desde el explorador del sistema sobre una carpeta del árbol para copiarlos allí.',
            'Referencias: al mover o renombrar, las rutas de #include, #import, image(), bibliography() y demás se actualizan solas en todo el proyecto. Un aviso permite ver los cambios o deshacerlo todo. Las rutas construidas o guardadas en variables no se pueden seguir: si alguna queda rota, el compilador la marca.',
            'Nuevo capítulo… (menú Archivo o botón derecho sobre una carpeta): crea el fichero con su encabezado y añade su #include al documento principal.',
            'Eliminar envía a la papelera del sistema, después de confirmar.',
            'Enlaces de la vista previa: un clic en un enlace externo lo abre en el navegador; en uno interno (índice, @referencia, cita, nota) lleva a su destino. El doble clic sigue llevando al código.',
            'Historial local…: botón derecho sobre un fichero o en el editor. Cada guardado deja una copia fuera del proyecto; se puede comparar con la actual y restaurar.',
          ],
          en: [
            'Create: hovering over the panel reveals "New file", "New folder" and "Refresh"; they act on the selected folder. Right-clicking a folder offers the same inside it.',
            'Move: drag one or more items onto another folder. You can also drop files from the system file manager onto a folder in the tree to copy them there.',
            'References: when moving or renaming, the paths in #include, #import, image(), bibliography() and the rest are updated across the whole project. A notice lets you view the changes or undo everything. Paths that are built or stored in variables cannot be followed: if one breaks, the compiler flags it.',
            'New chapter… (File menu or right-click on a folder): creates the file with its heading and adds its #include to the main document.',
            'Delete moves items to the system trash, after confirming.',
            'Preview links: clicking an external link opens it in the browser; an internal one (outline, @reference, citation, footnote) takes you to its target. Double-click still jumps to the source.',
            'Local history…: right-click a file or inside the editor. Every save leaves a copy outside the project; you can compare it with the current one and restore it.',
          ],
        },
      },
      {
        es: 'Los atajos del árbol (F2 para renombrar, Supr para eliminar, Ctrl/Cmd + clic y Mayús + clic para seleccionar) están en «Atajos de teclado».',
        en: 'The tree shortcuts (F2 to rename, Delete to remove, Ctrl/Cmd + click and Shift + click to select) are in "Keyboard shortcuts".',
      },
    ],
  },
  {
    id: 'pestanas',
    title: { es: 'Pestañas y documento principal', en: 'Tabs and main document' },
    blocks: [
      {
        es: 'Cada fichero se abre en su pestaña, encima del editor. Cambiar de pestaña conserva los cambios sin guardar, el cursor, el historial de deshacer y la posición de cada fichero, así que ya no hay que guardar para mirar otro capítulo.',
        en: 'Each file opens in its own tab, above the editor. Switching tabs keeps each file\'s unsaved changes, cursor, undo history and scroll position, so you no longer need to save to look at another chapter.',
      },
      {
        list: {
          es: [
            'Cerrar: la cruz de la pestaña, Ctrl+W (Cmd+W en macOS) o clic con la rueda. Si tiene cambios sin guardar, se pregunta.',
            'Recorrer: Ctrl+Tab y Ctrl+Mayús+Tab. Reordenar: arrastra una pestaña.',
            'Un punto junto al nombre indica cambios sin guardar. Si dos ficheros se llaman igual, se añade su carpeta.',
            'Al reabrir el proyecto vuelven las pestañas de la última vez (las de ficheros que ya no existen se omiten).',
            'Con el guardado automático encendido se guardan todas las pestañas modificadas; cerrar la ventana o el proyecto pregunta por todas las que tengan cambios.',
            'La vista previa del documento completo tiene en cuenta los cambios sin guardar de todas las pestañas (con el motor rápido).',
            'Documento principal: al marcarlo se guarda también en settings/dbv-project.toml, así viaja con el proyecto (git, otro ordenador, .dbvt). Está pensado para subirse a git; otras aplicaciones lo ignoran. Si no se puede escribir, se recuerda solo en este equipo.',
          ],
          en: [
            'Close: the tab\'s cross, Ctrl+W (Cmd+W on macOS) or a middle click. If it has unsaved changes, you are asked first.',
            'Cycle: Ctrl+Tab and Ctrl+Shift+Tab. Reorder: drag a tab.',
            'A dot next to the name marks unsaved changes. If two files share a name, their folder is added.',
            'When you reopen the project, last time\'s tabs come back (tabs for files that no longer exist are skipped).',
            'With auto-save on, every modified tab is saved; closing the window or the project asks about all tabs with changes.',
            'The full-document preview takes into account the unsaved changes of every tab (with the fast engine).',
            'Main document: marking it also saves it in settings/dbv-project.toml, so it travels with the project (git, another computer, .dbvt). It is meant to be committed to git; other applications ignore it. If it cannot be written, it is remembered on this computer only.',
          ],
        },
      },
    ],
  },
  {
    id: 'navegacion',
    title: { es: 'Navegar y refactorizar (Tinymist)', en: 'Navigate and refactor (Tinymist)' },
    blocks: [
      {
        es: 'Con Tinymist encendido (su insignia en la barra del documento), el editor entiende el código Typst del proyecto entero.',
        en: 'With Tinymist on (its badge in the document bar), the editor understands the Typst code of the whole project.',
      },
      {
        list: {
          es: [
            'Ir a la definición: F12 o Ctrl+clic (Cmd+clic) sobre una función, variable, etiqueta (@fig-x) o la ruta de un #include. Abre el destino en su pestaña. Si está en un paquete, se abre en solo lectura. Las funciones internas de Typst (box, text…) no tienen código fuente: su documentación está al pasar el ratón.',
            'Añadir un cursor ahora es Alt+clic (antes Ctrl+clic).',
            'Buscar referencias: Mayús+F12 lista todos los usos en la pestaña Buscar, agrupados por fichero.',
            'Renombrar símbolo: F2 con el foco en el editor (en el árbol, F2 renombra el fichero). Cambia el nombre en todos los ficheros, con Deshacer. Renombrar una etiqueta es aproximado: se enseña la lista antes de aplicar. Sobre la ruta de un #include, se renombra el fichero en el árbol para actualizar todas sus referencias.',
            'Acciones de código: Ctrl+. propone refactorizaciones del sitio donde está el cursor (por ejemplo, subir el nivel de un encabezado).',
            'Las etiquetas (@fig-x) solo se resuelven cuando el documento compila sin errores: si no funciona, corrige primero los errores.',
          ],
          en: [
            'Go to definition: F12 or Ctrl+click (Cmd+click) on a function, variable, label (@fig-x) or #include path. It opens the target in its tab. If it lives in a package, it opens read-only. Typst\'s built-in functions (box, text…) have no source code: their documentation shows on hover.',
            'Adding a cursor is now Alt+click (it used to be Ctrl+click).',
            'Find references: Shift+F12 lists every use in the Search tab, grouped by file.',
            'Rename symbol: F2 with focus in the editor (in the tree, F2 renames the file). It renames across all files, with Undo. Renaming a label is approximate: the list is shown before applying. On an #include path, the file is renamed in the tree so that all its references are updated.',
            'Code actions: Ctrl+. offers refactorings for the spot where the cursor is (for instance, raising a heading level).',
            'Labels (@fig-x) only resolve when the document compiles without errors: if it does not work, fix the errors first.',
          ],
        },
      },
    ],
  },
  {
    id: 'buscar',
    title: { es: 'Buscar y reemplazar en el proyecto', en: 'Find and replace across the project' },
    blocks: [
      {
        es: 'Ctrl+Mayús+F (Cmd+Mayús+F) abre la pestaña Buscar de la barra lateral. Busca en todos los ficheros de texto del proyecto; en los que tienes abiertos, sobre lo que hay en el editor, aunque no esté guardado.',
        en: 'Ctrl+Shift+F (Cmd+Shift+F) opens the Search tab in the sidebar. It searches every text file in the project; in the ones you have open, it uses what is in the editor, even if unsaved.',
      },
      {
        list: {
          es: [
            'Botones: Aa distingue mayúsculas, ab busca palabras completas y .* activa las expresiones regulares.',
            'Expresiones regulares: sintaxis del motor de Rust (regex), que no admite lookaround ni retroreferencias. En el reemplazo, $1 o ${nombre} insertan los grupos. Si la expresión no es válida, el error sale bajo el campo.',
            'Filtros: «Ficheros a incluir» y «a excluir» admiten patrones separados por comas, como *.typ o cap/**. Las carpetas ocultas solo se buscan con «Mostrar ficheros ocultos».',
            'Reemplazar: una coincidencia, todas las de un fichero o todas. Los ficheros abiertos se cambian en el editor; los cerrados se guardan con copia en el historial local, y el aviso final permite ver los cambios y deshacerlo todo.',
          ],
          en: [
            'Buttons: Aa matches case, ab matches whole words and .* turns on regular expressions.',
            'Regular expressions: Rust regex engine syntax, with no lookaround or backreferences. In the replacement, $1 or ${name} insert groups. If the expression is invalid, the error shows under the field.',
            'Filters: "Files to include" and "to exclude" take comma-separated patterns such as *.typ or cap/**. Hidden folders are only searched with "Show hidden files".',
            'Replace: one match, all matches in a file, or all of them. Open files are changed in the editor; closed ones are saved with a local history copy, and the final notice lets you view the changes and undo everything.',
          ],
        },
      },
    ],
  },
  {
    id: 'problemas',
    title: { es: 'Problemas y documentación de Typst', en: 'Problems and Typst documentation' },
    blocks: [
      {
        es: 'La pestaña Problemas de la barra lateral (o la insignia roja de la barra del documento) lista todos los errores y avisos de la última compilación, agrupados por fichero y con los errores primero: mensaje, línea, la línea de código y las pistas de Typst. Un clic lleva al sitio. Se puede filtrar por errores, avisos o el fichero activo.',
        en: 'The Problems tab in the sidebar (or the red badge on the document bar) lists every error and warning of the last compilation, grouped by file with errors first: message, line, the line of code and Typst\'s hints. One click takes you there. You can filter by errors, warnings or the active file.',
      },
      {
        es: 'La documentación oficial de Typst de la misma versión que compila la aplicación viaja con ella y funciona sin conexión: Ayuda › «Documentación de Typst», o «Ver documentación de…» en el menú contextual del editor sobre una función. El buscador entiende también términos en español («cabecera de tabla», «pie de figura»).',
        en: 'The official Typst documentation for the same version the app compiles with ships with it and works offline: Help › "Typst documentation", or "View documentation for…" in the editor context menu on a function.',
      },
    ],
  },
  {
    id: 'datos',
    title: { es: 'Visor de datos (CSV/TSV)', en: 'Data viewer (CSV/TSV)' },
    blocks: [
      {
        es: 'Herramientas › «Visor de datos…», o el botón «Tabla» con un .csv abierto, enseñan el fichero como tabla: detecta el separador y la cabecera, ordena al pulsar una columna (como número si lo es) y filtra. «Insertar como tabla» escribe en el documento Typst activo el código que lee el fichero con csv(), así la tabla sigue al fichero; «Copiar como tabla Typst» copia la vista con los datos incrustados. Un fichero de fuera del proyecto se puede copiar a data/.',
        en: 'Tools › "Data viewer…", or the "Table" button with a .csv open, show the file as a table: it detects the delimiter and the header, sorts when you click a column (numerically if it is a number) and filters. "Insert as table" writes into the active Typst document code that reads the file with csv(), so the table follows the file; "Copy as Typst table" copies the view with the data embedded. A file outside the project can be copied into data/.',
      },
    ],
  },
  {
    id: 'ia',
    title: { es: 'Asistente de IA (opcional)', en: 'AI assistant (optional)' },
    blocks: [
      {
        es: 'La IA es opcional: sin conectar ninguna, el editor funciona igual que siempre. Herramientas › «Conectar una IA…» detecta lo que hay en el equipo y lo conecta con un botón:',
        en: 'AI is optional: without one, the editor works exactly as before. Tools › "Connect an AI…" detects what is on your computer and connects it with one button:',
      },
      {
        list: {
          es: [
            'Local: Ollama o LM Studio, o cualquier servidor compatible con OpenAI. Nada sale de tu equipo.',
            'En la nube, con clave de API: Anthropic (Claude), OpenAI, Google Gemini u OpenRouter. La clave se guarda en el almacén de credenciales del sistema, nunca en un fichero.',
            'Agentes instalados: Claude Code, Gemini CLI, Codex o Copilot CLI. Usan tu suscripción a través del propio agente (una suscripción no da clave de API).',
          ],
          en: [
            'Local: Ollama or LM Studio, or any OpenAI-compatible server. Nothing leaves your computer.',
            'In the cloud, with an API key: Anthropic (Claude), OpenAI, Google Gemini or OpenRouter. The key is stored in the system credential store, never in a file.',
            'Installed agents: Claude Code, Gemini CLI, Codex or Copilot CLI. They use your subscription through the agent itself (a subscription does not give an API key).',
          ],
        },
      },
      {
        es: 'El panel de la IA se abre con el botón «IA» junto a P/E/V. Dice a dónde va lo que envías y qué contexto se manda (fichero abierto, selección, problemas, esquema, ficheros mencionados con @, la página de la vista previa); puedes quitar cualquier elemento. La primera vez que un proyecto se va a enviar a la nube, se pregunta.',
        en: 'The AI panel opens with the "AI" button next to P/E/V. It shows where your data goes and what context is sent (open file, selection, problems, outline, files mentioned with @, the preview page); you can remove any item. The first time a project would be sent to the cloud, you are asked.',
      },
      {
        es: 'La IA nunca escribe sin que lo veas: propone cambios (también en varios ficheros, o ficheros nuevos), DBV los compila en memoria y te dice si compilan, y tú aceptas o rechazas cada trozo, puedes retocar el texto y verlo en la vista previa antes de aplicar; después, Deshacer. Con un agente, cada edición llega como petición de permiso con su diff, y al acabar se listan los ficheros que cambió con Deshacer.',
        en: 'The AI never writes without you seeing it: it proposes changes (across several files, or new files), DBV compiles them in memory and tells you whether they compile, and you accept or reject each hunk, can edit the text and see it in the preview before applying; then, Undo. With an agent, every edit arrives as a permission request with its diff, and afterwards the files it changed are listed with Undo.',
      },
      {
        es: 'Ctrl+Mayús+I (o «IA…» en el menú contextual) actúa sobre la selección o el párrafo: mejorar, corregir, traducir, acortar, ampliar, convertir a tabla o lista, explicar o lo que pidas. En Problemas, «Explicar y arreglar» resuelve un error con una propuesta comprobada.',
        en: 'Ctrl+Shift+I (or "AI…" in the context menu) works on the selection or the paragraph: improve, fix, translate, shorten, expand, convert to table or list, explain, or anything you ask. In Problems, "Explain and fix" solves an error with a checked proposal.',
      },
    ],
  },
  {
    id: 'snippets',
    title: { es: 'Snippets', en: 'Snippets' },
    blocks: [
      {
        es: 'Un snippet es un trozo de texto con huecos que se inserta al escribir su prefijo y elegirlo en la lista de sugerencias; Tab salta de un hueco al siguiente. Funcionan también con Tinymist apagado.',
        en: 'A snippet is a piece of text with placeholders that is inserted by typing its prefix and choosing it from the suggestion list; Tab jumps from one placeholder to the next. They also work with Tinymist off.',
      },
      {
        list: {
          es: [
            'Herramientas › Editar snippets globales: los tuyos, para todos los proyectos.',
            'Herramientas › Editar snippets del proyecto: se guardan en .vscode/*.code-snippets, igual que en VS Code, para compartirlos con quien trabaje en el proyecto.',
            'Formato de VS Code: prefix, body (texto o lista de líneas), description y, si quieres, scope. Puedes pegar snippets copiados de VS Code. Se admiten comentarios.',
            'Variables: $TM_SELECTED_TEXT, $TM_FILENAME, $TM_FILENAME_BASE, $CURRENT_YEAR, $CURRENT_MONTH, $CURRENT_DATE.',
            'Guardar selección como snippet… (botón derecho en el editor): crea uno a partir del texto seleccionado, sin tocar el resto del fichero.',
            'Si el fichero tiene un error, se avisa con la línea y se siguen usando los snippets anteriores.',
          ],
          en: [
            'Tools › Edit global snippets: your own, for every project.',
            'Tools › Edit project snippets: stored in .vscode/*.code-snippets, as in VS Code, to share them with whoever works on the project.',
            'VS Code format: prefix, body (text or list of lines), description and, optionally, scope. You can paste snippets copied from VS Code. Comments are allowed.',
            'Variables: $TM_SELECTED_TEXT, $TM_FILENAME, $TM_FILENAME_BASE, $CURRENT_YEAR, $CURRENT_MONTH, $CURRENT_DATE.',
            'Save selection as snippet… (right-click in the editor): creates one from the selected text, without touching the rest of the file.',
            'If the file has an error, you are told the line and the previous snippets are still used.',
          ],
        },
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
            'Figura: despliega las imágenes ya existentes en la carpeta images/ o permite examinar el equipo para añadir una nueva (se copia automáticamente a images/ sin sobrescribir). También puedes arrastrar archivos de imagen directamente sobre el editor.',
          ],
          en: [
            'Citation: drops down the actual keys from the project .bib file, filterable as you type. At the end of the list, "New bibliography entry" opens a form (article, book, proceedings, thesis, master thesis or other) that suggests a key from author and year, warns if it already exists, appends it to refs.bib and inserts the citation at the cursor.',
            'Σ (symbols): a gallery of maths symbols with a text filter. Inside an equation it inserts the bare name; outside, it wraps it in $...$ automatically.',
            'Table: asks for rows, columns and whether it has a header. The header uses the official table.header(...) form and the cursor lands in the first body cell.',
            'Figure: lists existing images in the project images/ folder or lets you browse your computer to add a new one (copied automatically to images/ without overwriting). You can also drag image files directly onto the editor.',
          ],
        },
      },
    ],
  },
  {
    id: 'diagramas',
    title: { es: 'Editor de diagramas', en: 'Diagram editor' },
    blocks: [
      {
        es: 'En el menú Herramientas → Editor de diagramas (✎, también accesible desde el icono de la barra del editor): un lienzo donde arrastrar y conectar nodos (rectángulo, redondeado, elipse, rombo de decisión, triángulo, hexágono), con seis colores, zoom con rueda y botones, y paneo arrastrando el fondo. Las plantillas de siembra ("Flujo", "Bloques", "Flujo con decisión"...) dan un punto de partida ya conectado. Al insertar, se genera con el paquete cetz y se añade su import si hace falta.',
        en: 'In the Tools menu → Diagram editor (✎, also reachable from the editor toolbar icon): a canvas where you drag and connect nodes (rectangle, rounded, ellipse, decision diamond, triangle, hexagon), with six colors, wheel/button zoom, and panning by dragging the background. The seed templates ("Flowchart", "Blocks", "Flow with decision"...) give an already-connected starting point. Inserting generates the diagram with the cetz package, adding its import if needed.',
      },
      {
        docLink: {
          url: 'https://cetz-package.github.io/docs/',
          label: { es: 'Manual del paquete cetz', en: 'cetz package manual' },
        },
      },
    ],
  },
  {
    id: 'ecuaciones',
    title: { es: 'Editor visual de ecuaciones', en: 'Visual equation editor' },
    blocks: [
      {
        es: 'En el menú Herramientas → Editor de ecuaciones (∑): un campo de texto con el código de la fórmula y, justo debajo, su vista previa REAL — compilada por Typst en cada pausa, no aproximada por otra librería.',
        en: 'In the Tools menu → Equation editor (∑): a text field with the formula code and, right below it, its REAL preview — compiled by Typst on every pause, not approximated by another library.',
      },
      {
        list: {
          es: [
            'Las piezas (fracción, exponente, sumatorio, integral, matriz, símbolos griegos, delimitadores...) se insertan en la posición del cursor del campo de texto, igual que la barra del editor principal.',
            '"Pegar LaTeX": para quien ya tiene una fórmula escrita en sintaxis LaTeX. Se convierte con el paquete MiTeX y se añade el import correspondiente solo si hace falta.',
            'La ecuación no entra en el documento hasta pulsar "Insertar" — hasta entonces se puede seguir ajustando sin ningún efecto sobre el texto.',
          ],
          en: [
            'The pieces (fraction, exponent, summation, integral, matrix, Greek symbols, delimiters...) are inserted at the text field\'s cursor position, just like the main editor toolbar.',
            '"Paste LaTeX": for anyone who already has a formula written in LaTeX syntax. It is converted with the MiTeX package, adding the needed import only when required.',
            'The equation is not added to the document until you press "Insert" — until then you can keep adjusting it with no effect on the text.',
          ],
        },
      },
      {
        docLink: {
          url: 'https://typst.app/docs/reference/math/',
          label: { es: 'Referencia de matemáticas de Typst', en: 'Typst math reference' },
        },
      },
    ],
  },
  {
    id: 'secuencia',
    title: { es: 'Diagramas de secuencia', en: 'Sequence diagrams' },
    blocks: [
      {
        es: 'En el menú Herramientas → Diagrama de secuencia (⇄): añade participantes y, entre ellos, los mensajes en el orden en que ocurren (con texto opcional y trazo discontinuo para respuestas). Al insertar, se genera con el paquete chronos y se añade su import si hace falta.',
        en: 'In the Tools menu → Sequence diagram (⇄): add participants and, between them, the messages in the order they happen (with optional text and a dashed stroke for replies). Inserting generates the diagram with the chronos package, adding its import if needed.',
      },
      {
        docLink: {
          url: 'https://typst.app/universe/package/chronos',
          label: { es: 'Documentación del paquete chronos', en: 'chronos package documentation' },
        },
      },
    ],
  },
  {
    id: 'gantt',
    title: { es: 'Diagramas de Gantt', en: 'Gantt charts' },
    blocks: [
      {
        es: 'En el menú Herramientas → Diagrama de Gantt (▤): añade tareas con su nombre y sus fechas reales de inicio y fin. Al insertar, se genera con el paquete gantty y se añade su import si hace falta.',
        en: 'In the Tools menu → Gantt chart (▤): add tasks with their name and their real start and end dates. Inserting generates the diagram with the gantty package, adding its import if needed.',
      },
      {
        docLink: {
          url: 'https://typst.app/universe/package/gantty',
          label: { es: 'Documentación del paquete gantty', en: 'gantty package documentation' },
        },
      },
    ],
  },
  {
    id: 'kanban',
    title: { es: 'Tableros Kanban', en: 'Kanban boards' },
    blocks: [
      {
        es: 'En el menú Herramientas → Tablero Kanban (▥): añade columnas y, dentro de cada una, sus tarjetas (nombre, asignado opcional, dificultad y prioridad). Al insertar, se genera con el paquete kantan (licencia AGPL-3.0-only) y se añade su import si hace falta.',
        en: 'In the Tools menu → Kanban board (▥): add columns and, inside each one, its cards (name, optional assignee, hardness and priority). Inserting generates the board with the kantan package (AGPL-3.0-only license), adding its import if needed.',
      },
      {
        docLink: {
          url: 'https://typst.app/universe/package/kantan',
          label: { es: 'Documentación del paquete kantan', en: 'kantan package documentation' },
        },
      },
    ],
  },
  {
    id: 'dot',
    title: { es: 'DOT / Graphviz', en: 'DOT / Graphviz' },
    blocks: [
      {
        es: 'En el menú Herramientas → DOT/Graphviz: un campo de texto donde escribir o pegar un grafo en sintaxis DOT, con su vista previa REAL justo debajo — compilada por Typst en cada pausa, igual que el editor de ecuaciones. A diferencia de los demás asistentes de esta versión, aquí no hay ninguna ayuda visual para construir el grafo: el propio texto DOT ES el contenido, así que si no conoces esa sintaxis, esta es la chuleta mínima para empezar.',
        en: 'In the Tools menu → DOT/Graphviz: a text field where you write or paste a graph in DOT syntax, with its REAL preview right below — compiled by Typst on every pause, just like the equation editor. Unlike the other assistants in this version, there is no visual help building the graph here: the DOT text itself IS the content, so if you do not know that syntax, here is the minimal cheat sheet to get started.',
      },
      {
        list: {
          es: [
            'digraph { a -> b -> c } — un grafo dirigido con dos flechas encadenadas, a hacia b y b hacia c.',
            'graph { a -- b } — un grafo NO dirigido usa graph y -- en vez de digraph y ->.',
            'a -> b [label="sí"] — una etiqueta de texto sobre una flecha, entre corchetes.',
            'a [shape=box, color=blue] — atributos de un nodo concreto (forma, color...) entre corchetes, tras su nombre.',
            'Cada sentencia separada por punto y coma o salto de línea; los nombres con espacios van entre comillas ("nodo uno").',
          ],
          en: [
            'digraph { a -> b -> c } — a directed graph with two chained arrows, a to b and b to c.',
            'graph { a -- b } — an UNdirected graph uses graph and -- instead of digraph and ->.',
            'a -> b [label="yes"] — a text label on an arrow, in brackets.',
            'a [shape=box, color=blue] — attributes of a specific node (shape, color...) in brackets, after its name.',
            'Each statement separated by a semicolon or newline; names with spaces go in quotes ("node one").',
          ],
        },
      },
      {
        es: 'Útil también para quien ya tiene un .dot exportado de otra herramienta (Graphviz, un generador de esquemas de base de datos...): se pega tal cual. Al insertar, se genera con el paquete diagraph y se añade su import si hace falta.',
        en: 'Also useful for anyone who already has a .dot file exported from another tool (Graphviz, a database schema generator...): paste it as-is. Inserting generates the graph with the diagraph package, adding its import if needed.',
      },
      {
        docLink: {
          url: 'https://graphviz.org/documentation/',
          label: { es: 'Documentación oficial de Graphviz', en: 'Official Graphviz documentation' },
        },
      },
    ],
  },
  {
    id: 'vista-previa',
    title: { es: 'Vista previa', en: 'Preview' },
    blocks: [
      {
        es: 'La vista previa muestra el documento compuesto de verdad, con sincronización interactiva con el editor y modos de compilación adaptables.',
        en: 'The preview shows the actually typeset document, with interactive synchronization with the editor and adaptable compilation modes.',
      },
      {
        list: {
          es: [
            'Ámbito de compilación (Doc / Fich): compila el documento raíz (main.typ) o únicamente el archivo abierto. Compilar el documento completo mantiene el contexto de capítulos, etiquetas y referencias bibliográficas mientras editas módulos sueltos.',
            'Modo de refresco (Automático / Manual): el modo automático recompila mientras escribes; el modo manual (botón Refrescar) ahorra CPU y batería en documentos muy extensos.',
            'Sincronización bidireccional: haz doble clic en cualquier punto de la vista previa para navegar de inmediato a ese archivo y línea en el editor. El botón con icono de chincheta (Llevar la vista previa al cursor) desplaza la vista previa a la página donde se encuentra el cursor de edición.',
            'Indicador de carga: al abrir un proyecto o desplazarte velozmente por documentos extensos, un indicador animado señala que la página se está componiendo.',
            'Zoom: los botones − y + recorren pasos fijos; el porcentaje del centro vuelve al 100%. Con el ratón sobre la vista previa, Ctrl + +/-/0 o Ctrl + rueda hacen lo mismo sin soltar el teclado.',
            'Ajustar al ancho (↔): calcula el zoom necesario para que la página ocupe todo el panel, y lo recalcula solo si cambias el tamaño de la ventana o muestras/ocultas paneles.',
            'Si el documento tiene un error de sintaxis, la vista previa NO se borra: se mantiene la última versión correcta y el problema aparece en la banda inferior.',
            'Esa banda se puede agrandar arrastrando su borde superior, para leer mensajes largos.',
            'Un clic en un encabezado del panel Esquema lleva la vista previa a esa página y posición. El esquema lista los encabezados que irían en el índice (los marcados con outlined: false no salen) y se actualiza con cada compilación; si el documento tiene errores, conserva el último esquema bueno y avisa de que puede estar desactualizado.',
            'Buscar en la vista previa: con el foco en ella, Ctrl+F (Cmd+F) busca en todas las páginas del documento renderizado; Intro y Mayús+Intro recorren las coincidencias.',
            'Copiar texto: arrastra sobre una página para seleccionar y pulsa Ctrl+C (Cmd+C), o usa Copiar del botón derecho. Buscar y copiar necesitan el motor rápido.',
          ],
          en: [
            'Compilation scope (Doc / File): compiles either the root document (main.typ) or only the currently open file. Compiling the full document preserves cross-references, chapters, and bibliography context while editing modular files.',
            'Refresh mode (Automatic / Manual): automatic mode recompiles as you type; manual mode (Refresh button) saves CPU and battery on very long documents.',
            'Bidirectional sync: double-click anywhere on the preview to jump straight to that file and line in the editor. The pin button (Take preview to cursor) scrolls the preview to the current cursor position.',
            'Loading indicator: when opening a project or scrolling rapidly through long documents, an animated spinner indicates that pages are being rendered.',
            'Zoom: the − and + buttons step through fixed levels; the percentage in the middle resets to 100%. With the mouse over the preview, Ctrl + +/-/0 or Ctrl + wheel do the same without leaving the keyboard.',
            'Fit width (↔): computes the zoom needed for the page to fill the panel, and recomputes it automatically if you resize the window or show/hide panels.',
            'If the document has a syntax error the preview is NOT cleared: the last good version stays on screen and the problem is shown in the bottom band.',
            'That band can be made taller by dragging its top edge, to read long messages.',
            'Clicking a heading in the Outline panel takes the preview to that page and position. The outline lists the headings that would go in the table of contents (those marked outlined: false are left out) and updates with every compilation; if the document has errors, it keeps the last good outline and warns that it may be out of date.',
            'Find in the preview: with focus on it, Ctrl+F (Cmd+F) searches every page of the rendered document; Enter and Shift+Enter move through the matches.',
            'Copy text: drag over a page to select and press Ctrl+C (Cmd+C), or use Copy from the right-click menu. Find and copy need the fast engine.',
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
            'El selector Claro/Oscuro/Sepia cambia el tema visual al instante.',
            'El selector ES/EN cambia el idioma de toda la interfaz, incluida esta ayuda.',
            'Tema, idioma, anchos de panel, nivel de zoom y proyectos recientes se recuerdan entre sesiones.',
          ],
          en: [
            'The Light/Dark/Sepia selector switches the visual theme instantly.',
            'The ES/EN selector switches the language of the whole interface, including this help.',
            'Theme, language, panel widths, zoom level and recent projects are remembered between sessions.',
          ],
        },
      },
    ],
  },
];
