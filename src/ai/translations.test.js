// =============================================================================
// DBV Typst Editor — Las claves de texto de la IA existen en los dos idiomas
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_TRANSLATIONS } from './translations.js';
import { registerTranslations, setLanguage, t } from '../i18n/i18n.js';

const dir = join(process.cwd(), 'src', 'ai');
const sources = readdirSync(dir)
  .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js') && name !== 'translations.js')
  .map((name) => readFileSync(join(dir, name), 'utf8'))
  .join('\n');

/** Claves dinámicas (`ai.kind.${…}`) y sus valores posibles. */
const DYNAMIC = {
  'ai.kind.': ['modify', 'create', 'delete', 'rename'],
  'ai.provider.': ['ollama', 'lmStudio', 'openAiCompatible', 'anthropic', 'openAi', 'gemini', 'openRouter'],
  'ai.error.': ['auth', 'rateLimit', 'network', 'notFound', 'contextTooLong', 'badRequest', 'server', 'cancelled', 'config', 'secretStore', 'unknown', 'bridge'],
  'ai.agent.': ['claude', 'gemini', 'codex', 'copilot'],
  'ai.inline.': ['improve', 'proofread', 'translate', 'shorten', 'expand', 'toTable', 'toList', 'explain'],
};

describe('textos de la IA (RNF-IA.8)', () => {
  const literal = [...sources.matchAll(/t\(['`](ai\.[A-Za-z.]+)['`]\)/g)].map((match) => match[1]);
  const dynamic = Object.entries(DYNAMIC).flatMap(([prefix, values]) => values.map((value) => `${prefix}${value}`));
  const keys = [...new Set([...literal, ...dynamic])];

  it('toda clave usada existe en español e inglés', () => {
    registerTranslations(AI_TRANSLATIONS);
    for (const language of ['es', 'en']) {
      setLanguage(language);
      const missing = keys.filter((key) => t(key) === key);
      expect(missing, `faltan en ${language}`).toEqual([]);
    }
    setLanguage('es');
    expect(keys.length).toBeGreaterThan(80);
  });

  it('los dos idiomas tienen las mismas claves', () => {
    expect(Object.keys(AI_TRANSLATIONS.es).sort()).toEqual(Object.keys(AI_TRANSLATIONS.en).sort());
  });
});
