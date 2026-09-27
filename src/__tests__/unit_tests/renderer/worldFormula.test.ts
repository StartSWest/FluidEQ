/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IExpressionRuntime,
  IExpressionScope,
} from '../../../common/worldExpression';
import { createFormula } from '../../../renderer/graph/world/worldFormula';

// three's build is ES modules this Jest cannot load, and a formula's memory
// uses none of it: only a colour formula paints a three Color.
jest.mock('three', () => ({ Color: class Color {}, SRGBColorSpace: 'srgb' }));

/**
 * A world's formula bound to the frame, one memory per copy: two pillars
 * easing toward their own heights must never share an easing, or a ring of
 * them moves as one pillar drawn many times.
 */

const SCOPE: IExpressionScope = { names: ['x'] };

const runtime = (): IExpressionRuntime => ({
  env: new Float64Array(1),
  state: new Float64Array(0),
  stateBase: 0,
  dt: 1,
  spectrum: () => 0,
  slow: () => 0,
  wave: () => 0,
});

describe("a world formula's memory", () => {
  it('keeps one for each copy of a formula evaluated per copy', () => {
    const rt = runtime();
    const pillars = createFormula('smooth(x, 1)', rt, SCOPE, 3);
    const frame = (heights: readonly number[]) =>
      heights.map((height, copy) => {
        rt.env[0] = height;
        return pillars.value(copy);
      });
    expect(frame([1, 0, 1])).toEqual([0.5, 0, 0.5]);
    expect(frame([1, 0, 0])).toEqual([0.75, 0, 0.25]);
  });

  it('keeps one for each formula, however many share the frame', () => {
    const rt = runtime();
    const first = createFormula('integrate(1)', rt, SCOPE);
    const second = createFormula('integrate(1)', rt, SCOPE);
    expect([first.value(), first.value(), second.value()]).toEqual([1, 2, 1]);
  });

  it('is 0 rather than an exception mid-frame for a formula its scope cannot run', () => {
    const formula = createFormula('height * 2', runtime(), SCOPE);
    expect(formula.constant).toBe(0);
    expect(formula.value()).toBe(0);
  });
});
