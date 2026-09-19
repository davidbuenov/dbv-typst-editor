// =============================================================================
// DBV Typst Editor — Tests del nombre de asset de GitHub Releases
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// `latest.json` apuntaba a `DBV%20Typst%20Editor_…`, que da 404 porque GitHub
// publica el asset como `DBV.Typst.Editor_…`. Sin este nombre el
// auto-actualizador de Windows no descarga nada.

import { describe, expect, it } from 'vitest';
import { githubAssetName } from '../../scripts/github-asset-name.mjs';

describe('githubAssetName', () => {
  it('cambia los espacios por puntos, como hace GitHub al subir un asset', () => {
    expect(githubAssetName('DBV Typst Editor_0.7.0_x64-setup.exe')).toBe('DBV.Typst.Editor_0.7.0_x64-setup.exe');
  });

  it('deja intacto un nombre sin espacios', () => {
    expect(githubAssetName('DBV.Typst.Editor_0.8.0_amd64.AppImage')).toBe('DBV.Typst.Editor_0.8.0_amd64.AppImage');
  });

  it('la URL final ya no necesita codificar nada', () => {
    const name = githubAssetName('DBV Typst Editor_0.8.0_x64-setup.exe');

    expect(encodeURIComponent(name)).toBe(name);
  });
});
