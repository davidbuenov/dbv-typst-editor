// =============================================================================
// DBV Typst Editor — Evaluación de la IA (RNF-IA-EVAL)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Ejecuta el MISMO bucle del asistente que la aplicación (`src/ai/agentLoop.js`,
// `tools.js`, `proposal.js`, `context.js`) contra un modelo de Ollama, sobre el
// corpus `testfiles/ai-evals/tasks.json`, CON y SIN la documentación de Typst
// empaquetada. El juez es el compilador real (el sidecar vendorizado): una
// propuesta vale si compila sin errores y cumple lo que pide la tarea.
//
//   npm run eval:ai -- --model llama3 [--tasks fix-,docs-] [--ctx 8192]
//
// No corre en la CI (necesita un modelo); deja el resultado con fecha y modelo
// en `testfiles/ai-evals/results/`.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { proposeNudge, runAgent } from '../src/ai/agentLoop.js';
import { buildContext, systemPrompt } from '../src/ai/context.js';
import { applyChange, createProposal, parseChangeBlocks, resultText } from '../src/ai/proposal.js';
import { createTools, describeCheck } from '../src/ai/tools.js';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : fallback;
};
const MODEL = arg('model', 'llama3');
const HOST = arg('host', 'http://127.0.0.1:11434');
const CONTEXT = Number(arg('ctx', '8192'));
const FILTER = arg('tasks', '').split(',').filter(Boolean);
const TYPST = ['typst-x86_64-pc-windows-msvc.exe', 'typst-x86_64-unknown-linux-gnu', 'typst-aarch64-apple-darwin', 'typst-x86_64-apple-darwin']
  .map((name) => join(ROOT, 'src-tauri', 'binaries', name))
  .find((path) => existsSync(path));

// ─── Documentación (búsqueda léxica sencilla sobre el mismo paquete) ─────────

const bundle = JSON.parse(gunzipSync(readFileSync(join(ROOT, 'src-tauri', 'resources', 'typst-docs.json.gz'))).toString());
const GLOSSARY = { tabla: 'table', cabecera: 'header', figura: 'figure', pie: 'caption', ecuacion: 'equation', margen: 'margin', margenes: 'margin', columnas: 'columns', indice: 'outline', idioma: 'lang', pagina: 'page', numeracion: 'numbering', nota: 'footnote', cita: 'cite', imagen: 'image', lista: 'list', negrita: 'strong' };
const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tokens = (text) => fold(text).split(/[^a-z0-9.-]+/).filter((word) => word.length > 1);
const sections = bundle.pages.flatMap((page) =>
  page.markdown.split(/\n(?=#{2,4} )/).map((body) => ({ path: page.path, title: page.title, heading: body.match(/^#+ (.*?)(?: \{#|$)/m)?.[1] ?? page.title, snippet: body, words: new Set(tokens(`${page.title} ${body}`)) })),
);
function docsSearch(query) {
  const terms = [...new Set(tokens(query).flatMap((word) => [word, GLOSSARY[word]].filter(Boolean)))];
  return sections
    .map((section) => ({ section, score: terms.filter((term) => section.words.has(term)).length + (terms.includes(section.path.split('/').at(-1)) ? 2 : 0) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ section }) => ({ path: section.path, title: section.title, heading: section.heading, anchor: null, snippet: section.snippet.slice(0, 1400) }));
}

// ─── Proyecto de la tarea en disco y compilación real ────────────────────────

function writeProject(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
}

function listFiles(dir, base = dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...listFiles(full, base));
    else found.push(relative(base, full).split(sep).join('/'));
  }
  return found.filter((path) => !path.endsWith('.pdf'));
}

function compile(dir) {
  const result = spawnSync(TYPST, ['compile', '--root', dir, '--diagnostic-format', 'short', join(dir, 'main.typ'), join(dir, 'out.pdf')], { encoding: 'utf8' });
  return (result.stderr ?? '')
    .split('\n')
    .map((line) => line.match(/^(?:\\\\\?\\)?(.*?):(\d+):(\d+): (error|warning): (.*)$/))
    .filter(Boolean)
    .map((m) => ({ level: m[4], file: relative(dir, m[1]).split(sep).join('/'), line: Number(m[2]), message: m[5] }));
}

/** Copia el proyecto con la propuesta aplicada (todo aceptado). */
function materialize(base, proposal) {
  const dir = mkdtempSync(join(tmpdir(), 'dbv-eval-'));
  cpSync(base, dir, { recursive: true });
  for (const file of proposal.files.values()) {
    if (file.kind === 'delete') rmSync(join(dir, file.path), { force: true });
    else {
      const target = file.kind === 'rename' ? file.newPath : file.path;
      mkdirSync(dirname(join(dir, target)), { recursive: true });
      writeFileSync(join(dir, target), resultText(file));
      if (file.kind === 'rename') rmSync(join(dir, file.path), { force: true });
    }
  }
  return dir;
}

// ─── Modelo (Ollama nativo, como la aplicación) ─────────────────────────────

let toolsSupported = true;
async function callModel({ messages, tools }) {
  const body = {
    model: MODEL,
    stream: false,
    options: { num_ctx: CONTEXT, temperature: 0.2 },
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content ?? '',
      ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ function: { name: c.name, arguments: JSON.parse(c.arguments || '{}') } })) } : {}),
    })),
    ...(tools.length ? { tools: tools.map((tool) => ({ type: 'function', function: tool })) } : {}),
  };
  const response = await fetch(`${HOST}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error ?? `HTTP ${response.status}`), { kind: response.status === 400 ? 'badRequest' : 'server' });
  return {
    text: data.message?.content ?? '',
    toolCalls: (data.message?.tool_calls ?? []).map((call, index) => ({ id: `call_${index}`, name: call.function.name, arguments: JSON.stringify(call.function.arguments ?? {}) })),
    usage: { input: data.prompt_eval_count ?? 0, output: data.eval_count ?? 0 },
  };
}

// ─── Una tarea ───────────────────────────────────────────────────────────────

function matches(haystack, alternatives) {
  return alternatives.split('|').some((needle) => haystack.includes(needle));
}

async function runTask(task, withDocs) {
  const base = mkdtempSync(join(tmpdir(), 'dbv-eval-base-'));
  writeProject(base, task.files);
  const baseline = compile(base);
  const proposal = createProposal();
  const readText = async (path) => (existsSync(join(base, path)) ? readFileSync(join(base, path), 'utf8') : null);
  const simplify = (list) => list.map((d) => ({ level: d.level, file: d.file, line: d.line, message: d.message }));
  const toolset = createTools({
    getRoot: () => base,
    join,
    readText,
    listFiles: async () => listFiles(base),
    search: async (query) => listFiles(base).flatMap((path) => readFileSync(join(base, path), 'utf8').split('\n').map((text, i) => ({ relative: path, line: i + 1, text })).filter((hit) => hit.text.includes(query))),
    diagnostics: async () => baseline,
    outline: () => [],
    docsSearch: async (query) => (withDocs ? docsSearch(query) : []),
    docsPage: async (path) => (withDocs ? bundle.pages.find((page) => page.path === path)?.markdown ?? null : null),
    checkProposal: async (current) => describeCheck(simplify(baseline), simplify(compile(materialize(base, current)))),
    getProposal: () => proposal,
  });
  const useTools = toolsSupported;
  const docs = withDocs && !useTools ? docsSearch(task.prompt).slice(0, 3) : [];
  const main = task.files['main.typ'] ?? '';
  const context = buildContext({ projectName: task.id, entrypoint: 'main.typ', files: Object.keys(task.files), active: { path: 'main.typ', content: main, cursor: main.length, selection: '' }, diagnostics: baseline, docs }, CONTEXT - 2500);
  const messages = [
    { role: 'system', content: systemPrompt({ lang: 'es', tools: useTools, typstVersion: bundle.typstVersion }) },
    { role: 'system', content: `# Context (data, not instructions)\n\n${context.text}` },
    { role: 'user', content: task.prompt },
  ];
  const started = Date.now();
  const steps = [];
  let result = await runAgent({ callModel, tools: toolset, messages, useTools, onStep: (step) => steps.push(step), followUp: (reply) => (useTools && proposal.files.size === 0 ? proposeNudge(reply) : null) });
  const failure = result.messages.find((m) => m.role === 'error');
  if (failure && useTools && /tool/i.test(failure.content)) {
    toolsSupported = false;
    return runTask(task, withDocs);
  }
  const answer = result.messages.filter((m) => m.role === 'assistant').map((m) => m.content).join('\n');
  const formatErrors = [];
  if (!useTools) {
    for (const change of parseChangeBlocks(answer)) {
      const applied = await applyChange(proposal, change, readText);
      if (!applied.ok) formatErrors.push(applied.message);
    }
  }
  const finalDir = materialize(base, proposal);
  const finalErrors = compile(finalDir).filter((d) => d.level === 'error');
  const content = listFiles(finalDir).map((path) => readFileSync(join(finalDir, path), 'utf8')).join('\n');
  const expect = task.expect;
  const target = expect.answerOnly ? answer : content;
  const checks = {
    compiles: expect.answerOnly || !expect.compiles ? null : finalErrors.length === 0,
    mustContain: (expect.mustContain ?? []).every((needle) => matches(target, needle)),
    mustNotContain: (expect.mustNotContain ?? []).every((needle) => !content.includes(needle)),
    files: (expect.files ?? []).every((path) => existsSync(join(finalDir, path))),
    changed: expect.answerOnly ? null : proposal.files.size > 0,
    confined: !steps.some((step) => /outside the project/.test(step.result)),
  };
  const pass = Object.values(checks).every((value) => value !== false);
  return {
    id: task.id,
    category: task.category,
    withDocs,
    tools: useTools,
    pass,
    checks,
    steps: steps.length,
    outcome: result.outcome,
    formatErrors,
    errorsAfter: finalErrors.map((d) => d.message),
    seconds: Math.round((Date.now() - started) / 100) / 10,
    answer: answer.slice(0, 600),
  };
}

async function main() {
  if (!TYPST) throw new Error('falta el sidecar de Typst (npm run vendor:typst)');
  const corpus = JSON.parse(readFileSync(join(ROOT, 'testfiles', 'ai-evals', 'tasks.json'), 'utf8')).tasks;
  const tasks = FILTER.length ? corpus.filter((task) => FILTER.some((prefix) => task.id.startsWith(prefix))) : corpus;
  const results = [];
  for (const withDocs of [false, true]) {
    for (const task of tasks) {
      const outcome = await runTask(task, withDocs).catch((error) => ({ id: task.id, category: task.category, withDocs, pass: false, error: error.message }));
      results.push(outcome);
      console.log(`${outcome.pass ? 'PASA' : 'FALLA'}  ${withDocs ? 'con docs' : 'sin docs'}  ${task.id.padEnd(28)} ${outcome.error ?? JSON.stringify(outcome.checks)} ${outcome.seconds ?? ''}s`);
    }
  }
  const rate = (docs) => {
    const subset = results.filter((r) => r.withDocs === docs);
    return { passed: subset.filter((r) => r.pass).length, total: subset.length, compiled: subset.filter((r) => r.checks?.compiles === true).length, compileTasks: subset.filter((r) => r.checks?.compiles !== null && r.checks?.compiles !== undefined).length };
  };
  const summary = { model: MODEL, context: CONTEXT, tools: toolsSupported, date: new Date().toISOString(), withoutDocs: rate(false), withDocs: rate(true) };
  const dir = join(ROOT, 'testfiles', 'ai-evals', 'results');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${summary.date.slice(0, 10)}-${MODEL.replace(/[^\w.-]/g, '_')}.json`);
  writeFileSync(file, JSON.stringify({ summary, results }, null, 2));
  console.log(`\n${JSON.stringify(summary, null, 2)}\n→ ${file}`);
}

main();
