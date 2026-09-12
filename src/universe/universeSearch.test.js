// =============================================================================
// DBV Typst Editor — Tests del buscador compartido de Typst Universe
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Extraído de `universePanel.js` (RF-34.7) para montarse también en la
// Galería de plantillas, filtrado a solo plantillas — petición del usuario:
// "la ventana de búsqueda podría ser la misma que vamos a generar para la
// otra parte". Estos tests fijan el contrato que los dos sitios comparten:
// mismo índice, mismo filtro por substring, misma tarjeta — lo único que
// cambia entre ellos es `onSelect`/`filterEntries`, que cada uno pasa el suyo.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUniverseSearch } from './universeSearch.js';
import { fetchUniverseIndex } from '../services/backend.js';

vi.mock('../services/backend.js', () => ({ fetchUniverseIndex: vi.fn() }));

const INDICE = [
  { name: 'cetz', version: '0.5.2', description: 'Drawing with Typst', license: 'LGPL-3.0', isTemplate: false },
  {
    name: 'campanile',
    version: '0.1.0',
    description: "Master's thesis and PhD dissertation",
    license: 'MIT-0',
    isTemplate: true,
  },
];

function montar(overrides = {}) {
  const inputEl = document.createElement('input');
  const resultsEl = document.createElement('div');
  const statusEl = document.createElement('p');
  statusEl.className = 'hidden';
  document.body.append(inputEl, resultsEl, statusEl);

  const onSelect = vi.fn();
  const search = createUniverseSearch({ inputEl, resultsEl, statusEl, onSelect, ...overrides });

  return { inputEl, resultsEl, statusEl, onSelect, search };
}

async function escribir(inputEl, texto) {
  inputEl.value = texto;
  inputEl.dispatchEvent(new Event('input'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createUniverseSearch', () => {
  beforeEach(() => {
    vi.mocked(fetchUniverseIndex).mockReset();
    vi.mocked(fetchUniverseIndex).mockResolvedValue({ ok: true, value: INDICE });
  });

  it('no pinta nada con el campo vacío', async () => {
    const { resultsEl, statusEl } = montar();
    await escribir(document.querySelector('input'), '');
    expect(resultsEl.children).toHaveLength(0);
    expect(statusEl.classList.contains('hidden')).toBe(true);
  });

  it('encuentra por nombre y pulsar la tarjeta llama a onSelect con el spec y la ficha completa', async () => {
    const { inputEl, resultsEl, onSelect } = montar();

    await escribir(inputEl, 'cetz');

    expect(resultsEl.querySelectorAll('.universe-card')).toHaveLength(1);
    resultsEl.querySelector('.universe-card__body').click();
    expect(onSelect).toHaveBeenCalledWith('@preview/cetz:0.5.2', expect.objectContaining({ isTemplate: false }));
  });

  it('sin resultados avisa en vez de dejar la rejilla en silencio', async () => {
    const { inputEl, resultsEl, statusEl } = montar();

    await escribir(inputEl, 'esto-no-existe-en-ningun-paquete');

    expect(resultsEl.children).toHaveLength(0);
    expect(statusEl.classList.contains('hidden')).toBe(false);
    expect(statusEl.textContent).not.toBe('');
  });

  // La razón de ser de este módulo: la Galería de plantillas busca SOLO
  // plantillas (crear un proyecto), el panel de paquetes busca de todo.
  it('filterEntries limita los resultados — por ejemplo, a solo plantillas', async () => {
    const { inputEl, resultsEl } = montar({ filterEntries: (card) => card.isTemplate });

    // "e" está en los dos nombres (cetz, campanile); con el filtro solo debe
    // sobrevivir la plantilla.
    await escribir(inputEl, 'e');

    const specs = [...resultsEl.querySelectorAll('.universe-card__meta')].map((el) => el.textContent);
    expect(specs.some((s) => s.includes('campanile'))).toBe(true);
    expect(specs.some((s) => s.includes('@preview/cetz'))).toBe(false);
  });

  it('sin onViewOnline, la tarjeta no ofrece el enlace "↗"', async () => {
    const { inputEl, resultsEl } = montar(); // sin onViewOnline

    await escribir(inputEl, 'cetz');

    expect(resultsEl.querySelector('.universe-card__link')).toBeNull();
  });

  it('con onViewOnline, el enlace no dispara también onSelect', async () => {
    const onViewOnline = vi.fn();
    const { inputEl, resultsEl, onSelect } = montar({ onViewOnline });

    await escribir(inputEl, 'cetz');
    resultsEl.querySelector('.universe-card__link').click();

    expect(onViewOnline).toHaveBeenCalledWith('@preview/cetz:0.5.2');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clear() vacía el campo, los resultados y el estado', async () => {
    const { inputEl, resultsEl, statusEl, search } = montar();
    await escribir(inputEl, 'cetz');

    search.clear();

    expect(inputEl.value).toBe('');
    expect(resultsEl.children).toHaveLength(0);
    expect(statusEl.classList.contains('hidden')).toBe(true);
  });

  it('el índice se descarga una sola vez para varias búsquedas seguidas', async () => {
    const { inputEl } = montar();

    await escribir(inputEl, 'cetz');
    await escribir(inputEl, 'campanile');

    expect(fetchUniverseIndex).toHaveBeenCalledTimes(1);
  });
});
