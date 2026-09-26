import { describe, expect, it } from 'vitest';
import { changedOnDiskBeforeSave, decideExternalChange, isWithinAny } from './externalChange.js';

const onDisk = (contentHash) => ({ missing: false, contentHash });
const gone = { missing: true, contentHash: null };

describe('decideExternalChange (RF-68)', () => {
  it('ignora un aviso cuyo contenido es el que ya conocemos, aunque haya cambios sin guardar', () => {
    // El caso real de la 0.10.0: el antivirus toca los atributos tras guardar
    // y el usuario sigue escribiendo con el guardado automático encendido.
    expect(decideExternalChange({ knownHash: 'a1', fingerprint: onDisk('a1'), dirty: true })).toBe('ignore');
    expect(decideExternalChange({ knownHash: 'a1', fingerprint: onDisk('a1'), dirty: false })).toBe('ignore');
  });

  it('pregunta solo si el contenido cambió de verdad y hay cambios locales', () => {
    expect(decideExternalChange({ knownHash: 'a1', fingerprint: onDisk('b2'), dirty: true })).toBe('ask');
  });

  it('recarga en silencio un cambio real sin cambios locales', () => {
    expect(decideExternalChange({ knownHash: 'a1', fingerprint: onDisk('b2'), dirty: false })).toBe('reload');
  });

  it('aplaza durante un guardado en vuelo: el disco ya tiene lo nuevo y aún no conocemos su huella', () => {
    // Sin el aplazamiento, esta combinación sería un conflicto FALSO (R-C1).
    expect(decideExternalChange({ knownHash: 'viejo', fingerprint: onDisk('nuevo'), dirty: true, saving: true })).toBe('defer');
  });

  it('ignora los avisos de una operación propia (mover, renombrar) aunque el fichero haya desaparecido', () => {
    expect(decideExternalChange({ knownHash: 'a1', fingerprint: gone, dirty: true, ownOperation: true })).toBe('ignore');
  });

  it('distingue un fichero que ha desaparecido', () => {
    expect(decideExternalChange({ knownHash: 'a1', fingerprint: gone, dirty: false })).toBe('missing');
    expect(decideExternalChange({ knownHash: 'a1', fingerprint: gone, dirty: true })).toBe('missing');
  });
});

describe('changedOnDiskBeforeSave (RF-68)', () => {
  it('no ve conflicto si el disco tiene lo último conocido, aunque haya cambiado la fecha', () => {
    expect(changedOnDiskBeforeSave({ knownHash: 'a1', fingerprint: onDisk('a1') })).toBe(false);
  });

  it('ve conflicto si el contenido del disco es otro', () => {
    expect(changedOnDiskBeforeSave({ knownHash: 'a1', fingerprint: onDisk('b2') })).toBe(true);
  });

  it('un fichero ausente no es un conflicto: guardar lo recrea', () => {
    expect(changedOnDiskBeforeSave({ knownHash: 'a1', fingerprint: gone })).toBe(false);
  });
});

describe('isWithinAny (RF-68/RF-69)', () => {
  it('reconoce la misma ruta y lo que cuelga de una carpeta, sin distinguir separador ni mayúsculas', () => {
    const roots = ['C:\\Libro\\capitulos'];
    expect(isWithinAny('C:\\Libro\\capitulos', roots)).toBe(true);
    expect(isWithinAny('c:/libro/Capitulos/cap1.typ', roots)).toBe(true);
  });

  it('no confunde un prefijo de nombre con una carpeta contenedora', () => {
    expect(isWithinAny('C:/Libro/capitulos-viejos/cap1.typ', ['C:/Libro/capitulos'])).toBe(false);
    expect(isWithinAny('C:/Libro/main.typ', [])).toBe(false);
  });
});
