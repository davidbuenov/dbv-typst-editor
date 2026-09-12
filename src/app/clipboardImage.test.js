// =============================================================================
// DBV Typst Editor — Tests de la imagen pegada desde el portapapeles (RF-39)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { base64FromDataUrl, pickImageFromClipboard, readFileAsBase64 } from './clipboardImage.js';

/** Un `DataTransfer` de mentira con la forma exacta que expone el evento real. */
function clipboard(types, items = []) {
  return {
    types,
    items: items.map(({ kind, type, file }) => ({ kind, type, getAsFile: () => file ?? null })),
  };
}

const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'recorte.png', { type: 'image/png' });

describe('pickImageFromClipboard', () => {
  it('reconoce el recorte de pantalla: un fichero de imagen y ningún texto', () => {
    const image = pickImageFromClipboard(clipboard(['Files'], [{ kind: 'file', type: 'image/png', file: png() }]));
    expect(image.extension).toBe('png');
  });

  it('mapea cada tipo MIME a la extensión que Typst espera en disco', () => {
    const para = (type) =>
      pickImageFromClipboard(clipboard(['Files'], [{ kind: 'file', type, file: png() }]))?.extension;

    expect(para('image/jpeg')).toBe('jpg');
    expect(para('image/gif')).toBe('gif');
    expect(para('image/svg+xml')).toBe('svg');
    expect(para('image/webp')).toBe('webp');
  });

  // Copiar texto de una web arrastra a veces una imagen de adorno junto al
  // texto: ahí lo que el usuario quiere pegar es el texto, así que el pegado
  // tiene que seguir su curso normal.
  it('deja pasar un pegado que trae texto, aunque venga una imagen con él', () => {
    const data = clipboard(['text/plain', 'Files'], [{ kind: 'file', type: 'image/png', file: png() }]);
    expect(pickImageFromClipboard(data)).toBeNull();
  });

  it('ignora un pegado de solo texto', () => {
    expect(pickImageFromClipboard(clipboard(['text/plain']))).toBeNull();
  });

  // Windows pone BMP en el portapapeles con frecuencia y Typst no lo
  // incrusta: guardarlo dejaría en `images/` un fichero que rompe la
  // compilación, que es peor que no pegar nada.
  it('ignora un formato que Typst no sabe incrustar', () => {
    const data = clipboard(['Files'], [{ kind: 'file', type: 'image/bmp', file: png() }]);
    expect(pickImageFromClipboard(data)).toBeNull();
  });

  it('ignora una cadena con pinta de imagen que no es un fichero', () => {
    const data = clipboard(['Files'], [{ kind: 'string', type: 'image/png' }]);
    expect(pickImageFromClipboard(data)).toBeNull();
  });

  it('tolera un evento sin portapapeles', () => {
    expect(pickImageFromClipboard(null)).toBeNull();
  });
});

describe('base64FromDataUrl', () => {
  it('quita la cabecera del data URL y deja solo los bytes', () => {
    expect(base64FromDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('iVBORw0KGgo=');
  });

  it('devuelve vacío si no es un data URL', () => {
    expect(base64FromDataUrl('no-soy-un-data-url')).toBe('');
  });
});

describe('readFileAsBase64', () => {
  it('convierte el fichero del portapapeles a base64 decodificable', async () => {
    const base64 = await readFileAsBase64(png());
    expect(atob(base64)).toBe(String.fromCharCode(137, 80, 78, 71));
  });
});
