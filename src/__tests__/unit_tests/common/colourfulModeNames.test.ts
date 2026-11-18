/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * NO STRING NAMES A RAINBOW, IN ANY LANGUAGE (Ivan, 2026-10-25: "also change
 * all ui that says rainbow to colorful mode"). Since 2026-11-18 Colourful
 * mode is always on and has no name on screen at all: its switch, its pill
 * on the signal and the Look designer's heading went with their strings. What
 * still speaks of the window's colours - the Look designer's border, the
 * Support card's share, the Help page - is pinned here, and the Help page is
 * found by what replaced the mode: the Tint's second colour and its gradient.
 */

import {
  loadLocale,
  LOCALES,
  translate,
  type TranslationKey,
} from 'common/i18n';

/** Each language's rainbow, as its strings used to write it. */
const RAINBOW =
  /rainbow|arco[íi]ris|arco-íris|regenbogen|arc-en-ciel|arcobaleno|радуг|радуж|レインボー|虹|무지개|彩虹|इंद्रधनुष/i;

const SHOWN: TranslationKey[] = [
  'look.rainbowBorder',
  'look.rainbowBorderHint',
  'support.game.shareEuphoria',
  'help.window.tip',
];

const codes = LOCALES.map((locale) => locale.code);

beforeAll(() => Promise.all(codes.map((code) => loadLocale(code))));

describe('the window’s colours, as the strings say them', () => {
  it('reads the old word as a rainbow (the control for the cases below)', () => {
    expect('Rainbow mode').toMatch(RAINBOW);
    expect('Modo arcoíris').toMatch(RAINBOW);
  });

  it.each(codes)('names no rainbow anywhere they show, in %s', (code) => {
    SHOWN.forEach((key) => {
      expect([key, translate(code, key)]).toEqual([
        key,
        expect.not.stringMatching(RAINBOW),
      ]);
    });
  });

  // Searched for by what the window offers now; the English words stay
  // beside each language's own for anybody who searches in them.
  it.each(codes)(
    'finds the window’s Help page by the Tint’s second colour and gradient, in %s',
    (code) => {
      const keywords = translate(code, 'help.window.keywords').toLowerCase();
      expect(keywords).toContain('second colour');
      expect(keywords).toContain('gradient');
    },
  );
});
