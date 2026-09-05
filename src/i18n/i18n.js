// =============================================================================
// DBV Typst Editor — Internacionalización (ES / EN)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Diccionario propio, sin librería externa: mismo patrón que
// dbv-md-reader/src/i18n.js (ARCHITECTURE.md §3 fila 14), adaptado a ESM.

const STORAGE_KEY = 'dbv-typst-lang';

const DICTIONARIES = {
  es: {
    'app.tagline': 'Escritura académica y técnica, sencilla. Con Typst.',
    'action.toggleTheme': 'Cambiar tema claro/oscuro',
    'action.toggleLang': 'Cambiar idioma',
    'action.about': 'Acerca de',
    'action.close': 'Cerrar',
    'action.openFolder': 'Abrir carpeta de proyecto',
    'action.openFile': 'Abrir documento .typ',
    'action.reveal': 'Mostrar en el explorador',
    'action.exportArchive': 'Exportar proyecto (.dbvt)',
    'action.importArchive': 'Importar proyecto (.dbvt)',
    'action.closeProject': 'Cerrar proyecto',
    'action.save': 'Guardar',
    'action.saveAs': 'Guardar como…',
    'action.exportPdf': 'Exportar PDF',
    'action.newProject': 'Nuevo proyecto',
    'action.cancel': 'Cancelar',
    'scaffold.appVersion': 'Versión',
    'scaffold.platform': 'Plataforma',
    'scaffold.typst': 'Compilador Typst',
    'about.title': 'DBV Typst Editor',
    'about.text':
      'El entorno de escritorio más accesible para el ecosistema Typst. Proyecto en construcción.',
    'typst.embedded': '(embebido)',
    'typst.fail': 'sidecar no disponible',
    'empty.heading': '¿Qué quieres escribir hoy?',
    'empty.text':
      'Elige una plantilla y rellena cuatro datos, o abre algo que ya tengas: una carpeta de proyecto —incluido un repositorio clonado o un proyecto Typst hecho a mano— o un documento .typ suelto.',
    'launcher.templates': 'Empezar desde una plantilla',
    'launcher.open': 'O abrir algo que ya existe',
    'launcher.noTemplates': 'No se ha encontrado el catálogo de plantillas.',
    'wizard.projectName': 'Nombre del proyecto',
    'wizard.projectNamePlaceholder': 'Mi trabajo de fin de grado',
    'wizard.location': 'Se creará en',
    'wizard.noLocation': 'sin elegir',
    'wizard.browse': 'Elegir carpeta…',
    'wizard.create': 'Crear proyecto',
    'wizard.created': 'Proyecto creado.',
    'wizard.nameRequired': 'Ponle un nombre al proyecto.',
    'wizard.locationRequired': 'Elige la carpeta donde crearlo.',
    'wizard.fieldsInvalid': 'Revisa los campos marcados.',
    'wizard.folderExists': 'Ya existe una carpeta con ese nombre',
    'wizard.createError': 'No se ha podido crear el proyecto',
    'recent.title': 'Proyectos recientes',
    'recent.empty': 'Todavía no has abierto ningún proyecto.',
    'tree.title': 'Proyecto',
    'tree.filter': 'Filtrar…',
    'tree.empty': 'La carpeta está vacía.',
    'tree.error': 'No se ha podido leer la carpeta.',
    'tree.noProject': 'Sin proyecto abierto.',
    'project.none': 'Sin proyecto',
    'project.dbv': 'proyecto DBV',
    'project.external': 'proyecto externo',
    'project.singleFile': 'documento suelto',
    'project.openError': 'No se ha podido abrir el proyecto',
    'project.noEntrypoint': 'La carpeta no contiene ningún documento .typ.',
    'doc.unsaved': 'sin guardar',
    'doc.openError': 'No se ha podido abrir el documento',
    'doc.discardTitle': 'Hay cambios sin guardar',
    'doc.discardConfirm': 'Si continúas, se perderán los cambios que no has guardado en:',
    'doc.discardAction': 'Descartar los cambios',
    'doc.saved': 'Documento guardado.',
    'export.working': 'Generando el PDF…',
    'export.done': 'PDF exportado en',
    'export.failed': 'No se ha podido exportar el PDF',
    'archive.exportWorking': 'Empaquetando el proyecto…',
    'archive.exportDone': 'Proyecto exportado en',
    'archive.exportFailed': 'No se ha podido exportar el proyecto',
    'archive.importWorking': 'Importando el proyecto…',
    'archive.importFailed': 'No se ha podido importar el proyecto',
    'doc.saveError': 'No se ha podido guardar',
    'conflict.title': 'El documento ha cambiado fuera del editor',
    'conflict.text':
      'Otro programa ha modificado este fichero mientras lo editabas. Puedes conservar tu versión o descartarla y recargar la del disco.',
    'conflict.saveText':
      'Otro programa ha modificado este fichero desde que lo abriste. Si guardas, sus cambios se perderán.',
    'conflict.keepMine': 'Conservar mis cambios',
    'conflict.reload': 'Recargar desde el disco',
    'conflict.overwrite': 'Sobrescribir de todos modos',
    'conflict.reloaded': 'El documento se ha recargado desde el disco.',
    'preview.title': 'Vista previa',
    'preview.idle': 'Sin documento',
    'preview.compiling': 'Compilando…',
    'preview.pages': 'páginas:',
    'preview.failed': 'Error de compilación',
    'preview.error': 'El documento no ha compilado.',
    'preview.zoomIn': 'Acercar',
    'preview.zoomOut': 'Alejar',
    'preview.zoomReset': 'Zoom original',
    'toolbar.bold': 'Negrita',
    'toolbar.italic': 'Cursiva',
    'toolbar.strike': 'Tachado',
    'toolbar.code': 'Código en línea',
    'toolbar.superscript': 'Superíndice',
    'toolbar.subscript': 'Subíndice',
    'toolbar.heading1': 'Encabezado 1',
    'toolbar.heading2': 'Encabezado 2',
    'toolbar.heading3': 'Encabezado 3',
    'toolbar.bulletList': 'Lista con viñetas',
    'toolbar.numberedList': 'Lista numerada',
    'toolbar.termList': 'Lista de términos',
    'toolbar.link': 'Enlace',
    'toolbar.figure': 'Imagen / figura',
    'toolbar.quote': 'Cita en bloque',
    'toolbar.codeBlock': 'Bloque de código',
    'toolbar.table': 'Tabla',
    'toolbar.hr': 'Regla horizontal',
    'toolbar.equationInline': 'Ecuación en línea',
    'toolbar.equationBlock': 'Ecuación en bloque',
    'toolbar.label': 'Etiqueta',
    'toolbar.crossRef': 'Referencia cruzada',
    'toolbar.citation': 'Cita bibliográfica',
    'toolbar.bibliography': 'Bibliografía',
    'toolbar.pagebreak': 'Salto de página',
  },
  en: {
    'app.tagline': 'Academic and technical writing made simple. Powered by Typst.',
    'action.toggleTheme': 'Toggle light/dark theme',
    'action.toggleLang': 'Switch language',
    'action.about': 'About',
    'action.close': 'Close',
    'action.openFolder': 'Open project folder',
    'action.openFile': 'Open .typ document',
    'action.reveal': 'Show in file manager',
    'action.exportArchive': 'Export project (.dbvt)',
    'action.importArchive': 'Import project (.dbvt)',
    'action.closeProject': 'Close project',
    'action.save': 'Save',
    'action.saveAs': 'Save as…',
    'action.exportPdf': 'Export PDF',
    'action.newProject': 'New project',
    'action.cancel': 'Cancel',
    'scaffold.appVersion': 'Version',
    'scaffold.platform': 'Platform',
    'scaffold.typst': 'Typst compiler',
    'about.title': 'DBV Typst Editor',
    'about.text':
      'The most user-friendly desktop environment for the Typst ecosystem. Work in progress.',
    'typst.embedded': '(embedded)',
    'typst.fail': 'sidecar unavailable',
    'empty.heading': 'What do you want to write today?',
    'empty.text':
      'Pick a template and fill in a few details, or open something you already have: a project folder — including a cloned repository or a hand-made Typst project — or a standalone .typ document.',
    'launcher.templates': 'Start from a template',
    'launcher.open': 'Or open something that already exists',
    'launcher.noTemplates': 'The template catalogue was not found.',
    'wizard.projectName': 'Project name',
    'wizard.projectNamePlaceholder': 'My final year project',
    'wizard.location': 'Will be created in',
    'wizard.noLocation': 'not chosen',
    'wizard.browse': 'Choose folder…',
    'wizard.create': 'Create project',
    'wizard.created': 'Project created.',
    'wizard.nameRequired': 'Give the project a name.',
    'wizard.locationRequired': 'Choose the folder to create it in.',
    'wizard.fieldsInvalid': 'Check the highlighted fields.',
    'wizard.folderExists': 'A folder with that name already exists',
    'wizard.createError': 'The project could not be created',
    'recent.title': 'Recent projects',
    'recent.empty': 'You have not opened any project yet.',
    'tree.title': 'Project',
    'tree.filter': 'Filter…',
    'tree.empty': 'This folder is empty.',
    'tree.error': 'The folder could not be read.',
    'tree.noProject': 'No project open.',
    'project.none': 'No project',
    'project.dbv': 'DBV project',
    'project.external': 'external project',
    'project.singleFile': 'standalone document',
    'project.openError': 'The project could not be opened',
    'project.noEntrypoint': 'This folder contains no .typ document.',
    'doc.unsaved': 'unsaved',
    'doc.openError': 'The document could not be opened',
    'doc.discardTitle': 'There are unsaved changes',
    'doc.discardConfirm': 'If you continue, the unsaved changes will be lost in:',
    'doc.discardAction': 'Discard changes',
    'doc.saved': 'Document saved.',
    'export.working': 'Generating the PDF…',
    'export.done': 'PDF exported to',
    'export.failed': 'The PDF could not be exported',
    'archive.exportWorking': 'Packaging the project…',
    'archive.exportDone': 'Project exported to',
    'archive.exportFailed': 'The project could not be exported',
    'archive.importWorking': 'Importing the project…',
    'archive.importFailed': 'The project could not be imported',
    'doc.saveError': 'The document could not be saved',
    'conflict.title': 'The document changed outside the editor',
    'conflict.text':
      'Another program modified this file while you were editing it. You can keep your version or discard it and reload the one on disk.',
    'conflict.saveText':
      'Another program has modified this file since you opened it. Saving will overwrite those changes.',
    'conflict.keepMine': 'Keep my changes',
    'conflict.reload': 'Reload from disk',
    'conflict.overwrite': 'Overwrite anyway',
    'conflict.reloaded': 'The document was reloaded from disk.',
    'preview.title': 'Preview',
    'preview.idle': 'No document',
    'preview.compiling': 'Compiling…',
    'preview.pages': 'pages:',
    'preview.failed': 'Compilation error',
    'preview.error': 'The document did not compile.',
    'preview.zoomIn': 'Zoom in',
    'preview.zoomOut': 'Zoom out',
    'preview.zoomReset': 'Reset zoom',
    'toolbar.bold': 'Bold',
    'toolbar.italic': 'Italic',
    'toolbar.strike': 'Strikethrough',
    'toolbar.code': 'Inline code',
    'toolbar.superscript': 'Superscript',
    'toolbar.subscript': 'Subscript',
    'toolbar.heading1': 'Heading 1',
    'toolbar.heading2': 'Heading 2',
    'toolbar.heading3': 'Heading 3',
    'toolbar.bulletList': 'Bulleted list',
    'toolbar.numberedList': 'Numbered list',
    'toolbar.termList': 'Term list',
    'toolbar.link': 'Link',
    'toolbar.figure': 'Image / figure',
    'toolbar.quote': 'Block quote',
    'toolbar.codeBlock': 'Code block',
    'toolbar.table': 'Table',
    'toolbar.hr': 'Horizontal rule',
    'toolbar.equationInline': 'Inline equation',
    'toolbar.equationBlock': 'Block equation',
    'toolbar.label': 'Label',
    'toolbar.crossRef': 'Cross-reference',
    'toolbar.citation': 'Citation',
    'toolbar.bibliography': 'Bibliography',
    'toolbar.pagebreak': 'Page break',
  },
};

/** @returns {'es'|'en'} Idioma persistido, o el del sistema, o 'es'. */
function resolveInitialLanguage() {
  let resolved = 'es';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') {
      resolved = stored;
    } else if (typeof navigator !== 'undefined' && navigator.language?.startsWith('en')) {
      resolved = 'en';
    }
  } catch {
    // localStorage puede lanzar (modo privado, políticas del WebView): el
    // idioma por defecto es suficiente, no es motivo para romper el arranque.
  }
  return resolved;
}

let currentLanguage = resolveInitialLanguage();

/** @returns {'es'|'en'} */
export function getLanguage() {
  return currentLanguage;
}

/**
 * Traduce una clave. Devuelve la propia clave si no existe, para que una
 * traducción olvidada sea visible en la UI en vez de dejar un hueco en blanco.
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  return DICTIONARIES[currentLanguage][key] ?? key;
}

/**
 * Cambia el idioma activo y vuelve a aplicar las traducciones al DOM.
 * @param {'es'|'en'} language
 */
export function setLanguage(language) {
  if (language !== 'es' && language !== 'en') return;
  currentLanguage = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Ver comentario en resolveInitialLanguage().
  }
  applyTranslations();
  // Los textos que un módulo escribe a mano con t() (estados vacíos, listas
  // repintadas) no llevan atributo `data-i18n`: este evento es su única forma
  // de enterarse del cambio de idioma.
  document.dispatchEvent(new CustomEvent('dbv-lang-changed', { detail: language }));
}

/** Alterna entre los dos idiomas soportados. @returns {'es'|'en'} */
export function toggleLanguage() {
  setLanguage(currentLanguage === 'es' ? 'en' : 'es');
  return currentLanguage;
}

/**
 * Aplica las traducciones a los elementos marcados con `data-i18n`
 * (contenido), `data-i18n-title` (tooltip / etiqueta accesible) y
 * `data-i18n-placeholder` (campos de texto).
 */
export function applyTranslations(root = document) {
  document.documentElement.lang = currentLanguage;

  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    const label = t(el.dataset.i18nTitle);
    el.title = label;
    el.setAttribute('aria-label', label);
  }
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
}
