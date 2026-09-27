/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import troubleHoldsBack from '../../../renderer/studio/stageTrouble';
import type { TStageTrouble } from '../../../renderer/studio/StudioStage';

/**
 * Which of the stage's troubles keep a version from being published and
 * kept. A world that drew with a part left out plays as its author sees it,
 * with the reason beside it; held back, it read "the world was not drawn"
 * over a world standing on the stage.
 */

const MODEL_LEFT_OUT = { code: 'model-refused', model: 'ship' } as const;

describe('what holds a version back', () => {
  it('is nothing when the stage reports no trouble', () => {
    expect(troubleHoldsBack(undefined)).toBe(false);
  });

  it.each<[string, TStageTrouble]>([
    ['a shader that did not compile', { kind: 'compile', log: 'ERROR: 0:1' }],
    ['a scene too heavy to draw', { kind: 'heavy' }],
    ['a stage that cannot draw', { kind: 'unavailable' }],
    [
      'a world that did not draw',
      { kind: 'world', report: { drawn: false, notes: [MODEL_LEFT_OUT] } },
    ],
    [
      'a world that did not draw, with no reason given',
      { kind: 'world', report: { drawn: false, notes: [] } },
    ],
  ])('is %s', (_what, trouble) => {
    expect(troubleHoldsBack(trouble)).toBe(true);
  });

  it('is never a world that drew with a part left out', () => {
    expect(
      troubleHoldsBack({
        kind: 'world',
        report: { drawn: true, notes: [MODEL_LEFT_OUT] },
      }),
    ).toBe(false);
  });
});
