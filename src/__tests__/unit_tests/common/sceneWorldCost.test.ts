/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  worldInstanceScopeNames,
  type TWorldColour,
  type TWorldExpr,
} from '../../../common/sceneWorld';
import {
  copyCost,
  modelFrameVertices,
  pointCost,
  variesPerFrame,
} from '../../../common/sceneWorldCost';
import {
  compileExpression,
  type ICompiledExpression,
  type IExpressionScope,
} from '../../../common/worldExpression';

/**
 * What a copy's formulas cost a frame, before anything is built: the budget
 * charges here what the engine works out a frame (`worldCopies.ts`), so the
 * two must count the same things. A colour is worked out whole, so one
 * channel following the music makes all three a frame's work.
 */

const SCOPE: IExpressionScope = {
  names: worldInstanceScopeNames(['glow'], ['kick']),
};

const compiled = (source: string): ICompiledExpression => {
  const result = compileExpression(source, SCOPE);
  if (!result.ok) {
    throw new Error(`"${source}" did not compile: ${result.error}`);
  }
  return result.expression;
};

const costOf = (formulas: readonly TWorldExpr[], colour?: TWorldColour) =>
  copyCost(formulas, colour, SCOPE);

describe('whether a copy’s formula is worked out every frame', () => {
  it.each([
    ['x + u * 2', false],
    ['rand * 3 + i / n', false],
    ['2 * pi', false],
    ['x + bass', true],
    ['p.glow * u', true],
    ['kick', true],
    ['spec(u)', true],
    ['smooth(u, 1)', true],
  ])('reads %s as changing every frame: %p', (source, every) => {
    expect(variesPerFrame(compiled(source))).toBe(every);
  });
});

describe('what a copy costs a frame', () => {
  it('counts every channel of a colour when any one of them follows the music', () => {
    expect(costOf([], { rgb: ['bass', 0.5, 0.5] })).toEqual({
      perFrame: 3,
      state: 0,
    });
    expect(costOf([], { hsl: [0.5, 1, 'level * 0.5'] })).toEqual({
      perFrame: 3,
      state: 0,
    });
  });

  it('counts no channel of a colour worked out once for each copy', () => {
    expect(costOf([], { rgb: ['u', 'rand', 0.5] })).toEqual({
      perFrame: 0,
      state: 0,
    });
    expect(costOf([], { hex: '#ff0080' })).toEqual({ perFrame: 0, state: 0 });
  });

  it('counts each formula of its place, turn and size that changes every frame, and the memory each keeps', () => {
    expect(costOf(['x', 'y + bass', 'smooth(u, 1)', 2, 'rand * tau'])).toEqual({
      perFrame: 2,
      state: 1,
    });
    expect(
      costOf(['decay(beat, 0.2)'], { rgb: ['smooth(u, 1)', 1, 1] }),
    ).toEqual({ perFrame: 4, state: 2 });
  });

  it('charges nothing for a formula that does not read', () => {
    expect(costOf(['nope(1)', 'y +'], { rgb: ['z z', 1, 1] })).toEqual({
      perFrame: 0,
      state: 0,
    });
  });
});

describe('what a placement of a model is charged', () => {
  it('is its shaded vertices where it draws as a grid does, two triangles a vertex or fewer', () => {
    expect(modelFrameVertices({ vertices: 1000, triangles: 1900 })).toBe(1000);
    expect(modelFrameVertices({ vertices: 1000, triangles: 2000 })).toBe(1000);
  });

  it('is half its triangles where an index reuses a few vertices over and over', () => {
    expect(modelFrameVertices({ vertices: 3, triangles: 500_000 })).toBe(
      250_000,
    );
    expect(modelFrameVertices({ vertices: 0, triangles: 3 })).toBe(2);
  });
});

describe('what a ribbon’s point costs a frame', () => {
  it('counts every written formula every frame, whatever it reads', () => {
    expect(
      pointCost(['u * 10 - 5', 0, 'x', 0.1], { rgb: ['u', 1, 1] }, SCOPE),
    ).toEqual({ perFrame: 3, state: 0 });
  });
});
