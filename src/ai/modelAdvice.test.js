// =============================================================================
// DBV Typst Editor — Tests de los textos de los avisos (RF-103)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { describeAdvice } from './modelAdvice.js';

const t = (key) =>
  ({
    'ai.warnSmallModel': 'Pequeño ({size})',
    'ai.warnShortContext': 'Con {have} falta: mínimo {minimum}, recomendado {recommended}',
    'ai.warnExceedsMax': 'Supera {max}',
  })[key];

describe('textos de los avisos', () => {
  it('sin nada que avisar no devuelve nada', () => {
    expect(describeAdvice({ small: null, shortfall: null, exceedsMax: null }, t)).toEqual([]);
  });

  it('rellena los números de cada aviso', () => {
    const advice = { small: '3.1B', shortfall: { have: 4096, minimum: 8192, recommended: 16384 }, exceedsMax: 8192 };
    const messages = describeAdvice(advice, t);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toBe('Pequeño (3.1B)');
    expect(messages[1]).toMatch(/4[.\u00a0]?096.*8[.\u00a0]?192.*16[.\u00a0]?384/);
    expect(messages[2]).toMatch(/8[.\u00a0]?192/);
  });
});
