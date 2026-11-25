/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { render } from '@testing-library/react';
import { DSP_PRESETS } from 'common/dsp/presets';
import VoicingIcon from 'renderer/icons/VoicingIcon';

/*
 * Every rack preset draws a glyph of its own in the preset lists. The rack's
 * ids are kebab-case where the glyphs' are camel-case (`late-night` against
 * `lateNight`), and a lookup of the id as written gave Late night, Drum &
 * bass, Vinyl and Tape the generic sliders; Default, Reference, Air,
 * Expansive, Headphones and Speakers had no entry at all.
 */

const pathOf = (profileId?: string) => {
  const { container, unmount } = render(<VoicingIcon profileId={profileId} />);
  const d = container.querySelector('path')?.getAttribute('d');
  unmount();
  return d;
};

const GENERIC = pathOf(undefined);

it('draws the generic sliders for an id it has never heard of', () => {
  // The control the next case depends on: "not generic" means something.
  expect(GENERIC).toBeTruthy();
  expect(pathOf('no-such-preset')).toBe(GENERIC);
});

it('gives every preset the preset lists show a glyph of its own', () => {
  // The Gaming tab's chains are drawn there, by the game, not by this.
  const listed = DSP_PRESETS.filter((preset) => preset.group !== 'gaming');
  expect(listed.length).toBeGreaterThan(100);
  const generic = listed
    .filter((preset) => pathOf(preset.id) === GENERIC)
    .map((preset) => preset.id);
  expect(generic).toEqual([]);
});

it.each([
  ['late-night', 'lateNight'],
  ['drum-bass', 'drumBass'],
  ['vinyl-restore', 'vinylRestore'],
  ['tape-restore', 'tapeRestore'],
])('draws %s as %s', (rackId, glyphId) => {
  expect(pathOf(rackId)).toBe(pathOf(glyphId));
});

it('keeps an id written with a dash as its own key first', () => {
  // `v-shape` is a path and `gaming-room` an alias, under those very names.
  expect(pathOf('v-shape')).not.toBe(GENERIC);
  expect(pathOf('gaming-room')).toBe(pathOf('games'));
});
