// =============================================================================
// DBV Typst Editor — Terminal avanzado (Beta, ARCHITECTURE.md §7.14)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Vía de escape explícita para usuarios avanzados: ejecuta directamente
// subcomandos del CLI de Typst contra el proyecto activo y muestra la salida
// cruda. Coherente con "el usuario no debe ver código si no quiere"
// (SPECIFICATIONS.md §2): panel oculto por defecto, no sustituye a ningún
// flujo guiado de la app.
//
// "Sin lógica adicional de parseo" (§7.14) es literal: separar por espacios es
// todo lo que hace este módulo con lo que el usuario escribe. Sin comillas,
// sin variables — quien necesite eso ya sabe abrir una terminal de verdad.

import { runTypstCommand } from '../services/backend.js';

/**
 * @param {object} deps
 * @param {HTMLElement} deps.outputEl
 * @param {HTMLInputElement} deps.inputEl
 */
export function createTerminal({ outputEl, inputEl }) {
  function appendLine(text, modifier) {
    if (!text) return;
    const line = document.createElement('pre');
    line.className = modifier ? `terminal__line terminal__line--${modifier}` : 'terminal__line';
    line.textContent = text;
    outputEl.append(line);
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  async function runCommandLine(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    appendLine(`$ typst ${trimmed}`, 'command');

    const args = trimmed.split(/\s+/);
    const result = await runTypstCommand(args);
    if (!result.ok) {
      appendLine(result.error.message, 'error');
      return;
    }

    const { stdout, stderr, code } = result.value;
    appendLine(stdout);
    appendLine(stderr, 'error');
    if (code !== 0) appendLine(`(código de salida ${code})`, 'error');
  }

  inputEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const value = inputEl.value;
    inputEl.value = '';
    runCommandLine(value);
  });

  return {
    clear() {
      outputEl.replaceChildren();
    },
    focusInput() {
      inputEl.focus();
    },
  };
}
