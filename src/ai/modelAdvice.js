// =============================================================================
// DBV Typst Editor — Textos de los avisos de un modelo (RF-103)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

const fill = (text, values) => Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, String(value)), text);
const thousands = (number) => new Intl.NumberFormat('es').format(number);

/**
 * Los avisos de `modelAdvice` como frases, en el idioma de la interfaz.
 * @param {{small: string|null, shortfall: object|null, exceedsMax: number|null}} advice
 * @param {(key: string) => string} t
 * @returns {string[]}
 */
export function describeAdvice(advice, t) {
  const messages = [];
  if (advice.small) messages.push(fill(t('ai.warnSmallModel'), { size: advice.small }));
  if (advice.shortfall) {
    messages.push(
      fill(t('ai.warnShortContext'), {
        have: thousands(advice.shortfall.have),
        minimum: thousands(advice.shortfall.minimum),
        recommended: thousands(advice.shortfall.recommended),
      }),
    );
  }
  if (advice.exceedsMax) messages.push(fill(t('ai.warnExceedsMax'), { max: thousands(advice.exceedsMax) }));
  return messages;
}
