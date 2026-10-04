// =============================================================================
// DBV Typst Editor — Tests de la importación de snippets de Sublime (RF-112)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import { parseSnippetFile } from './model.js';
import { buildSnippetFile, convertBatch, convertBody, convertSublimeSnippet, mergeIntoFile, nameFromFile, repeatedWithExisting, scopeApplies } from './sublimeImport.js';

/** Un `.sublime-snippet` con la forma de los reales (la plantilla de la documentación de Sublime). */
const snippet = ({ content = 'Hola, ${1:esto} es un ${2:snippet}.', trigger = 'hola', scope = '', description = 'Un saludo' } = {}) =>
  `<snippet>\n\t<content><![CDATA[\n${content}\n]]></content>\n\t${trigger === null ? '' : `<tabTrigger>${trigger}</tabTrigger>`}\n\t${scope ? `<scope>${scope}</scope>` : ''}\n\t${description ? `<description>${description}</description>` : ''}\n</snippet>\n`;

describe('el cuerpo se convierte a la sintaxis de VS Code que lee DBV', () => {
  it('los marcadores `$1`, `${1:texto}` y `$0` pasan tal cual, y se quitan el salto inicial y el final del CDATA', () => {
    expect(convertBody('\nUno $1 y ${2:dos} y $0\n')).toEqual({ body: 'Uno $1 y ${2:dos} y $0', variables: [] });
    expect(convertBody('\r\nA\r\nB\r\n').body).toBe('A\nB');
  });

  it('$SELECTION pasa a $TM_SELECTED_TEXT, también dentro de un marcador anidado', () => {
    expect(convertBody('#footnote[$SELECTION]').body).toBe('#footnote[$TM_SELECTED_TEXT]');
    expect(convertBody('${1:$SELECTION}').body).toBe('${1:$TM_SELECTED_TEXT}');
    expect(convertBody('${SELECTION}').body).toBe('${TM_SELECTED_TEXT}');
  });

  it('respeta los escapes: `\\$SELECTION` es texto, no una variable', () => {
    expect(convertBody('precio \\$SELECTION y \\\\ y \\$1')).toEqual({ body: 'precio \\$SELECTION y \\\\ y \\$1', variables: [] });
  });

  it('las variables que DBV admite se conservan y las que no se listan', () => {
    expect(convertBody('$TM_FILENAME_BASE y ${CURRENT_YEAR} y $TM_SELECTED_TEXT')).toEqual({ body: '$TM_FILENAME_BASE y ${CURRENT_YEAR} y $TM_SELECTED_TEXT', variables: [] });
    expect(convertBody('$TM_FULLNAME y $PARAM1 y ${TM_CURRENT_LINE} y $TM_FULLNAME').variables.sort()).toEqual(['PARAM1', 'TM_CURRENT_LINE', 'TM_FULLNAME']);
  });

  it('un `$` suelto o seguido de otra cosa no se toca', () => {
    expect(convertBody('cuesta 5$ y $ y $.').body).toBe('cuesta 5$ y $ y $.');
  });
});

describe('ámbito y nombre', () => {
  it('sin ámbito o con uno de Typst se importa; con otro, no', () => {
    for (const ok of ['', '   ', 'source.typst', 'text.typst', 'text.typst, source.python', 'TEXT.TYPST']) expect(scopeApplies(ok), ok).toBe(true);
    for (const no of ['source.python', 'text.html.markdown', 'source.js, source.ts']) expect(scopeApplies(no), no).toBe(false);
  });

  it('el nombre sale del fichero', () => {
    expect(nameFromFile('C:\\Users\\a\\Packages\\User\\Mi snippet.sublime-snippet')).toBe('Mi snippet');
    expect(nameFromFile('/home/a/foo.SUBLIME-SNIPPET')).toBe('foo');
    expect(nameFromFile('')).toBe('snippet');
  });
});

describe('un fichero .sublime-snippet', () => {
  it('se convierte: disparador → prefix, CDATA → body, descripción y nombre', () => {
    const result = convertSublimeSnippet({ name: 'saludo.sublime-snippet', content: snippet() });
    expect(result).toEqual({ ok: true, entry: { name: 'saludo', prefix: 'hola', body: 'Hola, ${1:esto} es un ${2:snippet}.', description: 'Un saludo' }, warnings: [] });
  });

  it('sin descripción usa el nombre del fichero', () => {
    const result = convertSublimeSnippet({ name: 'figura.sublime-snippet', content: snippet({ description: '' }) });
    expect(result.entry.description).toBe('figura');
  });

  it('con ámbito de Typst o sin él se importa; con otro se omite y se dice cuál era', () => {
    expect(convertSublimeSnippet({ name: 'a', content: snippet({ scope: 'source.typst' }) }).ok).toBe(true);
    expect(convertSublimeSnippet({ name: 'a', content: snippet({ scope: 'source.python' }) })).toEqual({ ok: false, reason: 'scope', detail: 'source.python' });
  });

  it('sin tabTrigger, sin contenido o con una variable no admitida se omite con su motivo', () => {
    expect(convertSublimeSnippet({ name: 'a', content: snippet({ trigger: null }) })).toEqual({ ok: false, reason: 'noTrigger' });
    expect(convertSublimeSnippet({ name: 'a', content: snippet({ content: '   ' }) })).toEqual({ ok: false, reason: 'noContent' });
    expect(convertSublimeSnippet({ name: 'a', content: snippet({ content: 'Autor: $TM_FULLNAME' }) })).toEqual({ ok: false, reason: 'variables', detail: '$TM_FULLNAME' });
  });

  it('XML roto, o que no es un snippet, no tumba nada', () => {
    expect(convertSublimeSnippet({ name: 'a', content: '<snippet><content>sin cerrar' })).toEqual({ ok: false, reason: 'notXml' });
    expect(convertSublimeSnippet({ name: 'a', content: '<otra><cosa/></otra>' })).toEqual({ ok: false, reason: 'notSnippet' });
    expect(convertSublimeSnippet({ name: 'a', content: '' })).toEqual({ ok: false, reason: 'notXml' });
  });

  it('un DOCTYPE o una entidad (XXE, bombas de expansión) se rechaza SIN leerla (RF-112.5)', () => {
    const xxe = '<?xml version="1.0"?><!DOCTYPE s [<!ENTITY x SYSTEM "file:///etc/passwd">]><snippet><content>&x;</content><tabTrigger>x</tabTrigger></snippet>';
    expect(convertSublimeSnippet({ name: 'a', content: xxe })).toEqual({ ok: false, reason: 'unsafeXml' });
    const bomb = '<!DOCTYPE lolz [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><snippet><tabTrigger>x</tabTrigger><content>&b;</content></snippet>';
    expect(convertSublimeSnippet({ name: 'a', content: bomb }).reason).toBe('unsafeXml');
  });

  it('un fichero enorme se rechaza antes de interpretarlo', () => {
    expect(convertSublimeSnippet({ name: 'a', content: 'x'.repeat(1_048_577) })).toEqual({ ok: false, reason: 'tooBig' });
  });

  it('una transformación `${1/regex/formato/}` pasa pero avisa: el motor de expresiones de Sublime no es el de VS Code', () => {
    const result = convertSublimeSnippet({ name: 'a', content: snippet({ content: '${1/(.)/\\u$1/}' }) });
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(['transform']);
  });
});

describe('un lote de ficheros', () => {
  const sources = [
    { name: 'a.sublime-snippet', content: snippet({ trigger: 'aa', description: 'A' }) },
    { name: 'b.sublime-snippet', content: snippet({ trigger: 'bb', scope: 'source.python' }) },
    { name: 'c.sublime-snippet', content: snippet({ trigger: 'aa', description: 'C (mismo prefijo)' }) },
    { name: 'd.sublime-snippet', content: snippet({ trigger: null }) },
    { name: 'e.sublime-snippet', error: 'tooBig' },
    { name: 'a.sublime-snippet', content: snippet({ trigger: 'zz', description: 'otro con el mismo nombre' }) },
  ];

  it('cuenta convertidos y omitidos, con su motivo, y no se rompe con ninguno', () => {
    const batch = convertBatch(sources);
    expect(batch.entries.map((e) => e.name)).toEqual(['a', 'c', 'a 2']);
    expect(batch.skipped).toEqual([
      { name: 'b.sublime-snippet', reason: 'scope', detail: 'source.python' },
      { name: 'd.sublime-snippet', reason: 'noTrigger' },
      { name: 'e.sublime-snippet', reason: 'tooBig' },
    ]);
  });

  it('un prefijo repetido en el lote se avisa y no se omite', () => {
    const batch = convertBatch(sources);
    expect(batch.warnings).toEqual([{ name: 'c', warning: 'repeatedPrefix', detail: 'aa' }]);
    expect(batch.entries.filter((e) => e.prefix === 'aa')).toHaveLength(2);
  });

  it('un lote vacío no falla', () => {
    expect(convertBatch([])).toEqual({ entries: [], skipped: [], warnings: [] });
  });
});

describe('el fichero que se escribe', () => {
  const entries = [
    { name: 'saludo', prefix: 'hola', body: 'Hola, ${1:esto}.\nSegunda línea $0', description: 'Un saludo' },
    { name: 'con "comillas"', prefix: 'q', body: '#let x = "y"', description: 'Con "comillas" y \\ barra' },
  ];

  it('es JSONC válido que DBV lee SIN avisos, con las líneas del cuerpo y el ámbito de Typst', () => {
    const text = buildSnippetFile(entries);
    const parsed = parseSnippetFile(text, 'project');
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.snippets.map((s) => [s.name, s.prefix, s.body])).toEqual([
      ['saludo', 'hola', 'Hola, ${1:esto}.\nSegunda línea $0'],
      ['con "comillas"', 'q', '#let x = "y"'],
    ]);
    expect(text).toContain('"scope": "typst"');
    expect(text).toContain('importados de Sublime Text');
  });

  it('un lote vacío da un fichero válido y vacío', () => {
    expect(parseSnippetFile(buildSnippetFile([]), 'project')).toEqual({ snippets: [], errors: [], warnings: [] });
  });

  it('añadir a un fichero que ya existe conserva sus comentarios y sus snippets', () => {
    const existing = '{\n  // los míos\n  "Mío": { "prefix": "mio", "body": "x", "description": "d" }\n}\n';
    const merged = mergeIntoFile(existing, entries);
    expect(merged.ok).toBe(true);
    expect(merged.text).toContain('// los míos');
    const parsed = parseSnippetFile(merged.text, 'project');
    expect(parsed.errors).toEqual([]);
    expect(parsed.snippets.map((s) => s.prefix).sort()).toEqual(['hola', 'mio', 'q']);
    expect(merged.text).toContain('"scope": "typst"');
  });

  it('un nombre que ya existe en el fichero no lo pisa: se numera', () => {
    const existing = '{ "saludo": { "prefix": "viejo", "body": "x" } }';
    const merged = mergeIntoFile(existing, [entries[0]]);
    expect(parseSnippetFile(merged.text, 'project').snippets.map((s) => s.name).sort()).toEqual(['saludo', 'saludo 2']);
  });

  it('un fichero existente que no es JSON válido no se toca', () => {
    expect(mergeIntoFile('{ esto no es json', entries)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('los prefijos que ya existen en el destino se detectan', () => {
    expect(repeatedWithExisting(entries, [{ prefix: 'hola' }, { prefix: 'otro' }])).toEqual(['hola']);
    expect(repeatedWithExisting(entries, [])).toEqual([]);
  });
});
