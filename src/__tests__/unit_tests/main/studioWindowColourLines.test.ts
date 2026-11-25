/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Window colours check a look gives the Studio's chat, judged at the
 * hour each set is worn. Alpine's day set - a slate blue the white window
 * never paints - was reported NOT YET as a mid-tone, and the chat told the
 * member about a fault that was not there (2026-11-25).
 */

import windowColourLines from '../../../main/studioAgent/windowColourLines';

/** Alpine's day set as its pack names it. */
const ALPINE_DAY = { surface: '#3d4a5d', accent: '#cb73ff', glow: '#cee3fb' };

it('passes a day set whose surface only the white window would wear', () => {
  const [line] = windowColourLines({ '100': ALPINE_DAY });
  expect(line).toMatch(/^Window colours check: PASSES/);
});

it('still names the same surface as a mid-tone where a dark window wears it', () => {
  // CONTROL: the night wears its surface, so 0.41 there is not yet right.
  const [line] = windowColourLines({ '0': ALPINE_DAY });
  expect(line).toMatch(/^Window colours check: NOT YET/);
  expect(line).toMatch(/surface is a mid-tone \(lightness 0\.41/);
});
