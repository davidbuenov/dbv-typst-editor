// =============================================================================
// DBV Typst Editor — Tests del modelo de datos del editor de diagramas (RF-31)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, expect, it } from 'vitest';
import {
  addEdge,
  addNode,
  createEmptyDiagram,
  diagramToCetzCode,
  extractDiagramModelNear,
  moveNode,
  removeEdge,
  removeNode,
  renameNode,
} from './diagramModel.js';

describe('createEmptyDiagram / addNode', () => {
  it('empieza vacío', () => {
    const diagram = createEmptyDiagram();
    expect(diagram.nodes).toEqual([]);
    expect(diagram.edges).toEqual([]);
  });

  it('añade nodos con id incremental, sin mutar el original', () => {
    const diagram = createEmptyDiagram();
    const withOne = addNode(diagram, { label: 'Inicio' });
    expect(diagram.nodes).toHaveLength(0); // inmutable
    expect(withOne.nodes).toHaveLength(1);
    expect(withOne.nodes[0].id).toBe('n1');

    const withTwo = addNode(withOne, { label: 'Fin' });
    expect(withTwo.nodes[1].id).toBe('n2');
  });
});

describe('moveNode / renameNode', () => {
  it('mueve solo el nodo indicado', () => {
    let diagram = addNode(createEmptyDiagram(), { label: 'A' });
    diagram = addNode(diagram, { label: 'B' });
    const moved = moveNode(diagram, 'n1', 200, 300);
    expect(moved.nodes[0]).toMatchObject({ x: 200, y: 300 });
    expect(moved.nodes[1]).toMatchObject(diagram.nodes[1]);
  });

  it('renombra sin tocar posición', () => {
    const diagram = addNode(createEmptyDiagram(), { label: 'A', x: 10, y: 10 });
    const renamed = renameNode(diagram, 'n1', 'Nuevo nombre');
    expect(renamed.nodes[0].label).toBe('Nuevo nombre');
    expect(renamed.nodes[0].x).toBe(10);
  });
});

describe('addEdge / removeEdge', () => {
  it('conecta dos nodos', () => {
    const diagram = addEdge(createEmptyDiagram(), 'n1', 'n2');
    expect(diagram.edges).toEqual([{ from: 'n1', to: 'n2' }]);
  });

  it('no duplica la misma conexión', () => {
    let diagram = addEdge(createEmptyDiagram(), 'n1', 'n2');
    diagram = addEdge(diagram, 'n1', 'n2');
    expect(diagram.edges).toHaveLength(1);
  });

  it('no permite conectar un nodo consigo mismo', () => {
    const diagram = addEdge(createEmptyDiagram(), 'n1', 'n1');
    expect(diagram.edges).toHaveLength(0);
  });

  it('retira una conexión concreta', () => {
    let diagram = addEdge(createEmptyDiagram(), 'n1', 'n2');
    diagram = addEdge(diagram, 'n2', 'n3');
    diagram = removeEdge(diagram, 'n1', 'n2');
    expect(diagram.edges).toEqual([{ from: 'n2', to: 'n3' }]);
  });
});

describe('removeNode', () => {
  it('retira el nodo y cualquier conexión que lo mencionara', () => {
    let diagram = addNode(createEmptyDiagram(), { label: 'A' });
    diagram = addNode(diagram, { label: 'B' });
    diagram = addEdge(diagram, 'n1', 'n2');

    const after = removeNode(diagram, 'n1');
    expect(after.nodes).toHaveLength(1);
    expect(after.edges).toHaveLength(0); // ninguna flecha colgando
  });
});

describe('diagramToCetzCode', () => {
  it('emite rect + content por nodo y line por conexión', () => {
    let diagram = addNode(createEmptyDiagram(), { label: 'Inicio', x: 0, y: 0 });
    diagram = addNode(diagram, { label: 'Fin', x: 200, y: 0 });
    diagram = addEdge(diagram, 'n1', 'n2');

    const code = diagramToCetzCode(diagram);
    expect(code).toContain('cetz.canvas');
    expect(code).toContain('rect(');
    expect(code).toContain('content("n1", [Inicio])');
    expect(code).toContain('content("n2", [Fin])');
    expect(code).toContain('line("n1", "n2", mark: (end: ">"))');
  });

  it('escapa corchetes en la etiqueta de un nodo', () => {
    const diagram = addNode(createEmptyDiagram(), { label: 'Paso [1]' });
    const code = diagramToCetzCode(diagram);
    expect(code).toContain('Paso \\[1\\]');
  });

  it('incrusta el modelo serializado, reconstruible', () => {
    let diagram = addNode(createEmptyDiagram(), { label: 'A' });
    diagram = addNode(diagram, { label: 'B' });
    diagram = addEdge(diagram, 'n1', 'n2');

    const code = diagramToCetzCode(diagram);
    const extracted = extractDiagramModelNear(code, code.length);
    expect(extracted.nodes.map((n) => n.label)).toEqual(['A', 'B']);
    expect(extracted.edges).toEqual([{ from: 'n1', to: 'n2' }]);
  });
});

describe('extractDiagramModelNear', () => {
  it('devuelve null si no hay ningún comentario de modelo cerca', () => {
    const doc = '#cetz.canvas({\n  rect((0,0),(1,1))\n})\n';
    expect(extractDiagramModelNear(doc, doc.length)).toBeNull();
  });

  it('no ofrece reabrir un bloque CeTZ escrito a mano (RF-31.3)', () => {
    // Mismo `cetz.canvas`, mismo import, pero SIN el comentario de modelo:
    // es exactamente el caso que RF-31.3 pide no confundir con "reabrible".
    const handWritten = `#cetz.canvas({
      import cetz.draw: *
      rect((0, 0), (2, 1), name: "a")
      content("a", [Hecho a mano])
    })`;
    expect(extractDiagramModelNear(handWritten, handWritten.length)).toBeNull();
  });

  it('reconstruye el modelo desde un comentario cercano al cursor', () => {
    const diagram = addNode(addNode(createEmptyDiagram(), { label: 'X' }), { label: 'Y' });
    const code = diagramToCetzCode(diagram);
    const cursorAtEnd = code.length;
    const extracted = extractDiagramModelNear(code, cursorAtEnd);
    expect(extracted).not.toBeNull();
    expect(extracted.nodes).toHaveLength(2);
  });

  it('ignora un modelo demasiado lejos del cursor (otro diagrama, otro capítulo)', () => {
    const diagram = addNode(createEmptyDiagram(), { label: 'Lejano' });
    const farBlock = diagramToCetzCode(diagram);
    const padding = 'x'.repeat(3000);
    const doc = `${farBlock}\n${padding}\ncursor aquí`;
    expect(extractDiagramModelNear(doc, doc.length)).toBeNull();
  });

  it('un JSON corrupto en el comentario no revienta, degrada a null', () => {
    const doc = '// dbv-diagram-model: {esto no es json válido\n';
    expect(extractDiagramModelNear(doc, doc.length)).toBeNull();
  });
});
