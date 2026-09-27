/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  compileExpression,
  type ICompiledExpression,
  type IExpressionRuntime,
  type IExpressionScope,
} from '../../../common/worldExpression';

/**
 * What a world's formula keeps from one frame to the next is only ever a
 * finite number. One NaN or Infinity stored by `smooth`, `decay` or
 * `integrate` was kept for good — every frame after worked out from it, and
 * the formula read 0 for the rest of the session — so each case here runs on
 * past the bad frame and reads what came after it. The final guard turns any
 * non-finite answer into 0, so the cases are written where that 0 and the
 * right answer differ.
 */

const SCOPE: IExpressionScope = { names: ['x', 'y'] };

const compile = (source: string): ICompiledExpression => {
  const result = compileExpression(source, SCOPE);
  if (!result.ok) {
    throw new Error(`"${source}" did not compile: ${result.error}`);
  }
  return result.expression;
};

/** One formula over frames of one second each, `x` and `y` given per frame. */
const overFrames = (
  source: string,
  frames: readonly { x: number; y?: number }[],
): number[] => {
  const expression = compile(source);
  const rt: IExpressionRuntime = {
    env: new Float64Array(2),
    state: new Float64Array(4),
    stateBase: 0,
    dt: 1,
    spectrum: () => 0,
    slow: () => 0,
    wave: () => 0,
  };
  return frames.map(({ x, y = 0 }) => {
    rt.env[0] = x;
    rt.env[1] = y;
    return expression.evaluate(rt);
  });
};

describe('nought to a negative power', () => {
  it('reads 0, as a division by nought does, written either way and folded or live', () => {
    expect(compile('pow(0, -1)').constant).toBe(0);
    expect(compile('0 ^ -1').constant).toBe(0);
    // Inside min() an Infinity would come out as 5, where a 0 stays 0.
    expect(compile('min(pow(0, -1), 5)').constant).toBe(0);
    expect(compile('min(0 ^ -2, 5)').constant).toBe(0);
    expect(overFrames('min(pow(x, -1), 5)', [{ x: 0 }, { x: 4 }])).toEqual([
      0, 0.25,
    ]);
    expect(overFrames('min(x ^ -1, 5)', [{ x: 0 }, { x: 4 }])).toEqual([
      0, 0.25,
    ]);
  });

  it('never poisons a smooth that eases toward it: a frame at nought and then two recovers toward a half', () => {
    expect(
      overFrames('smooth(x ^ -1, 1)', [{ x: 0 }, { x: 2 }, { x: 2 }]),
    ).toEqual([0, 0.25, 0.375]);
  });
});

describe('a remembering call handed something that is not a number', () => {
  it.each([
    ['smooth', NaN, [0.5, 0.5, 0.75]],
    ['smooth', Infinity, [0.5, 0.5, 0.75]],
    ['decay', NaN, [1, 1, 1]],
    ['decay', -Infinity, [1, 1, 1]],
  ])(
    'keeps what %s had through a frame of %p and carries on from it',
    (call, bad, expected) => {
      expect(
        overFrames(`${call}(x, 1)`, [{ x: 1 }, { x: bad }, { x: 1 }]),
      ).toEqual(expected);
    },
  );

  it('keeps the last finite sum of an integrate that would overflow, and carries on from it', () => {
    const most = Number.MAX_VALUE;
    expect(
      overFrames('integrate(x)', [{ x: most }, { x: most }, { x: -most / 2 }]),
    ).toEqual([most, most, most / 2]);
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])(
    'lands on its target when its half-life is %s, and its memory stays a number',
    (_name, halfLife) => {
      expect(
        overFrames('smooth(x, y)', [
          { x: 1, y: halfLife },
          { x: 2, y: halfLife },
          { x: 3, y: 1 },
        ]),
      ).toEqual([1, 2, 2.5]);
    },
  );
});
