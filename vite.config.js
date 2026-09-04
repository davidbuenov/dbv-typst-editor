// =============================================================================
// DBV Typst Editor — Configuración de Vite (frontend)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { defineConfig } from 'vite';

// El frontend vive en `src/` (ARCHITECTURE.md §7.4) y se compila a `dist/`, que
// es lo que Tauri empaqueta como `frontendDist`.
export default defineConfig({
  root: 'src',
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Vigilar src-tauri/ desde Vite provocaría recargas espurias del frontend
    // cada vez que Cargo escribe en target/.
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // WebView2 / WebKitGTK modernos: no hace falta transpilar a ES5.
    target: 'esnext',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
