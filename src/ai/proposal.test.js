// =============================================================================
// DBV Typst Editor — Tests del modelo de propuesta (RF-93, RF-94.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { applyChange, createProposal, editProposed, looseMatch, overrides, parseChangeBlocks, resultText } from './proposal.js';

const disk = { 'main.typ': '= Hola\n#include "cap.typ"\n', 'cap.typ': 'Uno.\nDos.\n' };
const readBase = async (path) => disk[path] ?? null;

describe('applyChange', () => {
  it('edita por búsqueda exacta y acumula varios cambios del mismo fichero', async () => {
    const proposal = createProposal();
    expect((await applyChange(proposal, { path: 'cap.typ', action: 'edit', search: 'Uno.', replace: 'Uno bis.' }, readBase)).ok).toBe(true);
    expect((await applyChange(proposal, { path: './cap.typ', action: 'edit', search: 'Dos.', replace: 'Dos bis.' }, readBase)).ok).toBe(true);
    const file = proposal.files.get('cap.typ');
    expect(file.base).toBe('Uno.\nDos.\n');
    expect(resultText(file)).toBe('Uno bis.\nDos bis.\n');
  });

  it('explica a la IA por qué falla una búsqueda', async () => {
    const proposal = createProposal();
    expect((await applyChange(proposal, { path: 'cap.typ', action: 'edit', search: 'Tres.', replace: 'x' }, readBase)).message).toMatch(/no se encontró/);
    const twice = { 'a.typ': 'x\nx\n' };
    expect((await applyChange(proposal, { path: 'a.typ', action: 'edit', search: 'x', replace: 'y' }, async (p) => twice[p] ?? null)).message).toMatch(/2 veces/);
  });

  it('crea, elimina y renombra', async () => {
    const proposal = createProposal();
    await applyChange(proposal, { path: 'caps/nuevo.typ', action: 'create', content: '= Nuevo\n' }, readBase);
    await applyChange(proposal, { path: 'cap.typ', action: 'rename', newPath: 'caps/cap.typ' }, readBase);
    await applyChange(proposal, { path: 'main.typ', action: 'delete' }, readBase);
    expect(proposal.files.get('caps/nuevo.typ').kind).toBe('create');
    expect(proposal.files.get('cap.typ')).toMatchObject({ kind: 'rename', newPath: 'caps/cap.typ' });
    expect(proposal.files.get('main.typ').kind).toBe('delete');
  });

  it('rechaza rutas fuera del proyecto y ficheros de git', async () => {
    const proposal = createProposal();
    expect((await applyChange(proposal, { path: '../fuera.typ', action: 'create', content: 'x' }, readBase)).ok).toBe(false);
    expect((await applyChange(proposal, { path: 'C:/Windows/x.typ', action: 'create', content: 'x' }, readBase)).ok).toBe(false);
    expect((await applyChange(proposal, { path: '.git/config', action: 'create', content: 'x' }, readBase)).ok).toBe(false);
    expect(proposal.files.size).toBe(0);
  });

  it('un cambio que deja el fichero igual no queda en la propuesta', async () => {
    const proposal = createProposal();
    await applyChange(proposal, { path: 'cap.typ', action: 'edit', search: 'Uno.', replace: 'Uno.' }, readBase);
    expect(proposal.files.size).toBe(0);
  });

  it('retocar el texto propuesto recalcula los trozos', async () => {
    const proposal = createProposal();
    await applyChange(proposal, { path: 'cap.typ', action: 'edit', search: 'Uno.', replace: 'Uno bis.' }, readBase);
    const file = proposal.files.get('cap.typ');
    editProposed(file, 'Uno retocado.\nDos.\n');
    expect(resultText(file)).toBe('Uno retocado.\nDos.\n');
  });

  it('las sustituciones en memoria usan rutas absolutas y el destino del renombrado', async () => {
    const proposal = createProposal();
    await applyChange(proposal, { path: 'cap.typ', action: 'rename', newPath: 'b.typ' }, readBase);
    await applyChange(proposal, { path: 'main.typ', action: 'delete' }, readBase);
    expect(overrides(proposal, 'D:/p', (root, rel) => `${root}/${rel}`)).toEqual([{ path: 'D:/p/b.typ', content: 'Uno.\nDos.\n' }]);
  });
});

describe('parseChangeBlocks (modelos sin herramientas)', () => {
  it('lee bloques de edición, de fichero completo y de borrado', () => {
    const text = [
      'Te propongo esto:',
      '```dbv-edit path="cap.typ"',
      '<<<<<<< BUSCAR',
      'Uno.',
      '=======',
      'Uno bis.',
      '>>>>>>> FIN',
      '```',
      '```dbv-file path="caps/nuevo.typ"',
      '= Nuevo',
      '```',
      '```dbv-delete path="viejo.typ"',
      '```',
    ].join('\n');
    expect(parseChangeBlocks(text)).toEqual([
      { path: 'cap.typ', action: 'edit', search: 'Uno.', replace: 'Uno bis.' },
      { path: 'caps/nuevo.typ', action: 'replace_all', content: '= Nuevo\n' },
      { path: 'viejo.typ', action: 'delete' },
    ]);
  });

  it('tolera espacios tras el separador y busca sin la sangría si la coincidencia es única', async () => {
    const text = '```dbv-edit path="t.typ"\n<<<<<<< SEARCH\n#tabla(\n   [Año], [Ventas],\n)\n======= \n#table(\n  [Año], [Ventas],\n)\n>>>>>>> END\n```';
    const [change] = parseChangeBlocks(text);
    expect(change.replace).toBe('#table(\n  [Año], [Ventas],\n)');
    const proposal = createProposal();
    const disk = { 't.typ': '= T\n#tabla(\n  [Año], [Ventas],\n)\nFin.\n' };
    expect((await applyChange(proposal, change, async (p) => disk[p] ?? null)).ok).toBe(true);
    expect(resultText(proposal.files.get('t.typ'))).toBe('= T\n#table(\n  [Año], [Ventas],\n)\nFin.\n');
    expect(looseMatch('a\n  x\nb\n  x\n', 'x')).toBeNull();
  });

  it('un bloque de código normal no es un cambio', () => {
    expect(parseChangeBlocks('```typst\n#table()\n```')).toEqual([]);
  });
});
