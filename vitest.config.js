// =============================================================================
// DBV Typst Editor — Configuración de Vitest (tests del frontend)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Configuración aparte de `vite.config.js` a propósito: aquella fija
// `root: 'src'` para la aplicación, y heredarlo aquí escondería los tests que
// viven junto al módulo que prueban.
//
// Entorno `jsdom` para todos los ficheros aunque parte de las funciones sean
// puras: la lección más cara de este proyecto es que sus fallos vivían en la
// frontera con el DOM y con el WebView, no en la aritmética.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
    environment: 'jsdom',
    restoreMocks: true,
    reporters: ['default'],
  },
});
