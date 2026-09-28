// =============================================================================
// DBV Typst Editor — Tests del cliente LSP Tinymist (RF-21)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompletionContext, autocompletion, snippet } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  createLspClient,
  createLspCompletionSource,
  formatSignature,
  LSP_AUTOSTART_MAX_CHARS,
  getCompletionWordRange,
  lspSnippetToCodeMirror,
  mapLspKind,
  pathToUri,
  posFromLsp,
  shouldRequestCompletion,
} from './lspClient.js';
import * as backend from '../services/backend.js';

describe('lspClient', () => {
  describe('helpers', () => {
    it('pathToUri normaliza rutas Windows y Unix', () => {
      expect(pathToUri('C:\\mi\\proyecto\\main.typ')).toBe('file:///C:/mi/proyecto/main.typ');
      expect(pathToUri('/home/user/doc.typ')).toBe('file:///home/user/doc.typ');
      expect(pathToUri('')).toBe('');
    });

    it('mapLspKind mapea tipos estándar', () => {
      expect(mapLspKind(1)).toBe('text');
      expect(mapLspKind(3)).toBe('function');
      expect(mapLspKind(14)).toBe('keyword');
      expect(mapLspKind(15)).toBe('snippet');
      expect(mapLspKind(999)).toBe('text');
    });

    it('getCompletionWordRange calcula rangos para directivas (#), citas (@) y palabras', () => {
      const makeContext = (text) => ({
        pos: text.length,
        matchBefore(re) {
          const m = text.match(new RegExp(re.source + '$'));
          if (!m) return null;
          return { from: text.length - m[0].length, to: text.length, text: m[0] };
        },
      });

      expect(getCompletionWordRange(makeContext('#l'))).toEqual({
        from: 1,
        to: 2,
        isTrigger: true,
      });

      expect(getCompletionWordRange(makeContext('@ref'))).toEqual({
        from: 1,
        to: 4,
        isTrigger: true,
      });

      expect(getCompletionWordRange(makeContext('figure'))).toEqual({
        from: 0,
        to: 6,
        isTrigger: false,
      });

      expect(getCompletionWordRange(makeContext('cetz.'))).toEqual({
        from: 5,
        to: 5,
        isTrigger: true,
      });
    });

    it('posFromLsp calcula offset absoluto', () => {
      const doc = {
        lines: 3,
        line(n) {
          if (n === 1) return { from: 0, to: 10 };
          if (n === 2) return { from: 11, to: 25 };
          return { from: 26, to: 40 };
        },
      };

      expect(posFromLsp(doc, { line: 0, character: 4 })).toBe(4);
      expect(posFromLsp(doc, { line: 1, character: 5 })).toBe(16);
      expect(posFromLsp(doc, { line: 1, character: 50 })).toBe(25); // Clamped to line.to
    });
  });

  describe('createLspClient', () => {
    let client;
    let notifications;

    beforeEach(() => {
      notifications = [];
      vi.spyOn(backend, 'on').mockResolvedValue(() => {});
      client = createLspClient({
        notify: (msg) => notifications.push(msg),
      });
    });

    it('start inicia el sidecar y activa el estado', async () => {
      vi.spyOn(backend, 'tinymistStart').mockResolvedValue({ ok: true, value: null });

      const ok = await client.start('/ruta/proyecto');
      expect(ok).toBe(true);
      expect(client.isActive()).toBe(true);
    });

    it('start maneja fallos de arranque con degradación suave', async () => {
      vi.spyOn(backend, 'tinymistStart').mockResolvedValue({
        ok: false,
        error: { kind: 'bridge', message: 'Binary not found' },
      });

      const ok = await client.start('/ruta/proyecto');
      expect(ok).toBe(false);
      expect(client.isActive()).toBe(false);
    });

    it('openDocument y changeDocument envían notificaciones al sidecar', async () => {
      vi.spyOn(backend, 'tinymistStart').mockResolvedValue({ ok: true, value: null });
      const notifSpy = vi.spyOn(backend, 'tinymistSendNotification').mockResolvedValue({
        ok: true,
        value: null,
      });

      await client.start('/ruta/proyecto');
      await client.openDocument('/ruta/proyecto/doc.typ', '= Hola');

      expect(notifSpy).toHaveBeenCalledWith('textDocument/didOpen', {
        textDocument: {
          uri: 'file:///ruta/proyecto/doc.typ',
          languageId: 'typst',
          version: 1,
          text: '= Hola',
        },
      });

      await client.changeDocument('= Hola mundo');
      expect(notifSpy).toHaveBeenCalledWith('textDocument/didChange', {
        textDocument: {
          uri: 'file:///ruta/proyecto/doc.typ',
          version: 2,
        },
        contentChanges: [{ text: '= Hola mundo' }],
      });
    });

    it('getCompletions formatea sugerencias de Tinymist', async () => {
      vi.spyOn(backend, 'tinymistStart').mockResolvedValue({ ok: true, value: null });
      vi.spyOn(backend, 'tinymistSendRequest').mockResolvedValue({
        ok: true,
        value: {
          items: [
            { label: 'figure', kind: 3, detail: 'fn(..)', documentation: 'Inserta figura' },
            { label: 'table', kind: 14, insertText: 'table()' },
          ],
        },
      });

      await client.start('/ruta/proyecto');
      await client.openDocument('/ruta/proyecto/doc.typ', '= Hola');

      const items = await client.getCompletions(5, 0, 5);
      expect(items.length).toBe(2);
      expect(items[0].label).toBe('figure');
      expect(items[0].type).toBe('function');
      expect(items[0].apply).toBe('figure');
      expect(items[1].apply).toBe('table()');
    });

    it('getHover extrae documentación de Tinymist', async () => {
      vi.spyOn(backend, 'tinymistStart').mockResolvedValue({ ok: true, value: null });
      vi.spyOn(backend, 'tinymistSendRequest').mockResolvedValue({
        ok: true,
        value: {
          contents: '```typc\nlet x: int\n```',
        },
      });

      await client.start('/ruta/proyecto');
      await client.openDocument('/ruta/proyecto/doc.typ', '= Hola');

      const hover = await client.getHover(0, 5);
      expect(hover).toBe('```typc\nlet x: int\n```');
    });

    it('formatDocument aplica ediciones devueltas por typstyle', async () => {
      vi.spyOn(backend, 'tinymistStart').mockResolvedValue({ ok: true, value: null });
      const requestSpy = vi.spyOn(backend, 'tinymistSendRequest').mockResolvedValue({
        ok: true,
        value: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
            newText: '= Formateado',
          },
        ],
      });

      await client.start('/ruta/proyecto');
      await client.openDocument('/ruta/proyecto/doc.typ', '= Hola');

      const dispatchSpy = vi.fn();
      const mockView = {
        state: {
          doc: {
            lines: 1,
            line: () => ({ from: 0, to: 6 }),
          },
        },
        dispatch: dispatchSpy,
      };

      const result = await client.formatDocument(mockView, '/ruta/proyecto/doc.typ');
      expect(result).toEqual({ status: 'formatted' });
      expect(dispatchSpy).toHaveBeenCalled();
      expect(notifications.length).toBe(1);
      expect(requestSpy).toHaveBeenCalledOnce();
    });

    it('formatDocument NO formatea un documento distinto al que Tinymist tiene abierto (RF-61) — protege un .bib de que se le apliquen ediciones de otro fichero', async () => {
      // Reproduce el bug real: `editor.js` solo llama a `openDocument` con
      // ficheros Typst (RF-60.2), así que `currentDoc` de Tinymist se queda
      // apuntando a `main.typ` aunque el usuario haya abierto después
      // `refs.bib`. Antes del arreglo, pulsar Formatear con `refs.bib`
      // delante formateaba igualmente `main.typ` y volcaba esas ediciones en
      // el buffer de `refs.bib`.
      vi.spyOn(backend, 'tinymistStart').mockResolvedValue({ ok: true, value: null });
      const requestSpy = vi.spyOn(backend, 'tinymistSendRequest').mockResolvedValue({
        ok: true,
        value: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
            newText: '= Formateado',
          },
        ],
      });

      await client.start('/ruta/proyecto');
      await client.openDocument('/ruta/proyecto/main.typ', '= Hola');

      const dispatchSpy = vi.fn();
      const mockView = { state: { doc: { lines: 1, line: () => ({ from: 0, to: 6 }) } }, dispatch: dispatchSpy };

      // El usuario tiene `refs.bib` abierto en el editor: se pasa esa ruta
      // como la ACTIVA, aunque `currentDoc` de Tinymist siga en `main.typ`.
      const result = await client.formatDocument(mockView, '/ruta/proyecto/refs.bib');

      expect(result).toEqual({ status: 'not-typst' });
      expect(requestSpy).not.toHaveBeenCalled();
      expect(dispatchSpy).not.toHaveBeenCalled();
      expect(notifications.length).toBe(0);
    });

    it('formatDocument avisa sin formatear cuando Tinymist está apagado', async () => {
      const requestSpy = vi.spyOn(backend, 'tinymistSendRequest');
      // Sin `start()`: el cliente nunca llega a `active`.
      const mockView = { state: { doc: { lines: 1, line: () => ({ from: 0, to: 0 }) } }, dispatch: vi.fn() };

      // `currentDoc` solo se rellena vía `openDocument`, que aquí queda en
      // cola porque Tinymist no está activo — simula el mismo documento Typst
      // abierto con el LSP apagado (o sin arrancar aún).
      await client.openDocument('/ruta/proyecto/main.typ', '= Hola');

      const result = await client.formatDocument(mockView, '/ruta/proyecto/main.typ');

      expect(result.status).toBe('lsp-off');
      expect(requestSpy).not.toHaveBeenCalled();
      expect(notifications).toEqual([expect.stringContaining('Tinymist')]);
    });

    it('formatDocument avisa "ya estaba formateado" cuando Tinymist no devuelve ediciones', async () => {
      vi.spyOn(backend, 'tinymistStart').mockResolvedValue({ ok: true, value: null });
      vi.spyOn(backend, 'tinymistSendRequest').mockResolvedValue({ ok: true, value: [] });
      const mockView = { state: { doc: { lines: 1, line: () => ({ from: 0, to: 0 }) } }, dispatch: vi.fn() };

      await client.start('/ruta/proyecto');
      await client.openDocument('/ruta/proyecto/main.typ', '= Hola');

      const result = await client.formatDocument(mockView, '/ruta/proyecto/main.typ');

      expect(result).toEqual({ status: 'unchanged' });
      expect(mockView.dispatch).not.toHaveBeenCalled();
    });

    it('encola openDocument si el LSP aun no esta activo y lo envia al terminar start', async () => {
      vi.spyOn(backend, 'tinymistStart').mockResolvedValue({ ok: true, value: null });
      const notifSpy = vi.spyOn(backend, 'tinymistSendNotification').mockResolvedValue({
        ok: true,
        value: null,
      });

      await client.openDocument('/ruta/proyecto/doc.typ', '= Documento en cola');
      expect(notifSpy).not.toHaveBeenCalled();

      await client.start('/ruta/proyecto');
      expect(notifSpy).toHaveBeenCalledWith('textDocument/didOpen', {
        textDocument: {
          uri: 'file:///ruta/proyecto/doc.typ',
          languageId: 'typst',
          version: 1,
          text: '= Documento en cola',
        },
      });
    });
    describe('arranque perezoso (documentos grandes)', () => {
      const small = '= Capítulo corto';
      const big = 'x'.repeat(LSP_AUTOSTART_MAX_CHARS + 1);
      let startSpy;
      let stopSpy;
      let statuses;

      beforeEach(() => {
        localStorage.clear();
        statuses = [];
        startSpy = vi.spyOn(backend, 'tinymistStart').mockResolvedValue({ ok: true, value: null });
        stopSpy = vi.spyOn(backend, 'tinymistStop').mockResolvedValue({ ok: true, value: null });
        vi.spyOn(backend, 'tinymistSendNotification').mockResolvedValue({ ok: true, value: null });
        client = createLspClient({ onStatusChange: (status) => statuses.push(status) });
      });

      it('abrir el proyecto NO arranca Tinymist: queda en pausa', async () => {
        await client.setProjectRoot('/p');

        expect(startSpy).not.toHaveBeenCalled();
        expect(statuses.at(-1)).toBe('idle');
      });

      it('un documento pequeño lo arranca solo', async () => {
        await client.setProjectRoot('/p');

        await client.openDocument('/p/a.typ', small);
        await vi.waitFor(() => expect(client.isActive()).toBe(true));

        expect(startSpy).toHaveBeenCalledOnce();
      });

      it('un documento grande NO lo arranca', async () => {
        await client.setProjectRoot('/p');

        await client.openDocument('/p/IP.typ', big);

        expect(startSpy).not.toHaveBeenCalled();
        expect(client.isActive()).toBe(false);
      });

      it('enable() lo arranca aunque el documento sea grande y lo deja fijado', async () => {
        await client.setProjectRoot('/p');
        await client.openDocument('/p/IP.typ', big);

        await client.enable();
        expect(client.isActive()).toBe(true);

        // Fijado a mano: otro documento grande ya no lo detiene.
        await client.openDocument('/p/otro.typ', big);
        expect(client.isActive()).toBe(true);
        expect(stopSpy).not.toHaveBeenCalled();
      });

      it('pasar de un documento pequeño a uno grande lo detiene', async () => {
        await client.setProjectRoot('/p');
        await client.openDocument('/p/a.typ', small);
        await vi.waitFor(() => expect(client.isActive()).toBe(true));

        await client.openDocument('/p/IP.typ', big);

        expect(client.isActive()).toBe(false);
        expect(stopSpy).toHaveBeenCalledOnce();
        expect(statuses.at(-1)).toBe('idle');
      });

      it('disable() lo detiene y no vuelve a arrancar solo, ni con un documento pequeño', async () => {
        await client.setProjectRoot('/p');
        await client.openDocument('/p/a.typ', small);
        await vi.waitFor(() => expect(client.isActive()).toBe(true));

        await client.disable();
        expect(client.isActive()).toBe(false);
        expect(statuses.at(-1)).toBe('idle');
        expect(stopSpy).toHaveBeenCalledOnce();

        startSpy.mockClear();
        await client.openDocument('/p/b.typ', small);
        expect(startSpy).not.toHaveBeenCalled();
      });

      it('lo apagado a mano se recuerda en una sesión nueva', async () => {
        await client.setProjectRoot('/p');
        await client.disable();

        const reopened = createLspClient({});
        await reopened.setProjectRoot('/p');
        await reopened.openDocument('/p/a.typ', small);

        expect(reopened.isDisabled()).toBe(true);
        expect(startSpy).not.toHaveBeenCalled();
      });

      it('enable() lo reactiva y borra la preferencia', async () => {
        await client.setProjectRoot('/p');
        await client.disable();

        await client.enable();

        expect(client.isActive()).toBe(true);
        expect(client.isDisabled()).toBe(false);
        expect(localStorage.getItem('dbv-typst-lsp-disabled')).toBeNull();
      });

      it('tras un arranque fallido NO lo reintenta con cada documento que se abre', async () => {
        startSpy.mockResolvedValue({ ok: false, error: { kind: 'bridge', message: 'Binary not found' } });
        await client.setProjectRoot('/p');

        await client.openDocument('/p/a.typ', small);
        await vi.waitFor(() => expect(statuses.at(-1)).toBe('error'));
        await client.openDocument('/p/b.typ', small);
        await client.openDocument('/p/c.typ', small);

        expect(startSpy).toHaveBeenCalledOnce();
      });

      it('tras un fallo, activarlo a mano con la insignia sí lo reintenta', async () => {
        startSpy.mockResolvedValueOnce({ ok: false, error: { kind: 'bridge', message: 'x' } });
        await client.setProjectRoot('/p');
        await client.openDocument('/p/a.typ', small);
        await vi.waitFor(() => expect(statuses.at(-1)).toBe('error'));

        await client.enable();

        expect(startSpy).toHaveBeenCalledTimes(2);
        expect(client.isActive()).toBe(true);
      });

      it('cambiar de proyecto suelta la activación manual', async () => {
        await client.setProjectRoot('/p');
        await client.enable();

        await client.setProjectRoot('/otro');
        await client.openDocument('/otro/IP.typ', big);

        expect(client.isActive()).toBe(false);
      });
    });
  });
});

// Respuestas reales de Tinymist (capturadas con el binario del sidecar) para
// `#box(`: son las que VS Code usa para ofrecer los parámetros de la función.
const edit = (newText, line, start, end = start) => ({
  newText,
  range: { start: { line, character: start }, end: { line, character: end } },
});

describe('autocompletado completo de Tinymist (parámetros, snippets y firma)', () => {
  describe('lspSnippetToCodeMirror', () => {
    it('conserva los campos numerados que ya entiende CodeMirror', () => {
      expect(lspSnippetToCodeMirror('box(${1:})')).toBe('box(${1:})');
      expect(lspSnippetToCodeMirror('rgb(${1:r}, ${2:g})')).toBe('rgb(${1:r}, ${2:g})');
    });

    it('convierte los tabstops sin llaves ($1, $0)', () => {
      expect(lspSnippetToCodeMirror('image($1)$0')).toBe('image(${1})${0}');
    });

    it('escapa las llaves literales de Typst para que CodeMirror no las tome por campos', () => {
      expect(lspSnippetToCodeMirror('#{ $0 }')).toBe('#\\{ ${0} \\}');
      expect(lspSnippetToCodeMirror('for (${1:key}, ${2:value}) in ${3:(a: 1)} {\n\t${4:}\n}')).toBe(
        'for (${1:key}, ${2:value}) in ${3:(a: 1)} \\{\n\t${4:}\n\\}'
      );
    });

    it('el resultado inserta las llaves tal cual en el documento', () => {
      const view = new EditorView({ state: EditorState.create({ doc: '' }), parent: document.body });
      snippet(lspSnippetToCodeMirror('#{ $0 }'))(view, null, 0, 0);
      expect(view.state.doc.toString()).toBe('#{  }');
      expect(view.state.selection.main.head).toBe(3);
      view.destroy();
    });

    it('resuelve escapes, elecciones, variables y placeholders anidados', () => {
      expect(lspSnippetToCodeMirror('\\$x \\}')).toBe('$x \\}');
      expect(lspSnippetToCodeMirror('${1|left,right|}')).toBe('${1:left}');
      expect(lspSnippetToCodeMirror('$TM_SELECTED_TEXT${1}')).toBe('${1:}');
      expect(lspSnippetToCodeMirror('${1:a ${2:b}}')).toBe('${1:a b}');
    });
  });

  describe('shouldRequestCompletion', () => {
    const ctx = (doc, explicit = false) =>
      new CompletionContext(EditorState.create({ doc }), doc.length, explicit);

    it('pregunta tras "(" , "," y ":" aunque no haya palabra escrita', () => {
      expect(shouldRequestCompletion(ctx('#box('))).toBe(true);
      expect(shouldRequestCompletion(ctx('#box(width: 1cm,'))).toBe(true);
      expect(shouldRequestCompletion(ctx('#box(fill:'))).toBe(true);
    });

    it('pregunta con una palabra a medias o con Ctrl+Espacio', () => {
      expect(shouldRequestCompletion(ctx('#box(w'))).toBe(true);
      expect(shouldRequestCompletion(ctx('hola ', true))).toBe(true);
    });

    it('no pregunta tras un espacio en texto normal', () => {
      expect(shouldRequestCompletion(ctx('hola '))).toBe(false);
    });
  });

  describe('formatSignature', () => {
    const help = {
      activeSignature: 0,
      signatures: [
        {
          label: 'box(body: content | none, fill: color, width: auto | relative) -> box',
          activeParameter: 1,
          parameters: [
            { label: 'body:', documentation: { kind: 'markdown', value: 'The contents.' } },
            { label: 'fill:', documentation: { kind: 'markdown', value: 'The fill.\n\nMore details.' } },
            { label: 'width:' },
          ],
        },
      ],
    };

    it('resalta el parámetro activo entero (nombre y tipo) y da su documentación breve', () => {
      const sig = formatSignature(help);
      expect(sig.label.slice(sig.activeStart, sig.activeEnd)).toBe('fill: color');
      expect(sig.doc).toBe('The fill.');
    });

    it('el último parámetro llega hasta el paréntesis de cierre', () => {
      const sig = formatSignature({ ...help, signatures: [{ ...help.signatures[0], activeParameter: 2 }] });
      expect(sig.label.slice(sig.activeStart, sig.activeEnd)).toBe('width: auto | relative');
    });

    it('no confunde el nombre de la función con un parámetro homónimo (text(text: …))', () => {
      const sig = formatSignature({
        signatures: [
          { label: 'text(text: str, fill: color) -> text', activeParameter: 0, parameters: [{ label: 'text:' }] },
        ],
      });
      expect(sig.activeStart).toBe(5);
    });

    it('sin firmas devuelve null', () => {
      expect(formatSignature(null)).toBeNull();
      expect(formatSignature({ signatures: [] })).toBeNull();
    });
  });

  describe('getCompletions', () => {
    it('conserva orden (sortText), rango y un detalle corto; filtra "a4" sin comillas', async () => {
      vi.spyOn(backend, 'on').mockResolvedValue(() => {});
      vi.spyOn(backend, 'tinymistStart').mockResolvedValue({ ok: true, value: null });
      vi.spyOn(backend, 'tinymistSendNotification').mockResolvedValue({ ok: true, value: null });
      vi.spyOn(backend, 'tinymistSendRequest').mockResolvedValue({
        ok: true,
        value: [
          {
            label: 'fill',
            kind: 5,
            sortText: '002',
            insertTextFormat: 2,
            detail: 'The box background color. '.repeat(10),
            labelDetails: { description: 'color' },
            textEdit: edit('fill: ${1:}', 0, 5),
          },
          { label: '"a4"', kind: 6, sortText: '004', textEdit: edit('a4', 0, 18) },
        ],
      });
      const client = createLspClient();
      await client.start('/p');
      await client.openDocument('/p/main.typ', '#box()');

      const [fill, a4] = await client.getCompletions(5, 0, 5);
      expect(fill.sortText).toBe('002');
      expect(fill.shortDetail).toBe('color');
      expect(fill.info).toContain('background color');
      expect(fill.range.start.character).toBe(5);
      expect(a4.filterLabel).toBe('a4');
    });
  });

  describe('createLspCompletionSource (con un editor real)', () => {
    function setup(doc, pos, items) {
      const lsp = {
        isActive: () => true,
        getCurrentUri: () => 'file:///p/main.typ',
        getCompletions: vi.fn().mockResolvedValue(items),
      };
      const view = new EditorView({
        state: EditorState.create({ doc, selection: { anchor: pos }, extensions: [autocompletion()] }),
        parent: document.body,
      });
      return { view, lsp, source: createLspCompletionSource(lsp) };
    }

    const item = (label, newText, textEdit, extra = {}) => ({
      label,
      filterLabel: label,
      type: 'property',
      rawApply: newText,
      isSnippet: true,
      range: textEdit.range,
      ...extra,
    });

    it('dentro de #box() pide sugerencias y al aceptar "fill" deja "fill: " con el cursor listo', async () => {
      const { view, lsp, source } = setup('#box()', 5, [item('fill', 'fill: ${1:}', edit('', 0, 5))]);
      const result = await source(new CompletionContext(view.state, 5, false));
      expect(lsp.getCompletions).toHaveBeenCalled();
      expect(result.from).toBe(5);

      result.options[0].apply(view, result.options[0], result.from, 5);
      expect(view.state.doc.toString()).toBe('#box(fill: )');
      expect(view.state.selection.main.head).toBe(11);
      view.destroy();
    });

    it('respeta el rango de Tinymist: en #box(w) reemplaza solo la "w"', async () => {
      const { view, source } = setup('#box(w)', 6, [item('width', 'width: ${1:}', edit('', 0, 5, 6))]);
      const result = await source(new CompletionContext(view.state, 6, false));
      expect(result.from).toBe(5);

      result.options[0].apply(view, result.options[0], result.from, 6);
      expect(view.state.doc.toString()).toBe('#box(width: )');
      view.destroy();
    });

    it('tras una coma inserta el parámetro con el espacio que manda Tinymist', async () => {
      const { view, source } = setup('#box(width: 1cm,)', 16, [item('fill', ' fill: ${1:}', edit('', 0, 16))]);
      const result = await source(new CompletionContext(view.state, 16, false));
      result.options[0].apply(view, result.options[0], result.from, 16);
      expect(view.state.doc.toString()).toBe('#box(width: 1cm, fill: )');
      view.destroy();
    });

    it('aceptar una función deja el cursor entre paréntesis (box(|))', async () => {
      const { view, source } = setup('#bo', 3, [item('box', 'box(${1:})', edit('', 0, 1, 3), { type: 'function' })]);
      const result = await source(new CompletionContext(view.state, 3, false));
      expect(result.from).toBe(1);
      result.options[0].apply(view, result.options[0], result.from, 3);
      expect(view.state.doc.toString()).toBe('#box()');
      expect(view.state.selection.main.head).toBe(5);
      view.destroy();
    });

    it('pasa sortText para que CodeMirror respete el orden de Tinymist', async () => {
      const { view, source } = setup('#box()', 5, [item('fill', 'fill: ${1:}', edit('', 0, 5), { sortText: '002' })]);
      const result = await source(new CompletionContext(view.state, 5, false));
      expect(result.options[0].sortText).toBe('002');
      view.destroy();
    });

    it('no pregunta a Tinymist tras un espacio en texto normal', async () => {
      const { view, lsp, source } = setup('Hola ', 5, []);
      expect(await source(new CompletionContext(view.state, 5, false))).toBeNull();
      expect(lsp.getCompletions).not.toHaveBeenCalled();
      view.destroy();
    });
  });
});
