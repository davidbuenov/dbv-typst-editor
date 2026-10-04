// =============================================================================
// DBV Typst Editor — Estado del editor para agentes MCP (RF-117)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El servidor MCP (otro proceso, lanzado por el agente) pregunta a la aplicación por el estado de la interfaz. Rust
// emite `mcp-state-request`; este módulo lo contesta con una FOTO de solo lectura: pestañas con su texto sin guardar,
// documento activo, cursor, selección, esquema y problemas. Rust vuelve a confinarla y acotarla antes de entregarla.
//
// Compartir el estado es un ajuste aparte, desactivado por defecto (`mcpShareState`): con él apagado, el canal responde
// «desactivado». Mientras un agente pregunta, una insignia lo indica y permite cortarlo.
//
// Además un agente puede PEDIR instalar un paquete de Typst Universe (herramienta `install_package`): la aplicación
// siempre pregunta al usuario en un diálogo antes de descargar nada (RNF-IA.9.4), también con el estado sin compartir.

const BADGE_MS = 60_000;

/**
 * La foto del editor. Las rutas van RELATIVAS al proyecto; lo que queda fuera de él no se incluye (RF-117.5).
 * `workspace.getOpenTextsWithState()` da rutas absolutas y `dirty` por pestaña.
 */
export function buildEditorState({ workspace, relativeToRoot, projectRoot, getProblems, getOutline }) {
  const tabs = [];
  for (const doc of workspace.getOpenTextsWithState()) {
    const path = relativeToRoot(projectRoot, doc.path);
    if (path) tabs.push({ path, content: doc.content, unsaved: Boolean(doc.dirty) });
  }
  const activePath = workspace.getDocumentPath();
  const active = activePath ? relativeToRoot(projectRoot, activePath) : null;
  const view = workspace.getEditorView();
  let cursor = null;
  let selection = '';
  if (view && active) {
    const { main } = view.state.selection;
    const line = view.state.doc.lineAt(main.head);
    cursor = { line: line.number, column: main.head - line.from + 1 };
    selection = view.state.sliceDoc(main.from, main.to);
  }
  const problems = getProblems().map((p) => ({ level: p.level, file: p.file, line: p.line ?? p.startLine, message: p.message }));
  return { tabs, active: active || null, cursor, selection, outline: getOutline(), problems };
}

/**
 * @param {object} deps
 * @param {{ on: Function, mcpBridgeConfigure: Function, mcpStateReply: Function }} deps.backend
 * @param {object} deps.workspace
 * @param {(root: string, path: string) => string|null} deps.relativeToRoot
 * @param {() => object[]} deps.getProblems
 * @param {() => object[]} deps.getOutline
 * @param {() => boolean} deps.isShared El ajuste `mcpShareState`.
 * @param {() => void} deps.stopSharing Apaga el ajuste (la insignia lo corta con esto).
 * @param {(id: string) => Promise<boolean>} deps.confirmInstall Pregunta al usuario si permite instalar el paquete.
 * @param {(id: string) => Promise<{ok: boolean, error?: {message: string}}>} deps.installPackage Instala el paquete.
 * @param {HTMLElement} deps.badge
 */
export function initMcpBridge(deps) {
  const { backend, workspace, badge } = deps;
  let hideTimer = null;

  const projectRoot = () => workspace.state.project?.root ?? null;

  function hideBadge() {
    clearTimeout(hideTimer);
    badge.classList.add('hidden');
  }

  function showBadge() {
    badge.classList.remove('hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBadge, BADGE_MS);
  }

  /** Dice a Rust qué proyecto está abierto y si el usuario comparte el estado del editor. */
  async function configure() {
    const root = projectRoot();
    await backend.mcpBridgeConfigure(root, Boolean(root) && deps.isShared());
    if (!root) hideBadge();
  }

  badge.addEventListener('click', () => {
    deps.stopSharing();
    hideBadge();
  });

  backend.on('mcp-agent-connected', showBadge);
  backend.on('mcp-state-request', async ({ id }) => {
    const root = deps.isShared() ? projectRoot() : null;
    // Si el ajuste se apagó entre la petición y aquí, no se entrega nada: Rust agota el tiempo y lo dice.
    if (!root) return;
    const snapshot = buildEditorState({ workspace, relativeToRoot: deps.relativeToRoot, projectRoot: root, getProblems: deps.getProblems, getOutline: deps.getOutline });
    await backend.mcpStateReply(id, snapshot);
  });

  backend.on('mcp-install-request', async ({ id, package: pkg }) => {
    // Nada se descarga sin que el usuario lo vea y lo permita (RNF-IA.9.4).
    const allowed = projectRoot() ? await deps.confirmInstall(pkg) : false;
    if (!allowed) {
      await backend.mcpStateReply(id, { installed: false, reason: 'denied' });
      return;
    }
    const done = await deps.installPackage(pkg);
    await backend.mcpStateReply(id, done.ok ? { installed: true } : { installed: false, reason: 'failed', message: done.error?.message ?? '' });
  });

  return { configure };
}
