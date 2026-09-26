import { describe, expect, it } from 'vitest';
import { dropTargetDir, isValidDrop } from './treeDrag.js';

const root = 'D:/libro';
const dir = (path) => ({ path, isDir: true });
const file = (path) => ({ path, isDir: false });

describe('dropTargetDir (RF-69.5)', () => {
  it('una carpeta recibe lo que se suelta encima; un fichero lo manda a su carpeta; el hueco, a la raíz', () => {
    expect(dropTargetDir(dir('D:/libro/capitulos'), root)).toBe('D:/libro/capitulos');
    expect(dropTargetDir(file('D:/libro/capitulos/cap1.typ'), root)).toBe('D:/libro/capitulos');
    expect(dropTargetDir(null, root)).toBe(root);
  });
});

describe('isValidDrop (RF-69.5)', () => {
  it('acepta mover ficheros a otra carpeta', () => {
    expect(isValidDrop([file('D:/libro/cap1.typ'), file('D:/libro/cap2.typ')], 'D:/libro/capitulos')).toBe(true);
  });

  it('rechaza meter una carpeta dentro de sí misma o de una subcarpeta suya', () => {
    expect(isValidDrop([dir('D:/libro/partes')], 'D:/libro/partes')).toBe(false);
    expect(isValidDrop([dir('D:/libro/partes')], 'D:/libro/partes/sub')).toBe(false);
  });

  it('soltar todo donde ya estaba no es un destino', () => {
    expect(isValidDrop([file('D:/libro/capitulos/cap1.typ')], 'D:/libro/capitulos')).toBe(false);
    // Si al menos uno cambia de carpeta, sí lo es (el backend omite el resto).
    expect(isValidDrop([file('D:/libro/capitulos/cap1.typ'), file('D:/libro/cap2.typ')], 'D:/libro/capitulos')).toBe(true);
  });

  it('no distingue separador ni mayúsculas, y no confunde un prefijo con una carpeta', () => {
    const windows = ['D:', 'Libro', 'Partes'].join(String.fromCharCode(92));
    expect(isValidDrop([dir(windows)], 'd:/libro/partes/sub')).toBe(false);
    expect(isValidDrop([dir('D:/libro/partes')], 'D:/libro/partes-viejas')).toBe(true);
  });

  it('sin destino o sin nada que mover, no hay soltada', () => {
    expect(isValidDrop([file('D:/libro/cap1.typ')], null)).toBe(false);
    expect(isValidDrop([], 'D:/libro')).toBe(false);
  });
});
