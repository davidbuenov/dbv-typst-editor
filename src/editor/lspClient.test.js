// =============================================================================
// DBV Typst Editor — Tests del cliente LSP Tinymist (RF-21)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLspClient,
  getCompletionWordRange,
  mapLspKind,
  pathToUri,
  posFromLsp,
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
      vi.spyOn(backend, 'tinymistSendRequest').mockResolvedValue({
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

      const ok = await client.formatDocument(mockView);
      expect(ok).toBe(true);
      expect(dispatchSpy).toHaveBeenCalled();
      expect(notifications.length).toBe(1);
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
  });
});
