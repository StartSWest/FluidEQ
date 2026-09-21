/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A chain the listener saves keeps the tone that was playing with it.
 *
 * A preset's tone is its Preset layer in the main EQ now (`presetCurve.ts`),
 * not a stage of the rack, so a chain saved from Metal and stored as its rack
 * alone would come back without Metal's tone.
 */
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { DSP_PRESETS } from 'common/dsp/presets';
import {
  readUserDspPresets,
  saveUserDspPreset,
} from 'renderer/dsp/userDspPresets';

const STORAGE_KEY = 'fluideq.dsp.userChainPresets.v1';

const metal = DSP_PRESETS.find((preset) => preset.id === 'metal');

beforeEach(() => localStorage.clear());

it('keeps the curve a chain was saved with', () => {
  if (!metal?.curve) {
    throw new Error('Metal has no curve');
  }
  const saved = saveUserDspPreset('My metal', metal.settings, metal.curve);
  const [read] = readUserDspPresets();
  expect(read.id).toBe(saved.id);
  expect(read.curve?.bands).toEqual(metal.curve.bands);
  expect(read.curve?.subsonicHz).toBe(metal.curve.subsonicHz);
});

it('saves a chain with no tone as a rack alone', () => {
  saveUserDspPreset('Just the rack', { ...DSP_DEFAULTS, enabled: true });
  const [read] = readUserDspPresets();
  expect(read.curve).toBeUndefined();
  expect(
    JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')[0],
  ).not.toHaveProperty('curve');
});

it('reads a chain saved before chains kept a tone, and passes over a broken one', () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      { id: 'user-chain:old', name: 'Old', settings: DSP_DEFAULTS },
      {
        id: 'user-chain:odd',
        name: 'Odd',
        settings: DSP_DEFAULTS,
        curve: 'not a curve',
      },
    ]),
  );
  const read = readUserDspPresets();
  expect(read.map((preset) => preset.name)).toEqual(['Old', 'Odd']);
  expect(read.map((preset) => preset.curve)).toEqual([undefined, undefined]);
});
