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
import makerNoticeLingerSeconds from '../../../renderer/karaoke/makerNoticeLinger';

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
  it('keeps the notice up for the time its text takes to read, five seconds at least', () => {
    // The Maker sets the variable from the notice's length; with none set it
    // is the five seconds it always was.
    expect(
      reducedRule('.karaoke-maker__notice')?.declarations.get(
        'animation-duration',
      ),
    ).toBe('var(--karaoke-maker-notice-linger, 5s) !important');
    expect(makerNoticeLingerSeconds('Saved.')).toBe(5);
    const kept =
      'Kept your word timings. Found 493 editable melody notes from the voice.';
    expect(makerNoticeLingerSeconds(kept)).toBe(5);
    expect(makerNoticeLingerSeconds(`${kept} ${kept}`)).toBe(8);
    // A dense script says as much in fewer characters.
    expect(makerNoticeLingerSeconds('字'.repeat(60))).toBe(9);
    expect(makerNoticeLingerSeconds('a'.repeat(2_000))).toBe(14);
    // A hold: nothing in it moves.
    expect(animatedProperties('karaoke-maker-notice-linger')).toEqual(
      new Set(['opacity']),
    );
  });

  it("keeps the toast's linger and cuts only its rise into the notices' stack", () => {
    // The whole shorthand, so the stand-down's 1 ms reaches neither half: the
    // rise is gone and the linger keeps its length.
    expect(
      reducedRule('.karaoke-maker__toast')?.declarations.get('animation'),
    ).toBe('karaoke-maker-toast 2.6s linear !important');
    // A hold: it changes nothing that can be seen, only how long it stays.
    expect(animatedProperties('karaoke-maker-toast')).toEqual(
      new Set(['visibility']),
    );
    // The control: everywhere else the toast rises in first, then lingers.
    const toast = styleRules(css).find(
      ({ selectors, within }) =>
        within.length === 0 &&
        selectors.includes('.compact-frame.karaoke-maker__toast'),
    );
    expect(toast?.declarations.get('animation')).toMatch(
      /^rise-in .*, karaoke-maker-toast 2\.6s linear$/,
    );
  });
});
