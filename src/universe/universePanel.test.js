// =============================================================================
// DBV Typst Editor — Tests del panel de paquetes de Typst Universe
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// El panel se reescribió en RF-26 para quedarse solo con Paquetes: las
// plantillas se absorbieron en la galería. Estos tests fijan esa frontera, que
// es la parte fácil de deshacer sin darse cuenta — un `renderGrid` de más y el
// panel vuelve a ofrecer plantillas desde el sitio equivocado.

import { describe, expect, it, vi } from 'vitest';
import { CURATED_PACKAGES, CURATED_TEMPLATES } from './curatedCatalog.js';
import { createUniversePanel } from './universePanel.js';

function montar() {
  const packagesEl = document.createElement('div');
  const specInputEl = document.createElement('input');
  const specButtonEl = document.createElement('button');
  const errorEl = document.createElement('p');
  errorEl.className = 'hidden';

  const contenedor = document.createElement('div');
  contenedor.append(packagesEl, specInputEl, specButtonEl, errorEl);
  document.body.append(contenedor);

  const onUsePackage = vi.fn();
  const onViewPackage = vi.fn();

  createUniversePanel({ packagesEl, specInputEl, specButtonEl, errorEl, onUsePackage, onViewPackage });

  return { packagesEl, specInputEl, specButtonEl, errorEl, onUsePackage, onViewPackage };
}

describe('panel de paquetes de Typst Universe', () => {
  it('pinta el catálogo de paquetes y NINGUNA plantilla', () => {
    const { packagesEl } = montar();

    const tarjetas = packagesEl.querySelectorAll('.universe-card');
    expect(tarjetas).toHaveLength(CURATED_PACKAGES.length);

    // La frontera de RF-26.7: elegir plantilla crea un proyecto y vive en el
    // lanzador; importar un paquete modifica el documento abierto y vive aquí.
    const texto = packagesEl.textContent;
    for (const plantilla of CURATED_TEMPLATES) {
      expect(texto).not.toContain(plantilla.spec);
    }
  });

  it('muestra identificador y licencia de cada paquete', () => {
    // Es código de terceros que se descarga y ejecuta: el usuario tiene derecho
    // a ver qué instala y bajo qué condiciones antes de pulsar.
    const { packagesEl } = montar();
    const primera = packagesEl.querySelector('.universe-card__meta');

    expect(primera.textContent).toContain(CURATED_PACKAGES[0].spec);
    expect(primera.textContent).toContain(CURATED_PACKAGES[0].license);
  });

  it('un identificador escrito a mano importa un paquete', () => {
    const { specInputEl, specButtonEl, onUsePackage } = montar();

    specInputEl.value = '@preview/cetz:0.3.1';
    specButtonEl.click();

    expect(onUsePackage).toHaveBeenCalledWith('@preview/cetz:0.3.1');
    // El campo se vacía tras aplicarlo, para que no parezca que sigue pendiente.
    expect(specInputEl.value).toBe('');
  });

  it('un identificador mal formado se explica y no importa nada', () => {
    const { specInputEl, specButtonEl, errorEl, onUsePackage } = montar();

    specInputEl.value = '@preview/cetz';
    specButtonEl.click();

    expect(onUsePackage).not.toHaveBeenCalled();
    expect(errorEl.classList.contains('hidden')).toBe(false);
    expect(errorEl.textContent).not.toBe('');
    // Y el texto se conserva: borrarlo obligaría a reescribirlo entero.
    expect(specInputEl.value).toBe('@preview/cetz');
  });

  it('el campo vacío también avisa, con su propio mensaje', () => {
    const { specInputEl, specButtonEl, errorEl } = montar();

    specInputEl.value = '   ';
    specButtonEl.click();

    expect(errorEl.classList.contains('hidden')).toBe(false);
  });

  it('escribir de nuevo retira el error anterior', () => {
    const { specInputEl, specButtonEl, errorEl } = montar();

    specInputEl.value = 'esto no vale';
    specButtonEl.click();
    expect(errorEl.classList.contains('hidden')).toBe(false);

    specInputEl.value = '@preview/cetz:0.3.1';
    specInputEl.dispatchEvent(new Event('input'));
    expect(errorEl.classList.contains('hidden')).toBe(true);
  });

  it('Intro aplica el identificador igual que el botón', () => {
    const { specInputEl, onUsePackage } = montar();

    specInputEl.value = '@preview/quick-maths:0.2.1';
    specInputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(onUsePackage).toHaveBeenCalledWith('@preview/quick-maths:0.2.1');
  });

  it('el enlace a typst.app no dispara también la importación', () => {
    // La tarjeta dejó de ser un botón envolvente justamente por esto: quien
    // quiere leer la documentación antes de fiarse no debe instalar de paso.
    const { packagesEl, onUsePackage, onViewPackage } = montar();

    packagesEl.querySelector('.universe-card__link').click();

    expect(onViewPackage).toHaveBeenCalledWith(CURATED_PACKAGES[0].spec);
    expect(onUsePackage).not.toHaveBeenCalled();
  });
});
