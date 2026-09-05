// =============================================================================
// DBV Typst Editor — Catálogo de símbolos matemáticos (Beta, ARCHITECTURE.md §7.7.4)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================
//
// Cada `name` es el identificador REAL de Typst (lo que se inserta), no una
// invención — verificado compilando los 40 de golpe contra el binario
// vendorizado antes de escribir este fichero (0 avisos del compilador).
// `glyph` es solo para mostrarlo en el botón; `keywords` amplía lo que
// encuentra el filtro del desplegable más allá del propio nombre Typst.

export const SYMBOL_GALLERY = [
  { name: 'alpha', glyph: 'α', keywords: ['alfa'] },
  { name: 'beta', glyph: 'β', keywords: ['beta'] },
  { name: 'gamma', glyph: 'γ', keywords: ['gamma'] },
  { name: 'delta', glyph: 'δ', keywords: ['delta'] },
  { name: 'epsilon', glyph: 'ε', keywords: ['épsilon'] },
  { name: 'theta', glyph: 'θ', keywords: ['zeta'] },
  { name: 'lambda', glyph: 'λ', keywords: ['lambda'] },
  { name: 'mu', glyph: 'μ', keywords: ['mu'] },
  { name: 'pi', glyph: 'π', keywords: ['pi'] },
  { name: 'sigma', glyph: 'σ', keywords: ['sigma'] },
  { name: 'phi', glyph: 'φ', keywords: ['fi'] },
  { name: 'omega', glyph: 'ω', keywords: ['omega'] },
  { name: 'Delta', glyph: 'Δ', keywords: ['delta mayuscula', 'incremento'] },
  { name: 'Sigma', glyph: 'Σ', keywords: ['sigma mayuscula', 'sumatorio'] },
  { name: 'Omega', glyph: 'Ω', keywords: ['omega mayuscula'] },
  { name: 'sum', glyph: '∑', keywords: ['sumatorio', 'suma'] },
  { name: 'product', glyph: '∏', keywords: ['productorio'] },
  { name: 'integral', glyph: '∫', keywords: ['integral'] },
  { name: 'infinity', glyph: '∞', keywords: ['infinito'] },
  { name: 'arrow.r', glyph: '→', keywords: ['flecha', 'derecha'] },
  { name: 'arrow.l', glyph: '←', keywords: ['flecha', 'izquierda'] },
  { name: 'arrow.l.r', glyph: '↔', keywords: ['flecha', 'doble'] },
  { name: 'arrow.r.double', glyph: '⇒', keywords: ['implica'] },
  { name: 'lt.eq', glyph: '≤', keywords: ['menor o igual'] },
  { name: 'gt.eq', glyph: '≥', keywords: ['mayor o igual'] },
  { name: 'eq.not', glyph: '≠', keywords: ['distinto', 'no igual'] },
  { name: 'approx', glyph: '≈', keywords: ['aproximado'] },
  { name: 'in', glyph: '∈', keywords: ['pertenece'] },
  { name: 'in.not', glyph: '∉', keywords: ['no pertenece'] },
  { name: 'subset', glyph: '⊂', keywords: ['subconjunto'] },
  { name: 'subset.eq', glyph: '⊆', keywords: ['subconjunto o igual'] },
  { name: 'emptyset', glyph: '∅', keywords: ['vacio', 'conjunto vacio'] },
  { name: 'times', glyph: '×', keywords: ['multiplicacion', 'por'] },
  { name: 'dot', glyph: '·', keywords: ['punto', 'producto escalar'] },
  { name: 'plus.minus', glyph: '±', keywords: ['mas menos'] },
  { name: 'minus.plus', glyph: '∓', keywords: ['menos mas'] },
  { name: 'partial', glyph: '∂', keywords: ['derivada parcial'] },
  { name: 'nabla', glyph: '∇', keywords: ['gradiente'] },
  { name: 'forall', glyph: '∀', keywords: ['para todo'] },
  { name: 'exists', glyph: '∃', keywords: ['existe'] },
];
