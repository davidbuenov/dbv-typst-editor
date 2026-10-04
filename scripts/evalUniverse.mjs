// =============================================================================
// DBV Typst Editor — Evaluación de la IA: Typst Universe y bibliografía (RF-108, RF-110, RF-115)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Las dependencias de red y de catálogo que la aplicación implementa en Rust, para que `eval-ai.mjs` ejercite las
// MISMAS herramientas (`tools.js`) y el mismo prompt con un catálogo REAL de Typst Universe:
//
//   · el índice (el que dejó la aplicación en su carpeta de datos o, si no, el público, una sola vez por ejecución);
//   · búsqueda, comprobación de identificadores y documentación de paquetes (el `.tar.gz` público, extraído con `tar`);
//   · la bibliografía del proyecto de la tarea.
//
// Es una réplica en JS de la lógica de Rust (`universe_catalog.rs`, `universe_search.rs`, `universe_packages.rs`): sirve
// para medir el COMPORTAMIENTO del modelo (usar solo identificadores devueltos, leer antes de aplicar), no para probar
// el código Rust, que tiene sus propios tests.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const INDEX_URL = 'https://packages.typst.org/preview/index.json';
const ID = /@preview\/([a-z0-9_-]+):(\d+\.\d+\.\d+)/g;

const parseVersion = (text) => String(text).split('.').map((n) => Number(n) || 0);
export function compareVersions(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i += 1) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

const fold = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = (text) => fold(text).split(/[^a-z0-9]+/).filter((w) => w.length > 1);

async function loadIndex() {
  const appData = process.env.APPDATA ?? join(process.env.HOME ?? '', '.local', 'share');
  const local = join(appData, 'com.davidbuenov.dbv-typst-editor', 'universe-index.json');
  if (existsSync(local)) return JSON.parse(readFileSync(local, 'utf8'));
  const response = await fetch(INDEX_URL, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`no se pudo descargar el índice de Universe: HTTP ${response.status}`);
  return response.json();
}

/** El catálogo reducido a la última versión que el compilador admite, como `build_catalog` en Rust. */
export async function createUniverse({ typstVersion }) {
  const entries = await loadIndex();
  const byName = new Map();
  for (const entry of entries) {
    if (!byName.has(entry.name)) byName.set(entry.name, []);
    byName.get(entry.name).push(entry);
  }
  const fits = (entry) => !entry.compiler || compareVersions(entry.compiler, typstVersion) <= 0;
  const latestFor = (name) => (byName.get(name) ?? []).filter(fits).sort((a, b) => compareVersions(b.version, a.version))[0] ?? null;
  const catalog = [...byName.keys()].map(latestFor).filter(Boolean);

  const kindOf = (entry) => (entry.template ? 'template' : 'package');
  const toHit = (entry) => {
    const all = byName.get(entry.name);
    const newest = [...all].sort((a, b) => compareVersions(b.version, a.version))[0];
    return {
      id: `@preview/${entry.name}:${entry.version}`,
      name: entry.name,
      version: entry.version,
      description: entry.description ?? '',
      kind: kindOf(entry),
      categories: entry.categories ?? [],
      license: entry.license ?? '',
      updated: entry.updatedAt ? new Date(entry.updatedAt * 1000).toISOString().slice(0, 10) : null,
      newerIncompatible: newest.version !== entry.version && !fits(newest) ? { version: newest.version, compiler: newest.compiler } : null,
    };
  };

  function universeSearch(query, kind = 'any') {
    const terms = [...new Set(words(query))];
    const scored = catalog
      .filter((entry) => kind === 'any' || kindOf(entry) === kind)
      .map((entry) => {
        const name = words(entry.name);
        const keywords = (entry.keywords ?? []).flatMap(words);
        const tags = [...(entry.categories ?? []), ...(entry.disciplines ?? [])].flatMap(words);
        const description = new Set(words(entry.description));
        let score = 0;
        for (const term of terms) {
          if (fold(entry.name) === term) score += 10;
          else if (name.includes(term)) score += 6;
          if (keywords.includes(term)) score += 4;
          if (tags.includes(term)) score += 3;
          if (description.has(term)) score += 2;
        }
        return { entry, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || compareVersions(b.entry.version, a.entry.version));
    return { status: 'ok', hits: scored.slice(0, 8).map((item) => toHit(item.entry)), unavailable: [] };
  }

  function check(id) {
    const match = /^@preview\/([a-z0-9_-]+):(\d+\.\d+\.\d+)$/.exec(String(id).trim());
    if (!match) return { id, status: 'notAnId', latest: null, compiler: null };
    const [, name, version] = match;
    const versions = byName.get(name);
    if (!versions) return { id, status: 'unknownPackage', latest: null, compiler: null };
    const latest = latestFor(name);
    const exact = versions.find((entry) => entry.version === version);
    if (!exact) return { id, status: latest ? 'unknownVersion' : 'unavailable', latest: latest?.version ?? null, compiler: null };
    if (!fits(exact)) return { id, status: latest ? 'needsNewerCompiler' : 'unavailable', latest: latest?.version ?? null, compiler: exact.compiler };
    if (latest && compareVersions(version, latest.version) < 0) return { id, status: 'outdated', latest: latest.version, compiler: null };
    return { id, status: 'ok', latest: null, compiler: null };
  }

  const docsCache = new Map();
  /** README, manifiesto, plantilla y la firma de su función, del `.tar.gz` público (cuesta una descarga). */
  async function universeDocs(id) {
    if (docsCache.has(id)) return docsCache.get(id);
    const [, name, version] = /^@preview\/([a-z0-9_-]+):(\d+\.\d+\.\d+)$/.exec(id) ?? [];
    const response = await fetch(`https://packages.typst.org/preview/${name}-${version}.tar.gz`, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) return `error: could not download ${id} (HTTP ${response.status})`;
    const dir = mkdtempSync(join(tmpdir(), 'dbv-eval-pkg-'));
    const archive = join(dir, 'pkg.tar.gz');
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
    spawnSync('tar', ['-xzf', archive, '-C', dir]);
    const read = (path, max) => (existsSync(join(dir, path)) ? readFileSync(join(dir, path), 'utf8').slice(0, max) : null);
    const manifest = read('typst.toml', 2500);
    const entry = /^entrypoint\s*=\s*"([^"]+)"/m.exec(manifest ?? '')?.[1] ?? 'lib.typ';
    const templateDir = /^path\s*=\s*"([^"]+)"/m.exec(manifest?.slice(manifest.indexOf('[template]')) ?? '')?.[1];
    const templateEntry = /^entrypoint\s*=\s*"([^"]+)"/m.exec(manifest?.slice(manifest.indexOf('[template]')) ?? '')?.[1];
    const sections = [`# ${id}`];
    if (manifest) sections.push('## Manifest (typst.toml)', manifest);
    const readme = read('README.md', 4000);
    if (readme) sections.push('## README.md', readme);
    if (templateDir && templateEntry) {
      const example = read(`${templateDir}/${templateEntry}`, 2500);
      if (example) sections.push(`## Template entry point: ${templateDir}/${templateEntry}`, '```typst', example, '```');
    }
    const source = read(entry, 60000) ?? '';
    const declared = [...source.matchAll(/^#let (\w[\w-]*)\(([\s\S]*?)\)\s*=/gm)].find((m) => /body|doc/.test(m[2]));
    if (declared) sections.push(`## Template function \`${declared[1]}\` (${entry})`, '```typst', `#let ${declared[1]}(${declared[2].slice(0, 1500)})`, '```');
    const text = sections.join('\n\n');
    docsCache.set(id, text);
    return text;
  }

  /** Los identificadores `@preview/…` de un texto que NO son ni existen: lo que la propuesta se inventó. */
  function invalidPackages(text) {
    return [...new Set([...String(text).matchAll(ID)].map((m) => m[0]))].filter((id) => check(id).status !== 'ok');
  }

  return { universeSearch, universeCheck: async (ids) => ids.map(check), universeDocs, invalidPackages, size: catalog.length };
}

// ─── Bibliografía del proyecto de la tarea ───────────────────────────────────

export function bibliographyOf(files) {
  const found = Object.keys(files).filter((path) => path.endsWith('.bib'));
  const references = [];
  for (const path of found) {
    for (const match of files[path].matchAll(/@(\w+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)(?=\n@|\s*$)/g)) {
      const field = (name) => new RegExp(`${name}\\s*=\\s*[{"]([^}"]*)[}"]`, 'i').exec(match[3])?.[1]?.trim();
      references.push({ key: match[2], entryType: match[1].toLowerCase(), authors: (field('author') ?? '').split(/\s+and\s+/).filter(Boolean), etAl: false, year: field('year') ?? null, title: field('title') ?? null });
    }
  }
  return { files: found, references, total: references.length };
}

export const CITATION_STYLES = [
  ['ieee', 'IEEE Reference Guide'],
  ['apa', 'American Psychological Association 7th edition'],
  ['chicago-author-date', 'Chicago Manual of Style, author-date'],
  ['chicago-notes', 'Chicago Manual of Style, notes'],
  ['mla', 'Modern Language Association 9th edition'],
  ['harvard-cite-them-right', 'Harvard, Cite Them Right'],
  ['nature', 'Nature'],
  ['vancouver', 'Vancouver'],
].map(([name, details]) => ({ name, details }));
