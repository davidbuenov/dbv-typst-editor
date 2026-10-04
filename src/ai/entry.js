// =============================================================================
// DBV Typst Editor — Entrada de la IA: lo ÚNICO que se carga al arrancar (RNF-IA.1)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Sin ninguna IA configurada, la interfaz es la de siempre más una entrada
// «Conectar una IA…» en Herramientas, y el código de la IA no se descarga: este
// módulo solo lee la lista de conexiones (un fichero local) y, si hay alguna y
// las funciones de IA están visibles, importa `aiApp.js` bajo demanda. El
// paquete inicial del frontend no crece (se comprueba en /test).

/** Ctrl+Mayús+I (Cmd en macOS): la IA en línea (RF-95.1, atajo `aiInline` de RF-80). */
export function isAiInlineShortcut(event) {
  return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'i';
}

/**
 * @param {object} deps Lo que necesita `aiApp.js`, más `aiConnections` y `connectButton`.
 */
export function initAi(deps) {
  let app = null;
  let loading = null;
  let pendingProject = null;
  const listeners = new Set();

  function load(initialFile) {
    loading ??= import('./aiApp.js').then(({ createAiApp }) => {
      app = createAiApp({ ...deps, initialFile });
      if (pendingProject) app.onProjectOpened(pendingProject);
      for (const listener of listeners) listener(app);
      return app;
    });
    return loading;
  }

  async function start() {
    const loaded = await deps.backend.aiConnections();
    const file = loaded.ok ? loaded.value : { connections: [], active: null, showAi: true };
    if (file.connections.length && file.showAi !== false) await load(file);
    return file;
  }

  let startup = start();

  deps.connectButton.addEventListener('click', async () => {
    const file = await startup;
    const ready = await load(file);
    ready.openConnect();
  });


  return {
    /** Se abrió un proyecto (antes o después de cargar la IA). */
    onProjectOpened(project) {
      pendingProject = project;
      app?.onProjectOpened(project);
    },
    onProjectClosed() {
      pendingProject = null;
      app?.onProjectClosed();
    },
    /**
     * Herramientas › «Aplicar plantilla…» (RF-116): aplica la plantilla de Universe que el usuario eligió en la galería.
     * No es una función de IA y funciona sin ninguna conectada; el módulo se carga al usarlo, así que el paquete inicial
     * no crece.
     */
    async applyTemplate(template) {
      const ready = await load(await startup);
      ready.applyTemplate(template);
    },
    /** La IA ya está cargada y lista para pedirle algo. */
    get app() {
      return app?.isReady() ? app : null;
    },
    /** Avisa cuando la IA se carga (para enganchar menús y Problemas). */
    onLoaded(listener) {
      listeners.add(listener);
      if (app) listener(app);
    },
    /** Vuelve a leer las conexiones (p. ej. tras cambiarlas en otra ventana). */
    reload() {
      startup = start();
      return startup;
    },
  };
}
