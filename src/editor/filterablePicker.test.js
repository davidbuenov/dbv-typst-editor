// =============================================================================
// DBV Typst Editor — Tests del desplegable filtrable reutilizable (RF-17)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cubre la mecánica compartida por el desplegable de citas y el de imágenes:
// cargar al abrir, filtrar por texto, elegir, y la salida de escape del final.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFilterablePicker } from './filterablePicker.js';

/** Monta el marcado mínimo del panel, igual que el de `index.html`. */
function mount() {
  document.body.innerHTML = `
    <div id="panel" class="floating-panel hidden">
      <input id="filter" type="search" />
      <div id="list"></div>
      <button id="action" type="button"></button>
    </div>
  `;
  return {
    panelEl: document.getElementById('panel'),
    listEl: document.getElementById('list'),
    filterEl: document.getElementById('filter'),
    actionButtonEl: document.getElementById('action'),
  };
}

const IMAGES = [
  { path: '/images/grafico.png', name: 'grafico.png' },
  { path: '/chapters/figuras/esquema.svg', name: 'esquema.svg' },
];

function build(overrides = {}) {
  const elements = mount();
  const onPick = vi.fn();
  const onAction = vi.fn();
  const picker = createFilterablePicker({
    ...elements,
    onAction,
    load: async () => IMAGES,
    onPick,
    labelOf: (image) => image.name,
    emptyKey: 'image.empty',
    noMatchesKey: 'image.noMatches',
    ...overrides,
  });
  return { ...elements, picker, onPick, onAction };
}

/** El panel carga en `onOpen`, que es asíncrono: hay que dejarlo resolver. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const itemTexts = (listEl) =>
  [...listEl.querySelectorAll('.picker__item')].map((button) => button.textContent);

describe('createFilterablePicker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('carga y pinta los elementos al abrirse', async () => {
    const { listEl, picker } = build();
    picker.openNear(document.createElement('button'));
    await settle();

    expect(itemTexts(listEl)).toEqual(['grafico.png', 'esquema.svg']);
  });

  it('filtra por el texto visible', async () => {
    const { listEl, filterEl, picker } = build();
    picker.openNear(document.createElement('button'));
    await settle();

    filterEl.value = 'esque';
    filterEl.dispatchEvent(new Event('input'));

    expect(itemTexts(listEl)).toEqual(['esquema.svg']);
  });

  it('entrega el elemento elegido, no su etiqueta', async () => {
    const { listEl, picker, onPick } = build();
    picker.openNear(document.createElement('button'));
    await settle();

    listEl.querySelector('.picker__item').click();

    expect(onPick).toHaveBeenCalledWith(IMAGES[0]);
  });

  it('cierra el panel al elegir', async () => {
    const { listEl, panelEl, picker } = build();
    picker.openNear(document.createElement('button'));
    await settle();
    expect(panelEl.classList.contains('hidden')).toBe(false);

    listEl.querySelector('.picker__item').click();

    expect(panelEl.classList.contains('hidden')).toBe(true);
  });

  it('explica el vacío en vez de dejar la lista en blanco', async () => {
    const { listEl, picker } = build({ load: async () => [] });
    picker.openNear(document.createElement('button'));
    await settle();

    expect(listEl.querySelector('.picker__item')).toBeNull();
    expect(listEl.querySelector('.picker__empty').textContent).not.toBe('');
  });

  it('distingue "no hay nada" de "el filtro no encuentra nada"', async () => {
    const { listEl, filterEl, picker } = build();
    picker.openNear(document.createElement('button'));
    await settle();
    const vacio = build({ load: async () => [] });
    vacio.picker.openNear(document.createElement('button'));
    await settle();

    filterEl.value = 'no-existe';
    filterEl.dispatchEvent(new Event('input'));

    expect(listEl.querySelector('.picker__empty').textContent)
      .not.toBe(vacio.listEl.querySelector('.picker__empty').textContent);
  });

  it('la salida de escape cierra el panel y avisa', async () => {
    const { actionButtonEl, panelEl, picker, onAction } = build();
    picker.openNear(document.createElement('button'));
    await settle();

    actionButtonEl.click();

    expect(onAction).toHaveBeenCalledOnce();
    expect(panelEl.classList.contains('hidden')).toBe(true);
  });

  it('recarga en cada apertura, para ver lo que se acaba de añadir', async () => {
    const load = vi.fn().mockResolvedValue(IMAGES);
    const { picker } = build({ load });
    const trigger = document.createElement('button');

    picker.openNear(trigger);
    await settle();
    picker.close();
    picker.openNear(trigger);
    await settle();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('limpia el filtro anterior al reabrirse', async () => {
    const { filterEl, listEl, picker } = build();
    const trigger = document.createElement('button');
    picker.openNear(trigger);
    await settle();
    filterEl.value = 'esque';
    filterEl.dispatchEvent(new Event('input'));
    picker.close();

    picker.openNear(trigger);
    await settle();

    expect(filterEl.value).toBe('');
    expect(itemTexts(listEl)).toHaveLength(2);
  });
});
