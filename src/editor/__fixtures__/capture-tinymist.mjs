// =============================================================================
// DBV Typst Editor — Captura de respuestas reales de Tinymist (fixtures de RF-77)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Genera `tinymist-0.15.8.json`, que usan los tests de la edición en varios
// ficheros y de la navegación: un proyecto de prueba con `main.typ` y
// `cap/uno.typ`, y las respuestas de definición, referencias, renombrar y
// acciones de código tal cual las da el binario vendorizado. La ruta temporal
// se sustituye por `ROOT`. Uso (tras `npm run vendor:tinymist`):
//   node src/editor/__fixtures__/capture-tinymist.mjs <carpeta-temporal> src/editor/__fixtures__/tinymist-0.15.8.json

import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const binaries = fileURLToPath(new URL('../../../src-tauri/binaries/', import.meta.url));
const bin = binaries + readdirSync(binaries).find((name) => name.startsWith('tinymist-'));
const dir = process.argv[2].replace(/\\/g, '/');
const out = process.argv[3];
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir + '/cap', { recursive: true });
const main = [
  '#let saluda(nombre) = [Hola #nombre]',
  '#include "cap/uno.typ"',
  'Ver @fig-gato y #saluda("Ana").',
  '#box(width: 1cm)[x]',
  '= Final',
].join('\n') + '\n';
const uno = '= Uno\n#figure(rect(), caption: [Gato]) <fig-gato>\nOtra vez @fig-gato.\n';
writeFileSync(dir + '/main.typ', main);
writeFileSync(dir + '/cap/uno.typ', uno);

const p = spawn(bin, ['lsp']);
let buf = Buffer.alloc(0);
let id = 0;
const pend = {};
p.stdout.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  for (;;) {
    const h = buf.indexOf('\r\n\r\n');
    if (h < 0) break;
    const len = +/Content-Length: (\d+)/.exec(buf.slice(0, h).toString())[1];
    if (buf.length < h + 4 + len) break;
    const m = JSON.parse(buf.slice(h + 4, h + 4 + len).toString());
    buf = buf.slice(h + 4 + len);
    if (m.id != null && pend[m.id] && !m.method) { pend[m.id](m); delete pend[m.id]; }
    else if (m.id != null && m.method) send({ jsonrpc: '2.0', id: m.id, result: null });
  }
});
const send = (o) => { const s = JSON.stringify(o); p.stdin.write(`Content-Length: ${Buffer.byteLength(s)}\r\n\r\n${s}`); };
const req = (method, params) => new Promise((r) => { const i = ++id; pend[i] = r; send({ jsonrpc: '2.0', id: i, method, params }); });
const uri = (f) => 'file:///' + dir + '/' + f;
const fixtures = { files: { 'main.typ': main, 'cap/uno.typ': uno } };
const keep = async (name, method, params) => {
  const r = await req(method, params);
  fixtures[name] = { method, params, result: 'result' in r ? r.result : { error: r.error } };
};

await req('initialize', {
  processId: null, rootUri: 'file:///' + dir,
  capabilities: {
    textDocument: {
      rename: { prepareSupport: true },
      definition: { linkSupport: true },
      codeAction: { codeActionLiteralSupport: { codeActionKind: { valueSet: ['quickfix', 'refactor', 'refactor.rewrite', 'source'] } } },
    },
    workspace: { workspaceEdit: { documentChanges: true, resourceOperations: ['create', 'rename', 'delete'], changeAnnotationSupport: { groupsOnLabel: true } } },
  },
});
send({ jsonrpc: '2.0', method: 'initialized', params: {} });
send({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri: uri('main.typ'), languageId: 'typst', version: 1, text: main } } });
await new Promise((r) => setTimeout(r, 6000));
const at = (file, line, character) => ({ textDocument: { uri: uri(file) }, position: { line, character } });

await keep('definitionLabel', 'textDocument/definition', at('main.typ', 2, 6));
await keep('definitionLet', 'textDocument/definition', at('main.typ', 2, 18));
await keep('definitionBuiltin', 'textDocument/definition', at('main.typ', 3, 2));
await keep('definitionInclude', 'textDocument/definition', at('main.typ', 1, 12));
await keep('referencesLabel', 'textDocument/references', { ...at('main.typ', 2, 6), context: { includeDeclaration: true } });
await keep('referencesLet', 'textDocument/references', { ...at('main.typ', 2, 18), context: { includeDeclaration: true } });
await keep('prepareRenameLet', 'textDocument/prepareRename', at('main.typ', 2, 18));
await keep('renameLet', 'textDocument/rename', { ...at('main.typ', 2, 18), newName: 'saludo' });
await keep('prepareRenameLabel', 'textDocument/prepareRename', at('main.typ', 2, 6));
await keep('renameLabel', 'textDocument/rename', { ...at('main.typ', 2, 6), newName: 'fig-felino' });
await keep('prepareRenameBuiltin', 'textDocument/prepareRename', at('main.typ', 3, 2));
await keep('prepareRenameInclude', 'textDocument/prepareRename', at('main.typ', 1, 12));
await keep('renameInclude', 'textDocument/rename', { ...at('main.typ', 1, 12), newName: 'cap/primero.typ' });
await keep('codeActionHeading', 'textDocument/codeAction', { textDocument: { uri: uri('main.typ') }, range: { start: { line: 4, character: 0 }, end: { line: 4, character: 0 } }, context: { diagnostics: [] } });
p.kill();

const text = JSON.stringify(fixtures, null, 2).split('file:///' + dir).join('file:///ROOT').split(dir).join('ROOT');
writeFileSync(out, text + '\n');
console.log(Object.keys(fixtures).map((k) => `${k}: ${JSON.stringify(fixtures[k].result ?? '').slice(0, 160)}`).join('\n'));
process.exit(0);
