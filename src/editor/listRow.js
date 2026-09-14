// =============================================================================
// DBV Typst Editor — Fila de lista con botón de quitar (asistentes de formulario)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Extraído en /code-simplify de la ampliación RF-50/RF-51 de v0.7.0:
// `sequenceEditor.js`, `ganttEditor.js` y `kanbanEditor.js` habían llegado,
// cada uno por su cuenta, a la misma construcción de un botón "✕" (mismo
// `className`/`aria-label`/glifo) para quitar una fila de una lista —
// `sequenceEditor.js` además ya envolvía ese botón junto a un texto en una
// fila `.sequence-editor__row` completa, la misma forma que los otros dos
// repetían inline. Un único sitio en vez de tres copias.

import { t } from '../i18n/i18n.js';

/** Botón "✕" que quita una fila — mismo `className`/`aria-label`/glifo en los tres asistentes de formulario de esta versión. */
export function createRemoveButton(onRemove) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sequence-editor__remove';
  button.setAttribute('aria-label', t('sequence.remove'));
  button.textContent = '✕';
  button.addEventListener('click', onRemove);
  return button;
}

/** Fila `label` + botón de quitar — la forma completa que usan las listas planas (participantes, mensajes, tareas, tarjetas). */
export function createListRow(label, onRemove) {
  const row = document.createElement('div');
  row.className = 'sequence-editor__row';
  const text = document.createElement('span');
  text.className = 'sequence-editor__row-text';
  text.textContent = label;
  row.append(text, createRemoveButton(onRemove));
  return row;
}
