/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How long the Maker's notice and its restore toast stay up, now that their
 * own animations decide it rather than a timer beside them.
 *
 * The window's reduced-motion stand-down cuts every animation to 1 ms. An
 * animation that is a lifetime has to keep its length through that, and may
 * only do so because it does not move: the toast's drift is split off and
 * stands down like any other motion. jsdom runs no animations, so this is
 * held against the compiled stylesheet.
 */

import {
  compileStylesheet,
  keyframes,
  styleRules,
} from '../../utils/stylesheetRules';

const css = compileStylesheet('Karaoke.scss');

const reducedRule = (className: string) =>
  styleRules(css).find(({ selectors }) =>
    selectors.some(
      (selector) =>
        selector.includes('data-motion') && selector.endsWith(className),
    ),
  );

const animatedProperties = (name: string) =>
  new Set(
    [...keyframes(css, name).values()].flatMap((frame) => [...frame.keys()]),
  );

describe("the Maker's messages under reduced motion", () => {
  it('keeps the notice up for its five seconds', () => {
    expect(
      reducedRule('.karaoke-maker__notice')?.declarations.get(
        'animation-duration',
      ),
    ).toBe('5s !important');
    // A hold: nothing in it moves.
    expect(animatedProperties('karaoke-maker-notice-linger')).toEqual(
      new Set(['opacity']),
    );
  });

  it("keeps the toast's fade and cuts only its drift", () => {
    expect(
      reducedRule('.karaoke-maker__toast')?.declarations.get(
        'animation-duration',
      ),
    ).toBe('2.6s, 1ms !important');
    expect(animatedProperties('karaoke-maker-toast')).toEqual(
      new Set(['opacity']),
    );
    // The control: the motion is all in the other one.
    expect(animatedProperties('karaoke-maker-toast-drift')).toEqual(
      new Set(['transform']),
    );
  });
});
